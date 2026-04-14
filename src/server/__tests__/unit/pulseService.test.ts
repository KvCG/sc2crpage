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
    mockHistoricalCacheGet: vi.fn(),
    mockHistoricalCacheSet: vi.fn(),
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
    historicalRankingCache: {
        get: hoisted.mockHistoricalCacheGet,
        set: hoisted.mockHistoricalCacheSet,
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
                { term: 'TestPlayer#123' },
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

            expect(mockHttpGet).toHaveBeenCalledWith(expect.stringContaining('character-teams'), {}, {}, 0, 3)
            expect(result).toEqual(mockTeams)
        })
    })

    describe('clearCaches', () => {
        it('clears all caches and resets inflight promise', () => {
            service.clearCaches()

            expect(hoisted.mockCacheClear).toHaveBeenCalled()
        })
    })

    describe('getAllSeasons', () => {
        const mockRawSeasons = [
            { battlenetId: 67, region: 'US', year: 2026, number: 2, start: '2026-04-01T00:00:00Z', end: '2026-07-19T06:00:00Z' },
            { battlenetId: 67, region: 'EU', year: 2026, number: 2, start: '2026-03-31T15:00:00Z', end: '2026-07-20T06:00:00Z' },
            { battlenetId: 66, region: 'US', year: 2025, number: 1, start: '2025-10-01T00:00:00Z', end: '2026-03-31T00:00:00Z' },
            { battlenetId: 66, region: 'KR', year: 2025, number: 1, start: '2025-10-01T00:00:00Z', end: '2026-03-31T00:00:00Z' },
        ]

        it('filters to US region only', async () => {
            mockHttpGet.mockResolvedValueOnce(mockRawSeasons)

            const result = await service.getAllSeasons()

            expect(result).toHaveLength(2)
            expect(result.every((s: any) => s.id !== undefined)).toBe(true)
        })

        it('returns seasons sorted newest-first by battlenetId', async () => {
            mockHttpGet.mockResolvedValueOnce(mockRawSeasons)

            const result = await service.getAllSeasons()

            expect(result[0].id).toBe(67)
            expect(result[1].id).toBe(66)
        })

        it('maps to SeasonEntry shape with battlenetId as id', async () => {
            mockHttpGet.mockResolvedValueOnce([mockRawSeasons[0]])

            const result = await service.getAllSeasons()

            expect(result[0]).toEqual({
                id: 67,
                year: 2026,
                number: 2,
                start: '2026-04-01T00:00:00Z',
                end: '2026-07-19T06:00:00Z',
            })
        })

        it('returns empty array when no US seasons found', async () => {
            mockHttpGet.mockResolvedValueOnce([
                { battlenetId: 67, region: 'EU', year: 2026, number: 2, start: '', end: '' },
            ])

            const result = await service.getAllSeasons()

            expect(result).toEqual([])
        })

        it('returns empty array when response is not an array', async () => {
            mockHttpGet.mockResolvedValueOnce(null)

            const result = await service.getAllSeasons()

            expect(result).toEqual([])
        })

        it('deduplicates concurrent calls via request cache', async () => {
            mockHttpGet.mockResolvedValue(mockRawSeasons)

            const [r1, r2] = await Promise.all([
                service.getAllSeasons(),
                service.getAllSeasons(),
            ])

            expect(r1).toEqual(r2)
            expect(mockHttpGet).toHaveBeenCalledTimes(1)
        })

        it('throws standardized error on HTTP failure', async () => {
            const mockError = { message: 'API down', response: { status: 503 }, code: 'NET' }
            mockHttpGet.mockRejectedValueOnce(mockError)
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            await expect(service.getAllSeasons()).rejects.toMatchObject({ code: 503 })

            consoleSpy.mockRestore()
        })
    })

    describe('getRankingForSeason', () => {
        const mockRankedPlayers: RankedPlayer[] = [
            {
                id: 123,
                name: 'Player One',
                btag: 'Player#1234',
                discriminator: 1234,
                globalRank: 1,
                regionRank: 1,
                rating: 4800,
                wins: 50,
                losses: 10,
                ties: 0,
                leagueType: 6,
                leagueRank: 1,
                online: false,
                lastPlayed: '2025-01-01T00:00:00Z',
                lastDatePlayed: '2025-01-01',
                mainRace: 'T',
                totalGames: 60,
                gamesPerRace: { TERRAN: 60 },
                members: { raceGames: { TERRAN: 60 }, account: { id: 123, tag: 'Player', battleTag: 'Player#1234', discriminator: 1234 }, clan: null },
            },
        ]

        it('returns filtered cached data on cache hit', async () => {
            hoisted.mockHistoricalCacheGet.mockReturnValueOnce(mockRankedPlayers)
            hoisted.mockGetRankingMinGamesThreshold.mockReturnValueOnce(10)
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce(mockRankedPlayers)

            const result = await service.getRankingForSeason(67)

            expect(hoisted.mockHistoricalCacheGet).toHaveBeenCalledWith('season:67')
            expect(mockHttpGet).not.toHaveBeenCalled()
            expect(hoisted.mockDataDerivationsService.filterByMinimumGames).toHaveBeenCalledWith(mockRankedPlayers, 10)
            expect(result).toEqual(mockRankedPlayers)
        })

        it('fetches from API on cache miss, stores unfiltered, returns filtered', async () => {
            hoisted.mockHistoricalCacheGet.mockReturnValueOnce(undefined)
            mockHttpGet.mockResolvedValueOnce([]) // fetchRankedTeams
            hoisted.mockDataDerivationsService.processTeamsToRankedPlayers.mockReturnValueOnce(mockRankedPlayers)
            hoisted.mockGetRankingMinGamesThreshold.mockReturnValueOnce(10)
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce(mockRankedPlayers)

            const result = await service.getRankingForSeason(66)

            expect(hoisted.mockHistoricalCacheSet).toHaveBeenCalledWith('season:66', mockRankedPlayers)
            expect(result).toEqual(mockRankedPlayers)
        })

        it('respects overrideMinGames parameter', async () => {
            hoisted.mockHistoricalCacheGet.mockReturnValueOnce(mockRankedPlayers)
            hoisted.mockDataDerivationsService.filterByMinimumGames.mockReturnValueOnce(mockRankedPlayers)

            await service.getRankingForSeason(67, 5)

            expect(hoisted.mockGetRankingMinGamesThreshold).not.toHaveBeenCalled()
            expect(hoisted.mockDataDerivationsService.filterByMinimumGames).toHaveBeenCalledWith(mockRankedPlayers, 5)
        })

        it('returns empty array when character list is empty', async () => {
            const { communityDataService } = await import('../../services/communityDataService')

            hoisted.mockHistoricalCacheGet.mockReturnValueOnce(undefined)
            vi.mocked(communityDataService.getCommunityData).mockResolvedValueOnce({
                players: [],
                playerIds: new Set(),
                displayNames: new Map(),
                playerById: new Map(),
                loadedAt: new Date(),
            })

            const result = await service.getRankingForSeason(67)

            expect(result).toEqual([])
            expect(mockHttpGet).not.toHaveBeenCalled()
        })

        it('returns empty array on API error', async () => {
            hoisted.mockHistoricalCacheGet.mockReturnValueOnce(undefined)
            mockHttpGet.mockRejectedValueOnce(new Error('API down'))
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const result = await service.getRankingForSeason(67)

            expect(result).toEqual([])
            expect(consoleSpy).toHaveBeenCalledWith(
                '[PulseService.getRankingForSeason] Error fetching season 67:',
                expect.any(Error)
            )
            consoleSpy.mockRestore()
        })
    })
})
