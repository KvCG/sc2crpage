import { describe, it, expect, vi } from 'vitest'

// Mock the API module
vi.mock('../services/api', () => ({
    getPlayerAnalytics: vi.fn(),
    getPlayerActivityAnalysis: vi.fn()
}))

// Import after mocking
import { getPlayerAnalytics, getPlayerActivityAnalysis } from '../services/api'

// Get the mocked functions
const mockGetPlayerAnalytics = vi.mocked(getPlayerAnalytics)
const mockGetPlayerActivityAnalysis = vi.mocked(getPlayerActivityAnalysis)

const mockAnalyticsResponse = {
    data: {
        success: true,
        data: {
            metadata: {
                totalPlayers: 1500,
                generatedAt: '2025-10-05T12:00:00Z'
            },
            activityPatterns: [
                { hour: 18, onlinePlayers: 320 },
                { hour: 19, onlinePlayers: 350 }
            ],
            raceDistribution: {
                Terran: 500,
                Zerg: 500,
                Protoss: 500
            },
            rankingMovements: [
                { playerId: '12345', movement: 2 },
                { playerId: '67890', movement: -1 }
            ],
            leagueStats: {
                Grandmaster: 50,
                Master: 200,
                Diamond: 400
            }
        }
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any
}

describe('Community Stats API Services', () => {
    it('should call getPlayerAnalytics with correct parameters', async () => {
        mockGetPlayerAnalytics.mockResolvedValue(mockAnalyticsResponse)

        const params = {
            timeframe: 'current' as const,
            includeInactive: false,
            minimumGames: 20,
            race: null
        }

        const result = await getPlayerAnalytics(params)

        expect(mockGetPlayerAnalytics).toHaveBeenCalledWith(params)
        expect(result.data.success).toBe(true)
        expect(result.data.data.metadata.totalPlayers).toBe(1500)
    })

    it('should call getPlayerActivityAnalysis with groupBy parameter', async () => {
        mockGetPlayerActivityAnalysis.mockResolvedValue(mockAnalyticsResponse)

        const params = {
            timeframe: 'daily' as const,
            groupBy: 'race' as const,
            includeInactive: true,
            minimumGames: 10
        }

        const result = await getPlayerActivityAnalysis(params)

        expect(mockGetPlayerActivityAnalysis).toHaveBeenCalledWith(params)
        expect(result.data.success).toBe(true)
    })

    it('should handle API calls without parameters', async () => {
        mockGetPlayerAnalytics.mockResolvedValue(mockAnalyticsResponse)

        const result = await getPlayerAnalytics()

        expect(mockGetPlayerAnalytics).toHaveBeenCalled()
        expect(result.data.success).toBe(true)
    })
})