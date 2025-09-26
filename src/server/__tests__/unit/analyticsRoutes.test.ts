import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Request, Response } from 'express'

// Mock all dependencies with hoisted mocks
const hoisted = vi.hoisted(() => ({
    getTopMock: vi.fn(),
    getDailySnapshotMock: vi.fn(),
    getClientInfoMock: vi.fn(() => ({ device: 'Desktop', os: 'Windows' })),
    loggerMock: {
        info: vi.fn(),
        error: vi.fn()
    },
    dataDerivationsServiceMock: {
        filterByMinimumGames: vi.fn((data: any[]) => data),
        getRankingStatistics: vi.fn(() => ({
            totalPlayers: 100,
            activePlayers: 75,
            averageRating: 3500,
            raceDistribution: { TERRAN: 30, PROTOSS: 35, ZERG: 35 },
            leagueDistribution: { DIAMOND: 50, PLATINUM: 30, GOLD: 20 }
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

// Mock express response object
const createMockResponse = () => {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis()
    }
    return res as unknown as Response
}

// Mock express request object
const createMockRequest = (overrides: Partial<Request> = {}) => {
    const req = {
        query: {},
        headers: { 'user-agent': 'TestAgent/1.0' },
        path: '/api/player-analytics',
        ...overrides
    }
    return req as unknown as Request
}

describe('Analytics Routes', () => {
    let app: express.Application
    let originalEnv: any

    beforeEach(() => {
        originalEnv = process.env
        app = express()
        app.use(express.json())
        app.use('/api', analyticsRoutes)
    })

    afterEach(() => {
        process.env = originalEnv
        vi.resetAllMocks()
    })

    describe('Feature Flag Protection', () => {
        it('should return 404 when ENABLE_PLAYER_ANALYTICS is false', async () => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'false'

            const response = await request(app)
                .get('/api/player-analytics')
                .expect(404)

            expect(response.body).toEqual({
                error: 'Feature not available',
                code: 'FEATURE_DISABLED',
                message: 'Player analytics API is currently disabled'
            })
        })

        it('should return 404 when ENABLE_PLAYER_ANALYTICS is not set', async () => {
            delete process.env.ENABLE_PLAYER_ANALYTICS

            const response = await request(app)
                .get('/api/player-analytics')
                .expect(404)

            expect(response.body.code).toBe('FEATURE_DISABLED')
        })

        it('should allow access when ENABLE_PLAYER_ANALYTICS is true', async () => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'true'

            // Mock successful data
            const { getTop } = await import('../../services/pulseApi')
            vi.mocked(getTop).mockResolvedValueOnce([
                {
                    playerCharacterId: '1',
                    race: 'TERRAN',
                    ratingLast: 3500,
                    leagueTypeLast: 'DIAMOND',
                    gamesThisSeason: 50,
                    gamesPerRace: { terranGamesPlayed: 50 },
                    lastDatePlayed: '2025-09-25T10:00:00.000Z',
                    online: true
                }
            ])

            const response = await request(app)
                .get('/api/player-analytics')
                .expect(200)

            expect(response.body).toHaveProperty('metadata')
            expect(response.body).toHaveProperty('analytics')
        })
    })

    describe('/player-analytics endpoint', () => {
        beforeEach(() => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'true'
        })

        it('should return comprehensive analytics for current timeframe', async () => {
            const { getTop } = await import('../../services/pulseApi')
            vi.mocked(getTop).mockResolvedValueOnce([
                {
                    playerCharacterId: '1',
                    race: 'TERRAN',
                    ratingLast: 3500,
                    leagueTypeLast: 'DIAMOND',
                    gamesThisSeason: 50,
                    gamesPerRace: { terranGamesPlayed: 50 },
                    lastDatePlayed: '2025-09-25T10:00:00.000Z',
                    online: true
                },
                {
                    playerCharacterId: '2',
                    race: 'PROTOSS',
                    ratingLast: 3200,
                    leagueTypeLast: 'PLATINUM',
                    gamesThisSeason: 30,
                    gamesPerRace: { protossGamesPlayed: 30 },
                    lastDatePlayed: '2025-09-24T15:00:00.000Z',
                    online: false
                }
            ])

            const response = await request(app)
                .get('/api/player-analytics')
                .expect(200)

            expect(response.body.metadata).toMatchObject({
                dataSource: 'live_ranking',
                timeframe: 'current',
                totalPlayers: 2,
                includeInactive: false,
                minGames: 20
            })

            expect(response.body.analytics).toHaveProperty('overview')
            expect(response.body.analytics).toHaveProperty('activity')
            expect(response.body.analytics).toHaveProperty('ratings')
            expect(response.body.analytics).toHaveProperty('games')
            expect(response.body.analytics).toHaveProperty('leaguePerformance')

            // Check activity stats
            expect(response.body.analytics.activity).toMatchObject({
                onlineCount: 1,
                offlineCount: 1
            })
        })

        it('should handle daily timeframe using snapshot service', async () => {
            const { getDailySnapshot } = await import('../../services/snapshotService')
            vi.mocked(getDailySnapshot).mockResolvedValueOnce({
                data: [
                    {
                        playerCharacterId: '1',
                        race: 'ZERG',
                        ratingLast: 3800,
                        leagueTypeLast: 'MASTER',
                        gamesThisSeason: 75,
                        gamesPerRace: { ZERG: 75 },
                        lastDatePlayed: '2025-09-25T08:00:00.000Z',
                        online: false
                    }
                ],
                timestamp: '2025-09-25T00:00:00.000Z'
            })

            const response = await request(app)
                .get('/api/player-analytics?timeframe=daily')
                .expect(200)

            expect(response.body.metadata).toMatchObject({
                dataSource: 'daily_snapshot',
                timeframe: 'daily'
            })
        })

        it('should respect minGames parameter', async () => {
            const { getTop } = await import('../../services/pulseApi')
            vi.mocked(getTop).mockResolvedValueOnce([
                {
                    playerCharacterId: '1',
                    race: 'TERRAN',
                    ratingLast: 3500,
                    leagueTypeLast: 'DIAMOND',
                    gamesThisSeason: 50,
                    gamesPerRace: { terranGamesPlayed: 50 },
                    lastDatePlayed: '2025-09-25T10:00:00.000Z',
                    online: true
                }
            ])

            const { DataDerivationsService } = await import('../../services/dataDerivations')
            const filterSpy = vi.spied(DataDerivationsService.filterByMinimumGames)

            await request(app)
                .get('/api/player-analytics?minGames=30')
                .expect(200)

            expect(filterSpy).toHaveBeenCalledWith(expect.any(Array), 30)
        })

        it('should include inactive players when specified', async () => {
            const { getTop } = await import('../../services/pulseApi')
            vi.mocked(getTop).mockResolvedValueOnce([])

            const { DataDerivationsService } = await import('../../services/dataDerivations')
            const filterSpy = vi.spied(DataDerivationsService.filterByMinimumGames)

            await request(app)
                .get('/api/player-analytics?includeInactive=true')
                .expect(200)

            expect(filterSpy).not.toHaveBeenCalled()
        })

        it('should handle service errors gracefully', async () => {
            const { getTop } = await import('../../services/pulseApi')
            vi.mocked(getTop).mockRejectedValueOnce(new Error('Service unavailable'))

            const response = await request(app)
                .get('/api/player-analytics')
                .expect(500)

            expect(response.body).toMatchObject({
                error: 'Internal server error',
                code: 'ANALYTICS_ERROR',
                message: 'Failed to generate player analytics'
            })
        })

        it('should set appropriate response headers', async () => {
            const { getTop } = await import('../../services/pulseApi')
            vi.mocked(getTop).mockResolvedValueOnce([])

            const response = await request(app)
                .get('/api/player-analytics')
                .expect(200)

            expect(response.headers['x-sc2pulse-attribution']).toBe('Data courtesy of sc2pulse.nephest.com (non-commercial use)')
            expect(response.headers['cache-control']).toBe('public, max-age=300')
        })
    })

    describe('/player-analytics/activity endpoint', () => {
        beforeEach(() => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'true'
        })

        it('should return activity analysis with time buckets', async () => {
            const { getTop } = await import('../../services/pulseApi')
            const { OnlineStatusCalculator } = await import('../../services/dataDerivations')
            
            vi.mocked(getTop).mockResolvedValueOnce([
                {
                    playerCharacterId: '1',
                    race: 'TERRAN',
                    lastDatePlayed: '2025-09-25T10:00:00.000Z',
                    online: true,
                    ratingLast: 3500,
                    gamesThisSeason: 50
                }
            ])

            // Mock different activity times
            vi.mocked(OnlineStatusCalculator.getHoursSinceLastActivity)
                .mockReturnValueOnce(0.5) // very recent

            const response = await request(app)
                .get('/api/player-analytics/activity')
                .expect(200)

            expect(response.body).toHaveProperty('metadata')
            expect(response.body).toHaveProperty('activity')
            expect(response.body.activity).toHaveProperty('buckets')
            expect(response.body.activity).toHaveProperty('summary')
            
            expect(response.body.activity.buckets).toHaveProperty('veryRecent')
            expect(response.body.activity.buckets).toHaveProperty('recent')
            expect(response.body.activity.buckets).toHaveProperty('today')
        })

        it('should handle custom hoursThreshold parameter', async () => {
            const { getTop } = await import('../../services/pulseApi')
            vi.mocked(getTop).mockResolvedValueOnce([])

            const response = await request(app)
                .get('/api/player-analytics/activity?hoursThreshold=48')
                .expect(200)

            expect(response.body.metadata.hoursThreshold).toBe(48)
        })

        it('should apply feature flag protection', async () => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'false'

            const response = await request(app)
                .get('/api/player-analytics/activity')
                .expect(404)

            expect(response.body.code).toBe('FEATURE_DISABLED')
        })

        it('should set appropriate cache headers', async () => {
            const { getTop } = await import('../../services/pulseApi')
            vi.mocked(getTop).mockResolvedValueOnce([])

            const response = await request(app)
                .get('/api/player-analytics/activity')
                .expect(200)

            expect(response.headers['cache-control']).toBe('public, max-age=180')
        })
    })

    describe('Request Logging', () => {
        beforeEach(() => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'true'
        })

        it('should log analytics requests with proper context', async () => {
            const { getTop } = await import('../../services/pulseApi')
            const logger = await import('../../logging/logger')
            
            vi.mocked(getTop).mockResolvedValueOnce([])

            await request(app)
                .get('/api/player-analytics')
                .set('User-Agent', 'TestAgent/1.0')
                .set('Referer', 'http://test.com')
                .expect(200)

            expect(logger.default.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    route: '/api/player-analytics',
                    details: expect.objectContaining({
                        referer: 'http://test.com',
                        device: 'Desktop',
                        os: 'Windows'
                    }),
                    feature: 'analytics'
                }),
                'Analytics API request'
            )
        })

        it('should log feature disabled attempts', async () => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'false'
            const logger = await import('../../logging/logger')

            await request(app)
                .get('/api/player-analytics')
                .expect(404)

            expect(logger.default.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    route: '/api/player-analytics',
                    feature: 'analytics'
                }),
                'Analytics feature disabled'
            )
        })
    })
})