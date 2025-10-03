import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock functions to avoid initialization issues
const hoisted = vi.hoisted(() => ({
    mockReadCsv: vi.fn(),
    mockBumpPulseReq: vi.fn(),
    mockBumpPulseErr: vi.fn(),
    mockCacheGet: vi.fn(),
    mockCacheSet: vi.fn(),
    mockCacheClear: vi.fn(),
    mockMetrics: {
        cache_hit_total: 0,
        cache_miss_total: 0,
    },
    mockBumpCache: vi.fn(),
    mockPulseAdapter: {
        searchPlayer: vi.fn(),
        getCurrentSeason: vi.fn(),
        fetchRankedTeams: vi.fn(),
        updateConfig: vi.fn(),
        executeRequest: vi.fn(),
    },
    mockPulseRequestCache: {
        executeWithCache: vi.fn(),
        clearCache: vi.fn(),
    },
    mockDataDerivationsService: {
        processTeamsToRankedPlayers: vi.fn(),
    },
}))

vi.mock('../../utils/csvParser', () => ({
    readCsv: hoisted.mockReadCsv,
}))

vi.mock('../../utils/cache', () => ({
    default: {
        get: hoisted.mockCacheGet,
        set: hoisted.mockCacheSet,
        clear: hoisted.mockCacheClear,
    },
}))

vi.mock('../../metrics/lite', () => ({
    metrics: hoisted.mockMetrics,
}))

vi.mock('../../observability/requestContext', () => ({
    bumpCache: hoisted.mockBumpCache,
    bumpPulseReq: hoisted.mockBumpPulseReq,
    bumpPulseErr: hoisted.mockBumpPulseErr,
}))

vi.mock('../pulseAdapter', () => ({
    PulseAdapter: vi.fn().mockImplementation(() => hoisted.mockPulseAdapter),
    PulseRequestCache: vi.fn().mockImplementation(() => hoisted.mockPulseRequestCache),
}))

vi.mock('../dataDerivations', () => ({
    DataDerivationsService: hoisted.mockDataDerivationsService,
}))

// Import after mocks
import { PulseService, createPulseService } from '../../services/pulseService'
import { RankedPlayer } from '../../../shared/types'

describe('PulseService', () => {
    let service: PulseService

    beforeEach(() => {
        vi.clearAllMocks()
        // Reset metrics
        hoisted.mockMetrics.cache_hit_total = 0
        hoisted.mockMetrics.cache_miss_total = 0

        service = createPulseService()
    })

    describe('constructor and configuration', () => {
        it('creates service with default configuration', () => {
            const config = service.getConfig()
            expect(config.maxRetries).toBe(3)
            expect(config.chunkSize).toBe(100)
            expect(config.apiTimeout).toBe(8000)
            expect(config.rateLimit).toBe(10)
        })

        it('allows configuration overrides', () => {
            const customService = createPulseService({
                maxRetries: 5,
                chunkSize: 50,
                apiTimeout: 5000,
            })
            const config = customService.getConfig()
            expect(config.maxRetries).toBe(5)
            expect(config.chunkSize).toBe(50)
            expect(config.apiTimeout).toBe(5000)
            expect(config.rateLimit).toBe(10) // Default preserved
        })

        it('allows runtime configuration updates', () => {
            service.updateConfig({ maxRetries: 10, rateLimit: 15 })
            const config = service.getConfig()
            expect(config.maxRetries).toBe(10)
            expect(config.rateLimit).toBe(15)
            expect(hoisted.mockPulseAdapter.updateConfig).toHaveBeenCalledWith({
                maxRetries: 10,
                chunkSize: 100,
                apiTimeout: 8000,
                rateLimit: 15,
            })
        })
    })

    describe('searchPlayer', () => {
        it('delegates to pulse adapter and returns results', async () => {
            const mockResults = [{ id: '1', name: 'TestPlayer#123' }]
            hoisted.mockPulseAdapter.searchPlayer.mockResolvedValueOnce(mockResults)

            const results = await service.searchPlayer('TestPlayer#123')

            expect(hoisted.mockPulseAdapter.searchPlayer).toHaveBeenCalledWith('TestPlayer#123')
            expect(results).toEqual(mockResults)
        })

        it('handles adapter errors and logs them', async () => {
            const mockError = new Error('Network error')
            hoisted.mockPulseAdapter.searchPlayer.mockRejectedValueOnce(mockError)
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            await expect(service.searchPlayer('TestPlayer')).rejects.toThrow('Network error')

            expect(consoleSpy).toHaveBeenCalledWith('[PulseService.searchPlayer] Search failed:', mockError)
            consoleSpy.mockRestore()
        })
    })

    describe('getCurrentSeason', () => {
        it('uses request cache to avoid duplicate calls', async () => {
            const mockSeason = '12345'
            hoisted.mockPulseRequestCache.executeWithCache.mockImplementation((key, operation) => {
                expect(key).toBe('current-season')
                return operation()
            })
            hoisted.mockPulseAdapter.getCurrentSeason.mockResolvedValueOnce(mockSeason)

            const result = await service.getCurrentSeason()

            expect(result).toBe(mockSeason)
            expect(hoisted.mockPulseRequestCache.executeWithCache).toHaveBeenCalledWith(
                'current-season',
                expect.any(Function)
            )
        })
    })

    describe('getDisplayNameFromCsv', () => {
        it('returns display name when CSV data is loaded', async () => {
            const mockCsvData = [
                { id: '123', name: 'Player One', btag: 'Player#1234' },
                { id: '456', name: 'Player Two', btag: 'Player#5678' },
            ]
            hoisted.mockReadCsv.mockResolvedValueOnce(mockCsvData)

            // Load CSV data by calling getRanking (which loads CSV internally)
            hoisted.mockCacheGet.mockReturnValueOnce(null) // No cache hit
            hoisted.mockPulseAdapter.getCurrentSeason.mockResolvedValueOnce('12345')
            hoisted.mockPulseAdapter.fetchRankedTeams.mockResolvedValueOnce([])
            hoisted.mockDataDerivationsService.processTeamsToRankedPlayers.mockReturnValueOnce([])

            await service.getRanking()

            const displayName = service.getDisplayNameFromCsv('123')
            expect(displayName).toBe('Player One')

            const nonExistentName = service.getDisplayNameFromCsv('999')
            expect(nonExistentName).toBeNull()
        })

        it('returns null when no CSV data loaded', () => {
            const result = service.getDisplayNameFromCsv('123')
            expect(result).toBeNull()
        })

        it('handles undefined/null character IDs', () => {
            expect(service.getDisplayNameFromCsv(undefined)).toBeNull()
            expect(service.getDisplayNameFromCsv('')).toBeNull()
        })
    })

    describe('getRanking', () => {
        const mockRankedPlayers: RankedPlayer[] = [
            {
                id: 123,
                name: 'Player One',
                btag: 'Player#1234',
                discriminator: 1234,
                globalRank: 1,
                regionRank: 1,
                rating: 5000,
                wins: 80,
                losses: 20,
                ties: 0,
                leagueType: 6,
                leagueRank: 1,
                online: true,
                lastPlayed: '2023-10-01T12:00:00Z',
                lastDatePlayed: '2023-10-01',
                mainRace: 'T',
                totalGames: 100,
                gamesPerRace: { TERRAN: 100, PROTOSS: 0, ZERG: 0, RANDOM: 0 },
                members: {
                    raceGames: { TERRAN: 100 },
                    account: {
                        id: 123,
                        tag: 'Player',
                        battleTag: 'Player#1234',
                        discriminator: 1234,
                    },
                    clan: null,
                },
            },
        ]

        it('returns cached data when available', async () => {
            hoisted.mockCacheGet.mockReturnValueOnce(mockRankedPlayers)

            const result = await service.getRanking()

            expect(result).toEqual(mockRankedPlayers)
            expect(hoisted.mockMetrics.cache_hit_total).toBe(1)
            expect(hoisted.mockBumpCache).toHaveBeenCalledWith(true)
            expect(hoisted.mockReadCsv).not.toHaveBeenCalled()
        })

        it('fetches fresh data when cache is empty', async () => {
            const mockCsvData = [{ id: '123', name: 'Player One', btag: 'Player#1234' }]

            hoisted.mockCacheGet.mockReturnValueOnce(null) // No cache
            hoisted.mockReadCsv.mockResolvedValueOnce(mockCsvData)
            hoisted.mockPulseAdapter.getCurrentSeason.mockResolvedValueOnce('12345')
            hoisted.mockPulseAdapter.fetchRankedTeams.mockResolvedValueOnce([])
            hoisted.mockDataDerivationsService.processTeamsToRankedPlayers.mockReturnValueOnce(mockRankedPlayers)

            const result = await service.getRanking()

            expect(result).toEqual(mockRankedPlayers)
            expect(hoisted.mockMetrics.cache_miss_total).toBe(1)
            expect(hoisted.mockBumpCache).toHaveBeenCalledWith(false)
            expect(hoisted.mockCacheSet).toHaveBeenCalledWith('snapShot', mockRankedPlayers)
        })

        it('implements anti-stampede protection for concurrent requests', async () => {
            hoisted.mockCacheGet.mockReturnValue(null) // Always cache miss
            hoisted.mockReadCsv.mockResolvedValue([{ id: '123', name: 'Player', btag: 'Player#1234' }])
            hoisted.mockPulseAdapter.getCurrentSeason.mockResolvedValue('12345')
            hoisted.mockPulseAdapter.fetchRankedTeams.mockResolvedValue([])
            hoisted.mockDataDerivationsService.processTeamsToRankedPlayers.mockReturnValue(mockRankedPlayers)

            // Start multiple concurrent requests
            const promise1 = service.getRanking()
            const promise2 = service.getRanking()
            const promise3 = service.getRanking()

            const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])

            // All should get the same result
            expect(result1).toEqual(mockRankedPlayers)
            expect(result2).toEqual(mockRankedPlayers)
            expect(result3).toEqual(mockRankedPlayers)

            // But CSV should only be read once
            expect(hoisted.mockReadCsv).toHaveBeenCalledTimes(1)
            expect(hoisted.mockPulseAdapter.fetchRankedTeams).toHaveBeenCalledTimes(1)
        })

        it('handles empty CSV data gracefully', async () => {
            hoisted.mockCacheGet.mockReturnValueOnce(null)
            hoisted.mockReadCsv.mockResolvedValueOnce([])

            const result = await service.getRanking()

            expect(result).toEqual([])
            expect(hoisted.mockPulseAdapter.getCurrentSeason).not.toHaveBeenCalled()
        })

        it('handles CSV read errors gracefully', async () => {
            hoisted.mockCacheGet.mockReturnValueOnce(null)
            hoisted.mockReadCsv.mockRejectedValueOnce(new Error('CSV read failed'))
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await service.getRanking()

            expect(result).toEqual([])
            expect(consoleSpy).toHaveBeenCalledWith(
                '[PulseService.loadPlayersFromCsv] Error reading CSV: CSV read failed'
            )
            consoleSpy.mockRestore()
        })

        it('handles missing season gracefully', async () => {
            hoisted.mockCacheGet.mockReturnValueOnce(null)
            hoisted.mockReadCsv.mockResolvedValueOnce([{ id: '123', name: 'Player', btag: 'Player#1234' }])
            hoisted.mockPulseAdapter.getCurrentSeason.mockResolvedValueOnce(undefined)
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await service.getRanking()

            expect(result).toEqual([])
            expect(consoleSpy).toHaveBeenCalledWith('[PulseService.fetchRankingData] Error:', expect.any(Error))
            consoleSpy.mockRestore()
        })

        it('handles API errors gracefully', async () => {
            hoisted.mockCacheGet.mockReturnValueOnce(null)
            hoisted.mockReadCsv.mockResolvedValueOnce([{ id: '123', name: 'Player', btag: 'Player#1234' }])
            hoisted.mockPulseAdapter.getCurrentSeason.mockResolvedValueOnce('12345')
            hoisted.mockPulseAdapter.fetchRankedTeams.mockRejectedValueOnce(new Error('API error'))
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await service.getRanking()

            expect(result).toEqual([])
            expect(consoleSpy).toHaveBeenCalledWith('[PulseService.fetchRankingData] Error:', expect.any(Error))
            consoleSpy.mockRestore()
        })
    })

    describe('executeRequest', () => {
        it('delegates to pulse adapter', async () => {
            const mockResponse = { success: true }
            hoisted.mockPulseAdapter.executeRequest.mockResolvedValueOnce(mockResponse)

            const result = await service.executeRequest('/test', { param: 'value' })

            expect(hoisted.mockPulseAdapter.executeRequest).toHaveBeenCalledWith('/test', { param: 'value' }, {})
            expect(result).toEqual(mockResponse)
        })
    })

    describe('fetchRankedTeams', () => {
        it('delegates to pulse adapter', async () => {
            const mockTeams = [{ id: 1, members: [] }]
            hoisted.mockPulseAdapter.fetchRankedTeams.mockResolvedValueOnce(mockTeams)

            const result = await service.fetchRankedTeams(['123', '456'], 12345)

            expect(hoisted.mockPulseAdapter.fetchRankedTeams).toHaveBeenCalledWith(['123', '456'], 12345)
            expect(result).toEqual(mockTeams)
        })
    })

    describe('clearCaches', () => {
        it('clears all caches and resets inflight promise', () => {
            service.clearCaches()

            expect(hoisted.mockPulseRequestCache.clearCache).toHaveBeenCalled()
            expect(hoisted.mockCacheClear).toHaveBeenCalled()
        })
    })
})
