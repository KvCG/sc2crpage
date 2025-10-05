import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { DateTime } from 'luxon'
import { DeltaComputationEngine } from '../../services/deltaComputationEngine'
import { getDailySnapshot } from '../../services/snapshotService'
import { PlayerAnalyticsPersistence } from '../../services/playerAnalyticsPersistence'
import logger from '../../logging/logger'

// Mock external dependencies
vi.mock('../../services/snapshotService')
vi.mock('../../services/playerAnalyticsPersistence')
vi.mock('../../logging/logger')

describe('Delta Debug Test', () => {
    const mockCurrentSnapshot = {
        createdAt: '2025-09-26T12:00:00Z',
        expiry: Date.now() + 86400000,
        data: [
            { id: 2, btag: 'Player2#5678', ratingLast: 1600 }, // Position 0 (1st) in current
            { id: 1, btag: 'Player1#1234', ratingLast: 1500 }  // Position 1 (2nd) in current
        ]
    }
    
    const mockBaselineSnapshot = {
        createdAt: '2025-09-25T12:00:00Z',
        expiry: Date.now() + 86400000,
        data: [
            { id: 1, btag: 'Player1#1234', ratingLast: 1000 }, // Position 0 (1st) in baseline
            { id: 2, btag: 'Player2#5678', ratingLast: 900 }   // Position 1 (2nd) in baseline
        ]
    }

    test('debug getTopMovers respects limit parameter', async () => {
        console.log('=== Debug Test Start ===')
        
        // Clear existing mocks
        vi.clearAllMocks()
        
        // Set up mocks
        ;(getDailySnapshot as Mock).mockResolvedValue(mockCurrentSnapshot)
        ;(PlayerAnalyticsPersistence.listBackups as Mock).mockResolvedValue([{
            fileId: 'test-backup',
            fileName: 'test-snapshot.json',
            timestamp: DateTime.fromISO('2025-09-25T12:00:00Z'),
            metadata: { type: 'snapshot', timestamp: '2025-09-25T12:00:00Z', playerCount: 2, dataSize: 1024 }
        }])
        ;(PlayerAnalyticsPersistence.restoreSnapshot as Mock).mockResolvedValue(mockBaselineSnapshot)
        
        console.log('Mock setup complete')
        console.log('Current snapshot:', JSON.stringify(mockCurrentSnapshot, null, 2))
        console.log('Baseline snapshot:', JSON.stringify(mockBaselineSnapshot, null, 2))
        
        // Test direct computePlayerDeltas first
        console.log('=== Testing computePlayerDeltas directly ===')
        const deltas = await DeltaComputationEngine.computePlayerDeltas({
            minimumConfidence: 0,
            includeInactive: true
        })
        
        console.log('Computed deltas:', JSON.stringify(deltas, null, 2))
        console.log('Deltas length:', deltas.length)
        
        // Test getTopMovers
        console.log('=== Testing getTopMovers ===')
        const topMovers = await DeltaComputationEngine.getTopMovers('both', 1, {
            minimumConfidence: 0,
            includeInactive: true
        })
        
        console.log('Top movers:', JSON.stringify(topMovers, null, 2))
        console.log('Top movers length:', topMovers.length)
        
        expect(topMovers).toHaveLength(1)
    })
})