import axios from 'axios'
import { metrics, observePulseLatency } from '../metrics/lite'
import { bumpPulseReq, bumpPulseErr } from '../observability/requestContext'
import type { AxiosResponse, AxiosError } from 'axios'

/**
 * SC2Pulse HTTP Client
 *
 * Provides a centralized HTTP client for SC2Pulse API with:
 * - Rate limiting (configurable RPS)
 * - Automatic retries for transient failures (429, 5xx)
 * - Request/response metrics and observability
 * - Consistent error handling with standardized error shapes
 *
 * Usage:
 * - Use `get(path, params)` for API calls
 * - Reference `endpoints` for available API paths
 * - All requests automatically include rate limiting and retry logic
 */

// ============================================================================
// Configuration Constants
// ============================================================================

const SC2_PULSE_BASE_URL = 'https://sc2pulse.nephest.com/sc2/api/'
const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_RPS_LIMIT = 5
const DEFAULT_MAX_RETRIES = 2
const MIN_REQUEST_INTERVAL_MS = 1

// ============================================================================
// API Endpoint Definitions
// ============================================================================

/**
 * Available SC2Pulse API endpoints
 */
export const endpoints = {
    searchCharacter: 'character/search',
    listSeasons: 'season/list/all',
    groupTeam: 'group/team',
    characterTeams: 'character-teams',
    characterMatches: 'character-matches',
} as const

/**
 * Helper for building API paths with potential future prefix support
 * Currently returns path unchanged but provides extension point
 */
export const withBasePath = (path: string): string => path

// ============================================================================
// HTTP Client Setup
// ============================================================================

const timeoutMs = Number(process.env.PULSE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
const client = axios.create({
    baseURL: SC2_PULSE_BASE_URL,
    timeout: timeoutMs,
})

// ============================================================================
// Response Interceptors and Metrics
// ============================================================================

/**
 * Tracks successful responses and observes latency metrics
 */
const handleSuccessResponse = (response: AxiosResponse): AxiosResponse => {
    // Increment success counters
    metrics.pulse_req_total++
    bumpPulseReq()

    // Record response time if provided by server
    const responseTimeMs = Number(response?.headers?.['request-duration-ms']) || 0
    if (responseTimeMs > 0) {
        observePulseLatency(responseTimeMs)
    }

    return response
}

/**
 * Classifies and tracks different types of HTTP errors
 */
const handleErrorResponse = (error: AxiosError): Promise<never> => {
    const httpStatus = error.response?.status
    const errorCode = error.code

    const errorType = classifyError(errorCode, httpStatus)
    recordErrorMetrics(errorType)

    return Promise.reject(error)
}

/**
 * Determines error category based on error code and HTTP status
 */
function classifyError(errorCode?: string, httpStatus?: number): string {
    // Timeout errors (connection or request timeout)
    if (errorCode === 'ECONNABORTED' || errorCode === 'ETIMEDOUT') {
        return 'timeout'
    }

    // HTTP status-based classification
    if (typeof httpStatus === 'number') {
        if (httpStatus >= 500) return 'http5xx'
        if (httpStatus >= 400) return 'http4xx'
        return 'other'
    }

    // Network-level errors (no HTTP response)
    return 'network'
}

/**
 * Records error metrics for the determined error type
 */
function recordErrorMetrics(errorType: string): void {
    switch (errorType) {
        case 'timeout':
            metrics.pulse_err_total.timeout++
            bumpPulseErr('timeout')
            break
        case 'http5xx':
            metrics.pulse_err_total.http5xx++
            bumpPulseErr('http5xx')
            break
        case 'http4xx':
            metrics.pulse_err_total.http4xx++
            bumpPulseErr('http4xx')
            break
        case 'network':
            metrics.pulse_err_total.network++
            bumpPulseErr('network')
            break
        default:
            // Initialize 'other' counter if not exists
            if (metrics.pulse_err_total.other === undefined) {
                metrics.pulse_err_total.other = 0
            }
            metrics.pulse_err_total.other++
            bumpPulseErr('other')
    }
}

/**
 * Setup response interceptors (with test environment guard)
 */
function setupInterceptors(): void {
    const clientWithInterceptors = client as any
    if (clientWithInterceptors?.interceptors?.response?.use) {
        clientWithInterceptors.interceptors.response.use(handleSuccessResponse, handleErrorResponse)
    }
}

setupInterceptors()

// ============================================================================
// Rate Limiting
// ============================================================================

const isTestEnvironment = process.env.NODE_ENV === 'test'
const configuredRps = Number(process.env.SC2PULSE_RPS ?? DEFAULT_RPS_LIMIT)

/**
 * Calculate interval between requests to maintain RPS limit
 * Ensures minimum interval to prevent divide-by-zero issues
 */
const requestIntervalMs = Math.max(
    MIN_REQUEST_INTERVAL_MS,
    Math.floor(1000 / Math.max(1, configuredRps))
)

// Tracks when next request can be made
let nextRequestAvailableAt = 0

/**
 * Simple sleep utility for rate limiting delays
 */
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Enforces rate limiting by delaying requests when necessary
 * Rate limiting is disabled in test environment
 */
async function enforceRateLimit(): Promise<void> {
    if (isTestEnvironment) {
        return
    }

    const now = Date.now()
    const requiredDelay = Math.max(0, nextRequestAvailableAt - now)

    // Update next available time
    nextRequestAvailableAt = Math.max(now, nextRequestAvailableAt) + requestIntervalMs

    // Wait if necessary
    if (requiredDelay > 0) {
        await delay(requiredDelay)
    }
}

// ============================================================================
// Request Execution and Retry Logic
// ============================================================================

/**
 * HTTP status codes that warrant automatic retry
 */
const RETRIABLE_STATUS_CODES = {
    RATE_LIMITED: 429,
    SERVER_ERROR_MIN: 500,
} as const

/**
 * Determines if an HTTP status code indicates a retriable error
 */
function isRetriableError(httpStatus?: number): boolean {
    if (!httpStatus) return false

    return (
        httpStatus === RETRIABLE_STATUS_CODES.RATE_LIMITED ||
        httpStatus >= RETRIABLE_STATUS_CODES.SERVER_ERROR_MIN
    )
}

/**
 * Interface for request options
 */
interface RequestOptions {
    headers?: Record<string, any>
}

/**
 * Interface for standardized error responses
 */
interface StandardError {
    error: string
    code: string | number
}

/**
 * Makes an HTTP GET request to SC2Pulse API with automatic retries and rate limiting
 *
 * @param path - API endpoint path
 * @param params - Query parameters
 * @param options - Request options (headers, etc.)
 * @param initialRetryCount - Starting retry count (for internal use)
 * @param maxRetries - Maximum number of retries allowed
 * @returns Promise resolving to response data
 * @throws StandardError on terminal failures
 */
export async function get<T = any>(
    path: string,
    params?: Record<string, any>,
    options?: RequestOptions,
    initialRetryCount = 0,
    maxRetries = DEFAULT_MAX_RETRIES
): Promise<T> {
    let currentAttempt = initialRetryCount

    while (currentAttempt <= maxRetries) {
        try {
            // Apply rate limiting before making request
            await enforceRateLimit()

            // Execute the HTTP request
            const response = await client.get(path, {
                params,
                headers: options?.headers,
            })

            return response.data as T
        } catch (error: any) {
            const httpStatus = error?.response?.status as number | undefined
            const canRetry = isRetriableError(httpStatus) && currentAttempt < maxRetries

            if (canRetry) {
                currentAttempt++
                continue
            }

            // Terminal error - format and reject with standard shape
            const standardError: StandardError = {
                error: error?.message ?? 'Unknown HTTP error occurred',
                code: httpStatus ?? 'UNKNOWN_ERROR',
            }

            return Promise.reject(standardError)
        }
    }

    // This should never be reached due to loop logic
    throw new Error('Request retry loop terminated unexpectedly')
}
