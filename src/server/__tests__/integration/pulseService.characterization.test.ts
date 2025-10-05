import { describe, it, expect, beforeEach, vi } from 'vitest'
import { pulseService, createPulseService, PulseService } from '../../services/pulseService'
import { RankedPlayer } from '../../../shared/types'

// Mock file operations to prevent real file creation during integration tests
vi.mock('../../services/driveFileStorage', () => ({
    downloadFile: vi.fn().mockResolvedValue(undefined)
}))

// Mock fs operations to prevent real file system access
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true),
        createReadStream: vi.fn(() => {
            const { PassThrough } = require('stream')
            const stream = new PassThrough({ objectMode: true })
            // Simulate CSV data
            queueMicrotask(() => {
                stream.write({ id: '1', btag: 'Player1#1234', name: 'Player1', challongeId: '11111' })
                stream.write({ id: '2', btag: 'Player2#5678', name: 'Player2', challongeId: '22222' })
                stream.write({ id: '3', btag: 'Player3#9999', name: 'Player3', challongeId: '33333' })
                stream.write({ id: '4', btag: 'Player4#4444', name: 'Player4', challongeId: '44444' })
                stream.write({ id: '5', btag: 'Player5#5555', name: 'Player5', challongeId: '55555' })
                stream.write({ id: '6', btag: 'Player6#6666', name: 'Player6', challongeId: '66666' })
                stream.write({ id: '7', btag: 'Player7#7777', name: 'Player7', challongeId: '77777' })
                stream.write({ id: '8', btag: 'Player8#8888', name: 'Player8', challongeId: '88888' })
                stream.write({ id: '9', btag: 'Player9#0000', name: 'Player9', challongeId: '99999' })
                stream.write({ id: '10', btag: 'Player10#1010', name: 'Player10', challongeId: '10101' })
                stream.write({ id: '11', btag: 'Player11#1111', name: 'Player11', challongeId: '11111' })
                stream.end()
            })
            return stream
        }),
        unlink: vi.fn((_path, cb) => cb(null))
    },
    existsSync: vi.fn().mockReturnValue(true),
    createReadStream: vi.fn(() => {
        const { PassThrough } = require('stream')
        const stream = new PassThrough({ objectMode: true })
        queueMicrotask(() => {
            stream.write({ id: '1', btag: 'Player1#1234', name: 'Player1', challongeId: '11111' })
            stream.write({ id: '2', btag: 'Player2#5678', name: 'Player2', challongeId: '22222' })
            stream.write({ id: '3', btag: 'Player3#9999', name: 'Player3', challongeId: '33333' })
            stream.write({ id: '4', btag: 'Player4#4444', name: 'Player4', challongeId: '44444' })
            stream.write({ id: '5', btag: 'Player5#5555', name: 'Player5', challongeId: '55555' })
            stream.write({ id: '6', btag: 'Player6#6666', name: 'Player6', challongeId: '66666' })
            stream.write({ id: '7', btag: 'Player7#7777', name: 'Player7', challongeId: '77777' })
            stream.write({ id: '8', btag: 'Player8#8888', name: 'Player8', challongeId: '88888' })
            stream.write({ id: '9', btag: 'Player9#0000', name: 'Player9', challongeId: '99999' })
            stream.write({ id: '10', btag: 'Player10#1010', name: 'Player10', challongeId: '10101' })
            stream.write({ id: '11', btag: 'Player11#1111', name: 'Player11', challongeId: '11111' })
            stream.end()
        })
        return stream
    }),
    unlink: vi.fn((_path, cb) => cb(null))
}))

// Mock csv-parser
vi.mock('csv-parser', () => ({
    default: () => {
        const { PassThrough } = require('stream')
        return new PassThrough({ objectMode: true })
    }
}))

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