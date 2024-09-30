import axios, { AxiosInstance } from 'axios'
import config from './config'

const api: AxiosInstance = axios.create({
    baseURL: config.API_URL,
})

export const search = async (searchTerm: string) => {
    const response = await api.get(`api/search/?term=${encodeURIComponent(searchTerm)}`)

    return response
}

export const getTop = async (depth) => {
    const response = await api.get(`api/top/${depth}`)

    return response
}

export const getDailySnapshot = async () => {
    const response = await api.get(`api/snapshot/`)

    return response
}

export const getTournament = async () => {
    const response = await api.get(`api/tournament/`)

    return response
}

export const upload = async body => {
	console.log(JSON.stringify(body))
    const response = await api.post(`api/upload`, body, {
        headers: { 'Content-Type': 'application/json' },
    })
    return response
}
