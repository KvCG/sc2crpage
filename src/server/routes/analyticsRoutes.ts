import { Router, Request, Response } from 'express'

import logger from '../logging/logger'
import { 
    standardAnalyticsMiddleware, 
    expensiveAnalyticsMiddleware 
} from '../middleware/analyticsMiddleware'
import { AnalyticsService } from '../services/analyticsService'
import { incrementAnalyticsError } from '../metrics/lite'

const router = Router()

/**
 * GET /api/player-analytics
 * 
 * Provides comprehensive analytics data for players including:
 * - Activity patterns and online status distribution
 * - Race distribution and performance trends  
 * - Ranking movement analysis and position changes
 * - League distribution and rating statistics
 * 
 * Query Parameters:
 * - timeframe: 'current' | 'daily' (default: 'current')
 * - includeInactive: boolean (default: false)
 * - minGames: number (default: 20)
 */
router.get('/player-analytics', standardAnalyticsMiddleware, async (req: Request, res: Response) => {
    try {
        // Use validated query parameters from middleware
        const { timeframe, includeInactive, minimumGames, race } = req.validatedQuery

        logger.info({ 
            timeframe, 
            includeInactive, 
            minimumGames,
            race,
            feature: 'analytics' 
        }, 'Processing player analytics request')

        // Generate analytics using the service
        const analytics = await AnalyticsService.generatePlayerAnalytics({
            timeframe,
            includeInactive,
            race,
            minimumGames
        })

        logger.info({ 
            totalPlayers: analytics.metadata.totalPlayers,
            feature: 'analytics'
        }, 'Player analytics generated successfully')

        res.setHeader('x-sc2pulse-attribution', 'Data courtesy of sc2pulse.nephest.com (non-commercial use)')
        res.setHeader('Cache-Control', 'public, max-age=300') // 5 minute cache for analytics
        
        res.json({
            success: true,
            data: analytics
        })

    } catch (error) {
        incrementAnalyticsError('other')
        
        logger.error({ error, feature: 'analytics' }, 'Error generating player analytics')
        res.status(500).json({
            success: false,
            error: 'Failed to generate player analytics',
            message: error instanceof Error ? error.message : 'Unknown error occurred'
        })
    }
})

/**
 * GET /api/player-analytics/activity
 * 
 * Provides detailed activity analysis including:
 * - Online/offline distribution over time
 * - Activity patterns by race and league
 * - Last played statistics
 * - Temporal patterns and engagement metrics
 * 
 * Query Parameters:
 * - includeInactive: boolean (default: false)
 * - groupBy: 'race' | 'league' | 'activity' (default: 'activity')
 * - timeframe: 'current' | 'daily' (default: 'current')
 * - minimumGames: number (default: 20)
 */
router.get('/player-analytics/activity', expensiveAnalyticsMiddleware, async (req: Request, res: Response) => {
    try {
        // Use validated query parameters from middleware
        const { includeInactive, groupBy, timeframe, minimumGames } = req.validatedQuery
        
        logger.info({ feature: 'analytics', endpoint: req.path }, 'Processing activity analysis request')
        
        // Generate activity analysis using the service
        const analysis = await AnalyticsService.generateActivityAnalysis({
            includeInactive,
            groupBy,
            timeframe,
            minimumGames
        })

        logger.info({ 
            totalPlayers: analysis.metadata.totalPlayers,
            groupBy: analysis.metadata.groupBy,
            feature: 'analytics'
        }, 'Activity analysis generated successfully')

        res.setHeader('x-sc2pulse-attribution', 'Data courtesy of sc2pulse.nephest.com (non-commercial use)')
        res.setHeader('Cache-Control', 'public, max-age=180') // 3 minute cache for activity data
        
        res.json({
            success: true,
            data: analysis
        })

    } catch (error) {
        incrementAnalyticsError('other')
        
        logger.error({ error, feature: 'analytics' }, 'Error generating activity analysis')
        res.status(500).json({
            success: false,
            error: 'Failed to generate activity analysis',
            message: error instanceof Error ? error.message : 'Unknown error occurred'
        })
    }
})

export default router
