import axios, { AxiosError } from 'axios'
import https from 'https'
import { readCsv } from '../utils/csvParser'
import cache from '../utils/cache'
import { getTimeUntilNextRefresh } from '../utils/cache'
import {
    chunkArray,
    retryDelay,
    toCostaRicaTime,
} from '../utils/pulseApiHelper'
import { DateTime } from 'luxon'

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
        // Node automatically decodes URL params; so we encode the search term again.
        const response = await api.get(`/character/search?term=${encodeURIComponent(term)}`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError
        console.error(`[searchPlayer] Error while searching for term "${term}": ${axiosError.message}`)
    }
}

const getCurrentSeason = async () => {
    try {
        const response = await api.get(`season/list/all`)
        // The current season is assumed to be the first element
        return response.data[0].battlenetId
    } catch (error) {
        const axiosError = error as AxiosError
        console.error(`[getCurrentSeason] Error fetching current season: ${axiosError.message}`)
    }
}

const getPlayerStats = async (playerId: string) => {
    try {
        const seasonId = await getCurrentSeason()
        const response = await api.get(`group/team?season=${seasonId}&queue=LOTV_1V1&race=&characterId=${playerId}`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError
        // If the player is not found an 404 error will be thrown, we can ignore this error
        // cause is an expected behavior
        if (axiosError.response && axiosError.response.status !== 404) {
            console.error(`[getPlayerStats] Error fetching stats for playerId "${playerId}": ${axiosError.message}`)
        }
    }
}

const getPlayerGamesPerRace = async (playerStats: Array<{ members: Array<{ zergGamesPlayed?: number, protossGamesPlayed?: number, terranGamesPlayed?: number, randomGamesPlayed?: number }> }>) => {
    const gamesPerRace = {
        zergGamesPlayed: 0,
        protossGamesPlayed: 0,
        terranGamesPlayed: 0,
        randomGamesPlayed: 0,
    }

    playerStats?.forEach(player => {
        player.members.forEach(member => {
            gamesPerRace.zergGamesPlayed += member.zergGamesPlayed || 0
            gamesPerRace.protossGamesPlayed += member.protossGamesPlayed || 0
            gamesPerRace.terranGamesPlayed += member.terranGamesPlayed || 0
            gamesPerRace.randomGamesPlayed += member.randomGamesPlayed || 0
        })
    })
    return gamesPerRace
}

const getPlayerLastDatePlayed = async (
    playerStats: Array<{ lastPlayed: string }>
) => {
    try {
        if (!playerStats || playerStats.length === 0) return '-'

        const mostRecent = playerStats.reduce((a, b) =>
            new Date(b.lastPlayed) > new Date(a.lastPlayed) ? b : a
        )

        const lastPlayed = toCostaRicaTime(mostRecent.lastPlayed)
        const now = DateTime.now().setZone('America/Costa_Rica')

        const diffDays = now
            .startOf('day')
            .diff(lastPlayed.startOf('day'), 'days').days

        if (diffDays === 0) {
            return lastPlayed.toFormat('h:mm a') // e.g., "7:33 AM"
        }

        return `${Math.floor(diffDays)}d ago`
    } catch (error) {
        console.error(`[getPlayerLastDatePlayed] Error:`, error)
        return '-'
    }
}

const isPlayerLikelyOnline = (
    playerStats: Array<{ lastPlayed: string }>
): boolean => {
    if (!playerStats || playerStats.length === 0) return false

    try {
        const mostRecent = playerStats.reduce((a, b) =>
            new Date(b.lastPlayed) > new Date(a.lastPlayed) ? b : a
        )

        const lastPlayed = toCostaRicaTime(mostRecent.lastPlayed)
        const now = DateTime.now().setZone('America/Costa_Rica')

        const diffMinutes = now.diff(lastPlayed, 'minutes').minutes

        return diffMinutes <= 30 //Its a long time but SC2Pulse api is slow and games could take longer
    } catch (error) {
        console.error('[isPlayerLikelyOnline] Error:', error)
        return false
    }
}

export const updatePlayerInformation = async (playersInformation: any[]) => {
    const playersArray = Array.isArray(playersInformation) ? playersInformation : [playersInformation]
    const updatedPlayers = await Promise.all(
        playersArray.map(async (player: { playerCharacterId: string }) => {
            if (player.playerCharacterId) {
                const playerStats = await getPlayerStats(player.playerCharacterId)
                const gamesPerRace = await getPlayerGamesPerRace(playerStats)
                const lastDatePlayed = await getPlayerLastDatePlayed(playerStats)
				const online = isPlayerLikelyOnline(playerStats)
                return {
                    ...player,
                    gamesPerRace,
                    lastDatePlayed,
					online
                }
            }
            return player
        })
    )

    return updatedPlayers
}

const getPlayersIds = async () => {
    try {
        const players = await readCsv()
        return players.map((player: { id: any }) => player.id)
    } catch (error) {
        console.error(`[getPlayersIds] Error reading CSV: ${(error as Error).message}`)
        return []
    }
}

const handleApiError = async (error: AxiosError, retries: number, maxRetries: number, retryFunction: () => Promise<any>) => {
    if (error.code === 'ECONNABORTED') {
        console.error(`[handleApiError] Request timed out: ${error.message}`)
    }

    if (retries < maxRetries) {
        const delay = retryDelay(retries)
        console.error(`[handleApiError] Retry attempt ${retries + 1}/${maxRetries} in ${delay / 1000} seconds. Error code: ${error.code}`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return retryFunction()
    } else {
        console.error(`[handleApiError] Max retries reached. Aborting. Error code: ${error.code}`)
    }

    console.error(`[handleApiError] Error occurred: ${error.code}`)
    return []
}

export const getTop = async (daysAgo = 120, retries = 0, maxRetries = 3) => {
    try {
        const ids = await getPlayersIds()
        const reqArray: any[] = []
        // Split the ids into chunks of 10
        const idChunks = chunkArray(ids, 10)
        idChunks.map(chunk => reqArray.push(api.get(`character/${chunk.join(',')}/summary/1v1/${daysAgo}/`)))
        const rankingData = await Promise.all(reqArray)
        const finalRank = rankingData.flatMap(data => data.data)
        return finalRank
    } catch (error) {
        console.error(`[getTop] Error fetching top players for daysAgo="${daysAgo}": ${(error as AxiosError).message}`)
        return handleApiError(error as AxiosError, retries, maxRetries, () => getTop(daysAgo, retries + 1, maxRetries))
    }
}

export const getDailySnapshot = async (retries = 0, maxRetries = 3) => {
    const ids = await getPlayersIds()
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
                expiry: Date.now() + timeUntilNextRefresh, // Expires at calculated time
            }

            cache.set('snapShot', response, timeUntilNextRefresh / 1000)
            console.info(`[getDailySnapshot] Snapshot cached successfully. Next refresh in ${timeUntilNextRefresh / 1000} seconds.`)

            cache.on('expired', async key => {
                console.info(`[Cache] Key "${key}" has expired at ${new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' })}`)
                if (key === 'snapShot') {
                    console.info(`[Cache] Fetching new snapshot after cache expiration...`)
                    await getDailySnapshot()
                }
            })
            return response
        } catch (error) {
            console.error(`[getDailySnapshot] Error fetching daily snapshot: ${(error as AxiosError).message}`)
            return handleApiError(error as AxiosError, retries, maxRetries, () => getDailySnapshot(retries + 1, maxRetries))
        }
    }
}
