/**
 * Centralized cache key management for SC2CR services
 * 
 * Provides standardized cache key patterns and TTL management for:
 * - Hierarchical organization: domain:entity:scope:identifier
 * - Consistent TTL alignment across different data types
 * - Type-safe key generation and validation
 * - Namespace isolation for different feature areas
 * 
 * Key Pattern: {domain}:{entity}:{scope}:{identifier}
 * Examples:
 *   pulse:ranking:live:snapshot
 *   pulse:player:search:TestPlayer%23123
 *   analytics:activity:daily:2024-09-25
 */

import { DateTime } from 'luxon'

// Cache domains for organizing different feature areas
export enum CacheDomain {
    PULSE = 'pulse',
    ANALYTICS = 'analytics', 
    SNAPSHOT = 'snapshot',
    RANKING = 'ranking',
    PLAYER = 'player',
}

// Cache scopes for temporal organization
export enum CacheScope {
    LIVE = 'live',           // Real-time data (30s TTL)
    HOURLY = 'hourly',       // Hourly aggregations (1h TTL)
    DAILY = 'daily',         // Daily snapshots (24h TTL)
    WEEKLY = 'weekly',       // Weekly aggregations (7d TTL)
    SEARCH = 'search',       // Search results (5min TTL)
    STATS = 'stats',         // Statistical data (varies by type)
}

// Standard TTL values in milliseconds
export const CacheTTL = {
    LIVE: 30_000,           // 30 seconds
    SEARCH: 300_000,        // 5 minutes
    HOURLY: 3_600_000,      // 1 hour
    DAILY: 86_400_000,      // 24 hours
    WEEKLY: 604_800_000,    // 7 days
} as const

// Cache key configuration interface
export interface CacheKeyConfig {
    domain: CacheDomain | string
    entity: string
    scope: CacheScope | string
    identifier?: string
    ttl?: number
}

/**
 * Cache key builder with validation and standardization
 */
export class CacheKeyBuilder {
    private config: Required<Omit<CacheKeyConfig, 'ttl'>> & { ttl?: number }

    constructor(config: CacheKeyConfig) {
        this.config = {
            domain: config.domain,
            entity: config.entity,
            scope: config.scope,
            identifier: config.identifier || '',
            ttl: config.ttl
        }
    }

    /**
     * Generate the full cache key string
     */
    build(): string {
        const parts = [
            this.config.domain,
            this.config.entity,
            this.config.scope
        ]

        if (this.config.identifier) {
            parts.push(this.config.identifier)
        }

        return parts.join(':')
    }

    /**
     * Get the appropriate TTL for this key's scope
     */
    getTTL(): number {
        if (this.config.ttl !== undefined) {
            return this.config.ttl
        }

        // Default TTL based on scope
        switch (this.config.scope) {
            case CacheScope.LIVE:
                return CacheTTL.LIVE
            case CacheScope.SEARCH:
                return CacheTTL.SEARCH
            case CacheScope.HOURLY:
                return CacheTTL.HOURLY
            case CacheScope.DAILY:
                return CacheTTL.DAILY
            case CacheScope.WEEKLY:
                return CacheTTL.WEEKLY
            default:
                return CacheTTL.LIVE // Safe default
        }
    }

    /**
     * Add timestamp to identifier for time-based keys
     */
    withTimestamp(timestamp?: DateTime): CacheKeyBuilder {
        const ts = timestamp || DateTime.now().setZone('America/Costa_Rica')
        const dateStr = ts.toFormat('yyyy-MM-dd')
        
        const newIdentifier = this.config.identifier 
            ? `${this.config.identifier}:${dateStr}`
            : dateStr

        return new CacheKeyBuilder({
            ...this.config,
            identifier: newIdentifier
        })
    }

    /**
     * Add hour component to timestamp for hourly keys
     */
    withHour(timestamp?: DateTime): CacheKeyBuilder {
        const ts = timestamp || DateTime.now().setZone('America/Costa_Rica')
        const dateTimeStr = ts.toFormat('yyyy-MM-dd:HH')
        
        const newIdentifier = this.config.identifier
            ? `${this.config.identifier}:${dateTimeStr}`
            : dateTimeStr

        return new CacheKeyBuilder({
            ...this.config,
            identifier: newIdentifier
        })
    }

    /**
     * Create a new builder with different scope
     */
    withScope(scope: CacheScope | string): CacheKeyBuilder {
        return new CacheKeyBuilder({
            ...this.config,
            scope
        })
    }

    /**
     * Create a new builder with different identifier
     */
    withIdentifier(identifier: string): CacheKeyBuilder {
        return new CacheKeyBuilder({
            ...this.config,
            identifier
        })
    }
}

/**
 * Pre-configured cache key builders for common patterns
 */
export const CacheKeys = {
    /**
     * Pulse API cache keys
     */
    pulse: {
        ranking: (scope: CacheScope = CacheScope.LIVE) =>
            new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'ranking',
                scope,
                identifier: 'snapshot'
            }),

        search: (term: string) =>
            new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'player',
                scope: CacheScope.SEARCH,
                identifier: encodeURIComponent(term)
            }),

        playerStats: (playerIds: string[]) =>
            new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'stats',
                scope: CacheScope.LIVE,
                identifier: `batch-${playerIds.length}-${playerIds[0]}`
            }),

        season: () =>
            new CacheKeyBuilder({
                domain: CacheDomain.PULSE,
                entity: 'season',
                scope: CacheScope.HOURLY,
                identifier: 'current'
            })
    },

    /**
     * Analytics cache keys for player analytics features
     */
    analytics: {
        playerActivity: (scope: CacheScope = CacheScope.DAILY) =>
            new CacheKeyBuilder({
                domain: CacheDomain.ANALYTICS,
                entity: 'player',
                scope,
                identifier: 'activity'
            }),

        rankingInsights: (scope: CacheScope = CacheScope.HOURLY) =>
            new CacheKeyBuilder({
                domain: CacheDomain.ANALYTICS,
                entity: 'ranking',
                scope,
                identifier: 'insights'
            }),

        metaStatistics: (scope: CacheScope = CacheScope.DAILY) =>
            new CacheKeyBuilder({
                domain: CacheDomain.ANALYTICS,
                entity: 'meta',
                scope,
                identifier: 'statistics'
            })
    },

    /**
     * Snapshot cache keys for daily baselines
     */
    snapshot: {
        daily: () =>
            new CacheKeyBuilder({
                domain: CacheDomain.SNAPSHOT,
                entity: 'ranking',
                scope: CacheScope.DAILY,
                identifier: 'baseline'
            }),

        position: () =>
            new CacheKeyBuilder({
                domain: CacheDomain.SNAPSHOT,
                entity: 'position',
                scope: CacheScope.DAILY,
                identifier: 'changes'
            })
    }
}

/**
 * Cache key utilities for validation and parsing
 */
export const CacheKeyUtils = {
    /**
     * Validate cache key format
     */
    isValidKey(key: string): boolean {
        const parts = key.split(':')
        return parts.length >= 3 && parts.length <= 4 &&
               parts.every(part => part.length > 0)
    },

    /**
     * Parse cache key into components
     */
    parseKey(key: string): { domain: string; entity: string; scope: string; identifier?: string } | null {
        if (!this.isValidKey(key)) {
            return null
        }

        const parts = key.split(':')
        return {
            domain: parts[0],
            entity: parts[1],
            scope: parts[2],
            identifier: parts[3]
        }
    },

    /**
     * Check if key belongs to a specific domain
     */
    isDomainKey(key: string, domain: CacheDomain | string): boolean {
        return key.startsWith(`${domain}:`)
    },

    /**
     * Generate namespace prefix for clearing domain keys
     */
    getDomainPrefix(domain: CacheDomain | string): string {
        return `${domain}:`
    },

    /**
     * Create cache key for temporal data with automatic timestamp
     */
    createTemporalKey(
        domain: CacheDomain | string,
        entity: string,
        scope: CacheScope | string,
        timezone: string = 'America/Costa_Rica'
    ): string {
        const timestamp = DateTime.now().setZone(timezone)
        const builder = new CacheKeyBuilder({ domain, entity, scope })

        switch (scope) {
            case CacheScope.HOURLY:
                return builder.withHour(timestamp).build()
            case CacheScope.DAILY:
            case CacheScope.WEEKLY:
                return builder.withTimestamp(timestamp).build()
            default:
                return builder.build()
        }
    }
}

/**
 * Cache entry wrapper with metadata
 */
export interface CacheEntry<T = any> {
    key: string
    value: T
    ttl: number
    createdAt: number
    expiresAt: number
    domain: string
    entity: string
    scope: string
}

/**
 * Cache entry factory for consistent metadata
 */
export function createCacheEntry<T>(
    keyBuilder: CacheKeyBuilder,
    value: T,
    customTTL?: number
): CacheEntry<T> {
    const key = keyBuilder.build()
    const ttl = customTTL || keyBuilder.getTTL()
    const now = Date.now()
    const parsedKey = CacheKeyUtils.parseKey(key)

    if (!parsedKey) {
        throw new Error(`Invalid cache key format: ${key}`)
    }

    return {
        key,
        value,
        ttl,
        createdAt: now,
        expiresAt: now + ttl,
        domain: parsedKey.domain,
        entity: parsedKey.entity,
        scope: parsedKey.scope
    }
}