import { formatData } from '../utils/formatData'
import snapshotCache from '../utils/snapshotCache'
import { getTop } from './pulseApi'
import { DateTime } from 'luxon'
import { filterRankingForDisplay } from '../utils/rankingFilters'

const SNAPSHOT_KEY = 'dailySnapshot'

export type SnapshotResponse = {
    data: any[]
    createdAt: string
    expiry: number
}

export async function getDailySnapshot(): Promise<SnapshotResponse> {
    const cached = snapshotCache.get(SNAPSHOT_KEY) as SnapshotResponse | undefined
    if (cached) return cached

    // Compute from live data and cache for 24h
    const raw = await getTop()
    const ranked = await formatData(raw, 'ranking')
    const data = filterRankingForDisplay(ranked)
    const nowCR = DateTime.now().setZone('America/Costa_Rica')
    const createdAt = nowCR.toISO() ?? new Date().toISOString()
    const snapshot = {
        data,
        createdAt,
        expiry: nowCR.plus({ hours: 24 }).toMillis(),
    }
    snapshotCache.set(SNAPSHOT_KEY, snapshot)
    return snapshot
}

export function clearDailySnapshot(): void {
    snapshotCache.clear()
}
