import axios from 'axios'

/**
 * SC2Pulse HTTP client
 * - Centralizes HTTP calls to SC2Pulse with a single axios instance.
 * - Exports `endpoints` and `withBasePath` for building URLs.
 * - `get(path, params)` returns `res.data`, retries on 429/5xx, and applies a simple
 *   RPS-based rate limiter (disabled when NODE_ENV === 'test').
 * - On terminal errors, rejects with `{ error, code }` shape for consistent handling.
 */

// Base URL for SC2Pulse API
const BASE_URL = 'https://sc2pulse.nephest.com/sc2/api/'

// Exported endpoints used across the service layer
export const endpoints = {
    searchCharacter: 'character/search',
    listSeasons: 'season/list/all',
    groupTeam: 'group/team',
} as const

// Allows future prefixing if needed; currently returns the path unchanged
export const withBasePath = (path: string) => path

// Shared axios instance
const client = axios.create({ baseURL: BASE_URL })

// Simple rate limiter based on RPS; disabled in test env
let nextAvailableAt = 0
const schedule = async () => {
    if (process.env.NODE_ENV === 'test') return
    const rps = Number(process.env.SC2PULSE_RPS ?? 5)
    const interval = Math.max(1, Math.floor(1000 / Math.max(1, rps)))
    const now = Date.now()
    const delay = Math.max(0, nextAvailableAt - now)
    nextAvailableAt = Math.max(now, nextAvailableAt) + interval
    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
    }
}

const shouldRetry = (status?: number) =>
    status === 429 || (typeof status === 'number' && status >= 500)

export async function get<T = any>(
    path: string,
    params?: Record<string, any>,
    retries = 0,
    maxRetries = 2
): Promise<T> {
    try {
        await schedule()
        const res = await client.get(path, params ? { params } : {})
        return res.data as T
    } catch (err: any) {
        const status = err?.response?.status as number | undefined
        if (shouldRetry(status) && retries < maxRetries) {
            return get<T>(path, params, retries + 1, maxRetries)
        }
        return Promise.reject({
            error: err?.message ?? 'Unknown error',
            code: status ?? 'UNKNOWN',
        })
    }
}
