import { Router, Request, Response } from 'express'
import { pulseService } from '../services/pulseService'
import { retrieveInitialRankingData } from '../services/snapshotService'
import { formatData } from '../utils/formatData'
import { getClientInfo } from '../utils/getClientInfo'
import logger from '../logging/logger'
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

        // Historical season lookup — validate before interpolating into SC2Pulse URL
        if (req.query.season !== undefined) {
            const seasonId = Number(req.query.season)
            if (!Number.isInteger(seasonId) || seasonId <= 0) {
                return res.status(400).json({ error: 'season must be a positive integer' })
            }
            const ranking = await pulseService.getRankingForSeason(seasonId, minimumGames)
            return res.json(ranking)
        }

        const ranking = await pulseService.getRanking(minimumGames)
        res.json(ranking)
    } catch (error) {
        logger.error({ error, route: '/api/top' }, 'Failed to fetch ranking data')
        res.status(500).json({ error: 'Failed to fetch ranking data' })
    }
})

router.get('/seasons', async (_req: Request, res: Response) => {
    res.setHeader(
        'x-sc2pulse-attribution',
        'Data courtesy of sc2pulse.nephest.com (non-commercial use)'
    )
    try {
        const seasons = await pulseService.getAllSeasons()
        res.json(seasons)
    } catch (error) {
        logger.error({ error, route: '/api/seasons' }, 'Failed to fetch season list')
        res.status(500).json({ error: 'Failed to fetch season list' })
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
