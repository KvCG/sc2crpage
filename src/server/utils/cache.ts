import { LRUCache } from 'lru-cache'
import logger from '../logging/logger'

/**
 * Creates an LRU cache instance for in-memory caching.
 * Only one value is ever stored (max: 1).
 * The cache will automatically delete expired entries after 30 seconds (ttl: 30_000 ms).
 */
const cache = new LRUCache<string, any>({
    max: 1,
    ttl: 30_000, // 30 seconds
})

export default cache

// Snapshot cache (canonical implementation) with background expiry awareness
type OnExpire = (() => void | Promise<void>) | null
let onSnapshotExpire: OnExpire = null

/**
 * In-memory LRU cache used to store a single snapshot with time-based expiry and
 * an optional auto-refresh behavior.
 *
 * Behavior:
 * - Holds at most one entry.
 * - Default TTL is 24 hours; callers can override TTL per entry when setting values.
 * - When an entry expires due to TTL ("stale"), the cache's disposer logs the event and,
 *   if provided, schedules a snapshot refresh via the `onSnapshotExpire!()` callback.
 *
 * onSnapshotExpire!():
 * - Purpose: Trigger a refresh/rebuild of the expired snapshot and repopulate the cache.
 * - Invocation: Executed asynchronously on the microtask queue (via `Promise.resolve().then(...)`)
 *   to avoid reentrancy into the cache's disposal path and to keep disposal non-blocking.
 * - Error handling: Any errors thrown by the callback are caught and logged as warnings so that
 *   cache eviction remains safe and never propagates exceptions.
 * - Optionality: If no callback is supplied, expiry simply removes the entry without attempting a refresh.
 *
 * Notes:
 * - The disposer only reacts to TTL-based expiry (reason === "stale"); other eviction reasons are ignored.
 * - Ensure the callback is idempotent and resilient, as it may be invoked whenever TTL expiry occurs.
 */
const internalSnapshotCache = new LRUCache<string, any>({
    max: 1,
    ttl: 86_400_000, // default 24h; actual per-entry ttl is provided on set()
    ttlAutopurge: true, // trigger disposal on TTL expiry
    // reason type differs across versions; treating as unknown keeps TS simple
    dispose: (_value: any, key: string, reason: any) => {
        // Only act on TTL expiry events
        if (reason === 'stale') {
            logger.info({ key }, 'snapshot cache expired')
            if (onSnapshotExpire) {
                Promise.resolve()
                    .then(() => onSnapshotExpire!())
                    .catch(err => {
                        logger.warn(
                            { err },
                            'snapshot refresh after expiry failed'
                        )
                    })
            }
        }
    },
})

export const snapshotCache = {
    get: (key: string) => internalSnapshotCache.get(key),
    // Optional per-entry TTL override aligns with computed CR midnight expiration
    set: (key: string, value: any, ttlMs?: number) =>
        ttlMs && ttlMs > 0
            ? internalSnapshotCache.set(key, value, { ttl: ttlMs })
            : internalSnapshotCache.set(key, value),
    clear: () => internalSnapshotCache.clear(),
    registerOnExpire: (fn: OnExpire) => {
        onSnapshotExpire = fn
    },
}
