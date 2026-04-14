import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response } from 'express'

// Mock all services
vi.mock('../../services/pulseService', () => ({
    pulseService: {
        getRanking: vi.fn().mockResolvedValue([]),
        searchPlayer: vi.fn().mockResolvedValue({}),
    },
}))

vi.mock('../../services/snapshotService', () => ({
    getDailySnapshot: vi.fn().mockResolvedValue({ data: [] }),
}))

vi.mock('../../utils/formatData', () => ({
    formatData: vi.fn().mockResolvedValue({}),
}))

vi.mock('../../utils/rankingFilters', () => ({
    filterRankingForDisplay: vi.fn().mockReturnValue([]),
}))

vi.mock('../../utils/getClientInfo', () => ({
    getClientInfo: vi.fn().mockReturnValue({ device: 'test', os: 'test' }),
}))

vi.mock('../../logging/logger', () => ({
    default: {
        error: vi.fn(),
        info: vi.fn(),
    },
}))

describe('PulseRoutes', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
        vi.clearAllMocks()
        originalEnv = { ...process.env }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    it('should export routes module successfully', async () => {
        const routes = await import('../../routes/pulseRoutes')
        expect(routes.default).toBeDefined()
        expect(typeof routes.default).toBe('function')
    })

    describe('GET /api/top parameter precedence', () => {
        it('uses URL minimumGames param when provided', async () => {
            process.env.RANKING_MIN_GAMES = '15'
            
            const { pulseService } = await import('../../services/pulseService')
            const routes = await import('../../routes/pulseRoutes')
            
            const req = {
                query: { minimumGames: '5' },
            } as unknown as Request
            
            const res = {
                setHeader: vi.fn(),
                json: vi.fn(),
                status: vi.fn().mockReturnThis(),
            } as unknown as Response

            const router = routes.default
            const topRoute = router.stack?.find((layer: any) => layer.route?.path === '/top')
            const handler = topRoute?.route?.stack?.[0]?.handle

            await handler(req, res)

            expect(pulseService.getRanking).toHaveBeenCalledWith(5)
        })

        it('uses undefined when URL param absent (relies on environment variable in service)', async () => {
            process.env.RANKING_MIN_GAMES = '15'
            
            const { pulseService } = await import('../../services/pulseService')
            const routes = await import('../../routes/pulseRoutes')
            
            const req = { query: {} } as unknown as Request
            const res = {
                setHeader: vi.fn(),
                json: vi.fn(),
                status: vi.fn().mockReturnThis(),
            } as unknown as Response

            const router = routes.default
            const topRoute = router.stack?.find((layer: any) => layer.route?.path === '/top')
            const handler = topRoute?.route?.stack?.[0]?.handle

            await handler(req, res)

            expect(pulseService.getRanking).toHaveBeenCalledWith(undefined)
        })

        it('uses undefined when URL param absent and no env var (service will use default)', async () => {
            delete process.env.RANKING_MIN_GAMES
            
            const { pulseService } = await import('../../services/pulseService')
            const routes = await import('../../routes/pulseRoutes')
            
            const req = { query: {} } as unknown as Request
            const res = {
                setHeader: vi.fn(),
                json: vi.fn(),
                status: vi.fn().mockReturnThis(),
            } as unknown as Response

            const router = routes.default
            const topRoute = router.stack?.find((layer: any) => layer.route?.path === '/top')
            const handler = topRoute?.route?.stack?.[0]?.handle

            await handler(req, res)

            expect(pulseService.getRanking).toHaveBeenCalledWith(undefined)
        })
    })
})
