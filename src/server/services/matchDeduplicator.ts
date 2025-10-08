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
import { customMatchDeduplicationDriveService, DeduplicationData } from './customMatchDeduplicationDriveService'

/**
 * Local deduplication data structure - uses the same interface as Drive for consistency
 */
type LocalDeduplicationData = DeduplicationData

/**
 * Configuration for de-duplication tracking
 */
interface DedupeConfig {
    /** Directory to store deduplication tracking files */
    trackingDir: string
    /** Single JSON file name for local backup */
    localFileName: string
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
    localFileName: 'processed-matches-local.json',
    retentionHours: Number(process.env.H2H_DEDUPE_RETENTION_HOURS) || 24 * 30, // 30 days instead of 2 days
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
        
        // Get Drive statistics
        let driveStats = null
        try {
            driveStats = await customMatchDeduplicationDriveService.getStats()
        } catch (driveError) {
            logger.warn(
                { error: driveError, feature: 'match-deduplication' },
                'Failed to get Drive deduplication stats'
            )
        }
        
        const stats = {
            // Local file stats (backup/cache)
            localFiles: {
                trackedDates: trackingFiles.length,
                trackingDir: this.config.trackingDir
            },
            // Memory cache stats
            memoryCache: {
                cacheSize: this.cacheSize,
                cacheKeys: this.memoryCache.size
            },
            // Drive stats (primary storage)
            driveStorage: driveStats || {
                totalFiles: 0,
                dateRange: null,
                recentFiles: []
            }
        }

        return stats
    }

    /**
     * Clean up old tracking files
     */
    async cleanup(): Promise<void> {
        // Clean up Drive files (primary storage)
        try {
            await customMatchDeduplicationDriveService.cleanupOldFiles()
            logger.info(
                { feature: 'match-deduplication' },
                'Drive deduplication cleanup completed'
            )
        } catch (driveError) {
            logger.warn(
                { error: driveError, feature: 'match-deduplication' },
                'Failed to cleanup Drive deduplication files'
            )
        }

        // Clean up local JSON file (remove old entries)
        try {
            const localData = await this.loadLocalDeduplicationData()
            const cutoffDate = new Date()
            cutoffDate.setHours(cutoffDate.getHours() - this.config.retentionHours)
            const cutoffDateKey = cutoffDate.toISOString().split('T')[0]
            
            const entriesBefore = Object.keys(localData.processedMatches).length
            const matchesBefore = Object.values(localData.processedMatches)
                .reduce((sum, matches) => sum + (matches as string[]).length, 0)
            
            // Filter out old entries
            const filteredMatches: Record<string, string[]> = {}
            let removedEntries = 0
            
            for (const [dateKey, matches] of Object.entries(localData.processedMatches)) {
                if (dateKey >= cutoffDateKey) {
                    filteredMatches[dateKey] = matches as string[]
                } else {
                    removedEntries++
                    // Remove from memory cache too
                    this.memoryCache.delete(dateKey)
                }
            }
            
            // Save updated local data if anything was removed
            if (removedEntries > 0) {
                localData.processedMatches = filteredMatches
                await this.saveLocalDeduplicationData(localData)
            }
            
            logger.info(
                { 
                    feature: 'match-deduplication',
                    removedLocalEntries: removedEntries,
                    remainingEntries: Object.keys(filteredMatches).length,
                    totalMatches: matchesBefore - (matchesBefore - Object.values(filteredMatches).reduce((sum, matches) => sum + matches.length, 0)),
                    retentionHours: this.config.retentionHours
                },
                'Local JSON deduplication cleanup completed'
            )
        } catch (localError) {
            logger.warn(
                { error: localError, feature: 'match-deduplication' },
                'Failed to cleanup local JSON deduplication data'
            )
        }

        // Clean up any remaining old txt files (legacy cleanup)
        try {
            const files = await this.listTrackingFiles()
            let deletedCount = 0
            
            for (const file of files) {
                // Only delete .txt files (legacy format), keep the JSON file
                if (file.endsWith('.txt')) {
                    const filePath = path.join(this.config.trackingDir, file)
                    await fs.unlink(filePath)
                    deletedCount++
                }
            }
            
            if (deletedCount > 0) {
                logger.info(
                    { 
                        feature: 'match-deduplication',
                        deletedLegacyFiles: deletedCount,
                    },
                    'Legacy txt files cleanup completed'
                )
            }
        } catch (legacyError) {
            logger.warn(
                { error: legacyError, feature: 'match-deduplication' },
                'Failed to cleanup legacy txt files'
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

        // Load from Drive first (primary source)
        let existingIds: Set<string>
        try {
            existingIds = await customMatchDeduplicationDriveService.getProcessedMatchIds(dateKey)
            
            // Cache in memory for future use
            this.updateMemoryCache(dateKey, existingIds)
            
            logger.debug(
                { dateKey, count: existingIds.size, feature: 'match-deduplication' },
                'Loaded match IDs from Drive'
            )
        } catch (driveError) {
            logger.warn(
                { error: driveError, dateKey, feature: 'match-deduplication' },
                'Failed to load from Drive, falling back to local file'
            )
            
            // Fallback to local file
            existingIds = await this.loadFromLocalFile(dateKey)
        }
        
        return existingIds
    }

    /**
     * Fallback method to load from local JSON file when Drive is unavailable
     */
    private async loadFromLocalFile(dateKey: string): Promise<Set<string>> {
        try {
            const localData = await this.loadLocalDeduplicationData()
            const matchIds = localData.processedMatches[dateKey] || []
            
            const existingIds = new Set<string>(matchIds)
            
            // Cache in memory
            this.updateMemoryCache(dateKey, existingIds)
            
            logger.debug(
                { dateKey, count: existingIds.size, feature: 'match-deduplication' },
                'Loaded match IDs from local JSON file'
            )
            
            return existingIds
        } catch (error: any) {
            logger.error(
                { error, dateKey, feature: 'match-deduplication' },
                'Failed to load existing match IDs from local JSON file'
            )
            return new Set<string>()
        }
    }

    /**
     * Append match IDs to the tracking file for a date
     */
    private async appendMatchIds(dateKey: string, matchIds: string[]): Promise<void> {
        if (matchIds.length === 0) return
        
        console.log('[DEBUG] appendMatchIds called with:', { dateKey, matchIdsCount: matchIds.length })
        
        // Store to Drive first (primary storage)
        try {
            await customMatchDeduplicationDriveService.recordProcessedMatchIds(dateKey, matchIds)
            
            logger.debug(
                { dateKey, count: matchIds.length, feature: 'match-deduplication' },
                'Recorded match IDs to Drive'
            )
        } catch (driveError) {
            logger.warn(
                { error: driveError, dateKey, matchIds: matchIds.length, feature: 'match-deduplication' },
                'Failed to record to Drive, will fallback to local file'
            )
        }
        
        // Also store to local file as backup/cache
        try {
            await this.appendToLocalFile(dateKey, matchIds)
        } catch (localError) {
            logger.warn(
                { error: localError, dateKey, matchIds: matchIds.length, feature: 'match-deduplication' },
                'Failed to record to local file backup'
            )
        }
        
        // Update memory cache regardless
        const existing = this.memoryCache.get(dateKey) || new Set<string>()
        matchIds.forEach(id => existing.add(id))
        this.updateMemoryCache(dateKey, existing)
    }

    /**
     * Update local JSON file as backup
     */
    private async appendToLocalFile(dateKey: string, matchIds: string[]): Promise<void> {
        if (matchIds.length === 0) return
        
        try {
            // Load current local data
            const localData = await this.loadLocalDeduplicationData()
            
            // Add new match IDs to the date key (avoiding duplicates)
            const existingIds = new Set(localData.processedMatches[dateKey] || [])
            const newUniqueIds = matchIds.filter(id => !existingIds.has(id))
            
            logger.info(
                { 
                    dateKey, 
                    incomingMatchIds: matchIds.length,
                    existingIds: existingIds.size,
                    newUniqueIds: newUniqueIds.length,
                    first5NewIds: newUniqueIds.slice(0, 5),
                    feature: 'match-deduplication' 
                },
                'Local backup: processing match IDs'
            )
            
            if (newUniqueIds.length > 0) {
                localData.processedMatches[dateKey] = [
                    ...(localData.processedMatches[dateKey] || []),
                    ...newUniqueIds
                ]
                
                // Update metadata
                localData.metadata.lastUpdated = new Date().toISOString()
                localData.metadata.totalDates = Object.keys(localData.processedMatches).length
                localData.metadata.totalMatches = Object.values(localData.processedMatches)
                    .reduce((sum, matches) => sum + matches.length, 0)
                
                logger.info(
                    { 
                        dateKey, 
                        newMatchCount: newUniqueIds.length,
                        totalDatesBeforeSave: localData.metadata.totalDates,
                        totalMatchesBeforeSave: localData.metadata.totalMatches,
                        feature: 'match-deduplication' 
                    },
                    'Local backup: about to save data with new matches'
                )
                
                // Save back to local file
                await this.saveLocalDeduplicationData(localData)
            }
            
            logger.debug(
                { dateKey, newMatchCount: newUniqueIds.length, feature: 'match-deduplication' },
                'Updated local JSON deduplication file'
            )
        } catch (error) {
            logger.error(
                { error, dateKey, matchIds: matchIds.length, feature: 'match-deduplication' },
                'Failed to update local JSON tracking file'
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
     * Load local deduplication data from JSON file
     */
    private async loadLocalDeduplicationData(): Promise<LocalDeduplicationData> {
        const filePath = path.join(this.config.trackingDir, this.config.localFileName)
        
        try {
            await this.ensureTrackingDirectory()
            
            const content = await fs.readFile(filePath, 'utf-8')
            const localData = JSON.parse(content) as LocalDeduplicationData
            
            // Validate structure
            if (!localData.metadata || !localData.processedMatches) {
                throw new Error('Invalid local deduplication data structure')
            }
            
            return localData
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // Create empty structure
                const emptyData: LocalDeduplicationData = {
                    metadata: {
                        schemaVersion: '1.0.0',
                        lastUpdated: new Date().toISOString(),
                        totalDates: 0,
                        totalMatches: 0,
                    },
                    processedMatches: {}
                }
                return emptyData
            }
            
            logger.error(
                { error, filePath, feature: 'match-deduplication' },
                'Failed to load local deduplication data'
            )
            throw error
        }
    }

    /**
     * Save local deduplication data to JSON file
     */
    private async saveLocalDeduplicationData(localData: LocalDeduplicationData): Promise<void> {
        const filePath = path.join(this.config.trackingDir, this.config.localFileName)
        
        try {
            await this.ensureTrackingDirectory()
            
            // Update metadata (no filtering during regular saves)
            localData.metadata.totalDates = Object.keys(localData.processedMatches).length
            localData.metadata.totalMatches = Object.values(localData.processedMatches)
                .reduce((sum, matches) => sum + (matches as string[]).length, 0)
            localData.metadata.lastUpdated = new Date().toISOString()
            
            logger.info(
                { 
                    totalDates: localData.metadata.totalDates,
                    totalMatches: localData.metadata.totalMatches,
                    feature: 'match-deduplication' 
                },
                'Local backup: saving data without filtering'
            )
            
            // Write to file
            const content = JSON.stringify(localData, null, 2)
            await fs.writeFile(filePath, content, 'utf-8')
            
            logger.debug(
                { 
                    filePath, 
                    totalDates: localData.metadata.totalDates,
                    totalMatches: localData.metadata.totalMatches,
                    feature: 'match-deduplication' 
                },
                'Saved local deduplication data'
            )
        } catch (error) {
            logger.error(
                { error, filePath, feature: 'match-deduplication' },
                'Failed to save local deduplication data'
            )
            throw error
        }
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