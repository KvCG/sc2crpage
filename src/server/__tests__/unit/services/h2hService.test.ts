import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
    mockHttpGet: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    mockSupabaseFrom: vi.fn(),
}))

vi.mock('../../../services/pulseHttpClient', () => ({
    get: hoisted.mockHttpGet,
    endpoints: { characterTeams: 'character-teams', versusCommon: 'versus/common', versusMatches: 'versus/matches' },
}))

vi.mock('../../../logging/logger', () => ({ default: hoisted.mockLogger }))

vi.mock('../../../db/supabaseClient', () => ({
    default: { from: hoisted.mockSupabaseFrom },
}))

import {
    resolveTeamLegacyUid,
    resolveBlizzardProfile,
    H2HResolutionError,
    _clearLegacyUidCache,
    _clearBlizzardProfileCache,
    syncPair,
    persistMatch,
    savePairRecord,
    loadPairRecord,
    getTopPairs,
} from '../../../services/h2hService'

// ---------------------------------------------------------------------------
// Supabase mock helpers
// ---------------------------------------------------------------------------

/**
 * Returns a chainable builder that can be directly awaited (savePairRecord pattern)
 * or chained with .select() (persistMatch pattern). Both resolve to resolveValue.
 */
function makeSupabaseBuilder(resolveValue: Record<string, unknown>) {
    return {
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve(resolveValue).then(onFulfilled, onRejected),
        catch: (onRejected: (e: unknown) => unknown) =>
            Promise.resolve(resolveValue).catch(onRejected),
        finally: (onFinally: () => void) =>
            Promise.resolve(resolveValue).finally(onFinally),
        select: vi.fn().mockResolvedValue(resolveValue),
    }
}

/** Sets up mockSupabaseFrom to succeed for all table calls. */
function setupSupabaseSuccess(pairId = 42) {
    const pairsBuilder = makeSupabaseBuilder({ data: [{ id: pairId }], error: null })
    hoisted.mockSupabaseFrom.mockImplementation(() => ({
        upsert: vi.fn().mockReturnValue(pairsBuilder),
    }))
}

const PISTOLA_1V1_TEAM = { legacyUid: '201-0-1-2.883917.3', league: { queueType: 201, teamType: 0 }, members: [] }
const PISTOLA_2V2_TEAM = { legacyUid: '204-0-1-2.883917.5', league: { queueType: 204, teamType: 0 }, members: [] }
const WITHER_1V1_TEAM  = { legacyUid: '201-0-1-2.1303229.1', league: { queueType: 201, teamType: 0 }, members: [] }
const NON_1V1_TEAM     = { legacyUid: '204-0-1-2.999999.1',  league: { queueType: 204, teamType: 0 }, members: [] }

const PISTOLA_1V1_TEAM_WITH_MEMBER = {
    legacyUid: '201-0-1-2.883917.3',
    league: { queueType: 201, teamType: 0 },
    members: [{ character: { battlenetId: 883917, realm: 1, region: 'US' } }],
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeMatch = (id: number, winnerCharId: number, loserCharId: number) => ({
    match: { id, date: `2026-04-0${id}T00:00:00Z`, type: '_1V1', mapId: 1, region: 'US', duration: 600 },
    map: { id: 1, name: 'Ruby Rock LE' },
    participants: [
        {
            participant: { playerCharacterId: winnerCharId, teamId: 100, decision: 'WIN', ratingChange: 20 },
            teamState: { teamState: { rating: 5000 } },
        },
        {
            participant: { playerCharacterId: loserCharId, teamId: 200, decision: 'LOSS', ratingChange: -17 },
            teamState: { teamState: { rating: 4500 } },
        },
    ],
})

// Pistola (49312) wins 2, Wither (2741271) wins 1 — 3 matches total
const VERSUS_COMMON_3_MATCHES = {
    matches: {
        result: [
            makeMatch(1001, 49312, 2741271),
            makeMatch(1002, 2741271, 49312),
            makeMatch(1003, 49312, 2741271),
        ],
        navigation: { before: '2026-03-01T00:00:00Z', after: null },
    },
}

describe('resolveTeamLegacyUid', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        _clearLegacyUidCache()
    })

    it('returns legacyUid for Pistola (49312)', async () => {
        hoisted.mockHttpGet.mockResolvedValue([PISTOLA_2V2_TEAM, PISTOLA_1V1_TEAM])

        const uid = await resolveTeamLegacyUid(49312)

        expect(uid).toBe('201-0-1-2.883917.3')
    })

    it('returns legacyUid for Wither (2741271)', async () => {
        hoisted.mockHttpGet.mockResolvedValue([WITHER_1V1_TEAM])

        const uid = await resolveTeamLegacyUid(2741271)

        expect(uid).toBe('201-0-1-2.1303229.1')
    })

    it('calls character-teams with the correct characterId param', async () => {
        hoisted.mockHttpGet.mockResolvedValue([PISTOLA_1V1_TEAM])

        await resolveTeamLegacyUid(49312)

        expect(hoisted.mockHttpGet).toHaveBeenCalledWith('character-teams', { characterId: 49312 })
    })

    it('returns cached value on second call without hitting Pulse', async () => {
        hoisted.mockHttpGet.mockResolvedValue([PISTOLA_1V1_TEAM])

        await resolveTeamLegacyUid(49312)
        const uid = await resolveTeamLegacyUid(49312)

        expect(hoisted.mockHttpGet).toHaveBeenCalledTimes(1)
        expect(uid).toBe('201-0-1-2.883917.3')
    })

    it('caches independently per characterId', async () => {
        hoisted.mockHttpGet
            .mockResolvedValueOnce([PISTOLA_1V1_TEAM])
            .mockResolvedValueOnce([WITHER_1V1_TEAM])

        await resolveTeamLegacyUid(49312)
        await resolveTeamLegacyUid(2741271)
        await resolveTeamLegacyUid(49312)
        await resolveTeamLegacyUid(2741271)

        expect(hoisted.mockHttpGet).toHaveBeenCalledTimes(2)
    })

    it('throws H2HResolutionError when player has no 1v1 team', async () => {
        hoisted.mockHttpGet.mockResolvedValue([NON_1V1_TEAM])

        await expect(resolveTeamLegacyUid(9999)).rejects.toBeInstanceOf(H2HResolutionError)
    })

    it('throws H2HResolutionError with characterId in message when no 1v1 team', async () => {
        hoisted.mockHttpGet.mockResolvedValue([])

        await expect(resolveTeamLegacyUid(9999)).rejects.toThrow(
            'No 1v1 team found for characterId 9999'
        )
    })

    it('logs a warning when no 1v1 team is found', async () => {
        hoisted.mockHttpGet.mockResolvedValue([])

        await resolveTeamLegacyUid(9999).catch(() => {})

        expect(hoisted.mockLogger.warn).toHaveBeenCalledWith(
            { feature: 'h2h', characterId: 9999 },
            'No 1v1 team found for characterId'
        )
    })
})

describe('syncPair', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        _clearLegacyUidCache()
        setupSupabaseSuccess()
    })

    it('creates a new record with 3 matches when Drive has no existing file', async () => {
        hoisted.mockHttpGet
            .mockResolvedValueOnce([PISTOLA_1V1_TEAM])
            .mockResolvedValueOnce([WITHER_1V1_TEAM])
            .mockResolvedValueOnce(VERSUS_COMMON_3_MATCHES)
            // Pagination loop: terminal page — no older matches
            .mockResolvedValueOnce({ result: [], navigation: { before: null, after: null } })

        const record = await syncPair(49312, 2741271)

        expect(record.matches).toHaveLength(3)
        expect(record.pulseSyncedAt).toBeTruthy()
        expect(record.player1CharacterId).toBe(49312)
        expect(record.player2CharacterId).toBe(2741271)
        expect(record.nextCursor).toBe('2026-03-01T00:00:00Z')
    })

    it('fetches all 3 pages, merges matches without duplicates, and stores first-page nextCursor', async () => {
        // Page 1 (versus/common): matches 1001, 1002 — cursor points to page 2
        const page1 = {
            matches: {
                result: [makeMatch(1001, 49312, 2741271), makeMatch(1002, 2741271, 49312)],
                navigation: { before: 'cursor-page-2', after: null },
            },
        }
        // Page 2 (versus/matches?before=cursor-page-2): matches 1003, 1004 — cursor points to page 3
        const page2 = {
            result: [makeMatch(1003, 49312, 2741271), makeMatch(1004, 2741271, 49312)],
            navigation: { before: 'cursor-page-3', after: null },
        }
        // Page 3 (versus/matches?before=cursor-page-3): match 1005 — no more pages
        const page3 = {
            result: [makeMatch(1005, 49312, 2741271)],
            navigation: { before: null, after: null },
        }

        hoisted.mockHttpGet
            .mockResolvedValueOnce([PISTOLA_1V1_TEAM])    // character-teams for charId1
            .mockResolvedValueOnce([WITHER_1V1_TEAM])     // character-teams for charId2
            .mockResolvedValueOnce(page1)                 // versus/common
            .mockResolvedValueOnce(page2)                 // versus/matches?before=cursor-page-2
            .mockResolvedValueOnce(page3)                 // versus/matches?before=cursor-page-3

        const record = await syncPair(49312, 2741271)

        // All 5 matches from all 3 pages merged
        expect(record.matches).toHaveLength(5)
        const matchIds = record.matches.map((m) => m.matchId)
        expect(matchIds).toContain('1001')
        expect(matchIds).toContain('1002')
        expect(matchIds).toContain('1003')
        expect(matchIds).toContain('1004')
        expect(matchIds).toContain('1005')
        // No duplicates
        expect(new Set(matchIds).size).toBe(5)
        // nextCursor is from first page (for future incremental syncs)
        expect(record.nextCursor).toBe('cursor-page-2')
        // versusMatches was called twice with correct cursors
        expect(hoisted.mockHttpGet).toHaveBeenCalledWith('versus/matches', {
            team1: '201-0-1-2.883917.3',
            team2: '201-0-1-2.1303229.1',
            before: 'cursor-page-2',
        })
        expect(hoisted.mockHttpGet).toHaveBeenCalledWith('versus/matches', {
            team1: '201-0-1-2.883917.3',
            team2: '201-0-1-2.1303229.1',
            before: 'cursor-page-3',
        })
    })

    it('merges new Pulse matches without duplicating an existing Supabase match', async () => {
        const pairsBuilder = makeSupabaseBuilder({ data: [{ id: 42 }], error: null })
        hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
            if (table === 'h2h_pairs') {
                const readBuilder: Record<string, unknown> = {
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                            id: 42,
                            player1_character_id: 49312,
                            player2_character_id: 2741271,
                            pulse_synced_at: '2026-04-01T00:00:00Z',
                            next_cursor: null,
                        },
                        error: null,
                    }),
                }
                readBuilder.select = vi.fn().mockReturnValue(readBuilder)
                readBuilder.eq = vi.fn().mockReturnValue(readBuilder)
                return { select: vi.fn().mockReturnValue(readBuilder), upsert: vi.fn().mockReturnValue(pairsBuilder) }
            }
            if (table === 'h2h_matches') {
                // Return match 1001 as already stored
                const matchBuilder: Record<string, unknown> = {}
                matchBuilder.select = vi.fn().mockReturnValue(matchBuilder)
                matchBuilder.eq = vi.fn().mockReturnValue(
                    Promise.resolve({
                        data: [{
                            match_id: '1001', // string — matches Supabase TEXT column
                            match_date: '2026-04-01T00:00:00Z',
                            map_name: 'Ruby Rock LE',
                            duration_seconds: 600,
                            region: 'US',
                            match_type: '_1V1',
                            winner_character_id: 49312,
                            player1_rating_change: 20,
                            player2_rating_change: -17,
                            player1_rating: 5000,
                            player2_rating: 4500,
                            source: 'pulse',
                            added_by: null,
                        }],
                        error: null,
                    }),
                )
                return matchBuilder
            }
            return { upsert: vi.fn().mockReturnValue(pairsBuilder) }
        })

        hoisted.mockHttpGet
            .mockResolvedValueOnce([PISTOLA_1V1_TEAM])
            .mockResolvedValueOnce([WITHER_1V1_TEAM])
            .mockResolvedValueOnce(VERSUS_COMMON_3_MATCHES)
            // Pagination loop: terminal page — no older matches
            .mockResolvedValueOnce({ result: [], navigation: { before: null, after: null } })

        const record = await syncPair(49312, 2741271)

        // match 1001 already in Supabase; 1002 and 1003 are new → total 3
        expect(record.matches).toHaveLength(3)
        const ids = record.matches.map((m) => m.matchId)
        expect(ids).toContain('1001')
        expect(ids).toContain('1002')
        expect(ids).toContain('1003')
        // Ensure no duplicates
        expect(new Set(ids).size).toBe(3)
    })
})

describe('resolveBlizzardProfile', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        _clearLegacyUidCache()
        _clearBlizzardProfileCache()
    })

    it('returns profile from members[0].character in Pulse response', async () => {
        hoisted.mockHttpGet.mockResolvedValue([PISTOLA_1V1_TEAM_WITH_MEMBER])

        const profile = await resolveBlizzardProfile(49312)

        expect(profile).toEqual({ profileId: 883917, realmId: 1, regionId: 1, region: 'US' })
    })

    it('throws when teams array is empty', async () => {
        hoisted.mockHttpGet.mockResolvedValue([])

        await expect(resolveBlizzardProfile(49312)).rejects.toThrow(
            'No character data returned by Pulse for characterId 49312'
        )
    })

    it('throws when members[0] has no character field', async () => {
        hoisted.mockHttpGet.mockResolvedValue([
            { legacyUid: '201-0-1-2.883917.3', league: { queueType: 201, teamType: 0 }, members: [{}] },
        ])

        await expect(resolveBlizzardProfile(49312)).rejects.toThrow(
            'No character data returned by Pulse for characterId 49312'
        )
    })

    it('returns cached value on second call without hitting Pulse', async () => {
        hoisted.mockHttpGet.mockResolvedValue([PISTOLA_1V1_TEAM_WITH_MEMBER])

        await resolveBlizzardProfile(49312)
        const profile = await resolveBlizzardProfile(49312)

        expect(hoisted.mockHttpGet).toHaveBeenCalledTimes(1)
        expect(profile.profileId).toBe(883917)
    })
})

const BLIZZARD_MATCH = {
    matchId: 'BZ-1712964000_Ruby_Rock_LE',
    date: '2026-04-12T20:00:00.000Z',
    map: 'Ruby Rock LE',
    durationSeconds: 0,
    region: 'US',
    type: 'CUSTOM',
    winnerCharacterId: 49312,
    player1RatingChange: null,
    player2RatingChange: null,
    player1RatingAtTime: null,
    player2RatingAtTime: null,
    source: 'blizzard' as const,
    isVoided: false,
    matchLabel: null,
}

describe('persistMatch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setupSupabaseSuccess()
    })

    it('does not overwrite pulseSyncedAt when a record already exists', async () => {
        const pulseSyncTime = '2026-04-10T12:00:00.000Z'
        const pairsUpsert = vi.fn().mockReturnValue(makeSupabaseBuilder({ data: [{ id: 42 }], error: null }))
        hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
            if (table === 'h2h_pairs') {
                const readBuilder: Record<string, unknown> = {
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                            id: 42,
                            player1_character_id: 49312,
                            player2_character_id: 2741271,
                            pulse_synced_at: pulseSyncTime,
                            next_cursor: null,
                        },
                        error: null,
                    }),
                }
                readBuilder.select = vi.fn().mockReturnValue(readBuilder)
                readBuilder.eq = vi.fn().mockReturnValue(readBuilder)
                return { select: vi.fn().mockReturnValue(readBuilder), upsert: pairsUpsert }
            }
            if (table === 'h2h_matches') {
                const matchBuilder: Record<string, unknown> = {}
                matchBuilder.select = vi.fn().mockReturnValue(matchBuilder)
                matchBuilder.eq = vi.fn().mockReturnValue(Promise.resolve({ data: [], error: null }))
                return { ...matchBuilder, upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
            }
        })

        await persistMatch(49312, 2741271, BLIZZARD_MATCH)

        expect(pairsUpsert).toHaveBeenCalledWith(
            expect.objectContaining({ pulse_synced_at: pulseSyncTime }),
            expect.any(Object),
        )
    })

    it('leaves pulseSyncedAt empty when creating a new record', async () => {
        const pairsUpsert = vi.fn().mockReturnValue(makeSupabaseBuilder({ data: [{ id: 42 }], error: null }))
        hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
            if (table === 'h2h_pairs') return { upsert: pairsUpsert }
            if (table === 'h2h_matches') return { upsert: vi.fn().mockResolvedValue({ data: null, error: null }) }
        })

        await persistMatch(49312, 2741271, BLIZZARD_MATCH)

        expect(pairsUpsert).toHaveBeenCalledWith(
            expect.objectContaining({ pulse_synced_at: null }),
            expect.any(Object),
        )
    })

    it('does not write when matchId already exists in record', async () => {
        const matchesUpsert = vi.fn()
        hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
            if (table === 'h2h_pairs') {
                const readBuilder: Record<string, unknown> = {
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                            id: 42,
                            player1_character_id: 49312,
                            player2_character_id: 2741271,
                            pulse_synced_at: '2026-04-10T12:00:00.000Z',
                            next_cursor: null,
                        },
                        error: null,
                    }),
                }
                readBuilder.select = vi.fn().mockReturnValue(readBuilder)
                readBuilder.eq = vi.fn().mockReturnValue(readBuilder)
                return { select: vi.fn().mockReturnValue(readBuilder) }
            }
            if (table === 'h2h_matches') {
                const matchBuilder: Record<string, unknown> = {}
                matchBuilder.select = vi.fn().mockReturnValue(matchBuilder)
                matchBuilder.eq = vi.fn().mockReturnValue(
                    Promise.resolve({
                        data: [{
                            match_id: BLIZZARD_MATCH.matchId,
                            match_date: BLIZZARD_MATCH.date,
                            map_name: BLIZZARD_MATCH.map,
                            duration_seconds: BLIZZARD_MATCH.durationSeconds,
                            region: BLIZZARD_MATCH.region,
                            match_type: BLIZZARD_MATCH.type,
                            winner_character_id: BLIZZARD_MATCH.winnerCharacterId,
                            player1_rating_change: null,
                            player2_rating_change: null,
                            player1_rating: null,
                            player2_rating: null,
                            source: 'blizzard',
                            added_by: null,
                        }],
                        error: null,
                    }),
                )
                return { ...matchBuilder, upsert: matchesUpsert }
            }
        })

        await persistMatch(49312, 2741271, BLIZZARD_MATCH)

        expect(matchesUpsert).not.toHaveBeenCalled()
    })

    it('upserts to h2h_matches with correct pair_id and match_id', async () => {
        const pairsBuilder = makeSupabaseBuilder({ data: [{ id: 99 }], error: null })
        const matchesUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
        hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
            if (table === 'h2h_pairs') return { upsert: vi.fn().mockReturnValue(pairsBuilder) }
            if (table === 'h2h_matches') return { upsert: matchesUpsert }
        })

        await persistMatch(49312, 2741271, BLIZZARD_MATCH)

        expect(matchesUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                pair_id: 99,
                match_id: 'BZ-1712964000_Ruby_Rock_LE',
                match_date: BLIZZARD_MATCH.date,
                map_name: BLIZZARD_MATCH.map,
                source: 'blizzard',
            }),
            { onConflict: 'pair_id,match_id' },
        )
    })

    it('logs error but does not throw when Supabase errors in persistMatch', async () => {
        const dbError = new Error('Network error')
        const errorBuilder = makeSupabaseBuilder({ data: null, error: dbError })
        hoisted.mockSupabaseFrom.mockReturnValue({ upsert: vi.fn().mockReturnValue(errorBuilder) })

        await expect(persistMatch(49312, 2741271, BLIZZARD_MATCH)).resolves.toBeUndefined()

        expect(hoisted.mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'h2h', matchId: BLIZZARD_MATCH.matchId }),
            'Supabase upsert failed for h2h_matches',
        )
    })
})

describe('loadPairRecord', () => {
    const PAIR_ROW = {
        id: 42,
        player1_character_id: 49312,
        player2_character_id: 2741271,
        pulse_synced_at: '2026-04-10T00:00:00Z',
        next_cursor: 'cursor-abc',
    }

    const MATCH_ROWS = [
        {
            match_id: '1001',
            match_date: '2026-04-01T00:00:00Z',
            map_name: 'Ruby Rock LE',
            duration_seconds: 600,
            region: 'US',
            match_type: '_1V1',
            winner_character_id: 49312,
            player1_rating_change: 20,
            player2_rating_change: -17,
            player1_rating: 5000,
            player2_rating: 4500,
            source: 'pulse',
            added_by: null,
            is_voided: false,
            match_label: null,
        },
    ]

    function setupSupabaseForLoad(
        pairData: unknown,
        matchData: unknown,
        pairError: unknown = null,
        matchError: unknown = null,
    ) {
        hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
            if (table === 'h2h_pairs') {
                const builder: Record<string, unknown> = {
                    maybeSingle: vi.fn().mockResolvedValue({ data: pairData, error: pairError }),
                }
                builder.select = vi.fn().mockReturnValue(builder)
                builder.eq = vi.fn().mockReturnValue(builder)
                return builder
            }
            if (table === 'h2h_matches') {
                const matchBuilder: Record<string, unknown> = {}
                const awaitable = Promise.resolve({ data: matchData, error: matchError })
                matchBuilder.select = vi.fn().mockReturnValue(matchBuilder)
                matchBuilder.eq = vi.fn().mockReturnValue(awaitable)
                return matchBuilder
            }
        })
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns H2HPairRecord reconstructed from Supabase when pair exists', async () => {
        setupSupabaseForLoad(PAIR_ROW, MATCH_ROWS)

        const record = await loadPairRecord(49312, 2741271)

        expect(record).not.toBeNull()
        expect(record!.player1CharacterId).toBe(49312)
        expect(record!.player2CharacterId).toBe(2741271)
        expect(record!.pulseSyncedAt).toBe('2026-04-10T00:00:00Z')
        expect(record!.nextCursor).toBe('cursor-abc')
        expect(record!.matches).toHaveLength(1)
        expect(record!.matches[0].matchId).toBe('1001')
        expect(record!.matches[0].map).toBe('Ruby Rock LE')
        expect(record!.matches[0].winnerCharacterId).toBe(49312)
    })

    it('returns null when pair is not found in Supabase', async () => {
        setupSupabaseForLoad(null, null)

        const record = await loadPairRecord(49312, 2741271)

        expect(record).toBeNull()
    })

    it('returns null and logs error when Supabase query fails', async () => {
        const dbError = new Error('Connection refused')
        setupSupabaseForLoad(null, null, dbError)

        const record = await loadPairRecord(49312, 2741271)

        expect(hoisted.mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'h2h', err: dbError }),
            'Supabase read failed for h2h pair',
        )
        expect(record).toBeNull()
    })

    it('normalises pair key using min/max regardless of argument order', async () => {
        setupSupabaseForLoad(null, null)

        const record = await loadPairRecord(2741271, 49312)

        expect(record).toBeNull()
    })

    it('maps is_voided: false and match_label: null by default', async () => {
        setupSupabaseForLoad(PAIR_ROW, MATCH_ROWS)

        const record = await loadPairRecord(49312, 2741271)

        expect(record!.matches[0].isVoided).toBe(false)
        expect(record!.matches[0].matchLabel).toBeNull()
    })

    it('maps is_voided: true to isVoided: true', async () => {
        const voidedMatchRows = [{ ...MATCH_ROWS[0], is_voided: true }]
        setupSupabaseForLoad(PAIR_ROW, voidedMatchRows)

        const record = await loadPairRecord(49312, 2741271)

        expect(record!.matches[0].isVoided).toBe(true)
    })

    it('maps match_label: tournament to matchLabel: tournament', async () => {
        const labelledMatchRows = [{ ...MATCH_ROWS[0], match_label: 'tournament' }]
        setupSupabaseForLoad(PAIR_ROW, labelledMatchRows)

        const record = await loadPairRecord(49312, 2741271)

        expect(record!.matches[0].matchLabel).toBe('tournament')
    })
})

describe('savePairRecord', () => {
    const PAIR_RECORD = {
        player1CharacterId: 49312,
        player2CharacterId: 2741271,
        pulseSyncedAt: '2026-04-15T00:00:00Z',
        nextCursor: null,
        matches: [],
    }

    beforeEach(() => {
        vi.clearAllMocks()
        setupSupabaseSuccess()
    })

    it('upserts to h2h_pairs with correct payload', async () => {
        const upsert = vi.fn().mockReturnValue(makeSupabaseBuilder({ data: null, error: null }))
        hoisted.mockSupabaseFrom.mockReturnValue({ upsert })

        await savePairRecord(PAIR_RECORD)

        expect(hoisted.mockSupabaseFrom).toHaveBeenCalledWith('h2h_pairs')
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                player1_character_id: 49312,
                player2_character_id: 2741271,
                pulse_synced_at: '2026-04-15T00:00:00Z',
                next_cursor: null,
            }),
            { onConflict: 'player1_character_id,player2_character_id' },
        )
    })

    it('logs error but does not throw when Supabase upsert errors', async () => {
        const dbError = new Error('Connection refused')
        const errorBuilder = makeSupabaseBuilder({ data: null, error: dbError })
        hoisted.mockSupabaseFrom.mockReturnValue({ upsert: vi.fn().mockReturnValue(errorBuilder) })

        await expect(savePairRecord(PAIR_RECORD)).resolves.toBeUndefined()

        expect(hoisted.mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'h2h', err: dbError }),
            'Supabase upsert failed for h2h_pairs',
        )
    })
})

describe('getTopPairs', () => {
    function setupTopPairs(pairRows: unknown, playerRows: unknown) {
        hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
            if (table === 'h2h_matches') {
                // First query: get pair_ids with non-voided matches
                const pairRowsTyped = pairRows as Array<{ id: number; h2h_matches: Array<{ is_voided: boolean }> }>
                const matchPairIds = (pairRowsTyped ?? [])
                    .filter((p) => p.h2h_matches.some((m) => !m.is_voided))
                    .map((p) => ({ pair_id: p.id }))
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ data: matchPairIds, error: null }),
                    }),
                }
            }
            if (table === 'h2h_pairs') {
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockResolvedValue({ data: pairRows, error: null }),
                    }),
                }
            }
            if (table === 'community_players') {
                return {
                    select: vi.fn().mockReturnValue({
                        in: vi.fn().mockResolvedValue({ data: playerRows, error: null }),
                    }),
                }
            }
        })
    }

    const PLAYERS = [
        { character_id: 49312,  btag: 'Pistola#1234', display_name: 'Pistola' },
        { character_id: 2741271, btag: 'Wither#5678',  display_name: null },
        { character_id: 1111,   btag: 'Alpha#0001',   display_name: 'Alpha' },
        { character_id: 2222,   btag: 'Beta#0002',    display_name: 'Beta' },
    ]

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns pairs sorted by heatScore descending', async () => {
        const pairRows = [
            {
                id: 1,
                player1_character_id: 49312,
                player2_character_id: 2741271,
                h2h_matches: [
                    { winner_character_id: 49312,  match_date: '2026-04-01T00:00:00Z', is_voided: false },
                    { winner_character_id: 2741271, match_date: '2026-04-02T00:00:00Z', is_voided: false },
                ],
            },
            {
                id: 2,
                player1_character_id: 1111,
                player2_character_id: 2222,
                h2h_matches: [
                    { winner_character_id: 1111, match_date: '2026-04-03T00:00:00Z', is_voided: false },
                    { winner_character_id: 1111, match_date: '2026-04-04T00:00:00Z', is_voided: false },
                    { winner_character_id: 2222, match_date: '2026-04-05T00:00:00Z', is_voided: false },
                ],
            },
        ]
        setupTopPairs(pairRows, PLAYERS)

        const result = await getTopPairs(10)

        expect(result).toHaveLength(2)
        expect(result[0].matchCount).toBe(3)
        expect(result[1].matchCount).toBe(2)
    })

    it('derives win split from winner_character_id without a separate query', async () => {
        const pairRows = [
            {
                id: 1,
                player1_character_id: 49312,
                player2_character_id: 2741271,
                h2h_matches: [
                    { winner_character_id: 49312,  match_date: '2026-04-01T00:00:00Z', is_voided: false },
                    { winner_character_id: 49312,  match_date: '2026-04-02T00:00:00Z', is_voided: false },
                    { winner_character_id: 2741271, match_date: '2026-04-03T00:00:00Z', is_voided: false },
                ],
            },
        ]
        setupTopPairs(pairRows, PLAYERS)

        const result = await getTopPairs(10)

        expect(result[0].player1Wins).toBe(2)
        expect(result[0].player2Wins).toBe(1)
        expect(result[0].matchCount).toBe(3)
    })

    it('returns empty array when no pairs have matches', async () => {
        const pairRows = [
            {
                id: 1,
                player1_character_id: 49312,
                player2_character_id: 2741271,
                h2h_matches: [],
            },
        ]
        setupTopPairs(pairRows, PLAYERS)

        const result = await getTopPairs(10)

        expect(result).toEqual([])
    })

    it('returns empty array when h2h_pairs table is empty', async () => {
        setupTopPairs([], PLAYERS)

        const result = await getTopPairs(10)

        expect(result).toEqual([])
    })

    it('excludes voided matches from count and win split', async () => {
        const pairRows = [
            {
                id: 1,
                player1_character_id: 49312,
                player2_character_id: 2741271,
                h2h_matches: [
                    { winner_character_id: 49312,  match_date: '2026-04-01T00:00:00Z', is_voided: false },
                    { winner_character_id: 49312,  match_date: '2026-04-02T00:00:00Z', is_voided: true },
                    { winner_character_id: 2741271, match_date: '2026-04-03T00:00:00Z', is_voided: false },
                ],
            },
        ]
        setupTopPairs(pairRows, PLAYERS)

        const result = await getTopPairs(10)

        expect(result[0].matchCount).toBe(2)
        expect(result[0].player1Wins).toBe(1)
        expect(result[0].player2Wins).toBe(1)
    })

    it('uses display_name when available, falls back to btag split on #', async () => {
        const pairRows = [
            {
                id: 1,
                player1_character_id: 49312,   // has display_name: 'Pistola'
                player2_character_id: 2741271,  // display_name: null → 'Wither'
                h2h_matches: [
                    { winner_character_id: 49312, match_date: '2026-04-01T00:00:00Z', is_voided: false },
                ],
            },
        ]
        setupTopPairs(pairRows, PLAYERS)

        const result = await getTopPairs(10)

        expect(result[0].player1.name).toBe('Pistola')
        expect(result[0].player2.name).toBe('Wither')
        expect(result[0].player2.btag).toBe('Wither#5678')
    })

    it('omits name and uses empty btag when player not in community_players', async () => {
        const pairRows = [
            {
                id: 1,
                player1_character_id: 9999,
                player2_character_id: 2741271,
                h2h_matches: [
                    { winner_character_id: 9999, match_date: '2026-04-01T00:00:00Z', is_voided: false },
                ],
            },
        ]
        // community_players only returns player2
        setupTopPairs(pairRows, [{ character_id: 2741271, btag: 'Wither#5678', display_name: null }])

        const result = await getTopPairs(10)

        expect(result[0].player1.btag).toBe('')
        expect(result[0].player1.name).toBeUndefined()
        expect(result[0].player2.name).toBe('Wither')
    })

    it('respects the limit parameter', async () => {
        const pairRows = Array.from({ length: 5 }, (_, i) => ({
            id: i + 1,
            player1_character_id: 49312,
            player2_character_id: 2741271 + i,
            h2h_matches: Array.from({ length: 5 - i }, (__, j) => ({
                winner_character_id: 49312,
                match_date: `2026-04-0${j + 1}T00:00:00Z`,
                is_voided: false,
            })),
        }))
        setupTopPairs(pairRows, PLAYERS)

        const result = await getTopPairs(3)

        expect(result).toHaveLength(3)
    })

    it('ranks more recent matches higher when match counts are equal', async () => {
        const pairRows = [
            {
                id: 1,
                player1_character_id: 49312,
                player2_character_id: 2741271,
                h2h_matches: [
                    { winner_character_id: 49312, match_date: '2026-04-01T00:00:00Z', is_voided: false },
                ],
            },
            {
                id: 2,
                player1_character_id: 1111,
                player2_character_id: 2222,
                h2h_matches: [
                    { winner_character_id: 1111, match_date: '2026-04-10T00:00:00Z', is_voided: false },
                ],
            },
        ]
        setupTopPairs(pairRows, PLAYERS)

        const result = await getTopPairs(10)

        // Both have matchCount 1; pair id:2 has the later date so comes first
        expect(result[0].player1.characterId).toBe(1111)
        expect(result[1].player1.characterId).toBe(49312)
    })

    describe('heatScore computation', () => {
        beforeEach(() => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2026-04-19T12:00:00Z'))
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('includes heatScore as a finite number on every returned entry', async () => {
            const pairRows = [
                {
                    id: 1,
                    player1_character_id: 49312,
                    player2_character_id: 2741271,
                    h2h_matches: [
                        { winner_character_id: 49312, match_date: '2026-04-01T00:00:00Z', is_voided: false },
                        { winner_character_id: 2741271, match_date: '2026-04-02T00:00:00Z', is_voided: false },
                    ],
                },
            ]
            setupTopPairs(pairRows, PLAYERS)

            const result = await getTopPairs(10)

            expect(result).toHaveLength(1)
            expect(typeof result[0].heatScore).toBe('number')
            expect(isFinite(result[0].heatScore)).toBe(true)
            expect(result[0].heatScore).toBeGreaterThan(0)
        })

        it('pair with 10 recent matches outranks pair with 30 matches played 8 months ago', async () => {
            const yesterday = '2026-04-18T12:00:00Z'
            const eightMonthsAgo = '2025-08-19T12:00:00Z'
            const pairRows = [
                {
                    id: 1,
                    player1_character_id: 49312,
                    player2_character_id: 2741271,
                    // 30 matches, all 8 months ago, stomp series (30-0)
                    h2h_matches: Array.from({ length: 30 }, () => ({
                        winner_character_id: 49312,
                        match_date: eightMonthsAgo,
                        is_voided: false,
                    })),
                },
                {
                    id: 2,
                    player1_character_id: 1111,
                    player2_character_id: 2222,
                    // 10 matches yesterday, perfectly even (5-5)
                    h2h_matches: [
                        ...Array.from({ length: 5 }, () => ({
                            winner_character_id: 1111,
                            match_date: yesterday,
                            is_voided: false,
                        })),
                        ...Array.from({ length: 5 }, () => ({
                            winner_character_id: 2222,
                            match_date: yesterday,
                            is_voided: false,
                        })),
                    ],
                },
            ]
            setupTopPairs(pairRows, PLAYERS)

            const result = await getTopPairs(10)

            expect(result[0].player1.characterId).toBe(1111)
            expect(result[0].heatScore).toBeGreaterThan(result[1].heatScore)
            expect(result[1].player1.characterId).toBe(49312)
        })
    })

    it('logs error and returns empty array when Supabase fails', async () => {
        const dbError = new Error('DB error')
        hoisted.mockSupabaseFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: dbError }),
                in: vi.fn().mockResolvedValue({ data: null, error: dbError }),
            }),
        })

        const result = await getTopPairs(10)

        expect(result).toEqual([])
        expect(hoisted.mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'h2h', err: dbError }),
            'getTopPairs failed',
        )
    })
})
