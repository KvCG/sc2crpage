import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
    mockHttpGet: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    mockReadH2HJsonFile: vi.fn(),
    mockWriteH2HJsonFile: vi.fn(),
    mockSupabaseFrom: vi.fn(),
}))

vi.mock('../../../services/pulseHttpClient', () => ({
    get: hoisted.mockHttpGet,
    endpoints: { characterTeams: 'character-teams', versusCommon: 'versus/common', versusMatches: 'versus/matches' },
}))

vi.mock('../../../logging/logger', () => ({ default: hoisted.mockLogger }))

vi.mock('../../../services/driveFileStorage', () => ({
    DriveFileStorage: {
        readH2HJsonFile: hoisted.mockReadH2HJsonFile,
        writeH2HJsonFile: hoisted.mockWriteH2HJsonFile,
    },
}))

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
        hoisted.mockWriteH2HJsonFile.mockResolvedValue(undefined)
        setupSupabaseSuccess()
    })

    it('creates a new record with 3 matches when Drive has no existing file', async () => {
        hoisted.mockHttpGet
            .mockResolvedValueOnce([PISTOLA_1V1_TEAM])
            .mockResolvedValueOnce([WITHER_1V1_TEAM])
            .mockResolvedValueOnce(VERSUS_COMMON_3_MATCHES)
            // Pagination loop: terminal page — no older matches
            .mockResolvedValueOnce({ result: [], navigation: { before: null, after: null } })
        hoisted.mockReadH2HJsonFile.mockResolvedValue(null)

        const record = await syncPair(49312, 2741271)

        expect(record.matches).toHaveLength(3)
        expect(record.pulseSyncedAt).toBeTruthy()
        expect(record.player1CharacterId).toBe(49312)
        expect(record.player2CharacterId).toBe(2741271)
        expect(record.nextCursor).toBe('2026-03-01T00:00:00Z')
        expect(hoisted.mockWriteH2HJsonFile).toHaveBeenCalledWith('49312-2741271.json', record)
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
        hoisted.mockReadH2HJsonFile.mockResolvedValue(null)

        const record = await syncPair(49312, 2741271)

        // All 5 matches from all 3 pages merged
        expect(record.matches).toHaveLength(5)
        const matchIds = record.matches.map((m) => m.matchId)
        expect(matchIds).toContain(1001)
        expect(matchIds).toContain(1002)
        expect(matchIds).toContain(1003)
        expect(matchIds).toContain(1004)
        expect(matchIds).toContain(1005)
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

    it('appends only new matches when an existing record is in Drive', async () => {
        const existingRecord = {
            player1CharacterId: 49312,
            player2CharacterId: 2741271,
            pulseSyncedAt: '2026-04-01T00:00:00Z',
            nextCursor: null,
            matches: [
                {
                    matchId: 1001,
                    date: '2026-04-01T00:00:00Z',
                    map: 'Ruby Rock LE',
                    durationSeconds: 600,
                    region: 'US',
                    type: '_1V1',
                    winnerCharacterId: 49312,
                    player1RatingChange: 20,
                    player2RatingChange: -17,
                    player1RatingAtTime: 5000,
                    player2RatingAtTime: 4500,
                    source: 'pulse',
                },
            ],
        }

        hoisted.mockHttpGet
            .mockResolvedValueOnce([PISTOLA_1V1_TEAM])
            .mockResolvedValueOnce([WITHER_1V1_TEAM])
            .mockResolvedValueOnce(VERSUS_COMMON_3_MATCHES)
            // Pagination loop: terminal page — no older matches
            .mockResolvedValueOnce({ result: [], navigation: { before: null, after: null } })
        hoisted.mockReadH2HJsonFile.mockResolvedValue(existingRecord)

        const record = await syncPair(49312, 2741271)

        // match 1001 already stored; 1002 and 1003 are new → total 3
        expect(record.matches).toHaveLength(3)
        const ids = record.matches.map((m) => m.matchId)
        expect(ids).toContain(1001)
        expect(ids).toContain(1002)
        expect(ids).toContain(1003)
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
}

describe('persistMatch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hoisted.mockWriteH2HJsonFile.mockResolvedValue(undefined)
        setupSupabaseSuccess()
    })

    it('does not overwrite pulseSyncedAt when a record already exists', async () => {
        const pulseSyncTime = '2026-04-10T12:00:00.000Z'
        hoisted.mockReadH2HJsonFile.mockResolvedValue({
            player1CharacterId: 49312,
            player2CharacterId: 2741271,
            pulseSyncedAt: pulseSyncTime,
            nextCursor: null,
            matches: [],
        })

        await persistMatch(49312, 2741271, BLIZZARD_MATCH)

        const saved = hoisted.mockWriteH2HJsonFile.mock.calls[0][1]
        expect(saved.pulseSyncedAt).toBe(pulseSyncTime)
    })

    it('leaves pulseSyncedAt empty when creating a new record', async () => {
        hoisted.mockReadH2HJsonFile.mockResolvedValue(null)

        await persistMatch(49312, 2741271, BLIZZARD_MATCH)

        const saved = hoisted.mockWriteH2HJsonFile.mock.calls[0][1]
        expect(saved.pulseSyncedAt).toBe('')
    })

    it('does not write when matchId already exists in record', async () => {
        hoisted.mockReadH2HJsonFile.mockResolvedValue({
            player1CharacterId: 49312,
            player2CharacterId: 2741271,
            pulseSyncedAt: '2026-04-10T12:00:00.000Z',
            nextCursor: null,
            matches: [BLIZZARD_MATCH],
        })

        await persistMatch(49312, 2741271, BLIZZARD_MATCH)

        expect(hoisted.mockWriteH2HJsonFile).not.toHaveBeenCalled()
    })

    it('upserts to h2h_matches with correct pair_id and match_id', async () => {
        hoisted.mockReadH2HJsonFile.mockResolvedValue(null)

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

    it('Drive write still completes when Supabase errors in persistMatch', async () => {
        hoisted.mockReadH2HJsonFile.mockResolvedValue(null)
        const errorBuilder = makeSupabaseBuilder({ data: null, error: new Error('db error') })
        hoisted.mockSupabaseFrom.mockReturnValue({ upsert: vi.fn().mockReturnValue(errorBuilder) })

        await persistMatch(49312, 2741271, BLIZZARD_MATCH)

        expect(hoisted.mockWriteH2HJsonFile).toHaveBeenCalled()
    })

    it('logs error but does not throw when Supabase errors in persistMatch', async () => {
        hoisted.mockReadH2HJsonFile.mockResolvedValue(null)
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
        hoisted.mockWriteH2HJsonFile.mockResolvedValue(undefined)
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

    it('Drive write still completes when Supabase upsert errors', async () => {
        const errorBuilder = makeSupabaseBuilder({ data: null, error: new Error('db error') })
        hoisted.mockSupabaseFrom.mockReturnValue({ upsert: vi.fn().mockReturnValue(errorBuilder) })

        await savePairRecord(PAIR_RECORD)

        expect(hoisted.mockWriteH2HJsonFile).toHaveBeenCalledWith('49312-2741271.json', PAIR_RECORD)
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
