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

import { communityDataService } from './communityDataService'
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
            const communityData = await communityDataService.getCommunityData()

            // Build display name lookup from centralized service
            if (!this.displayNameLookup) {
                this.displayNameLookup = new Map<string, string>(communityData.displayNames)
                console.log(
                    `[PulseService] Loaded ${this.displayNameLookup.size} display names from CSV via centralized service`
                )
            }

            return communityData.players.map((player) => player.id)
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
    async getRanking(includeInactive: boolean = false, minimumGames: number = 20): Promise<RankedPlayer[]> {
        const cacheKey = 'snapShot'
        let rawData = cache.get(cacheKey) as RankedPlayer[] | undefined

        if (!rawData) {
            metrics.cache_miss_total++
            bumpCache(false)

            // Anti-stampede: share one ongoing refresh across concurrent callers
            if (this.inflightRankingPromise) {
                rawData = await this.inflightRankingPromise
            } else {
                this.inflightRankingPromise = this.fetchRankingData()
                try {
                    rawData = await this.inflightRankingPromise
                } finally {
                    this.inflightRankingPromise = null
                }
            }
        } else {
            metrics.cache_hit_total++
            bumpCache(true)
        }

        // Apply per-request filtering to unfiltered cached data
        if (!includeInactive && rawData) {
            return DataDerivationsService.filterByMinimumGames(rawData, minimumGames)
        }
        
        return rawData || []
    }

    /**
     * Internal method to fetch and process ranking data
     * Returns unfiltered data - filtering applied per-request
     */
    private async fetchRankingData(): Promise<RankedPlayer[]> {
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

            // Process teams to ranked players - cache unfiltered data
            const rankedPlayers = DataDerivationsService.processTeamsToRankedPlayers(allRankedTeams)
            
            // Cache unfiltered results for per-request filtering
            cache.set('snapShot', rankedPlayers)
            return rankedPlayers
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
