import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    mockSupabaseFrom: vi.fn(),
    mockGetCommunityPlayer: vi.fn(),
    mockPersistMatch: vi.fn(),
}))

vi.mock('../../../logging/logger', () => ({ default: hoisted.mockLogger }))

vi.mock('../../../db/supabaseClient', () => ({
    default: { from: hoisted.mockSupabaseFrom },
}))

vi.mock('../../../services/communityDataService', () => ({
    communityDataService: { getCommunityPlayer: hoisted.mockGetCommunityPlayer },
}))

vi.mock('../../../services/h2hService', () => ({
    persistMatch: hoisted.mockPersistMatch,
}))

import { confirmPendingMatch, PendingServiceError } from '../../../services/h2hPendingService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal pending match row returned by Supabase for a given reason. */
function makePendingRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 99,
        match_id: 'BZ-1714000000_TestMap',
        match_date: '2026-04-24T00:00:00.000Z',
        map_name: 'TestMap',
        region: 'US',
        candidate_ids: [1, 2, 3, 4],
        raw_decisions: [
            { characterId: 1, decision: 'WIN' },
            { characterId: 2, decision: 'WIN' },
            { characterId: 3, decision: 'LOSS' },
            { characterId: 4, decision: 'LOSS' },
        ],
        reason: '3plus_active_after_dedup',
        active_player_count: 4,
        win_count: 2,
        loss_count: 2,
        observer_count: 0,
        inferred_mode: '2v2',
        reviewed_at: null,
        review_outcome: null,
        ...overrides,
    }
}

function mockSelectSingle(row: unknown) {
    hoisted.mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
            }),
        }),
    })
}

// ---------------------------------------------------------------------------
// TEAM_MATCH guard
// ---------------------------------------------------------------------------

describe('confirmPendingMatch — TEAM_MATCH guard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('throws TEAM_MATCH when reason is 3plus_active_after_dedup', async () => {
        mockSelectSingle(makePendingRow({ reason: '3plus_active_after_dedup' }))

        await expect(confirmPendingMatch(99, 1, 2, 1)).rejects.toMatchObject({
            name: 'PendingServiceError',
            code: 'TEAM_MATCH',
        })
        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
    })

    it('throws TEAM_MATCH when reason is uneven_active_sides', async () => {
        mockSelectSingle(makePendingRow({ reason: 'uneven_active_sides', inferred_mode: 'uneven' }))

        await expect(confirmPendingMatch(99, 1, 2, 1)).rejects.toMatchObject({
            name: 'PendingServiceError',
            code: 'TEAM_MATCH',
        })
        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
    })

    it('does NOT throw TEAM_MATCH for multi_winner (resolvable 1v1)', async () => {
        mockSelectSingle(
            makePendingRow({
                reason: 'multi_winner',
                candidate_ids: [1, 2],
                raw_decisions: [
                    { characterId: 1, decision: 'WIN' },
                    { characterId: 2, decision: 'WIN' },
                ],
                active_player_count: 2,
                win_count: 2,
                loss_count: 0,
                inferred_mode: 'unknown',
            })
        )
        hoisted.mockGetCommunityPlayer.mockResolvedValue({ characterId: 1, name: 'P1' })
        hoisted.mockPersistMatch.mockResolvedValue(undefined)
        // Supabase update after persist
        hoisted.mockSupabaseFrom
            .mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                            data: makePendingRow({
                                reason: 'multi_winner',
                                inferred_mode: 'unknown',
                                candidate_ids: [1, 2],
                                active_player_count: 2,
                                win_count: 2,
                                loss_count: 0,
                            }),
                            error: null,
                        }),
                    }),
                }),
            })
            .mockReturnValueOnce({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null }),
                }),
            })

        // Should not throw TEAM_MATCH — may throw other errors (player lookup) but not the guard
        const err = await confirmPendingMatch(99, 1, 2, 1).catch((e) => e)
        expect(err?.code).not.toBe('TEAM_MATCH')
    })
})
