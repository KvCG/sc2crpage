// services/weatherService.ts
import axios, { AxiosError } from 'axios'
import https from 'https'
import { readCsv } from './csvParser'

const agent = new https.Agent({ rejectUnauthorized: false })

const api = axios.create({
    baseURL: 'https://sc2pulse.nephest.com/sc2/api',
    httpAgent: agent,
})

export const searchPlayer = async (term: string) => {
    console.log(`Searching for: ${term}`)
    try {
        const response = await api.get(`/character/search?term=${term}`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError
        console.log(axiosError.message)
    }
}

export const getTop = async () => {
    const players = await readCsv()
    try {
        const response = await axios.all(
            players.map(async (player) => {
                const term = player.btag
                // Make the API call and return the data
                const result = await api.get(`/character/search?term=${term}`)
                return result.data
            })
        )
        return response
    } catch (error) {
        const axiosError = error as AxiosError
        console.log(axiosError.message)
    }
}
