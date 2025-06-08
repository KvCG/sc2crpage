import axios, { AxiosInstance } from 'axios'
import config from './config'

const api: AxiosInstance = axios.create({
    baseURL: config.API_URL,
})

export const search = async (searchTerm: string) => {
    const response = await api.get(`api/search/?term=${encodeURIComponent(searchTerm)}`)

    return response
}

export const getTop = async () => {
    const response = await api.get(`api/top`)
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

export const getReplays = async () => {
    const response = await api.get(`api/getReplays`)
    return response
}

export const analyzeReplayBase64 = async body => {
    const response = await api.post(`api/analyzeReplayBase64`, body)
    return response
}

export const analyzeReplayUrl = async body => {
    const response = await api.post(`api/analyzeReplayUrl`, body)
    return response
}

export const getReplayAnalysis = async body => {
    const response = await api.post(`api/getReplayAnalysis`, body)
    return response
}

export const uploadReplay = async body => {
    const response = await api.post(`api/uploadReplay`, body)
    return response
}

export const deleteReplay = async body => {
    const response = await api.post(`api/deleteReplay`, body)
    return response
}