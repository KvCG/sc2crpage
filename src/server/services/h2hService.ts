import { get as httpGet, endpoints } from './pulseHttpClient'
import { DriveFileStorage } from './driveFileStorage'
import logger from '../logging/logger'
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
// Drive persistence
// ============================================================================

function pairKey(id1: number, id2: number): string {
    return `${Math.min(id1, id2)}-${Math.max(id1, id2)}.json`
}

export async function loadPairRecord(id1: number, id2: number): Promise<H2HPairRecord | null> {
    return DriveFileStorage.readH2HJsonFile<H2HPairRecord>(pairKey(id1, id2))
}

export async function savePairRecord(record: H2HPairRecord): Promise<void> {
    const key = pairKey(record.player1CharacterId, record.player2CharacterId)
    await DriveFileStorage.writeH2HJsonFile(key, record)
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
    for (const entry of raw.matches.result) {
        if (!existingIds.has(entry.match.id)) {
            stored.matches.push(buildMatch(entry, player1CharacterId, player2CharacterId))
            existingIds.add(entry.match.id)
        }
    }

    stored.pulseSyncedAt = new Date().toISOString()
    stored.nextCursor = raw.matches.navigation.before

    await savePairRecord(stored)
    logger.info(
        { feature: 'h2h', player1CharacterId, player2CharacterId, total: stored.matches.length },
        'Pair synced'
    )
    return stored
}
