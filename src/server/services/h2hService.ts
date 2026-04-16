import { get as httpGet, endpoints } from './pulseHttpClient'
import logger from '../logging/logger'
import supabase from '../db/supabaseClient'
import type { H2HMatch, H2HPairRecord } from '../../shared/types'
import { type BlizzardProfile, regionToId } from './blizzardMatchClient'

// ============================================================================
// Types
// ============================================================================

interface CharacterTeamEntry {
    legacyUid: string
    league: {
        queueType: number
        teamType: number
    }
    members: Array<{
        character?: {
            battlenetId: number
            realm: number
            region: string
        }
    }>
}

interface PulseMatchParticipant {
    participant: {
        playerCharacterId: number
        teamId: number
        decision: 'WIN' | 'LOSS' | 'TIE'
        ratingChange: number | null
    }
    teamState: {
        teamState: {
            rating: number
        }
    } | null
}

interface PulseMatchEntry {
    match: {
        id: number
        date: string
        type: string
        mapId: number
        region: string
        duration: number
    }
    map: {
        id: number
        name: string
    }
    participants: PulseMatchParticipant[]
}

interface VersusCommonResponse {
    matches: {
        result: PulseMatchEntry[]
        navigation: {
            before: string | null
            after: string | null
        }
    }
}

interface VersusMatchesPage {
    result: PulseMatchEntry[]
    navigation: {
        before: string | null
        after: string | null
    }
}

// ============================================================================
// Error
// ============================================================================

export class H2HResolutionError extends Error {
    readonly characterId: number

    constructor(characterId: number) {
        super(`No 1v1 team found for characterId ${characterId}`)
        this.name = 'H2HResolutionError'
        this.characterId = characterId
    }
}

// ============================================================================
// Cache
// ============================================================================

/** Module-level cache. UIDs are stable within a season; cleared on server restart. */
const legacyUidCache = new Map<number, string>()

/** Module-level cache for Blizzard API profile coordinates, populated alongside legacyUidCache. */
const blizzardProfileCache = new Map<number, BlizzardProfile>()

/** Exposed for testing only — do not call in production code. */
export function _clearLegacyUidCache(): void {
    legacyUidCache.clear()
}

/** Exposed for testing only — do not call in production code. */
export function _clearBlizzardProfileCache(): void {
    blizzardProfileCache.clear()
}

// ============================================================================
// Service
// ============================================================================

/**
 * Resolves the SC2Pulse `legacyUid` for a player's 1v1 ladder team.
 *
 * @param characterId - The player's characterId from the community CSV
 * @returns The `legacyUid` string required by SC2Pulse H2H endpoints
 * @throws {H2HResolutionError} When the player has no ranked 1v1 team
 */
export async function resolveTeamLegacyUid(characterId: number): Promise<string> {
    const cached = legacyUidCache.get(characterId)
    if (cached !== undefined) {
        return cached
    }

    const teams = await httpGet<CharacterTeamEntry[]>(endpoints.characterTeams, { characterId })

    const team = teams.find((t) => t.league.queueType === 201 && t.league.teamType === 0)

    if (!team) {
        logger.warn({ feature: 'h2h', characterId }, 'No 1v1 team found for characterId')
        throw new H2HResolutionError(characterId)
    }

    legacyUidCache.set(characterId, team.legacyUid)

    // Opportunistically cache Blizzard profile coordinates from same response
    const anyTeamMember = teams[0]?.members?.[0]
    if (anyTeamMember?.character && !blizzardProfileCache.has(characterId)) {
        blizzardProfileCache.set(characterId, {
            profileId: anyTeamMember.character.battlenetId,
            realmId: anyTeamMember.character.realm,
            regionId: regionToId(anyTeamMember.character.region),
            region: anyTeamMember.character.region,
        })
    }

    return team.legacyUid
}

/**
 * Resolves the Blizzard API profile coordinates for a player.
 * Hits the Pulse `character-teams` endpoint only when not already cached.
 * The cache is pre-populated whenever `resolveTeamLegacyUid` is called.
 *
 * @throws {Error} When Pulse returns no teams or the response has no character data
 */
export async function resolveBlizzardProfile(characterId: number): Promise<BlizzardProfile> {
    const cached = blizzardProfileCache.get(characterId)
    if (cached) return cached

    const teams = await httpGet<CharacterTeamEntry[]>(endpoints.characterTeams, { characterId })

    const anyTeamMember = teams[0]?.members?.[0]
    if (!anyTeamMember?.character) {
        throw new Error(`No character data returned by Pulse for characterId ${characterId}`)
    }

    // Also warm the legacyUid cache if there's a 1v1 team and it's not there yet
    if (!legacyUidCache.has(characterId)) {
        const team1v1 = teams.find((t) => t.league.queueType === 201 && t.league.teamType === 0)
        if (team1v1) legacyUidCache.set(characterId, team1v1.legacyUid)
    }

    const profile: BlizzardProfile = {
        profileId: anyTeamMember.character.battlenetId,
        realmId: anyTeamMember.character.realm,
        regionId: regionToId(anyTeamMember.character.region),
        region: anyTeamMember.character.region,
    }
    blizzardProfileCache.set(characterId, profile)
    return profile
}

// ============================================================================
// Pair record
// ============================================================================

export async function loadPairRecord(id1: number, id2: number): Promise<H2HPairRecord | null> {
    const player1CharacterId = Math.min(id1, id2)
    const player2CharacterId = Math.max(id1, id2)

    try {
        const { data: pairRow, error: pairError } = await supabase
            .from('h2h_pairs')
            .select('id, player1_character_id, player2_character_id, pulse_synced_at, next_cursor')
            .eq('player1_character_id', player1CharacterId)
            .eq('player2_character_id', player2CharacterId)
            .maybeSingle()

        if (pairError) throw pairError

        if (!pairRow) {
            // Pair not yet in Supabase — return null so the route triggers a fresh sync
            return null
        }

        const { data: matchRows, error: matchError } = await supabase
            .from('h2h_matches')
            .select(
                'match_id, match_date, map_name, duration_seconds, region, match_type, ' +
                    'winner_character_id, player1_rating_change, player2_rating_change, ' +
                    'player1_rating, player2_rating, source, added_by',
            )
            .eq('pair_id', pairRow.id)

        if (matchError) throw matchError

        interface H2HMatchRow {
            match_id: string
            match_date: string
            map_name: string
            duration_seconds: number
            region: string
            match_type: string
            winner_character_id: number
            player1_rating_change: number | null
            player2_rating_change: number | null
            player1_rating: number | null
            player2_rating: number | null
            source: H2HMatch['source']
            added_by: string | null
            is_voided: boolean
            match_label: 'showmatch' | 'tournament' | null
        }

        const matches: H2HMatch[] = ((matchRows ?? []) as unknown as H2HMatchRow[]).map((row) => ({
                matchId: row.match_id,
                date: row.match_date,
                map: row.map_name,
                durationSeconds: row.duration_seconds,
                region: row.region,
                type: row.match_type,
                winnerCharacterId: row.winner_character_id,
                player1RatingChange: row.player1_rating_change,
                player2RatingChange: row.player2_rating_change,
                player1RatingAtTime: row.player1_rating,
                player2RatingAtTime: row.player2_rating,
                source: row.source,
                ...(row.added_by !== null && { addedBy: row.added_by }),
                isVoided: row.is_voided,
                matchLabel: row.match_label,
            }),
        )

        return {
            player1CharacterId: pairRow.player1_character_id,
            player2CharacterId: pairRow.player2_character_id,
            pulseSyncedAt: pairRow.pulse_synced_at ?? '',
            nextCursor: pairRow.next_cursor,
            matches,
        }
    } catch (err) {
        logger.error(
            { feature: 'h2h', player1CharacterId, player2CharacterId, err },
            'Supabase read failed for h2h pair',
        )
        return null
    }
}

export async function savePairRecord(record: H2HPairRecord): Promise<void> {
    try {
        const { error } = await supabase
            .from('h2h_pairs')
            .upsert(
                {
                    player1_character_id: record.player1CharacterId,
                    player2_character_id: record.player2CharacterId,
                    pulse_synced_at: record.pulseSyncedAt || null,
                    next_cursor: record.nextCursor,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'player1_character_id,player2_character_id' },
            )
        if (error) throw error
    } catch (err) {
        logger.error(
            {
                feature: 'h2h',
                player1CharacterId: record.player1CharacterId,
                player2CharacterId: record.player2CharacterId,
                err,
            },
            'Supabase upsert failed for h2h_pairs',
        )
    }
}

/**
 * Idempotently persists a single H2H match into the pair file.
 * Deduplicates by `match.matchId` — safe for both numeric Pulse IDs and
 * string Blizzard synthetic keys (`BZ-{timestamp}_{map}`).
 */
export async function persistMatch(charId1: number, charId2: number, match: H2HMatch): Promise<void> {
    const player1CharacterId = Math.min(charId1, charId2)
    const player2CharacterId = Math.max(charId1, charId2)

    const existing = await loadPairRecord(player1CharacterId, player2CharacterId)
    const stored = existing ?? {
        player1CharacterId,
        player2CharacterId,
        pulseSyncedAt: '',
        nextCursor: null,
        matches: [],
    }

    if (stored.matches.some((m) => m.matchId === match.matchId)) {
        return
    }

    stored.matches.push(match)
    await savePairRecord(stored)

    try {
        const { data: pairRows, error: pairError } = await supabase
            .from('h2h_pairs')
            .upsert(
                {
                    player1_character_id: player1CharacterId,
                    player2_character_id: player2CharacterId,
                    pulse_synced_at: stored.pulseSyncedAt || null,
                    next_cursor: stored.nextCursor,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'player1_character_id,player2_character_id' },
            )
            .select('id')
        if (pairError) throw pairError

        const pairId = pairRows?.[0]?.id
        if (pairId === undefined) throw new Error('h2h_pairs upsert returned no id')

        const { error: matchError } = await supabase
            .from('h2h_matches')
            .upsert(
                {
                    pair_id: pairId,
                    match_id: String(match.matchId),
                    match_date: match.date,
                    map_name: match.map,
                    duration_seconds: match.durationSeconds,
                    region: match.region,
                    match_type: match.type,
                    winner_character_id: match.winnerCharacterId,
                    player1_rating_change: match.player1RatingChange,
                    player2_rating_change: match.player2RatingChange,
                    player1_rating: match.player1RatingAtTime,
                    player2_rating: match.player2RatingAtTime,
                    source: match.source,
                    added_by: match.addedBy ?? null,
                },
                { onConflict: 'pair_id,match_id' },
            )
        if (matchError) throw matchError
    } catch (err) {
        logger.error(
            { feature: 'h2h', player1CharacterId, player2CharacterId, matchId: match.matchId, err },
            'Supabase upsert failed for h2h_matches',
        )
    }
}

// ============================================================================
// Pulse fetch
// ============================================================================

export async function fetchPair(
    legacyUid1: string,
    legacyUid2: string
): Promise<VersusCommonResponse> {
    return httpGet<VersusCommonResponse>(endpoints.versusCommon, {
        team1: legacyUid1,
        team2: legacyUid2,
    })
}

// ============================================================================
// Sync
// ============================================================================

function buildMatch(
    entry: PulseMatchEntry,
    player1CharacterId: number,
    player2CharacterId: number
): H2HMatch {
    const winner = entry.participants.find((p) => p.participant.decision === 'WIN')
    const p1Part = entry.participants.find(
        (p) => p.participant.playerCharacterId === player1CharacterId
    )
    const p2Part = entry.participants.find(
        (p) => p.participant.playerCharacterId === player2CharacterId
    )

    return {
        matchId: entry.match.id,
        date: entry.match.date,
        map: entry.map.name,
        durationSeconds: entry.match.duration,
        region: entry.match.region,
        type: entry.match.type,
        winnerCharacterId: winner?.participant.playerCharacterId ?? -1,
        player1RatingChange: p1Part?.participant.ratingChange ?? null,
        player2RatingChange: p2Part?.participant.ratingChange ?? null,
        player1RatingAtTime: p1Part?.teamState?.teamState.rating ?? null,
        player2RatingAtTime: p2Part?.teamState?.teamState.rating ?? null,
        source: 'pulse',
        isVoided: false,
        matchLabel: null,
    }
}

export async function syncPair(charId1: number, charId2: number): Promise<H2HPairRecord> {
    const player1CharacterId = Math.min(charId1, charId2)
    const player2CharacterId = Math.max(charId1, charId2)

    const [uid1, uid2] = await Promise.all([
        resolveTeamLegacyUid(charId1),
        resolveTeamLegacyUid(charId2),
    ])

    const raw = await fetchPair(uid1, uid2)

    const existing = await loadPairRecord(player1CharacterId, player2CharacterId)
    const stored = existing ?? {
        player1CharacterId,
        player2CharacterId,
        pulseSyncedAt: '',
        nextCursor: null,
        matches: [],
    }

    const existingIds = new Set(stored.matches.map((m) => m.matchId))

    // Merge first page
    for (const entry of raw.matches.result) {
        if (!existingIds.has(entry.match.id)) {
            stored.matches.push(buildMatch(entry, player1CharacterId, player2CharacterId))
            existingIds.add(entry.match.id)
        }
    }

    // Store cursor from first page — position marker for future incremental syncs
    stored.nextCursor = raw.matches.navigation.before

    // Paginate backwards through remaining history pages
    let cursor = raw.matches.navigation.before
    while (cursor !== null) {
        const page = await httpGet<VersusMatchesPage>(endpoints.versusMatches, {
            team1: uid1,
            team2: uid2,
            before: cursor,
        })
        for (const entry of page.result) {
            if (!existingIds.has(entry.match.id)) {
                stored.matches.push(buildMatch(entry, player1CharacterId, player2CharacterId))
                existingIds.add(entry.match.id)
            }
        }
        cursor = page.navigation.before
    }

    stored.pulseSyncedAt = new Date().toISOString()

    await savePairRecord(stored)
    logger.info(
        { feature: 'h2h', player1CharacterId, player2CharacterId, total: stored.matches.length },
        'Pair synced'
    )
    return stored
}
