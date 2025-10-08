/**
 * Unit Tests for Match Confidence Scorer
 * 
 * Tests the table-driven confidence scoring system with focused scenarios.
 * Uses minimal mocking and emphasizes pure function testing.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { 
    MatchConfidenceScorer, 
    createMatchConfidenceScorer 
} from '../../services/matchConfidenceScorer'
import { ProcessedCustomMatch, ValidatedParticipant } from '../../../shared/customMatchTypes'

describe('MatchConfidenceScorer', () => {
    let scorer: MatchConfidenceScorer
    
    beforeEach(() => {
        scorer = createMatchConfidenceScorer()
    })

    describe('confidence factor computation', () => {
        it('should identify valid character IDs', () => {
            const match = createTestMatch({
                participants: [
                    createTestParticipant({ characterId: 123, isCommunityPlayer: true }),
                    createTestParticipant({ characterId: 456, isCommunityPlayer: true })
                ]
            })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.hasValidCharacterIds).toBe(true)
        })

        it('should detect invalid character IDs', () => {
            const match = createTestMatch({
                participants: [
                    createTestParticipant({ characterId: 0, isCommunityPlayer: true }),
                    createTestParticipant({ characterId: 456, isCommunityPlayer: true })
                ]
            })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.hasValidCharacterIds).toBe(false)
        })

        it('should validate community player status', () => {
            const match = createTestMatch({
                participants: [
                    createTestParticipant({ characterId: 123, isCommunityPlayer: true }),
                    createTestParticipant({ characterId: 456, isCommunityPlayer: true })
                ]
            })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.bothCommunityPlayers).toBe(true)
        })

        it('should detect non-community players', () => {
            const match = createTestMatch({
                participants: [
                    createTestParticipant({ characterId: 123, isCommunityPlayer: true }),
                    createTestParticipant({ characterId: 456, isCommunityPlayer: false })
                ]
            })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.bothCommunityPlayers).toBe(false)
        })

        it('should validate reasonable match duration', () => {
            const match = createTestMatch({ duration: 300 }) // 5 minutes

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.hasReasonableDuration).toBe(true)
        })

        it('should reject too short matches', () => {
            const match = createTestMatch({ duration: 30 }) // 30 seconds

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.hasReasonableDuration).toBe(false)
        })

        it('should reject too long matches', () => {
            const match = createTestMatch({ duration: 7200 }) // 2 hours

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.hasReasonableDuration).toBe(false)
        })

        it('should detect similar skill levels', () => {
            const match = createTestMatch({
                participants: [
                    createTestParticipant({ characterId: 123, isCommunityPlayer: true, rating: 3000 }),
                    createTestParticipant({ characterId: 456, isCommunityPlayer: true, rating: 3100 })
                ]
            })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.similarSkillLevel).toBe(true)
        })

        it('should detect dissimilar skill levels', () => {
            const match = createTestMatch({
                participants: [
                    createTestParticipant({ characterId: 123, isCommunityPlayer: true, rating: 2000 }),
                    createTestParticipant({ characterId: 456, isCommunityPlayer: true, rating: 3000 })
                ]
            })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.similarSkillLevel).toBe(false)
        })

        it('should recognize standard maps', () => {
            const match = createTestMatch({ map: 'Altitude LE' })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.recognizedMap).toBe(true)
        })

        it('should not recognize custom maps', () => {
            const match = createTestMatch({ map: 'Unknown Custom Map' })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidenceFactors.recognizedMap).toBe(false)
        })
    })

    describe('confidence level determination', () => {
        it('should assign low confidence for minimal factors', () => {
            const match = createTestMatch({
                duration: 30, // Too short
                map: 'Unknown Map',
                participants: [
                    createTestParticipant({ characterId: 123, isCommunityPlayer: true, rating: undefined }),
                    createTestParticipant({ characterId: 456, isCommunityPlayer: true, rating: undefined })
                ]
            })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidence).toBe('low')
        })

        it('should assign medium confidence for moderate factors', () => {
            const match = createTestMatch({
                duration: 300, // Good duration
                map: 'Unknown Custom Map', // Unrecognized map (-1 point)
                participants: [
                    createTestParticipant({ characterId: 123, isCommunityPlayer: true, rating: 3000 }),
                    createTestParticipant({ characterId: 456, isCommunityPlayer: true, rating: 3500 }) // Different skill level (-1 point)
                ]
            })

            const scored = scorer.scoreMatch(match)
            expect(scored.confidence).toBe('medium')
        })

        it('should assign high confidence for optimal factors', () => {
            // Create a scorer with lower thresholds for testing
            const testScorer = createMatchConfidenceScorer({
                thresholds: { medium: 4, high: 6 }
            })

            const match = createTestMatch({
                duration: 300,
                map: 'Altitude LE',
                participants: [
                    createTestParticipant({ characterId: 123, isCommunityPlayer: true, rating: 3000 }),
                    createTestParticipant({ characterId: 456, isCommunityPlayer: true, rating: 3100 })
                ]
            })

            const scored = testScorer.scoreMatch(match)
            expect(scored.confidence).toBe('high')
        })
    })

    describe('batch scoring', () => {
        it('should score multiple matches efficiently', () => {
            const matches = [
                createTestMatch({ map: 'Altitude LE' }),
                createTestMatch({ map: 'Unknown Map' }),
                createTestMatch({ duration: 600, map: 'Babylon LE' })
            ]

            const scored = scorer.scoreMatches(matches)
            
            expect(scored).toHaveLength(3)
            expect(scored[0].confidence).toBeDefined()
            expect(scored[1].confidence).toBeDefined()
            expect(scored[2].confidence).toBeDefined()
        })
    })

    describe('configuration management', () => {
        it('should allow runtime configuration updates', () => {
            const initialConfig = scorer.getConfig()
            
            scorer.updateConfig({
                factorPoints: { 
                    hasValidCharacterIds: 10,
                    bothCommunityPlayers: initialConfig.factorPoints.bothCommunityPlayers,
                    bothActiveRecently: initialConfig.factorPoints.bothActiveRecently,
                    hasReasonableDuration: initialConfig.factorPoints.hasReasonableDuration,
                    similarSkillLevel: initialConfig.factorPoints.similarSkillLevel,
                    recognizedMap: initialConfig.factorPoints.recognizedMap
                }
            })
            
            const updatedConfig = scorer.getConfig()
            expect(updatedConfig.factorPoints.hasValidCharacterIds).toBe(10)
            expect(updatedConfig.factorPoints.bothCommunityPlayers).toBe(initialConfig.factorPoints.bothCommunityPlayers)
        })

        it('should allow adding recognized maps', () => {
            scorer.addRecognizedMaps(['Test Map LE', 'Another Map'])
            
            const match = createTestMatch({ map: 'Test Map LE' })
            const scored = scorer.scoreMatch(match)
            
            expect(scored.confidenceFactors.recognizedMap).toBe(true)
        })
    })

    describe('scoring statistics', () => {
        it('should provide accurate statistics', () => {
            const matches = [
                createTestMatch({ map: 'Altitude LE', duration: 300 }),
                createTestMatch({ map: 'Unknown Map', duration: 30 }),
                createTestMatch({ map: 'Babylon LE', duration: 600 })
            ]

            const stats = scorer.getScoringStats(matches)
            
            expect(stats.totalMatches).toBe(3)
            expect(stats.confidenceCounts.low).toBeGreaterThan(0)
            expect(stats.avgScore).toBeGreaterThan(0)
            expect(stats.factorFrequency.recognizedMap).toBe(2) // 2 out of 3 maps are recognized
        })
    })
})

// ========================================================================
// Test Helper Functions
// ========================================================================

/**
 * Create a test participant with sensible defaults
 */
function createTestParticipant(overrides: Partial<ValidatedParticipant> = {}): ValidatedParticipant {
    return {
        characterId: 123,
        battleTag: 'Player#1234',
        name: 'Player',
        isCommunityPlayer: true,
        ...overrides
    }
}

/**
 * Create a test match with sensible defaults and optional overrides
 */
function createTestMatch(overrides: Partial<ProcessedCustomMatch> = {}): ProcessedCustomMatch {
    const defaultParticipants: ValidatedParticipant[] = [
        {
            characterId: 123,
            battleTag: 'Player1#1234',
            name: 'Player1',
            rating: undefined,
            isCommunityPlayer: true
        },
        {
            characterId: 456,
            battleTag: 'Player2#5678',
            name: 'Player2',
            rating: undefined,
            isCommunityPlayer: true
        }
    ]

    return {
        matchId: 123,
        matchDate: '2024-01-15T14:30:00Z',
        dateKey: '2024-01-15',
        map: 'Test Map',
        duration: 120,
        participants: overrides.participants || defaultParticipants,
        confidence: 'low',
        confidenceFactors: {
            hasValidCharacterIds: false,
            bothCommunityPlayers: false,
            bothActiveRecently: false,
            hasReasonableDuration: false,
            similarSkillLevel: false,
            recognizedMap: false
        },
        processedAt: '2024-01-15T14:35:00Z',
        schemaVersion: '1.0.0',
        ...overrides
    }
}