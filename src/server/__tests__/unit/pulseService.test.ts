import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock functions to avoid initialization issues
const hoisted = vi.hoisted(() => ({
    mockHttpGet: vi.fn(),
    mockEndpoints: {
        searchCharacter: 'character/search',
        listSeasons: 'season/list/all',
        groupTeam: 'group/team',
        characterTeams: 'character-teams',
    },
    mockWithBasePath: vi.fn((path: string) => path),
    mockCacheGet: vi.fn(),
    mockCacheSet: vi.fn(),
    mockCacheClear: vi.fn(),
    mockMetrics: {
        cache_hit_total: 0,
        cache_miss_total: 0,
    },
    mockBumpCache: vi.fn(),
    mockDataDerivationsService: {
        processTeamsToRankedPlayers: vi.fn(),
        filterByMinimumGames: vi.fn(),
    },
    mockGetRankingMinGamesThreshold: vi.fn(() => 20),
}))

vi.mock('../../services/pulseHttpClient', () => ({
    get: hoisted.mockHttpGet,
    endpoints: hoisted.mockEndpoints,
    withBasePath: hoisted.mockWithBasePath,
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
    bumpCache: hoisted.mockBumpCache,
}))

vi.mock('../../services/dataDerivations', () => ({
    DataDerivationsService: hoisted.mockDataDerivationsService,
}))

vi.mock('../../utils/rankingFilters', () => ({
    getRankingMinGamesThreshold: hoisted.mockGetRankingMinGamesThreshold,
}))

vi.mock('../../services/communityDataService', () => ({
    communityDataService: {
        getCommunityData: vi.fn().mockResolvedValue({
            players: [
                { id: '123', btag: 'Player#1234', name: 'Player One' },
                { id: '456', btag: 'Player2#5678', name: 'Player Two' }
            ],
            playerIds: new Set(['123', '456']),
            displayNames: new Map([['Player#1234', 'Player One'], ['Player2#5678', 'Player Two']]),
            playerById: new Map(),
            loadedAt: new Date()
        })
    }
}))

// Import after mocks
import { PulseService, createPulseService } from '../../services/pulseService'
import { RankedPlayer } from '../../../shared/types'

describe('PulseService', () => {
    let service: PulseService
    const { mockHttpGet } = hoisted

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
        })
    })

    describe('searchPlayer', () => {
        it('searches for players and returns results', async () => {
            const mockResults = [{ id: '1', name: 'TestPlayer#123' }]
            mockHttpGet.mockResolvedValueOnce(mockResults)

            const results = await service.searchPlayer('TestPlayer#123')

            expect(mockHttpGet).toHaveBeenCalledWith(
                'character/search',
                { term: 'TestPlayer%23123' },
                {},
                0,
                3
            )
            expect(results).toEqual(mockResults)
        })

        it('wraps a non-array response in an array', async () => {
            const mockResult = { id: '1', name: 'TestPlayer' }
            mockHttpGet.mockResolvedValueOnce(mockResult)

            const results = await service.searchPlayer('TestPlayer')

            expect(results).toEqual([mockResult])
        })

        it('throws a standardized error on HTTP failure', async () => {
            const mockError = { message: 'Network error', response: { status: 500 }, code: 'NET' }
            mockHttpGet.mockRejectedValueOnce(mockError)
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            await expect(service.searchPlayer('TestPlayer')).rejects.toMatchObject({
                error: 'Network error',
                code: 500,
                context: { searchTerm: 'TestPlayer' },
            })

            expect(consoleSpy).toHaveBeenCalledWith(
                '[PulseService.searchPlayer] Search failed:',
                expect.objectContaining({ error: 'Network error' })
            )
            consoleSpy.mockRestore()
        })
    })

    describe('getCurrentSeason', () => {
        it('returns the US region season', async () => {
            const mockSeasons = [
                { region: 'EU', battlenetId: 'eu-1' },
                { region: 'US', battlenetId: '12345' },
            ]
            mockHttpGet.mockResolvedValueOnce(mockSeasons)

            const result = await service.getCurrentSeason()

            expect(result).toBe('12345')
        })

        it('deduplicates concurrent calls via request cache', async () => {
            const mockSeasons = [{ region: 'US', battlenetId: '12345' }]
            mockHttpGet.mockResolvedValue(mockSeasons)

            const [r1, r2] = await Promise.all([
                service.getCurrentSeason(),
                service.getCurrentSeason(),
            ])

            expect(r1).toBe('12345')
            expect(r2).toBe('12345')
            expect(mockHttpGet).toHaveBeenCalledTimes(1)
        })
    })

    describe('getDisplayNameFromCsv', () => {
        it('returns display name after CSV data is loaded via getRanking', async () => {
            // Trigger CSV loading by calling getRanking (communityDataService mock returns Player#1234 → Player One)
            hoisted.mockCacheGet.mockReturnValueOnce(null)
            mockHttpGet
                .mockResolvedValueOnce([{ region: 'US', battlenetId: '12345' }]) // getCurrentSeason
                .mockResolvedValueOnce([]) // fetchRankedTeams
            hoisted.mockDataDerivationsService.processTeamsToRankedPlayers.mockReturnValueOnce([])
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce([])

            await service.getRanking()

            expect(service.getDisplayNameFromCsv('Player#1234')).toBe('Player One')
            expect(service.getDisplayNameFromCsv('NonExistent#999')).toBeNull()
        })

        it('returns null when no CSV data is loaded', () => {
            expect(service.getDisplayNameFromCsv('Player#1234')).toBeNull()
        })

        it('returns null for empty or missing input', () => {
            expect(service.getDisplayNameFromCsv(undefined as any)).toBeNull()
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

        it('returns cached data when available and ALWAYS applies minimum games filter', async () => {
            hoisted.mockGetRankingMinGamesThreshold.mockReturnValueOnce(20)
            hoisted.mockCacheGet.mockReturnValueOnce(mockRankedPlayers)
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce(mockRankedPlayers)

            const result = await service.getRanking()

            expect(result).toEqual(mockRankedPlayers)
            expect(hoisted.mockMetrics.cache_hit_total).toBe(1)
            expect(hoisted.mockBumpCache).toHaveBeenCalledWith(true)
            expect(hoisted.mockGetRankingMinGamesThreshold).toHaveBeenCalled()
            expect(hoisted.mockDataDerivationsService.filterByMinimumGames).toHaveBeenCalledWith(mockRankedPlayers, 20)
        })

        it('accepts optional override parameter for testing purposes', async () => {
            hoisted.mockCacheGet.mockReturnValueOnce(mockRankedPlayers)
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce(mockRankedPlayers)

            const result = await service.getRanking(5)

            expect(result).toEqual(mockRankedPlayers)
            expect(hoisted.mockGetRankingMinGamesThreshold).not.toHaveBeenCalled()
            expect(hoisted.mockDataDerivationsService.filterByMinimumGames).toHaveBeenCalledWith(mockRankedPlayers, 5)
        })

        it('fetches fresh data when cache is empty', async () => {
            hoisted.mockCacheGet.mockReturnValueOnce(null)
            mockHttpGet
                .mockResolvedValueOnce([{ region: 'US', battlenetId: '12345' }]) // getCurrentSeason
                .mockResolvedValueOnce([]) // fetchRankedTeams
            hoisted.mockDataDerivationsService.processTeamsToRankedPlayers.mockReturnValueOnce(mockRankedPlayers)
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce(mockRankedPlayers)

            const result = await service.getRanking()

            expect(result).toEqual(mockRankedPlayers)
            expect(hoisted.mockMetrics.cache_miss_total).toBe(1)
            expect(hoisted.mockBumpCache).toHaveBeenCalledWith(false)
            expect(hoisted.mockCacheSet).toHaveBeenCalledWith('snapShot', mockRankedPlayers)
        })

        it('implements anti-stampede protection for concurrent requests', async () => {
            const { communityDataService } = await import('../../services/communityDataService')

            hoisted.mockCacheGet.mockReturnValue(null)
            vi.mocked(communityDataService.getCommunityData).mockResolvedValue({
                players: [{ id: '123', btag: 'Player#1234', name: 'Player One' }],
                playerIds: new Set(['123']),
                displayNames: new Map([['Player#1234', 'Player One']]),
                playerById: new Map(),
                loadedAt: new Date()
            })
            mockHttpGet
                .mockResolvedValueOnce([{ region: 'US', battlenetId: '12345' }]) // getCurrentSeason
                .mockResolvedValueOnce([]) // fetchRankedTeams
            hoisted.mockDataDerivationsService.processTeamsToRankedPlayers.mockReturnValue(mockRankedPlayers)
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValue(mockRankedPlayers)

            const [result1, result2, result3] = await Promise.all([
                service.getRanking(),
                service.getRanking(),
                service.getRanking(),
            ])

            expect(result1).toEqual(mockRankedPlayers)
            expect(result2).toEqual(mockRankedPlayers)
            expect(result3).toEqual(mockRankedPlayers)
            expect(vi.mocked(communityDataService.getCommunityData)).toHaveBeenCalledTimes(1)
        })

        it('handles empty player list gracefully', async () => {
            const { communityDataService } = await import('../../services/communityDataService')

            hoisted.mockCacheGet.mockReturnValueOnce(null)
            vi.mocked(communityDataService.getCommunityData).mockResolvedValueOnce({
                players: [],
                playerIds: new Set(),
                displayNames: new Map(),
                playerById: new Map(),
                loadedAt: new Date()
            })
            mockHttpGet.mockResolvedValueOnce([{ region: 'US', battlenetId: '64' }]) // getCurrentSeason
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce([])

            const result = await service.getRanking()

            expect(result).toEqual([])
            // getCurrentSeason was called but fetchRankedTeams was not
            expect(mockHttpGet).toHaveBeenCalledTimes(1)
        })

        it('handles CSV read errors gracefully', async () => {
            const { communityDataService } = await import('../../services/communityDataService')

            hoisted.mockCacheGet.mockReturnValueOnce(null)
            vi.mocked(communityDataService.getCommunityData).mockRejectedValueOnce(new Error('CSV read failed'))
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce([])
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
            mockHttpGet.mockResolvedValueOnce([]) // empty seasons → undefined battlenetId
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce([])
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await service.getRanking()

            expect(result).toEqual([])
            expect(consoleSpy).toHaveBeenCalledWith('[PulseService.fetchRankingData] Error:', expect.any(Error))
            consoleSpy.mockRestore()
        })

        it('handles API errors gracefully', async () => {
            hoisted.mockCacheGet.mockReturnValueOnce(null)
            mockHttpGet
                .mockResolvedValueOnce([{ region: 'US', battlenetId: '12345' }]) // getCurrentSeason
                .mockRejectedValueOnce(new Error('API error')) // fetchRankedTeams
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce([])
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await service.getRanking()

            expect(result).toEqual([])
            expect(consoleSpy).toHaveBeenCalledWith('[PulseService.fetchRankingData] Error:', expect.any(Error))
            consoleSpy.mockRestore()
        })
    })

    describe('executeRequest', () => {
        it('calls httpGet with path and params', async () => {
            const mockResponse = { success: true }
            mockHttpGet.mockResolvedValueOnce(mockResponse)

            const result = await service.executeRequest('/test', { param: 'value' })

            expect(mockHttpGet).toHaveBeenCalledWith('/test', { param: 'value' }, {}, 0, 3)
            expect(result).toEqual(mockResponse)
        })
    })

    describe('fetchRankedTeams', () => {
        it('fetches ranked teams for given player IDs and season', async () => {
            const mockTeams = [{ id: 1, members: [] }]
            mockHttpGet.mockResolvedValueOnce(mockTeams)

            const result = await service.fetchRankedTeams(['123', '456'], 12345)

            expect(mockHttpGet).toHaveBeenCalledWith(expect.stringContaining('character-teams'))
            expect(result).toEqual(mockTeams)
        })
    })

    describe('clearCaches', () => {
        it('clears all caches and resets inflight promise', () => {
            service.clearCaches()

            expect(hoisted.mockCacheClear).toHaveBeenCalled()
        })
    })
})
