/**
 * Match Confidence Scoring System
 * 
 * Table-driven confidence scoring for custom matches based on various quality factors.
 * Uses a simple point-based system with configurable thresholds for low/medium/high confidence.
 */

import { 
    ProcessedCustomMatch, 
    MatchConfidence, 
    ConfidenceFactors,
    ValidatedParticipant
} from '../../shared/customMatchTypes'
import logger from '../logging/logger'

/**
 * Configuration for confidence scoring rules
 */
interface ConfidenceScoringConfig {
    /** Points awarded for each factor */
    factorPoints: {
        hasValidCharacterIds: number
        bothCommunityPlayers: number
        bothActiveRecently: number
        hasReasonableDuration: number
        similarSkillLevel: number
        recognizedMap: number
    }
    /** Thresholds for confidence levels (inclusive) */
    thresholds: {
        medium: number  // >= this score = medium
        high: number    // >= this score = high
    }
    /** Configuration for specific checks */
    rules: {
        /** Minimum duration (seconds) for reasonable match */
        minDurationSeconds: number
        /** Maximum duration (seconds) for reasonable match */
        maxDurationSeconds: number
        /** Days back to consider "active recently" */
        activeRecentlyDays: number
        /** MMR difference threshold for "similar skill" */
        similarSkillMmrThreshold: number
        /** Known good maps (could be expanded) */
        recognizedMaps: Set<string>
    }
}

/**
 * Default scoring configuration - tuned for conservative confidence levels
 */
const DEFAULT_SCORING_CONFIG: ConfidenceScoringConfig = {
    factorPoints: {
        hasValidCharacterIds: 2,    // Essential for tracking
        bothCommunityPlayers: 3,    // Core requirement
        bothActiveRecently: 1,      // Nice to have
        hasReasonableDuration: 1,   // Basic quality check
        similarSkillLevel: 1,       // Indicates competitive match
        recognizedMap: 1            // Map quality indicator
    },
    thresholds: {
        medium: 6,  // At least community players + character IDs + one other factor
        high: 8     // Most factors present
    },
    rules: {
        minDurationSeconds: 60,     // 1 minute minimum
        maxDurationSeconds: 3600,   // 1 hour maximum
        activeRecentlyDays: 7,      // Last week
        similarSkillMmrThreshold: 300, // 300 MMR difference
        recognizedMaps: new Set([
            // Popular 1v1 maps (can be extended)
            'Altitude LE',
            'Ancient Cistern LE', 
            'Babylon LE',
            'Dragon Scales LE',
            'Gresvan LE',
            'Neohumanity LE',
            'Royal Blood LE'
        ])
    }
}

/**
 * Confidence scoring service with table-driven rules
 */
export class MatchConfidenceScorer {
    private config: ConfidenceScoringConfig

    constructor(config: Partial<ConfidenceScoringConfig> = {}) {
        this.config = {
            ...DEFAULT_SCORING_CONFIG,
            ...config,
            factorPoints: {
                ...DEFAULT_SCORING_CONFIG.factorPoints,
                ...config.factorPoints
            },
            thresholds: {
                ...DEFAULT_SCORING_CONFIG.thresholds,
                ...config.thresholds
            },
            rules: {
                ...DEFAULT_SCORING_CONFIG.rules,
                ...config.rules
            }
        }
    }

    /**
     * Score a processed match and assign confidence level
     */
    scoreMatch(match: ProcessedCustomMatch): ProcessedCustomMatch {
        // Compute confidence factors
        const factors = this.computeConfidenceFactors(match)
        
        // Calculate total score
        const score = this.calculateScore(factors)
        
        // Determine confidence level
        const confidence = this.determineConfidenceLevel(score)

        logger.debug(
            { 
                feature: 'confidence-scoring',
                matchId: match.matchId,
                score,
                confidence,
                factors
            },
            'Match confidence scored'
        )

        return {
            ...match,
            confidence,
            confidenceFactors: factors
        }
    }

    /**
     * Score multiple matches efficiently
     */
    scoreMatches(matches: ProcessedCustomMatch[]): ProcessedCustomMatch[] {
        return matches.map(match => this.scoreMatch(match))
    }

    /**
     * Compute all confidence factors for a match
     */
    private computeConfidenceFactors(match: ProcessedCustomMatch): ConfidenceFactors {
        return {
            hasValidCharacterIds: this.hasValidCharacterIds(match.participants),
            bothCommunityPlayers: this.bothCommunityPlayers(match.participants),
            bothActiveRecently: this.bothActiveRecently(match.participants),
            hasReasonableDuration: this.hasReasonableDuration(match.duration),
            similarSkillLevel: this.haveSimilarSkillLevel(match.participants),
            recognizedMap: this.isRecognizedMap(match.map)
        }
    }

    /**
     * Calculate numerical score from factors
     */
    private calculateScore(factors: ConfidenceFactors): number {
        let score = 0
        const { factorPoints } = this.config

        if (factors.hasValidCharacterIds) score += factorPoints.hasValidCharacterIds
        if (factors.bothCommunityPlayers) score += factorPoints.bothCommunityPlayers
        if (factors.bothActiveRecently) score += factorPoints.bothActiveRecently
        if (factors.hasReasonableDuration) score += factorPoints.hasReasonableDuration
        if (factors.similarSkillLevel) score += factorPoints.similarSkillLevel
        if (factors.recognizedMap) score += factorPoints.recognizedMap

        return score
    }

    /**
     * Determine confidence level from score
     */
    private determineConfidenceLevel(score: number): MatchConfidence {
        const { thresholds } = this.config
        
        if (score >= thresholds.high) return 'high'
        if (score >= thresholds.medium) return 'medium'
        return 'low'
    }

    // ========================================================================
    // Individual Factor Checkers
    // ========================================================================

    private hasValidCharacterIds(participants: ValidatedParticipant[]): boolean {
        return participants.every(p => p.characterId && p.characterId > 0)
    }

    private bothCommunityPlayers(participants: ValidatedParticipant[]): boolean {
        return participants.length === 2 && participants.every(p => p.isCommunityPlayer)
    }

    private bothActiveRecently(_participants: ValidatedParticipant[]): boolean {
        // This would require recent activity data from Pulse
        // For MVP, return false as we don't have this data yet
        return false
    }

    private hasReasonableDuration(duration?: number): boolean {
        if (!duration) return false
        const { minDurationSeconds, maxDurationSeconds } = this.config.rules
        return duration >= minDurationSeconds && duration <= maxDurationSeconds
    }

    private haveSimilarSkillLevel(participants: ValidatedParticipant[]): boolean {
        if (participants.length !== 2) return false
        
        const [p1, p2] = participants
        if (!p1.rating || !p2.rating) return false
        
        const mmrDiff = Math.abs(p1.rating - p2.rating)
        return mmrDiff <= this.config.rules.similarSkillMmrThreshold
    }

    private isRecognizedMap(mapName: string): boolean {
        return this.config.rules.recognizedMaps.has(mapName)
    }

    // ========================================================================
    // Configuration and Monitoring
    // ========================================================================

    /**
     * Get current scoring configuration for debugging
     */
    getConfig(): ConfidenceScoringConfig {
        return { ...this.config }
    }

    /**
     * Update scoring configuration at runtime
     */
    updateConfig(newConfig: Partial<ConfidenceScoringConfig>): void {
        this.config = {
            ...this.config,
            ...newConfig,
            factorPoints: {
                ...this.config.factorPoints,
                ...newConfig.factorPoints
            },
            thresholds: {
                ...this.config.thresholds,
                ...newConfig.thresholds
            },
            rules: {
                ...this.config.rules,
                ...newConfig.rules
            }
        }
    }

    /**
     * Add recognized maps to the scoring system
     */
    addRecognizedMaps(maps: string[]): void {
        maps.forEach(map => this.config.rules.recognizedMaps.add(map))
    }

    /**
     * Get scoring statistics for monitoring
     */
    getScoringStats(matches: ProcessedCustomMatch[]) {
        const scoredMatches = matches.map(match => this.scoreMatch(match))
        
        const confidenceCounts = {
            low: scoredMatches.filter(m => m.confidence === 'low').length,
            medium: scoredMatches.filter(m => m.confidence === 'medium').length,
            high: scoredMatches.filter(m => m.confidence === 'high').length
        }

        const avgScore = scoredMatches.reduce((sum, match) => {
            return sum + this.calculateScore(match.confidenceFactors)
        }, 0) / scoredMatches.length || 0

        return {
            totalMatches: scoredMatches.length,
            confidenceCounts,
            avgScore: Math.round(avgScore * 100) / 100,
            factorFrequency: this.calculateFactorFrequency(scoredMatches)
        }
    }

    private calculateFactorFrequency(matches: ProcessedCustomMatch[]) {
        const factorCounts = {
            hasValidCharacterIds: 0,
            bothCommunityPlayers: 0,
            bothActiveRecently: 0,
            hasReasonableDuration: 0,
            similarSkillLevel: 0,
            recognizedMap: 0
        }

        matches.forEach(match => {
            const factors = match.confidenceFactors
            Object.keys(factorCounts).forEach(key => {
                if (factors[key as keyof ConfidenceFactors]) {
                    factorCounts[key as keyof typeof factorCounts]++
                }
            })
        })

        return factorCounts
    }
}

// Export singleton instance with default configuration
export const matchConfidenceScorer = new MatchConfidenceScorer()

// Export factory function for testing with custom configuration
export function createMatchConfidenceScorer(config?: Partial<ConfidenceScoringConfig>): MatchConfidenceScorer {
    return new MatchConfidenceScorer(config)
}