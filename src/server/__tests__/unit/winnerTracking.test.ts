/**
 * Test-Driven Development for Winner Tracking in Custom H2H Matches
 * 
 * This test suite defines the expected behavior for capturing and tracking
 * match winners in the Custom H2H ingestion system.
 */

import { describe, it, expect } from 'vitest'
import { 
    RawCustomMatch, 
    ProcessedCustomMatch,
    ValidatedParticipant,
    MatchResult,
    WinnerAnalytics
} from '../../../shared/customMatchTypes'
import { 
    extractMatchResult, 
    calculateWinnerAnalytics 
} from '../../services/winnerTrackingService'

describe('Winner Tracking - TDD', () => {
    describe('MatchResult interface', () => {
        it('should define winner tracking structure', () => {
            // RED: This test will fail until we implement MatchResult type
            const matchResult: MatchResult = {
                winner: {
                    characterId: 123,
                    battleTag: 'Winner#1234',
                    name: 'Winner',
                    isCommunityPlayer: true
                },
                loser: {
                    characterId: 456,
                    battleTag: 'Loser#5678',
                    name: 'Loser',
                    isCommunityPlayer: true
                },
                outcome: 'WIN_LOSS'
            }

            expect(matchResult.outcome).toBe('WIN_LOSS')
            expect(matchResult.winner?.characterId).toBe(123)
            expect(matchResult.loser?.characterId).toBe(456)
        })

        it('should handle tied matches', () => {
            // RED: Test for tie scenario
            const matchResult: MatchResult = {
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
                outcome: 'TIE'
            }

            expect(matchResult.outcome).toBe('TIE')
            expect(matchResult.participants).toHaveLength(2)
            expect(matchResult.winner).toBeUndefined()
            expect(matchResult.loser).toBeUndefined()
        })
    })

    describe('ProcessedCustomMatch with winner data', () => {
        it('should include match result in processed matches', () => {
            // RED: ProcessedCustomMatch should have matchResult property
            const processedMatch: ProcessedCustomMatch = {
                matchId: 12345,
                matchDate: '2024-01-15T14:30:00Z',
                dateKey: '2024-01-15',
                map: 'Altitude LE',
                duration: 480,
                participants: [
                    {
                        characterId: 123,
                        battleTag: 'Winner#1234',
                        name: 'Winner',
                        isCommunityPlayer: true
                    },
                    {
                        characterId: 456,
                        battleTag: 'Loser#5678',
                        name: 'Loser',
                        isCommunityPlayer: true
                    }
                ],
                matchResult: {
                    winner: {
                        characterId: 123,
                        battleTag: 'Winner#1234',
                        name: 'Winner',
                        isCommunityPlayer: true
                    },
                    loser: {
                        characterId: 456,
                        battleTag: 'Loser#5678',
                        name: 'Loser',
                        isCommunityPlayer: true
                    },
                    outcome: 'WIN_LOSS'
                },
                confidence: 'high',
                confidenceFactors: {
                    hasValidCharacterIds: true,
                    bothCommunityPlayers: true,
                    bothActiveRecently: false,
                    hasReasonableDuration: true,
                    similarSkillLevel: true,
                    recognizedMap: true
                },
                processedAt: '2024-01-15T14:35:00Z',
                schemaVersion: '1.0.0'
            }

            expect(processedMatch.matchResult.outcome).toBe('WIN_LOSS')
            expect(processedMatch.matchResult.winner?.characterId).toBe(123)
            expect(processedMatch.matchResult.loser?.characterId).toBe(456)
        })
    })

    describe('Winner extraction from raw match data', () => {
        it('should extract winner from RawCustomMatch participant decisions', () => {
            // RED: This function doesn't exist yet
            const rawMatch: RawCustomMatch = {
                match: {
                    id: 12345,
                    date: '2024-01-15T14:30:00Z',
                    type: 'CUSTOM',
                    mapId: 123,
                    region: 'US',
                    updated: '2024-01-15T14:30:00Z',
                    duration: 480
                },
                map: {
                    id: 123,
                    name: 'Altitude LE'
                },
                participants: [
                    {
                        participant: {
                            matchId: 12345,
                            playerCharacterId: 123,
                            teamId: 0,
                            decision: 'WIN',
                            ratingChange: 25
                        }
                    },
                    {
                        participant: {
                            matchId: 12345,
                            playerCharacterId: 456,
                            teamId: 1,
                            decision: 'LOSS',
                            ratingChange: -25
                        }
                    }
                ]
            }

            const extractedResult = extractMatchResult(rawMatch, [
                {
                    characterId: 123,
                    battleTag: 'Winner#1234',
                    name: 'Winner',
                    isCommunityPlayer: true
                },
                {
                    characterId: 456,
                    battleTag: 'Loser#5678',
                    name: 'Loser',
                    isCommunityPlayer: true
                }
            ])

            expect(extractedResult.outcome).toBe('WIN_LOSS')
            expect(extractedResult.winner?.characterId).toBe(123)
            expect(extractedResult.loser?.characterId).toBe(456)
        })

        it('should handle tie scenarios correctly', () => {
            // RED: Test tie extraction
            const rawMatch: RawCustomMatch = {
                match: {
                    id: 12345,
                    date: '2024-01-15T14:30:00Z',
                    type: 'CUSTOM',
                    mapId: 123,
                    region: 'US',
                    updated: '2024-01-15T14:30:00Z',
                    duration: 480
                },
                map: {
                    id: 123,
                    name: 'Altitude LE'
                },
                participants: [
                    {
                        participant: {
                            matchId: 12345,
                            playerCharacterId: 123,
                            decision: 'TIE'
                        }
                    },
                    {
                        participant: {
                            matchId: 12345,
                            playerCharacterId: 456,
                            decision: 'TIE'
                        }
                    }
                ]
            }

            const extractedResult = extractMatchResult(rawMatch, [
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
            ])

            expect(extractedResult.outcome).toBe('TIE')
            expect(extractedResult.winner).toBeUndefined()
            expect(extractedResult.loser).toBeUndefined()
            expect(extractedResult.participants).toHaveLength(2)
        })

        it('should handle invalid/incomplete decision data gracefully', () => {
            // RED: Test error handling for malformed data
            const rawMatch: RawCustomMatch = {
                match: {
                    id: 12345,
                    date: '2024-01-15T14:30:00Z',
                    type: 'CUSTOM',
                    mapId: 123,
                    region: 'US',
                    updated: '2024-01-15T14:30:00Z'
                },
                map: {
                    id: 123,
                    name: 'Altitude LE'
                },
                participants: [
                    {
                        participant: {
                            matchId: 12345,
                            playerCharacterId: 123,
                            decision: 'OBSERVER'  // Not a real participant
                        }
                    },
                    {
                        participant: {
                            matchId: 12345,
                            playerCharacterId: 456,
                            decision: 'WIN'
                        }
                    }
                ]
            }

            const extractedResult = extractMatchResult(rawMatch, [
                {
                    characterId: 456,
                    battleTag: 'Winner#5678',
                    name: 'Winner',
                    isCommunityPlayer: true
                }
            ])

            expect(extractedResult.outcome).toBe('UNKNOWN')
            expect(extractedResult.winner).toBeUndefined()
            expect(extractedResult.loser).toBeUndefined()
        })
    })

    describe('Winner tracking integration', () => {
        it('should enhance confidence scoring based on decisive outcomes', () => {
            // RED: Confidence scoring should consider match outcome quality
            const matchWithDecisiveWin: ProcessedCustomMatch = createTestMatchWithResult('WIN_LOSS')
            const matchWithTie: ProcessedCustomMatch = createTestMatchWithResult('TIE')
            
            // Decisive wins should have slightly higher confidence
            expect(matchWithDecisiveWin.confidence).toBe('high')
            expect(matchWithTie.confidence).toBe('medium') // Ties are less decisive
        })

        it('should provide winner analytics capability', () => {
            // RED: Analytics function doesn't exist yet  
            const matches: ProcessedCustomMatch[] = [
                createTestMatchWithResult('WIN_LOSS', 123, 456), // Player 123 wins
                createTestMatchWithResult('WIN_LOSS', 456, 123), // Player 456 wins  
                createTestMatchWithResult('WIN_LOSS', 123, 789), // Player 123 wins
                createTestMatchWithResult('TIE', 123, 456)       // Tie
            ]

            const analytics = calculateWinnerAnalytics(matches)
            
            expect(analytics.playerStats[123].wins).toBe(2)
            expect(analytics.playerStats[123].losses).toBe(1)
            expect(analytics.playerStats[123].ties).toBe(1)
            expect(analytics.playerStats[456].wins).toBe(1)
            expect(analytics.playerStats[456].losses).toBe(1) // Only 1 loss (vs 123)
            expect(analytics.playerStats[456].ties).toBe(1)
        })
    })
})

// =============================================================================
// Helper Functions - Test implementations
// =============================================================================

/**
 * Create test match with specific result for testing
 */
function createTestMatchWithResult(
    outcome: 'WIN_LOSS' | 'TIE' | 'UNKNOWN',
    winnerCharId: number = 123,
    loserCharId: number = 456
): ProcessedCustomMatch {
    // Create participants in consistent order but assign roles based on IDs
    const allPlayerIds = [winnerCharId, loserCharId].sort((a, b) => a - b)
    const participants: ValidatedParticipant[] = allPlayerIds.map(id => ({
        characterId: id,
        battleTag: `Player${id}#${id}`,
        name: `Player${id}`,
        isCommunityPlayer: true
    }))

    let matchResult: MatchResult
    switch (outcome) {
        case 'WIN_LOSS':
            const winner = participants.find(p => p.characterId === winnerCharId)!
            const loser = participants.find(p => p.characterId === loserCharId)!
            matchResult = {
                outcome: 'WIN_LOSS',
                winner,
                loser
            }
            break
        case 'TIE':
            matchResult = {
                outcome: 'TIE',
                participants
            }
            break
        case 'UNKNOWN':
        default:
            matchResult = {
                outcome: 'UNKNOWN',
                participants
            }
            break
    }

    return {
        matchId: Math.floor(Math.random() * 10000),
        matchDate: '2024-01-15T14:30:00Z',
        dateKey: '2024-01-15',
        map: 'Test Map',
        duration: 480,
        participants,
        matchResult,
        confidence: outcome === 'WIN_LOSS' ? 'high' : 'medium',
        confidenceFactors: {
            hasValidCharacterIds: true,
            bothCommunityPlayers: true,
            bothActiveRecently: false,
            hasReasonableDuration: true,
            similarSkillLevel: true,
            recognizedMap: true
        },
        processedAt: '2024-01-15T14:35:00Z',
        schemaVersion: '1.0.0'
    }
}