import axios, { AxiosInstance } from 'axios'
import config from './config'
import resolveRequestId from '../utils/requestIdentity'
import type { MatchFlagType, MatchFlagStatus } from '../../shared/types'

const api: AxiosInstance = axios.create({
    baseURL: config.API_URL,
})

// Attach x-request-id header if present via URL param or storage
api.interceptors.request.use((req) => {
    try {
        const requestId = resolveRequestId()
        if (requestId) {
            req.headers = req.headers || {}
            // Do not clobber if already explicitly set by caller
            if (!('x-request-id' in req.headers) && !('X-Request-Id' in req.headers)) {
                ;(req.headers as any)['x-request-id'] = requestId
            }
        }
    } catch (_) {
        // ignore
    }
    return req
})

export const search = async (searchTerm: string) => {
    const response = await api.get(`api/search/?term=${encodeURIComponent(searchTerm)}`)

    return response
}

export const getTop = async (params?: {
    includeInactive?: boolean
    minimumGames?: number
    season?: number
}) => {
    const response = await api.get(`api/top/`, { params })
    return response
}

export const getSeasons = async () => {
    const response = await api.get(`api/seasons`)
    return response
}

export const getSnapshot = async () => {
    const response = await api.get(`api/snapshot`)
    return response
}

export const getTournament = async () => {
    const response = await api.get(`api/tournament/`)

    return response
}

export const upload = async (body: any) => {
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

export const analyzeReplayBase64 = async (body: any) => {
    const response = await api.post(`api/analyzeReplayBase64`, body)
    return response
}

export const analyzeReplayUrl = async (body: any) => {
    const response = await api.post(`api/analyzeReplayUrl`, body)
    return response
}

export const getReplayAnalysis = async (body: any) => {
    const response = await api.post(`api/getReplayAnalysis`, body)
    return response
}

export const uploadReplay = async (body: any) => {
    const response = await api.post(`api/uploadReplay`, body)
    return response
}

export const deleteReplay = async (body: any) => {
    const response = await api.post(`api/deleteReplay`, body)
    return response
}

export const getPlayerAnalytics = async (params?: {
    timeframe?: 'current' | 'daily'
    includeInactive?: boolean
    minimumGames?: number
    race?: string | null
}) => {
    const response = await api.get(`api/player-analytics`, { params })
    return response
}

export const getPlayerActivityAnalysis = async (params?: {
    timeframe?: 'current' | 'daily'
    includeInactive?: boolean
    minimumGames?: number
    groupBy?: 'race' | 'league' | 'activity'
}) => {
    const response = await api.get(`api/player-analytics/activity`, { params })
    return response
}

export const getH2H = async (player1: number, player2: number) => {
    const response = await api.get(`api/h2h`, { params: { player1, player2 } })
    return response
}

export const getCommunityPlayers = async () => {
    const response = await api.get('api/community-players')
    return response
}

export interface PostH2HFlagPayload {
    matchId: string
    player1CharacterId: number
    player2CharacterId: number
    flagType: MatchFlagType
    reason?: string | null
    submittedBy: string
}

export interface PostH2HFlagResponse {
    flagId: number
    status: MatchFlagStatus
}

export const postH2HFlag = async (payload: PostH2HFlagPayload): Promise<PostH2HFlagResponse> => {
    const response = await api.post<PostH2HFlagResponse>('api/h2h/flags', payload)
    return response.data
}