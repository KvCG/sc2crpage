import { describe, it, expect, vi } from 'vitest'

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

vi.mock('../../services/deltaComputationEngine', () => ({
    DeltaComputationEngine: {
        computePlayerDeltas: vi.fn().mockResolvedValue([]),
    },
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

describe('PulseRoutes', () => {
    it('should export routes module successfully', async () => {
        // Test that the routes module can be imported without errors
        const routes = await import('../../routes/pulseRoutes')
        expect(routes.default).toBeDefined()
        expect(typeof routes.default).toBe('function')
    })
})
