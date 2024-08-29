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

