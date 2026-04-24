import { CommunityDataService } from './communityDataService'
import { fetchPlayerMatches, type BlizzardProfile, type BlizzardPlayerMatch } from './blizzardMatchClient'
import { resolveBlizzardProfile, persistMatch } from './h2hService'
import { classifyPendingBucket } from './pendingMatchClassifier'
import type { H2HMatch, PendingMatch } from '../../shared/types'
import logger from '../logging/logger'
import supabase from '../db/supabaseClient'

// ============================================================================
// Constants
// ============================================================================

const pollIntervalMs = Number(process.env.POLL_INTERVAL_MIN ?? 20) * 60 * 1000

// ============================================================================
// State
// ============================================================================

let pollTimer: ReturnType<typeof setInterval> | null = null

// ============================================================================
// Public API
// ============================================================================

/**
 * Starts the Blizzard custom-match poller.
 * No-ops when `BLIZZARD_POLLING_ENABLED` is not `'true'` or when already running.
 */
export function start(): void {
    const enabled =
        String(process.env.BLIZZARD_POLLING_ENABLED ?? 'false').toLowerCase() === 'true'

    if (!enabled) {
        logger.info(
            { feature: 'blizzard-poller' },
            'Blizzard poller disabled (BLIZZARD_POLLING_ENABLED is not true)'
        )
        return
    }

    if (pollTimer) return // already running

    logger.info(
        { feature: 'blizzard-poller', intervalMs: pollIntervalMs },
        'Blizzard poller started'
    )

    // Run an immediate cycle, then schedule subsequent ones
    void poll()
    pollTimer = setInterval(() => void poll(), pollIntervalMs)
}

/**
 * Stops the poller and clears the interval. Safe to call when not running.
 */
export function stop(): void {
    if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
        logger.info({ feature: 'blizzard-poller' }, 'Blizzard poller stopped')
    }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Stages an ambiguous match bucket for admin review in `h2h_pending_matches`.
 * Skips if a confirmed row already exists for the same matchId.
 * Safe to call on repeated poll cycles — upserts on the UNIQUE match_id constraint.
 */
async function stagePendingMatch(
    key: string,
    bucket: Array<{ characterId: number; decision: string; region: string }>,
    reason: PendingMatch['reason']
): Promise<void> {
    const pipeIdx = key.indexOf('|')
    const lastPipeIdx = key.lastIndexOf('|')
    const tsStr = key.slice(0, pipeIdx)
    const mapName = key.slice(pipeIdx + 1, lastPipeIdx)
    const matchId = `BZ-${tsStr}_${mapName.replace(/\s+/g, '_')}`
    const matchDate = new Date(Number(tsStr) * 1000).toISOString()
    const region = bucket[0]?.region ?? 'US'

    const { winCount, lossCount, observerCount, activePlayerCount: totalActive, inferredMode } =
        classifyPendingBucket(bucket.map((b) => b.decision))

    // Skip if already confirmed
    const { data: existing } = await supabase
        .from('h2h_pending_matches')
        .select('match_id, review_outcome')
        .eq('match_id', matchId)
        .maybeSingle()

    if (existing?.review_outcome === 'confirmed') {
        logger.debug(
            { feature: 'blizzard-poller', matchId },
            'stagePendingMatch — skipping confirmed row'
        )
        return
    }

    await supabase.from('h2h_pending_matches').upsert(
        {
            match_id: matchId,
            match_date: matchDate,
            map_name: mapName,
            region,
            candidate_ids: bucket.map((b) => b.characterId),
            raw_decisions: bucket.map((b) => ({ characterId: b.characterId, decision: b.decision })),
            reason,
            active_player_count: totalActive,
            win_count: winCount,
            loss_count: lossCount,
            observer_count: observerCount,
            inferred_mode: inferredMode,
        },
        { onConflict: 'match_id' }
    )

    logger.debug(
        { feature: 'blizzard-poller', matchId, reason, inferredMode },
        'stagePendingMatch — upserted pending match'
    )
}

// ============================================================================
// Poll cycle
// ============================================================================

interface PlayerEntry {
    characterId: number
    region: string
    matches: BlizzardPlayerMatch[]
}

/**
 * Single poll cycle:
 * 1. Fetch Blizzard match history for every community player whose profile can be resolved.
 * 2. Build a (timestamp × map × type) index to find matches shared by 2+ community players.
 * 3. Persist new H2H matches via `persistMatch` (idempotent — safe to re-run).
 *
 * Exported for direct invocation in tests.
 */
export async function poll(): Promise<void> {
    logger.info({ feature: 'blizzard-poller' }, 'Poll cycle start')

    const service = CommunityDataService.getInstance()
    const data = await service.getCommunityData()

    // ── Step 1: collect match histories ──────────────────────────────────────
    const playerEntries: PlayerEntry[] = []

    for (const player of data.players) {
        const characterId = Number(player.id)
        if (!Number.isFinite(characterId)) continue

        let profile: BlizzardProfile
        try {
            profile = await resolveBlizzardProfile(characterId)
        } catch {
            logger.warn(
                { feature: 'blizzard-poller', characterId },
                'Could not resolve Blizzard profile; skipping player'
            )
            continue
        }

        const matches = await fetchPlayerMatches(profile)
        playerEntries.push({ characterId, region: profile.region, matches })
        logger.info(
            { feature: 'blizzard-poller', characterId, profileId: profile.profileId, matchCount: matches.length },
            'Fetched match history'
        )
    }

    logger.info(
        { feature: 'blizzard-poller', resolvedPlayers: playerEntries.length },
        'Step 1 complete'
    )

    // ── Step 2: index by timestamp|map|type ──────────────────────────────────
    // Using '|' as separator because it cannot appear in map names or match types.
    interface Bucket {
        characterId: number
        decision: string
        region: string
    }

    const index = new Map<string, Bucket[]>()

    for (const { characterId, region, matches } of playerEntries) {
        for (const m of matches) {
            const key = `${m.date}|${m.map}|${m.type.toUpperCase()}`
            if (!index.has(key)) index.set(key, [])
            index.get(key)!.push({ characterId, decision: m.decision, region })
        }
    }

    // ── Step 3: correlate and persist ─────────────────────────────────────────
    let persisted = 0
    const customBuckets = [...index.entries()].filter(([k]) => k.includes('|CUSTOM'))
    logger.info(
        { feature: 'blizzard-poller', totalKeys: index.size, customKeys: customBuckets.length },
        'Step 2 complete'
    )
    const sharedCustom = customBuckets.filter(([, b]) => b.length >= 2)
    logger.info(
        { feature: 'blizzard-poller', sharedCustomMatches: sharedCustom.length },
        'Shared CUSTOM buckets (2+ players same timestamp+map)'
    )

    for (const [key, bucket] of index.entries()) {
        if (!key.endsWith('|CUSTOM')) continue

        // Filter to community players only (guards against non-community players
        // appearing in the same match if a player's history overlaps)
        const communityBucket = bucket.filter((b) =>
            data.playerIds.has(String(b.characterId))
        )
        if (communityBucket.length < 2) continue

        // Guard 4 — classify bucket; stage non-1v1 matches, persist clean 1v1s.
        const { reason, lossCount } = classifyPendingBucket(
            communityBucket.map((b) => b.decision)
        )

        if (reason !== null) {
            await stagePendingMatch(key, communityBucket, reason)
            continue
        }

        if (lossCount !== 1) {
            // Not stageable: < 3 active and lossCount is not 1 (e.g. LOSS+LEFT)
            logger.debug(
                { feature: 'blizzard-poller', key, lossCount },
                'Skipping CUSTOM bucket — LOSS count is not 1'
            )
            continue
        }

        // lossCount === 1, winCount === 1 → resolvable 1v1
        const activeBucket = communityBucket.filter((b) => b.decision.toUpperCase() !== 'OBSERVER')
        const winEntries = activeBucket.filter((b) => b.decision.toUpperCase() === 'WIN')

        // p2 is the loser, p1 is the winner
        const p2 = activeBucket.find((b) => b.decision.toUpperCase() === 'LOSS')!
        const p1 = winEntries[0]
        if (!p1) continue // safety: no WIN entry (e.g. Loss+Left)

        // Parse key back into parts: {timestamp}|{map}|{TYPE}
        const pipeIdx = key.indexOf('|')
        const lastPipeIdx = key.lastIndexOf('|')
        const tsStr = key.slice(0, pipeIdx)
        const mapName = key.slice(pipeIdx + 1, lastPipeIdx)
        const matchType = key.slice(lastPipeIdx + 1)

        // Synthetic matchId — 'BZ-' prefix ensures no collision with Pulse integer IDs
        const matchId = `BZ-${tsStr}_${mapName.replace(/\s+/g, '_')}`

        // Guard 6 — cross-pair matchId dedup: skip if this matchId is already stored for any pair
        const { data: existing } = await supabase
            .from('h2h_matches')
            .select('id, pair_id')
            .eq('match_id', matchId)
            .maybeSingle()

        if (existing) {
            logger.debug(
                { feature: 'blizzard-poller', matchId, existingPairId: existing.pair_id },
                'Skipping match — matchId already stored for another pair'
            )
            continue
        }

        const match: H2HMatch = {
            matchId,
            date: new Date(Number(tsStr) * 1000).toISOString(),
            map: mapName,
            durationSeconds: 0,
            region: p1.region,
            type: matchType,
            winnerCharacterId: p1.characterId,
            player1RatingChange: null,
            player2RatingChange: null,
            player1RatingAtTime: null,
            player2RatingAtTime: null,
            source: 'blizzard',
            isVoided: false,
            matchLabel: null,
        }

        await persistMatch(p1.characterId, p2.characterId, match)
        persisted++
    }

    logger.info({ feature: 'blizzard-poller', persisted }, 'Poll cycle complete')
}
