import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'

const hoisted = vi.hoisted(() => ({
    listPendingMatchesMock: vi.fn(),
    confirmPendingMatchMock: vi.fn(),
    rejectPendingMatchMock: vi.fn(),
    submitFlagMock: vi.fn(),
    listFlagsMock: vi.fn(),
    approveFlagMock: vi.fn(),
    rejectFlagMock: vi.fn(),
    getCommunityPlayerMock: vi.fn(),
    getCommunityDataMock: vi.fn(),
    loadPairRecordMock: vi.fn(),
    syncPairMock: vi.fn(),
    getTopPairsMock: vi.fn(),
    requireAdminAuthMock: vi.fn(),
    loggerMock: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}))

vi.mock('../../services/h2hPendingService', () => ({
    listPendingMatches: hoisted.listPendingMatchesMock,
    confirmPendingMatch: hoisted.confirmPendingMatchMock,
    rejectPendingMatch: hoisted.rejectPendingMatchMock,
    PendingServiceError: class PendingServiceError extends Error {
        readonly code: string
        constructor(code: string, message: string) {
            super(message)
            this.name = 'PendingServiceError'
            this.code = code
        }
    },
}))

vi.mock('../../services/h2hFlagService', () => ({
    submitFlag: hoisted.submitFlagMock,
    listFlags: hoisted.listFlagsMock,
    approveFlag: hoisted.approveFlagMock,
    rejectFlag: hoisted.rejectFlagMock,
    FlagServiceError: class FlagServiceError extends Error {
        readonly code: string
        constructor(code: string, message: string) {
            super(message)
            this.name = 'FlagServiceError'
            this.code = code
        }
    },
}))

vi.mock('../../services/h2hService', () => ({
    loadPairRecord: hoisted.loadPairRecordMock,
    syncPair: hoisted.syncPairMock,
    getTopPairs: hoisted.getTopPairsMock,
    H2HResolutionError: class H2HResolutionError extends Error {
        readonly characterId: number
        constructor(characterId: number) {
            super(`No 1v1 team found for characterId ${characterId}`)
            this.name = 'H2HResolutionError'
            this.characterId = characterId
        }
    },
}))

vi.mock('../../services/communityDataService', () => ({
    communityDataService: {
        getCommunityData: hoisted.getCommunityDataMock,
        getCommunityPlayer: hoisted.getCommunityPlayerMock,
    },
}))

vi.mock('../../middleware/adminAuthMiddleware', () => ({
    requireAdminAuth: hoisted.requireAdminAuthMock,
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.loggerMock,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockResponse() {
    const res = {
        jsonData: undefined as unknown,
        statusCode: 200,
        status: vi.fn(),
        json: vi.fn(),
    }
    res.status.mockImplementation((code: number) => {
        res.statusCode = code
        return res
    })
    res.json.mockImplementation((data: unknown) => {
        res.jsonData = data
        return res
    })
    return res as unknown as Response & { jsonData: unknown; statusCode: number }
}

function createMockRequest(
    params: Record<string, string> = {},
    body: Record<string, unknown> = {},
): Request {
    return { params, body } as unknown as Request
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const pendingMatchFixture = {
    id: 17,
    matchId: 'BZ-1745408400_Winter_Madness_LE',
    matchDate: '2026-04-23T03:00:00.000Z',
    mapName: 'Winter Madness LE',
    region: 'US',
    candidateIds: [8459434, 9317307, 340752743],
    rawDecisions: [
        { characterId: 8459434, decision: 'WIN' },
        { characterId: 9317307, decision: 'LOSS' },
        { characterId: 340752743, decision: 'OBSERVER' },
    ],
    reason: 'multi_winner',
    activePlayerCount: 2,
    winCount: 1,
    lossCount: 1,
    observerCount: 1,
    inferredMode: 'unknown',
    reviewedAt: null,
    reviewOutcome: null,
}

const validConfirmBody = {
    player1CharacterId: 8459434,
    player2CharacterId: 9317307,
    winnerCharacterId: 8459434,
}

// ---------------------------------------------------------------------------
// GET /h2h/admin/pending
// ---------------------------------------------------------------------------

describe('GET /h2h/admin/pending', () => {
    let fullStack: Array<(req: Request, res: Response, next: NextFunction) => void | Promise<void>>

    beforeEach(async () => {
        vi.resetModules()
        hoisted.listPendingMatchesMock.mockReset()
        hoisted.loggerMock.info.mockReset()
        hoisted.loggerMock.error.mockReset()
        // Auth passes by default
        hoisted.requireAdminAuthMock.mockImplementation(
            (_req: Request, _res: Response, next: NextFunction) => next(),
        )

        const routes = await import('../../routes/h2hRoutes')
        const router = routes.default
        const layer = (router as any).stack?.find(
            (l: any) => l.route?.path === '/h2h/admin/pending' && l.route?.methods?.get,
        )
        fullStack = layer?.route?.stack?.map((s: any) => s.handle) ?? []
    })

    async function callRoute() {
        const req = createMockRequest()
        const res = createMockResponse()
        for (const fn of fullStack) {
            let nextCalled = false
            await fn(req, res as unknown as Response, () => {
                nextCalled = true
            })
            if (!nextCalled) break
        }
        return res
    }

    it('returns 401 when requireAdminAuth rejects', async () => {
        hoisted.requireAdminAuthMock.mockImplementation((_req: Request, res: Response) => {
            res.status(401).json({ error: 'Unauthorized' })
        })

        const res = await callRoute()

        expect(res.statusCode).toBe(401)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Unauthorized')
        expect(hoisted.listPendingMatchesMock).not.toHaveBeenCalled()
    })

    it('returns 200 with array of pending matches', async () => {
        hoisted.listPendingMatchesMock.mockResolvedValue([pendingMatchFixture])

        const res = await callRoute()

        expect(res.statusCode).toBe(200)
        const body = res.jsonData as typeof pendingMatchFixture[]
        expect(body).toHaveLength(1)
        expect(body[0].id).toBe(17)
        expect(body[0].reviewOutcome).toBeNull()
        expect(hoisted.listPendingMatchesMock).toHaveBeenCalledOnce()
    })

    it('returns 200 with empty array when no pending matches exist', async () => {
        hoisted.listPendingMatchesMock.mockResolvedValue([])

        const res = await callRoute()

        expect(res.statusCode).toBe(200)
        expect(res.jsonData).toEqual([])
    })

    it('returns 500 when service throws an unexpected error', async () => {
        hoisted.listPendingMatchesMock.mockRejectedValue(new Error('DB connection lost'))

        const res = await callRoute()

        expect(res.statusCode).toBe(500)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Failed to list pending matches')
        expect(hoisted.loggerMock.error).toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// POST /h2h/admin/pending/:id/confirm
// ---------------------------------------------------------------------------

describe('POST /h2h/admin/pending/:id/confirm', () => {
    let fullStack: Array<(req: Request, res: Response, next: NextFunction) => void | Promise<void>>

    beforeEach(async () => {
        vi.resetModules()
        hoisted.confirmPendingMatchMock.mockReset()
        hoisted.loggerMock.info.mockReset()
        hoisted.loggerMock.error.mockReset()
        // Auth passes by default
        hoisted.requireAdminAuthMock.mockImplementation(
            (_req: Request, _res: Response, next: NextFunction) => next(),
        )

        const routes = await import('../../routes/h2hRoutes')
        const router = routes.default
        const layer = (router as any).stack?.find(
            (l: any) =>
                l.route?.path === '/h2h/admin/pending/:id/confirm' && l.route?.methods?.post,
        )
        fullStack = layer?.route?.stack?.map((s: any) => s.handle) ?? []
    })

    async function callRoute(
        params: Record<string, string>,
        body: Record<string, unknown> = {},
    ) {
        const req = createMockRequest(params, body)
        const res = createMockResponse()
        for (const fn of fullStack) {
            let nextCalled = false
            await fn(req, res as unknown as Response, () => {
                nextCalled = true
            })
            if (!nextCalled) break
        }
        return res
    }

    // -------------------------------------------------------------------------
    // Auth guard
    // -------------------------------------------------------------------------

    it('returns 401 when requireAdminAuth rejects', async () => {
        hoisted.requireAdminAuthMock.mockImplementation((_req: Request, res: Response) => {
            res.status(401).json({ error: 'Unauthorized' })
        })

        const res = await callRoute({ id: '17' }, validConfirmBody)

        expect(res.statusCode).toBe(401)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Unauthorized')
        expect(hoisted.confirmPendingMatchMock).not.toHaveBeenCalled()
    })

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    it('returns 200 with confirmed response on success', async () => {
        hoisted.confirmPendingMatchMock.mockResolvedValue(undefined)

        const res = await callRoute({ id: '17' }, validConfirmBody)

        expect(res.statusCode).toBe(200)
        const body = res.jsonData as Record<string, unknown>
        expect(body.message).toBe('Match confirmed and persisted')
        expect(body.pendingId).toBe(17)
        expect(body.reviewOutcome).toBe('confirmed')
        expect(hoisted.confirmPendingMatchMock).toHaveBeenCalledWith(
            17,
            validConfirmBody.player1CharacterId,
            validConfirmBody.player2CharacterId,
            validConfirmBody.winnerCharacterId,
        )
    })

    // -------------------------------------------------------------------------
    // Param validation — 400
    // -------------------------------------------------------------------------

    it('returns 400 when id is not a positive integer', async () => {
        const res = await callRoute({ id: 'abc' }, validConfirmBody)

        expect(res.statusCode).toBe(400)
        expect((res.jsonData as Record<string, unknown>).error).toBe('id must be a positive integer')
        expect(hoisted.confirmPendingMatchMock).not.toHaveBeenCalled()
    })

    it('returns 400 when id is zero', async () => {
        const res = await callRoute({ id: '0' }, validConfirmBody)

        expect(res.statusCode).toBe(400)
        expect(hoisted.confirmPendingMatchMock).not.toHaveBeenCalled()
    })

    // -------------------------------------------------------------------------
    // Zod body validation — 400
    // -------------------------------------------------------------------------

    it('returns 400 with details when player1CharacterId is missing', async () => {
        const { player1CharacterId: _, ...rest } = validConfirmBody

        const res = await callRoute({ id: '17' }, rest)

        expect(res.statusCode).toBe(400)
        const body = res.jsonData as Record<string, unknown>
        expect(body.error).toBe('Invalid request body')
        expect(Array.isArray(body.details)).toBe(true)
    })

    it('returns 400 with details when player2CharacterId is missing', async () => {
        const { player2CharacterId: _, ...rest } = validConfirmBody

        const res = await callRoute({ id: '17' }, rest)

        expect(res.statusCode).toBe(400)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Invalid request body')
    })

    it('returns 400 with details when winnerCharacterId is missing', async () => {
        const { winnerCharacterId: _, ...rest } = validConfirmBody

        const res = await callRoute({ id: '17' }, rest)

        expect(res.statusCode).toBe(400)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Invalid request body')
    })

    // -------------------------------------------------------------------------
    // Service error mapping
    // -------------------------------------------------------------------------

    it('returns 404 when service throws NOT_FOUND', async () => {
        const { PendingServiceError } = await import('../../services/h2hPendingService')
        hoisted.confirmPendingMatchMock.mockRejectedValue(
            new PendingServiceError('NOT_FOUND', 'Pending match 17 not found'),
        )

        const res = await callRoute({ id: '17' }, validConfirmBody)

        expect(res.statusCode).toBe(404)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Pending match 17 not found')
    })

    it('returns 409 when service throws ALREADY_REVIEWED', async () => {
        const { PendingServiceError } = await import('../../services/h2hPendingService')
        hoisted.confirmPendingMatchMock.mockRejectedValue(
            new PendingServiceError(
                'ALREADY_REVIEWED',
                'Pending match 17 has already been reviewed (confirmed)',
            ),
        )

        const res = await callRoute({ id: '17' }, validConfirmBody)

        expect(res.statusCode).toBe(409)
        expect(typeof (res.jsonData as Record<string, unknown>).error).toBe('string')
    })

    it('returns 400 when service throws UNKNOWN_PLAYER', async () => {
        const { PendingServiceError } = await import('../../services/h2hPendingService')
        hoisted.confirmPendingMatchMock.mockRejectedValue(
            new PendingServiceError(
                'UNKNOWN_PLAYER',
                `Character ID ${validConfirmBody.player1CharacterId} is not a known community member`,
            ),
        )

        const res = await callRoute({ id: '17' }, validConfirmBody)

        expect(res.statusCode).toBe(400)
        expect((res.jsonData as Record<string, unknown>).error).toContain(
            String(validConfirmBody.player1CharacterId),
        )
    })

    it('returns 400 when service throws INVALID_WINNER', async () => {
        const { PendingServiceError } = await import('../../services/h2hPendingService')
        hoisted.confirmPendingMatchMock.mockRejectedValue(
            new PendingServiceError(
                'INVALID_WINNER',
                'winnerCharacterId must be one of player1CharacterId or player2CharacterId',
            ),
        )

        const res = await callRoute({ id: '17' }, validConfirmBody)

        expect(res.statusCode).toBe(400)
    })

    it('returns 400 when service throws SAME_PLAYER', async () => {
        const { PendingServiceError } = await import('../../services/h2hPendingService')
        hoisted.confirmPendingMatchMock.mockRejectedValue(
            new PendingServiceError(
                'SAME_PLAYER',
                'player1CharacterId and player2CharacterId must be different',
            ),
        )

        const res = await callRoute(
            { id: '17' },
            {
                player1CharacterId: 8459434,
                player2CharacterId: 8459434,
                winnerCharacterId: 8459434,
            },
        )

        expect(res.statusCode).toBe(400)
    })

    it('returns 500 when service throws an unexpected error', async () => {
        hoisted.confirmPendingMatchMock.mockRejectedValue(new Error('DB failure'))

        const res = await callRoute({ id: '17' }, validConfirmBody)

        expect(res.statusCode).toBe(500)
        expect((res.jsonData as Record<string, unknown>).error).toBe(
            'Failed to confirm pending match',
        )
        expect(hoisted.loggerMock.error).toHaveBeenCalled()
    })
})

// ---------------------------------------------------------------------------
// POST /h2h/admin/pending/:id/reject
// ---------------------------------------------------------------------------

describe('POST /h2h/admin/pending/:id/reject', () => {
    let fullStack: Array<(req: Request, res: Response, next: NextFunction) => void | Promise<void>>

    beforeEach(async () => {
        vi.resetModules()
        hoisted.rejectPendingMatchMock.mockReset()
        hoisted.loggerMock.info.mockReset()
        hoisted.loggerMock.error.mockReset()
        // Auth passes by default
        hoisted.requireAdminAuthMock.mockImplementation(
            (_req: Request, _res: Response, next: NextFunction) => next(),
        )

        const routes = await import('../../routes/h2hRoutes')
        const router = routes.default
        const layer = (router as any).stack?.find(
            (l: any) =>
                l.route?.path === '/h2h/admin/pending/:id/reject' && l.route?.methods?.post,
        )
        fullStack = layer?.route?.stack?.map((s: any) => s.handle) ?? []
    })

    async function callRoute(
        params: Record<string, string>,
        body: Record<string, unknown> = {},
    ) {
        const req = createMockRequest(params, body)
        const res = createMockResponse()
        for (const fn of fullStack) {
            let nextCalled = false
            await fn(req, res as unknown as Response, () => {
                nextCalled = true
            })
            if (!nextCalled) break
        }
        return res
    }

    // -------------------------------------------------------------------------
    // Auth guard
    // -------------------------------------------------------------------------

    it('returns 401 when requireAdminAuth rejects', async () => {
        hoisted.requireAdminAuthMock.mockImplementation((_req: Request, res: Response) => {
            res.status(401).json({ error: 'Unauthorized' })
        })

        const res = await callRoute({ id: '17' })

        expect(res.statusCode).toBe(401)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Unauthorized')
        expect(hoisted.rejectPendingMatchMock).not.toHaveBeenCalled()
    })

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    it('returns 200 with rejected response on success', async () => {
        hoisted.rejectPendingMatchMock.mockResolvedValue(undefined)

        const res = await callRoute({ id: '17' })

        expect(res.statusCode).toBe(200)
        const body = res.jsonData as Record<string, unknown>
        expect(body.message).toBe('Match rejected')
        expect(body.pendingId).toBe(17)
        expect(body.reviewOutcome).toBe('rejected')
        expect(hoisted.rejectPendingMatchMock).toHaveBeenCalledWith(17)
    })

    it('accepts empty body (empty object allowed per contract)', async () => {
        hoisted.rejectPendingMatchMock.mockResolvedValue(undefined)

        const res = await callRoute({ id: '17' }, {})

        expect(res.statusCode).toBe(200)
    })

    // -------------------------------------------------------------------------
    // Param validation — 400
    // -------------------------------------------------------------------------

    it('returns 400 when id is not a positive integer', async () => {
        const res = await callRoute({ id: 'bad' })

        expect(res.statusCode).toBe(400)
        expect((res.jsonData as Record<string, unknown>).error).toBe('id must be a positive integer')
        expect(hoisted.rejectPendingMatchMock).not.toHaveBeenCalled()
    })

    it('returns 400 when id is zero', async () => {
        const res = await callRoute({ id: '0' })

        expect(res.statusCode).toBe(400)
        expect(hoisted.rejectPendingMatchMock).not.toHaveBeenCalled()
    })

    // -------------------------------------------------------------------------
    // Service error mapping
    // -------------------------------------------------------------------------

    it('returns 404 when service throws NOT_FOUND', async () => {
        const { PendingServiceError } = await import('../../services/h2hPendingService')
        hoisted.rejectPendingMatchMock.mockRejectedValue(
            new PendingServiceError('NOT_FOUND', 'Pending match 17 not found'),
        )

        const res = await callRoute({ id: '17' })

        expect(res.statusCode).toBe(404)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Pending match 17 not found')
    })

    it('returns 409 when service throws ALREADY_REVIEWED', async () => {
        const { PendingServiceError } = await import('../../services/h2hPendingService')
        hoisted.rejectPendingMatchMock.mockRejectedValue(
            new PendingServiceError(
                'ALREADY_REVIEWED',
                'Pending match 17 has already been reviewed (rejected)',
            ),
        )

        const res = await callRoute({ id: '17' })

        expect(res.statusCode).toBe(409)
        expect(typeof (res.jsonData as Record<string, unknown>).error).toBe('string')
    })

    it('returns 500 when service throws an unexpected error', async () => {
        hoisted.rejectPendingMatchMock.mockRejectedValue(new Error('DB failure'))

        const res = await callRoute({ id: '17' })

        expect(res.statusCode).toBe(500)
        expect((res.jsonData as Record<string, unknown>).error).toBe(
            'Failed to reject pending match',
        )
        expect(hoisted.loggerMock.error).toHaveBeenCalled()
    })
})
