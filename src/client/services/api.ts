import axios, { AxiosInstance } from 'axios'
import config from './config'

const api: AxiosInstance = axios.create({
    baseURL: config.API_URL,
})

export const search = async (searchTerm: string) => {
    const response = await api.get(`api/search/?term=${searchTerm}`)

    return response
}

export const getTop = async () => {
    const response = await api.get(`api/top`)

    return response
}

export const upload = async body => {
	console.log(JSON.stringify(body))
    const response = await api.post(`api/upload`, body, {
        headers: { 'Content-Type': 'application/json' },
    })
    return response
}
