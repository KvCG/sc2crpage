/**
 * Simplified Match De-duplication Service
 * 
 * Uses dual storage (Drive + local JSON file) with memory cache.
 * Provides persistence across pod restarts while maintaining reliability.
 */

import fs from 'fs/promises'
import path from 'path'
import logger from '../logging/logger'
import { getH2HConfig } from '../config/h2hConfig'
import { ProcessedCustomMatch } from '../../shared/customMatchTypes'
import { GoogleDriveService } from './googleApi'

/**
 * Structure of the deduplication data file (matches old MatchDeduplicator format)
 */
export interface DeduplicationData {
    metadata: {
        schemaVersion: string
        lastUpdated: string
        totalDates: number
        totalMatches: number
    }
    processedMatches: Record<string, string[]> // dateKey -> matchIds[]
}

/**
 * Simplified deduplication service with local persistence
 */
export class SimplifiedMatchDeduplicator {
    private memoryCache: Map<string, Set<string>> = new Map()
    private driveService: GoogleDriveService
    private config: { 
        cacheLimit: number
        retentionDays: number
        localFilePath: string
        trackingDir: string
    }

    constructor() {
        const h2hConfig = getH2HConfig()
        
        // Use process.cwd() to get root directory, then navigate to dist/data/dedupe
        // This works for both development (dist/) and production deployments
        const rootDir = process.cwd()
        const dataDir = path.join(rootDir, 'dist', 'data', 'dedupe')
        
        this.config = {
            cacheLimit: h2hConfig.cacheLimit,
            retentionDays: h2hConfig.dedupeRetentionDays,
            trackingDir: dataDir,
            localFilePath: path.join(dataDir, 'processed-matches-local.json'),
        }
        this.driveService = new GoogleDriveService('MatchDeduplication', 'match-deduplication', true)
    }

    /**
     * Preload deduplication data from local file and Drive
     * This should be called before any discovery starts to ensure data is available
     */
    async preloadDeduplicationData(): Promise<void> {
        try {
            logger.info(
                { feature: 'match-deduplication' },
                'Preloading deduplication data from local file and Drive'
            )

            // Load from local file first (fastest)
            const localData = await this.loadLocalDeduplicationData()
            
            // Populate memory cache from local data using proper cache management
            for (const [dateKey, matchIds] of Object.entries(localData.processedMatches)) {
                this.updateMemoryCache(dateKey, new Set(matchIds as string[]))
            }

            const totalCachedMatches = Array.from(this.memoryCache.values())
                .reduce((sum, set) => sum + set.size, 0)

            logger.info(
                {
                    feature: 'match-deduplication',
                    localDates: Object.keys(localData.processedMatches).length,
                    localMatches: Object.values(localData.processedMatches).reduce((sum, matches) => sum + (matches as string[]).length, 0),
                    memoryCacheEntries: this.memoryCache.size,
                    memoryCachedMatches: totalCachedMatches,
                    cacheLimit: this.config.cacheLimit
                },
                'Deduplication data preloaded from local file'
            )

            // Also try to sync with Drive in the background (don't await to avoid blocking)
            this.syncWithDrive().catch((error: any) => {
                logger.warn(
                    { error, feature: 'match-deduplication' },
                    'Background Drive sync failed during preload - continuing with local data'
                )
            })

        } catch (error) {
            logger.warn(
                { error, feature: 'match-deduplication' },
                'Failed to preload deduplication data - starting with empty cache'
            )
        }
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
            const existingMatchIds = await this.getExistingMatchIds(dateKey)
            
            for (const match of dateMatches) {
                const matchIdStr = String(match.matchId)
                if (existingMatchIds.has(matchIdStr)) {
                    duplicateMatchIds.push(matchIdStr)
                } else {
                    uniqueMatches.push(match)
                    existingMatchIds.add(matchIdStr)
                }
            }
            
            // Update cache
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
            await this.addMatchIds(dateKey, matchIds)
        }
    }

    /**
     * Check if a single match is a duplicate
     */
    async isDuplicate(matchId: string, dateKey: string): Promise<boolean> {
        const existingMatchIds = await this.getExistingMatchIds(dateKey)
        return existingMatchIds.has(matchId)
    }

    /**
     * Get deduplication statistics
     */
    async getStats() {
        const driveStats = await this.driveService.getFolderStats()
        
        return {
            memoryCache: {
                cacheSize: this.memoryCache.size,
                totalCachedMatches: Array.from(this.memoryCache.values())
                    .reduce((sum, set) => sum + set.size, 0),
            },
            driveStorage: {
                totalFiles: driveStats.totalFiles,
                fileNames: driveStats.fileNames,
                lastModified: driveStats.lastModified,
            },
            config: this.config,
        }
    }

    /**
     * Clean up old files (both Drive and memory cache)
     */
    async cleanup(): Promise<void> {
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)
        const cutoffDateKey = cutoffDate.toISOString().split('T')[0]

        // Clean memory cache
        let removedFromCache = 0
        for (const [dateKey] of this.memoryCache) {
            if (dateKey < cutoffDateKey) {
                this.memoryCache.delete(dateKey)
                removedFromCache++
            }
        }

        // Clean old Drive files
        let removedFromDrive = 0
        try {
            const files = await this.driveService.listFiles()
            
            for (const file of files) {
                const dateMatch = file.name.match(/matches-(\d{4}-\d{2}-\d{2})\.json/)
                if (dateMatch) {
                    const fileDateKey = dateMatch[1]
                    if (fileDateKey < cutoffDateKey) {
                        await this.driveService.deleteFile(file.name)
                        removedFromDrive++
                    }
                }
            }
        } catch (error) {
            logger.warn(
                { error, feature: 'match-deduplication' },
                'Failed to clean up old Drive files'
            )
        }

        logger.info(
            { 
                feature: 'match-deduplication',
                removedFromCache,
                removedFromDrive,
                retentionDays: this.config.retentionDays
            },
            'Cleanup completed'
        )
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
     * Get existing match IDs for a date using hierarchical fallback chain:
     * Memory (fastest) → Local File (persistent) → Drive (backup) → Empty Set
     */
    private async getExistingMatchIds(dateKey: string): Promise<Set<string>> {
        logger.debug(
            { dateKey, feature: 'match-deduplication' },
            'Starting hierarchical lookup: Memory → Local File → Drive'
        )

        // LEVEL 1: Check memory cache first (fastest - sub-millisecond)
        const cached = this.memoryCache.get(dateKey)
        if (cached) {
            logger.debug(
                { dateKey, matchCount: cached.size, feature: 'match-deduplication' },
                'HIT: Memory cache - returning immediately'
            )
            return new Set(cached)
        }
        
        logger.debug(
            { dateKey, feature: 'match-deduplication' },
            'MISS: Memory cache - checking local file'
        )

        // LEVEL 2: Try local file (fast - few milliseconds, survives restarts)
        try {
            const localData = await this.loadLocalDeduplicationData()
            const matchIds = new Set(localData.processedMatches[dateKey] || [])
            
            if (matchIds.size > 0) {
                logger.debug(
                    { dateKey, matchCount: matchIds.size, feature: 'match-deduplication' },
                    'HIT: Local file - caching in memory and returning'
                )
                
                // Cache in memory for future lookups
                this.updateMemoryCache(dateKey, matchIds)
                return matchIds
            }
            
            logger.debug(
                { dateKey, feature: 'match-deduplication' },
                'MISS: Local file (no matches for date) - checking Drive'
            )
        } catch (localError) {
            logger.debug(
                { error: localError, dateKey, feature: 'match-deduplication' },
                'ERROR: Local file read failed - falling back to Drive'
            )
        }

        // LEVEL 3: Try Drive (slower - network call, but authoritative)
        try {
            const fileName = `matches-${dateKey}.json`
            const content = await this.driveService.readFile(fileName)
            const data = JSON.parse(content) as { matchIds: string[] }
            const matchIds = new Set(data.matchIds || [])
            
            logger.debug(
                { dateKey, matchCount: matchIds.size, feature: 'match-deduplication' },
                'HIT: Drive - caching in memory and returning'
            )
            
            // Cache in memory for future use
            this.updateMemoryCache(dateKey, matchIds)
            
            return matchIds
        } catch (driveError) {
            logger.debug(
                { error: driveError, dateKey, feature: 'match-deduplication' },
                'MISS: Drive - returning empty set (new date)'
            )
        }

        // LEVEL 4: All sources failed - return empty set (new date or complete failure)
        logger.debug(
            { dateKey, feature: 'match-deduplication' },
            'All sources exhausted - returning empty set for new date'
        )
        return new Set<string>()
    }

    /**
     * Add match IDs to the storage for a date (write-through: Memory + Local File + Drive)
     */
    private async addMatchIds(dateKey: string, matchIds: string[]): Promise<void> {
        if (matchIds.length === 0) return
        
        // Get existing IDs
        const existingIds = await this.getExistingMatchIds(dateKey)
        
        // Add new unique IDs
        const newUniqueIds = matchIds.filter(id => !existingIds.has(id))
        if (newUniqueIds.length === 0) return
        
        newUniqueIds.forEach(id => existingIds.add(id))
        
        // Write-through chain: Update all storage layers simultaneously
        const writePromises: Promise<void>[] = []
        
        // 1. Update memory cache first (fastest, always succeeds)
        this.updateMemoryCache(dateKey, existingIds)
        
        // 2. Update local file (critical for persistence across restarts)
        writePromises.push(
            this.appendToLocalFile(dateKey, newUniqueIds).catch(localError => {
                logger.error(
                    { error: localError, dateKey, matchIds: newUniqueIds.length, feature: 'match-deduplication' },
                    'CRITICAL: Failed to update local file - persistence at risk!'
                )
            })
        )
        
        // 3. Update Drive (backup/sync)
        writePromises.push(
            this.saveToDrive(dateKey, existingIds).catch(driveError => {
                logger.warn(
                    { error: driveError, dateKey, matchIds: newUniqueIds.length, feature: 'match-deduplication' },
                    'Failed to save to Drive - local persistence still works'
                )
            })
        )
        
        // Wait for both file operations to complete
        await Promise.all(writePromises)
        
        logger.debug(
            {
                dateKey,
                newMatches: newUniqueIds.length,
                totalMatches: existingIds.size,
                feature: 'match-deduplication'
            },
            'Write-through completed: Memory + Local File + Drive updated'
        )
    }

    /**
     * Save match IDs to Drive
     */
    private async saveToDrive(dateKey: string, matchIds: Set<string>): Promise<void> {
        const fileName = `matches-${dateKey}.json`
        const content = JSON.stringify({
            dateKey,
            matchIds: Array.from(matchIds),
            lastUpdated: new Date().toISOString(),
        }, null, 2)
        
        await this.driveService.writeFile(fileName, content)
    }

    /**
     * Update memory cache with size management
     */
    private updateMemoryCache(dateKey: string, matchIds: Set<string>): void {
        // Calculate current total matches in cache
        const getCurrentMatchCount = () => Array.from(this.memoryCache.values())
            .reduce((sum, set) => sum + set.size, 0)

        // Get current entry size if replacing existing data
        const currentEntry = this.memoryCache.get(dateKey)
        const currentEntrySize = currentEntry ? currentEntry.size : 0

        // LRU eviction: remove oldest entries until we're under the limit
        let totalMatches = getCurrentMatchCount()
        while (totalMatches + matchIds.size - currentEntrySize > this.config.cacheLimit && this.memoryCache.size > 0) {
            const oldestKey = this.memoryCache.keys().next().value
            if (oldestKey && oldestKey !== dateKey) { // Don't remove the key we're about to update
                const removedEntry = this.memoryCache.get(oldestKey)
                this.memoryCache.delete(oldestKey)
                totalMatches -= (removedEntry ? removedEntry.size : 0)
                
                logger.debug(
                    { 
                        removedDateKey: oldestKey,
                        removedMatchCount: removedEntry ? removedEntry.size : 0,
                        remainingCacheSize: this.memoryCache.size,
                        remainingMatchCount: totalMatches,
                        feature: 'match-deduplication'
                    },
                    'LRU evicted oldest cache entry'
                )
            } else {
                break // Safety break if we can't find a suitable key to remove
            }
        }
        
        // Remove existing entry and re-add (LRU behavior)
        this.memoryCache.delete(dateKey)
        this.memoryCache.set(dateKey, matchIds)
        
        logger.debug(
            {
                dateKey,
                matchCount: matchIds.size,
                totalCacheEntries: this.memoryCache.size,
                totalCachedMatches: getCurrentMatchCount(),
                cacheLimit: this.config.cacheLimit,
                feature: 'match-deduplication'
            },
            'Updated memory cache with match data'
        )
    }

    /**
     * Load deduplication data from local JSON file
     */
    private async loadLocalDeduplicationData(): Promise<DeduplicationData> {
        try {
            await this.ensureTrackingDirectory()
            
            const content = await fs.readFile(this.config.localFilePath, 'utf-8')
            const localData = JSON.parse(content) as DeduplicationData
            
            // Validate structure
            if (!localData.metadata || !localData.processedMatches) {
                throw new Error('Invalid local deduplication data structure')
            }
            
            return localData
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // Create empty structure
                const emptyData: DeduplicationData = {
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
                { error, filePath: this.config.localFilePath, feature: 'match-deduplication' },
                'Failed to load local deduplication data'
            )
            throw error
        }
    }

    /**
     * Append match IDs to local JSON file
     */
    private async appendToLocalFile(dateKey: string, matchIds: string[]): Promise<void> {
        if (matchIds.length === 0) return
        
        try {
            // Load current local data
            const localData = await this.loadLocalDeduplicationData()
            
            // Add new match IDs to the date key (avoiding duplicates)
            const existingIds = new Set(localData.processedMatches[dateKey] || [])
            const newUniqueIds = matchIds.filter(id => !existingIds.has(id))
            
            if (newUniqueIds.length > 0) {
                localData.processedMatches[dateKey] = [
                    ...(localData.processedMatches[dateKey] || []),
                    ...newUniqueIds
                ]
                
                // Save back to local file
                await this.saveLocalDeduplicationData(localData)
                
                logger.debug(
                    { 
                        dateKey, 
                        newMatchCount: newUniqueIds.length,
                        totalForDate: localData.processedMatches[dateKey].length,
                        feature: 'match-deduplication' 
                    },
                    'Local backup updated'
                )
            }
        } catch (error) {
            logger.error(
                { error, dateKey, matchIds: matchIds.length, feature: 'match-deduplication' },
                'Failed to update local JSON tracking file'
            )
            throw error
        }
    }

    /**
     * Save deduplication data to local JSON file
     */
    private async saveLocalDeduplicationData(localData: DeduplicationData): Promise<void> {
        try {
            await this.ensureTrackingDirectory()
            
            // Update metadata
            localData.metadata.totalDates = Object.keys(localData.processedMatches).length
            localData.metadata.totalMatches = Object.values(localData.processedMatches)
                .reduce((sum, matches) => sum + matches.length, 0)
            localData.metadata.lastUpdated = new Date().toISOString()
            
            // Write to file
            const content = JSON.stringify(localData, null, 2)
            await fs.writeFile(this.config.localFilePath, content, 'utf-8')
            
            logger.debug(
                { 
                    totalDates: localData.metadata.totalDates,
                    totalMatches: localData.metadata.totalMatches,
                    feature: 'match-deduplication' 
                },
                'Local deduplication data saved'
            )
            
        } catch (error) {
            logger.error(
                { error, filePath: this.config.localFilePath, feature: 'match-deduplication' },
                'Failed to save local deduplication data'
            )
            throw error
        }
    }

    /**
     * Background sync with Drive to update local cache
     */
    private async syncWithDrive(): Promise<void> {
        try {
            // Get recent dates that need syncing
            const recentDates = this.getRecentDates(7) // Last 7 days
            let syncedDates = 0
            
            for (const dateKey of recentDates) {
                try {
                    const driveMatchIds = await this.getExistingMatchIds(dateKey)
                    if (driveMatchIds.size > 0) {
                        this.memoryCache.set(dateKey, driveMatchIds)
                        syncedDates++
                    }
                } catch (error) {
                    logger.debug(
                        { error, dateKey, feature: 'match-deduplication' },
                        'Failed to sync date from Drive'
                    )
                }
            }
            
            logger.info(
                { syncedDates, totalRecentDates: recentDates.length, feature: 'match-deduplication' },
                'Background Drive sync completed'
            )
        } catch (error) {
            logger.warn(
                { error, feature: 'match-deduplication' },
                'Background Drive sync failed'
            )
        }
    }

    /**
     * Get recent date keys for syncing
     */
    private getRecentDates(days: number): string[] {
        const dates: string[] = []
        const today = new Date()
        
        for (let i = 0; i < days; i++) {
            const date = new Date(today)
            date.setDate(today.getDate() - i)
            dates.push(date.toISOString().split('T')[0])
        }
        
        return dates
    }

    /**
     * Ensure the tracking directory exists
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

// Export simplified singleton instance
export const simplifiedMatchDeduplicator = new SimplifiedMatchDeduplicator()