import { syncPair } from './h2hService'
import { CommunityDataService } from './communityDataService'
import logger from '../logging/logger'
import { DateTime } from 'luxon'

// ============================================================================
// Constants
// ============================================================================

/** Delay between pair syncs — respects Pulse default 5 RPS budget. */
const DELAY_BETWEEN_PAIRS_MS = 200

/** Daily run target: 03:00 America/Costa_Rica */
const SYNC_HOUR_CR = 3
const CR_TIMEZONE = 'America/Costa_Rica'

// ============================================================================
// Helpers
// ============================================================================

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Returns milliseconds until the next occurrence of 03:00 America/Costa_Rica.
 * If that time has already passed today in CR, targets tomorrow.
 */
function msUntilNextRun(): number {
    const now = DateTime.now().setZone(CR_TIMEZONE)
    let next = now.set({ hour: SYNC_HOUR_CR, minute: 0, second: 0, millisecond: 0 })
    if (next <= now) {
        next = next.plus({ days: 1 })
    }
    return next.toMillis() - now.toMillis()
}

// ============================================================================
// Core sync
// ============================================================================

/**
 * Syncs all unique community player pairs sequentially.
 *
 * Generates n*(n-1)/2 pairs from the full community player list, calls
 * `syncPair` for each with a small inter-request delay, and continues past
 * individual failures so one bad pair cannot abort the entire run.
 */
export async function runFullSync(): Promise<void> {
    const communityData = await CommunityDataService.getInstance().getCommunityData()
    const players = communityData.players
    const totalPairs = (players.length * (players.length - 1)) / 2

    logger.info({ feature: 'h2h', totalPairs }, 'H2H full sync started')

    let failures = 0

    for (let outerIndex = 0; outerIndex < players.length; outerIndex++) {
        for (let innerIndex = outerIndex + 1; innerIndex < players.length; innerIndex++) {
            const charId1 = Number(players[outerIndex].id)
            const charId2 = Number(players[innerIndex].id)

            try {
                await syncPair(charId1, charId2)
            } catch (err) {
                failures++
                logger.error(
                    { feature: 'h2h', charId1, charId2, err },
                    'Pair sync failed — skipping and continuing'
                )
            }

            await delay(DELAY_BETWEEN_PAIRS_MS)
        }
    }

    logger.info({ feature: 'h2h', totalPairs, failures }, 'H2H full sync complete')
}

// ============================================================================
// Scheduler
// ============================================================================

/**
 * Schedules `runFullSync` to run daily at 03:00 UTC-6 (09:00 UTC).
 *
 * Uses a recursive setTimeout so each run reschedules the next one,
 * correctly targeting the absolute clock time rather than a fixed interval.
 * Call once from `server.ts` after community data is loaded.
 */
export function startH2HScheduler(): void {
    const scheduleNextRun = (): void => {
        const msUntilRun = msUntilNextRun()
        logger.info({ feature: 'h2h', msUntilRun }, 'H2H scheduler: next full sync scheduled')

        setTimeout(() => {
            runFullSync()
                .catch((err) => {
                    logger.error({ feature: 'h2h', err }, 'H2H full sync threw unexpectedly')
                })
                .finally(() => {
                    scheduleNextRun()
                })
        }, msUntilRun)
    }

    scheduleNextRun()
}
