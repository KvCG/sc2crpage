import { CommunityDataService } from './communityDataService'
import { fetchPlayerMatches, type BlizzardProfile, type BlizzardPlayerMatch } from './blizzardMatchClient'
import { resolveBlizzardProfile, persistMatch } from './h2hService'
import type { H2HMatch } from '../../shared/types'
import logger from '../logging/logger'

// ============================================================================
// Constants
// ============================================================================

const POLL_INTERVAL_MS = 5 * 60 * 1000

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
        { feature: 'blizzard-poller', intervalMs: POLL_INTERVAL_MS },
        'Blizzard poller started'
    )

    // Run an immediate cycle, then schedule subsequent ones
    void poll()
    pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS)
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

        // Take first two correlated community players
        const p1 = communityBucket[0]
        const p2 = communityBucket[1]

        // Parse key back into parts: {timestamp}|{map}|{TYPE}
        const pipeIdx = key.indexOf('|')
        const lastPipeIdx = key.lastIndexOf('|')
        const tsStr = key.slice(0, pipeIdx)
        const mapName = key.slice(pipeIdx + 1, lastPipeIdx)
        const matchType = key.slice(lastPipeIdx + 1)

        const winner = communityBucket.find((b) => b.decision.toUpperCase() === 'WIN')

        // Synthetic matchId — 'BZ-' prefix ensures no collision with Pulse integer IDs
        const matchId = `BZ-${tsStr}_${mapName.replace(/\s+/g, '_')}`

        const match: H2HMatch = {
            matchId,
            date: new Date(Number(tsStr) * 1000).toISOString(),
            map: mapName,
            durationSeconds: 0,
            region: p1.region,
            type: matchType,
            winnerCharacterId: winner?.characterId ?? -1,
            player1RatingChange: null,
            player2RatingChange: null,
            player1RatingAtTime: null,
            player2RatingAtTime: null,
            source: 'blizzard',
        }

        await persistMatch(p1.characterId, p2.characterId, match)
        persisted++
    }

    logger.info({ feature: 'blizzard-poller', persisted }, 'Poll cycle complete')
}
