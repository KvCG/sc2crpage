import supabase from '../db/supabaseClient'
import { CommunityDataService } from './communityDataService'
import logger from '../logging/logger'
import type { MatchFlagType } from '../../shared/types'

// ============================================================================
// Typed errors
// ============================================================================

export type FlagServiceErrorCode =
    | 'MATCH_NOT_FOUND'
    | 'NOT_A_PARTICIPANT'
    | 'DUPLICATE_PENDING_FLAG'

export class FlagServiceError extends Error {
    readonly code: FlagServiceErrorCode

    constructor(code: FlagServiceErrorCode, message: string) {
        super(message)
        this.name = 'FlagServiceError'
        this.code = code
    }
}

// ============================================================================
// Types
// ============================================================================

/** Minimal row shape returned by findMatchByExternalId */
export interface MatchRow {
    /** Primary key of the h2h_matches row — used as FK in h2h_match_flags */
    id: number
    match_id: string
}

export interface SubmitFlagParams {
    /** External match ID (e.g. Pulse numeric ID as string, or Blizzard synthetic key) */
    matchId: string
    player1CharacterId: number
    player2CharacterId: number
    flagType: MatchFlagType
    /** Player explanation — required for 'void', optional for label flags */
    reason: string | null
    /** Btag of the flagging player, self-reported and validated against community data */
    submittedBy: string
}

export interface SubmitFlagResult {
    flagId: number
    status: 'pending'
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Looks up an h2h_matches row by the external match_id string.
 * Returns the row (including its PK `id`) or null when no match exists.
 */
export async function findMatchByExternalId(matchId: string): Promise<MatchRow | null> {
    const { data, error } = await supabase
        .from('h2h_matches')
        .select('id, match_id')
        .eq('match_id', matchId)
        .maybeSingle()

    if (error) {
        logger.error(
            { feature: 'flags', matchId, err: error },
            'Supabase error looking up match by external id',
        )
        throw error
    }

    return (data as MatchRow | null) ?? null
}

/**
 * Submits a community flag for an h2h match.
 *
 * Business rules enforced before inserting:
 *  1. Match must exist in h2h_matches — throws MATCH_NOT_FOUND otherwise
 *  2. submittedBy btag must correspond to one of the two character IDs
 *     (resolved via communityDataService) — throws NOT_A_PARTICIPANT otherwise
 *  3. No pending flag of the same type may already exist for this match
 *     (enforced by the partial unique index in Postgres) — throws
 *     DUPLICATE_PENDING_FLAG on a 23505 unique violation
 *
 * On success, returns the new flag's id and its initial status "pending".
 */
export async function submitFlag(params: SubmitFlagParams): Promise<SubmitFlagResult> {
    const { matchId, player1CharacterId, player2CharacterId, flagType, reason, submittedBy } =
        params

    // 1. Verify match exists and get its PK
    const matchRow = await findMatchByExternalId(matchId)
    if (!matchRow) {
        throw new FlagServiceError('MATCH_NOT_FOUND', `Match '${matchId}' not found`)
    }

    // 2. Verify submitter's btag is one of the two players in the match
    const communityService = CommunityDataService.getInstance()
    const [player1, player2] = await Promise.all([
        communityService.getCommunityPlayer(player1CharacterId),
        communityService.getCommunityPlayer(player2CharacterId),
    ])

    const normalizedSubmitter = submittedBy.trim()
    const isParticipant =
        player1?.btag === normalizedSubmitter || player2?.btag === normalizedSubmitter

    if (!isParticipant) {
        throw new FlagServiceError(
            'NOT_A_PARTICIPANT',
            `Submitter '${submittedBy}' is not a participant in match '${matchId}'`,
        )
    }

    // 3. Insert flag row — let the partial unique index guard against duplicates
    const { data: insertedRows, error: insertError } = await supabase
        .from('h2h_match_flags')
        .insert({
            match_db_id: matchRow.id,
            flag_type: flagType,
            reason: reason ?? null,
            submitted_by: submittedBy,
            status: 'pending',
        })
        .select('id')

    if (insertError) {
        // Postgres unique violation — a pending flag of this type already exists
        if (insertError.code === '23505') {
            throw new FlagServiceError(
                'DUPLICATE_PENDING_FLAG',
                `A pending '${flagType}' flag already exists for match '${matchId}'`,
            )
        }
        logger.error(
            { feature: 'flags', matchId, flagType, submittedBy, err: insertError },
            'Supabase error inserting flag',
        )
        throw insertError
    }

    const flagId = (insertedRows as Array<{ id: number }> | null)?.[0]?.id
    if (flagId === undefined) {
        throw new Error('h2h_match_flags insert returned no id')
    }

    logger.info({ feature: 'flags', matchId, flagType, submittedBy, flagId }, 'Flag submitted')

    return { flagId, status: 'pending' }
}
