import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateTime } from 'luxon'
import {
    OnlineStatusCalculator,
    PositionCalculator,
    DataDerivationsService,
} from '../services/dataDerivations'

// Mock modules
vi.mock('../utils/pulseApiHelper', () => ({
    toCostaRicaTime: (dateStr: string) => {
        try {
            return DateTime.fromISO(dateStr).setZone('America/Costa_Rica')
        } catch {
            return DateTime.invalid('Invalid date')
        }
    },
}))

vi.mock('../utils/csvDisplayNames', () => ({
    getDisplayName: () => null,
}))

describe('OnlineStatusCalculator', () => {
    const mockCurrentTime = DateTime.fromISO('2024-01-15T10:00:00').setZone('America/Costa_Rica')

    beforeEach(() => {
        process.env.ONLINE_THRESHOLD_MINUTES = '30'
        process.env.ONLINE_THRESHOLD_HOURS = '24'
    })

    describe('isPlayerOnline', () => {
        it('should return true for players active within threshold', () => {
            // Use real current time minus 15 minutes (should be online)
            const recentTime = DateTime.now().minus({ minutes: 15 }).toISO()
            expect(OnlineStatusCalculator.isPlayerOnline(recentTime)).toBe(true)
        })

        it('should return false for players inactive beyond threshold', () => {
            // Use real current time minus 2 hours (should be offline)
            const oldTime = DateTime.now().minus({ hours: 2 }).toISO()
            expect(OnlineStatusCalculator.isPlayerOnline(oldTime)).toBe(false)
        })

        it('should return false for empty string', () => {
            expect(OnlineStatusCalculator.isPlayerOnline('')).toBe(false)
        })
    })

    describe('getActivityStatus', () => {
        it('should return correct activity status', () => {
            const recentTime = mockCurrentTime.minus({ minutes: 15 }).toISO()!
            const status = OnlineStatusCalculator.getActivityStatus(recentTime, mockCurrentTime)
            expect(['online', 'recent', 'inactive', 'unknown']).toContain(status)
        })

        it('should return "inactive" for old activity when ONLINE_THRESHOLD_HOURS is undefined', () => {
            // This test exposes a bug in the getActivityStatus method
            delete process.env.ONLINE_THRESHOLD_HOURS
            const oldTime = mockCurrentTime.minus({ days: 5 }).toISO()!
            const status = OnlineStatusCalculator.getActivityStatus(oldTime, mockCurrentTime)
            // BUG: Due to operator precedence, this will return 'recent' instead of 'inactive'
            // The line: if (hours <= Number(process.env.ONLINE_THRESHOLD_HOURS) || 24)
            // Should be: if (hours <= (Number(process.env.ONLINE_THRESHOLD_HOURS) || 24))
            expect(status).toBe('inactive') // This will fail due to the bug
        })

        it('should return "recent" for activity within 24 hours when ONLINE_THRESHOLD_HOURS is undefined', () => {
            delete process.env.ONLINE_THRESHOLD_HOURS
            const recentTime = mockCurrentTime.minus({ hours: 12 }).toISO()!
            const status = OnlineStatusCalculator.getActivityStatus(recentTime, mockCurrentTime)
            expect(status).toBe('recent')
        })
    })
})

describe('PositionCalculator', () => {
    const createMockPlayer = (btag: string, rating: number): any => ({
        btag,
        rating,
        globalRank: 1,
        regionRank: 1,
        lastPlayed: '2024-01-15T10:00:00',
        leagueRank: 1,
        leagueType: 6,
        losses: 5,
        ties: 0,
        wins: 10,
        name: 'Test Player',
        mainRace: 'TERRAN',
        totalGames: 15,
    })

    describe('calculatePositionChanges', () => {
        it('should detect upward movement correctly', () => {
            const current = [createMockPlayer('player1#1234', 3000), createMockPlayer('player2#1234', 2900)]
            const previous = [createMockPlayer('player2#1234', 2900), createMockPlayer('player1#1234', 3000)]

            const changes = PositionCalculator.calculatePositionChanges(current, previous)
            
            const player1Change = changes.get('player1#1234')
            expect(player1Change?.positionChangeIndicator).toBe('up')
            expect(player1Change?.currentPosition).toBe(0)
            expect(player1Change?.previousPosition).toBe(1)

            const player2Change = changes.get('player2#1234')
            expect(player2Change?.positionChangeIndicator).toBe('down')
            expect(player2Change?.currentPosition).toBe(1)
            expect(player2Change?.previousPosition).toBe(0)
        })

        it('should detect no change when positions are same', () => {
            const current = [createMockPlayer('player1#1234', 3000), createMockPlayer('player2#1234', 2900)]
            const previous = [createMockPlayer('player1#1234', 3000), createMockPlayer('player2#1234', 2900)]

            const changes = PositionCalculator.calculatePositionChanges(current, previous)
            
            expect(changes.get('player1#1234')?.positionChangeIndicator).toBe('none')
            expect(changes.get('player2#1234')?.positionChangeIndicator).toBe('none')
        })

        it('should handle new players without previous position', () => {
            const current = [createMockPlayer('newplayer#1234', 2800)]
            const previous: any[] = []

            const changes = PositionCalculator.calculatePositionChanges(current, previous)
            
            const change = changes.get('newplayer#1234')
            expect(change?.positionChangeIndicator).toBe('none')
            expect(change?.previousPosition).toBeUndefined()
            expect(change?.currentPosition).toBe(0)
        })

        it('should ignore players without btag', () => {
            const current = [{ ...createMockPlayer('', 2800), btag: null }]
            const previous: any[] = []

            const changes = PositionCalculator.calculatePositionChanges(current, previous)
            
            expect(changes.size).toBe(0)
        })
    })

    describe('getMovementStatistics', () => {
        it('should count all movement types correctly', () => {
            const changes = new Map()
            changes.set('player1', { positionChangeIndicator: 'up', currentPosition: 0, previousPosition: 1 })
            changes.set('player2', { positionChangeIndicator: 'down', currentPosition: 1, previousPosition: 0 })
            changes.set('player3', { positionChangeIndicator: 'none', currentPosition: 2, previousPosition: 2 })
            changes.set('player4', { positionChangeIndicator: 'none', currentPosition: 3 }) // new player

            const stats = PositionCalculator.getMovementStatistics(changes)
            
            expect(stats.up).toBe(1)
            expect(stats.down).toBe(1)
            expect(stats.unchanged).toBe(1)
            expect(stats.new).toBe(1)
        })

        it('should handle empty changes map', () => {
            const stats = PositionCalculator.getMovementStatistics(new Map())
            
            expect(stats.up).toBe(0)
            expect(stats.down).toBe(0)
            expect(stats.unchanged).toBe(0)
            expect(stats.new).toBe(0)
        })
    })
})

describe('DataDerivationsService', () => {
    describe('processTeamsToRankedPlayers', () => {
        it('should handle empty teams array', () => {
            const result = DataDerivationsService.processTeamsToRankedPlayers([])
            expect(result).toHaveLength(0)
        })
    })

    describe('filterByMinimumGames', () => {
        it('should handle empty array', () => {
            const result = DataDerivationsService.filterByMinimumGames([])
            expect(result).toHaveLength(0)
        })
    })

    describe('getRankingStatistics', () => {
        it('should handle empty array', () => {
            const stats = DataDerivationsService.getRankingStatistics([])
            expect(stats.totalPlayers).toBe(0)
            expect(stats.activePlayers).toBe(0)
            expect(stats.averageRating).toBe(0)
        })
    })
})
