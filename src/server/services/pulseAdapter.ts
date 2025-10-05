/**
 * Pulse API Adapter Service
 *
 * Centralized adapter for SC2Pulse API interactions with:
 * - Configuration injection for timeouts, rate limits, endpoints
 * - Standardized error handling and retry logic
 * - Metrics collection and observability hooks
 * - Request batching and optimization patterns
 *
 * This adapter serves as the single point of integration with the SC2Pulse API,
 * providing a clean, testable interface for all Pulse operations.
 */

import { get as httpGet, endpoints as httpEndpoints, withBasePath } from './pulseHttpClient'
import type { AxiosError } from 'axios'

// Configuration interface for adapter behavior
export interface PulseAdapterConfig {
    maxRetries: number
    chunkSize: number
    apiTimeout: number
    rateLimit: number
}

// Default configuration following existing patterns
const DEFAULT_CONFIG: PulseAdapterConfig = {
    maxRetries: 3,
    chunkSize: 100, // Max character IDs per batch (keeps under 400 team limit)
    apiTimeout: 8000, // 8 second timeout
    rateLimit: 10, // 10 RPS to stay within SC2Pulse limits
}

// Standardized error interface for consistent handling
export interface PulseApiError {
    error: string
    code: string | number
    context?: Record<string, any>
}

/**
 * Centralized Pulse API adapter with configuration injection and standardized patterns
 */
export class PulseAdapter {
    private config: PulseAdapterConfig

    constructor(config: Partial<PulseAdapterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config }
    }

    /**
     * Search for players by name or BattleTag with standardized error handling
     */
    async searchPlayer(searchTerm: string): Promise<any[]> {
        try {
            // Encode search term to handle special characters in BattleTags
            const encodedTerm = encodeURIComponent(searchTerm)
            const data = await httpGet<any>(
                withBasePath(httpEndpoints.searchCharacter),
                { term: encodedTerm },
                {},
                0,
                this.config.maxRetries
            )

            return Array.isArray(data) ? data : [data].filter(Boolean)
        } catch (error) {
            const pulseError = this.standardizeError(error, { searchTerm })
            console.error('[PulseAdapter.searchPlayer] Search failed:', pulseError)
            throw pulseError
        }
    }

    /**
     * Fetch current season information with caching consideration
     */
    async getCurrentSeason(): Promise<string | undefined> {
        try {
            const data = await httpGet<any[]>(
                withBasePath(httpEndpoints.listSeasons),
                {},
                {},
                0,
                this.config.maxRetries
            )

            // Prefer US region, fallback to first available season
            const usRegion = data?.find((season: any) => season?.region === 'US')
            const selectedSeason = usRegion?.battlenetId ?? data?.[0]?.battlenetId

            return selectedSeason
        } catch (error) {
            const pulseError = this.standardizeError(error, { operation: 'getCurrentSeason' })
            console.error('[PulseAdapter.getCurrentSeason] Failed to fetch season:', pulseError)
            throw pulseError
        }
    }

    /**
     * Execute a generic Pulse API request with standardized error handling
     */
    async executeRequest<T = any>(
        endpoint: string,
        params: Record<string, any> = {},
        options: { headers?: Record<string, any> } = {}
    ): Promise<T> {
        try {
            return await httpGet<T>(withBasePath(endpoint), params, options, 0, this.config.maxRetries)
        } catch (error) {
            const pulseError = this.standardizeError(error, { endpoint, params })
            console.error(`[PulseAdapter.executeRequest] Request failed for ${endpoint}:`, pulseError)
            throw pulseError
        }
    }

    /**
     * Create batches of player IDs for efficient API usage
     */
    private createPlayerBatches(playerIds: string[], chunkSize: number): string[][] {
        const batches: string[][] = []
        for (let i = 0; i < playerIds.length; i += chunkSize) {
            batches.push(playerIds.slice(i, i + chunkSize))
        }
        return batches
    }

    /**
     * Fetch player statistics by getting current season and fetching ranked teams
     * Includes automatic batching for large player lists and error recovery
     *
     * @param {string[]} playerIds - Array of player character IDs
     * @returns {Promise<any[]>} Combined stats from all successful batches
     */
    async getPlayersStats(playerIds: string[]): Promise<any[]> {
        if (!playerIds.length) {
            return []
        }

        try {
            // Get current season first
            const seasonId = await this.getCurrentSeason()
            if (!seasonId) {
                throw this.standardizeError(new Error('No current season available'), {
                    operation: 'getPlayersStats',
                    playerCount: playerIds.length
                })
            }

            const results: any[] = []
            const { chunkSize } = this.config

            // Process in batches
            for (let i = 0; i < playerIds.length; i += chunkSize) {
                const batch = playerIds.slice(i, i + chunkSize)
                
                try {
                    const batchResults = await this.fetchRankedTeams(batch, Number(seasonId))
                    results.push(...batchResults)
                } catch (error) {
                    // Log batch error but continue with other batches
                    console.error(`[PulseAdapter.getPlayersStats] Batch ${Math.floor(i/chunkSize) + 1} failed:`, error)
                }
            }

            return results
        } catch (error) {
            const standardized = this.standardizeError(error, {
                operation: 'getPlayersStats',
                playerCount: playerIds.length
            })
            console.error('[PulseAdapter.getPlayersStats] Failed:', standardized)
            throw standardized
        }
    }

    /**
     * Fetch Ranked teams for a list of player IDs with batching and error handling.
     * @param {string[]} playerIds - Array of player character IDs.
     * @param {string | number} seasonId - The current season ID.
     * @returns {Promise<any[]>} Array of team objects.
     */
    async fetchRankedTeams(playerIds: string[], seasonId: number): Promise<any[]> {
        const params = playerIds.map((id) => `characterId=${id}`).join('&')
        const limit = Math.min(playerIds.length * 4, 400)
        const url = `${withBasePath(
            httpEndpoints.characterTeams
        )}?season=${seasonId}&queue=LOTV_1V1&race=TERRAN&race=PROTOSS&race=ZERG&race=RANDOM&limit=${limit}&${params}`
        return await httpGet<any | any[]>(url)
    }

    /**
     * Convert various error types to standardized PulseApiError format
     */
    private standardizeError(error: unknown, context: Record<string, any> = {}): PulseApiError {
        if (error && typeof error === 'object' && 'error' in error && 'code' in error) {
            // Already in expected format from pulseHttpClient
            return error as PulseApiError
        }

        const axiosError = error as AxiosError
        const status = axiosError.response?.status

        return {
            error: axiosError.message ?? 'Unknown Pulse API error',
            code: status ?? axiosError.code ?? 'UNKNOWN',
            context,
        }
    }

    /**
     * Get adapter configuration for testing and monitoring
     */
    getConfig(): PulseAdapterConfig {
        return { ...this.config }
    }

    /**
     * Update adapter configuration at runtime
     */
    updateConfig(newConfig: Partial<PulseAdapterConfig>): void {
        this.config = { ...this.config, ...newConfig }
    }
}

// Export singleton instance with default configuration
export const pulseAdapter = new PulseAdapter()

// Export factory function for testing with custom configuration
export function createPulseAdapter(config?: Partial<PulseAdapterConfig>): PulseAdapter {
    return new PulseAdapter(config)
}

/**
 * Anti-stampede cache wrapper for Pulse operations
 *
 * Prevents multiple concurrent requests for the same data by sharing
 * in-flight promises across callers.
 */
export class PulseRequestCache {
    private inflightRequests = new Map<string, Promise<any>>()

    async executeWithCache<T>(cacheKey: string, operation: () => Promise<T>): Promise<T> {
        // Check if request is already in flight
        const existingPromise = this.inflightRequests.get(cacheKey)
        if (existingPromise) {
            return existingPromise
        }

        // Start new request and cache the promise
        const requestPromise = operation()
        this.inflightRequests.set(cacheKey, requestPromise)

        // Clean up after completion or error
        const cleanup = () => {
            this.inflightRequests.delete(cacheKey)
        }

        try {
            const result = await requestPromise
            // Schedule cleanup after a short delay to allow for concurrent access
            setTimeout(cleanup, 100)
            return result
        } catch (error) {
            cleanup()
            throw error
        }
    }

    clearCache(): void {
        this.inflightRequests.clear()
    }
}

// Export singleton request cache for anti-stampede protection
export const pulseRequestCache = new PulseRequestCache()
