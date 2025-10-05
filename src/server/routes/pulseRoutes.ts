import { Router, Request, Response } from 'express'
import { pulseService } from '../services/pulseService'
import { getDailySnapshot } from '../services/snapshotService'
import { formatData } from '../utils/formatData'
import { filterRankingForDisplay } from '../utils/rankingFilters'
import { getClientInfo } from '../utils/getClientInfo'
import logger from '../logging/logger'
import { DeltaComputationEngine } from '../services/deltaComputationEngine'
import { DateTime } from 'luxon'

const router = Router()

/**
 * GET /api/top - Live Ranking Data
 * Returns current top player rankings using clean RankedPlayer interface
 */
router.get('/top', async (req: Request, res: Response) => {
    res.setHeader(
        'x-sc2pulse-attribution',
        'Data courtesy of sc2pulse.nephest.com (non-commercial use)'
    )
    const { includeInactive = false, groupBy, timeframe, minimumGames } = req.query

    try {
        const ranking = await pulseService.getRanking(
            includeInactive === 'true',
            Number(minimumGames ?? 20)
        )
        res.json(ranking)
    } catch (error) {
        logger.error({ error, route: '/api/top' }, 'Failed to fetch ranking data')
        res.status(500).json({ error: 'Failed to fetch ranking data' })
    }
})

/**
 * GET /ranking - Enhanced ranking with analytics (future use)
 * Get current ranking with embedded delta information
 */
router.get('/ranking', async (req, res) => {
    try {
        const options = {
            timeWindowHours: parseInt(req.query.timeWindowHours as string) || 24,
            includeInactive: req.query.includeInactive === 'true',
            minimumConfidence: parseInt(req.query.minimumConfidence as string) || 75,
            maxDataAge: parseInt(req.query.maxDataAge as string) || 48,
            minimumGames: parseInt(req.query.minimumGames as string) || 20,
        }

        // Get current ranking and deltas in parallel
        const [currentRanking, deltas] = await Promise.all([
            pulseService.getRanking(options.includeInactive, Number(options.minimumGames || 20)),
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
        const snapshot = await getDailySnapshot()
        snapshot.data = filterRankingForDisplay(snapshot.data)
        res.json(snapshot)
    } catch (error) {
        logger.error({ error, route: '/api/snapshot' }, 'Failed to fetch daily snapshot')
        res.status(500).json({ error: 'Failed to fetch snapshot data' })
    }
})

export default router
