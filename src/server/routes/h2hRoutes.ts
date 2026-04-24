import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { loadPairRecord, syncPair, H2HResolutionError, getTopPairs } from '../services/h2hService'
import {
    submitFlag,
    listFlags,
    approveFlag,
    rejectFlag,
    FlagServiceError,
} from '../services/h2hFlagService'
import { communityDataService } from '../services/communityDataService'
import { requireAdminAuth } from '../middleware/adminAuthMiddleware'
import {
    listPendingMatches,
    confirmPendingMatch,
    rejectPendingMatch,
    PendingServiceError,
} from '../services/h2hPendingService'
import logger from '../logging/logger'
import type { H2HMatch, H2HPlayerMeta, H2HResponse, MatchFlagType } from '../../shared/types'

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
    let voidedCount = 0
    let lastPlayed: string | null = null

    for (const match of matches) {
        if (match.isVoided) {
            voidedCount++
            continue
        }

        if (match.winnerCharacterId === callerPlayer1Id) player1Wins++
        else if (match.winnerCharacterId === callerPlayer2Id) player2Wins++

        if (!lastPlayed || match.date > lastPlayed) lastPlayed = match.date
    }

    return {
        player1Wins,
        player2Wins,
        totalGames: matches.length,
        voidedCount,
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

        // Build a set of external match IDs that have at least one pending flag,
        // so each match row can show a ghost indicator without an extra request.
        const pendingFlags = await listFlags({ status: 'pending' })
        const pendingMatchIds = new Set(pendingFlags.map(flag => String(flag.match.matchId)))

        const decoratedMatches = record.matches.map(match => ({
            ...match,
            hasPendingFlag: pendingMatchIds.has(String(match.matchId)),
        }))

        const response: H2HResponse = {
            player1: player1Meta,
            player2: player2Meta,
            summary: buildSummary(record.matches, player1, player2),
            matches: decoratedMatches,
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

// ---------------------------------------------------------------------------
// GET /api/h2h/top-pairs — Top active pairs by match count
// ---------------------------------------------------------------------------

const topPairsQuerySchema = z.object({
    limit: z
        .string()
        .optional()
        .transform((val) => (val === undefined ? 20 : Number(val)))
        .pipe(z.number().int().min(1).max(50)),
})

/**
 * GET /api/h2h/top-pairs
 *
 * Returns the top head-to-head pairs ranked by non-voided match count.
 *
 * Query Parameters:
 * - limit: max pairs to return (1–50, default 20)
 */
router.get('/h2h/top-pairs', async (req: Request, res: Response) => {
    const parsed = topPairsQuerySchema.safeParse(req.query)

    if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            received: req.query[issue.path[0] as string],
        }))
        return res.status(400).json({ error: 'Invalid query parameters', details })
    }

    const { limit } = parsed.data

    logger.info({ feature: 'h2h', limit }, 'Processing top-pairs request')

    try {
        const pairs = await getTopPairs(limit)
        res.set('Cache-Control', 'public, max-age=3600')
        return res.json(pairs)
    } catch (error) {
        logger.error({ feature: 'h2h', limit, error }, 'Error processing top-pairs request')
        return res.status(500).json({ error: 'Failed to retrieve top pairs' })
    }
})

// ---------------------------------------------------------------------------
// POST /api/h2h/flags — Submit a community flag for a match
// ---------------------------------------------------------------------------

const flagBodySchema = z
    .object({
        matchId: z.string({ required_error: 'matchId is required' }).min(1, 'matchId is required'),
        player1CharacterId: z
            .number({ required_error: 'player1CharacterId is required' })
            .int()
            .positive(),
        player2CharacterId: z
            .number({ required_error: 'player2CharacterId is required' })
            .int()
            .positive(),
        flagType: z.enum(['void', 'showmatch', 'tournament'] as const, {
            required_error: 'flagType is required',
            invalid_type_error: 'flagType must be one of: void, showmatch, tournament',
        }),
        reason: z
            .string()
            .max(500, 'reason must be 500 characters or fewer')
            .nullable()
            .optional()
            .default(null),
        submittedBy: z
            .string({ required_error: 'submittedBy is required' })
            .min(1, 'submittedBy is required'),
    })
    .superRefine((data, ctx) => {
        if (data.flagType === 'void' && (!data.reason || data.reason.trim().length === 0)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'reason is required when flagType is "void"',
                path: ['reason'],
            })
        }
    })

/**
 * POST /api/h2h/flags
 *
 * Submits a community flag for an h2h match.
 *
 * Body:
 * - matchId: external match ID string (required)
 * - player1CharacterId: numeric character ID (required)
 * - player2CharacterId: numeric character ID (required)
 * - flagType: 'void' | 'showmatch' | 'tournament' (required)
 * - reason: explanation string, max 500 chars (required when flagType is 'void')
 * - submittedBy: battle tag of the flagging player (required)
 */
router.post('/h2h/flags', async (req: Request, res: Response) => {
    const parsed = flagBodySchema.safeParse(req.body)

    if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            received: issue.path.length > 0 ? req.body?.[issue.path[0] as string] : undefined,
        }))
        return res.status(400).json({ error: 'Invalid request body', details })
    }

    const { matchId, player1CharacterId, player2CharacterId, flagType, reason, submittedBy } =
        parsed.data
    const normalizedSubmitter = submittedBy.trim()

    // Verify the submitter is a known community member before calling the service
    const communityData = await communityDataService.getCommunityData()
    const isKnownBtag = communityData.players.some((player) => player.btag === normalizedSubmitter)
    if (!isKnownBtag) {
        return res
            .status(400)
            .json({ error: `Submitter '${normalizedSubmitter}' is not a known community member` })
    }

    logger.info(
        { feature: 'flags', matchId, flagType, submittedBy: normalizedSubmitter },
        'Processing flag submission',
    )

    try {
        const result = await submitFlag({
            matchId,
            player1CharacterId,
            player2CharacterId,
            flagType: flagType as MatchFlagType,
            reason: reason ?? null,
            submittedBy: normalizedSubmitter,
        })

        return res.status(201).json(result)
    } catch (error) {
        if (error instanceof FlagServiceError) {
            switch (error.code) {
                case 'MATCH_NOT_FOUND':
                    return res.status(404).json({ error: error.message })
                case 'NOT_A_PARTICIPANT':
                    return res.status(403).json({ error: error.message })
                case 'DUPLICATE_PENDING_FLAG':
                    return res.status(409).json({ error: error.message })
            }
        }
        logger.error(
            { feature: 'flags', matchId, flagType, submittedBy: normalizedSubmitter, error },
            'Error processing flag submission',
        )
        return res.status(500).json({ error: 'Failed to submit flag' })
    }
})

// ---------------------------------------------------------------------------
// GET /api/h2h/flags — Admin: list flags with match context
// ---------------------------------------------------------------------------

const listFlagsQuerySchema = z.object({
    status: z.enum(['pending', 'approved', 'rejected'] as const).optional(),
    flagType: z.enum(['void', 'showmatch', 'tournament'] as const).optional(),
})

/**
 * GET /api/h2h/flags
 *
 * Returns all flags joined with match context, optionally filtered by
 * `status` and/or `flagType` query parameters.
 *
 * Protected: requires a valid admin JWT in the Authorization header.
 */
router.get('/h2h/flags', requireAdminAuth, async (req: Request, res: Response) => {
    const parsed = listFlagsQuerySchema.safeParse(req.query)

    if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            received: req.query[issue.path[0] as string],
        }))
        return res.status(400).json({ error: 'Invalid query parameters', details })
    }

    logger.info({ feature: 'flags', filters: parsed.data }, 'Admin listing flags')

    try {
        const flags = await listFlags(parsed.data)
        return res.json(flags)
    } catch (error) {
        logger.error({ feature: 'flags', error }, 'Error listing flags')
        return res.status(500).json({ error: 'Failed to list flags' })
    }
})

// ---------------------------------------------------------------------------
// PATCH /api/h2h/flags/:flagId — Admin: approve or reject a flag
// ---------------------------------------------------------------------------

const patchFlagBodySchema = z.object({
    action: z.enum(['approve', 'reject'] as const, {
        required_error: 'action is required',
        invalid_type_error: 'action must be one of: approve, reject',
    }),
    adminNote: z
        .string()
        .max(500, 'adminNote must be 500 characters or fewer')
        .nullable()
        .optional()
        .default(null),
})

/**
 * PATCH /api/h2h/flags/:flagId
 *
 * Approves or rejects a community flag.
 *
 * Body:
 * - action: 'approve' | 'reject' (required)
 * - adminNote: optional note stored on the flag (max 500 chars)
 *
 * Protected: requires a valid admin JWT in the Authorization header.
 */
router.patch('/h2h/flags/:flagId', requireAdminAuth, async (req: Request, res: Response) => {
    const flagId = parseInt(req.params.flagId, 10)
    if (!Number.isInteger(flagId) || flagId <= 0) {
        return res.status(400).json({ error: 'flagId must be a positive integer' })
    }

    const parsed = patchFlagBodySchema.safeParse(req.body)
    if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            received: issue.path.length > 0 ? req.body?.[issue.path[0] as string] : undefined,
        }))
        return res.status(400).json({ error: 'Invalid request body', details })
    }

    const { action, adminNote } = parsed.data

    logger.info({ feature: 'flags', flagId, action }, 'Admin processing flag review')

    try {
        if (action === 'approve') {
            const result = await approveFlag(flagId)
            return res.json(result)
        } else {
            const result = await rejectFlag(flagId, adminNote ?? null)
            return res.json(result)
        }
    } catch (error) {
        if (error instanceof FlagServiceError) {
            switch (error.code) {
                case 'FLAG_NOT_FOUND':
                    return res.status(404).json({ error: error.message })
                case 'FLAG_NOT_PENDING':
                    return res.status(409).json({ error: error.message })
            }
        }
        logger.error(
            { feature: 'flags', flagId, action, error },
            'Error processing flag review',
        )
        return res.status(500).json({ error: 'Failed to process flag review' })
    }
})

// ---------------------------------------------------------------------------
// GET /api/h2h/admin/pending — Admin: list unreviewed pending matches
// ---------------------------------------------------------------------------

/**
 * GET /api/h2h/admin/pending
 *
 * Returns all pending matches where review_outcome IS NULL, ordered by
 * match_date descending.
 *
 * Protected: requires a valid admin JWT in the Authorization header.
 */
router.get('/h2h/admin/pending', requireAdminAuth, async (req: Request, res: Response) => {
    logger.info({ feature: 'pending-matches' }, 'Admin listing pending matches')

    try {
        const pending = await listPendingMatches()
        return res.json(pending)
    } catch (error) {
        logger.error({ feature: 'pending-matches', error }, 'Error listing pending matches')
        return res.status(500).json({ error: 'Failed to list pending matches' })
    }
})

// ---------------------------------------------------------------------------
// POST /api/h2h/admin/pending/:id/confirm — Admin: confirm a pending match
// ---------------------------------------------------------------------------

const confirmPendingBodySchema = z.object({
    player1CharacterId: z
        .number({ required_error: 'player1CharacterId is required' })
        .int()
        .positive(),
    player2CharacterId: z
        .number({ required_error: 'player2CharacterId is required' })
        .int()
        .positive(),
    winnerCharacterId: z
        .number({ required_error: 'winnerCharacterId is required' })
        .int()
        .positive(),
})

/**
 * POST /api/h2h/admin/pending/:id/confirm
 *
 * Confirms a pending match by selecting two players and a winner, then
 * persists it as a 1v1 match via persistMatch.
 *
 * Body:
 * - player1CharacterId: numeric character ID (required)
 * - player2CharacterId: numeric character ID (required)
 * - winnerCharacterId: must equal player1 or player2 (required)
 *
 * Protected: requires a valid admin JWT in the Authorization header.
 */
router.post(
    '/h2h/admin/pending/:id/confirm',
    requireAdminAuth,
    async (req: Request, res: Response) => {
        const id = parseInt(req.params.id, 10)
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'id must be a positive integer' })
        }

        const parsed = confirmPendingBodySchema.safeParse(req.body)
        if (!parsed.success) {
            const details = parsed.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
                received:
                    issue.path.length > 0 ? req.body?.[issue.path[0] as string] : undefined,
            }))
            return res.status(400).json({ error: 'Invalid request body', details })
        }

        const { player1CharacterId, player2CharacterId, winnerCharacterId } = parsed.data

        logger.info(
            { feature: 'pending-matches', id, player1CharacterId, player2CharacterId, winnerCharacterId },
            'Admin confirming pending match',
        )

        try {
            await confirmPendingMatch(id, player1CharacterId, player2CharacterId, winnerCharacterId)
            return res.json({
                message: 'Match confirmed and persisted',
                pendingId: id,
                reviewOutcome: 'confirmed',
            })
        } catch (error) {
            if (error instanceof PendingServiceError) {
                switch (error.code) {
                    case 'NOT_FOUND':
                        return res.status(404).json({ error: error.message })
                    case 'ALREADY_REVIEWED':
                    case 'TEAM_MATCH':
                        return res.status(409).json({ error: error.message })
                    case 'UNKNOWN_PLAYER':
                    case 'INVALID_WINNER':
                    case 'SAME_PLAYER':
                        return res.status(400).json({ error: error.message })
                }
            }
            logger.error(
                { feature: 'pending-matches', id, error },
                'Error confirming pending match',
            )
            return res.status(500).json({ error: 'Failed to confirm pending match' })
        }
    },
)

// ---------------------------------------------------------------------------
// POST /api/h2h/admin/pending/:id/reject — Admin: reject a pending match
// ---------------------------------------------------------------------------

/**
 * POST /api/h2h/admin/pending/:id/reject
 *
 * Marks a pending match as rejected without persisting any match record.
 *
 * Protected: requires a valid admin JWT in the Authorization header.
 */
router.post(
    '/h2h/admin/pending/:id/reject',
    requireAdminAuth,
    async (req: Request, res: Response) => {
        const id = parseInt(req.params.id, 10)
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'id must be a positive integer' })
        }

        logger.info({ feature: 'pending-matches', id }, 'Admin rejecting pending match')

        try {
            await rejectPendingMatch(id)
            return res.json({
                message: 'Match rejected',
                pendingId: id,
                reviewOutcome: 'rejected',
            })
        } catch (error) {
            if (error instanceof PendingServiceError) {
                switch (error.code) {
                    case 'NOT_FOUND':
                        return res.status(404).json({ error: error.message })
                    case 'ALREADY_REVIEWED':
                        return res.status(409).json({ error: error.message })
                }
            }
            logger.error(
                { feature: 'pending-matches', id, error },
                'Error rejecting pending match',
            )
            return res.status(500).json({ error: 'Failed to reject pending match' })
        }
    },
)

export default router
