/**
 * Unified Pulse Service
 *
 * Consolidates all SC2Pulse API operations into a single, well-structured service that:
 * - Combines HTTP operations (via PulseAdapter) with business logic
 * - Provides consistent error handling and configuration management
 * - Manages caching and anti-stampede protection
 * - Integrates CSV data for display names and player IDs
 * - Maintains backward compatibility with existing API contracts
 *
 * This replaces the previous fragmented approach of separate pulseApi and pulseAdapter services.
 */

import { readCsv } from '../utils/csvParser'
import cache from '../utils/cache'
import { metrics } from '../metrics/lite'
import { bumpCache } from '../observability/requestContext'
import { PulseAdapter, PulseRequestCache } from './pulseAdapter'
import { DataDerivationsService } from './dataDerivations'
import { RankedPlayer } from '../../shared/types'

/**
 * Configuration interface for the unified service
 */
export interface PulseServiceConfig {
    maxRetries: number
    chunkSize: number
    apiTimeout: number
    rateLimit: number
    cacheTimeout: number
    onlineThresholdMinutes: number
}

/**
 * Default configuration from environment variables with fallbacks
 */
const DEFAULT_CONFIG: PulseServiceConfig = {
    maxRetries: Number(process.env.PULSE_MAX_RETRIES) || 3,
    chunkSize: Number(process.env.PULSE_BATCH_SIZE) || 100,
    apiTimeout: Number(process.env.PULSE_TIMEOUT_MS) || 8000,
    rateLimit: Number(process.env.SC2PULSE_RPS) || 10,
    cacheTimeout: Number(process.env.PULSE_CACHE_TTL_MS) || 30000,
    onlineThresholdMinutes: Number(process.env.ONLINE_THRESHOLD_MINUTES) || 30,
}

/**
 * Unified Pulse Service - Single point of integration for all SC2Pulse operations
 */
export class PulseService {
    private adapter: PulseAdapter
    private requestCache: PulseRequestCache
    private config: PulseServiceConfig
    private displayNameLookup: Map<string, string> | null = null
    private inflightRankingPromise: Promise<RankedPlayer[]> | null = null

    constructor(config: Partial<PulseServiceConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config }
        this.adapter = new PulseAdapter({
            maxRetries: this.config.maxRetries,
            chunkSize: this.config.chunkSize,
            apiTimeout: this.config.apiTimeout,
            rateLimit: this.config.rateLimit,
        })
        this.requestCache = new PulseRequestCache()
    }

    /**
     * Search for players by name or BattleTag with enriched results
     */
    async searchPlayer(term: string): Promise<any[]> {
        try {
            return await this.adapter.searchPlayer(term)
        } catch (error) {
            console.error('[PulseService.searchPlayer] Search failed:', error)
            throw error
        }
    }

    /**
     * Get the current season ID from the API
     */
    async getCurrentSeason(): Promise<string | undefined> {
        return await this.requestCache.executeWithCache('current-season', () =>
            this.adapter.getCurrentSeason()
        )
    }

    /**
     * Get display name for a character ID from CSV data
     */
    getDisplayNameFromCsv(btag: string ): string | null {
        if (!btag || !this.displayNameLookup) return null
        return this.displayNameLookup.get(btag) || null
    }

    /**
     * Load player IDs from CSV and build display name lookup
     */
    private async loadPlayersFromCsv(): Promise<string[]> {
        try {
            const players = (await readCsv()) as unknown as Array<{
                btag: string
                name?: string
                challongeId?: string
                id: string
            }>

            // Build display name lookup while we have the CSV data
            if (!this.displayNameLookup) {
                this.displayNameLookup = new Map<string, string>()
                players.forEach((player) => {
                    if (player.btag && player.name) {
                        this.displayNameLookup!.set(player.btag, player.name)
                    }
                })
                console.log(
                    `[PulseService] Loaded ${this.displayNameLookup.size} display names from CSV`
                )
            }

            return players.map((player) => player.id)
        } catch (error) {
            console.error(
                `[PulseService.loadPlayersFromCsv] Error reading CSV: ${(error as Error).message}`
            )
            return []
        }
    }

    /**
     * Get current ranking with caching and anti-stampede protection
     */
    async getRanking(includeInactive: boolean, minimumGames: number): Promise<RankedPlayer[]> {
        const cacheKey = 'snapShot'
        const cachedData = cache.get(cacheKey)

        if (cachedData) {
            metrics.cache_hit_total++
            bumpCache(true)
            return cachedData
        }

        metrics.cache_miss_total++
        bumpCache(false)

        // Anti-stampede: share one ongoing refresh across concurrent callers
        if (this.inflightRankingPromise) {
            return this.inflightRankingPromise
        }

        // Start new fetch and store the promise
        this.inflightRankingPromise = this.fetchRankingData(includeInactive, minimumGames)

        try {
            const result = await this.inflightRankingPromise
            return result
        } finally {
            // Reset inflight promise so future requests can trigger a new fetch if needed
            this.inflightRankingPromise = null
        }
    }

    /**
     * Internal method to fetch and process ranking data
     */
    private async fetchRankingData(
        includeInactive: boolean,
        minimumGames: number
    ): Promise<RankedPlayer[]> {
        try {
            const characterIds = await this.loadPlayersFromCsv()
            const currentSeason = await this.getCurrentSeason()

            if (!characterIds || characterIds.length === 0) {
                return []
            }

            if (!currentSeason) {
                throw new Error('Unable to fetch current season')
            }

            const allRankedTeams = await this.adapter.fetchRankedTeams(
                characterIds,
                Number(currentSeason)
            )

            // Process teams to ranked players with display names automatically included
            let filteredPlayers = DataDerivationsService.processTeamsToRankedPlayers(allRankedTeams)

            if (!includeInactive) {
                filteredPlayers = DataDerivationsService.filterByMinimumGames(
                    filteredPlayers,
                    minimumGames
                )
            }
            // Cache the results
            cache.set('snapShot', filteredPlayers)
            return filteredPlayers
        } catch (error) {
            console.error(`[PulseService.fetchRankingData] Error:`, error)
            return []
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
        return await this.adapter.executeRequest<T>(endpoint, params, options)
    }

    /**
     * Fetch ranked teams for a list of player IDs with batching
     */
    async fetchRankedTeams(playerIds: string[], seasonId: number): Promise<any[]> {
        return await this.adapter.fetchRankedTeams(playerIds, seasonId)
    }

    /**
     * Get service configuration for monitoring and testing
     */
    getConfig(): PulseServiceConfig {
        return { ...this.config }
    }

    /**
     * Update service configuration at runtime
     */
    updateConfig(newConfig: Partial<PulseServiceConfig>): void {
        this.config = { ...this.config, ...newConfig }

        // Update adapter configuration as well
        this.adapter.updateConfig({
            maxRetries: this.config.maxRetries,
            chunkSize: this.config.chunkSize,
            apiTimeout: this.config.apiTimeout,
            rateLimit: this.config.rateLimit,
        })
    }

    /**
     * Clear all caches (useful for testing)
     */
    clearCaches(): void {
        this.requestCache.clearCache()
        this.inflightRankingPromise = null
        cache.clear?.()
    }
}

// Export singleton instance with default configuration
export const pulseService = new PulseService()

// Export factory function for testing with custom configuration
export function createPulseService(config?: Partial<PulseServiceConfig>): PulseService {
    return new PulseService(config)
}

// Re-export types and utilities for backward compatibility
export type { PulseApiError } from './pulseAdapter'
export { DataDerivationsService } from './dataDerivations'
