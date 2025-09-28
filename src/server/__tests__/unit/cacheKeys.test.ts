import { describe, it, expect, beforeEach } from 'vitest'
import { DateTime } from 'luxon'

import { 
    CacheKeyBuilder, 
    CacheDomain, 
    CacheScope, 
    CacheTTL,
    CacheKeys,
    CacheKeyUtils,
    createCacheEntry
} from '../../utils/cacheKeys'

describe('CacheKeyBuilder', () => {
    describe('basic key building', () => {
        it('builds simple cache key without identifier', () => {
            const builder = new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'ranking',
                scope: CacheScope.LIVE
            })

            expect(builder.build()).toBe('pulse:ranking:live')
        })

        it('builds cache key with identifier', () => {
            const builder = new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'player',
                scope: CacheScope.SEARCH,
                identifier: 'TestPlayer%23123'
            })

            expect(builder.build()).toBe('pulse:player:search:TestPlayer%23123')
        })

        it('allows custom domain and scope strings', () => {
            const builder = new CacheKeyBuilder({
                domain: 'custom',
                entity: 'data',
                scope: 'special',
                identifier: 'test'
            })

            expect(builder.build()).toBe('custom:data:special:test')
        })
    })

    describe('TTL management', () => {
        it('returns custom TTL when provided', () => {
            const builder = new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'test',
                scope: CacheScope.LIVE,
                ttl: 60000
            })

            expect(builder.getTTL()).toBe(60000)
        })

        it('returns scope-based TTL for LIVE scope', () => {
            const builder = new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'test',
                scope: CacheScope.LIVE
            })

            expect(builder.getTTL()).toBe(CacheTTL.LIVE)
        })

        it('returns scope-based TTL for DAILY scope', () => {
            const builder = new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'test',
                scope: CacheScope.DAILY
            })

            expect(builder.getTTL()).toBe(CacheTTL.DAILY)
        })

        it('returns default LIVE TTL for unknown scope', () => {
            const builder = new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'test',
                scope: 'unknown'
            })

            expect(builder.getTTL()).toBe(CacheTTL.LIVE)
        })
    })

    describe('timestamp methods', () => {
        const fixedDate = DateTime.fromISO('2024-09-25T14:30:00', { zone: 'America/Costa_Rica' })

        it('adds timestamp to identifier', () => {
            const builder = new CacheKeyBuilder({
                domain: CacheDomain.ANALYTICS,
                entity: 'activity',
                scope: CacheScope.DAILY
            })

            const timestamped = builder.withTimestamp(fixedDate)
            expect(timestamped.build()).toBe('analytics:activity:daily:2024-09-25')
        })

        it('appends timestamp to existing identifier', () => {
            const builder = new CacheKeyBuilder({
                domain: CacheDomain.ANALYTICS,
                entity: 'activity',
                scope: CacheScope.DAILY,
                identifier: 'summary'
            })

            const timestamped = builder.withTimestamp(fixedDate)
            expect(timestamped.build()).toBe('analytics:activity:daily:summary:2024-09-25')
        })

        it('adds hour to timestamp for hourly keys', () => {
            const builder = new CacheKeyBuilder({
                domain: CacheDomain.ANALYTICS,
                entity: 'metrics',
                scope: CacheScope.HOURLY
            })

            const hourly = builder.withHour(fixedDate)
            expect(hourly.build()).toBe('analytics:metrics:hourly:2024-09-25:14')
        })
    })

    describe('builder modification methods', () => {
        let baseBuilder: CacheKeyBuilder

        beforeEach(() => {
            baseBuilder = new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'ranking',
                scope: CacheScope.LIVE,
                identifier: 'test'
            })
        })

        it('creates new builder with different scope', () => {
            const dailyBuilder = baseBuilder.withScope(CacheScope.DAILY)
            
            expect(baseBuilder.build()).toBe('pulse:ranking:live:test')
            expect(dailyBuilder.build()).toBe('pulse:ranking:daily:test')
        })

        it('creates new builder with different identifier', () => {
            const newBuilder = baseBuilder.withIdentifier('snapshot')
            
            expect(baseBuilder.build()).toBe('pulse:ranking:live:test')
            expect(newBuilder.build()).toBe('pulse:ranking:live:snapshot')
        })

        it('preserves original builder when creating variations', () => {
            const dailyBuilder = baseBuilder.withScope(CacheScope.DAILY)
            const searchBuilder = baseBuilder.withScope(CacheScope.SEARCH)
            
            expect(baseBuilder.build()).toBe('pulse:ranking:live:test')
            expect(dailyBuilder.build()).toBe('pulse:ranking:daily:test')
            expect(searchBuilder.build()).toBe('pulse:ranking:search:test')
        })
    })
})

describe('CacheKeys pre-configured builders', () => {
    describe('pulse keys', () => {
        it('generates ranking key with default live scope', () => {
            const key = CacheKeys.pulse.ranking().build()
            expect(key).toBe('pulse:ranking:live:snapshot')
        })

        it('generates ranking key with custom scope', () => {
            const key = CacheKeys.pulse.ranking(CacheScope.DAILY).build()
            expect(key).toBe('pulse:ranking:daily:snapshot')
        })

        it('generates search key with encoded term', () => {
            const key = CacheKeys.pulse.search('TestPlayer#123').build()
            expect(key).toBe('pulse:player:search:TestPlayer%23123')
        })

        it('generates player stats key with batch info', () => {
            const playerIds = ['player1', 'player2', 'player3']
            const key = CacheKeys.pulse.playerStats(playerIds).build()
            expect(key).toBe('pulse:stats:live:batch-3-player1')
        })

        it('generates season key', () => {
            const key = CacheKeys.pulse.season().build()
            expect(key).toBe('pulse:season:hourly:current')
        })
    })

    describe('analytics keys', () => {
        it('generates player activity key', () => {
            const key = CacheKeys.analytics.playerActivity().build()
            expect(key).toBe('analytics:player:daily:activity')
        })

        it('generates ranking insights key', () => {
            const key = CacheKeys.analytics.rankingInsights().build()
            expect(key).toBe('analytics:ranking:hourly:insights')
        })

        it('generates meta statistics key', () => {
            const key = CacheKeys.analytics.metaStatistics().build()
            expect(key).toBe('analytics:meta:daily:statistics')
        })
    })

    describe('snapshot keys', () => {
        it('generates daily snapshot key', () => {
            const key = CacheKeys.snapshot.daily().build()
            expect(key).toBe('snapshot:ranking:daily:baseline')
        })

        it('generates position changes key', () => {
            const key = CacheKeys.snapshot.position().build()
            expect(key).toBe('snapshot:position:daily:changes')
        })
    })
})

describe('CacheKeyUtils', () => {
    describe('validation', () => {
        it('validates correctly formatted keys', () => {
            expect(CacheKeyUtils.isValidKey('domain:entity:scope')).toBe(true)
            expect(CacheKeyUtils.isValidKey('domain:entity:scope:identifier')).toBe(true)
        })

        it('rejects invalid key formats', () => {
            expect(CacheKeyUtils.isValidKey('')).toBe(false)
            expect(CacheKeyUtils.isValidKey('domain')).toBe(false)
            expect(CacheKeyUtils.isValidKey('domain:entity')).toBe(false)
            expect(CacheKeyUtils.isValidKey('domain::scope')).toBe(false)
            expect(CacheKeyUtils.isValidKey('domain:entity:scope:id:extra')).toBe(false)
        })
    })

    describe('parsing', () => {
        it('parses valid key without identifier', () => {
            const parsed = CacheKeyUtils.parseKey('pulse:ranking:live')
            expect(parsed).toEqual({
                domain: 'pulse',
                entity: 'ranking',
                scope: 'live',
                identifier: undefined
            })
        })

        it('parses valid key with identifier', () => {
            const parsed = CacheKeyUtils.parseKey('analytics:player:daily:activity')
            expect(parsed).toEqual({
                domain: 'analytics',
                entity: 'player',
                scope: 'daily',
                identifier: 'activity'
            })
        })

        it('returns null for invalid keys', () => {
            expect(CacheKeyUtils.parseKey('invalid')).toBeNull()
            expect(CacheKeyUtils.parseKey('domain::scope')).toBeNull()
        })
    })

    describe('domain checking', () => {
        it('identifies domain keys correctly', () => {
            expect(CacheKeyUtils.isDomainKey('pulse:ranking:live', CacheDomain.PULSE)).toBe(true)
            expect(CacheKeyUtils.isDomainKey('analytics:player:daily', CacheDomain.ANALYTICS)).toBe(true)
            expect(CacheKeyUtils.isDomainKey('pulse:ranking:live', CacheDomain.ANALYTICS)).toBe(false)
        })

        it('works with string domain names', () => {
            expect(CacheKeyUtils.isDomainKey('custom:data:scope', 'custom')).toBe(true)
            expect(CacheKeyUtils.isDomainKey('custom:data:scope', 'other')).toBe(false)
        })
    })

    describe('domain prefix generation', () => {
        it('generates correct domain prefix', () => {
            expect(CacheKeyUtils.getDomainPrefix(CacheDomain.PULSE)).toBe('pulse:')
            expect(CacheKeyUtils.getDomainPrefix('custom')).toBe('custom:')
        })
    })

    describe('temporal key creation', () => {
        it('creates temporal keys with automatic timestamps', () => {
            // Note: This test is time-dependent, but we're just checking format
            const key = CacheKeyUtils.createTemporalKey(
                CacheDomain.ANALYTICS,
                'activity',
                CacheScope.DAILY
            )
            expect(key).toMatch(/^analytics:activity:daily:\d{4}-\d{2}-\d{2}$/)
        })

        it('creates hourly temporal keys', () => {
            const key = CacheKeyUtils.createTemporalKey(
                CacheDomain.ANALYTICS,
                'metrics',
                CacheScope.HOURLY
            )
            expect(key).toMatch(/^analytics:metrics:hourly:\d{4}-\d{2}-\d{2}:\d{2}$/)
        })

        it('creates non-temporal keys for live scope', () => {
            const key = CacheKeyUtils.createTemporalKey(
                CacheDomain.PULSE,
                'ranking',
                CacheScope.LIVE
            )
            expect(key).toBe('pulse:ranking:live')
        })
    })
})

describe('createCacheEntry', () => {
    it('creates cache entry with metadata', () => {
        const builder = new CacheKeyBuilder({
            domain: CacheDomain.PULSE,
            entity: 'ranking',
            scope: CacheScope.LIVE,
            identifier: 'snapshot'
        })

        const testData = { players: 100 }
        const entry = createCacheEntry(builder, testData)

        expect(entry.key).toBe('pulse:ranking:live:snapshot')
        expect(entry.value).toEqual(testData)
        expect(entry.ttl).toBe(CacheTTL.LIVE)
        expect(entry.domain).toBe('pulse')
        expect(entry.entity).toBe('ranking')
        expect(entry.scope).toBe('live')
        expect(entry.createdAt).toBeGreaterThan(0)
        expect(entry.expiresAt).toBe(entry.createdAt + entry.ttl)
    })

    it('uses custom TTL when provided', () => {
        const builder = new CacheKeyBuilder({
            domain: CacheDomain.PULSE,
            entity: 'test',
            scope: CacheScope.LIVE
        })

        const customTTL = 60000
        const entry = createCacheEntry(builder, {}, customTTL)

        expect(entry.ttl).toBe(customTTL)
        expect(entry.expiresAt).toBe(entry.createdAt + customTTL)
    })

    it('throws error for invalid cache keys', () => {
        const builder = {
            build: () => 'invalid',
            getTTL: () => 30000
        } as any

        expect(() => createCacheEntry(builder, {})).toThrow('Invalid cache key format: invalid')
    })
})