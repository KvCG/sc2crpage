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
    try {
		// Node automatically decodes URL params son in order to send the search term to the pulse API we need to encode it again
        const response = await api.get(`/character/search?term=${encodeURIComponent(term)}`) 
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError
        console.log(axiosError.message)
    }
}

export const getTop = async () => {
    const players = await readCsv()
    try {
		const ids = players.map((player) => player.id)
        const result = await api.get(`character/${ids.join(',')}/summary/1v1/120/`)
        return result.data
    } catch (error) {
        const axiosError = error as AxiosError
        console.log(axiosError.message)
    }
}
