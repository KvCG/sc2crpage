import { LRUCache } from 'lru-cache'

/**
 * Creates an LRU cache instance for in-memory caching.
 * Only one value is ever stored (max: 1).
 * The cache will automatically delete expired entries after 30 seconds (ttl: 30_000 ms).
 */
const cache = new LRUCache<string, any>({
    max: 1,
    ttl: 30_000 // 30 seconds
})

export default cache