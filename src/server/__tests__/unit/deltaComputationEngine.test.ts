import { describe, test, expect, beforeEach, vi, Mock } from 'vitest'
import { DateTime } from 'luxon'
import { DeltaComputationEngine } from '../../services/deltaComputationEngine'
import { PlayerAnalyticsPersistence } from '../../services/playerAnalyticsPersistence'
import { getDailySnapshot } from '../../services/snapshotService'
import logger from '../../logging/logger'

// Mock external dependencies
vi.mock('../../services/playerAnalyticsPersistence')
vi.mock('../../services/snapshotService')
vi.mock('../../logging/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}))

describe('DeltaComputationEngine', () => {
    const mockCurrentSnapshot = {
        createdAt: '2025-09-26T12:00:00Z',
        expiry: Date.now() + 86400000,
        data: [
            {
                id: 1,
                btag: 'Player1#1234',
                name: 'Player1',
                ratingLast: 1600,
                race: 'Protoss',
                leagueTypeLast: 3,
                daysSinceLastGame: 1,
                gamesPlayedRecent: 15
            },
            {
                id: 2,
                btag: 'Player2#5678',
                name: 'Player2', 
                ratingLast: 1400,
                race: 'Terran',
                leagueTypeLast: 2,
                daysSinceLastGame: 3,
                gamesPlayedRecent: 8
            },
            {
                id: 3,
                btag: 'Player3#9012',
                name: 'Player3',
                ratingLast: 1800,
                race: 'Zerg',
                leagueTypeLast: 4,
                daysSinceLastGame: 0,
                gamesPlayedRecent: 20
            }
        ]
    }

    const mockBaselineSnapshot = {
        createdAt: '2025-09-25T12:00:00Z',
        expiry: Date.now() + 86400000,
        data: [
            {
                id: 2,
                btag: 'Player2#5678',
                name: 'Player2',
                ratingLast: 1350, // Was lower rated
                race: 'Terran',
                leagueTypeLast: 2,
                daysSinceLastGame: 2
            },
            {
                id: 1,
                btag: 'Player1#1234', 
                name: 'Player1',
                ratingLast: 1550, // Was lower rated
                race: 'Protoss',
                leagueTypeLast: 3,
                daysSinceLastGame: 0
            },
            {
                id: 4,
                btag: 'Player4#3456',
                name: 'Player4',
                ratingLast: 1200,
                race: 'Zerg',
                leagueTypeLast: 1
            }
            // Note: Player3 wasn't in baseline (new player)
        ]
    }

    beforeEach(() => {
        vi.clearAllMocks()
        
        // Mock getDailySnapshot to return current snapshot
        ;(getDailySnapshot as Mock).mockResolvedValue(mockCurrentSnapshot)
        
        // Mock persistence layer methods
        ;(PlayerAnalyticsPersistence.listBackups as Mock).mockResolvedValue([
            {
                fileId: 'backup-123',
                fileName: 'snapshot-2025-09-25-12-00-00.json',
                timestamp: DateTime.fromISO('2025-09-25T12:00:00Z'),
                metadata: {
                    type: 'snapshot',
                    timestamp: '2025-09-25T12:00:00Z',
                    playerCount: 3,
                    dataSize: 1024
                }
            }
        ])
        
        ;(PlayerAnalyticsPersistence.restoreSnapshot as Mock).mockResolvedValue(mockBaselineSnapshot)
    })

    describe('computePlayerDeltas', () => {
        test('computes deltas with historical baseline successfully', async () => {
            const deltas = await DeltaComputationEngine.computePlayerDeltas({
                timeWindowHours: 24,
                includeInactive: true,
                minimumConfidence: 0
            })

            expect(deltas).toHaveLength(3)
            
            // Player1: moved from position 1 to position 0 (up 1)
            const player1Delta = deltas.find(d => d.btag === 'Player1#1234')
            expect(player1Delta).toEqual(expect.objectContaining({
                id: 1,
                btag: 'Player1#1234',
                name: 'Player1',
                positionChangeIndicator: 'up',
                positionDelta: 1, // was at index 1, now at index 0
                previousRank: 1,
                currentRank: 0,
                ratingChange: 50, // 1600 - 1550
                previousRating: 1550,
                currentRating: 1600,
                activityLevel: 'high', // daysSinceLastGame: 1, gamesPlayedRecent: 15
                race: 'Protoss',
                leagueType: 3
            }))

            // Player2: moved from position 0 to position 1 (down 1)  
            const player2Delta = deltas.find(d => d.btag === 'Player2#5678')
            expect(player2Delta).toEqual(expect.objectContaining({
                id: 2,
                positionChangeIndicator: 'down',
                positionDelta: -1, // was at index 0, now at index 1
                previousRank: 0,
                currentRank: 1,
                ratingChange: 50, // 1400 - 1350
                activityLevel: 'medium' // daysSinceLastGame: 3, gamesPlayedRecent: 8
            }))

            // Player3: new player (no baseline)
            const player3Delta = deltas.find(d => d.btag === 'Player3#9012')
            expect(player3Delta).toEqual(expect.objectContaining({
                id: 3,
                positionChangeIndicator: 'none',
                positionDelta: undefined,
                previousRank: undefined,
                currentRank: 2,
                ratingChange: undefined,
                activityLevel: 'high' // daysSinceLastGame: 0, gamesPlayedRecent: 20
            }))
        })

        test('handles missing baseline snapshot gracefully', async () => {
            ;(PlayerAnalyticsPersistence.listBackups as Mock).mockResolvedValue([])
            
            const deltas = await DeltaComputationEngine.computePlayerDeltas()

            expect(deltas).toHaveLength(3)
            // All players should have 'none' indicator when no baseline exists
            deltas.forEach(delta => {
                expect(delta.positionChangeIndicator).toBe('none')
                expect(delta.positionDelta).toBeUndefined()
                expect(delta.ratingChange).toBeUndefined()
                expect(delta.confidenceScore).toBe(75) // Baseline confidence score
            })

            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    timeWindowHours: 24,
                    feature: 'deltaComputation'
                }),
                'No suitable baseline snapshot found'
            )
        })

        test('filters inactive players when includeInactive is false', async () => {
            // Mock data with inactive player
            const snapshotWithInactive = {
                ...mockCurrentSnapshot,
                data: [
                    ...mockCurrentSnapshot.data,
                    {
                        id: 4,
                        btag: 'InactivePlayer#1111',
                        name: 'InactivePlayer',
                        ratingLast: 1000,
                        race: 'Terran',
                        daysSinceLastGame: 20, // Inactive
                        gamesPlayedRecent: 0
                    }
                ]
            }
            ;(getDailySnapshot as Mock).mockResolvedValue(snapshotWithInactive)

            const deltasIncluding = await DeltaComputationEngine.computePlayerDeltas({
                includeInactive: true,
                minimumConfidence: 0
            })
            const deltasExcluding = await DeltaComputationEngine.computePlayerDeltas({
                includeInactive: false,
                minimumConfidence: 0
            })

            expect(deltasIncluding).toHaveLength(4)
            expect(deltasExcluding).toHaveLength(3) // Should exclude inactive player
            expect(deltasExcluding.every(d => d.activityLevel !== 'inactive')).toBe(true)
        })

        test('filters low confidence players when minimumConfidence is set', async () => {
            const deltas = await DeltaComputationEngine.computePlayerDeltas({
                minimumConfidence: 80,
                includeInactive: true
            })

            // All returned deltas should meet minimum confidence
            deltas.forEach(delta => {
                expect(delta.confidenceScore).toBeGreaterThanOrEqual(80)
            })
        })

        test('handles errors gracefully', async () => {
            ;(getDailySnapshot as Mock).mockRejectedValue(new Error('Snapshot service error'))

            await expect(DeltaComputationEngine.computePlayerDeltas()).rejects.toThrow('Snapshot service error')
            
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    feature: 'deltaComputation'
                }),
                'Failed to compute player deltas'
            )
        })
    })

    describe('computeActivityAnalysis', () => {
        test('computes comprehensive activity analysis', async () => {
            const analysis = await DeltaComputationEngine.computeActivityAnalysis({
                includeInactive: true,
                minimumConfidence: 0
            })

            expect(analysis).toEqual(expect.objectContaining({
                totalPlayers: 3,
                activePlayers: 3, // All players are active in mock data
                movers: expect.objectContaining({
                    promotions: 2, // Player1 and Player2 both gained rating
                    demotions: 0,
                    significantRises: 0, // No position changes >= 5
                    significantFalls: 0
                }),
                activityLevels: expect.objectContaining({
                    high: 2, // Player1 and Player3
                    medium: 1, // Player2
                    low: 0,
                    inactive: 0
                }),
                averageRatingChange: 50, // (50 + 50 + 0) / 2 (Player3 has no baseline)
                timestamp: expect.any(String)
            }))

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    analysis: expect.any(Object),
                    feature: 'deltaComputation'
                }),
                'Activity analysis completed'
            )
        })

        test('handles empty player data', async () => {
            ;(getDailySnapshot as Mock).mockResolvedValue({
                ...mockCurrentSnapshot,
                data: []
            })

            const analysis = await DeltaComputationEngine.computeActivityAnalysis()

            expect(analysis.totalPlayers).toBe(0)
            expect(analysis.activePlayers).toBe(0)
            expect(analysis.averageRatingChange).toBe(0)
        })
    })

    describe('getTopMovers', () => {
        test('returns top movers in ascending order', async () => {
            // Add more dramatic position changes for testing
            const dramaticBaseline = {
                ...mockBaselineSnapshot,
                data: [
                    { id: 1, btag: 'Player1#1234', ratingLast: 1000 },
                    { id: 2, btag: 'Player2#5678', ratingLast: 900 },
                    { id: 3, btag: 'Player3#9012', ratingLast: 800 },
                    { id: 4, btag: 'Player4#0000', ratingLast: 700 },
                    { id: 5, btag: 'Player5#1111', ratingLast: 600 }
                ]
            }
            
            const dramaticCurrent = {
                ...mockCurrentSnapshot,
                data: [
                    { id: 5, btag: 'Player5#1111', ratingLast: 1900 }, // Was 5th, now 1st (+4)
                    { id: 1, btag: 'Player1#1234', ratingLast: 1600 }, // Was 1st, now 2nd (-1) 
                    { id: 3, btag: 'Player3#9012', ratingLast: 1500 }, // Was 3rd, now 3rd (0)
                    { id: 2, btag: 'Player2#5678', ratingLast: 1400 }, // Was 2nd, now 4th (-2)
                    { id: 4, btag: 'Player4#0000', ratingLast: 1300 }  // Was 4th, now 5th (-1)
                ]
            }

            ;(getDailySnapshot as Mock).mockResolvedValue(dramaticCurrent)
            ;(PlayerAnalyticsPersistence.restoreSnapshot as Mock).mockResolvedValue(dramaticBaseline)

            const topMovers = await DeltaComputationEngine.getTopMovers('both', 3, {
                minimumConfidence: 0
            })

            expect(topMovers).toHaveLength(3)
            // Should be ordered by absolute position change
            expect(topMovers[0].btag).toBe('Player5#1111') // +4 positions
            expect(topMovers[0].positionDelta).toBe(4)
            expect(topMovers[1].positionDelta).toBe(-2) // Player2, -2 positions
            expect(topMovers[2].positionDelta).toBe(-1) // Either Player1 or Player4
        })

        test('filters by direction correctly', async () => {
            const upMovers = await DeltaComputationEngine.getTopMovers('up', 5, {
                minimumConfidence: 0
            })
            const downMovers = await DeltaComputationEngine.getTopMovers('down', 5, {
                minimumConfidence: 0
            })

            upMovers.forEach(mover => {
                expect(mover.positionDelta).toBeGreaterThan(0)
            })

            downMovers.forEach(mover => {
                expect(mover.positionDelta).toBeLessThan(0)
            })
        })

        test('respects limit parameter', async () => {
            // Clear existing mocks to avoid interference
            vi.clearAllMocks()
            
            // Set up mocks to ensure we have position deltas - btags must match between current and baseline
            const testBaseline = {
                ...mockBaselineSnapshot,
                data: [
                    { id: 1, btag: 'Player1#1234', ratingLast: 1000 }, // Position 0 (1st) in baseline
                    { id: 2, btag: 'Player2#5678', ratingLast: 900 }   // Position 1 (2nd) in baseline
                ]
            }
            
            const testCurrent = {
                ...mockCurrentSnapshot,
                data: [
                    { id: 2, btag: 'Player2#5678', ratingLast: 1600 }, // Position 0 (1st) in current - moved up from position 1 (+1)
                    { id: 1, btag: 'Player1#1234', ratingLast: 1500 }  // Position 1 (2nd) in current - moved down from position 0 (-1)
                ]
            }

            ;(getDailySnapshot as Mock).mockResolvedValue(testCurrent)
            ;(PlayerAnalyticsPersistence.listBackups as Mock).mockResolvedValue([{
                fileId: 'test-backup',
                fileName: 'test-snapshot.json',
                timestamp: DateTime.fromISO('2025-09-25T12:00:00Z'),
                metadata: { type: 'snapshot', timestamp: '2025-09-25T12:00:00Z', playerCount: 2, dataSize: 1024 }
            }])
            ;(PlayerAnalyticsPersistence.restoreSnapshot as Mock).mockResolvedValue(testBaseline)
            
            const topMovers = await DeltaComputationEngine.getTopMovers('both', 1, {
                minimumConfidence: 0,
                includeInactive: true
            })

            expect(topMovers).toHaveLength(1)
        })
    })

    describe('Activity Level Calculation', () => {
        test('calculates activity levels correctly', () => {
            // Test private method through public interface
            const testCases = [
                { daysSince: 0, games: 15, expected: 'high' },
                { daysSince: 1, games: 10, expected: 'high' },
                { daysSince: 2, games: 7, expected: 'medium' },
                { daysSince: 3, games: 5, expected: 'medium' },
                { daysSince: 5, games: 3, expected: 'low' },
                { daysSince: 7, games: 1, expected: 'low' },
                { daysSince: 10, games: 0, expected: 'inactive' },
                { daysSince: 20, games: 0, expected: 'inactive' }
            ]

            testCases.forEach(({ daysSince, games, expected }) => {
                // Test through baseline delta computation since calculateActivityLevel is private
                const snapshot = {
                    createdAt: '2025-09-26T12:00:00Z',
                    expiry: Date.now() + 86400000,
                    data: [{
                        id: 1,
                        btag: 'TestPlayer#1234',
                        daysSinceLastGame: daysSince,
                        gamesPlayedRecent: games,
                        ratingLast: 1500
                    }]
                }
                
                ;(getDailySnapshot as Mock).mockResolvedValue(snapshot)
                ;(PlayerAnalyticsPersistence.listBackups as Mock).mockResolvedValue([])
                
                // This will use computeBaselineDeltas which calls calculateActivityLevel
                return DeltaComputationEngine.computePlayerDeltas().then(deltas => {
                    expect(deltas[0].activityLevel).toBe(expected)
                })
            })
        })
    })

    describe('Confidence Score Calculation', () => {
        test('calculates confidence scores based on data quality', async () => {
            // Clear existing mocks to avoid interference
            vi.clearAllMocks()
            
            const highQualitySnapshot = {
                createdAt: '2025-09-26T12:00:00Z',
                expiry: Date.now() + 86400000,
                data: [{
                    id: 1,
                    btag: 'HighQuality#1234',
                    name: 'HighQuality',
                    ratingLast: 1600,
                    race: 'Protoss',
                    daysSinceLastGame: 1
                }]
            }

            const lowQualitySnapshot = {
                createdAt: '2025-09-26T12:00:00Z', 
                expiry: Date.now() + 86400000,
                data: [{
                    id: 2,
                    btag: 'LowQuality#5678', // Need btag for matching, but missing name, race - should lower confidence
                    ratingLast: 1400,
                    daysSinceLastGame: 10
                }]
            }

            const baselineForHighQuality = {
                ...mockBaselineSnapshot,
                data: [{
                    id: 1,
                    btag: 'HighQuality#1234', // Must match btag in highQualitySnapshot
                    name: 'HighQuality',
                    ratingLast: 1500, // Different rating to create delta
                    race: 'Protoss',
                    daysSinceLastGame: 2
                }]
            }

            const baselineForLowQuality = {
                ...mockBaselineSnapshot,
                data: [{
                    id: 2,
                    btag: 'LowQuality#5678', // Add matching btag for lowQualitySnapshot
                    ratingLast: 1300, // Different rating to create delta
                    daysSinceLastGame: 8
                }]
            }

            // Test high quality deltas
            ;(getDailySnapshot as Mock).mockResolvedValue(highQualitySnapshot)
            ;(PlayerAnalyticsPersistence.listBackups as Mock).mockResolvedValue([{
                fileId: 'high-quality-backup',
                fileName: 'high-quality-snapshot.json',
                timestamp: DateTime.fromISO('2025-09-25T12:00:00Z'),
                metadata: { type: 'snapshot', timestamp: '2025-09-25T12:00:00Z', playerCount: 1, dataSize: 512 }
            }])
            ;(PlayerAnalyticsPersistence.restoreSnapshot as Mock).mockResolvedValue(baselineForHighQuality)
            const highQualityDeltas = await DeltaComputationEngine.computePlayerDeltas({
                minimumConfidence: 0,
                includeInactive: true
            })

            // Clear mocks and set up for second test
            vi.clearAllMocks()

            // Test low quality deltas
            ;(getDailySnapshot as Mock).mockResolvedValue(lowQualitySnapshot)
            ;(PlayerAnalyticsPersistence.listBackups as Mock).mockResolvedValue([{
                fileId: 'low-quality-backup',
                fileName: 'low-quality-snapshot.json',
                timestamp: DateTime.fromISO('2025-09-25T12:00:00Z'),
                metadata: { type: 'snapshot', timestamp: '2025-09-25T12:00:00Z', playerCount: 1, dataSize: 256 }
            }])
            ;(PlayerAnalyticsPersistence.restoreSnapshot as Mock).mockResolvedValue(baselineForLowQuality)
            const lowQualityDeltas = await DeltaComputationEngine.computePlayerDeltas({
                minimumConfidence: 0,
                includeInactive: true
            })

            expect(highQualityDeltas).toHaveLength(1)
            expect(lowQualityDeltas).toHaveLength(1)
            expect(highQualityDeltas[0].confidenceScore).toBeGreaterThan(lowQualityDeltas[0].confidenceScore)
        })
    })
})