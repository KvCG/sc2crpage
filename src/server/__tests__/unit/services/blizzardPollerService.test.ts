import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const hoisted = vi.hoisted(() => ({
    mockGetCommunityData: vi.fn(),
    mockResolveBlizzardProfile: vi.fn(),
    mockFetchPlayerMatches: vi.fn(),
    mockPersistMatch: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    mockSupabaseFrom: vi.fn(),
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

vi.mock('../../../db/supabaseClient', () => ({
    default: { from: hoisted.mockSupabaseFrom },
}))

import { poll } from '../../../services/blizzardPollerService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a mock Supabase chain for select().eq().maybeSingle() queries.
 */
function makeSelectBuilder(result: { data: unknown; error: unknown }) {
    return {
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue(result),
            }),
        }),
    }
}

/** Returns a mock Supabase chain for upsert() calls. */
function makeUpsertBuilder() {
    return { upsert: vi.fn().mockResolvedValue({ error: null }) }
}

/**
 * Sets up mockSupabaseFrom to dispatch by table name.
 * h2h_matches → Guard 6 dedup (select chain)
 * h2h_pending_matches → staging select chain + upsert chain (alternating)
 */
function setupSupabaseMocks(opts: {
    h2hMatchesResult?: { data: unknown; error: unknown }
    pendingMatchesExisting?: { data: unknown; error: unknown }
    pendingUpsert?: ReturnType<typeof makeUpsertBuilder>
} = {}) {
    const h2hResult = opts.h2hMatchesResult ?? { data: null, error: null }
    const pendingSelect = opts.pendingMatchesExisting ?? { data: null, error: null }
    const upsertBuilder = opts.pendingUpsert ?? makeUpsertBuilder()

    hoisted.mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'h2h_matches') return makeSelectBuilder(h2hResult)
        if (table === 'h2h_pending_matches') {
            // First call → select check; subsequent calls → upsert
            const callCount = (hoisted.mockSupabaseFrom as ReturnType<typeof vi.fn>).mock.calls
                .filter((c: string[]) => c[0] === 'h2h_pending_matches').length
            if (callCount <= 1) return makeSelectBuilder(pendingSelect)
            return upsertBuilder
        }
        return makeSelectBuilder({ data: null, error: null })
    })
}

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
        // Default: no duplicate found in h2h_matches; h2h_pending_matches not confirmed
        setupSupabaseMocks()
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

    it('scenario: Tie+Tie custom match — lossCount=0, Guard 4 skips it', async () => {
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Tie', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Tie', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
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

    it('scenario: 3 community players — Win+Win+Loss triggers multi_winner staging, persistMatch not called', async () => {
        const THIRD_ID = 8459434 // e.g. Dark
        const THIRD_PROFILE = { profileId: 999, realmId: 1, regionId: 1, region: 'US' }

        // Extend community data to include a third player
        hoisted.mockGetCommunityData.mockResolvedValue({
            players: [
                { id: String(PISTOLA_ID), btag: 'Pistola#1234' },
                { id: String(WITHER_ID), btag: 'Wither#5678' },
                { id: String(THIRD_ID), btag: 'Dark#1749' },
            ],
            playerIds: new Set([String(PISTOLA_ID), String(WITHER_ID), String(THIRD_ID)]),
        })
        hoisted.mockResolveBlizzardProfile
            .mockResolvedValueOnce(US_PROFILE)    // Pistola
            .mockResolvedValueOnce(US_PROFILE2)   // Wither
            .mockResolvedValueOnce(THIRD_PROFILE) // Dark

        // All three share the same timestamp+map+type — Win+Win+Loss
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])

        // Track upsert calls on h2h_pending_matches
        const upsertSpy = vi.fn().mockResolvedValue({ error: null })
        setupSupabaseMocks({ pendingUpsert: { upsert: upsertSpy } })

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
        expect(upsertSpy).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'multi_winner' }),
            expect.any(Object)
        )
    })

    it('scenario: Ruby Rock LE — Dark=Obs, Tomahawk=Obs, Spark=Win, Kerverus=Loss → lossCount=1 → Spark vs Kerverus persisted', async () => {
        const DARK_ID = 8459434
        const TOMAHAWK_ID = 25351639
        const SPARK_ID = 12345678
        const KERVERUS_ID = 87654321

        hoisted.mockGetCommunityData.mockResolvedValue({
            players: [
                { id: String(DARK_ID), btag: 'Dark#1749' },
                { id: String(TOMAHAWK_ID), btag: 'Tomahawkcr#1710' },
                { id: String(SPARK_ID), btag: 'Spark#1234' },
                { id: String(KERVERUS_ID), btag: 'Kerverus#5678' },
            ],
            playerIds: new Set([String(DARK_ID), String(TOMAHAWK_ID), String(SPARK_ID), String(KERVERUS_ID)]),
        })
        hoisted.mockResolveBlizzardProfile
            .mockResolvedValueOnce({ profileId: 100, realmId: 1, regionId: 1, region: 'US' }) // Dark
            .mockResolvedValueOnce({ profileId: 200, realmId: 1, regionId: 1, region: 'US' }) // Tomahawk
            .mockResolvedValueOnce({ profileId: 300, realmId: 1, regionId: 1, region: 'US' }) // Spark
            .mockResolvedValueOnce({ profileId: 400, realmId: 1, regionId: 1, region: 'US' }) // Kerverus

        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Observer', speed: 'Faster', date: SHARED_TIMESTAMP }]) // Dark
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Observer', speed: 'Faster', date: SHARED_TIMESTAMP }]) // Tomahawk
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP }])     // Spark
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP }])    // Kerverus

        await poll()

        expect(hoisted.mockPersistMatch).toHaveBeenCalledTimes(1)
        const [charId1, charId2, match] = hoisted.mockPersistMatch.mock.calls[0]
        expect([charId1, charId2].sort()).toEqual([SPARK_ID, KERVERUS_ID].sort())
        expect(match.winnerCharacterId).toBe(SPARK_ID)
        expect(match.source).toBe('blizzard')
    })

    it('scenario: 2-loss bucket (both players have Loss) — lossCount=2, Guard 4 kills it', async () => {
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
    })

    it.each([
        ['Win', 'Win', 'teammates in a 2v2'],
        ['Win', 'Observer', 'solo BO practice — observer false correlation'],
        ['Win', 'Left', 'someone disconnected before result'],
        ['Win', 'Disagree', 'desync / result disputed'],
        ['Observer', 'Observer', 'both players were spectating'],
    ])(
        'scenario: %s + %s decisions (%s) — not a valid 1v1, persistMatch not called',
        async (d1, d2) => {
            hoisted.mockFetchPlayerMatches
                .mockResolvedValueOnce([
                    { map: SHARED_MAP, type: SHARED_TYPE, decision: d1, speed: 'Faster', date: SHARED_TIMESTAMP },
                ])
                .mockResolvedValueOnce([
                    { map: SHARED_MAP, type: SHARED_TYPE, decision: d2, speed: 'Faster', date: SHARED_TIMESTAMP },
                ])

            await poll()

            expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
        }
    )

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

    it('Guard 6 — matchId already in h2h_matches for another pair → persistMatch not called, debug logged', async () => {
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])

        // Simulate matchId already stored for a different pair (pair_id = 99)
        setupSupabaseMocks({ h2hMatchesResult: { data: { id: 1, pair_id: 99 }, error: null } })

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
        expect(hoisted.mockLogger.debug).toHaveBeenCalledWith(
            expect.objectContaining({
                feature: 'blizzard-poller',
                matchId: `BZ-${SHARED_TIMESTAMP}_Ruby_Rock_LE`,
                existingPairId: 99,
            }),
            expect.any(String)
        )
    })

    it('Guard 6 — unique matchId (no existing row) → persistMatch called normally', async () => {
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
            .mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP },
            ])

        // Default mock already returns { data: null } — no existing row

        await poll()

        expect(hoisted.mockPersistMatch).toHaveBeenCalledTimes(1)
    })

    it('regression Apr 23 — round-robin: Dark=Win, Kerverus=Obs, Spark=Loss persisted; Tomahawk absent from bucket', async () => {
        // Before T1 fix, resolveBlizzardProfile(TOMAHAWK_ID) returned Dark's battlenetId (611074)
        // because Dark was members[0] in Tomahawk's 2v2 team. This caused Tomahawk to fetch Dark's
        // match history and appear in the same bucket as Dark, inflating lossCount and corrupting
        // the result. After T1, each player resolves to their own battlenetId.
        const DARK_ID = 8459434       // battlenetId=611074
        const KERVERUS_ID = 87654321
        const SPARK_ID = 12345678
        const TOMAHAWK_ID = 25351639  // battlenetId=2347183 (own — distinct from Dark's)

        const WINTER_TIMESTAMP = 1745408400
        const WINTER_MAP = 'Winter Madness LE'

        hoisted.mockGetCommunityData.mockResolvedValue({
            players: [
                { id: String(DARK_ID),     btag: 'Dark#1749' },
                { id: String(KERVERUS_ID), btag: 'Kerverus#5678' },
                { id: String(SPARK_ID),    btag: 'Spark#1234' },
                { id: String(TOMAHAWK_ID), btag: 'Tomahawkcr#1710' },
            ],
            playerIds: new Set([String(DARK_ID), String(KERVERUS_ID), String(SPARK_ID), String(TOMAHAWK_ID)]),
        })

        // T1 fix: each player resolves to their own profile — Tomahawk gets battlenetId=2347183,
        // not Dark's 611074.
        hoisted.mockResolveBlizzardProfile.mockReset()
        hoisted.mockResolveBlizzardProfile
            .mockResolvedValueOnce({ profileId: 611074,  realmId: 1, regionId: 1, region: 'US' }) // Dark (own)
            .mockResolvedValueOnce({ profileId: 500000,  realmId: 1, regionId: 1, region: 'US' }) // Kerverus
            .mockResolvedValueOnce({ profileId: 600000,  realmId: 1, regionId: 1, region: 'US' }) // Spark
            .mockResolvedValueOnce({ profileId: 2347183, realmId: 1, regionId: 1, region: 'US' }) // Tomahawk (own)

        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([{ map: WINTER_MAP, type: SHARED_TYPE, decision: 'Win',      speed: 'Faster', date: WINTER_TIMESTAMP }]) // Dark
            .mockResolvedValueOnce([{ map: WINTER_MAP, type: SHARED_TYPE, decision: 'Observer', speed: 'Faster', date: WINTER_TIMESTAMP }]) // Kerverus
            .mockResolvedValueOnce([{ map: WINTER_MAP, type: SHARED_TYPE, decision: 'Loss',     speed: 'Faster', date: WINTER_TIMESTAMP }]) // Spark
            .mockResolvedValueOnce([]) // Tomahawk — distinct profile, no shared game in history

        await poll()

        // Bucket after Observer filter: Dark(Win) + Spark(Loss) → lossCount=1 → persisted
        expect(hoisted.mockPersistMatch).toHaveBeenCalledTimes(1)
        const [charId1, charId2, match] = hoisted.mockPersistMatch.mock.calls[0]
        expect([charId1, charId2].sort()).toEqual([DARK_ID, SPARK_ID].sort())
        expect(match.winnerCharacterId).toBe(DARK_ID)
        expect(match.map).toBe(WINTER_MAP)
        expect(match.source).toBe('blizzard')
    })

    // ── Staging tests ─────────────────────────────────────────────────────────

    it('staging: Win+Win+Loss+Loss (4-player 2v2) → staged as 3plus_active_after_dedup, inferredMode 2v2', async () => {
        const IDS = [PISTOLA_ID, WITHER_ID, 1111111, 2222222]
        hoisted.mockGetCommunityData.mockResolvedValue({
            players: IDS.map((id, i) => ({ id: String(id), btag: `Player${i}#1234` })),
            playerIds: new Set(IDS.map(String)),
        })
        hoisted.mockResolveBlizzardProfile.mockReset()
        IDS.forEach(() =>
            hoisted.mockResolveBlizzardProfile.mockResolvedValueOnce({ profileId: Math.random(), realmId: 1, regionId: 1, region: 'US' })
        )
        const decisions = ['Win', 'Win', 'Loss', 'Loss']
        decisions.forEach((d) =>
            hoisted.mockFetchPlayerMatches.mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: d, speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
        )

        const upsertSpy = vi.fn().mockResolvedValue({ error: null })
        setupSupabaseMocks({ pendingUpsert: { upsert: upsertSpy } })

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
        expect(upsertSpy).toHaveBeenCalledWith(
            expect.objectContaining({ reason: '3plus_active_after_dedup', inferred_mode: '2v2' }),
            expect.any(Object)
        )
    })

    it('staging: Win+Win+Win+Loss+Loss (5-player) → staged as uneven_active_sides, inferredMode uneven', async () => {
        const IDS = [PISTOLA_ID, WITHER_ID, 1111111, 2222222, 3333333]
        hoisted.mockGetCommunityData.mockResolvedValue({
            players: IDS.map((id, i) => ({ id: String(id), btag: `Player${i}#1234` })),
            playerIds: new Set(IDS.map(String)),
        })
        hoisted.mockResolveBlizzardProfile.mockReset()
        IDS.forEach(() =>
            hoisted.mockResolveBlizzardProfile.mockResolvedValueOnce({ profileId: Math.random(), realmId: 1, regionId: 1, region: 'US' })
        )
        const decisions = ['Win', 'Win', 'Win', 'Loss', 'Loss']
        decisions.forEach((d) =>
            hoisted.mockFetchPlayerMatches.mockResolvedValueOnce([
                { map: SHARED_MAP, type: SHARED_TYPE, decision: d, speed: 'Faster', date: SHARED_TIMESTAMP },
            ])
        )

        const upsertSpy = vi.fn().mockResolvedValue({ error: null })
        setupSupabaseMocks({ pendingUpsert: { upsert: upsertSpy } })

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
        expect(upsertSpy).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'uneven_active_sides', inferred_mode: 'uneven' }),
            expect.any(Object)
        )
    })

    it('staging: confirmed pending row is never overwritten', async () => {
        const THIRD_ID = 8459434
        hoisted.mockGetCommunityData.mockResolvedValue({
            players: [
                { id: String(PISTOLA_ID), btag: 'Pistola#1234' },
                { id: String(WITHER_ID), btag: 'Wither#5678' },
                { id: String(THIRD_ID), btag: 'Dark#1749' },
            ],
            playerIds: new Set([String(PISTOLA_ID), String(WITHER_ID), String(THIRD_ID)]),
        })
        hoisted.mockResolveBlizzardProfile.mockReset()
        hoisted.mockResolveBlizzardProfile
            .mockResolvedValueOnce(US_PROFILE)
            .mockResolvedValueOnce(US_PROFILE2)
            .mockResolvedValueOnce({ profileId: 999, realmId: 1, regionId: 1, region: 'US' })
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP }])
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP }])
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP }])

        // pending row already confirmed
        const upsertSpy = vi.fn().mockResolvedValue({ error: null })
        setupSupabaseMocks({
            pendingMatchesExisting: { data: { match_id: `BZ-${SHARED_TIMESTAMP}_Ruby_Rock_LE`, review_outcome: 'confirmed' }, error: null },
            pendingUpsert: { upsert: upsertSpy },
        })

        await poll()

        expect(upsertSpy).not.toHaveBeenCalled()
        expect(hoisted.mockLogger.debug).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'blizzard-poller', matchId: `BZ-${SHARED_TIMESTAMP}_Ruby_Rock_LE` }),
            expect.stringContaining('confirmed')
        )
    })

    it('staging: Loss+Loss (no WIN) — not staged, simple skip', async () => {
        const upsertSpy = vi.fn().mockResolvedValue({ error: null })
        setupSupabaseMocks({ pendingUpsert: { upsert: upsertSpy } })

        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP }])
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP }])

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
        expect(upsertSpy).not.toHaveBeenCalled()
    })

    it('staging: Win+Win+Win (3-player all-WIN) → staged as 3plus_active_after_dedup, inferredMode ffa', async () => {
        const THIRD_ID = 8459434
        hoisted.mockGetCommunityData.mockResolvedValue({
            players: [
                { id: String(PISTOLA_ID), btag: 'Pistola#1234' },
                { id: String(WITHER_ID), btag: 'Wither#5678' },
                { id: String(THIRD_ID), btag: 'Dark#1749' },
            ],
            playerIds: new Set([String(PISTOLA_ID), String(WITHER_ID), String(THIRD_ID)]),
        })
        hoisted.mockResolveBlizzardProfile.mockReset()
        hoisted.mockResolveBlizzardProfile
            .mockResolvedValueOnce(US_PROFILE)
            .mockResolvedValueOnce(US_PROFILE2)
            .mockResolvedValueOnce({ profileId: 999, realmId: 1, regionId: 1, region: 'US' })
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP }])
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP }])
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Win', speed: 'Faster', date: SHARED_TIMESTAMP }])

        const upsertSpy = vi.fn().mockResolvedValue({ error: null })
        setupSupabaseMocks({ pendingUpsert: { upsert: upsertSpy } })

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
        expect(upsertSpy).toHaveBeenCalledWith(
            expect.objectContaining({ reason: '3plus_active_after_dedup', inferred_mode: 'ffa' }),
            expect.any(Object)
        )
    })

    it('staging: Loss+Loss+Loss (3-player all-LOSS) → staged as 3plus_active_after_dedup, inferredMode ffa', async () => {
        const THIRD_ID = 8459434
        hoisted.mockGetCommunityData.mockResolvedValue({
            players: [
                { id: String(PISTOLA_ID), btag: 'Pistola#1234' },
                { id: String(WITHER_ID), btag: 'Wither#5678' },
                { id: String(THIRD_ID), btag: 'Dark#1749' },
            ],
            playerIds: new Set([String(PISTOLA_ID), String(WITHER_ID), String(THIRD_ID)]),
        })
        hoisted.mockResolveBlizzardProfile.mockReset()
        hoisted.mockResolveBlizzardProfile
            .mockResolvedValueOnce(US_PROFILE)
            .mockResolvedValueOnce(US_PROFILE2)
            .mockResolvedValueOnce({ profileId: 999, realmId: 1, regionId: 1, region: 'US' })
        hoisted.mockFetchPlayerMatches
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP }])
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP }])
            .mockResolvedValueOnce([{ map: SHARED_MAP, type: SHARED_TYPE, decision: 'Loss', speed: 'Faster', date: SHARED_TIMESTAMP }])

        const upsertSpy = vi.fn().mockResolvedValue({ error: null })
        setupSupabaseMocks({ pendingUpsert: { upsert: upsertSpy } })

        await poll()

        expect(hoisted.mockPersistMatch).not.toHaveBeenCalled()
        expect(upsertSpy).toHaveBeenCalledWith(
            expect.objectContaining({ reason: '3plus_active_after_dedup', inferred_mode: 'ffa' }),
            expect.any(Object)
        )
    })
})
