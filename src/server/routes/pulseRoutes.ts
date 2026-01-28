import { Router, Request, Response } from 'express'
import { pulseService } from '../services/pulseService'
import { retrieveInitialRankingData } from '../services/snapshotService'
import { formatData } from '../utils/formatData'
import { getClientInfo } from '../utils/getClientInfo'
import logger from '../logging/logger'
import { DeltaComputationEngine } from '../services/deltaComputationEngine'
import { DateTime } from 'luxon'

const router = Router()

/**
 * GET /api/top - Live Ranking Data
 * Returns current top player rankings using clean RankedPlayer interface
 * 
 * Query params (optional, for testing):
 *   - minimumGames: number (overrides RANKING_MIN_GAMES env var)
 * 
 * Note: Minimum games filtering is handled by pulseService.getRanking() at the global boundary.
 * The RANKING_MIN_GAMES environment variable controls the threshold (default: 10).
 */
router.get('/top', async (req: Request, res: Response) => {
    res.setHeader(
        'x-sc2pulse-attribution',
        'Data courtesy of sc2pulse.nephest.com (non-commercial use)'
    )

    try {
        // Optional test override (undefined uses environment default)
        const minimumGames = req.query.minimumGames
            ? Number(req.query.minimumGames)
            : undefined

        const ranking = await pulseService.getRanking(minimumGames)
        res.json(ranking)
    } catch (error) {
        logger.error({ error, route: '/api/top' }, 'Failed to fetch ranking data')
        res.status(500).json({ error: 'Failed to fetch ranking data' })
    }
})

/**
 * GET /ranking - Enhanced ranking with analytics (future use)
 * Get current ranking with embedded delta information
 * 
 * Note: Minimum games filtering is handled by pulseService.getRanking() at the global boundary.
 */
router.get('/ranking', async (req, res) => {
    try {
        const options = {
            timeWindowHours: parseInt(req.query.timeWindowHours as string) || 24,
            includeInactive: req.query.includeInactive === 'true',
            minimumConfidence: parseInt(req.query.minimumConfidence as string) || 75,
            maxDataAge: parseInt(req.query.maxDataAge as string) || 48,
        }

        // Get current ranking and deltas in parallel
        // Ranking data is already filtered by pulseService.getRanking()
        const [currentRanking, deltas] = await Promise.all([
            pulseService.getRanking(),
            DeltaComputationEngine.computePlayerDeltas(options),
        ])

        // Create delta lookup map
        const deltaMap = new Map(deltas.map((delta: any) => [delta.btag || `${delta.id}`, delta]))

        // Enhance ranking with delta information
        const enhancedRanking = currentRanking.map((player: any, index: number) => ({
            ...player,
            currentRank: index,
            deltaData: deltaMap.get(String(player.btag)) || null,
        }))

        res.json({
            success: true,
            ranking: enhancedRanking,
            metadata: {
                totalPlayers: enhancedRanking.length,
                withDeltas: Array.from(deltaMap.values()).length,
                options,
                timestamp: DateTime.now().toISO(),
            },
        })
    } catch (error) {
        logger.error({ error, feature: 'analyticsRoutes' }, 'Failed to fetch enhanced ranking')
        res.status(500).json({
            success: false,
            error: 'Failed to generate enhanced ranking',
        })
    }
})

router.get('/search', async (req: Request, res: Response) => {
    const term = req.query.term
    const userAgent = req.headers['user-agent']
    const { device, os } = getClientInfo(userAgent)
    const details = {
        referer: req.headers.referer,
        query: term,
        device,
        os,
        ip: req.headers['x-forwarded-for'] || req.ip,
    }
    logger.info({ route: '/api/search', details }, 'search player')

    res.setHeader(
        'x-sc2pulse-attribution',
        'Data courtesy of sc2pulse.nephest.com (non-commercial use)'
    )
    try {
        const playerData = await pulseService.searchPlayer(term as string)
        const formattedData = await formatData(playerData, 'search')
        res.json(formattedData)
    } catch (error) {
        logger.error({ error, route: '/api/search', term }, 'Player search failed')
        res.status(500).json({ error: 'Search failed' })
    }
})

router.get('/snapshot', async (_req: Request, res: Response) => {
    res.setHeader(
        'x-sc2pulse-attribution',
        'Data courtesy of sc2pulse.nephest.com (non-commercial use)'
    )
    try {
        // Snapshot data is already filtered by minimum games threshold at pulseService boundary
        const snapshot = await retrieveInitialRankingData()
        res.json(snapshot)
    } catch (error) {
        logger.error({ error, route: '/api/snapshot' }, 'Failed to fetch daily snapshot')
        res.status(500).json({ error: 'Failed to fetch snapshot data' })
    }
})

export default router
