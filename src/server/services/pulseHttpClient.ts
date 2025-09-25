import axios from 'axios'
import { metrics, observePulseLatency } from '../metrics/lite'
import { bumpPulseReq, bumpPulseErr } from '../observability/requestContext'
import type { AxiosResponse } from 'axios'

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
const PULSE_TIMEOUT = Number(process.env.PULSE_TIMEOUT_MS || 8000)
const client = axios.create({ baseURL: BASE_URL, timeout: PULSE_TIMEOUT })

// Propagate request metrics with defensive guards for tests where axios is mocked
const anyClient: any = client as any
if (anyClient.interceptors?.response?.use) {
    anyClient.interceptors.response.use(
        (response: AxiosResponse) => {
            metrics.pulse_req_total++
            bumpPulseReq()
            const rt = Number(response?.headers?.['request-duration-ms']) || 0
            if (rt > 0) observePulseLatency(rt)
            return response
        },
        (error: any) => {
            const status = error?.response?.status as number | undefined
            const code = error?.code as string | undefined
            if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
                metrics.pulse_err_total.timeout++
                bumpPulseErr('timeout')
            } else if (typeof status === 'number') {
                if (status >= 500) {
                    metrics.pulse_err_total.http5xx++
                    bumpPulseErr('http5xx')
                } else if (status >= 400) {
                    metrics.pulse_err_total.http4xx++
                    bumpPulseErr('http4xx')
                } else {
                    if (metrics.pulse_err_total.other === undefined) metrics.pulse_err_total.other = 0
                    metrics.pulse_err_total.other++
                    bumpPulseErr('other')
                }
            } else {
                metrics.pulse_err_total.network++
                bumpPulseErr('network')
            }
            return Promise.reject(error)
        }
    )
}

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
    options?: { headers?: Record<string, any> },
    retries = 0,
    maxRetries = 2
): Promise<T> {
    try {
        await schedule()
        const res = await client.get(path, { params, headers: options?.headers })
        return res.data as T
    } catch (err: any) {
        const status = err?.response?.status as number | undefined
        if (shouldRetry(status) && retries < maxRetries) {
            return get<T>(path, params, options, retries + 1, maxRetries)
        }
        return Promise.reject({
            error: err?.message ?? 'Unknown error',
            code: status ?? 'UNKNOWN',
        })
    }
}
