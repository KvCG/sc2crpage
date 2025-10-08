/**
 * Match De-duplication Utilities
 * 
 * Prevents duplicate match writes for the same matchId within a day.
 * Uses both in-memory tracking and file-based persistence to avoid
 * processing the same match multiple times.
 */

import fs from 'fs/promises'
import path from 'path'
import logger from '../logging/logger'
import { ProcessedCustomMatch } from '../../shared/customMatchTypes'

/**
 * Configuration for de-duplication tracking
 */
interface DedupeConfig {
    /** Directory to store deduplication tracking files */
    trackingDir: string
    /** Hours to retain tracking data (cleanup old files) */
    retentionHours: number
    /** In-memory cache size limit */
    cacheLimit: number
}

/**
 * Default configuration
 */
const DEFAULT_DEDUPE_CONFIG: DedupeConfig = {
    trackingDir: path.join(__dirname, '../data/dedupe'),
    retentionHours: Number(process.env.H2H_DEDUPE_RETENTION_HOURS) || 48,
    cacheLimit: Number(process.env.H2H_DEDUPE_CACHE_LIMIT) || 10000
}

/**
 * Match de-duplication service
 */
export class MatchDeduplicator {
    private config: DedupeConfig
    private memoryCache: Map<string, Set<string>> = new Map() // dateKey -> Set<matchId as string>
    private cacheSize = 0

    constructor(config: Partial<DedupeConfig> = {}) {
        this.config = { ...DEFAULT_DEDUPE_CONFIG, ...config }
        this.ensureTrackingDirectory()
    }

    /**
     * Filter out duplicate matches from a batch
     */
    async filterDuplicates(matches: ProcessedCustomMatch[]): Promise<{
        uniqueMatches: ProcessedCustomMatch[]
        duplicateCount: number
        duplicateMatchIds: string[]
    }> {
        const uniqueMatches: ProcessedCustomMatch[] = []
        const duplicateMatchIds: string[] = []
        
        // Group matches by date for efficient processing
        const matchesByDate = this.groupMatchesByDate(matches)
        
        for (const [dateKey, dateMatches] of matchesByDate) {
            // Load existing matches for this date
            const existingMatchIds = await this.loadExistingMatchIds(dateKey)
            
            logger.info(
                {
                    feature: 'match-deduplication',
                    dateKey,
                    dateMatchesCount: dateMatches.length,
                    existingMatchIdsCount: existingMatchIds.size,
                    existingIds: Array.from(existingMatchIds).slice(0, 10), // First 10 IDs for debug
                },
                'Processing date matches for deduplication'
            )
            
            for (const match of dateMatches) {
                const matchIdStr = String(match.matchId)
                if (existingMatchIds.has(matchIdStr)) {
                    duplicateMatchIds.push(matchIdStr)
                    logger.info(
                        { 
                            feature: 'match-deduplication',
                            matchId: match.matchId,
                            dateKey,
                            reason: 'Match ID already exists'
                        },
                        'Duplicate match detected'
                    )
                } else {
                    uniqueMatches.push(match)
                    existingMatchIds.add(matchIdStr)
                }
            }
            
            // Update cache with new match IDs
            this.updateMemoryCache(dateKey, existingMatchIds)
        }

        logger.info(
            {
                feature: 'match-deduplication',
                totalMatches: matches.length,
                uniqueMatches: uniqueMatches.length,
                duplicates: duplicateMatchIds.length
            },
            'De-duplication completed'
        )

        return {
            uniqueMatches,
            duplicateCount: duplicateMatchIds.length,
            duplicateMatchIds
        }
    }

    /**
     * Record matches as processed to prevent future duplicates
     */
    async recordProcessedMatches(matches: ProcessedCustomMatch[]): Promise<void> {
        const matchesByDate = this.groupMatchesByDate(matches)
        
        for (const [dateKey, dateMatches] of matchesByDate) {
            const matchIds = dateMatches.map(m => String(m.matchId))
            await this.appendMatchIds(dateKey, matchIds)
        }

        logger.debug(
            {
                feature: 'match-deduplication',
                recordedMatches: matches.length
            },
            'Matches recorded for de-duplication'
        )
    }

    /**
     * Check if a single match is a duplicate
     */
    async isDuplicate(matchId: string, dateKey: string): Promise<boolean> {
        const existingMatchIds = await this.loadExistingMatchIds(dateKey)
        return existingMatchIds.has(matchId)
    }

    /**
     * Get de-duplication statistics
     */
    async getStats() {
        const trackingFiles = await this.listTrackingFiles()
        const stats = {
            trackedDates: trackingFiles.length,
            cacheSize: this.cacheSize,
            cacheKeys: this.memoryCache.size,
            trackingDir: this.config.trackingDir
        }

        return stats
    }

    /**
     * Clean up old tracking files
     */
    async cleanup(): Promise<void> {
        const retentionMs = this.config.retentionHours * 60 * 60 * 1000
        const cutoffTime = Date.now() - retentionMs
        
        try {
            const files = await this.listTrackingFiles()
            let deletedCount = 0
            
            for (const file of files) {
                const filePath = path.join(this.config.trackingDir, file)
                const stats = await fs.stat(filePath)
                
                if (stats.mtime.getTime() < cutoffTime) {
                    await fs.unlink(filePath)
                    deletedCount++
                    
                    // Also remove from memory cache
                    const dateKey = this.extractDateKeyFromFilename(file)
                    if (dateKey) {
                        this.memoryCache.delete(dateKey)
                    }
                }
            }
            
            logger.info(
                { 
                    feature: 'match-deduplication',
                    deletedFiles: deletedCount,
                    retentionHours: this.config.retentionHours
                },
                'Deduplication cleanup completed'
            )
        } catch (error) {
            logger.error(
                { error, feature: 'match-deduplication' },
                'Failed to cleanup deduplication files'
            )
        }
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    /**
     * Group matches by their date key for efficient processing
     */
    private groupMatchesByDate(matches: ProcessedCustomMatch[]): Map<string, ProcessedCustomMatch[]> {
        const grouped = new Map<string, ProcessedCustomMatch[]>()
        
        for (const match of matches) {
            const dateKey = match.dateKey
            const existing = grouped.get(dateKey) || []
            existing.push(match)
            grouped.set(dateKey, existing)
        }
        
        return grouped
    }

    /**
     * Load existing match IDs for a given date
     */
    private async loadExistingMatchIds(dateKey: string): Promise<Set<string>> {
        // Check memory cache first
        const cached = this.memoryCache.get(dateKey)
        if (cached) {
            return new Set(cached)
        }

        // Load from file
        const filePath = this.getTrackingFilePath(dateKey)
        const existingIds = new Set<string>()
        
        try {
            const content = await fs.readFile(filePath, 'utf-8')
            const lines = content.split('\n').filter(line => line.trim())
            lines.forEach(line => existingIds.add(line.trim()))
            
            // Cache in memory
            this.updateMemoryCache(dateKey, existingIds)
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                logger.error(
                    { error, dateKey, feature: 'match-deduplication' },
                    'Failed to load existing match IDs'
                )
            }
            // File doesn't exist yet, return empty set
        }
        
        return existingIds
    }

    /**
     * Append match IDs to the tracking file for a date
     */
    private async appendMatchIds(dateKey: string, matchIds: string[]): Promise<void> {
        if (matchIds.length === 0) return
        
        const filePath = this.getTrackingFilePath(dateKey)
        const content = matchIds.join('\n') + '\n'
        
        try {
            await fs.appendFile(filePath, content, 'utf-8')
            
            // Update memory cache
            const existing = await this.loadExistingMatchIds(dateKey)
            matchIds.forEach(id => existing.add(id))
            this.updateMemoryCache(dateKey, existing)
        } catch (error) {
            logger.error(
                { error, dateKey, matchIds: matchIds.length, feature: 'match-deduplication' },
                'Failed to append match IDs to tracking file'
            )
            throw error
        }
    }

    /**
     * Update memory cache with size management
     */
    private updateMemoryCache(dateKey: string, matchIds: Set<string>): void {
        // Check if we need to clear old entries to stay under limit
        if (this.cacheSize + matchIds.size > this.config.cacheLimit) {
            this.evictOldestCacheEntries()
        }
        
        // Remove old entry if exists
        const oldSize = this.memoryCache.get(dateKey)?.size || 0
        this.cacheSize -= oldSize
        
        // Add new entry
        this.memoryCache.set(dateKey, matchIds)
        this.cacheSize += matchIds.size
    }

    /**
     * Evict oldest cache entries to make room
     */
    private evictOldestCacheEntries(): void {
        // Simple LRU: remove half the entries
        const entries = Array.from(this.memoryCache.entries())
        const toRemove = Math.floor(entries.length / 2)
        
        for (let i = 0; i < toRemove; i++) {
            const [dateKey, matchIds] = entries[i]
            this.memoryCache.delete(dateKey)
            this.cacheSize -= matchIds.size
        }
        
        logger.debug(
            { 
                feature: 'match-deduplication',
                removedEntries: toRemove,
                newCacheSize: this.cacheSize
            },
            'Evicted old cache entries'
        )
    }

    /**
     * Get the file path for tracking matches on a given date
     */
    private getTrackingFilePath(dateKey: string): string {
        return path.join(this.config.trackingDir, `matches-${dateKey}.txt`)
    }

    /**
     * Extract date key from tracking filename
     */
    private extractDateKeyFromFilename(filename: string): string | null {
        const match = filename.match(/^matches-(\d{4}-\d{2}-\d{2})\.txt$/)
        return match ? match[1] : null
    }

    /**
     * List all tracking files in the directory
     */
    private async listTrackingFiles(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.config.trackingDir)
            return files.filter(file => file.startsWith('matches-') && file.endsWith('.txt'))
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return []
            }
            throw error
        }
    }

    /**
     * Ensure tracking directory exists
     */
    private async ensureTrackingDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.config.trackingDir, { recursive: true })
        } catch (error) {
            logger.error(
                { error, trackingDir: this.config.trackingDir, feature: 'match-deduplication' },
                'Failed to create tracking directory'
            )
            throw error
        }
    }
}

// Export singleton instance
export const matchDeduplicator = new MatchDeduplicator()

// Export factory function for testing with custom configuration
export function createMatchDeduplicator(config?: Partial<DedupeConfig>): MatchDeduplicator {
    return new MatchDeduplicator(config)
}