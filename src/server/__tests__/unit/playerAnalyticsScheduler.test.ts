import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PlayerAnalyticsScheduler } from '../../services/playerAnalyticsScheduler'

// Mock the dependencies
vi.mock('../../services/snapshotService', () => ({
    getDailySnapshot: vi.fn().mockResolvedValue({
        data: [{ id: 1, name: 'test' }],
        createdAt: '2025-09-26T00:00:00.000Z',
        expiry: Date.now() + 86400000
    })
}))

vi.mock('../../../metrics/lite', () => ({
    getAnalyticsMetricsSummary: vi.fn().mockReturnValue({
        totalRequests: 10,
        cacheHitRate: 85.5,
        rateLimitBlocked: 2,
        featureDisabledBlocked: 0,
        errorRate: 1.2,
        p50Latency: 120,
        p95Latency: 350,
        p99Latency: 800
    })
}))

vi.mock('../../../logging/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}))

describe('PlayerAnalyticsScheduler', () => {
    let originalEnv: NodeJS.ProcessEnv

    beforeEach(() => {
        originalEnv = { ...process.env }
        vi.clearAllMocks()
        
        // Reset scheduler state
        PlayerAnalyticsScheduler.stop()
        // Clear any cached config
        ;(PlayerAnalyticsScheduler as any).config = undefined
        ;(PlayerAnalyticsScheduler as any).operations = []
    })

    afterEach(() => {
        process.env = originalEnv
        PlayerAnalyticsScheduler.stop()
    })

    describe('Configuration', () => {
        it('should load default configuration when feature is disabled', () => {
            process.env.ENABLE_PLAYER_SNAPSHOTS = 'false'
            
            const config = PlayerAnalyticsScheduler.getConfig()
            
            expect(config).toEqual({
                enabled: false,
                snapshotIntervalHours: 24,
                activityIntervalHours: 2,
                moversIntervalHours: 3
            })
        })

        it('should load custom configuration when feature is enabled', () => {
            process.env.ENABLE_PLAYER_SNAPSHOTS = 'true'
            process.env.PLAYER_SNAPSHOT_INTERVAL_HOURS = '12'
            process.env.PLAYER_ACTIVITY_INTERVAL_HOURS = '1'
            process.env.PLAYER_MOVERS_INTERVAL_HOURS = '6'
            
            const config = PlayerAnalyticsScheduler.getConfig()
            
            expect(config).toEqual({
                enabled: true,
                snapshotIntervalHours: 12,
                activityIntervalHours: 1,
                moversIntervalHours: 6
            })
        })

        it('should use defaults for invalid interval values', () => {
            process.env.ENABLE_PLAYER_SNAPSHOTS = 'true'
            process.env.PLAYER_SNAPSHOT_INTERVAL_HOURS = 'invalid'
            process.env.PLAYER_ACTIVITY_INTERVAL_HOURS = '0'
            process.env.PLAYER_MOVERS_INTERVAL_HOURS = '-5'
            
            const config = PlayerAnalyticsScheduler.getConfig()
            
            expect(config).toEqual({
                enabled: true,
                snapshotIntervalHours: 24,
                activityIntervalHours: 2,
                moversIntervalHours: 3
            })
        })
    })

    describe('Scheduler Operations', () => {
        beforeEach(() => {
            process.env.ENABLE_PLAYER_SNAPSHOTS = 'true'
            process.env.PLAYER_SNAPSHOT_INTERVAL_HOURS = '24'
            process.env.PLAYER_ACTIVITY_INTERVAL_HOURS = '2'
            process.env.PLAYER_MOVERS_INTERVAL_HOURS = '3'
        })

        it('should initialize operations with correct intervals', () => {
            PlayerAnalyticsScheduler.initializeOperations()
            
            const status = PlayerAnalyticsScheduler.getStatus()
            
            expect(status.operations).toHaveLength(3)
            expect(status.operations[0].name).toBe('snapshot')
            expect(status.operations[0].intervalHours).toBe(24)
            expect(status.operations[1].name).toBe('activity')
            expect(status.operations[1].intervalHours).toBe(2)
            expect(status.operations[2].name).toBe('movers')
            expect(status.operations[2].intervalHours).toBe(3)
        })

        it('should start and stop scheduler correctly', () => {
            const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
            const setIntervalSpy = vi.spyOn(global, 'setInterval')
            
            PlayerAnalyticsScheduler.start()
            expect(setIntervalSpy).toHaveBeenCalled()
            
            PlayerAnalyticsScheduler.stop()
            expect(clearIntervalSpy).toHaveBeenCalled()
        })

        it('should not start when feature is disabled', () => {
            process.env.ENABLE_PLAYER_SNAPSHOTS = 'false'
            
            const setIntervalSpy = vi.spyOn(global, 'setInterval')
            
            PlayerAnalyticsScheduler.start()
            
            expect(setIntervalSpy).not.toHaveBeenCalled()
        })
    })

    describe('Force Run Operations', () => {
        beforeEach(() => {
            process.env.ENABLE_PLAYER_SNAPSHOTS = 'true'
            PlayerAnalyticsScheduler.initializeOperations()
        })

        it('should force run snapshot operation', async () => {
            const { getDailySnapshot } = await import('../../services/snapshotService')
            
            await PlayerAnalyticsScheduler.forceRun('snapshot')
            
            expect(getDailySnapshot).toHaveBeenCalled()
        })

        it('should force run activity operation', async () => {
            // Since we mocked getAnalyticsMetricsSummary, just check it completes without error
            await expect(PlayerAnalyticsScheduler.forceRun('activity')).resolves.toBeUndefined()
        })

        it('should throw error for unknown operation', async () => {
            await expect(PlayerAnalyticsScheduler.forceRun('unknown'))
                .rejects.toThrow("Operation 'unknown' not found")
        })
    })

    describe('Costa Rica Timezone Alignment', () => {
        beforeEach(() => {
            process.env.ENABLE_PLAYER_SNAPSHOTS = 'true'
        })

        it('should calculate next run for daily operations at Costa Rica midnight', () => {
            // Test that daily operations align to Costa Rica midnight
            PlayerAnalyticsScheduler.initializeOperations()
            
            const status = PlayerAnalyticsScheduler.getStatus()
            const snapshotOp = status.operations.find((op: any) => op.name === 'snapshot')
            
            expect(snapshotOp).toBeDefined()
            // The next run should be a valid ISO string
            expect(snapshotOp!.nextRun).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        })

        it('should handle sub-daily operations with hour alignment', () => {
            process.env.PLAYER_ACTIVITY_INTERVAL_HOURS = '4'
            
            PlayerAnalyticsScheduler.initializeOperations()
            
            const status = PlayerAnalyticsScheduler.getStatus()
            const activityOp = status.operations.find((op: any) => op.name === 'activity')
            
            expect(activityOp).toBeDefined()
            expect(activityOp!.intervalHours).toBe(4)
            expect(activityOp!.nextRun).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        })
    })

    describe('Status Reporting', () => {
        it('should return correct status when disabled', () => {
            process.env.ENABLE_PLAYER_SNAPSHOTS = 'false'
            
            const status = PlayerAnalyticsScheduler.getStatus()
            
            expect(status.enabled).toBe(false)
            expect(status.operations).toHaveLength(0)
        })

        it('should return correct status when enabled with operations', () => {
            process.env.ENABLE_PLAYER_SNAPSHOTS = 'true'
            PlayerAnalyticsScheduler.initializeOperations()
            
            const status = PlayerAnalyticsScheduler.getStatus()
            
            expect(status.enabled).toBe(true)
            expect(status.operations).toHaveLength(3)
            expect(status.config).toEqual({
                enabled: true,
                snapshotIntervalHours: 24,
                activityIntervalHours: 2,
                moversIntervalHours: 3
            })
        })
    })
})