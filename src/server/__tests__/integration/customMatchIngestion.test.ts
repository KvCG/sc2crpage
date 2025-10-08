/**
 * Integration Test for Custom Match Ingestion System
 * 
 * Tests the complete end-to-end flow: discovery → validation → scoring → 
 * de-duplication → storage. Uses mocked services to avoid external dependencies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CustomMatchIngestionOrchestrator } from '../../services/customMatchIngestionOrchestrator'
import { RawCustomMatch, ProcessedCustomMatch } from '../../../shared/customMatchTypes'

// Mock external dependencies
vi.mock('../../services/customMatchDiscoveryService', () => ({
    customMatchDiscoveryService: {
        async initializeCommunityData() {
            return Promise.resolve()
        },
        async discoverCustomMatches() {
            return Promise.resolve([createRawTestMatch()])
        },
        async validateParticipants(matches: RawCustomMatch[]) {
            return Promise.resolve(matches.map(m => createProcessedTestMatch(m.matchId)))
        },
        getCommunityStats() {
            return { totalPlayers: 100, playersWithRating: 80, lastUpdated: new Date().toISOString() }
        }
    }
}))

vi.mock('../../services/matchConfidenceScorer', () => ({
    matchConfidenceScorer: {
        scoreMatches(matches: ProcessedCustomMatch[]) {
            return matches.map(m => ({ ...m, confidence: 'medium' }))
        },
        getConfig() {
            return { factorPoints: {}, thresholds: {} }
        }
    }
}))

vi.mock('../../services/matchDeduplicator', () => ({
    matchDeduplicator: {
        async filterDuplicates(matches: ProcessedCustomMatch[]) {
            return {
                uniqueMatches: matches,
                duplicateCount: 0,
                duplicateMatchIds: []
            }
        },
        async recordProcessedMatches() {
            return Promise.resolve()
        },
        async getStats() {
            return { trackingDir: '/tmp', cacheSize: 0, cacheKeys: 0, trackedDates: 0 }
        },
        async cleanup() {
            return Promise.resolve()
        }
    }
}))

vi.mock('../../services/customMatchStorageService', () => ({
    customMatchStorageService: {
        async storeMatches(matches: ProcessedCustomMatch[]) {
            return {
                filesWritten: 1,
                matchesStored: matches.length,
                errors: []
            }
        },
        async getStorageStats() {
            return {
                totalFiles: 5,
                sampledMatches: 50,
                dateRange: { earliest: '2024-01-01', latest: '2024-01-15' },
                recentDateStats: [],
                folderName: 'CustomMatches_test'
            }
        }
    }
}))

vi.mock('../../logging/logger', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}))

describe('CustomMatchIngestionOrchestrator Integration', () => {
    let orchestrator: CustomMatchIngestionOrchestrator

    beforeEach(() => {
        orchestrator = new CustomMatchIngestionOrchestrator()
        vi.clearAllMocks()
    })

    describe('manual ingestion flow', () => {
        it('should complete full ingestion cycle successfully', async () => {
            const result = await orchestrator.runManualIngestion()

            expect(result).toMatchObject({
                matchesDiscovered: expect.any(Number),
                matchesWithValidParticipants: expect.any(Number),
                matchesMeetingThreshold: expect.any(Number),
                newMatchesStored: expect.any(Number),
                duplicatesSkipped: 0,
                errors: [],
                timestamp: expect.any(String),
                durationMs: expect.any(Number)
            })

            expect(result.errors).toHaveLength(0)
            expect(result.newMatchesStored).toBeGreaterThan(0)
        })

        it('should handle confidence threshold filtering', async () => {
            // Set environment variable to test filtering
            process.env.H2H_CUSTOM_MIN_CONFIDENCE = 'high'
            
            const result = await orchestrator.runManualIngestion()
            
            // Should have discovered matches but none meet high confidence threshold
            expect(result.matchesDiscovered).toBeGreaterThan(0)
            expect(result.matchesMeetingThreshold).toBe(0) // Medium confidence doesn't meet high threshold
            
            // Cleanup
            delete process.env.H2H_CUSTOM_MIN_CONFIDENCE
        })

        it('should provide system statistics', async () => {
            const stats = await orchestrator.getStats()

            expect(stats).toHaveProperty('system')
            expect(stats).toHaveProperty('community')
            expect(stats).toHaveProperty('deduplication')
            expect(stats).toHaveProperty('storage')
            expect(stats).toHaveProperty('scoring')

            expect(stats.system.isRunning).toBe(false) // Not started yet
            expect(stats.community.totalPlayers).toBe(100)
        })
    })

    describe('system lifecycle', () => {
        it('should start and stop system correctly', async () => {
            // Check initial status
            let status = orchestrator.getStatus()
            expect(status.isRunning).toBe(false)

            // Start system
            await orchestrator.start()
            
            // Wait a moment for startup
            await new Promise(resolve => setTimeout(resolve, 100))
            
            status = orchestrator.getStatus()
            expect(status.isRunning).toBe(true)
            expect(status.uptimeMs).toBeGreaterThanOrEqual(0)

            // Stop system
            await orchestrator.stop()
            status = orchestrator.getStatus()
            expect(status.isRunning).toBe(false)
        })

        it('should handle cleanup operations', async () => {
            await expect(orchestrator.cleanup()).resolves.not.toThrow()
        })
    })

    describe('configuration', () => {
        it('should use environment configuration', async () => {
            // Set test configuration
            process.env.H2H_CUSTOM_CUTOFF = '2024-01-01'
            process.env.H2H_CUSTOM_MIN_CONFIDENCE = 'low'
            process.env.H2H_CUSTOM_POLL_INTERVAL_SEC = '300'

            const status = orchestrator.getStatus()
            
            expect(status.config.cutoffDate).toBe('2024-01-01')
            expect(status.config.minConfidence).toBe('low')
            expect(status.config.pollIntervalSeconds).toBe(300)

            // Cleanup
            delete process.env.H2H_CUSTOM_CUTOFF
            delete process.env.H2H_CUSTOM_MIN_CONFIDENCE  
            delete process.env.H2H_CUSTOM_POLL_INTERVAL_SEC
        })
    })

    describe('error handling', () => {
        it('should gracefully handle discovery errors', async () => {
            // Mock a discovery error  
            const mockDiscoverCustomMatches = vi.fn().mockRejectedValueOnce(
                new Error('Discovery failed')
            )

            // Replace the actual function with our mock
            const { customMatchDiscoveryService } = await import('../../services/customMatchDiscoveryService')
            const originalFunction = customMatchDiscoveryService.discoverCustomMatches
            customMatchDiscoveryService.discoverCustomMatches = mockDiscoverCustomMatches

            const result = await orchestrator.runManualIngestion()

            expect(result.errors).toHaveLength(1)
            expect(result.errors[0].error).toContain('Discovery failed')

            // Restore original function
            customMatchDiscoveryService.discoverCustomMatches = originalFunction
        })
    })
})

// ========================================================================
// Test Helper Functions
// ========================================================================

function createRawTestMatch(): RawCustomMatch {
    return {
        match: {
            id: 583248686,
            date: '2024-01-15T14:30:00Z',
            type: 'CUSTOM',
            mapId: 51773,
            region: 'US',
            updated: '2024-01-15T14:35:00Z',
            duration: 300
        },
        map: {
            id: 51773,
            name: 'Test Map'
        },
        participants: [
            {
                participant: {
                    matchId: 583248686,
                    playerCharacterId: 123,
                    teamId: null,
                    teamStateDateTime: null,
                    decision: 'WIN',
                    ratingChange: null
                },
                team: null,
                teamState: null,
                twitchVodUrl: null,
                subOnlyTwitchVod: null
            },
            {
                participant: {
                    matchId: 583248686,
                    playerCharacterId: 456,
                    teamId: null,
                    teamStateDateTime: null,
                    decision: 'LOSS',
                    ratingChange: null
                },
                team: null,
                teamState: null,
                twitchVodUrl: null,
                subOnlyTwitchVod: null
            }
        ]
    }
}

function createProcessedTestMatch(matchId: string): ProcessedCustomMatch {
    return {
        matchId: parseInt(matchId),
        matchDate: '2024-01-15T14:30:00Z',
        dateKey: '2024-01-15',
        map: 'Test Map',
        duration: 300,
        participants: [
            {
                characterId: 123,
                battleTag: 'Player1#1234',
                name: 'Player1',
                isCommunityPlayer: true
            },
            {
                characterId: 456,
                battleTag: 'Player2#5678',
                name: 'Player2',
                isCommunityPlayer: true
            }
        ],
        confidence: 'low',
        confidenceFactors: {
            hasValidCharacterIds: true,
            bothCommunityPlayers: true,
            bothActiveRecently: false,
            hasReasonableDuration: true,
            similarSkillLevel: false,
            recognizedMap: false
        },
        processedAt: new Date().toISOString(),
        schemaVersion: '1.0.0'
    }
}