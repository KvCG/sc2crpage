import { DateTime } from 'luxon'
import logger from '../logging/logger'
import { getDailySnapshot } from './snapshotService'
import { PlayerAnalyticsPersistence } from './playerAnalyticsPersistence'
import { getAnalyticsMetricsSummary } from '../metrics/lite'

/**
 * Player Analytics Scheduler Service
 * 
 * Provides configurable scheduled operations for player data collection
 * following Costa Rica timezone alignment for consistent daily boundaries.
 * 
 * Environment Variables:
 * - ENABLE_PLAYER_SNAPSHOTS: Master switch for scheduled operations (default: false)
 * - PLAYER_SNAPSHOT_INTERVAL_HOURS: Snapshot collection interval (default: 24)
 * - PLAYER_ACTIVITY_INTERVAL_HOURS: Activity analysis interval (default: 2)
 * - PLAYER_MOVERS_INTERVAL_HOURS: Position change analysis interval (default: 3)
 */

export interface SchedulerConfig {
    snapshotIntervalHours: number
    activityIntervalHours: number
    moversIntervalHours: number
    enabled: boolean
}

export interface ScheduledOperation {
    name: string
    intervalHours: number
    lastRun?: DateTime
    nextRun: DateTime
    handler: () => Promise<void>
}

export class PlayerAnalyticsScheduler {
    private static config: SchedulerConfig
    private static operations: ScheduledOperation[] = []
    private static intervalId: NodeJS.Timeout | null = null
    private static readonly CHECK_INTERVAL_MS = 60 * 1000 // Check every minute

    /**
     * Initialize scheduler configuration from environment variables
     */
    static getConfig(): SchedulerConfig {
        if (this.config) return this.config

        const enabled = String(process.env.ENABLE_PLAYER_SNAPSHOTS ?? 'false').toLowerCase() === 'true'
        const snapshotIntervalHours = parseInt(process.env.PLAYER_SNAPSHOT_INTERVAL_HOURS ?? '24', 10)
        const activityIntervalHours = parseInt(process.env.PLAYER_ACTIVITY_INTERVAL_HOURS ?? '2', 10)
        const moversIntervalHours = parseInt(process.env.PLAYER_MOVERS_INTERVAL_HOURS ?? '3', 10)

        this.config = {
            enabled,
            snapshotIntervalHours: Number.isFinite(snapshotIntervalHours) && snapshotIntervalHours > 0 
                ? snapshotIntervalHours : 24,
            activityIntervalHours: Number.isFinite(activityIntervalHours) && activityIntervalHours > 0 
                ? activityIntervalHours : 2,
            moversIntervalHours: Number.isFinite(moversIntervalHours) && moversIntervalHours > 0 
                ? moversIntervalHours : 3
        }

        logger.debug({
            config: this.config,
            feature: 'scheduler'
        }, 'Player analytics scheduler configuration loaded')

        return this.config
    }

    /**
     * Calculate next run time aligned to Costa Rica timezone boundaries
     */
    private static calculateNextRun(intervalHours: number, lastRun?: DateTime): DateTime {
        const nowCR = DateTime.now().setZone('America/Costa_Rica')
        
        if (!lastRun) {
            // First run: align to next boundary based on interval
            if (intervalHours >= 24) {
                // Daily or longer: align to midnight
                return nowCR.plus({ days: 1 }).startOf('day')
            } else {
                // Sub-daily: align to next hour boundary
                const nextHour = nowCR.startOf('hour').plus({ hours: 1 })
                // Find next interval boundary
                const hoursSinceMidnight = nextHour.hour
                const intervalsSinceMidnight = Math.floor(hoursSinceMidnight / intervalHours)
                const nextIntervalHour = (intervalsSinceMidnight + 1) * intervalHours
                
                if (nextIntervalHour >= 24) {
                    // Next interval is tomorrow
                    return nowCR.plus({ days: 1 }).startOf('day')
                } else {
                    return nowCR.startOf('day').plus({ hours: nextIntervalHour })
                }
            }
        } else {
            // Subsequent runs: add interval to last run
            return lastRun.plus({ hours: intervalHours })
        }
    }

    /**
     * Initialize scheduled operations
     */
    static initializeOperations(): void {
        const config = this.getConfig()
        
        if (!config.enabled) {
            return
        }

        this.operations = [
            {
                name: 'snapshot',
                intervalHours: config.snapshotIntervalHours,
                nextRun: this.calculateNextRun(config.snapshotIntervalHours),
                handler: this.handleSnapshotCollection
            },
            {
                name: 'activity',
                intervalHours: config.activityIntervalHours,
                nextRun: this.calculateNextRun(config.activityIntervalHours),
                handler: this.handleActivityAnalysis
            },
            {
                name: 'movers',
                intervalHours: config.moversIntervalHours,
                nextRun: this.calculateNextRun(config.moversIntervalHours),
                handler: this.handleMoversAnalysis
            }
        ]

        logger.info({
            operations: this.operations.map(op => ({
                name: op.name,
                intervalHours: op.intervalHours,
                nextRun: op.nextRun.toISO()
            })),
            feature: 'scheduler'
        }, 'Player analytics scheduled operations initialized')
    }

    /**
     * Start the scheduler
     */
    static start(): void {
        const config = this.getConfig()
        
        if (!config.enabled) {
            logger.info({ feature: 'scheduler' }, 'Scheduler start requested but feature is disabled')
            return
        }

        if (this.intervalId) {
            logger.warn({ feature: 'scheduler' }, 'Scheduler already running')
            return
        }

        this.initializeOperations()
        
        this.intervalId = setInterval(async () => {
            await this.checkAndRunOperations()
        }, this.CHECK_INTERVAL_MS)

        logger.info({ 
            checkIntervalMs: this.CHECK_INTERVAL_MS,
            feature: 'scheduler'
        }, 'Player analytics scheduler started')
    }

    /**
     * Stop the scheduler
     */
    static stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
            logger.info({ feature: 'scheduler' }, 'Player analytics scheduler stopped')
        }
    }

    /**
     * Check if any operations need to run and execute them
     */
    private static async checkAndRunOperations(): Promise<void> {
        const nowCR = DateTime.now().setZone('America/Costa_Rica')
        
        for (const operation of this.operations) {
            if (nowCR >= operation.nextRun) {
                try {
                    logger.info({
                        operation: operation.name,
                        scheduledTime: operation.nextRun.toISO(),
                        actualTime: nowCR.toISO(),
                        feature: 'scheduler'
                    }, 'Executing scheduled operation')

                    const startTime = Date.now()
                    await operation.handler()
                    const duration = Date.now() - startTime

                    operation.lastRun = nowCR
                    operation.nextRun = this.calculateNextRun(operation.intervalHours, operation.lastRun)

                    logger.info({
                        operation: operation.name,
                        duration,
                        nextRun: operation.nextRun.toISO(),
                        feature: 'scheduler'
                    }, 'Scheduled operation completed successfully')

                } catch (error) {
                    logger.error({
                        operation: operation.name,
                        error,
                        feature: 'scheduler'
                    }, 'Scheduled operation failed')

                    // Still update next run time to prevent stuck operations
                    operation.lastRun = nowCR
                    operation.nextRun = this.calculateNextRun(operation.intervalHours, operation.lastRun)
                }
            }
        }
    }

    /**
     * Handle snapshot collection operation
     */
    private static async handleSnapshotCollection(): Promise<void> {
        logger.info({ feature: 'scheduler' }, 'Starting snapshot collection')
        
        // Trigger snapshot generation (this will cache the result)
        const snapshot = await getDailySnapshot()
        
        // Backup snapshot to Google Drive for disaster recovery
        const backupId = await PlayerAnalyticsPersistence.backupSnapshot(snapshot)
        
        logger.info({
            playerCount: snapshot.data?.length || 0,
            createdAt: snapshot.createdAt,
            backupId: backupId || 'backup_failed',
            feature: 'scheduler'
        }, 'Snapshot collection completed')
    }

    /**
     * Handle activity analysis operation  
     */
    private static async handleActivityAnalysis(): Promise<void> {
        logger.info({ feature: 'scheduler' }, 'Starting activity analysis')
        
        // For now, just log analytics metrics summary
        // In Phase 4, this could trigger more sophisticated activity analysis
        const metrics = getAnalyticsMetricsSummary()
        
        // Also perform backup cleanup during activity analysis
        const deletedCount = await PlayerAnalyticsPersistence.cleanupOldBackups()
        
        logger.info({
            metrics,
            backupCleanupsDeleted: deletedCount,
            feature: 'scheduler'
        }, 'Activity analysis completed')
    }

    /**
     * Handle movers analysis operation
     */
    private static async handleMoversAnalysis(): Promise<void> {
        logger.info({ feature: 'scheduler' }, 'Starting movers analysis')
        
        // For now, just log that movers analysis would run
        // In Phase 4, this could trigger position change calculations
        logger.info({ feature: 'scheduler' }, 'Movers analysis completed')
    }

    /**
     * Get current scheduler status for monitoring
     */
    static getStatus(): {
        enabled: boolean
        config: SchedulerConfig
        operations: Array<{
            name: string
            intervalHours: number
            lastRun?: string
            nextRun: string
        }>
    } {
        const config = this.getConfig()
        
        return {
            enabled: config.enabled,
            config,
            operations: this.operations.map(op => ({
                name: op.name,
                intervalHours: op.intervalHours,
                lastRun: op.lastRun?.toISO() || undefined,
                nextRun: op.nextRun.toISO() || ''
            }))
        }
    }

    /**
     * Force run a specific operation (for testing/debugging)
     */
    static async forceRun(operationName: string): Promise<void> {
        const operation = this.operations.find(op => op.name === operationName)
        
        if (!operation) {
            throw new Error(`Operation '${operationName}' not found`)
        }

        logger.info({
            operation: operationName,
            feature: 'scheduler'
        }, 'Force-running scheduled operation')

        await operation.handler()
        
        // Update timing after force run
        const nowCR = DateTime.now().setZone('America/Costa_Rica')
        operation.lastRun = nowCR
        operation.nextRun = this.calculateNextRun(operation.intervalHours, operation.lastRun)

        logger.info({
            operation: operationName,
            feature: 'scheduler',
            nextRun: operation.nextRun.toISO(),
            lastRun: operation.lastRun.toISO()
        }, 'Force-run of scheduled operation completed')
    }
}