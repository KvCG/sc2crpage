import { describe, it, expect, beforeEach } from 'vitest'
import cache from '../../utils/cache'

describe('cache utility', () => {
    beforeEach(() => {
        cache.clear()
    })

    it('should store and retrieve values', () => {
        cache.set('test-key', 'test-value')
        expect(cache.get('test-key')).toBe('test-value')
    })

    it('should respect TTL', async () => {
        const ttl = 100
        cache.set('ttl-test', 'test-value', { ttl })

        expect(cache.get('ttl-test')).toBe('test-value')
        await new Promise(r => setTimeout(r, ttl + 10))
        expect(cache.get('ttl-test')).toBeUndefined()
    })

    it('should respect max size limit', () => {
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        expect(cache.get('key1')).toBeUndefined()
        expect(cache.get('key2')).toBe('value2')
    })

    it('should handle undefined/null values', () => {
        cache.set('undefined-key', undefined as any)
        cache.set('null-key', null as any)

        expect(cache.get('undefined-key')).toBeUndefined()
        expect(cache.get('null-key')).toBeNull()
    })
})
