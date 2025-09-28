import { Router } from 'express'
import { PlayerAnalyticsScheduler } from '../services/playerAnalyticsScheduler'
import { PlayerAnalyticsPersistence } from '../services/playerAnalyticsPersistence'
import logger from '../logging/logger'

const router = Router()

/**
 * Get scheduler status and configuration
 */
router.get('/scheduler', async (_req, res) => {
    try {
        const status = PlayerAnalyticsScheduler.getStatus()
        
        res.json({
            success: true,
            data: status
        })
    } catch (error) {
        logger.error({ error, endpoint: '/analytics/scheduler' }, 'Failed to get scheduler status')
        res.status(500).json({
            success: false,
            error: 'Failed to get scheduler status'
        })
    }
})

/**
 * Force run a specific scheduled operation
 */
router.post('/scheduler/force-run', async (req, res) => {
    try {
        const { operation } = req.body
        
        if (!operation || !['snapshot', 'activity', 'movers'].includes(operation)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid operation. Must be one of: snapshot, activity, movers'
            })
        }
        
        const result = await PlayerAnalyticsScheduler.forceRun(operation)
        
        res.json({
            success: true,
            data: {
                operation,
                executed: result,
                timestamp: new Date().toISOString()
            }
        })
    } catch (error) {
        logger.error({ error, endpoint: '/analytics/scheduler/force-run' }, 'Failed to force run operation')
        res.status(500).json({
            success: false,
            error: 'Failed to force run operation'
        })
    }
})

/**
 * Get persistence layer status
 */
router.get('/persistence', async (_req, res) => {
    try {
        const status = await PlayerAnalyticsPersistence.getStatus()
        
        res.json({
            success: true,
            data: status
        })
    } catch (error) {
        logger.error({ error, endpoint: '/analytics/persistence' }, 'Failed to get persistence status')
        res.status(500).json({
            success: false,
            error: 'Failed to get persistence status'
        })
    }
})

/**
 * List available backups
 */
router.get('/persistence/backups', async (req, res) => {
    try {
        const maxAge = req.query.maxAge ? parseInt(req.query.maxAge as string) : 168 // 1 week default
        const backups = await PlayerAnalyticsPersistence.listBackups({ maxAge })
        
        res.json({
            success: true,
            data: {
                backups,
                count: backups.length,
                maxAge
            }
        })
    } catch (error) {
        logger.error({ error, endpoint: '/analytics/persistence/backups' }, 'Failed to list backups')
        res.status(500).json({
            success: false,
            error: 'Failed to list backups'
        })
    }
})

/**
 * Restore from backup
 */
router.post('/persistence/restore', async (req, res) => {
    try {
        const { fileId } = req.body
        
        const snapshot = await PlayerAnalyticsPersistence.restoreSnapshot(fileId)
        
        if (!snapshot) {
            return res.status(404).json({
                success: false,
                error: 'No backup found or restore failed'
            })
        }
        
        res.json({
            success: true,
            data: {
                restored: true,
                snapshot: {
                    createdAt: snapshot.createdAt,
                    playerCount: snapshot.data?.length || 0
                },
                timestamp: new Date().toISOString()
            }
        })
    } catch (error) {
        logger.error({ error, endpoint: '/analytics/persistence/restore' }, 'Failed to restore from backup')
        res.status(500).json({
            success: false,
            error: 'Failed to restore from backup'
        })
    }
})

export default router