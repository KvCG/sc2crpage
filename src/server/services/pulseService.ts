/**
 * Unified Pulse Service
 *
 * Consolidates all SC2Pulse API operations into a single, well-structured service that:
 * - Combines HTTP operations (via pulseHttpClient) with business logic
 * - Provides consistent error handling and configuration management
 * - Manages caching and anti-stampede protection
 * - Integrates CSV data for display names and player IDs
 * - Maintains backward compatibility with existing API contracts
 */

import { communityDataService } from './communityDataService'
import cache, { historicalRankingCache } from '../utils/cache'
import { bumpCache } from '../metrics/lite'
import { get as httpGet, endpoints as httpEndpoints, withBasePath } from './pulseHttpClient'
import { DataDerivationsService } from './dataDerivations'
import { getRankingMinGamesThreshold } from '../utils/rankingFilters'
import { RankedPlayer, SeasonEntry } from '../../shared/types'
import type { AxiosError } from 'axios'

// ============================================================================
// Types
// ============================================================================

export interface PulseApiError {
    error: string
    code: string | number
    context?: Record<string, any>
}

// ============================================================================
// Anti-Stampede Cache
// ============================================================================

/**
 * Prevents multiple concurrent requests for the same key by sharing in-flight promises.
 */
class PulseRequestCache {
    private inflightRequests = new Map<string, Promise<any>>()

    async executeWithCache<T>(cacheKey: string, operation: () => Promise<T>): Promise<T> {
        const existingPromise = this.inflightRequests.get(cacheKey)
        if (existingPromise) {
            return existingPromise
        }

        const requestPromise = operation()
        this.inflightRequests.set(cacheKey, requestPromise)

        const cleanup = () => {
            this.inflightRequests.delete(cacheKey)
        }

        try {
            const result = await requestPromise
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

// ============================================================================
// PulseService
// ============================================================================

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
    private requestCache: PulseRequestCache
    private config: PulseServiceConfig
    private displayNameLookup: Map<string, string> | null = null
    private inflightRankingPromise: Promise<RankedPlayer[]> | null = null

    constructor(config: Partial<PulseServiceConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config }
        this.requestCache = new PulseRequestCache()
    }

    /**
     * Search for players by name or BattleTag
     */
    async searchPlayer(term: string): Promise<any[]> {
        try {
            const data = await httpGet<any>(
                withBasePath(httpEndpoints.searchCharacter),
                { term },
                {},
                0,
                this.config.maxRetries
            )
            return Array.isArray(data) ? data : [data].filter(Boolean)
        } catch (error) {
            const pulseError = this.standardizeError(error, { searchTerm: term })
            console.error('[PulseService.searchPlayer] Search failed:', pulseError)
            throw pulseError
        }
    }

    /**
     * Get all SC2 seasons, filtered to US region, sorted newest-first.
     * Deduplication by battlenetId is implicit — each season appears once per region.
     */
    async getAllSeasons(): Promise<SeasonEntry[]> {
        return await this.requestCache.executeWithCache('all-seasons', async () => {
            try {
                const rawSeasons = await httpGet<any[]>(
                    withBasePath(httpEndpoints.listSeasons),
                    {},
                    {},
                    0,
                    this.config.maxRetries
                )
                if (!Array.isArray(rawSeasons)) return []

                // Keep only US seasons (one entry per region in the response),
                // sorted newest-first so callers get the current season at index 0.
                return rawSeasons
                    .filter((s: any) => s?.region === 'US')
                    .sort((a: any, b: any) => b.battlenetId - a.battlenetId)
                    .map((s: any): SeasonEntry => ({
                        id: s.battlenetId, // battlenetId is the canonical season identifier
                        year: s.year,
                        number: s.number,
                        start: s.start,
                        end: s.end,
                    }))
            } catch (error) {
                const pulseError = this.standardizeError(error, { operation: 'getAllSeasons' })
                console.error('[PulseService.getAllSeasons] Failed to fetch seasons:', pulseError)
                throw pulseError
            }
        })
    }

    /**
     * Get ranking for a specific past season.
     *
     * Results are cached indefinitely (historicalRankingCache) because past season
     * data is immutable. The minimum-games filter is applied on every call, same
     * as getRanking(), so the invariant holds for historical lookups too.
     *
     * @param seasonId - SC2 battlenetId of the season (positive integer)
     * @param overrideMinGames - Optional override for testing purposes only
     */
    async getRankingForSeason(seasonId: number, overrideMinGames?: number): Promise<RankedPlayer[]> {
        const cacheKey = `season:${seasonId}`
        const cached = historicalRankingCache.get(cacheKey) as RankedPlayer[] | undefined

        if (cached) {
            const minimumGames = overrideMinGames ?? getRankingMinGamesThreshold()
            return DataDerivationsService.filterByMinimumGames(cached, minimumGames)
        }

        try {
            const characterIds = await this.loadPlayersFromCsv()
            if (!characterIds || characterIds.length === 0) {
                return []
            }

            const allRankedTeams = await this.fetchRankedTeams(characterIds, seasonId)
            const rankedPlayers = DataDerivationsService.processTeamsToRankedPlayers(allRankedTeams)

            // Cache unfiltered — historical data is immutable
            historicalRankingCache.set(cacheKey, rankedPlayers)

            const minimumGames = overrideMinGames ?? getRankingMinGamesThreshold()
            return DataDerivationsService.filterByMinimumGames(rankedPlayers, minimumGames)
        } catch (error) {
            console.error(`[PulseService.getRankingForSeason] Error fetching season ${seasonId}:`, error)
            return []
        }
    }

    /**
     * Get the current season ID from the SC2Pulse API
     */
    async getCurrentSeason(): Promise<string | undefined> {
        return await this.requestCache.executeWithCache('current-season', async () => {
            try {
                const data = await httpGet<any[]>(
                    withBasePath(httpEndpoints.listSeasons),
                    {},
                    {},
                    0,
                    this.config.maxRetries
                )
                const usRegion = data?.find((season: any) => season?.region === 'US')
                return usRegion?.battlenetId ?? data?.[0]?.battlenetId
            } catch (error) {
                const pulseError = this.standardizeError(error, { operation: 'getCurrentSeason' })
                console.error('[PulseService.getCurrentSeason] Failed to fetch season:', pulseError)
                throw pulseError
            }
        })
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
     * 
     * GLOBAL FILTER BOUNDARY: This method enforces the minimum games filter
     * as the single source of truth for all analytics views (Ranking, Distributions,
     * Activity Report). The filter is ALWAYS applied using the environment-based
     * threshold from RANKING_MIN_GAMES.
     * 
     * @param overrideMinGames - Optional override for testing purposes only. Use undefined for production.
     * 
     * DO NOT bypass this filter or re-implement filtering in consuming services.
     */
    async getRanking(overrideMinGames?: number): Promise<RankedPlayer[]> {
        const cacheKey = 'snapShot'
        let rawData = cache.get(cacheKey) as RankedPlayer[] | undefined

        if (!rawData) {
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
            bumpCache(true)
        }

        // ALWAYS apply minimum games filter at this global boundary
        // Uses environment variable RANKING_MIN_GAMES (default: 10) or test override
        const minimumGames = overrideMinGames ?? getRankingMinGamesThreshold()
        const filteredData = DataDerivationsService.filterByMinimumGames(rawData || [], minimumGames)
        
        return filteredData
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

            const allRankedTeams = await this.fetchRankedTeams(
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
        try {
            return await httpGet<T>(withBasePath(endpoint), params, options, 0, this.config.maxRetries)
        } catch (error) {
            const pulseError = this.standardizeError(error, { endpoint, params })
            console.error(`[PulseService.executeRequest] Request failed for ${endpoint}:`, pulseError)
            throw pulseError
        }
    }

    /**
     * Fetch ranked teams for a list of player IDs
     */
    async fetchRankedTeams(playerIds: string[], seasonId: number): Promise<any[]> {
        const params = playerIds.map((id) => `characterId=${id}`).join('&')
        const limit = Math.min(playerIds.length * 4, 400)
        const url = `${withBasePath(
            httpEndpoints.characterTeams
        )}?season=${seasonId}&queue=LOTV_1V1&race=TERRAN&race=PROTOSS&race=ZERG&race=RANDOM&limit=${limit}&${params}`
        return await httpGet<any | any[]>(url, {}, {}, 0, this.config.maxRetries)
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
    }

    /**
     * Clear all caches (useful for testing)
     */
    clearCaches(): void {
        this.requestCache.clearCache()
        this.inflightRankingPromise = null
        cache.clear?.()
    }

    /**
     * Convert various error types to standardized PulseApiError format
     */
    private standardizeError(error: unknown, context: Record<string, any> = {}): PulseApiError {
        if (error && typeof error === 'object' && 'error' in error && 'code' in error) {
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
}

// Export singleton instance with default configuration
export const pulseService = new PulseService()

// Export factory function for testing with custom configuration
export function createPulseService(config?: Partial<PulseServiceConfig>): PulseService {
    return new PulseService(config)
}

export { DataDerivationsService } from './dataDerivations'
