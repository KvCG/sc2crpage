import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { pulseService } from '../../services/pulseService'
import { AnalyticsService } from '../../services/analyticsService'
import { getRankingMinGamesThreshold } from '../../utils/rankingFilters'

/**
 * Integration tests for minimum games filter consistency across all analytics views
 * 
 * These tests ensure that Ranking, Distributions (CommunityStats), and Activity Report
 * all consume the same filtered player dataset from the single source of truth:
 * pulseService.getRanking()
 * 
 * CRITICAL: These tests must fail if any page bypasses the global filter boundary
 */

describe('Minimum Games Filter Consistency (Integration)', () => {
    const OLD_ENV = process.env

    beforeEach(() => {
        process.env = { ...OLD_ENV }
        pulseService.clearCaches()
    })

    afterEach(() => {
        process.env = OLD_ENV
        vi.restoreAllMocks()
    })

    it('should enforce minimum games filter using environment variable by default', async () => {
        // Set a specific threshold
        process.env.RANKING_MIN_GAMES = '15'
        
        // Mock the internal fetch to return players with varying game counts
        const mockPlayers = [
            { id: 1, btag: 'Player1#1234', totalGames: 20, rating: 4500 },
            { id: 2, btag: 'Player2#5678', totalGames: 10, rating: 4000 },
            { id: 3, btag: 'Player3#9012', totalGames: 5, rating: 3500 },
            { id: 4, btag: 'Player4#3456', totalGames: 30, rating: 5000 },
        ]

        const fetchSpy = vi.spyOn(pulseService as any, 'fetchRankingData').mockResolvedValue(mockPlayers)

        // Call getRanking without override - should use environment variable
        const result = await pulseService.getRanking()

        // Verify filter was applied with environment threshold (15)
        expect(result).toHaveLength(2) // Only players with >= 15 games
        expect(result.map((p: any) => p.id)).toEqual([1, 4])
        
        // Verify all returned players meet threshold
        const threshold = getRankingMinGamesThreshold()
        expect(threshold).toBe(15)
        result.forEach((player: any) => {
            expect(player.totalGames).toBeGreaterThanOrEqual(threshold)
        })

        fetchSpy.mockRestore()
    })

    it('should allow override parameter for testing purposes', async () => {
        // Set environment to one value
        process.env.RANKING_MIN_GAMES = '10'
        
        const mockPlayers = [
            { id: 1, btag: 'Player1#1234', totalGames: 25, rating: 4500 },
            { id: 2, btag: 'Player2#5678', totalGames: 15, rating: 4000 },
            { id: 3, btag: 'Player3#9012', totalGames: 8, rating: 3500 },
            { id: 4, btag: 'Player4#3456', totalGames: 30, rating: 5000 },
        ]

        const fetchSpy = vi.spyOn(pulseService as any, 'fetchRankingData').mockResolvedValue(mockPlayers)

        // Call with override (20) - should ignore environment variable (10)
        const result = await pulseService.getRanking(20)

        // Verify override was used (20), not environment (10)
        expect(result).toHaveLength(2) // Only players with >= 20 games
        expect(result.map((p: any) => p.id)).toEqual([1, 4])
        
        result.forEach((player: any) => {
            expect(player.totalGames).toBeGreaterThanOrEqual(20)
        })

        fetchSpy.mockRestore()
    })

    it('should use consistent threshold from environment variable when no override provided', async () => {
        // Test with different environment values
        const testCases = [
            { env: '5', expected: 5 },
            { env: '20', expected: 20 },
            { env: undefined, expected: 10 }, // Default value
        ]

        for (const testCase of testCases) {
            if (testCase.env) {
                process.env.RANKING_MIN_GAMES = testCase.env
            } else {
                delete process.env.RANKING_MIN_GAMES
            }

            const threshold = getRankingMinGamesThreshold()
            expect(threshold).toBe(testCase.expected)
        }
    })

    it('should ensure Ranking and Analytics views consume identical filtered datasets', async () => {
        process.env.RANKING_MIN_GAMES = '12'

        const mockPlayers = [
            { id: 1, btag: 'Player1#1234', totalGames: 25, rating: 4500, mainRace: 'TERRAN' },
            { id: 2, btag: 'Player2#5678', totalGames: 8, rating: 4000, mainRace: 'PROTOSS' },
            { id: 3, btag: 'Player3#9012', totalGames: 15, rating: 3500, mainRace: 'ZERG' },
        ]

        const fetchSpy = vi.spyOn(pulseService as any, 'fetchRankingData').mockResolvedValue(mockPlayers)

        // Get data via different service paths (both use default threshold)
        const rankingData = await pulseService.getRanking()
        
        // Analytics service should get the same filtered data
        const analyticsData = await AnalyticsService.generatePlayerAnalytics({
            timeframe: 'current',
            includeInactive: false,
        })

        // Both should have same filtered player count
        expect(rankingData).toHaveLength(2) // Players with >= 12 games
        expect(analyticsData.metadata.totalPlayers).toBe(2)
        
        // Verify same player IDs
        const rankingIds = new Set(rankingData.map((p: any) => p.id))
        expect(rankingIds).toEqual(new Set([1, 3]))

        fetchSpy.mockRestore()
    })

    it('should apply filter to cached data on subsequent calls', async () => {
        process.env.RANKING_MIN_GAMES = '10'

        const mockPlayers = [
            { id: 1, btag: 'Player1#1234', totalGames: 15, rating: 4500 },
            { id: 2, btag: 'Player2#5678', totalGames: 5, rating: 4000 },
            { id: 3, btag: 'Player3#9012', totalGames: 20, rating: 5000 },
        ]

        const fetchSpy = vi.spyOn(pulseService as any, 'fetchRankingData').mockResolvedValue(mockPlayers)

        // First call should apply filter
        const firstResult = await pulseService.getRanking()
        expect(firstResult).toHaveLength(2)
        expect(firstResult.map((p: any) => p.id)).toEqual([1, 3])

        // Clear mock call count but keep implementation
        fetchSpy.mockClear()

        // Second call should also apply filter (even if cached)
        const secondResult = await pulseService.getRanking()
        expect(secondResult).toHaveLength(2)
        expect(secondResult.map((p: any) => p.id)).toEqual([1, 3])

        fetchSpy.mockRestore()
    })

    it('should NOT re-filter in AnalyticsService when data is already filtered', async () => {
        process.env.RANKING_MIN_GAMES = '10'

        const mockPlayers = [
            { id: 1, btag: 'Player1#1234', totalGames: 15, rating: 4500, mainRace: 'TERRAN' },
            { id: 2, btag: 'Player2#5678', totalGames: 5, rating: 4000, mainRace: 'PROTOSS' },
        ]

        const fetchSpy = vi.spyOn(pulseService as any, 'fetchRankingData').mockResolvedValue(mockPlayers)

        // Generate analytics - should NOT call filterByMinimumGames since data is pre-filtered
        const analytics = await AnalyticsService.generatePlayerAnalytics({
            timeframe: 'current',
        })

        // Should only have players that passed the boundary filter
        expect(analytics.metadata.totalPlayers).toBe(1)
        expect(analytics.raceDistribution.distribution.TERRAN).toBe(1)

        fetchSpy.mockRestore()
    })

    it('should produce consistent results across all analytics endpoints', async () => {
        process.env.RANKING_MIN_GAMES = '12'

        const mockPlayers = [
            { id: 1, btag: 'Player1#1234', totalGames: 25, rating: 4500, mainRace: 'TERRAN', online: true, lastPlayed: new Date().toISOString() },
            { id: 2, btag: 'Player2#5678', totalGames: 8, rating: 4000, mainRace: 'PROTOSS', online: false, lastPlayed: new Date().toISOString() },
            { id: 3, btag: 'Player3#9012', totalGames: 15, rating: 3500, mainRace: 'ZERG', online: true, lastPlayed: new Date().toISOString() },
        ]

        const fetchSpy = vi.spyOn(pulseService as any, 'fetchRankingData').mockResolvedValue(mockPlayers)

        // Get data from both analytics endpoints
        const playerAnalytics = await AnalyticsService.generatePlayerAnalytics({
            timeframe: 'current',
        })

        const activityAnalysis = await AnalyticsService.generateActivityAnalysis({
            timeframe: 'current',
            groupBy: 'activity',
        })

        // Both should report same player count (2 players with >= 12 games)
        expect(playerAnalytics.metadata.totalPlayers).toBe(2)
        expect(activityAnalysis.metadata.totalPlayers).toBe(2)

        // Activity metrics should be consistent
        expect(playerAnalytics.playerActivity.totalActivePlayers).toBe(2)
        
        fetchSpy.mockRestore()
    })

    it('should handle edge case: threshold change requires cache invalidation awareness', async () => {
        // This test documents the current behavior: changing threshold does not auto-invalidate cache
        // This is acceptable since RANKING_MIN_GAMES is set at deployment time
        
        process.env.RANKING_MIN_GAMES = '10'

        const mockPlayers = [
            { id: 1, btag: 'Player1#1234', totalGames: 15, rating: 4500 },
            { id: 2, btag: 'Player2#5678', totalGames: 5, rating: 4000 },
        ]

        const fetchSpy = vi.spyOn(pulseService as any, 'fetchRankingData').mockResolvedValue(mockPlayers)

        // First call with threshold 10
        const firstResult = await pulseService.getRanking()
        expect(firstResult).toHaveLength(1)

        // Clear cache before threshold change
        pulseService.clearCaches()

        // Change threshold
        process.env.RANKING_MIN_GAMES = '5'

        // Second call with new threshold (cache cleared)
        const secondResult = await pulseService.getRanking()
        expect(secondResult).toHaveLength(2)

        fetchSpy.mockRestore()
    })
})
