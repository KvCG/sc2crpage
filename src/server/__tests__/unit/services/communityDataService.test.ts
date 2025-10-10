import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CommunityDataService, communityDataService } from '../../../services/communityDataService'

// Mock the CSV parser
vi.mock('../../../utils/csvParser', () => ({
    readCsv: vi.fn(),
}))

// Mock logger
vi.mock('../../../logging/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

import { readCsv } from '../../../utils/csvParser'
const mockReadCsv = vi.mocked(readCsv)

describe('CommunityDataService', () => {
    let service: CommunityDataService

    beforeEach(() => {
        service = CommunityDataService.getInstance()
        // Reset singleton state
        ;(service as any).communityData = null
        ;(service as any).loadingPromise = null
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.resetAllMocks()
    })

    describe('CSV Data Loading', () => {
        it('should load and process valid CSV data', async () => {
            const mockCsvData = [
                { id: '123', btag: 'Player#1234', name: 'Player One', challongeId: 'p1' },
                { id: '456', btag: 'Player#5678', name: 'Player Two' },
                { id: '789', btag: 'Player#9999' }, // No name or challongeId
            ]
            
            mockReadCsv.mockResolvedValueOnce(mockCsvData)

            const communityData = await service.getCommunityData()

            expect(communityData.players).toHaveLength(3)
            expect(communityData.playerIds.has('123')).toBe(true)
            expect(communityData.playerIds.has('456')).toBe(true)
            expect(communityData.playerIds.has('789')).toBe(true)
            expect(communityData.displayNames.get('Player#1234')).toBe('Player One')
            expect(communityData.displayNames.get('Player#5678')).toBe('Player Two')
            expect(communityData.displayNames.get('Player#9999')).toBeUndefined()
        })

        it('should handle empty CSV data gracefully', async () => {
            mockReadCsv.mockResolvedValueOnce([])

            const communityData = await service.getCommunityData()

            expect(communityData.players).toHaveLength(0)
            expect(communityData.playerIds.size).toBe(0)
            expect(communityData.displayNames.size).toBe(0)
        })

        it('should skip invalid CSV rows', async () => {
            const mockCsvData = [
                { id: '123', btag: 'Player#1234', name: 'Valid Player' },
                { btag: 'NoId#1234' }, // Missing id
                { id: '456' }, // Missing btag
                null, // Invalid row
                { id: '789', btag: 'Player#9999', name: 'Another Valid' },
            ]
            
            mockReadCsv.mockResolvedValueOnce(mockCsvData)

            const communityData = await service.getCommunityData()

            expect(communityData.players).toHaveLength(2)
            expect(communityData.playerIds.has('123')).toBe(true)
            expect(communityData.playerIds.has('789')).toBe(true)
        })

        it('should handle CSV loading errors gracefully', async () => {
            mockReadCsv.mockRejectedValueOnce(new Error('CSV read failed'))

            const communityData = await service.getCommunityData()

            // Should return empty data instead of throwing
            expect(communityData.players).toHaveLength(0)
            expect(communityData.playerIds.size).toBe(0)
        })
    })

    describe('Caching Behavior', () => {
        it('should cache loaded data and avoid duplicate CSV reads', async () => {
            const mockCsvData = [
                { id: '123', btag: 'Player#1234', name: 'Player One' },
            ]
            
            mockReadCsv.mockResolvedValueOnce(mockCsvData)

            // First call
            const data1 = await service.getCommunityData()
            
            // Second call should use cache
            const data2 = await service.getCommunityData()

            expect(mockReadCsv).toHaveBeenCalledTimes(1)
            expect(data1).toBe(data2) // Same object reference
        })

        it('should handle concurrent loading requests', async () => {
            const mockCsvData = [
                { id: '123', btag: 'Player#1234', name: 'Player One' },
            ]
            
            mockReadCsv.mockResolvedValueOnce(mockCsvData)

            // Start multiple concurrent requests
            const promise1 = service.getCommunityData()
            const promise2 = service.getCommunityData()
            const promise3 = service.getCommunityData()

            const [data1, data2, data3] = await Promise.all([promise1, promise2, promise3])

            // Should only read CSV once
            expect(mockReadCsv).toHaveBeenCalledTimes(1)
            
            // All should get the same data
            expect(data1).toBe(data2)
            expect(data2).toBe(data3)
        })
    })

    describe('Convenience Methods', () => {
        beforeEach(async () => {
            const mockCsvData = [
                { id: '123', btag: 'Player#1234', name: 'Player One', challongeId: 'p1' },
                { id: '456', btag: 'Player#5678', name: 'Player Two' },
            ]
            
            mockReadCsv.mockResolvedValueOnce(mockCsvData)
            await service.getCommunityData() // Load data
        })

        it('should check community membership correctly', async () => {
            expect(await service.isCommunityPlayer('123')).toBe(true)
            expect(await service.isCommunityPlayer(456)).toBe(true) // Number input
            expect(await service.isCommunityPlayer('999')).toBe(false)
        })

        it('should retrieve display names correctly', async () => {
            expect(await service.getDisplayName('Player#1234')).toBe('Player One')
            expect(await service.getDisplayName('Player#5678')).toBe('Player Two')
            expect(await service.getDisplayName('NonExistent#1234')).toBeNull()
        })

        it('should get community player records', async () => {
            const player = await service.getCommunityPlayer('123')
            expect(player).toEqual({
                id: '123',
                btag: 'Player#1234',
                name: 'Player One',
                challongeId: 'p1',
            })

            const nonExistent = await service.getCommunityPlayer('999')
            expect(nonExistent).toBeNull()
        })

        it('should get community player IDs', async () => {
            const playerIds = await service.getCommunityPlayerIds()
            expect(playerIds).toEqual(['123', '456'])
        })

        it('should get community statistics', async () => {
            const stats = await service.getCommunityStats()
            expect(stats.totalPlayers).toBe(2)
            expect(stats.playersWithNames).toBe(2)
            expect(stats.playersWithChallongeIds).toBe(1)
            expect(stats.loadedAt).toBeDefined()
        })
    })

    describe('Reload Functionality', () => {
        it('should reload data when requested', async () => {
            // Initial load
            mockReadCsv.mockResolvedValueOnce([
                { id: '123', btag: 'Player#1234', name: 'Original' }
            ])
            await service.getCommunityData()

            // Reload with new data
            mockReadCsv.mockResolvedValueOnce([
                { id: '456', btag: 'Player#5678', name: 'Updated' }
            ])
            const reloadedData = await service.reloadCommunityData()

            expect(mockReadCsv).toHaveBeenCalledTimes(2)
            expect(reloadedData.players).toHaveLength(1)
            expect(reloadedData.players[0].id).toBe('456')
        })
    })

    describe('Singleton Behavior', () => {
        it('should return the same instance', () => {
            const instance1 = CommunityDataService.getInstance()
            const instance2 = CommunityDataService.getInstance()
            
            expect(instance1).toBe(instance2)
            expect(instance1).toBe(communityDataService)
        })
    })
})