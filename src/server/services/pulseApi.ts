// services/weatherService.ts
import axios, { AxiosError } from 'axios'
import https from 'https'
import { players } from '../constants/players'

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
    try {
        const response = await axios.all(
            Object.keys(players).map(async key => {
                const term = players[key]
                console.log(`/character/search?term=${term}`)

                // Make the API call and return the data
                const result = await api.get(`/character/search?term=${term}`)
                if (result.data.length) return { ...result.data }
				return null
            })
        )

        return response
    } catch (error) {
        const axiosError = error as AxiosError
        console.log(axiosError.message)
    }
}
