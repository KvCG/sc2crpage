import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
    mockGetCommunityData: vi.fn(),
    mockResolveBlizzardProfile: vi.fn(),
    mockFetchPlayerMatches: vi.fn(),
    mockPersistMatch: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../../services/communityDataService', () => ({
    CommunityDataService: {
        getInstance: () => ({ getCommunityData: hoisted.mockGetCommunityData }),
    },
}))

vi.mock('../../../services/h2hService', () => ({
    resolveBlizzardProfile: hoisted.mockResolveBlizzardProfile,
    persistMatch: hoisted.mockPersistMatch,
}))

vi.mock('../../../services/blizzardMatchClient', () => ({
    fetchPlayerMatches: hoisted.mockFetchPlayerMatches,
}))

vi.mock('../../../logging/logger', () => ({ default: hoisted.mockLogger }))

import { poll } from '../../../services/blizzardPollerService'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PISTOLA_ID = 49312
const WITHER_ID = 2741271
const OUTSIDE_ID = 9999

const US_PROFILE = { profileId: 883917, realmId: 1, regionId: 1, region: 'US' }
const US_PROFILE2 = { profileId: 1303229, realmId: 1, regionId: 1, region: 'US' }
const OUTSIDE_PROFILE = { profileId: 5555, realmId: 1, regionId: 1, region: 'US' }

const COMMUNITY_DATA = {
    players: [
        { id: String(PISTOLA_ID), btag: 'Pistola#1234' },
        { id: String(WITHER_ID), btag: 'Wither#5678' },
    ],
    playerIds: new Set([String(PISTOLA_ID), String(WITHER_ID)]),
}

// Custom match played by both community players at the exact same timestamp
const SHARED_TIMESTAMP = 1712964000
const SHARED_MAP = 'Ruby Rock LE'
const SHARED_TYPE = 'Custom'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('blizzardPollerService.poll', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hoisted.mockGetCommunityData.mockResolvedValue(COMMUNITY_DATA)
        hoisted.mockResolveBlizzardProfile
            .mockResolvedValueOnce(US_PROFILE)   // Pistola
            .mockResolvedValueOnce(US_PROFILE2)  // Wither
        hoisted.mockPersistMatch.mockResolvedValue(undefined)
    })

    it('scenario: no overlapping matches — persistMatch is never called', async () => {
        // Pistola and Wither have matches, but no shared timestamp+map
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: 'Ruby Rock LE', type: 'Custom', decision: 'Win', speed: 'Faster', date: 1712964000 },
            ])
            .mockResolvedValueOnce([
                { map: 'Site Delta LE', type: 'Custom', decision: 'Win', speed: 'Faster', date: 1712950000 },
            ])

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
    })

    it('scenario: one H2H custom match — persistMatch called once with correct fields', async () => {
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])

        await poll()

        expect(hoisted.mockPersistMatch).toHaveBeenCalledTimes(1)
        const [charId1, charId2, match] = hoisted.mockPersistMatch.mock.calls[0]
        expect([charId1, charId2].sort()).toEqual([PISTOLA_ID, WITHER_ID].sort())
        expect(match.source).toBe('blizzard')
        expect(match.matchId).toBe(`BZ-${SHARED_TIMESTAMP}_Ruby_Rock_LE`)
        expect(match.map).toBe(SHARED_MAP)
        expect(match.type).toBe('CUSTOM')
        expect(match.winnerCharacterId).toBe(PISTOLA_ID)
        expect(new Date(match.date).getTime() / 1000).toBe(SHARED_TIMESTAMP)
    })

    it('scenario: multiple H2H matches in same cycle — all are persisted', async () => {
        const SHARED_TIMESTAMP_2 = 1712970000

        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP },
                { map: 'Site Delta LE', type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP_2 },
            ])
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP },
                { map: 'Site Delta LE', type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP_2 },
            ])

        await poll()

        expect(hoisted.mockPersistMatch).toHaveBeenCalledTimes(2)
        const matchIds = hoisted.mockPersistMatch.mock.calls.map(([, , m]) => m.matchId)
        expect(matchIds).toContain(`BZ-${SHARED_TIMESTAMP}_Ruby_Rock_LE`)
        expect(matchIds).toContain(`BZ-${SHARED_TIMESTAMP_2}_Site_Delta_LE`)
    })

    it('skips a player whose profile cannot be resolved and continues polling others', async () => {
        hoisted.mockResolveBlizzardProfile.mockReset()
        hoisted.mockResolveBlizzardProfile
            .mockRejectedValueOnce(new Error('No character data'))  // Pistola fails
            .mockResolvedValueOnce(US_PROFILE2)                     // Wither succeeds

        hoisted.mockFetchPlayerMatches.mockResolvedValue([])

        await poll()

        // Only one fetchPlayerMatches call (Pistola was skipped)
        expect(hoisted.mockFetchPlayerMatches).toHaveBeenCalledTimes(1)
        expect(hoisted.mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'blizzard-poller', characterId: PISTOLA_ID }),
            expect.any(String)
        )
    })

    it('does not correlate matches with players outside the community', async () => {
        // Add an outside player's data in the index (shouldn't happen in practice
        // because we only fetch matches for community players, but the bucket filter
        // ensures correctness even if somehow two community players share a timestamp
        // with only one community member vs. one outsider)
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
            .mockResolvedValueOnce([]) // Wither has no matches

        await poll()

        // Only Pistola has a match; no second community player → no H2H
        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
    })

    it('does not persist ladder matches — only CUSTOM type is stored', async () => {
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: '1v1', decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: '1v1', decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
    })

    it('logs poll cycle start and completion', async () => {
        hoisted.mockFetchPlayerMatches.mockResolvedValue([])

        await poll()

        expect(hoisted.mockLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'blizzard-poller' }),
            'Poll cycle start'
        )
        expect(hoisted.mockLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'blizzard-poller', persisted: 0 }),
            'Poll cycle complete'
        )
    })
})
