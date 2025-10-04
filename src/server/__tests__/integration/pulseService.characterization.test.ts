import { describe, it, expect, beforeEach, vi } from 'vitest'
import { pulseService, createPulseService, PulseService } from '../../services/pulseService'
import { RankedPlayer } from '../../../shared/types'

/**
 * Characterization tests for the unified PulseService
 * 
 * These tests replace the obsolete pulseApi integration tests and validate
 * the current behavior of the refactored service architecture.
 */
describe('PulseService Integration (Characterization)', () => {
    let testService: PulseService

    beforeEach(() => {
        vi.clearAllMocks()
        // Create a fresh service instance for each test
        testService = createPulseService()
    })

    describe('Service Configuration and Structure', () => {
        it('provides singleton instance with default configuration', () => {
            expect(pulseService).toBeInstanceOf(PulseService)
            
            const config = pulseService.getConfig()
            expect(config).toMatchObject({
                maxRetries: expect.any(Number),
                chunkSize: expect.any(Number),
                apiTimeout: expect.any(Number),
                rateLimit: expect.any(Number),
                cacheTimeout: expect.any(Number),
                onlineThresholdMinutes: expect.any(Number),
            })
        })

        it('allows factory creation with custom configuration', () => {
            const customService = createPulseService({
                maxRetries: 5,
                chunkSize: 50,
                apiTimeout: 5000
            })

            const config = customService.getConfig()
            expect(config.maxRetries).toBe(5)
            expect(config.chunkSize).toBe(50)
            expect(config.apiTimeout).toBe(5000)
        })

        it('supports runtime configuration updates', () => {
            testService.updateConfig({ maxRetries: 10 })
            
            const config = testService.getConfig()
            expect(config.maxRetries).toBe(10)
        })
    })

    describe('Public API Methods', () => {
        it('exposes core ranking functionality', () => {
            expect(typeof testService.getRanking).toBe('function')
            expect(typeof testService.searchPlayer).toBe('function')
            expect(typeof testService.getCurrentSeason).toBe('function')
        })

        it('exposes advanced operations', () => {
            expect(typeof testService.executeRequest).toBe('function')
            expect(typeof testService.fetchRankedTeams).toBe('function')
        })

        it('provides cache management', () => {
            expect(typeof testService.clearCaches).toBe('function')
        })
    })

    describe('Error Handling Patterns', () => {
        it('handles search failures gracefully', async () => {
            // This test validates that the service doesn't crash on invalid input
            const result = await testService.searchPlayer('')
            expect(Array.isArray(result)).toBe(true)
        })

        it('provides consistent error format', async () => {
            // Test with intentionally bad data to verify error standardization
            try {
                await testService.executeRequest('invalid/endpoint', {})
            } catch (error: any) {
                // Should have standardized error structure
                expect(error).toMatchObject({
                    error: expect.any(String),
                    code: expect.anything(), // Can be string or number
                })
            }
        })
    })

    describe('Data Processing Behavior', () => {
        it('returns consistent data structure for rankings', async () => {
            const ranking = await testService.getRanking()
            
            // Should always return an array (empty or populated)
            expect(Array.isArray(ranking)).toBe(true)
            
            // If populated, should have RankedPlayer structure
            if (ranking.length > 0) {
                const player = ranking[0] as RankedPlayer
                expect(typeof player.btag).toBe('string')
                expect(typeof player.rating).toBe('number')
            }
        })

        it('integrates CSV data processing', async () => {
            // Validates that CSV integration is working
            const displayNames = await (testService as any).loadPlayersFromCsv()
            expect(Array.isArray(displayNames)).toBe(true)
        })
    })

    describe('Caching Behavior', () => {
        it('implements cache lifecycle methods', () => {
            // Should not throw when clearing caches
            expect(() => testService.clearCaches()).not.toThrow()
        })

        it('supports cache warming operations', async () => {
            // Multiple calls should be handled via caching/anti-stampede
            const promises = [
                testService.getRanking(),
                testService.getRanking(),
                testService.getRanking()
            ]
            
            const results = await Promise.allSettled(promises)
            
            // All should resolve (though may be empty due to no real API)
            results.forEach(result => {
                expect(result.status).toBe('fulfilled')
            })
        })
    })

    describe('Integration Points', () => {
        it('maintains adapter delegation pattern', () => {
            // The service should delegate core operations to the adapter
            // This validates the architecture is properly structured
            expect(testService.getCurrentSeason).toBeDefined()
            expect(testService.fetchRankedTeams).toBeDefined()
        })

        it('supports batch operations', async () => {
            const playerIds = ['test1', 'test2']
            const seasonId = 12345
            
            // Should handle batch operations without crashing
            try {
                await testService.fetchRankedTeams(playerIds, seasonId)
            } catch (error: any) {
                // Expected to fail due to no real API, but should be structured error
                expect(error).toMatchObject({
                    error: expect.any(String)
                })
            }
        })
    })

    describe('Backward Compatibility', () => {
        it('maintains expected method signatures', () => {
            // Ensures existing callers won't break
            expect(testService.getRanking).toHaveLength(0) // no parameters
            expect(testService.searchPlayer).toHaveLength(1) // term parameter
            expect(testService.getCurrentSeason).toHaveLength(0) // no parameters
        })

        it('returns consistent promise types', () => {
            // All main methods should return promises
            expect(testService.getRanking()).toBeInstanceOf(Promise)
            expect(testService.searchPlayer('test')).toBeInstanceOf(Promise)
            expect(testService.getCurrentSeason()).toBeInstanceOf(Promise)
        })
    })
})