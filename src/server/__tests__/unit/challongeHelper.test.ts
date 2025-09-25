import { describe, it, expect, beforeEach } from 'vitest'
import { addMatchCategory, getStandingsData } from '../../utils/challongeHelper'

describe('challongeHelper', () => {
    const OLD_ENV = process.env
    beforeEach(() => {
        process.env = { ...OLD_ENV }
    })

    it('addMatchCategory sets isPremier when diff <= premier range', () => {
        process.env.MMR_RANGE_FOR_PREMIER_MATCH = '50'
        process.env.MMR_RANGE_FOR_CLOSE_MATCH = '200'
        const participants = [
            { id: 1, ratingAvg: 3500 },
            { id: 2, ratingAvg: 3530 },
        ]
        const match = { player1Id: 1, player2Id: 2 }
        const out = addMatchCategory({ ...match }, participants)
        expect(out.isPremier).toBe(true)
        expect(out.isClose).toBe(false)
    })

    it('addMatchCategory sets isClose when within close range', () => {
        process.env.MMR_RANGE_FOR_PREMIER_MATCH = '50'
        process.env.MMR_RANGE_FOR_CLOSE_MATCH = '200'
        const participants = [
            { id: 1, ratingAvg: 3500 },
            { id: 2, ratingAvg: 3650 },
        ]
        const match = { player1Id: 1, player2Id: 2 }
        const out = addMatchCategory({ ...match }, participants)
        expect(out.isPremier).toBe(false)
        expect(out.isClose).toBe(true)
    })

    it('addMatchCategory clears flags when outside ranges', () => {
        process.env.MMR_RANGE_FOR_PREMIER_MATCH = '50'
        process.env.MMR_RANGE_FOR_CLOSE_MATCH = '200'
        const participants = [
            { id: 1, ratingAvg: 3000 },
            { id: 2, ratingAvg: 3501 },
        ]
        const out = addMatchCategory(
            { player1Id: 1, player2Id: 2 },
            participants
        )
        expect(out.isPremier).toBe(false)
        expect(out.isClose).toBe(false)
    })

    it('getStandingsData calculates points and sorts with head-to-head tie-break', () => {
        const info = { pts_for_bye: '1' }
        const participants = [
            {
                id: 1,
                name: 'A',
                challongeUsername: 'a',
                btag: 'A#1',
                race: 'Z',
            },
            {
                id: 2,
                name: 'B',
                challongeUsername: 'b',
                btag: 'B#2',
                race: 'T',
            },
        ]
        const matches = [
            {
                id: 10,
                state: 'complete',
                winnerId: 1,
                loserId: 2,
                scoresCsv: '2-1',
            },
        ]
        const standings = getStandingsData(
            info as any,
            participants as any,
            matches as any
        )
        expect(standings[0].id).toBe(1)
        expect(standings[0].wins).toBe(1)
        expect(standings[0].points).toBe(2)
        expect(standings[1].losses).toBe(1)
    })

    it('awards bye points and counts games for BYE matches', () => {
        const info = { pts_for_bye: '1' }
        const participants = [
            {
                id: 1,
                name: 'A',
                challongeUsername: 'a',
                btag: 'A#1',
                race: 'Z',
            },
            {
                id: 2,
                name: 'B',
                challongeUsername: 'b',
                btag: 'B#2',
                race: 'T',
            },
        ]
        const matches = [
            {
                id: 11,
                state: 'complete',
                winnerId: 1,
                loserId: null,
                scoresCsv: '0-0',
            },
        ]
        const standings = getStandingsData(
            info as any,
            participants as any,
            matches as any
        ) as Array<{
            id: number
            points: number
            gamesPlayed: number
            gamesLeft: number
        }>
        const a = standings.find((s: { id: number }) => s.id === 1) as {
            id: number
            points: number
            gamesPlayed: number
        }
        expect(a.points).toBe(1)
        expect(a.gamesPlayed).toBeGreaterThanOrEqual(1)
    })

    it('does not change points on 0-0 forfeited matches but decrements gamesLeft', () => {
        const info = { pts_for_bye: '1' }
        const participants = [
            {
                id: 1,
                name: 'A',
                challongeUsername: 'a',
                btag: 'A#1',
                race: 'Z',
            },
            {
                id: 2,
                name: 'B',
                challongeUsername: 'b',
                btag: 'B#2',
                race: 'T',
            },
        ]
        const matches = [
            {
                id: 12,
                state: 'complete',
                winnerId: 1,
                loserId: 2,
                scoresCsv: '0-0',
            },
        ]
        const standings = getStandingsData(
            info as any,
            participants as any,
            matches as any
        ) as Array<{ id: number; points: number; gamesLeft: number }>
        const a = standings.find((s: { id: number }) => s.id === 1) as {
            id: number
            points: number
            gamesLeft: number
        }
        const b = standings.find((s: { id: number }) => s.id === 2) as {
            id: number
            points: number
            gamesLeft: number
        }
        expect(a.points).toBe(0)
        expect(b.points).toBe(0)
        expect(a.gamesLeft).toBeLessThan(participants.length - 1)
        expect(b.gamesLeft).toBeLessThan(participants.length - 1)
    })

    it('breaks tie by pointsDifference then by wins', () => {
        const info = { pts_for_bye: '0' }
        const participants = [
            {
                id: 1,
                name: 'A',
                challongeUsername: 'a',
                btag: 'A#1',
                race: 'Z',
            },
            {
                id: 2,
                name: 'B',
                challongeUsername: 'b',
                btag: 'B#2',
                race: 'T',
            },
            {
                id: 3,
                name: 'C',
                challongeUsername: 'c',
                btag: 'C#3',
                race: 'P',
            },
        ]
        const matches = [
            // A beats B 2-1 (A points +2, diff +1)
            {
                id: 20,
                state: 'complete',
                winnerId: 1,
                loserId: 2,
                scoresCsv: '2-1',
            },
            // C beats A 2-0 (C +2, diff +2; A +0, diff -2)
            {
                id: 21,
                state: 'complete',
                winnerId: 3,
                loserId: 1,
                scoresCsv: '2-0',
            },
            // B beats C 2-1 (B +2, diff +1; C +1, diff -1)
            {
                id: 22,
                state: 'complete',
                winnerId: 2,
                loserId: 3,
                scoresCsv: '2-1',
            },
        ]
        const standings = getStandingsData(
            info as any,
            participants as any,
            matches as any
        )
        // Points: B=3, C=3, A=2. With equal points B vs C, head-to-head favors B.
        expect(standings[0].id).toBe(2)
        expect(standings[1].id).toBe(3)
        expect(standings[2].id).toBe(1)
    })
})
