/**
 * Integration test: CommunityDataService cold-boot hydration from Supabase.
 *
 * Asserts that calling getCommunityData() on a fresh service instance correctly
 * hydrates all lookup structures from Supabase — with no local ladderCR.csv present.
 *
 * Mock boundaries:
 *   - supabaseClient: stubbed to return fixture rows
 *   - logger: suppressed
 * Everything else (query logic, data mapping, singleton anti-stampede) is real.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Fixtures — representative rows from community_players
// ---------------------------------------------------------------------------

const COMMUNITY_PLAYER_ROWS = [
    {
        character_id: '49312',
        btag: 'Alpha#1234',
        display_name: 'Alpha',
        challonge_id: 'chall-001',
    },
    {
        character_id: '2741271',
        btag: 'Beta#5678',
        display_name: null,
        challonge_id: null,
    },
    {
        character_id: '99999',
        btag: 'Gamma#0001',
        display_name: 'Gamma',
        challonge_id: 'chall-003',
    },
]

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any module import
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
    mockSupabaseFrom: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Prevent the supabaseClient env-var guard from throwing
vi.mock('../../db/supabaseClient', () => ({
    default: { from: hoisted.mockSupabaseFrom },
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.mockLogger,
}))

// Import AFTER mocks are registered
import { CommunityDataService } from '../../services/communityDataService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a fresh, isolated CommunityDataService instance for each test.
 * Bypassing the public singleton avoids state leakage between tests.
 */
function freshService(): CommunityDataService {
    // Access private constructor via cast; justified because we need isolation
    // without exposing a test-only reset API on the production class.
    return Reflect.construct(CommunityDataService, []) as CommunityDataService
}

function setupSupabaseSuccess(rows: typeof COMMUNITY_PLAYER_ROWS) {
    hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'community_players') {
            const builder: Record<string, unknown> = {}
            builder.select = vi.fn().mockResolvedValue({ data: rows, error: null })
            return builder
        }
    })
}

function setupSupabaseError(message: string) {
    hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'community_players') {
            const builder: Record<string, unknown> = {}
            builder.select = vi.fn().mockResolvedValue({ data: null, error: new Error(message) })
            return builder
        }
    })
}

function setupSupabaseEmpty() {
    hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'community_players') {
            const builder: Record<string, unknown> = {}
            builder.select = vi.fn().mockResolvedValue({ data: [], error: null })
            return builder
        }
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommunityDataService — cold-boot hydration from Supabase (no ladderCR.csv)', () => {
    beforeEach(() => {
        hoisted.mockSupabaseFrom.mockReset()
        hoisted.mockLogger.info.mockReset()
        hoisted.mockLogger.warn.mockReset()
        hoisted.mockLogger.error.mockReset()
    })

    it('hydrates players array with all rows from Supabase', async () => {
        setupSupabaseSuccess(COMMUNITY_PLAYER_ROWS)
        const service = freshService()

        const result = await service.getCommunityData()

        expect(result.players).toHaveLength(3)
        expect(result.players.map((player) => player.id)).toEqual(
            expect.arrayContaining(['49312', '2741271', '99999']),
        )
    })

    it('populates playerIds Set for all returned character IDs', async () => {
        setupSupabaseSuccess(COMMUNITY_PLAYER_ROWS)
        const service = freshService()

        const result = await service.getCommunityData()

        expect(result.playerIds.has('49312')).toBe(true)
        expect(result.playerIds.has('2741271')).toBe(true)
        expect(result.playerIds.has('99999')).toBe(true)
        expect(result.playerIds.has('00000')).toBe(false)
    })

    it('builds displayNames Map only for rows with non-null display_name', async () => {
        setupSupabaseSuccess(COMMUNITY_PLAYER_ROWS)
        const service = freshService()

        const result = await service.getCommunityData()

        expect(result.displayNames.get('Alpha#1234')).toBe('Alpha')
        expect(result.displayNames.get('Gamma#0001')).toBe('Gamma')
        // Beta row has display_name: null — must not appear
        expect(result.displayNames.has('Beta#5678')).toBe(false)
    })

    it('builds playerById Map keyed by character_id string', async () => {
        setupSupabaseSuccess(COMMUNITY_PLAYER_ROWS)
        const service = freshService()

        const result = await service.getCommunityData()

        const alpha = result.playerById.get('49312')
        expect(alpha?.btag).toBe('Alpha#1234')
        expect(alpha?.name).toBe('Alpha')
        expect(alpha?.challongeId).toBe('chall-001')

        const beta = result.playerById.get('2741271')
        expect(beta?.btag).toBe('Beta#5678')
        expect(beta?.name).toBeUndefined()
        expect(beta?.challongeId).toBeUndefined()
    })

    it('records loadedAt timestamp reasonably close to now', async () => {
        const before = Date.now()
        setupSupabaseSuccess(COMMUNITY_PLAYER_ROWS)
        const service = freshService()

        const result = await service.getCommunityData()
        const after = Date.now()

        expect(result.loadedAt.getTime()).toBeGreaterThanOrEqual(before)
        expect(result.loadedAt.getTime()).toBeLessThanOrEqual(after)
    })

    it('falls back to empty data when Supabase returns an error', async () => {
        setupSupabaseError('connection refused')
        const service = freshService()

        const result = await service.getCommunityData()

        expect(result.players).toHaveLength(0)
        expect(result.playerIds.size).toBe(0)
        expect(result.displayNames.size).toBe(0)
        expect(result.playerById.size).toBe(0)
        expect(hoisted.mockLogger.error).toHaveBeenCalled()
    })

    it('falls back to empty data when Supabase returns zero rows', async () => {
        setupSupabaseEmpty()
        const service = freshService()

        const result = await service.getCommunityData()

        expect(result.players).toHaveLength(0)
        expect(result.playerIds.size).toBe(0)
        expect(hoisted.mockLogger.warn).toHaveBeenCalled()
    })

    it('anti-stampede: concurrent calls resolve to the same data without double-fetching', async () => {
        setupSupabaseSuccess(COMMUNITY_PLAYER_ROWS)
        const service = freshService()

        const [first, second, third] = await Promise.all([
            service.getCommunityData(),
            service.getCommunityData(),
            service.getCommunityData(),
        ])

        // Supabase should only have been hit once
        expect(hoisted.mockSupabaseFrom).toHaveBeenCalledTimes(1)
        expect(first.players).toHaveLength(3)
        expect(second.players).toHaveLength(3)
        expect(third.players).toHaveLength(3)
    })
})
