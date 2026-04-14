import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { loadPairRecord, syncPair, H2HResolutionError } from '../services/h2hService'
import { communityDataService } from '../services/communityDataService'
import logger from '../logging/logger'
import type { H2HMatch, H2HPlayerMeta, H2HResponse } from '../../shared/types'

const router = Router()

const h2hQuerySchema = z.object({
    player1: z
        .string({ required_error: 'player1 is required' })
        .regex(/^\d+$/, 'player1 must be a numeric character ID')
        .transform(Number),
    player2: z
        .string({ required_error: 'player2 is required' })
        .regex(/^\d+$/, 'player2 must be a numeric character ID')
        .transform(Number),
})

function buildSummary(
    matches: H2HMatch[],
    callerPlayer1Id: number,
    callerPlayer2Id: number
): H2HResponse['summary'] {
    let player1Wins = 0
    let player2Wins = 0
    let lastPlayed: string | null = null

    for (const match of matches) {
        if (match.winnerCharacterId === callerPlayer1Id) player1Wins++
        else if (match.winnerCharacterId === callerPlayer2Id) player2Wins++

        if (!lastPlayed || match.date > lastPlayed) lastPlayed = match.date
    }

    return {
        player1Wins,
        player2Wins,
        totalGames: matches.length,
        lastPlayed,
    }
}

/**
 * GET /api/h2h
 *
 * Returns head-to-head match history between two community players.
 *
 * Query Parameters:
 * - player1: numeric character ID (required)
 * - player2: numeric character ID (required)
 */
router.get('/h2h', async (req: Request, res: Response) => {
    const parsed = h2hQuerySchema.safeParse(req.query)

    if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            received: req.query[issue.path[0] as string],
        }))
        return res.status(400).json({ error: 'Invalid query parameters', details })
    }

    const { player1, player2 } = parsed.data

    logger.info({ feature: 'h2h', player1, player2 }, 'Processing H2H request')

    const [meta1, meta2] = await Promise.all([
        communityDataService.getCommunityPlayer(player1),
        communityDataService.getCommunityPlayer(player2),
    ])

    if (!meta1) {
        return res.status(404).json({ error: `Player with characterId ${player1} not found in community` })
    }
    if (!meta2) {
        return res.status(404).json({ error: `Player with characterId ${player2} not found in community` })
    }

    try {
        const SYNC_TTL_MS = 60 * 60 * 1000 // 1 hour
        const existing = await loadPairRecord(player1, player2)
        const stale =
            !existing ||
            !existing.pulseSyncedAt ||
            Date.now() - new Date(existing.pulseSyncedAt).getTime() > SYNC_TTL_MS

        const record = stale ? await syncPair(player1, player2) : existing

        const player1Meta: H2HPlayerMeta = {
            characterId: player1,
            btag: meta1.btag,
            ...(meta1.name ? { name: meta1.name } : {}),
        }
        const player2Meta: H2HPlayerMeta = {
            characterId: player2,
            btag: meta2.btag,
            ...(meta2.name ? { name: meta2.name } : {}),
        }

        const response: H2HResponse = {
            player1: player1Meta,
            player2: player2Meta,
            summary: buildSummary(record.matches, player1, player2),
            matches: record.matches,
        }

        res.json(response)
    } catch (error) {
        if (error instanceof H2HResolutionError) {
            return res.status(422).json({
                error: `Player with characterId ${error.characterId} has no ranked 1v1 team on record`,
            })
        }
        logger.error({ feature: 'h2h', player1, player2, error }, 'Error processing H2H request')
        res.status(500).json({ error: 'Failed to retrieve H2H data' })
    }
})

/**
 * GET /api/community-players
 *
 * Returns all community players from the CSV roster.
 * Used by the H2H player picker to list every known community member,
 * regardless of whether they appear in the current ranked ladder.
 */
router.get('/community-players', async (_req: Request, res: Response) => {
    try {
        const data = await communityDataService.getCommunityData()
        res.json(data.players)
    } catch (error) {
        logger.error({ feature: 'h2h', error }, 'Failed to load community players')
        res.status(500).json({ error: 'Failed to load community players' })
    }
})

export default router
