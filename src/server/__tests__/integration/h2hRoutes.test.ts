import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response } from 'express'

const hoisted = vi.hoisted(() => ({
    loadPairRecordMock: vi.fn(),
    syncPairMock: vi.fn(),
    getCommunityPlayerMock: vi.fn(),
    listFlagsMock: vi.fn(),
    getTopPairsMock: vi.fn(),
    getPlayerPairsMock: vi.fn(),
    loggerMock: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('../../services/h2hService', () => ({
    loadPairRecord: hoisted.loadPairRecordMock,
    syncPair: hoisted.syncPairMock,
    getTopPairs: hoisted.getTopPairsMock,
    getPlayerPairs: hoisted.getPlayerPairsMock,
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
        getCommunityPlayer: hoisted.getCommunityPlayerMock,
    },
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.loggerMock,
}))

vi.mock('../../services/h2hFlagService', () => ({
    listFlags: hoisted.listFlagsMock,
    submitFlag: vi.fn(),
    approveFlag: vi.fn(),
    rejectFlag: vi.fn(),
    FlagServiceError: class FlagServiceError extends Error {
        readonly code: string
        constructor(code: string, message: string) {
            super(message)
            this.name = 'FlagServiceError'
            this.code = code
        }
    },
}))

function createMockResponse() {
    const res = {
        jsonData: undefined as unknown,
        statusCode: 200,
        status: vi.fn(),
        json: vi.fn(),
        set: vi.fn(),
    }
    res.status.mockImplementation((code: number) => {
        res.statusCode = code
        return res
    })
    res.json.mockImplementation((data: unknown) => {
        res.jsonData = data
        return res
    })
    return res as unknown as Response & { jsonData: unknown; statusCode: number; set: ReturnType<typeof vi.fn> }
}

function createMockRequest(query: Record<string, string> = {}): Request {
    return { query } as unknown as Request
}

const player1Id = 49312
const player2Id = 2741271

const communityPlayer1 = { id: String(player1Id), btag: 'Alpha#1234', name: 'Alpha' }
const communityPlayer2 = { id: String(player2Id), btag: 'Beta#5678' }

const pairRecord = {
    player1CharacterId: player1Id, // Math.min(49312, 2741271)
    player2CharacterId: player2Id,
    pulseSyncedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago — within 1 hr TTL
    nextCursor: null,
    matches: [
        {
            matchId: 1,
            date: '2026-04-01T10:00:00.000Z',
            map: 'Goldenaura',
            durationSeconds: 300,
            region: 'US',
            type: '1v1',
            winnerCharacterId: player1Id,
            player1RatingChange: 20,
            player2RatingChange: -20,
            player1RatingAtTime: 3500,
            player2RatingAtTime: 3400,
            source: 'pulse' as const,
            isVoided: false,
            matchLabel: null,
        },
        {
            matchId: 2,
            date: '2026-04-05T12:00:00.000Z',
            map: 'Alcyone',
            durationSeconds: 450,
            region: 'US',
            type: '1v1',
            winnerCharacterId: player1Id,
            player1RatingChange: 18,
            player2RatingChange: -18,
            player1RatingAtTime: 3520,
            player2RatingAtTime: 3380,
            source: 'pulse' as const,
            isVoided: false,
            matchLabel: null,
        },
        {
            matchId: 3,
            date: '2026-04-08T15:00:00.000Z',
            map: 'Neohumanity',
            durationSeconds: 600,
            region: 'US',
            type: '1v1',
            winnerCharacterId: player2Id,
            player1RatingChange: -22,
            player2RatingChange: 22,
            player1RatingAtTime: 3498,
            player2RatingAtTime: 3402,
            source: 'pulse' as const,
            isVoided: false,
            matchLabel: null,
        },
    ],
}

const pairRecordWithVoided = {
    ...pairRecord,
    matches: [
        ...pairRecord.matches,
        {
            matchId: 4,
            date: '2026-04-10T09:00:00.000Z',
            map: 'Goldenaura',
            durationSeconds: 200,
            region: 'US',
            type: '1v1',
            winnerCharacterId: player1Id,
            player1RatingChange: null,
            player2RatingChange: null,
            player1RatingAtTime: null,
            player2RatingAtTime: null,
            source: 'manual' as const,
            isVoided: true,
            matchLabel: null,
        },
    ],
}

describe('h2hRoutes', () => {
    let handler: (req: Request, res: Response) => Promise<void>

    beforeEach(async () => {
        vi.resetModules()
        hoisted.loadPairRecordMock.mockReset()
        hoisted.syncPairMock.mockReset()
        hoisted.getCommunityPlayerMock.mockReset()
        hoisted.listFlagsMock.mockReset()
        hoisted.listFlagsMock.mockResolvedValue([])
        hoisted.getTopPairsMock.mockReset()
        hoisted.getPlayerPairsMock.mockReset()
        hoisted.loggerMock.info.mockReset()
        hoisted.loggerMock.error.mockReset()

        const routes = await import('../../routes/h2hRoutes')
        const router = routes.default
        const layer = router.stack?.find((l: any) => l.route?.path === '/h2h')
        handler = layer?.route?.stack?.[0]?.handle
    })

    async function callRoute(query: Record<string, string>) {
        const req = createMockRequest(query)
        const res = createMockResponse()
        await handler(req, res as unknown as Response)
        return res
    }

    describe('GET /h2h — record exists in Drive', () => {
        it('returns H2HResponse with correct summary from caller perspective', async () => {
            hoisted.getCommunityPlayerMock.mockImplementation((id: number) => {
                if (Number(id) === player1Id) return Promise.resolve(communityPlayer1)
                if (Number(id) === player2Id) return Promise.resolve(communityPlayer2)
                return Promise.resolve(null)
            })
            hoisted.loadPairRecordMock.mockResolvedValue(pairRecord)

            const res = await callRoute({
                player1: String(player1Id),
                player2: String(player2Id),
            })

            expect(res.statusCode).toBe(200)
            const body = res.jsonData as Record<string, unknown>
            const summary = body.summary as Record<string, unknown>
            expect(summary.player1Wins).toBe(2)
            expect(summary.player2Wins).toBe(1)
            expect(summary.totalGames).toBe(3)
            expect(summary.lastPlayed).toBe('2026-04-08T15:00:00.000Z')
            expect((body.player1 as Record<string, unknown>).characterId).toBe(player1Id)
            expect((body.player2 as Record<string, unknown>).characterId).toBe(player2Id)
            expect(hoisted.syncPairMock).not.toHaveBeenCalled()
        })

        it('swaps win counts when caller reverses player order', async () => {
            hoisted.getCommunityPlayerMock.mockImplementation((id: number) => {
                if (Number(id) === player1Id) return Promise.resolve(communityPlayer1)
                if (Number(id) === player2Id) return Promise.resolve(communityPlayer2)
                return Promise.resolve(null)
            })
            hoisted.loadPairRecordMock.mockResolvedValue(pairRecord)

            // caller treats player2 as their "player1"
            const res = await callRoute({
                player1: String(player2Id),
                player2: String(player1Id),
            })

            expect(res.statusCode).toBe(200)
            const summary = (res.jsonData as Record<string, unknown>).summary as Record<string, unknown>
            expect(summary.player1Wins).toBe(1)
            expect(summary.player2Wins).toBe(2)
        })
    })

    describe('GET /h2h — unknown player', () => {
        it('returns 404 when player1 is not in the community', async () => {
            hoisted.getCommunityPlayerMock.mockImplementation((id: number) => {
                if (Number(id) === player2Id) return Promise.resolve(communityPlayer2)
                return Promise.resolve(null)
            })

            const res = await callRoute({
                player1: '99999999',
                player2: String(player2Id),
            })

            expect(res.statusCode).toBe(404)
            const body = res.jsonData as Record<string, unknown>
            expect(typeof body.error).toBe('string')
        })

        it('returns 404 when player2 is not in the community', async () => {
            hoisted.getCommunityPlayerMock.mockImplementation((id: number) => {
                if (Number(id) === player1Id) return Promise.resolve(communityPlayer1)
                return Promise.resolve(null)
            })

            const res = await callRoute({
                player1: String(player1Id),
                player2: '99999999',
            })

            expect(res.statusCode).toBe(404)
        })
    })

    describe('GET /h2h — missing or invalid query params', () => {
        it('returns 400 with validation error when player1 is missing', async () => {
            const res = await callRoute({ player2: String(player2Id) })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid query parameters')
            expect(Array.isArray(body.details)).toBe(true)
        })

        it('returns 400 with validation error when player2 is missing', async () => {
            const res = await callRoute({ player1: String(player1Id) })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid query parameters')
        })

        it('returns 400 when player1 is not numeric', async () => {
            const res = await callRoute({ player1: 'abc', player2: String(player2Id) })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid query parameters')
        })
    })

    describe('GET /h2h — no Drive record triggers sync', () => {
        it('calls syncPair and returns response when no existing record found', async () => {
            hoisted.getCommunityPlayerMock.mockImplementation((id: number) => {
                if (Number(id) === player1Id) return Promise.resolve(communityPlayer1)
                if (Number(id) === player2Id) return Promise.resolve(communityPlayer2)
                return Promise.resolve(null)
            })
            hoisted.loadPairRecordMock.mockResolvedValue(null)
            hoisted.syncPairMock.mockResolvedValue(pairRecord)

            const res = await callRoute({
                player1: String(player1Id),
                player2: String(player2Id),
            })

            expect(res.statusCode).toBe(200)
            expect(hoisted.syncPairMock).toHaveBeenCalledWith(player1Id, player2Id)
            const summary = (res.jsonData as Record<string, unknown>).summary as Record<string, unknown>
            expect(summary.player1Wins).toBe(2)
        })
    })

    describe('GET /h2h — void match exclusion', () => {
        it('does not count a voided match in player1Wins', async () => {
            hoisted.getCommunityPlayerMock.mockImplementation((id: number) => {
                if (Number(id) === player1Id) return Promise.resolve(communityPlayer1)
                if (Number(id) === player2Id) return Promise.resolve(communityPlayer2)
                return Promise.resolve(null)
            })
            hoisted.loadPairRecordMock.mockResolvedValue(pairRecordWithVoided)

            const res = await callRoute({
                player1: String(player1Id),
                player2: String(player2Id),
            })

            expect(res.statusCode).toBe(200)
            const summary = (res.jsonData as Record<string, unknown>).summary as Record<string, unknown>
            expect(summary.player1Wins).toBe(2)
            expect(summary.player2Wins).toBe(1)
        })

        it('returns voidedCount equal to the number of voided matches', async () => {
            hoisted.getCommunityPlayerMock.mockImplementation((id: number) => {
                if (Number(id) === player1Id) return Promise.resolve(communityPlayer1)
                if (Number(id) === player2Id) return Promise.resolve(communityPlayer2)
                return Promise.resolve(null)
            })
            hoisted.loadPairRecordMock.mockResolvedValue(pairRecordWithVoided)

            const res = await callRoute({
                player1: String(player1Id),
                player2: String(player2Id),
            })

            const summary = (res.jsonData as Record<string, unknown>).summary as Record<string, unknown>
            expect(summary.voidedCount).toBe(1)
        })

        it('returns voidedCount of 0 when no matches are voided', async () => {
            hoisted.getCommunityPlayerMock.mockImplementation((id: number) => {
                if (Number(id) === player1Id) return Promise.resolve(communityPlayer1)
                if (Number(id) === player2Id) return Promise.resolve(communityPlayer2)
                return Promise.resolve(null)
            })
            hoisted.loadPairRecordMock.mockResolvedValue(pairRecord)

            const res = await callRoute({
                player1: String(player1Id),
                player2: String(player2Id),
            })

            const summary = (res.jsonData as Record<string, unknown>).summary as Record<string, unknown>
            expect(summary.voidedCount).toBe(0)
        })

        it('totalGames includes voided matches', async () => {
            hoisted.getCommunityPlayerMock.mockImplementation((id: number) => {
                if (Number(id) === player1Id) return Promise.resolve(communityPlayer1)
                if (Number(id) === player2Id) return Promise.resolve(communityPlayer2)
                return Promise.resolve(null)
            })
            hoisted.loadPairRecordMock.mockResolvedValue(pairRecordWithVoided)

            const res = await callRoute({
                player1: String(player1Id),
                player2: String(player2Id),
            })

            const summary = (res.jsonData as Record<string, unknown>).summary as Record<string, unknown>
            expect(summary.totalGames).toBe(4)
        })
    })

    describe('GET /h2h/top-pairs', () => {
        let topPairsHandler: (req: Request, res: Response) => Promise<void>

        beforeEach(async () => {
            const routes = await import('../../routes/h2hRoutes')
            const router = routes.default
            const layer = router.stack?.find((l: any) => l.route?.path === '/h2h/top-pairs')
            topPairsHandler = layer?.route?.stack?.[0]?.handle
        })

        async function callTopPairsRoute(query: Record<string, string> = {}) {
            const req = createMockRequest(query)
            const res = createMockResponse()
            await topPairsHandler(req, res as unknown as Response)
            return res
        }

        const samplePairs = [
            {
                player1: { characterId: 49312, btag: 'Alpha#1234', name: 'Alpha' },
                player2: { characterId: 2741271, btag: 'Beta#5678', name: 'Beta' },
                matchCount: 5,
                player1Wins: 3,
                player2Wins: 2,
                lastMatchDate: '2026-04-10T00:00:00Z',
            },
        ]

        it('returns 200 with TopPairEntry[] on valid request', async () => {
            hoisted.getTopPairsMock.mockResolvedValue(samplePairs)

            const res = await callTopPairsRoute()

            expect(res.statusCode).toBe(200)
            expect(res.jsonData).toEqual(samplePairs)
        })

        it('defaults limit to 20 when not provided', async () => {
            hoisted.getTopPairsMock.mockResolvedValue([])

            await callTopPairsRoute()

            expect(hoisted.getTopPairsMock).toHaveBeenCalledWith(20)
        })

        it('passes explicit limit to getTopPairs', async () => {
            hoisted.getTopPairsMock.mockResolvedValue([])

            await callTopPairsRoute({ limit: '5' })

            expect(hoisted.getTopPairsMock).toHaveBeenCalledWith(5)
        })

        it('returns 400 when limit is not numeric', async () => {
            const res = await callTopPairsRoute({ limit: 'abc' })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid query parameters')
        })

        it('returns 400 when limit exceeds 50', async () => {
            const res = await callTopPairsRoute({ limit: '51' })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid query parameters')
        })

        it('returns 400 when limit is 0', async () => {
            const res = await callTopPairsRoute({ limit: '0' })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid query parameters')
        })

        it('sets Cache-Control: public, max-age=3600 on success', async () => {
            hoisted.getTopPairsMock.mockResolvedValue(samplePairs)

            const res = await callTopPairsRoute()

            expect(res.set).toHaveBeenCalledWith('Cache-Control', 'public, max-age=3600')
        })
    })

    describe('GET /h2h/player-pairs', () => {
        let playerPairsHandler: (req: Request, res: Response) => Promise<void>

        beforeEach(async () => {
            const routes = await import('../../routes/h2hRoutes')
            const router = routes.default
            const layer = router.stack?.find((l: any) => l.route?.path === '/h2h/player-pairs')
            playerPairsHandler = layer?.route?.stack?.[0]?.handle
        })

        async function callPlayerPairsRoute(query: Record<string, string> = {}) {
            const req = createMockRequest(query)
            const res = createMockResponse()
            await playerPairsHandler(req, res as unknown as Response)
            return res
        }

        const samplePlayerPairs = [
            {
                player1: { characterId: 49312, btag: 'Alpha#1234', name: 'Alpha' },
                player2: { characterId: 2741271, btag: 'Beta#5678', name: 'Beta' },
                matchCount: 5,
                player1Wins: 3,
                player2Wins: 2,
                lastMatchDate: '2026-04-10T00:00:00Z',
            },
        ]

        it('returns 200 with TopPairEntry[] when player is valid', async () => {
            hoisted.getPlayerPairsMock.mockResolvedValue(samplePlayerPairs)

            const res = await callPlayerPairsRoute({ player: '101' })

            expect(res.statusCode).toBe(200)
            expect(res.jsonData).toEqual(samplePlayerPairs)
            expect(hoisted.getPlayerPairsMock).toHaveBeenCalledWith(101)
        })

        it('returns 200 with [] when player has no recorded pairs', async () => {
            hoisted.getPlayerPairsMock.mockResolvedValue([])

            const res = await callPlayerPairsRoute({ player: '101' })

            expect(res.statusCode).toBe(200)
            expect(res.jsonData).toEqual([])
        })

        it('returns 400 with field-level error when player param is missing', async () => {
            const res = await callPlayerPairsRoute()

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid query parameters')
            expect(Array.isArray(body.details)).toBe(true)
        })

        it('returns 400 when player is non-numeric', async () => {
            const res = await callPlayerPairsRoute({ player: 'abc' })

            expect(res.statusCode).toBe(400)
            const body = res.jsonData as Record<string, unknown>
            expect(body.error).toBe('Invalid query parameters')
        })

        it('returns 500 with { error: "Internal server error" } when getPlayerPairs throws', async () => {
            hoisted.getPlayerPairsMock.mockRejectedValue(new Error('db failure'))

            const res = await callPlayerPairsRoute({ player: '101' })

            expect(res.statusCode).toBe(500)
            expect(res.jsonData).toEqual({ error: 'Internal server error' })
        })
    })
})
