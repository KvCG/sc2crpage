import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    filterRankingForDisplay,
    getRankingMinGamesThreshold,
} from '../../../server/utils/rankingFilters'

const makeRow = (overrides: Partial<any> = {}) => ({
    rating: 4500,
    leagueType: 5,
    mainRace: 'ZERG',
    totalGames: 12,
    ...overrides,
})

describe('rankingFilters', () => {
    const OLD_ENV = process.env
    beforeEach(() => {
        process.env = { ...OLD_ENV }
        delete process.env.RANKING_MIN_GAMES
    })
    afterEach(() => {
        process.env = OLD_ENV
    })

    it('applies default threshold (10) when env not set', () => {
        expect(getRankingMinGamesThreshold()).toBe(10)
    })

    it('uses env RANKING_MIN_GAMES when valid', () => {
        process.env.RANKING_MIN_GAMES = '7'
        expect(getRankingMinGamesThreshold()).toBe(7)
    })

    it('filters invalid rows (missing rating/league/race)', () => {
        const rows = [
            makeRow(),
            makeRow({ rating: undefined }),
            makeRow({ leagueType: undefined }),
            makeRow({ mainRace: undefined }),
        ]
        const out = filterRankingForDisplay(rows)
        expect(out.length).toBe(1)
    })

    it('filters out low-activity players below threshold', () => {
        process.env.RANKING_MIN_GAMES = '15'
        const rows = [
            makeRow({ totalGames: 20 }),
            makeRow({ totalGames: 10 }),
            makeRow({ totalGames: 0 }),
        ]
        const out = filterRankingForDisplay(rows)
        expect(out.length).toBe(1)
        expect(out[0].totalGames).toBe(20)
    })

    it('falls back to valid rows if active filter empties result', () => {
        process.env.RANKING_MIN_GAMES = '100'
        const rows = [
            makeRow({ totalGames: 50 }),
            makeRow({ totalGames: 60 }),
        ]
        const out = filterRankingForDisplay(rows)
        expect(out.length).toBe(2)
    })

    it('returns empty array for non-arrays', () => {
        expect(filterRankingForDisplay(null as unknown as any[])).toEqual([])
        expect(filterRankingForDisplay(undefined as unknown as any[])).toEqual(
            []
        )
        expect(filterRankingForDisplay(123 as unknown as any[])).toEqual([])
    })
})
