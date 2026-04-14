import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
    mockHttpGet: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    mockReadH2HJsonFile: vi.fn(),
    mockWriteH2HJsonFile: vi.fn(),
}))

vi.mock('../../../services/pulseHttpClient', () => ({
    get: hoisted.mockHttpGet,
    endpoints: { characterTeams: 'character-teams', versusCommon: 'versus/common' },
}))

vi.mock('../../../logging/logger', () => ({ default: hoisted.mockLogger }))

vi.mock('../../../services/driveFileStorage', () => ({
    DriveFileStorage: {
        readH2HJsonFile: hoisted.mockReadH2HJsonFile,
        writeH2HJsonFile: hoisted.mockWriteH2HJsonFile,
    },
}))

import {
    resolveTeamLegacyUid,
    resolveBlizzardProfile,
    H2HResolutionError,
    _clearLegacyUidCache,
    _clearBlizzardProfileCache,
    syncPair,
    persistMatch,
} from '../../../services/h2hService'

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
    })

    it('creates a new record with 3 matches when Drive has no existing file', async () => {
        hoisted.mockHttpGet
            .mockResolvedValueOnce([PISTOLA_1V1_TEAM])
            .mockResolvedValueOnce([WITHER_1V1_TEAM])
            .mockResolvedValueOnce(VERSUS_COMMON_3_MATCHES)
        hoisted.mockReadH2HJsonFile.mockResolvedValue(null)

        const record = await syncPair(49312, 2741271)

        expect(record.matches).toHaveLength(3)
        expect(record.pulseSyncedAt).toBeTruthy()
        expect(record.player1CharacterId).toBe(49312)
        expect(record.player2CharacterId).toBe(2741271)
        expect(record.nextCursor).toBe('2026-03-01T00:00:00Z')
        expect(hoisted.mockWriteH2HJsonFile).toHaveBeenCalledWith('49312-2741271.json', record)
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
})
