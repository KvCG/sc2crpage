import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response } from 'express'

// Mock all dependencies
const hoisted = vi.hoisted(() => ({
    getTopMock: vi.fn(),
    searchPlayerMock: vi.fn(),
    getDailySnapshotMock: vi.fn(),
    formatDataMock: vi.fn(),
    filterRankingMock: vi.fn(),
    getClientInfoMock: vi.fn(),
    loggerMock: {
        info: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('../../services/pulseService', () => ({
    pulseService: {
        getRanking: hoisted.getTopMock,
        searchPlayer: hoisted.searchPlayerMock,
    }
}))

vi.mock('../../services/snapshotService', () => ({
    getDailySnapshot: hoisted.getDailySnapshotMock,
}))

vi.mock('../../utils/formatData', () => ({
    formatData: hoisted.formatDataMock,
}))

vi.mock('../../utils/rankingFilters', () => ({
    filterRankingForDisplay: hoisted.filterRankingMock,
}))

vi.mock('../../utils/getClientInfo', () => ({
    getClientInfo: hoisted.getClientInfoMock,
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.loggerMock,
}))

// Mock response object
function createMockResponse(): Response & { jsonData?: any; headers?: Record<string, string> } {
    const headers: Record<string, string> = {}
    const res = {
        setHeader: vi.fn((key: string, value: string) => {
            headers[key] = value
        }),
        json: vi.fn((data: any) => {
            res.jsonData = data
        }),
        status: vi.fn(() => res),
        headers,
    } as unknown as Response & { jsonData?: any; headers?: Record<string, string> }
    
    return res
}

// Mock request object
function createMockRequest(overrides: Partial<Request> = {}): Request {
    return {
        headers: { 'user-agent': 'test-agent' },
        ip: '127.0.0.1',
        query: {},
        ...overrides,
    } as Request
}

describe('pulseRoutes E2E tests', () => {
    let routes: any

    beforeEach(async () => {
        vi.resetModules()
        Object.values(hoisted).forEach(mock => {
            if (typeof mock === 'object' && mock !== null) {
                Object.values(mock).forEach(fn => {
                    if (typeof fn === 'function') fn.mockReset()
                })
            } else if (typeof mock === 'function') {
                mock.mockReset()
            }
        })

        hoisted.getClientInfoMock.mockReturnValue({ device: 'desktop', os: 'linux' })
        hoisted.filterRankingMock.mockImplementation(data => data)
        
        routes = await import('../../routes/pulseRoutes')
    })

    describe('GET /api/top', () => {
        it('returns formatted ranking data with proper headers', async () => {
            const mockRankingData = [
                { id: 1, btag: 'Player1#1234', rating: 3500, leagueType: 5, mainRace: 'PROTOSS' },
                { id: 2, btag: 'Player2#5678', rating: 3200, leagueType: 4, mainRace: 'ZERG' },
            ]
            
            hoisted.getTopMock.mockResolvedValueOnce(mockRankingData)
            hoisted.filterRankingMock.mockReturnValueOnce(mockRankingData)
            
            const req = createMockRequest({ 
                headers: { 'user-agent': 'test-browser', referer: 'https://sc2cr.com' }
            })
            const res = createMockResponse()
            
            // Find the /top route handler
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/top')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            expect(res.setHeader).toHaveBeenCalledWith(
                'x-sc2pulse-attribution',
                'Data courtesy of sc2pulse.nephest.com (non-commercial use)'
            )
            expect(res.json).toHaveBeenCalledWith(mockRankingData)
            // expect(hoisted.filterRankingMock).toHaveBeenCalledWith(mockRankingData)
            // /top route does not log client info - only /search does
        })

        it('filters out invalid ranking entries', async () => {
            const mockRankingData = [
                { id: 1, btag: 'Player1#1234', rating: 3500, leagueType: 5, mainRace: 'PROTOSS' },
                { id: 2, btag: 'Player2#5678', rating: null, leagueType: 4, mainRace: 'ZERG' }, // Invalid
                { id: 3, btag: 'Player3#9012', rating: 3200, leagueType: null, mainRace: 'TERRAN' }, // Invalid
                { id: 4, btag: 'Player4#3456', rating: 2800, leagueType: 3, mainRace: null }, // Invalid
            ]
            const filteredData = [
                { id: 1, btag: 'Player1#1234', rating: 3500, leagueType: 5, mainRace: 'PROTOSS' }
            ]
            
            hoisted.getTopMock.mockResolvedValueOnce(mockRankingData)
            hoisted.filterRankingMock.mockReturnValueOnce(filteredData)
            
            const req = createMockRequest()
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/top')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            // Should only return the valid entry
            expect(res.jsonData).toHaveLength(1)
            expect(res.jsonData[0].id).toBe(1)
        })

        it('falls back to unfiltered data when all entries are invalid', async () => {
            const mockRankingData = [
                { id: 1, btag: 'Player1#1234', rating: null, leagueType: null, mainRace: null },
                { id: 2, btag: 'Player2#5678', rating: null, leagueType: null, mainRace: null },
            ]
            
            hoisted.getTopMock.mockResolvedValueOnce(mockRankingData)
            hoisted.formatDataMock.mockResolvedValueOnce(mockRankingData)
            
            const req = createMockRequest()
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/top')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            // Should fall back to unfiltered data
            expect(res.jsonData).toHaveLength(2)
        })

        it('handles service errors gracefully', async () => {
            hoisted.getTopMock.mockRejectedValueOnce(new Error('Pulse API error'))
            
            const req = createMockRequest()
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/top')
            const handler = route?.route?.stack?.[0]?.handle
            
            // The route catches errors and responds with 500, it doesn't throw
            await handler(req, res)
            
            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.jsonData).toEqual({ error: 'Failed to fetch ranking data' })
            expect(hoisted.loggerMock.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    route: '/api/top'
                }),
                'Failed to fetch ranking data'
            )
        })
    })

    describe('GET /api/search', () => {
        it('performs player search with proper logging', async () => {
            const mockSearchResults = [
                {
                    members: {
                        character: { id: '123' },
                        account: { battleTag: 'TestPlayer#1234' },
                    },
                    currentStats: { rating: 3500 },
                }
            ]
            
            hoisted.searchPlayerMock.mockResolvedValueOnce(mockSearchResults)
            hoisted.formatDataMock.mockResolvedValueOnce(mockSearchResults)
            
            const req = createMockRequest({
                query: { term: 'TestPlayer' },
                headers: { 'user-agent': 'test-browser' }
            })
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/search')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            expect(hoisted.searchPlayerMock).toHaveBeenCalledWith('TestPlayer')
            expect(hoisted.formatDataMock).toHaveBeenCalledWith(mockSearchResults, 'search')
            expect(res.setHeader).toHaveBeenCalledWith(
                'x-sc2pulse-attribution',
                'Data courtesy of sc2pulse.nephest.com (non-commercial use)'
            )
            expect(res.json).toHaveBeenCalledWith(mockSearchResults)
            expect(hoisted.loggerMock.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    route: '/api/search',
                    details: expect.objectContaining({
                        query: 'TestPlayer',
                    })
                }),
                'search player'
            )
        })

        it('handles empty search term', async () => {
            hoisted.searchPlayerMock.mockResolvedValueOnce([])
            hoisted.formatDataMock.mockResolvedValueOnce([])
            
            const req = createMockRequest({
                query: { term: '' }
            })
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/search')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            expect(hoisted.searchPlayerMock).toHaveBeenCalledWith('')
            expect(res.jsonData).toEqual([])
        })

        it('handles missing query parameter', async () => {
            hoisted.searchPlayerMock.mockResolvedValueOnce([])
            hoisted.formatDataMock.mockResolvedValueOnce([])
            
            const req = createMockRequest({
                query: {} // No term parameter
            })
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/search')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            expect(hoisted.searchPlayerMock).toHaveBeenCalledWith(undefined)
        })

        it('handles search service errors', async () => {
            hoisted.searchPlayerMock.mockRejectedValueOnce(new Error('Search failed'))
            
            const req = createMockRequest({
                query: { term: 'TestPlayer' }
            })
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/search')
            const handler = route?.route?.stack?.[0]?.handle
            
            // The route catches errors and responds with 500, it doesn't throw
            await handler(req, res)
            
            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.jsonData).toEqual({ error: 'Search failed' })
            expect(hoisted.loggerMock.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    route: '/api/search',
                    term: 'TestPlayer'
                }),
                'Player search failed'
            )
        })
    })

    describe('GET /api/snapshot', () => {
        it('returns daily snapshot with filtered data', async () => {
            const mockSnapshot = {
                data: [
                    { id: 1, btag: 'Player1#1234', rating: 3500, leagueType: 5, mainRace: 'PROTOSS' },
                    { id: 2, btag: 'Player2#5678', rating: 3200, leagueType: 4, mainRace: 'ZERG' },
                ],
                createdAt: '2024-01-01T00:00:00.000Z',
                expiry: Date.now() + 86400000,
            }
            
            const filteredData = [mockSnapshot.data[0]] // Simulate filtering
            
            hoisted.getDailySnapshotMock.mockResolvedValueOnce(structuredClone(mockSnapshot))
            hoisted.filterRankingMock.mockReturnValueOnce(filteredData)
            
            const req = createMockRequest()
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/snapshot')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            expect(hoisted.filterRankingMock).toHaveBeenCalledWith(mockSnapshot.data)
            expect(res.setHeader).toHaveBeenCalledWith(
                'x-sc2pulse-attribution',
                'Data courtesy of sc2pulse.nephest.com (non-commercial use)'
            )
            expect(res.jsonData).toEqual({
                ...mockSnapshot,
                data: filteredData
            })
        })

        it('handles snapshot service errors', async () => {
            hoisted.getDailySnapshotMock.mockRejectedValueOnce(new Error('Snapshot error'))
            
            const req = createMockRequest()
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/snapshot')
            const handler = route?.route?.stack?.[0]?.handle
            
            // The route catches errors and responds with 500, it doesn't throw
            await handler(req, res)
            
            expect(res.status).toHaveBeenCalledWith(500)
            expect(res.jsonData).toEqual({ error: 'Failed to fetch snapshot data' })
            expect(hoisted.loggerMock.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    route: '/api/snapshot'
                }),
                'Failed to fetch daily snapshot'
            )
        })

        it('handles empty snapshot data', async () => {
            const mockSnapshot = {
                data: [],
                createdAt: '2024-01-01T00:00:00.000Z',
                expiry: Date.now() + 86400000,
            }
            
            hoisted.getDailySnapshotMock.mockResolvedValueOnce(mockSnapshot)
            hoisted.filterRankingMock.mockReturnValueOnce([])
            
            const req = createMockRequest()
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/snapshot')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            expect(res.jsonData.data).toEqual([])
        })
    })

    describe('Request context and logging', () => {
        it('captures client information from user agent', async () => {
            hoisted.getClientInfoMock.mockReturnValueOnce({ device: 'mobile', os: 'ios' })
            hoisted.searchPlayerMock.mockResolvedValueOnce([])
            hoisted.formatDataMock.mockResolvedValueOnce([])
            
            const req = createMockRequest({
                headers: { 
                    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
                    'x-forwarded-for': '203.0.113.1'
                },
                query: { term: 'TestPlayer' }
            })
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/search')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            expect(hoisted.getClientInfoMock).toHaveBeenCalledWith(
                'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
            )
            expect(hoisted.loggerMock.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    route: '/api/search',
                    details: expect.objectContaining({
                        device: 'mobile',
                        os: 'ios',
                        ip: '203.0.113.1',
                        query: 'TestPlayer'
                    })
                }),
                'search player'
            )
        })

        it('falls back to req.ip when x-forwarded-for is missing', async () => {
            hoisted.getClientInfoMock.mockReturnValueOnce({ device: 'desktop', os: 'linux' })
            hoisted.searchPlayerMock.mockResolvedValueOnce([])
            hoisted.formatDataMock.mockResolvedValueOnce([])
            
            const req = createMockRequest({
                ip: '192.168.1.100',
                query: { term: 'TestPlayer' }
            })
            const res = createMockResponse()
            
            const router = routes.default
            const route = router.stack?.find((layer: any) => layer.route?.path === '/search')
            const handler = route?.route?.stack?.[0]?.handle
            
            await handler(req, res)
            
            expect(hoisted.loggerMock.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    route: '/api/search',
                    details: expect.objectContaining({
                        ip: '192.168.1.100'
                    })
                }),
                'search player'
            )
        })
    })
})