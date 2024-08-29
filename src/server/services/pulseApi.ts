// services/weatherService.ts
import axios, { AxiosError } from 'axios'
import https from 'https'

const agent = new https.Agent({ rejectUnauthorized: false })

const api = axios.create({
    baseURL: 'https://sc2pulse.nephest.com/sc2/api',
})

export const searchPlayer = async (term: string) => {
    console.log(`Searching for: ${term}`)
    try {
        const response = await api.get(`/character/search?term=${term}`, {
            httpAgent: agent,
        })
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError
        console.log(axiosError.message)
    }
}


export const getTop = async (term: string) => {
    console.log(`Searching for: ${term}`)
    try {
        const response = await api.get(`/character/search?term=${term}`, {
            httpAgent: agent,
        })
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError
        console.log(axiosError.message)
    }
}

