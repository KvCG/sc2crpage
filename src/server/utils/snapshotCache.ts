import { LRUCache } from 'lru-cache'

// 24h TTL snapshot cache, separate from the 30s live cache
const snapshotCache = new LRUCache<string, any>({
    max: 1,
    ttl: 86_400_000, // 24 hours in ms
})

export default {
    get: (key: string) => snapshotCache.get(key),
    set: (key: string, value: any) => snapshotCache.set(key, value),
    clear: () => snapshotCache.clear(),
}
