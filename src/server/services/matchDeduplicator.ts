/**
 * Match De-duplication Service
 * 
 * Uses dual storage (Drive + local JSON file) with memory cache.
 * Provides persistence across pod restarts while maintaining reliability.
 */

import fs from 'fs/promises'
import path from 'path'
import logger from '../logging/logger'
import { getH2HConfig } from '../config/h2hConfig'
import { ProcessedCustomMatch } from '../../shared/customMatchTypes'
import { customMatchDeduplicationDriveService } from './customMatchDeduplicationDriveService'

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
 * Match deduplication service with local persistence
 */
export class MatchDeduplicator {
    private memoryCache: Map<string, Set<string>> = new Map()
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
        // Drive service is handled by the singleton customMatchDeduplicationDriveService
        
        // Ensure directory exists on instantiation (non-blocking)
        this.ensureTrackingDirectory().catch(error => {
            logger.warn({ error, feature: 'match-deduplication' }, 
                       'Failed to create tracking directory on startup')
        })
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
            const localIsEmpty = Object.keys(localData.processedMatches).length === 0
            
            if (localIsEmpty) {
                logger.info(
                    { feature: 'match-deduplication' },
                    'Local file is empty - performing full Drive sync'
                )
                // If local file is empty, do a complete sync to get all historical data
                await this.fullSyncWithDrive()
                
                // Reload local data after full Drive sync
                const updatedLocalData = await this.loadLocalDeduplicationData()
                
                // Ensure the data structure is saved to disk (creates/updates the file)
                await this.saveLocalDeduplicationData(updatedLocalData)
                
                // Memory cache should already be populated by fullSyncWithDrive, but let's ensure it
                for (const [dateKey, matchIds] of Object.entries(updatedLocalData.processedMatches)) {
                    this.updateMemoryCache(dateKey, new Set(matchIds as string[]))
                }
            } else {
                // Check if local data seems significantly outdated (very few dates/matches)
                const localDateCount = Object.keys(localData.processedMatches).length
                const localMatchCount = Object.values(localData.processedMatches).reduce(
                    (sum, matchIds) => sum + matchIds.length, 0
                )
                
                logger.info(
                    { 
                        localDateCount, 
                        localMatchCount,
                        feature: 'match-deduplication' 
                    },
                    'Found existing local deduplication data'
                )
                
                // If local data seems very limited (< 10 dates or < 50 matches), do full sync
                if (localDateCount < 10 || localMatchCount < 50) {
                    logger.info(
                        { 
                            localDateCount, 
                            localMatchCount,
                            feature: 'match-deduplication' 
                        },
                        'Local data is limited - performing full Drive sync'
                    )
                    
                    try {
                        await this.fullSyncWithDrive()
                    } catch (error: any) {
                        logger.warn(
                            { error, feature: 'match-deduplication' },
                            'Full Drive sync failed - continuing with limited local data'
                        )
                    }
                } else {
                    // Populate memory cache from existing local data
                    for (const [dateKey, matchIds] of Object.entries(localData.processedMatches)) {
                        this.updateMemoryCache(dateKey, new Set(matchIds as string[]))
                    }
                    
                    // Start background sync with Drive (recent dates only, non-blocking)
                    this.syncWithDrive().catch((error: any) => {
                        logger.warn(
                            { error, feature: 'match-deduplication' },
                            'Background Drive sync failed during preload - continuing with local data'
                        )
                    })
                }
            }

            const totalCachedMatches = Array.from(this.memoryCache.values())
                .reduce((sum, set) => sum + set.size, 0)

            logger.info(
                {
                    feature: 'match-deduplication',
                    memoryCachedDates: this.memoryCache.size,
                    memoryCachedMatches: totalCachedMatches,
                    cacheLimit: this.config.cacheLimit,
                    wasLocalEmpty: localIsEmpty
                },
                'Deduplication data preload completed successfully'
            )

        } catch (error) {
            logger.error(
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
        // Try to get actual drive service stats, fall back to defaults if service doesn't support it
        let driveStats = { totalFiles: 0, fileNames: [], lastModified: null }
        try {
            // Check if the drive service has stats capability
            if (typeof (customMatchDeduplicationDriveService as any).getFolderStats === 'function') {
                driveStats = await (customMatchDeduplicationDriveService as any).getFolderStats()
            } else if (typeof (customMatchDeduplicationDriveService as any).getStats === 'function') {
                driveStats = await (customMatchDeduplicationDriveService as any).getStats()
            }
        } catch (error) {
            logger.warn({ error, feature: 'match-deduplication' }, 
                       'Failed to get drive service statistics, using defaults')
        }
        
        return {
            memoryCache: {
                cacheSize: this.memoryCache.size,
                totalCachedMatches: Array.from(this.memoryCache.values())
                    .reduce((sum, set) => sum + set.size, 0),
            },
            localStorage: {
                filePath: this.config.localFilePath,
                trackingDir: this.config.trackingDir
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

        // Note: Drive cleanup is handled by the customMatchDeduplicationDriveService
        const removedFromDrive = 0

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

    /**
     * Validate system health and functionality
     */
    async validateSystemHealth(): Promise<{
        memoryCache: boolean
        localFile: boolean  
        driveAccess: boolean
        issues: string[]
    }> {
        const issues: string[] = []
        
        // Check memory cache
        const memoryOk = this.memoryCache.size > 0
        if (!memoryOk) issues.push('Memory cache is empty')
        
        // Check local file
        let localOk = false
        try {
            await this.loadLocalDeduplicationData()
            localOk = true
        } catch (error: any) {
            issues.push(`Local file inaccessible: ${error.message}`)
        }
        
        // Check Drive access using deduplication service
        let driveOk = false
        try {
            // Test Drive access by getting recent dates (this will test connection)
            await customMatchDeduplicationDriveService.getProcessedMatchIds('2024-01-01')
            driveOk = true
        } catch (error: any) {
            issues.push(`Drive inaccessible: ${error.message}`)
        }
        
        return {
            memoryCache: memoryOk,
            localFile: localOk,
            driveAccess: driveOk,
            issues
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
     * Get existing match IDs for a date using hierarchical fallback chain:
     * Memory (fastest) → Local File (persistent) → Drive (backup) → Empty Set
     */
    private async getExistingMatchIds(dateKey: string): Promise<Set<string>> {
        // LEVEL 1: Check memory cache first (fastest - sub-millisecond)
        const cached = this.memoryCache.get(dateKey)
        if (cached) {
            return new Set(cached)
        }

        // LEVEL 2: Try local file (fast - few milliseconds, survives restarts)
        try {
            const localData = await this.loadLocalDeduplicationData()
            const matchIds = new Set(localData.processedMatches[dateKey] || [])
            
            if (matchIds.size > 0) {
                // Cache in memory for future lookups
                this.updateMemoryCache(dateKey, matchIds)
                return matchIds
            }
        } catch (localError) {
            // Local file read failed, fall back to Drive
        }

        // LEVEL 3: Try Drive using deduplication service (slower - network call, but authoritative)
        try {
            const matchIds = await customMatchDeduplicationDriveService.getProcessedMatchIds(dateKey)
            
            if (matchIds.size > 0) {
                // Cache in memory for future use
                this.updateMemoryCache(dateKey, matchIds)
                return matchIds
            }
        } catch (driveError) {
            // Drive access failed, return empty set
        }

        // All sources failed - return empty set (new date or complete failure)
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
                    'Failed to update local file - persistence at risk'
                )
                // Don't re-throw to maintain graceful degradation in production
            })
        )
        
        // 3. Update Drive (backup/sync)
        writePromises.push(
            this.saveToDrive(dateKey, existingIds).catch(driveError => {
                logger.warn(
                    { error: driveError, dateKey, matchIds: newUniqueIds.length, feature: 'match-deduplication' },
                    'Failed to save to Drive - local persistence still works'
                )
                // Don't re-throw to maintain graceful degradation in production
            })
        )
        
        // Wait for both file operations to complete
        await Promise.all(writePromises)
    }

    /**
     * Save match IDs to Drive using deduplication service
     */
    private async saveToDrive(dateKey: string, matchIds: Set<string>): Promise<void> {
        try {
            // Use the proper deduplication service to record processed matches
            await customMatchDeduplicationDriveService.recordProcessedMatchIds(dateKey, Array.from(matchIds))
        } catch (error) {
            logger.error(
                { error, dateKey, matchCount: matchIds.size, feature: 'match-deduplication' },
                'Failed to save match IDs to Drive service'
            )
            throw error
        }
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
                

            } else {
                break // Safety break if we can't find a suitable key to remove
            }
        }
        
        // Remove existing entry and re-add (LRU behavior)
        this.memoryCache.delete(dateKey)
        this.memoryCache.set(dateKey, matchIds)
        

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
            // Get recent dates for syncing
            const recentDates = this.getRecentDates(7)
            let syncedDates = 0
            
            for (const dateKey of recentDates) {
                try {
                    // Use the proper deduplication Drive service
                    const driveMatchIds = await customMatchDeduplicationDriveService.getProcessedMatchIds(dateKey)
                    
                    if (driveMatchIds.size > 0) {
                        // Update memory cache with Drive data
                        this.updateMemoryCache(dateKey, driveMatchIds)
                        
                        // Also update local file to stay in sync
                        await this.mergeDriveDataToLocal(dateKey, driveMatchIds)
                        syncedDates++
                    }
                } catch (error: any) {
                    // Drive sync failed for this date, continue with others
                }
            }
            
            logger.info(
                { syncedDates, totalRecentDates: recentDates.length, feature: 'match-deduplication' },
                'Background Drive sync completed using deduplication service'
            )
        } catch (error) {
            logger.warn(
                { error, feature: 'match-deduplication' },
                'Background Drive sync failed'
            )
        }
    }

    /**
     * Perform a complete sync with Drive to download all historical deduplication data
     * This is used during initial startup when local data is empty or significantly outdated
     */
    private async fullSyncWithDrive(): Promise<void> {
        try {
            logger.info('Starting full Drive sync to download all historical deduplication data')
            
            // Try to get the complete Drive file directly (more efficient than date-by-date)
            try {
                // Access the private loadDeduplicationData method through the service
                // This downloads the entire deduplication dataset from Drive
                const driveData = await (customMatchDeduplicationDriveService as any).loadDeduplicationData()
                
                if (driveData && driveData.processedMatches) {
                    const totalMatches = Object.values(driveData.processedMatches).reduce(
                        (sum: number, matchIds: unknown) => sum + (matchIds as string[]).length, 
                        0
                    )
                    
                    logger.info(
                        { 
                            totalDates: Object.keys(driveData.processedMatches).length,
                            totalMatches,
                            schemaVersion: driveData.metadata?.schemaVersion,
                            lastUpdated: driveData.metadata?.lastUpdated,
                            feature: 'match-deduplication' 
                        },
                        'Downloaded complete Drive deduplication dataset'
                    )
                    
                    // Replace local file with complete Drive data
                    await this.saveLocalDeduplicationData(driveData)
                    
                    // Update memory cache with all dates
                    for (const [dateKey, matchIds] of Object.entries(driveData.processedMatches)) {
                        this.updateMemoryCache(dateKey, new Set(matchIds as string[]))
                    }
                    
                    logger.info(
                        { 
                            memoryCacheDates: this.memoryCache.size,
                            memoryCacheMatches: Array.from(this.memoryCache.values()).reduce((sum, set) => sum + set.size, 0),
                            feature: 'match-deduplication' 
                        },
                        'Full Drive sync completed successfully'
                    )
                    return
                }
            } catch (directDownloadError: any) {
                // Direct Drive download failed, fall back to date-by-date sync
            }
            
            // Fallback: Date-by-date sync with extended range (last 90 days to capture more historical data)
            logger.info('Falling back to extended date-by-date sync (90 days)')
            const extendedDates = this.getRecentDates(90)
            let syncedDates = 0
            let totalMatches = 0
            
            for (const dateKey of extendedDates) {
                try {
                    const driveMatchIds = await customMatchDeduplicationDriveService.getProcessedMatchIds(dateKey)
                    
                    if (driveMatchIds.size > 0) {
                        this.updateMemoryCache(dateKey, driveMatchIds)
                        await this.mergeDriveDataToLocal(dateKey, driveMatchIds)
                        syncedDates++
                        totalMatches += driveMatchIds.size
                        

                    }
                } catch (error: any) {
                    // Failed to sync this date, continue with others
                }
            }
            
            logger.info(
                { 
                    syncedDates, 
                    totalMatches,
                    searchedDays: extendedDates.length,
                    feature: 'match-deduplication' 
                },
                'Extended Drive sync completed'
            )
            
        } catch (error) {
            logger.error(
                { error, feature: 'match-deduplication' },
                'Full Drive sync failed'
            )
            throw error
        }
    }

    /**
     * Merge Drive data into local file without duplicates
     */
    private async mergeDriveDataToLocal(dateKey: string, driveMatchIds: Set<string>): Promise<void> {
        try {
            const localData = await this.loadLocalDeduplicationData()
            const existingIds = new Set(localData.processedMatches[dateKey] || [])
            
            // Find new IDs from Drive that aren't in local file
            const newIds: string[] = []
            for (const id of driveMatchIds) {
                if (!existingIds.has(id)) {
                    newIds.push(id)
                }
            }
            
            // If there are new IDs, merge them into local data
            if (newIds.length > 0) {
                localData.processedMatches[dateKey] = [
                    ...(localData.processedMatches[dateKey] || []),
                    ...newIds
                ]
                
                await this.saveLocalDeduplicationData(localData)
            }
        } catch (error) {
            logger.warn(
                { error, dateKey, feature: 'match-deduplication' },
                'Failed to merge Drive data to local file'
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

// Export singleton instance
export const matchDeduplicator = new MatchDeduplicator()