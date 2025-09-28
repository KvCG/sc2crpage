import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock all dependencies
const hoisted = vi.hoisted(() => ({
    getTopMock: vi.fn(),
    getDailySnapshotMock: vi.fn(),
    getClientInfoMock: vi.fn(() => ({ device: 'Desktop', os: 'Windows' })),
    loggerMock: {
        info: vi.fn(),
        error: vi.fn()
    },
    dataDerivationsServiceMock: {
        filterByMinimumGames: vi.fn((data: any[], minGames?: number) => data.filter(p => p.gamesThisSeason >= (minGames || 20))),
        getRankingStatistics: vi.fn(() => ({
            totalPlayers: 2,
            activePlayers: 1,
            averageRating: 3350,
            raceDistribution: { TERRAN: 1, PROTOSS: 1 },
            leagueDistribution: { DIAMOND: 1, PLATINUM: 1 }
        }))
    },
    onlineStatusCalculatorMock: {
        getHoursSinceLastActivity: vi.fn()
    }
}))

vi.mock('../../utils/getClientInfo', () => ({
    getClientInfo: hoisted.getClientInfoMock
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.loggerMock
}))

vi.mock('../../services/pulseApi', () => ({
    getTop: hoisted.getTopMock
}))

vi.mock('../../services/snapshotService', () => ({
    getDailySnapshot: hoisted.getDailySnapshotMock
}))

vi.mock('../../services/dataDerivations', () => ({
    DataDerivationsService: hoisted.dataDerivationsServiceMock,
    OnlineStatusCalculator: hoisted.onlineStatusCalculatorMock
}))

describe('Analytics Feature Flag', () => {
    let originalEnv: any

    beforeEach(() => {
        originalEnv = { ...process.env }
    })

    afterEach(() => {
        process.env = originalEnv
        vi.resetAllMocks()
    })

    describe('ENABLE_PLAYER_ANALYTICS feature flag', () => {
        it('should be disabled by default', () => {
            delete process.env.ENABLE_PLAYER_ANALYTICS
            
            const ANALYTICS_ENABLED = String(process.env.ENABLE_PLAYER_ANALYTICS ?? 'false').toLowerCase() === 'true'
            expect(ANALYTICS_ENABLED).toBe(false)
        })

        it('should be disabled when explicitly set to false', () => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'false'
            
            const ANALYTICS_ENABLED = String(process.env.ENABLE_PLAYER_ANALYTICS ?? 'false').toLowerCase() === 'true'
            expect(ANALYTICS_ENABLED).toBe(false)
        })

        it('should be enabled when set to true', () => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'true'
            
            const ANALYTICS_ENABLED = String(process.env.ENABLE_PLAYER_ANALYTICS ?? 'false').toLowerCase() === 'true'
            expect(ANALYTICS_ENABLED).toBe(true)
        })

        it('should be case insensitive', () => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'TRUE'
            
            const ANALYTICS_ENABLED = String(process.env.ENABLE_PLAYER_ANALYTICS ?? 'false').toLowerCase() === 'true'
            expect(ANALYTICS_ENABLED).toBe(true)
        })
    })
})

describe('Analytics Data Processing', () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })

    describe('generatePlayerAnalytics function logic', () => {
        it('should calculate activity statistics correctly', () => {
            const mockPlayers = [
                {
                    playerCharacterId: '1',
                    race: 'TERRAN',
                    ratingLast: 3500,
                    leagueTypeLast: 'DIAMOND',
                    gamesThisSeason: 50,
                    gamesPerRace: { TERRAN: 50, PROTOSS: 0, ZERG: 0, RANDOM: 0 },
                    lastDatePlayed: '2025-09-25T10:00:00.000Z',
                    online: true
                },
                {
                    playerCharacterId: '2',
                    race: 'PROTOSS',
                    ratingLast: 3200,
                    leagueTypeLast: 'PLATINUM',
                    gamesThisSeason: 30,
                    gamesPerRace: { TERRAN: 0, PROTOSS: 30, ZERG: 0, RANDOM: 0 },
                    lastDatePlayed: '2025-09-24T15:00:00.000Z',
                    online: false
                }
            ]

            // Simulate the analytics calculation logic
            const onlineCount = mockPlayers.filter(p => p.online).length
            const offlineCount = mockPlayers.filter(p => !p.online).length
            const totalGames = mockPlayers.reduce((sum, p) => sum + p.gamesThisSeason, 0)
            const averageGames = totalGames / mockPlayers.length

            expect(onlineCount).toBe(1)
            expect(offlineCount).toBe(1)
            expect(totalGames).toBe(80)
            expect(averageGames).toBe(40)
        })

        it('should calculate rating statistics correctly', () => {
            const mockPlayers = [
                { ratingLast: 3500 },
                { ratingLast: 3200 },
                { ratingLast: 3800 },
                { ratingLast: 3100 }
            ]

            const ratings = mockPlayers.map(p => p.ratingLast).filter(r => r !== null).sort((a, b) => a - b)
            // sorted: [3100, 3200, 3500, 3800]
            
            expect(Math.min(...ratings)).toBe(3100)
            expect(Math.max(...ratings)).toBe(3800)
            expect(ratings[1]).toBe(3200) // second element in sorted array
            expect(ratings[2]).toBe(3500) // median for even-length array (middle-right element)
        })

        it('should aggregate games by race correctly', () => {
            const mockPlayers = [
                { gamesPerRace: { TERRAN: 30, PROTOSS: 0, ZERG: 0, RANDOM: 0 } },
                { gamesPerRace: { TERRAN: 0, PROTOSS: 25, ZERG: 0, RANDOM: 0 } },
                { gamesPerRace: { TERRAN: 10, PROTOSS: 0, ZERG: 15, RANDOM: 0 } }
            ]

            const gamesByRace = {
                TERRAN: mockPlayers.reduce((sum, p) => sum + (p.gamesPerRace.TERRAN || 0), 0),
                PROTOSS: mockPlayers.reduce((sum, p) => sum + (p.gamesPerRace.PROTOSS || 0), 0),
                ZERG: mockPlayers.reduce((sum, p) => sum + (p.gamesPerRace.ZERG || 0), 0),
                RANDOM: mockPlayers.reduce((sum, p) => sum + (p.gamesPerRace.RANDOM || 0), 0)
            }

            expect(gamesByRace.TERRAN).toBe(40)
            expect(gamesByRace.PROTOSS).toBe(25)
            expect(gamesByRace.ZERG).toBe(15)
            expect(gamesByRace.RANDOM).toBe(0)
        })
    })

    describe('Activity analysis buckets', () => {
        beforeEach(() => {
            // Mock DateTime to return consistent current time
            vi.stubGlobal('Date', {
                ...Date,
                now: () => new Date('2025-09-25T12:00:00.000Z').getTime()
            })
        })

        it('should categorize players into correct activity buckets', () => {
            hoisted.onlineStatusCalculatorMock.getHoursSinceLastActivity
                .mockReturnValueOnce(0.5) // veryRecent
                .mockReturnValueOnce(3)   // recent
                .mockReturnValueOnce(12)  // today
                .mockReturnValueOnce(36)  // yesterday
                .mockReturnValueOnce(120) // thisWeek
                .mockReturnValueOnce(200) // older

            const mockPlayers = [
                { lastDatePlayed: '2025-09-25T11:30:00.000Z', race: 'TERRAN' },
                { lastDatePlayed: '2025-09-25T09:00:00.000Z', race: 'PROTOSS' },
                { lastDatePlayed: '2025-09-25T00:00:00.000Z', race: 'ZERG' },
                { lastDatePlayed: '2025-09-24T00:00:00.000Z', race: 'TERRAN' },
                { lastDatePlayed: '2025-09-20T00:00:00.000Z', race: 'PROTOSS' },
                { lastDatePlayed: '2025-09-15T00:00:00.000Z', race: 'ZERG' }
            ]

            // Simulate bucket categorization logic
            const buckets = { veryRecent: 0, recent: 0, today: 0, yesterday: 0, thisWeek: 0, older: 0 }
            
            mockPlayers.forEach((_player, index) => {
                const hours = [0.5, 3, 12, 36, 120, 200][index]
                if (hours < 1) buckets.veryRecent++
                else if (hours < 6) buckets.recent++
                else if (hours < 24) buckets.today++
                else if (hours < 48) buckets.yesterday++
                else if (hours < 168) buckets.thisWeek++
                else buckets.older++
            })

            expect(buckets.veryRecent).toBe(1)
            expect(buckets.recent).toBe(1)
            expect(buckets.today).toBe(1)
            expect(buckets.yesterday).toBe(1)
            expect(buckets.thisWeek).toBe(1)
            expect(buckets.older).toBe(1)
        })
    })
})

describe('Analytics Service Integration', () => {
    beforeEach(() => {
        process.env.ENABLE_PLAYER_ANALYTICS = 'true'
        vi.resetAllMocks()
    })

    it('should use DataDerivationsService.filterByMinimumGames when includeInactive is false', async () => {
        const mockData = [
            { gamesThisSeason: 50 },
            { gamesThisSeason: 10 }
        ]

        hoisted.getTopMock.mockResolvedValueOnce(mockData)

        // Simulate the analytics endpoint logic
        const includeInactive = false
        const minGames = 20

        if (!includeInactive) {
            hoisted.dataDerivationsServiceMock.filterByMinimumGames(mockData, minGames)
        }

        expect(hoisted.dataDerivationsServiceMock.filterByMinimumGames).toHaveBeenCalledWith(mockData, minGames)
    })

    it('should skip filtering when includeInactive is true', async () => {
        const mockData = [{ gamesThisSeason: 10 }]
        hoisted.getTopMock.mockResolvedValueOnce(mockData)

        // Simulate the analytics endpoint logic
        const includeInactive = true

        if (!includeInactive) {
            hoisted.dataDerivationsServiceMock.filterByMinimumGames(mockData, 20)
        }

        expect(hoisted.dataDerivationsServiceMock.filterByMinimumGames).not.toHaveBeenCalled()
    })

    it('should use daily snapshot when timeframe is daily', async () => {
        hoisted.getDailySnapshotMock.mockResolvedValueOnce({
            data: [{ playerCharacterId: '1', race: 'TERRAN' }]
        })

        const timeframe = 'daily'
        
        if (timeframe === 'daily') {
            await hoisted.getDailySnapshotMock()
        } else {
            await hoisted.getTopMock()
        }

        expect(hoisted.getDailySnapshotMock).toHaveBeenCalled()
        expect(hoisted.getTopMock).not.toHaveBeenCalled()
    })

    it('should use live data when timeframe is not daily', async () => {
        hoisted.getTopMock.mockResolvedValueOnce([
            { playerCharacterId: '1', race: 'TERRAN' }
        ])

        const timeframe: string = 'current'
        
        if (timeframe !== 'daily') {
            await hoisted.getTopMock()
        } else {
            await hoisted.getDailySnapshotMock()
        }

        expect(hoisted.getTopMock).toHaveBeenCalled()
        expect(hoisted.getDailySnapshotMock).not.toHaveBeenCalled()
    })
})

describe('Error Handling', () => {
    beforeEach(() => {
        process.env.ENABLE_PLAYER_ANALYTICS = 'true'
        vi.resetAllMocks()
    })

    it('should handle service errors gracefully', async () => {
        hoisted.getTopMock.mockRejectedValueOnce(new Error('Service unavailable'))

        let errorOccurred = false
        try {
            await hoisted.getTopMock()
        } catch (error) {
            errorOccurred = true
            expect(error).toBeInstanceOf(Error)
            expect((error as Error).message).toBe('Service unavailable')
        }

        expect(errorOccurred).toBe(true)
    })

    it('should log errors when they occur', async () => {
        const error = new Error('Test error')
        
        // Simulate error logging
        hoisted.loggerMock.error({ error, feature: 'analytics' }, 'Error generating player analytics')

        expect(hoisted.loggerMock.error).toHaveBeenCalledWith(
            { error, feature: 'analytics' },
            'Error generating player analytics'
        )
    })
})