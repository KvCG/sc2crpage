import axios from 'axios'
import { metrics, observePulseLatency } from '../metrics/lite'
import { bumpPulseReq, bumpPulseErr } from '../observability/requestContext'
import type { AxiosResponse, AxiosError } from 'axios'

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

/** Axios response interceptors (metrics + error classification) */
const onSuccess = (response: AxiosResponse) => {
    metrics.pulse_req_total++ // I think there is an error here
    bumpPulseReq()
    const rt = Number(response?.headers?.['request-duration-ms']) || 0
    if (rt > 0) observePulseLatency(rt)
    return response
}

const onError = (error: AxiosError) => {
    const status = error.response?.status
    const code = error.code
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

// Guard for mocked axios in tests
const maybeClient = client as any
if (maybeClient?.interceptors?.response?.use) {
    maybeClient.interceptors.response.use(onSuccess, onError)
}


// --- Simple RPS-based rate limiter (disabled in test) ------------------------
const IS_TEST = process.env.NODE_ENV === 'test'
const CONFIGURED_RPS = Number(process.env.SC2PULSE_RPS ?? 5)
// Convert RPS to an inter-request interval (ms), never below 1ms
const REQUEST_INTERVAL_MS = Math.max(1, Math.floor(1000 / Math.max(1, CONFIGURED_RPS)))

let nextAvailableAt = 0

const sleep = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms))

async function schedule(): Promise<void> {
    if (IS_TEST) return
    const now = Date.now()
    const delay = Math.max(0, nextAvailableAt - now)
    nextAvailableAt = Math.max(now, nextAvailableAt) + REQUEST_INTERVAL_MS
    if (delay > 0) await sleep(delay)
}

const isRetriableStatus = (status?: number) =>
    status === 429 || (typeof status === 'number' && status >= 500)

// Exported GET with retry + rate limit
export async function get<T = any>(
    path: string,
    params?: Record<string, any>,
    options?: { headers?: Record<string, any> },
    retries = 0,          // initial retry (internal usage, keep for compatibility)
    maxRetries = 2
): Promise<T> {
    let attempt = retries
    while (attempt <= maxRetries) {
        try {
            await schedule()
            const res = await client.get(path, { params, headers: options?.headers })
            return res.data as T
        } catch (err: any) {
            const status = err?.response?.status as number | undefined
            const canRetry = isRetriableStatus(status) && attempt < maxRetries
            if (canRetry) {
                attempt++
                continue
            }
            return Promise.reject({
                error: err?.message ?? 'Unknown error',
                code: status ?? 'UNKNOWN',
            })
        }
    }
    // Should never reach here
    throw new Error('Unexpected retry loop termination')
}
