import type { PendingMatch } from '../../shared/types'

export interface BucketClassification {
    activePlayerCount: number
    winCount: number
    lossCount: number
    observerCount: number
    inferredMode: PendingMatch['inferredMode']
    /** null when the bucket resolves as a normal 1v1 (not staged) */
    reason: PendingMatch['reason'] | null
}

/**
 * Pure classifier for a pending-match bucket.
 *
 * Accepts an array of decision strings (e.g. ['WIN', 'LOSS', 'OBSERVER']) and
 * returns counts, the staging reason, and the inferred game mode.
 *
 * Used by both the Blizzard poller and the verification script so the rule
 * implementation has a single source of truth.
 *
 * Returns `reason: null` for a resolvable 1v1 match (not staged).
 */
export function classifyPendingBucket(decisions: string[]): BucketClassification {
    const active = decisions.filter((d) => d.toUpperCase() !== 'OBSERVER')
    const winCount = active.filter((d) => d.toUpperCase() === 'WIN').length
    const lossCount = active.filter((d) => d.toUpperCase() === 'LOSS').length
    const observerCount = decisions.length - active.length
    const totalActive = active.length

    // ── Determine reason ─────────────────────────────────────────────────────
    let reason: PendingMatch['reason'] | null = null

    if (lossCount !== 1) {
        if (totalActive >= 3) {
            if (winCount >= 2 && lossCount >= 2 && winCount !== lossCount) {
                reason = 'uneven_active_sides'
            } else {
                reason = '3plus_active_after_dedup'
            }
        }
        // totalActive < 3 with lossCount !== 1 → not staged, reason stays null
    } else {
        // lossCount === 1
        if (winCount > 1) {
            reason = 'multi_winner'
        }
        // winCount === 1 → normal 1v1, reason stays null
    }

    // ── Determine inferredMode ───────────────────────────────────────────────
    let inferredMode: PendingMatch['inferredMode']

    if (reason === 'uneven_active_sides') {
        inferredMode = 'uneven'
    } else if (totalActive >= 3 && (winCount === 0 || lossCount === 0)) {
        inferredMode = 'ffa'
    } else if (totalActive === 2) {
        inferredMode = 'unknown'
    } else if (totalActive % 2 === 0) {
        const perSide = totalActive / 2
        if (perSide === 2) inferredMode = '2v2'
        else if (perSide === 3) inferredMode = '3v3'
        else if (perSide === 4) inferredMode = '4v4'
        else inferredMode = 'unknown'
    } else {
        inferredMode = 'unknown'
    }

    return {
        activePlayerCount: totalActive,
        winCount,
        lossCount,
        observerCount,
        inferredMode,
        reason,
    }
}
