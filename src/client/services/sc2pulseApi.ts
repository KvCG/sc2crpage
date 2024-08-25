import axios, { AxiosInstance } from 'axios'
import config from './config'

const api: AxiosInstance = axios.create({
    baseURL: config.API_URL,
})

export default api
