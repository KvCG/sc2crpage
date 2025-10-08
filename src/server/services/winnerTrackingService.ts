/**
 * Winner Tracking Utilities
 * 
 * Provides functionality to extract and track match winners from Custom H2H matches.
 * Integrates with the existing Custom Match ingestion system.
 */

import { 
    RawCustomMatch, 
    ProcessedCustomMatch, 
    ValidatedParticipant, 
    MatchResult, 
    MatchOutcome,
    WinnerAnalytics,
    PlayerStats
} from '../../shared/customMatchTypes'
import logger from '../logging/logger'

/**
 * Extract match result from raw Pulse data and validated participants
 */
export function extractMatchResult(
    rawMatch: RawCustomMatch, 
    validatedParticipants: ValidatedParticipant[]
): MatchResult {
    const participantMap = new Map<number, ValidatedParticipant>()
    validatedParticipants.forEach(p => participantMap.set(p.characterId, p))

    // Filter to only actual participants (not observers)
    const actualParticipants = rawMatch.participants.filter(
        p => p.participant.decision !== 'OBSERVER'
    )

    // Extract decisions for community players only
    const decisions = actualParticipants
        .map(p => ({
            characterId: p.participant.playerCharacterId,
            decision: p.participant.decision,
            participant: participantMap.get(p.participant.playerCharacterId)
        }))
        .filter(d => d.participant) // Only community players

    if (decisions.length < 2) {
        logger.warn(
            { 
                matchId: rawMatch.match.id,
                decisionsCount: decisions.length,
                feature: 'winner-tracking'
            },
            'Insufficient valid participants for winner determination'
        )
        return {
            outcome: 'UNKNOWN',
            participants: validatedParticipants
        }
    }

    // Check for tie
    const uniqueDecisions = new Set(decisions.map(d => d.decision))
    if (uniqueDecisions.has('TIE') || (uniqueDecisions.size === 1 && uniqueDecisions.has('TIE'))) {
        return {
            outcome: 'TIE',
            participants: validatedParticipants
        }
    }

    // Look for winner/loser pair
    const winner = decisions.find(d => d.decision === 'WIN')
    const loser = decisions.find(d => d.decision === 'LOSS')

    if (winner?.participant && loser?.participant) {
        return {
            outcome: 'WIN_LOSS',
            winner: winner.participant,
            loser: loser.participant
        }
    }

    // Fallback for unclear results
    logger.warn(
        { 
            matchId: rawMatch.match.id,
            decisions: decisions.map(d => ({ characterId: d.characterId, decision: d.decision })),
            feature: 'winner-tracking'
        },
        'Unable to determine clear winner/loser'
    )
    
    return {
        outcome: 'UNKNOWN',
        participants: validatedParticipants
    }
}

/**
 * Calculate comprehensive winner analytics from processed matches
 */
export function calculateWinnerAnalytics(matches: ProcessedCustomMatch[]): WinnerAnalytics {
    const playerStats: Record<number, PlayerStats> = {}
    let decisiveMatches = 0

    // Initialize or update player stats
    const updatePlayerStats = (characterId: number, wins: number, losses: number, ties: number) => {
        if (!playerStats[characterId]) {
            playerStats[characterId] = { wins: 0, losses: 0, ties: 0, winRate: 0 }
        }
        playerStats[characterId].wins += wins
        playerStats[characterId].losses += losses
        playerStats[characterId].ties += ties
    }

    // Process each match
    matches.forEach(match => {
        switch (match.matchResult.outcome) {
            case 'WIN_LOSS':
                if (match.matchResult.winner && match.matchResult.loser) {
                    updatePlayerStats(match.matchResult.winner.characterId, 1, 0, 0)
                    updatePlayerStats(match.matchResult.loser.characterId, 0, 1, 0)
                    decisiveMatches++
                }
                break
            case 'TIE':
                match.matchResult.participants?.forEach(participant => {
                    updatePlayerStats(participant.characterId, 0, 0, 1)
                })
                break
            case 'UNKNOWN':
                // Don't count unknown results in statistics
                break
        }
    })

    // Calculate win rates
    Object.values(playerStats).forEach(stats => {
        const totalDecisive = stats.wins + stats.losses
        stats.winRate = totalDecisive > 0 ? (stats.wins / totalDecisive) * 100 : 0
    })

    return {
        playerStats,
        totalMatches: matches.length,
        decisiveMatches
    }
}

/**
 * Enhance confidence scoring based on match outcome decisiveness
 * Decisive wins/losses are slightly more valuable than ties or unknown outcomes
 */
export function getOutcomeConfidenceBoost(outcome: MatchOutcome): number {
    switch (outcome) {
        case 'WIN_LOSS':
            return 0.1 // Small boost for decisive outcomes
        case 'TIE':
            return 0.0 // No boost for ties
        case 'UNKNOWN':
            return -0.1 // Small penalty for unclear outcomes
        default:
            return 0.0
    }
}