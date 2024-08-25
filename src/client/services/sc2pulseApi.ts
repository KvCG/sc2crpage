import axios, { AxiosInstance } from 'axios'

const api: AxiosInstance = axios.create({
    baseURL: 'https://sc2pulse.nephest.com/sc2/',
})

export default api
