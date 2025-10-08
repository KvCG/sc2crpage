/**
 * Custom Match Ingestion API Routes
 * 
 * Provides REST endpoints for monitoring and controlling the custom match
 * ingestion system. Follows existing API route patterns for consistency.
 */

import { Router } from 'express'
import { customMatchIngestionOrchestrator } from '../services/customMatchIngestionOrchestrator'
import { customMatchStorageService } from '../services/customMatchStorageService'
import { getH2HEnvironmentInfo } from '../config/h2hConfig'
import logger from '../logging/logger'

const router = Router()

/**
 * Get ingestion system status with configuration details
 * GET /api/custom-matches/status
 */
router.get('/custom-matches/status', async (_req, res) => {
    try {
        const status = customMatchIngestionOrchestrator.getStatus()
        
        // Add community data stats
        const { customMatchDiscoveryService } = await import('../services/customMatchDiscoveryService')
        const communityStats = customMatchDiscoveryService.getCommunityStats()
        
        res.json({
            success: true,
            data: {
                ...status,
                communityStats,
                environment: getH2HEnvironmentInfo()
            }
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/status' },
            'Failed to get ingestion status'
        )
        res.status(500).json({
            success: false,
            error: 'Failed to get ingestion status'
        })
    }
})

/**
 * Get detailed system statistics
 * GET /api/custom-matches/stats
 */
router.get('/custom-matches/stats', async (_req, res) => {
    try {
        const stats = await customMatchIngestionOrchestrator.getStats()
        
        res.json({
            success: true,
            data: stats
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/stats' },
            'Failed to get ingestion statistics'
        )
        res.status(500).json({
            success: false,
            error: 'Failed to get ingestion statistics'
        })
    }
})

/**
 * Start the ingestion system
 * POST /api/custom-matches/start
 */
router.post('/custom-matches/start', async (_req, res) => {
    try {
        await customMatchIngestionOrchestrator.start()
        
        res.json({
            success: true,
            message: 'Ingestion system started successfully'
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/start' },
            'Failed to start ingestion system'
        )
        res.status(500).json({
            success: false,
            error: 'Failed to start ingestion system'
        })
    }
})

/**
 * Stop the ingestion system
 * POST /api/custom-matches/stop
 */
router.post('/custom-matches/stop', async (_req, res) => {
    try {
        await customMatchIngestionOrchestrator.stop()
        
        res.json({
            success: true,
            message: 'Ingestion system stopped successfully'
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/stop' },
            'Failed to stop ingestion system'
        )
        res.status(500).json({
            success: false,
            error: 'Failed to stop ingestion system'
        })
    }
})

/**
 * Run manual ingestion cycle
 * POST /api/custom-matches/run
 */
router.post('/custom-matches/run', async (_req, res) => {
    try {
        const result = await customMatchIngestionOrchestrator.runManualIngestion()
        
        res.json({
            success: true,
            data: result,
            message: 'Manual ingestion completed'
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/run' },
            'Manual ingestion failed'
        )
        res.status(500).json({
            success: false,
            error: 'Manual ingestion failed'
        })
    }
})

/**
 * Cleanup old tracking files and temporary data
 * POST /api/custom-matches/cleanup
 */
router.post('/custom-matches/cleanup', async (_req, res) => {
    try {
        await customMatchIngestionOrchestrator.cleanup()
        
        res.json({
            success: true,
            message: 'Cleanup completed successfully'
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/cleanup' },
            'Cleanup failed'
        )
        res.status(500).json({
            success: false,
            error: 'Cleanup failed'
        })
    }
})

/**
 * Clear deduplication cache (for debugging)
 * POST /api/custom-matches/clear-cache
 */
router.post('/custom-matches/clear-cache', async (_req, res) => {
    try {
        const { simplifiedMatchDeduplicator } = await import('../services/simplifiedMatchDeduplicator')
        
        // Clear the deduplication cache
        const stats = await simplifiedMatchDeduplicator.getStats()
        await simplifiedMatchDeduplicator.cleanup()
        
        res.json({
            success: true,
            message: 'Deduplication cache cleared successfully',
            data: {
                statsBeforeCleanup: stats
            }
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/clear-cache' },
            'Cache clearing failed'
        )
        res.status(500).json({
            success: false,
            error: 'Cache clearing failed'
        })
    }
})

/**
 * Get matches for a specific date
 * GET /api/custom-matches/date/:dateKey
 */
router.get('/custom-matches/date/:dateKey', async (req, res) => {
    try {
        const { dateKey } = req.params
        
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format. Expected YYYY-MM-DD'
            })
        }
        
        const matches = await customMatchStorageService.getMatches(dateKey)
        
        res.json({
            success: true,
            data: {
                date: dateKey,
                matchCount: matches.length,
                matches
            }
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/date/:dateKey' },
            'Failed to get matches for date'
        )
        res.status(500).json({
            success: false,
            error: 'Failed to get matches for date'
        })
    }
})

/**
 * List available dates with match data
 * GET /api/custom-matches/dates
 */
router.get('/custom-matches/dates', async (_req, res) => {
    try {
        const dates = await customMatchStorageService.listAvailableDates()
        
        res.json({
            success: true,
            data: {
                availableDates: dates,
                dateCount: dates.length,
                dateRange: dates.length > 0 ? {
                    earliest: dates[0],
                    latest: dates[dates.length - 1]
                } : null
            }
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/dates' },
            'Failed to list available dates'
        )
        res.status(500).json({
            success: false,
            error: 'Failed to list available dates'
        })
    }
})

/**
 * Get storage statistics
 * GET /api/custom-matches/storage/stats
 */
router.get('/custom-matches/storage/stats', async (_req, res) => {
    try {
        const stats = await customMatchStorageService.getStorageStats()
        
        res.json({
            success: true,
            data: stats
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/storage/stats' },
            'Failed to get storage statistics'
        )
        res.status(500).json({
            success: false,
            error: 'Failed to get storage statistics'
        })
    }
})

/**
 * Health check endpoint
 * GET /api/custom-matches/health
 */
router.get('/custom-matches/health', async (_req, res) => {
    try {
        const status = customMatchIngestionOrchestrator.getStatus()
        const isHealthy = !status.lastRun || status.lastRun.errors.length === 0
        
        res.status(isHealthy ? 200 : 503).json({
            success: true,
            data: {
                healthy: isHealthy,
                system: {
                    isRunning: status.isRunning,
                    uptimeMs: status.uptimeMs,
                    lastRunErrors: status.lastRun?.errors.length || 0,
                    lastRunTimestamp: status.lastRun?.timestamp
                }
            }
        })
    } catch (error) {
        logger.error(
            { error, endpoint: '/custom-matches/health' },
            'Health check failed'
        )
        res.status(503).json({
            success: false,
            error: 'Health check failed'
        })
    }
})

export default router