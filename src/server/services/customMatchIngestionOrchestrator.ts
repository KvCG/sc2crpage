/**
 * Custom Match Ingestion Orchestrator
 *
 * Main orchestrator that coordinates the discovery, validation, scoring,
 * de-duplication, and storage of custom matches. Supports both scheduled
 * polling and manual triggering.
 */

import { customMatchDiscoveryService } from './customMatchDiscoveryService'
import { matchConfidenceScorer } from './matchConfidenceScorer'
import { simplifiedMatchDeduplicator } from './simplifiedMatchDeduplicator'
import { customMatchStorageService } from './customMatchStorageService'
import logger from '../logging/logger'
import { getH2HConfig } from '../config/h2hConfig'
import {
    CustomMatchConfig,
    IngestionResult,
    IngestionStatus,
    MatchConfidence,
} from '../../shared/customMatchTypes'

/**
 * Convert H2HConfig to CustomMatchConfig format
 */
function getIngestionConfig(): CustomMatchConfig {
    const config = getH2HConfig()
    return {
        cutoffDate: config.cutoffDate,
        minConfidence: config.minConfidence,
        pollIntervalSeconds: config.pollIntervalSeconds,
        batchSize: config.batchSize,
        lookbackDays: config.lookbackDays,
    }
}

/**
 * Main ingestion orchestrator
 */
export class CustomMatchIngestionOrchestrator {
    private isRunning = false
    private intervalId: NodeJS.Timeout | null = null
    private startTime = Date.now()
    private lastResult: IngestionResult | null = null

    /**
     * Start the ingestion system with scheduled polling
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn(
                { feature: 'custom-match-ingestion' },
                'Ingestion already running, ignoring start request'
            )
            return
        }

        this.isRunning = true
        this.startTime = Date.now()

        const config = getIngestionConfig()

        logger.info(
            {
                feature: 'custom-match-ingestion',
                config,
            },
            'Starting custom match ingestion system'
        )

        // Initialize community data
        try {
            await customMatchDiscoveryService.initializeCommunityData()
        } catch (error) {
            logger.error(
                { error, feature: 'custom-match-ingestion' },
                'Failed to initialize community data'
            )
            this.isRunning = false
            throw error
        }

        // Preload deduplication data for recent dates
        try {
            await this.preloadDeduplicationData()
        } catch (error) {
            logger.warn(
                { error, feature: 'custom-match-ingestion' },
                'Failed to preload deduplication data, continuing with empty cache'
            )
            // Don't fail startup for deduplication preload issues
        }

        // Run initial ingestion
        await this.runIngestion()

        // Schedule periodic ingestion
        this.intervalId = setInterval(async () => {
            try {
                await this.runIngestion()
            } catch (error) {
                logger.error(
                    { error, feature: 'custom-match-ingestion' },
                    'Scheduled ingestion failed'
                )
            }
        }, config.pollIntervalSeconds * 1000)

        logger.info(
            {
                feature: 'custom-match-ingestion',
                pollIntervalSeconds: config.pollIntervalSeconds,
            },
            'Custom match ingestion system started'
        )
    }

    /**
     * Stop the ingestion system
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return
        }

        logger.info({ feature: 'custom-match-ingestion' }, 'Stopping custom match ingestion system')

        this.isRunning = false

        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }

        logger.info({ feature: 'custom-match-ingestion' }, 'Custom match ingestion system stopped')
    }

    /**
     * Run a single ingestion cycle manually
     */
    async runManualIngestion(): Promise<IngestionResult> {
        logger.info({ feature: 'custom-match-ingestion' }, 'Running manual ingestion')

        // Initialize community data if not already done
        try {
            await customMatchDiscoveryService.initializeCommunityData()
        } catch (error) {
            logger.error(
                { error, feature: 'custom-match-ingestion' },
                'Failed to initialize community data for manual ingestion'
            )
            throw error
        }

        return await this.runIngestion()
    }

    /**
     * Get current system status
     */
    getStatus(): IngestionStatus {
        const config = getIngestionConfig()

        return {
            isRunning: this.isRunning,
            lastRun: this.lastResult || undefined,
            config,
            uptimeMs: Date.now() - this.startTime,
            nextRunAt:
                this.intervalId && this.isRunning
                    ? new Date(Date.now() + config.pollIntervalSeconds * 1000).toISOString()
                    : undefined,
        }
    }

    /**
     * Get system statistics
     */
    async getStats() {
        const communityStats = customMatchDiscoveryService.getCommunityStats()
        const dedupeStats = await simplifiedMatchDeduplicator.getStats()
        const storageStats = await customMatchStorageService.getStorageStats()
        const scorerConfig = matchConfidenceScorer.getConfig()

        return {
            system: this.getStatus(),
            community: communityStats,
            deduplication: dedupeStats,
            storage: storageStats,
            scoring: {
                factorPoints: scorerConfig.factorPoints,
                thresholds: scorerConfig.thresholds,
            },
        }
    }

    /**
     * Cleanup old tracking files and temporary data
     */
    async cleanup(): Promise<void> {
        logger.info({ feature: 'custom-match-ingestion' }, 'Running system cleanup')

        try {
            await simplifiedMatchDeduplicator.cleanup()
            logger.info({ feature: 'custom-match-ingestion' }, 'Cleanup completed successfully')
        } catch (error) {
            logger.error({ error, feature: 'custom-match-ingestion' }, 'Cleanup failed')
            throw error
        }
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Run a complete ingestion cycle
     */
    private async runIngestion(): Promise<IngestionResult> {
        const startTime = Date.now()
        const config = getIngestionConfig()

        const result: IngestionResult = {
            matchesDiscovered: 0,
            matchesWithValidParticipants: 0,
            matchesMeetingThreshold: 0,
            newMatchesStored: 0,
            duplicatesSkipped: 0,
            errors: [],
            timestamp: new Date().toISOString(),
            durationMs: 0,
        }

        try {
            logger.info({ feature: 'custom-match-ingestion', config }, 'Starting ingestion cycle')

            // Step 1: Discover matches from Pulse
            const rawMatches = await customMatchDiscoveryService.discoverCustomMatches(config)
            result.matchesDiscovered = rawMatches.length

            // Step 2: Validate participants
            const validatedMatches = await customMatchDiscoveryService.validateParticipants(
                rawMatches
            )
            result.matchesWithValidParticipants = validatedMatches.length

            // Step 3: Score confidence
            const scoredMatches = matchConfidenceScorer.scoreMatches(validatedMatches)

            // Step 4: Filter by confidence threshold
            const thresholdMatches = this.filterByConfidenceThreshold(
                scoredMatches,
                config.minConfidence
            )
            result.matchesMeetingThreshold = thresholdMatches.length

            // Step 5: De-duplicate
            const dedupeResult = await simplifiedMatchDeduplicator.filterDuplicates(thresholdMatches)
            result.duplicatesSkipped = dedupeResult.duplicateCount

            // Step 6: Store to Drive
            if (dedupeResult.uniqueMatches.length > 0) {
                const storageResult = await customMatchStorageService.storeMatches(
                    dedupeResult.uniqueMatches
                )
                result.newMatchesStored = storageResult.matchesStored

                // Record matches as processed for future de-duplication
                await simplifiedMatchDeduplicator.recordProcessedMatches(dedupeResult.uniqueMatches)

                // Add any storage errors
                storageResult.errors.forEach((error) => {
                    result.errors.push({
                        error: `Storage error for ${error.date}: ${error.error}`,
                    })
                })

                logger.info(
                    {
                        feature: 'custom-match-ingestion',
                        newMatchesStored: result.newMatchesStored,
                        filesWritten: storageResult.filesWritten,
                    },
                    'Match storage completed'
                )
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            result.errors.push({ error: `Ingestion cycle failed: ${errorMessage}` })

            logger.error({ error, feature: 'custom-match-ingestion' }, 'Ingestion cycle failed')
        } finally {
            result.durationMs = Date.now() - startTime
            this.lastResult = result

            logger.info(
                {
                    feature: 'custom-match-ingestion',
                    result: {
                        ...result,
                        errors: result.errors.length, // Don't log full error details in summary
                    },
                },
                'Ingestion cycle completed'
            )
        }

        return result
    }

    /**
     * Filter matches by confidence threshold
     */
    private filterByConfidenceThreshold(matches: any[], minConfidence: MatchConfidence): any[] {
        const confidenceOrder = { low: 1, medium: 2, high: 3 }
        const minLevel = confidenceOrder[minConfidence]

        return matches.filter((match) => {
            const matchLevel = confidenceOrder[match.confidence as MatchConfidence]
            return matchLevel >= minLevel
        })
    }

    /**
     * Preload deduplication data from local file and Drive for fast startup
     */
    private async preloadDeduplicationData(): Promise<void> {
        logger.info(
            { feature: 'custom-match-ingestion' },
            'Starting deduplication data preload'
        )

        try {
            // Use the deduplicator's built-in preload method
            // This loads from local file first, then syncs with Drive in background
            await simplifiedMatchDeduplicator.preloadDeduplicationData()
            
            logger.info(
                { feature: 'custom-match-ingestion' },
                'Deduplication data preload completed successfully'
            )
        } catch (error) {
            logger.error(
                { error, feature: 'custom-match-ingestion' },
                'Failed to preload deduplication data - continuing with empty cache'
            )
        }
    }
}

// Export singleton instance
export const customMatchIngestionOrchestrator = new CustomMatchIngestionOrchestrator()
