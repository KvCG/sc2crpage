// services/weatherService.ts
import axios, { AxiosError } from 'axios'
import https from 'https'
import { readCsv } from '../utils/csvParser'
import cache from '../utils/cache'
import { getTimeUntilNextRefresh } from '../utils/cache'
import { chunkArray, retryDelay } from '../utils/pulseApiHelper'

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    keepAliveMsecs: 15000,
    timeout: 30000,
})

const api = axios.create({
    baseURL: 'https://sc2pulse.nephest.com/sc2/api',
    httpAgent: agent,
})

export const searchPlayer = async (term: string) => {
    try {
        // Node automatically decodes URL params son in order to send the search term to the pulse API we need to encode it again
        const response = await api.get(
            `/character/search?term=${encodeURIComponent(term)}`
        )
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError
        console.log(axiosError.message)
    }
}

export const getTop = async (daysAgo = 120, retries = 0, maxRetries = 3) => {
    const players = await readCsv()
    const ids = players.map(player => player.id)
    let chunkSize = 10
    const reqArray = []

    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize)
        reqArray.push(
            api.get(`character/${chunk.join(',')}/summary/1v1/${daysAgo}/`)
        )
    }

    try {
        const rankingData = await Promise.all(reqArray)
        const finalRank = rankingData.flatMap(data => data.data)
        return finalRank
    } catch (error) {
        const axiosError = error as AxiosError
        if (axiosError.code === 'ECONNABORTED') {
            console.error('Request timed out:', axiosError.message)
        }

        if (retries < maxRetries) {
            const delay = retryDelay(retries)
            console.log(`Retrying ranking in ${delay / 1000} seconds...`)
            await new Promise(resolve => setTimeout(resolve, delay)) // Exponential backoff to avoid flooding the pulse api
            return getTop(daysAgo, retries + 1, maxRetries)
        } else {
            console.error('Max retries reached. Aborting.')
        }

        console.error('Error occurred:', axiosError.code)
        return [] //fallback response
    }
}

export const getDailySnapshot = async (retries = 0, maxRetries = 3) => {
    const players = await readCsv()
    const ids = players.map(player => player.id)
    const cachedData = cache.get('snapShot')

    if (cachedData) {
        return cachedData
    } else {
        try {
            // Split the ids into chunks of 10
            const idChunks = chunkArray(ids, 10)

            // Function to request data for each chunk
            const fetchDataForChunk = async (chunk: string[]) => {
                return await Promise.all([
                    api.get(`character/${chunk.join(',')}/summary/1v1/30/`),
                    api.get(`character/${chunk.join(',')}/summary/1v1/60/`),
                    api.get(`character/${chunk.join(',')}/summary/1v1/90/`),
                    api.get(`character/${chunk.join(',')}/summary/1v1/120/`),
                ])
            }

            // Fetch data for all chunks
            const allResponses = await Promise.all(
                idChunks.map(chunk => fetchDataForChunk(chunk))
            )
            const timeUntilNextRefresh = getTimeUntilNextRefresh()
            // Combine the results from all chunks
            const response = {
                '30': allResponses.flatMap(responses => responses[0].data),
                '60': allResponses.flatMap(responses => responses[1].data),
                '90': allResponses.flatMap(responses => responses[2].data),
                '120': allResponses.flatMap(responses => responses[3].data),
                expiry: Date.now() + timeUntilNextRefresh, // Every day expires at 12am
            }

            cache.set('snapShot', response, timeUntilNextRefresh / 1000)

			cache.on('expired', async key => {
                console.log(
                    'The key: ',
                    key,
                    'has expired at ',
                    `${new Date().toLocaleString('en-US', {
                        timeZone: 'America/Costa_Rica',
                    })}`
                )

				if (key === 'snapShot') {
                    console.log('Fetching new snapshot after cache expiration...')
                    await getDailySnapshot() // Trigger snapshot retrieval again
                }
            })

            return response
        } catch (error) {
            const axiosError = error as AxiosError
            if (axiosError.code === 'ECONNABORTED') {
                console.error('Request timed out:', axiosError.message)
            }

            if (retries < maxRetries) {
                const delay = retryDelay(retries)
                console.log(`Retrying Snapshot in ${delay / 1000} seconds...`)
                await new Promise(resolve => setTimeout(resolve, delay)) // Exponential backoff to avoid flooding the pulse api
                return getDailySnapshot(retries + 1, maxRetries)
            } else {
                console.error('Max retries reached. Aborting.')
            }

            console.error('Error occurred:', axiosError.code)
            return [] // Returning an empty array or a fallback response
        }
    }
}
