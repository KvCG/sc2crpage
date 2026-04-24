import supabase from '../db/supabaseClient'
import { communityDataService } from './communityDataService'
import { persistMatch } from './h2hService'
import logger from '../logging/logger'
import type { PendingMatch, H2HMatch } from '../../shared/types'

// ============================================================================
// Typed errors
// ============================================================================

export type PendingServiceErrorCode =
    | 'NOT_FOUND'
    | 'ALREADY_REVIEWED'
    | 'UNKNOWN_PLAYER'
    | 'INVALID_WINNER'
    | 'SAME_PLAYER'
    | 'TEAM_MATCH'

export class PendingServiceError extends Error {
    readonly code: PendingServiceErrorCode

    constructor(code: PendingServiceErrorCode, message: string) {
        super(message)
        this.name = 'PendingServiceError'
        this.code = code
    }
}

// ============================================================================
// Internal row type
// ============================================================================

interface PendingMatchRow {
    id: number
    match_id: string
    match_date: string
    map_name: string
    region: string
    candidate_ids: number[]
    raw_decisions: Array<{ characterId: number; decision: string }>
    reason: PendingMatch['reason']
    active_player_count: number
    win_count: number
    loss_count: number
    observer_count: number
    inferred_mode: PendingMatch['inferredMode']
    reviewed_at: string | null
    review_outcome: 'confirmed' | 'rejected' | null
}

function rowToDto(row: PendingMatchRow): PendingMatch {
    return {
        id: row.id,
        matchId: row.match_id,
        matchDate: row.match_date,
        mapName: row.map_name,
        region: row.region,
        candidateIds: row.candidate_ids,
        rawDecisions: row.raw_decisions,
        reason: row.reason,
        activePlayerCount: row.active_player_count,
        winCount: row.win_count,
        lossCount: row.loss_count,
        observerCount: row.observer_count,
        inferredMode: row.inferred_mode,
        reviewedAt: row.reviewed_at,
        reviewOutcome: row.review_outcome,
    }
}

// ============================================================================
// List
// ============================================================================

export async function listPendingMatches(): Promise<PendingMatch[]> {
    const { data, error } = await supabase
        .from('h2h_pending_matches')
        .select('*')
        .is('review_outcome', null)
        .order('match_date', { ascending: false })

    if (error) {
        logger.error(
            { feature: 'pending-matches', err: error },
            'Supabase error listing pending matches',
        )
        throw error
    }

    return (data as PendingMatchRow[]).map(rowToDto)
}

// ============================================================================
// Confirm
// ============================================================================

export async function confirmPendingMatch(
    id: number,
    player1CharacterId: number,
    player2CharacterId: number,
    winnerCharacterId: number,
): Promise<void> {
    if (player1CharacterId === player2CharacterId) {
        throw new PendingServiceError(
            'SAME_PLAYER',
            'player1CharacterId and player2CharacterId must be different',
        )
    }

    if (winnerCharacterId !== player1CharacterId && winnerCharacterId !== player2CharacterId) {
        throw new PendingServiceError(
            'INVALID_WINNER',
            'winnerCharacterId must be one of player1CharacterId or player2CharacterId',
        )
    }

    const { data: row, error: fetchError } = await supabase
        .from('h2h_pending_matches')
        .select('*')
        .eq('id', id)
        .maybeSingle()

    if (fetchError) {
        logger.error(
            { feature: 'pending-matches', id, err: fetchError },
            'Supabase error fetching pending match',
        )
        throw fetchError
    }

    if (!row) {
        throw new PendingServiceError('NOT_FOUND', `Pending match ${id} not found`)
    }

    const pending = row as PendingMatchRow

    if (pending.review_outcome !== null) {
        throw new PendingServiceError(
            'ALREADY_REVIEWED',
            `Pending match ${id} has already been reviewed (${pending.review_outcome})`,
        )
    }

    if (pending.reason !== 'multi_winner') {
        throw new PendingServiceError(
            'TEAM_MATCH',
            `Cannot confirm a team match (reason=${pending.reason}) into 1v1 history — reject it instead`,
        )
    }

    const [meta1, meta2] = await Promise.all([
        communityDataService.getCommunityPlayer(player1CharacterId),
        communityDataService.getCommunityPlayer(player2CharacterId),
    ])

    if (!meta1) {
        throw new PendingServiceError(
            'UNKNOWN_PLAYER',
            `Character ID ${player1CharacterId} is not a known community member`,
        )
    }

    if (!meta2) {
        throw new PendingServiceError(
            'UNKNOWN_PLAYER',
            `Character ID ${player2CharacterId} is not a known community member`,
        )
    }

    const match: H2HMatch = {
        matchId: pending.match_id,
        date: pending.match_date,
        map: pending.map_name,
        durationSeconds: 0,
        region: pending.region,
        type: '1v1',
        winnerCharacterId,
        player1RatingChange: null,
        player2RatingChange: null,
        player1RatingAtTime: null,
        player2RatingAtTime: null,
        source: 'blizzard',
        isVoided: false,
        matchLabel: null,
    }

    await persistMatch(player1CharacterId, player2CharacterId, match)

    const { error: updateError } = await supabase
        .from('h2h_pending_matches')
        .update({ reviewed_at: new Date().toISOString(), review_outcome: 'confirmed' })
        .eq('id', id)

    if (updateError) {
        logger.error(
            { feature: 'pending-matches', id, err: updateError },
            'Supabase error confirming pending match',
        )
        throw updateError
    }

    logger.info(
        { feature: 'pending-matches', id, player1CharacterId, player2CharacterId, winnerCharacterId },
        'Pending match confirmed and persisted',
    )
}

// ============================================================================
// Reject
// ============================================================================

export async function rejectPendingMatch(id: number): Promise<void> {
    const { data: row, error: fetchError } = await supabase
        .from('h2h_pending_matches')
        .select('id, review_outcome')
        .eq('id', id)
        .maybeSingle()

    if (fetchError) {
        logger.error(
            { feature: 'pending-matches', id, err: fetchError },
            'Supabase error fetching pending match for rejection',
        )
        throw fetchError
    }

    if (!row) {
        throw new PendingServiceError('NOT_FOUND', `Pending match ${id} not found`)
    }

    const { review_outcome } = row as { id: number; review_outcome: string | null }

    if (review_outcome !== null) {
        throw new PendingServiceError(
            'ALREADY_REVIEWED',
            `Pending match ${id} has already been reviewed (${review_outcome})`,
        )
    }

    const { error: updateError } = await supabase
        .from('h2h_pending_matches')
        .update({ reviewed_at: new Date().toISOString(), review_outcome: 'rejected' })
        .eq('id', id)

    if (updateError) {
        logger.error(
            { feature: 'pending-matches', id, err: updateError },
            'Supabase error rejecting pending match',
        )
        throw updateError
    }

    logger.info(
        { feature: 'pending-matches', id },
        'Pending match rejected',
    )
}
