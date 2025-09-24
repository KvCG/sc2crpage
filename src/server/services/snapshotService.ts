import { formatData } from '../utils/formatData'
import { snapshotCache } from '../utils/cache'
import { getTop } from './pulseApi'
import { DateTime } from 'luxon'
import logger from '../logging/logger'

const SNAPSHOT_KEY = 'dailySnapshot'

export type SnapshotResponse = {
    data: any[]
    createdAt: string
    expiry: number
}

export async function getDailySnapshot(): Promise<SnapshotResponse> {
    const cached = snapshotCache.get(SNAPSHOT_KEY) as
        | SnapshotResponse
        | undefined
    if (cached) return cached

    logger.info('snapshot cache miss; recomputing daily snapshot')

    // Compute from live data and cache with expiry at CR midnight
    const raw = await getTop()
    const ranked = await formatData(raw, 'ranking')
    // Snapshots should exclude invalid/unranked entries
    const filtered = (ranked ?? []).filter(
        (row: any) =>
            Number.isFinite(row?.ratingLast) &&
            Number.isFinite(row?.leagueTypeLast) &&
            typeof row?.race === 'string'
    )
    const data = filtered.length > 0 ? filtered : (ranked ?? [])
    const nowCR = DateTime.now().setZone('America/Costa_Rica')
    const createdAt = nowCR.toISO() ?? new Date().toISOString()

    // POSITION_INDICATOR_CACHE carries hours (int). Default 24.
    // Expire always at 12:00 AM Costa Rica, advancing by whole-day periods.
    const hoursRaw = process.env.POSITION_INDICATOR_CACHE
    const parsedHours = parseInt(String(hoursRaw), 10)
    let hours: number
    if (Number.isFinite(parsedHours) && parsedHours > 0) {
        hours = parsedHours
    } else {
        hours = 24
    }
    const periods = Math.max(1, Math.ceil(hours / 24)) // number of midnights to skip
    const nextMidnightCR = nowCR.plus({ days: 1 }).startOf('day')
    const expiryDt = nextMidnightCR.plus({ days: periods - 1 })
    const expiryMs = expiryDt.toMillis()

    const snapshot = {
        data,
        createdAt,
        expiry: expiryMs,
    }

    const ttlMsForCache = Math.max(1, expiryMs - Date.now())
    snapshotCache.set(SNAPSHOT_KEY, snapshot, ttlMsForCache)
    logger.info(
        { expiry: expiryMs },
        'snapshot cache set with CR midnight expiry'
    )

    return snapshot
}

export function clearDailySnapshot(): void {
    snapshotCache.clear()
}

// Register background refresh on TTL expiry via LRU dispose hook
snapshotCache.registerOnExpire(async () => {
    logger.info('daily snapshot expired; refreshing in background')
    await getDailySnapshot()
    logger.info('daily snapshot refreshed')
})
