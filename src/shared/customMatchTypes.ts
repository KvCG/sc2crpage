/**
 * Custom Match Ingestion Types
 * 
 * Type definitions for the H2H custom match discovery and validation system.
 * Follows existing shared type patterns for consistency with the SC2CR codebase.
 */

/**
 * Confidence level for custom match validity and quality
 */
export type MatchConfidence = 'low' | 'medium' | 'high'

/**
 * Match outcome types for winner tracking
 */
export type MatchOutcome = 'WIN_LOSS' | 'TIE' | 'UNKNOWN'

/**
 * Match result tracking winner/loser information
 */
export interface MatchResult {
    /** The outcome type of the match */
    outcome: MatchOutcome
    /** Winner participant (for WIN_LOSS outcomes) */
    winner?: ValidatedParticipant
    /** Loser participant (for WIN_LOSS outcomes) */
    loser?: ValidatedParticipant
    /** All participants (for TIE or UNKNOWN outcomes) */
    participants?: ValidatedParticipant[]
}

/**
 * Validated participant information from Pulse
 */
export interface ValidatedParticipant {
    /** SC2 Pulse character ID */
    characterId: number
    /** Player's BattleTag (e.g., "Player#1234") */
    battleTag: string
    /** Display name */
    name: string
    /** Current MMR rating if available */
    rating?: number
    /** Main race if determinable */
    race?: 'PROTOSS' | 'TERRAN' | 'ZERG' | 'RANDOM'
    /** Whether player is in our community dataset */
    isCommunityPlayer: boolean
}

/**
 * Raw custom match data from Pulse API (matches the /api/character-matches response)
 */
export interface RawCustomMatch {
    /** Match information from Pulse */
    match: {
        /** Unique match identifier from Pulse */
        id: number
        /** ISO timestamp of match completion */
        date: string
        /** Match type (should be CUSTOM for our filtering) */
        type: string
        /** Map ID reference */
        mapId: number
        /** Region (US, EU, etc.) */
        region: string
        /** Last update timestamp */
        updated: string
        /** Match duration in seconds (often null for custom games) */
        duration?: number | null
    }
    /** Map information */
    map: {
        /** Map ID */
        id: number
        /** Map display name */
        name: string
    }
    /** Match participants */
    participants: Array<{
        participant: {
            matchId: number
            playerCharacterId: number
            teamId?: number | null
            teamStateDateTime?: string | null
            decision: 'WIN' | 'LOSS' | 'TIE' | 'OBSERVER'
            ratingChange?: number | null
        }
        team?: any
        teamState?: any
        twitchVodUrl?: string | null
        subOnlyTwitchVod?: boolean | null
    }>
}

/**
 * Processed and validated custom match ready for storage
 */
export interface ProcessedCustomMatch {
    /** Original match ID from Pulse */
    matchId: number
    /** ISO timestamp of match completion */
    matchDate: string
    /** Date portion for partitioning (YYYY-MM-DD) */
    dateKey: string
    /** Map name */
    map: string
    /** Match duration in seconds */
    duration?: number
    /** Validated participants (only community players) */
    participants: ValidatedParticipant[]
    /** Match winner/loser tracking */
    matchResult: MatchResult
    /** Computed confidence level */
    confidence: MatchConfidence
    /** Confidence scoring details for debugging */
    confidenceFactors: ConfidenceFactors
    /** Processing timestamp */
    processedAt: string
    /** Processing version for schema evolution */
    schemaVersion: string
}

/**
 * Factors contributing to confidence scoring
 */
export interface ConfidenceFactors {
    /** Both players have valid Pulse character IDs */
    hasValidCharacterIds: boolean
    /** Both players are in community dataset */
    bothCommunityPlayers: boolean
    /** Both players have recent activity */
    bothActiveRecently: boolean
    /** Match has reasonable duration */
    hasReasonableDuration: boolean
    /** Players have similar skill levels */
    similarSkillLevel: boolean
    /** Map is recognized/standard */
    recognizedMap: boolean
}

/**
 * Configuration for the custom match ingestion system
 */
export interface CustomMatchConfig {
    /** Only process matches after this date (YYYY-MM-DD) */
    cutoffDate: string
    /** Minimum confidence level to store */
    minConfidence: MatchConfidence
    /** Polling interval in seconds */
    pollIntervalSeconds: number
    /** Maximum matches to process per batch */
    batchSize: number
    /** Days to look back for new matches */
    lookbackDays: number
}

/**
 * Result of a single ingestion run
 */
export interface IngestionResult {
    /** Total matches discovered from Pulse */
    matchesDiscovered: number
    /** Matches with valid participants */
    matchesWithValidParticipants: number
    /** Matches meeting confidence threshold */
    matchesMeetingThreshold: number
    /** New matches stored (after de-duplication) */
    newMatchesStored: number
    /** Matches skipped due to duplicates */
    duplicatesSkipped: number
    /** Processing errors encountered */
    errors: Array<{
        matchId?: string
        error: string
        context?: Record<string, any>
    }>
    /** Ingestion run timestamp */
    timestamp: string
    /** Processing duration in milliseconds */
    durationMs: number
}

/**
 * Status of the ingestion system
 */
export interface IngestionStatus {
    /** Whether the system is currently running */
    isRunning: boolean
    /** Last successful ingestion run */
    lastRun?: IngestionResult
    /** Current configuration */
    config: CustomMatchConfig
    /** System uptime since last start */
    uptimeMs: number
    /** Next scheduled run (if applicable) */
    nextRunAt?: string
}

/**
 * Player statistics for winner analytics
 */
export interface PlayerStats {
    /** Number of wins */
    wins: number
    /** Number of losses */
    losses: number
    /** Number of ties */
    ties: number
    /** Win rate percentage (wins / (wins + losses)) */
    winRate: number
}

/**
 * Winner analytics result
 */
export interface WinnerAnalytics {
    /** Statistics by player character ID */
    playerStats: Record<number, PlayerStats>
    /** Total matches analyzed */
    totalMatches: number
    /** Total decisive matches (excluding ties) */
    decisiveMatches: number
}