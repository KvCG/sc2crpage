import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../utils/userDataHelper', () => ({
    verifyPlayer: vi.fn(async (player: any) => ({ ...player, verified: true })),
    filterByHighestRatingLast: vi.fn((arr: any[]) => arr),
    verifyChallongeParticipant: vi.fn(async (p: any) => ({
        ...p,
        verified: true,
    })),
}))

vi.mock('../../utils/challongeHelper', () => ({
    addMatchCategory: vi.fn((match: any) => ({ ...match, category: 'Group' })),
    getStandingsData: vi.fn((_info: any, participants: any[]) => [
        { id: participants?.[0]?.id ?? 1, points: 3 },
    ]),
}))

import { formatData } from '../../utils/formatData'

describe('formatData - search', () => {
    it('simplifies player data correctly', async () => {
        const input = [
            {
                leagueMax: 'Diamond',
                ratingMax: 2500,
                totalGamesPlayed: 100,
                currentStats: { winRate: 0.6 },
                members: {
                    character: { id: '123' },
                    account: { battleTag: 'Neo#123' },
                    clan: { tag: 'CR' },
                    zergGamesPlayed: 3,
                    protossGamesPlayed: 5,
                },
            },
        ]

        const result = await formatData(input as any, 'search')
        expect(result).toHaveLength(1)
        const p = result[0] as any
        expect(p.id).toBe('123')
        expect(p.btag).toBe('Neo#123')
        expect(p.clan).toBe('CR')
        expect(p.terranGamesPlayed).toBe(1)
        expect(p.zergGamesPlayed).toBe(3)
        expect(p.protossGamesPlayed).toBe(5)
        expect(p.ratingMax).toBe(2500)
        expect(p.leagueMax).toBe('Diamond')
        expect(p.totalGamesPlayed).toBe(100)
        expect(p.winRate).toBe(0.6)
    })
})

describe('formatData - ranking', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns null for falsy input', async () => {
        const result = await formatData(undefined as any, 'ranking')
        expect(result).toBeNull()
    })

    it('verifies players and sorts by ratingLast desc', async () => {
        const input = [
            { playerCharacterId: 'a', ratingLast: 1200 },
            { playerCharacterId: 'b', ratingLast: 1800 },
            { playerCharacterId: 'c', ratingLast: 1500 },
        ]

        const result = await formatData(input as any, 'ranking')
        expect(result.map((r: any) => r.playerCharacterId)).toEqual([
            'b',
            'c',
            'a',
        ])
        result.forEach((r: any) => expect(r.verified).toBe(true))
    })

    it('handles single object input by wrapping into array', async () => {
        const input = { playerCharacterId: 'solo', ratingLast: 999 }
        const result = await formatData(input as any, 'ranking')
        expect(result).toHaveLength(1)
        expect((result as any)[0].playerCharacterId).toBe('solo')
    })
})

describe('formatData - tournament', () => {
    it('formats info, participants, matches and standings', async () => {
        const data = {
            info: {
                id: 42,
                name: 'Cup',
                url: 'cup',
                description: 'desc',
                state: 'underway',
                progress_meter: 50,
                game_id: 1,
                participants_count: 2,
                start_at: '2024-01-01',
                full_challonge_url: 'https://challonge.com/cup',
                live_image_url: 'img',
                sign_up_url: 'signup',
                pts_for_match_win: 3,
                pts_for_match_tie: 1,
                pts_for_bye: 0,
            },
            participants: [
                {
                    participant: {
                        id: 1,
                        tournament_id: 42,
                        name: 'P1',
                        seed: 1,
                        active: true,
                        final_rank: null,
                        challonge_username: 'u1',
                        challonge_user_id: 11,
                        attached_participatable_portrait_url: 'p1',
                        ordinal_seed: 1,
                    },
                },
                {
                    participant: {
                        id: 2,
                        tournament_id: 42,
                        name: 'P2',
                        seed: 2,
                        active: true,
                        final_rank: null,
                        challonge_username: 'u2',
                        challonge_user_id: 22,
                        attached_participatable_portrait_url: 'p2',
                        ordinal_seed: 2,
                    },
                },
            ],
            matches: [
                {
                    match: {
                        id: 10,
                        tournament_id: 42,
                        state: 'open',
                        player1_id: 1,
                        player2_id: 2,
                        winner_id: null,
                        loser_id: null,
                        identifier: 'A',
                        round: 1,
                        player1_votes: 0,
                        player2_votes: 0,
                        scores_csv: null,
                    },
                },
            ],
        }

        const result = await formatData(data as any, 'tournament')
        expect(result.info).toMatchObject({ id: 42, name: 'Cup', url: 'cup' })
        expect(result.participants).toHaveLength(2)
        expect(result.participants[0]).toMatchObject({
            id: 1,
            tournamentId: 42,
            verified: true,
        })
        expect(result.matches).toHaveLength(1)
        expect(result.matches[0]).toMatchObject({
            id: 10,
            number: 1,
            tournamentId: 42,
            category: 'Group',
        })
        expect(result.standings).toEqual([{ id: 1, points: 3 }])
    })
})
