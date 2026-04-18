import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'

const hoisted = vi.hoisted(() => ({
    submitFlagMock: vi.fn(),
    listFlagsMock: vi.fn(),
    getCommunityDataMock: vi.fn(),
    getCommunityPlayerMock: vi.fn(),
    loadPairRecordMock: vi.fn(),
    syncPairMock: vi.fn(),
    requireAdminAuthMock: vi.fn(),
    loggerMock: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('../../services/h2hFlagService', () => ({
    submitFlag: hoisted.submitFlagMock,
    listFlags: hoisted.listFlagsMock,
    FlagServiceError: class FlagServiceError extends Error {
        readonly code: string
        constructor(code: string, message: string) {
            super(message)
            this.name = 'FlagServiceError'
            this.code = code
        }
    },
}))

vi.mock('../../middleware/adminAuthMiddleware', () => ({
    requireAdminAuth: hoisted.requireAdminAuthMock,
}))

vi.mock('../../services/h2hService', () => ({
    loadPairRecord: hoisted.loadPairRecordMock,
    syncPair: hoisted.syncPairMock,
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

function createMockRequest(body: Record<string, unknown> = {}): Request {
    return { body } as unknown as Request
}

function createMockRequestWithQuery(query: Record<string, string> = {}): Request {
    return { query } as unknown as Request
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const knownBtag = 'Alpha#1234'
const unknownBtag = 'Ghost#9999'

const communityDataWithPlayer = {
    players: [
        { id: '49312', btag: knownBtag, name: 'Alpha' },
        { id: '2741271', btag: 'Beta#5678', name: 'Beta' },
    ],
}

const validBody = {
    matchId: 'pulse-12345',
    player1CharacterId: 49312,
    player2CharacterId: 2741271,
    flagType: 'void',
    reason: 'This was a practice match not counted.',
    submittedBy: knownBtag,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /h2h/flags', () => {
    let handler: (req: Request, res: Response) => Promise<void>

    beforeEach(async () => {
        vi.resetModules()
        hoisted.submitFlagMock.mockReset()
        hoisted.getCommunityDataMock.mockReset()
        hoisted.loggerMock.info.mockReset()
        hoisted.loggerMock.error.mockReset()

        const routes = await import('../../routes/h2hRoutes')
        const router = routes.default
        const layer = router.stack?.find(
            (l: any) => l.route?.path === '/h2h/flags' && l.route?.methods?.post,
        )
        handler = layer?.route?.stack?.[0]?.handle
    })

    async function callRoute(body: Record<string, unknown>) {
        const req = createMockRequest(body)
        const res = createMockResponse()
        await handler(req, res as unknown as Response)
        return res
    }

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    describe('success cases', () => {
        it('returns 201 with flagId and status pending for a void flag', async () => {
            hoisted.getCommunityDataMock.mockResolvedValue(communityDataWithPlayer)
            hoisted.submitFlagMock.mockResolvedValue({ flagId: 42, status: 'pending' })

            const res = await callRoute(validBody)

            expect(res.statusCode).toBe(201)
            const body = res.jsonData as Record<string, unknown>
            expect(body.flagId).toBe(42)
            expect(body.status).toBe('pending')
            // Verify submitFlag was called with the correct params — the service
            // is responsible for writing the DB row with status = 'pending'
            expect(hoisted.submitFlagMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    matchId: validBody.matchId,
                    player1CharacterId: validBody.player1CharacterId,
                    player2CharacterId: validBody.player2CharacterId,
                    flagType: validBody.flagType,
                    reason: validBody.reason,
                    submittedBy: validBody.submittedBy,
                }),
            )
        })

        it('returns 201 for a showmatch flag without reason', async () => {
            hoisted.getCommunityDataMock.mockResolvedValue(communityDataWithPlayer)
            hoisted.submitFlagMock.mockResolvedValue({ flagId: 7, status: 'pending' })

            const res = await callRoute({
                ...validBody,
                flagType: 'showmatch',
                reason: null,
            })

            expect(res.statusCode).toBe(201)
            expect((res.jsonData as Record<string, unknown>).status).toBe('pending')
        })

        it('returns 201 for a tournament flag without reason', async () => {
            hoisted.getCommunityDataMock.mockResolvedValue(communityDataWithPlayer)
            hoisted.submitFlagMock.mockResolvedValue({ flagId: 8, status: 'pending' })

            const res = await callRoute({
                ...validBody,
                flagType: 'tournament',
                reason: undefined,
            })

            expect(res.statusCode).toBe(201)
        })

        it('passes normalized submittedBy to submitFlag', async () => {
            hoisted.getCommunityDataMock.mockResolvedValue(communityDataWithPlayer)
            hoisted.submitFlagMock.mockResolvedValue({ flagId: 1, status: 'pending' })

            await callRoute({ ...validBody, submittedBy: `  ${knownBtag}  ` })

            expect(hoisted.submitFlagMock).toHaveBeenCalledWith(
                expect.objectContaining({ submittedBy: knownBtag }),
            )
        })
    })

    // -------------------------------------------------------------------------
    // Zod validation — 400
    // -------------------------------------------------------------------------

    describe('Zod validation errors → 400', () => {
        it('returns 400 when submittedBy is missing', async () => {
            const { submittedBy: _omitted, ...bodyWithoutSubmitter } = validBody
            const res = await callRoute(bodyWithoutSubmitter)

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid request body')
            expect(Array.isArray(body.details)).toBe(true)
        })

        it('returns 400 when flagType is void and reason is missing', async () => {
            const res = await callRoute({ ...validBody, flagType: 'void', reason: null })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid request body')
            const details = body.details as Array<Record<string, unknown>>
            expect(details.some((detail) => detail.field === 'reason')).toBe(true)
        })

        it('returns 400 when flagType is void and reason is empty string', async () => {
            const res = await callRoute({ ...validBody, flagType: 'void', reason: '   ' })

            expect(res.statusCode).toBe(400)
            const details = (res.jsonData as Record<string, unknown>)
                .details as Array<Record<string, unknown>>
            expect(details.some((detail) => detail.field === 'reason')).toBe(true)
        })

        it('returns 400 when reason exceeds 500 characters', async () => {
            const res = await callRoute({ ...validBody, reason: 'x'.repeat(501) })

            expect(res.statusCode).toBe(400)
            const details = (res.jsonData as Record<string, unknown>)
                .details as Array<Record<string, unknown>>
            expect(details.some((detail) => detail.field === 'reason')).toBe(true)
        })

        it('returns 400 when flagType is an invalid value', async () => {
            const res = await callRoute({ ...validBody, flagType: 'invalid_type' })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid request body')
        })

        it('returns 400 when matchId is missing', async () => {
            const { matchId: _omitted, ...bodyWithoutMatchId } = validBody
            const res = await callRoute(bodyWithoutMatchId)

            expect(res.statusCode).toBe(400)
        })

        it('returns 400 when player1CharacterId is missing', async () => {
            const { player1CharacterId: _omitted, ...rest } = validBody
            const res = await callRoute(rest)

            expect(res.statusCode).toBe(400)
        })
    })

    // -------------------------------------------------------------------------
    // Community roster check — 400 for unknown btag
    // -------------------------------------------------------------------------

    describe('community btag validation → 400', () => {
        it('returns 400 when submittedBy is not a known community btag', async () => {
            hoisted.getCommunityDataMock.mockResolvedValue(communityDataWithPlayer)

            const res = await callRoute({ ...validBody, submittedBy: unknownBtag })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(typeof body.error).toBe('string')
            expect(body.error as string).toContain(unknownBtag)
            expect(hoisted.submitFlagMock).not.toHaveBeenCalled()
        })
    })

    // -------------------------------------------------------------------------
    // Service error mapping
    // -------------------------------------------------------------------------

    describe('FlagServiceError mapping', () => {
        beforeEach(() => {
            hoisted.getCommunityDataMock.mockResolvedValue(communityDataWithPlayer)
        })

        it('returns 404 when service throws MATCH_NOT_FOUND', async () => {
            const { FlagServiceError } = await import('../../services/h2hFlagService')
            hoisted.submitFlagMock.mockRejectedValue(
                new FlagServiceError('MATCH_NOT_FOUND', "Match 'pulse-12345' not found"),
            )

            const res = await callRoute(validBody)

            expect(res.statusCode).toBe(404)
            const body = res.jsonData as Record<string, unknown>
            expect(typeof body.error).toBe('string')
        })

        it('returns 403 when service throws NOT_A_PARTICIPANT', async () => {
            const { FlagServiceError } = await import('../../services/h2hFlagService')
            hoisted.submitFlagMock.mockRejectedValue(
                new FlagServiceError('NOT_A_PARTICIPANT', 'Submitter is not a participant'),
            )

            const res = await callRoute(validBody)

            expect(res.statusCode).toBe(403)
        })

        it('returns 409 when service throws DUPLICATE_PENDING_FLAG', async () => {
            const { FlagServiceError } = await import('../../services/h2hFlagService')
            hoisted.submitFlagMock.mockRejectedValue(
                new FlagServiceError(
                    'DUPLICATE_PENDING_FLAG',
                    "A pending 'void' flag already exists",
                ),
            )

            const res = await callRoute(validBody)

            expect(res.statusCode).toBe(409)
        })

        it('returns 500 for unexpected errors', async () => {
            hoisted.submitFlagMock.mockRejectedValue(new Error('Unexpected DB failure'))

            const res = await callRoute(validBody)

            expect(res.statusCode).toBe(500)
            expect(hoisted.loggerMock.error).toHaveBeenCalled()
        })
    })
})

// ---------------------------------------------------------------------------
// GET /api/h2h/flags
// ---------------------------------------------------------------------------

describe('GET /h2h/flags', () => {
    let fullStack: Array<(req: Request, res: Response, next: NextFunction) => void | Promise<void>>

    const flagWithMatch = {
        id: 1,
        matchDbId: 99,
        flagType: 'void',
        reason: 'practice match',
        submittedBy: 'Alpha#1234',
        status: 'pending',
        adminNote: null,
        reviewedBy: null,
        createdAt: '2026-04-18T10:00:00.000Z',
        reviewedAt: null,
        match: {
            matchId: 'pulse-12345',
            date: '2026-04-17T20:00:00.000Z',
            map: 'Equilibrium',
            winnerCharacterId: 49312,
            type: '1v1',
        },
        player1CharacterId: 49312,
        player2CharacterId: 2741271,
    }

    beforeEach(async () => {
        vi.resetModules()
        hoisted.listFlagsMock.mockReset()
        hoisted.loggerMock.info.mockReset()
        hoisted.loggerMock.error.mockReset()
        // Auth passes by default
        hoisted.requireAdminAuthMock.mockImplementation(
            (_req: Request, _res: Response, next: NextFunction) => next(),
        )

        const routes = await import('../../routes/h2hRoutes')
        const router = routes.default
        const layer = (router as any).stack?.find(
            (l: any) => l.route?.path === '/h2h/flags' && l.route?.methods?.get,
        )
        fullStack = layer?.route?.stack?.map((s: any) => s.handle) ?? []
    })

    async function callRoute(query: Record<string, string> = {}) {
        const req = createMockRequestWithQuery(query)
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

    it('returns 401 when requireAdminAuth rejects (middleware is applied)', async () => {
        hoisted.requireAdminAuthMock.mockImplementation((_req: Request, res: Response) => {
            res.status(401).json({ error: 'Unauthorized' })
        })

        const res = await callRoute()

        expect(res.statusCode).toBe(401)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Unauthorized')
        expect(hoisted.listFlagsMock).not.toHaveBeenCalled()
    })

    // -------------------------------------------------------------------------
    // Happy path
    // -------------------------------------------------------------------------

    it('returns 200 with H2HFlagWithMatch array when no filters provided', async () => {
        hoisted.listFlagsMock.mockResolvedValue([flagWithMatch])

        const res = await callRoute()

        expect(res.statusCode).toBe(200)
        const body = res.jsonData as typeof flagWithMatch[]
        expect(body).toHaveLength(1)
        const flag = body[0]
        expect(flag.match.matchId).toBe('pulse-12345')
        expect(flag.match.date).toBeDefined()
        expect(flag.match.map).toBeDefined()
        expect(flag.match.winnerCharacterId).toBeDefined()
        expect(flag.match.type).toBeDefined()
        expect(flag.player1CharacterId).toBe(49312)
        expect(flag.player2CharacterId).toBe(2741271)
    })

    it('returns 200 with empty array when no flags exist', async () => {
        hoisted.listFlagsMock.mockResolvedValue([])

        const res = await callRoute()

        expect(res.statusCode).toBe(200)
        expect(res.jsonData).toEqual([])
    })

    it('passes status filter to listFlags', async () => {
        hoisted.listFlagsMock.mockResolvedValue([])

        await callRoute({ status: 'approved' })

        expect(hoisted.listFlagsMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'approved' }),
        )
    })

    it('passes flagType filter to listFlags', async () => {
        hoisted.listFlagsMock.mockResolvedValue([])

        await callRoute({ flagType: 'void' })

        expect(hoisted.listFlagsMock).toHaveBeenCalledWith(
            expect.objectContaining({ flagType: 'void' }),
        )
    })

    it('passes both filters to listFlags when both provided', async () => {
        hoisted.listFlagsMock.mockResolvedValue([])

        await callRoute({ status: 'pending', flagType: 'showmatch' })

        expect(hoisted.listFlagsMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'pending', flagType: 'showmatch' }),
        )
    })

    // -------------------------------------------------------------------------
    // Validation errors
    // -------------------------------------------------------------------------

    it('returns 400 when status is an invalid value', async () => {
        const res = await callRoute({ status: 'invalid_status' })

        expect(res.statusCode).toBe(400)
        const body = res.jsonData as Record<string, unknown>
        expect(body.error).toBe('Invalid query parameters')
        expect(Array.isArray(body.details)).toBe(true)
        expect(hoisted.listFlagsMock).not.toHaveBeenCalled()
    })

    it('returns 400 when flagType is an invalid value', async () => {
        const res = await callRoute({ flagType: 'bad_type' })

        expect(res.statusCode).toBe(400)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Invalid query parameters')
    })

    // -------------------------------------------------------------------------
    // Error handling
    // -------------------------------------------------------------------------

    it('returns 500 when listFlags throws an unexpected error', async () => {
        hoisted.listFlagsMock.mockRejectedValue(new Error('DB connection lost'))

        const res = await callRoute()

        expect(res.statusCode).toBe(500)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Failed to list flags')
        expect(hoisted.loggerMock.error).toHaveBeenCalled()
    })
})
