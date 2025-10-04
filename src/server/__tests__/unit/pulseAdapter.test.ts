import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoist mock functions to avoid initialization issues
const hoisted = vi.hoisted(() => ({
    mockHttpGet: vi.fn(),
    mockEndpoints: {
        searchCharacter: 'character/search',
        listSeasons: 'season/list/all',
        groupTeam: 'group/team',
        characterTeams: 'character-teams',
    },
    mockWithBasePath: vi.fn((path: string) => path)
}))

vi.mock('../../services/pulseHttpClient', () => ({
    get: hoisted.mockHttpGet,
    endpoints: hoisted.mockEndpoints,
    withBasePath: hoisted.mockWithBasePath,
}))

// Import after mocks
import { 
    PulseAdapter, 
    createPulseAdapter, 
    pulseAdapter, 
    PulseRequestCache,
    pulseRequestCache 
} from '../../services/pulseAdapter'

describe('PulseAdapter', () => {
    let adapter: PulseAdapter
    const { mockHttpGet } = hoisted

    beforeEach(() => {
        vi.clearAllMocks()
        adapter = createPulseAdapter()
    })

    describe('constructor and configuration', () => {
        it('uses default configuration when no config provided', () => {
            const config = adapter.getConfig()
            expect(config.maxRetries).toBe(3)
            expect(config.chunkSize).toBe(100)
            expect(config.apiTimeout).toBe(8000)
            expect(config.rateLimit).toBe(10)
        })

        it('allows configuration overrides', () => {
            const customAdapter = createPulseAdapter({ 
                maxRetries: 5, 
                chunkSize: 50 
            })
            const config = customAdapter.getConfig()
            expect(config.maxRetries).toBe(5)
            expect(config.chunkSize).toBe(50)
            expect(config.apiTimeout).toBe(8000) // Default preserved
        })

        it('allows runtime configuration updates', () => {
            adapter.updateConfig({ maxRetries: 10 })
            expect(adapter.getConfig().maxRetries).toBe(10)
        })
    })

    describe('searchPlayer', () => {
        it('successfully searches for players with encoded terms', async () => {
            const mockResults = [{ id: '1', name: 'TestPlayer#123' }]
            mockHttpGet.mockResolvedValueOnce(mockResults)

            const results = await adapter.searchPlayer('TestPlayer#123')

            expect(mockHttpGet).toHaveBeenCalledWith(
                'character/search',
                { term: 'TestPlayer%23123' }, // URL encoded
                {},
                0,
                3 // maxRetries
            )
            expect(results).toEqual(mockResults)
        })

        it('handles non-array response by converting to array', async () => {
            const mockResult = { id: '1', name: 'TestPlayer' }
            mockHttpGet.mockResolvedValueOnce(mockResult)

            const results = await adapter.searchPlayer('TestPlayer')

            expect(results).toEqual([mockResult])
        })

        it('filters out falsy values when converting to array', async () => {
            mockHttpGet.mockResolvedValueOnce(null)

            const results = await adapter.searchPlayer('TestPlayer')

            expect(results).toEqual([])
        })

        it('throws standardized error on HTTP failure', async () => {
            const mockError = {
                message: 'Network error',
                response: { status: 500 },
                code: 'NETWORK_ERROR'
            }
            mockHttpGet.mockRejectedValueOnce(mockError)

            await expect(adapter.searchPlayer('TestPlayer'))
                .rejects.toMatchObject({
                    error: 'Network error',
                    code: 500,
                    context: { searchTerm: 'TestPlayer' }
                })
        })
    })

    describe('getCurrentSeason', () => {
        it('returns US region season when available', async () => {
            const mockSeasons = [
                { region: 'EU', battlenetId: 'eu-season-1' },
                { region: 'US', battlenetId: 'us-season-1' },
                { region: 'KR', battlenetId: 'kr-season-1' }
            ]
            mockHttpGet.mockResolvedValueOnce(mockSeasons)

            const seasonId = await adapter.getCurrentSeason()

            expect(seasonId).toBe('us-season-1')
        })

        it('falls back to first season when US region unavailable', async () => {
            const mockSeasons = [
                { region: 'EU', battlenetId: 'eu-season-1' },
                { region: 'KR', battlenetId: 'kr-season-1' }
            ]
            mockHttpGet.mockResolvedValueOnce(mockSeasons)

            const seasonId = await adapter.getCurrentSeason()

            expect(seasonId).toBe('eu-season-1')
        })

        it('throws error when seasons unavailable', async () => {
            mockHttpGet.mockRejectedValueOnce(new Error('API unavailable'))

            await expect(adapter.getCurrentSeason())
                .rejects.toMatchObject({
                    error: 'API unavailable',
                    context: { operation: 'getCurrentSeason' }
                })
        })
    })



    describe('executeRequest', () => {
        it('executes generic requests with proper parameters', async () => {
            const mockResponse = { data: 'test' }
            mockHttpGet.mockResolvedValueOnce(mockResponse)

            const result = await adapter.executeRequest(
                'test/endpoint',
                { param1: 'value1' },
                { headers: { 'Custom-Header': 'test' } }
            )

            expect(mockHttpGet).toHaveBeenCalledWith(
                'test/endpoint',
                { param1: 'value1' },
                { headers: { 'Custom-Header': 'test' } },
                0,
                3
            )
            expect(result).toEqual(mockResponse)
        })

        it('provides default empty objects for optional parameters', async () => {
            const mockResponse = { data: 'test' }
            mockHttpGet.mockResolvedValueOnce(mockResponse)

            await adapter.executeRequest('test/endpoint')

            expect(mockHttpGet).toHaveBeenCalledWith(
                'test/endpoint',
                {},
                {},
                0,
                3
            )
        })
    })

    describe('error standardization', () => {
        it('preserves already-standardized errors', async () => {
            const standardizedError = {
                error: 'Already standardized',
                code: 'CUSTOM_ERROR',
                context: { test: true }
            }
            mockHttpGet.mockRejectedValueOnce(standardizedError)

            await expect(adapter.searchPlayer('test'))
                .rejects.toEqual(standardizedError)
        })

        it('converts axios errors to standardized format', async () => {
            const axiosError = {
                message: 'Request failed',
                response: { status: 404 },
                code: 'ENOTFOUND'
            }
            mockHttpGet.mockRejectedValueOnce(axiosError)

            await expect(adapter.searchPlayer('test'))
                .rejects.toMatchObject({
                    error: 'Request failed',
                    code: 404,
                    context: { searchTerm: 'test' }
                })
        })

        it('handles unknown error types', async () => {
            const unknownError = new Error('Unknown string error')
            mockHttpGet.mockRejectedValueOnce(unknownError)

            await expect(adapter.searchPlayer('test'))
                .rejects.toMatchObject({
                    error: 'Unknown string error',
                    code: 'UNKNOWN',
                    context: { searchTerm: 'test' }
                })
        })
    })
})

describe('PulseRequestCache', () => {
    let cache: PulseRequestCache

    beforeEach(() => {
        cache = new PulseRequestCache()
    })

    afterEach(() => {
        cache.clearCache()
    })

    describe('executeWithCache', () => {
        it('executes operation and returns result', async () => {
            const mockOperation = vi.fn().mockResolvedValue('test-result')

            const result = await cache.executeWithCache('test-key', mockOperation)

            expect(mockOperation).toHaveBeenCalledOnce()
            expect(result).toBe('test-result')
        })

        it('shares in-flight requests for same cache key', async () => {
            const mockOperation = vi.fn().mockImplementation(() => 
                new Promise(resolve => setTimeout(() => resolve('shared-result'), 10))
            )

            // Start multiple concurrent requests with same key
            const promises = [
                cache.executeWithCache('shared-key', mockOperation),
                cache.executeWithCache('shared-key', mockOperation),
                cache.executeWithCache('shared-key', mockOperation)
            ]

            const results = await Promise.all(promises)

            expect(mockOperation).toHaveBeenCalledOnce() // Only one actual execution
            expect(results).toEqual(['shared-result', 'shared-result', 'shared-result'])
        })

        it('allows different cache keys to execute independently', async () => {
            const mockOperation1 = vi.fn().mockResolvedValue('result-1')
            const mockOperation2 = vi.fn().mockResolvedValue('result-2')

            const [result1, result2] = await Promise.all([
                cache.executeWithCache('key-1', mockOperation1),
                cache.executeWithCache('key-2', mockOperation2)
            ])

            expect(mockOperation1).toHaveBeenCalledOnce()
            expect(mockOperation2).toHaveBeenCalledOnce()
            expect(result1).toBe('result-1')
            expect(result2).toBe('result-2')
        })

        it('cleans up cache entry after operation completes', async () => {
            const mockOperation = vi.fn().mockResolvedValue('test-result')

            await cache.executeWithCache('cleanup-key', mockOperation)
            
            // Wait for cleanup timeout
            await new Promise(resolve => setTimeout(resolve, 150))

            // Second call should execute operation again
            await cache.executeWithCache('cleanup-key', mockOperation)

            expect(mockOperation).toHaveBeenCalledTimes(2)
        })

        it('cleans up cache entry on operation failure', async () => {
            const errorOp = vi.fn().mockRejectedValue(new Error('Operation failed'))
            const successOp = vi.fn().mockResolvedValue('success')

            await expect(cache.executeWithCache('error-key', errorOp))
                .rejects.toThrow('Operation failed')

            // Cache should be cleared immediately on error, so new operation should execute
            const result = await cache.executeWithCache('error-key', successOp)

            expect(errorOp).toHaveBeenCalledOnce()
            expect(successOp).toHaveBeenCalledOnce()
            expect(result).toBe('success')
        })
    })

    describe('clearCache', () => {
        it('clears all cached requests', async () => {
            const mockOperation1 = vi.fn().mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve('result-1'), 100))
            )
            const mockOperation2 = vi.fn().mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve('result-2'), 100))
            )

            // Start operations but don't wait
            const promise1 = cache.executeWithCache('key-1', mockOperation1)
            const promise2 = cache.executeWithCache('key-2', mockOperation2)

            // Clear cache
            cache.clearCache()

            // Original promises should still complete
            const [result1, result2] = await Promise.all([promise1, promise2])
            expect(result1).toBe('result-1')
            expect(result2).toBe('result-2')

            // New requests should execute fresh operations
            await cache.executeWithCache('key-1', mockOperation1)
            await cache.executeWithCache('key-2', mockOperation2)

            expect(mockOperation1).toHaveBeenCalledTimes(2)
            expect(mockOperation2).toHaveBeenCalledTimes(2)
        })
    })
})

describe('exported singletons', () => {
    it('exports singleton pulse adapter instance', () => {
        expect(pulseAdapter).toBeInstanceOf(PulseAdapter)
    })

    it('exports singleton request cache instance', () => {
        expect(pulseRequestCache).toBeInstanceOf(PulseRequestCache)
    })

    it('createPulseAdapter factory creates new instances', () => {
        const adapter1 = createPulseAdapter()
        const adapter2 = createPulseAdapter()
        
        expect(adapter1).toBeInstanceOf(PulseAdapter)
        expect(adapter2).toBeInstanceOf(PulseAdapter)
        expect(adapter1).not.toBe(adapter2)
    })
})