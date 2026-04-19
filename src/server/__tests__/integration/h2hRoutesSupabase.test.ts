/**
 * Integration test: GET /api/h2h happy path served from Supabase.
 *
 * Unlike h2hRoutes.test.ts (which mocks h2hService entirely), this test
 * lets the real loadPairRecord run against a mocked Supabase client so
 * we can assert that the Supabase path is exercised end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response } from 'express'

const hoisted = vi.hoisted(() => ({
    mockSupabaseFrom: vi.fn(),
    mockGetCommunityPlayer: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    // Safety: syncPair calls pulseHttpClient; mock prevents real HTTP if stale-check ever triggers
    mockHttpGet: vi.fn(),
}))

// Must be mocked first: prevents the env-var guard in supabaseClient.ts from throwing
vi.mock('../../db/supabaseClient', () => ({
    default: { from: hoisted.mockSupabaseFrom },
}))

vi.mock('../../services/communityDataService', () => ({
    communityDataService: { getCommunityPlayer: hoisted.mockGetCommunityPlayer },
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.mockLogger,
}))

vi.mock('../../services/pulseHttpClient', () => ({
    get: hoisted.mockHttpGet,
    endpoints: {
        characterTeams: 'character-teams',
        versusCommon: 'versus/common',
        versusMatches: 'versus/matches',
    },
}))

vi.mock('../../services/h2hFlagService', () => ({
    listFlags: vi.fn().mockResolvedValue([]),
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

function createMockRequest(query: Record<string, string> = {}): Request {
    return { query } as unknown as Request
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const player1Id = 49312
const player2Id = 2741271

const communityPlayer1 = { id: String(player1Id), btag: 'Alpha#1234', name: 'Alpha' }
const communityPlayer2 = { id: String(player2Id), btag: 'Beta#5678' }

// ---------------------------------------------------------------------------
// Supabase fixtures
// ---------------------------------------------------------------------------

const PAIR_ROW = {
    id: 99,
    player1_character_id: player1Id,
    player2_character_id: player2Id,
    // 5 minutes ago — well within the 1-hour TTL; ensures syncPair is never triggered
    pulse_synced_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    next_cursor: null,
}

const MATCH_ROWS = [
    {
        match_id: '501',
        match_date: '2026-04-10T10:00:00.000Z',
        map_name: 'Goldenaura LE',
        duration_seconds: 320,
        region: 'US',
        match_type: '_1V1',
        winner_character_id: player1Id,
        player1_rating_change: 22,
        player2_rating_change: -22,
        player1_rating: 3600,
        player2_rating: 3500,
        source: 'pulse',
        added_by: null,
    },
    {
        match_id: '502',
        match_date: '2026-04-12T14:00:00.000Z',
        map_name: 'Alcyone LE',
        duration_seconds: 480,
        region: 'US',
        match_type: '_1V1',
        winner_character_id: player2Id,
        player1_rating_change: -18,
        player2_rating_change: 18,
        player1_rating: 3582,
        player2_rating: 3518,
        source: 'pulse',
        added_by: null,
    },
]

// ---------------------------------------------------------------------------
// Supabase mock wiring — mirrors loadPairRecord's query chain exactly
// ---------------------------------------------------------------------------

function setupSupabaseForLoad() {
    hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'h2h_pairs') {
            const builder: Record<string, unknown> = {
                maybeSingle: vi.fn().mockResolvedValue({ data: PAIR_ROW, error: null }),
            }
            builder.select = vi.fn().mockReturnValue(builder)
            builder.eq = vi.fn().mockReturnValue(builder)
            return builder
        }
        if (table === 'h2h_matches') {
            const matchBuilder: Record<string, unknown> = {}
            // loadPairRecord does: .select(...).eq('pair_id', ...) and then awaits the result
            matchBuilder.select = vi.fn().mockReturnValue(matchBuilder)
            matchBuilder.eq = vi.fn().mockReturnValue(
                Promise.resolve({ data: MATCH_ROWS, error: null }),
            )
            return matchBuilder
        }
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /h2h — Supabase happy path', () => {
    let handler: (req: Request, res: Response) => Promise<void>

    beforeEach(async () => {
        vi.resetModules()
        hoisted.mockSupabaseFrom.mockReset()
        hoisted.mockGetCommunityPlayer.mockReset()
        hoisted.mockLogger.info.mockReset()
        hoisted.mockLogger.warn.mockReset()
        hoisted.mockLogger.error.mockReset()

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

    it('returns 200 with match data reconstructed from Supabase', async () => {
        setupSupabaseForLoad()
        hoisted.mockGetCommunityPlayer.mockImplementation((id: number) => {
            if (Number(id) === player1Id) return Promise.resolve(communityPlayer1)
            if (Number(id) === player2Id) return Promise.resolve(communityPlayer2)
            return Promise.resolve(null)
        })

        const res = await callRoute({
            player1: String(player1Id),
            player2: String(player2Id),
        })

        expect(res.statusCode).toBe(200)

        const body = res.jsonData as Record<string, unknown>
        const summary = body.summary as Record<string, unknown>
        const matches = body.matches as Array<Record<string, unknown>>

        // Summary derived from MATCH_ROWS: player1 wins match 501, player2 wins match 502
        expect(summary.totalGames).toBe(2)
        expect(summary.player1Wins).toBe(1)
        expect(summary.player2Wins).toBe(1)
        expect(summary.lastPlayed).toBe('2026-04-12T14:00:00.000Z')

        // Match fields reconstructed from Supabase column names to H2HMatch shape
        expect(matches).toHaveLength(2)
        expect(matches[0].matchId).toBe('501')
        expect(matches[0].map).toBe('Goldenaura LE')
        expect(matches[0].durationSeconds).toBe(320)
        expect(matches[0].winnerCharacterId).toBe(player1Id)
        expect(matches[0].player1RatingChange).toBe(22)
        expect(matches[0].player1RatingAtTime).toBe(3600)
        expect(matches[1].matchId).toBe('502')
        expect(matches[1].map).toBe('Alcyone LE')
        expect(matches[1].winnerCharacterId).toBe(player2Id)

        // Player metadata preserved from community stubs
        const player1Meta = body.player1 as Record<string, unknown>
        const player2Meta = body.player2 as Record<string, unknown>
        expect(player1Meta.characterId).toBe(player1Id)
        expect(player1Meta.btag).toBe('Alpha#1234')
        expect(player1Meta.name).toBe('Alpha')
        expect(player2Meta.characterId).toBe(player2Id)
        expect(player2Meta.btag).toBe('Beta#5678')
    })
})
