/**
 * Custom Match Deduplication Drive Service
 *
 * Provides persistent deduplication tracking using Google Drive storage.
 * Uses a single JSON file with date-keyed map structure to minimize API calls
 * and efficiently track processed match IDs across all dates.
 */

import { google } from 'googleapis'
import { detectAppEnv } from '../../shared/runtimeEnv'
import logger from '../logging/logger'
import { getH2HConfig } from '../config/h2hConfig'

/**
 * Structure of the deduplication data file (shared with local service)
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
 * Configuration for Drive-based deduplication
 */
interface DeduplicationDriveConfig {
    /** Base folder name for deduplication files */
    baseFolderName: string
    /** Single JSON file name for all deduplication data */
    fileName: string
    /** Days to retain old date entries */
    retentionDays: number
}

/**
 * Get default configuration using centralized H2H config
 */
function getDefaultDedupeDriveConfig(): DeduplicationDriveConfig {
    const h2hConfig = getH2HConfig()
    return {
        baseFolderName: 'CustomMatchDeduplication',
        fileName: 'processed-matches-map.json',
        retentionDays: h2hConfig.dedupeRetentionDays,
    }
}

/**
 * Drive-based deduplication service
 */
export class CustomMatchDeduplicationDriveService {
    private config: DeduplicationDriveConfig
    private folderName: string
    private folderId: string | null = null
    private cachedData: DeduplicationData | null = null
    private lastCacheTime: number = 0
    private readonly CACHE_TTL_MS = 30000 // 30 seconds cache TTL

    constructor(config: Partial<DeduplicationDriveConfig> = {}) {
        this.config = { ...getDefaultDedupeDriveConfig(), ...config }
        this.folderName = `${this.config.baseFolderName}_${detectAppEnv()}`
    }

    /**
     * Load processed match IDs for a specific date from Drive
     */
    async getProcessedMatchIds(dateKey: string): Promise<Set<string>> {
        try {
            const dedupeData = await this.loadDeduplicationData()
            const matchIds = dedupeData.processedMatches[dateKey] || []
            


            return new Set(matchIds)
        } catch (error) {
            logger.warn(
                {
                    error,
                    feature: 'custom-match-deduplication-drive',
                    date: dateKey,
                },
                'Failed to load processed match IDs from Drive'
            )
            return new Set()
        }
    }

    /**
     * Add new processed match IDs to the map in Drive
     */
    async recordProcessedMatchIds(dateKey: string, matchIds: string[]): Promise<void> {
        if (matchIds.length === 0) {
            return
        }

        try {
            // Load current data
            const dedupeData = await this.loadDeduplicationData()
            
            // Add new match IDs to the date key (avoiding duplicates)
            const existingIds = new Set(dedupeData.processedMatches[dateKey] || [])
            const newUniqueIds = matchIds.filter(id => !existingIds.has(id))
            
            if (newUniqueIds.length > 0) {
                dedupeData.processedMatches[dateKey] = [
                    ...(dedupeData.processedMatches[dateKey] || []),
                    ...newUniqueIds
                ]
                
                // Update metadata
                dedupeData.metadata.lastUpdated = new Date().toISOString()
                dedupeData.metadata.totalDates = Object.keys(dedupeData.processedMatches).length
                dedupeData.metadata.totalMatches = Object.values(dedupeData.processedMatches)
                    .reduce((sum, matches) => sum + matches.length, 0)
                
                // Save back to Drive
                await this.saveDeduplicationData(dedupeData)
            }
            

        } catch (error) {
            logger.error(
                {
                    error,
                    feature: 'custom-match-deduplication-drive',
                    date: dateKey,
                    matchCount: matchIds.length,
                },
                'Failed to record processed match IDs to Drive'
            )
            throw error
        }
    }

    /**
     * Clean up old date entries from the deduplication map beyond retention period
     */
    async cleanupOldFiles(): Promise<void> {
        try {
            // Load current data
            const dedupeData = await this.loadDeduplicationData()
            
            // Calculate cutoff date
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)
            const cutoffDateKey = cutoffDate.toISOString().split('T')[0]
            
            // Count entries before cleanup

            const matchesBefore = Object.values(dedupeData.processedMatches)
                .reduce((sum, matches) => sum + matches.length, 0)
            
            // Filter out old entries
            const filteredMatches: Record<string, string[]> = {}
            let removedEntries = 0
            let removedMatches = 0
            
            for (const [dateKey, matches] of Object.entries(dedupeData.processedMatches)) {
                if (dateKey >= cutoffDateKey) {
                    filteredMatches[dateKey] = matches
                } else {
                    removedEntries++
                    removedMatches += matches.length
                }
            }
            
            // Update and save if anything was removed
            if (removedEntries > 0) {
                dedupeData.processedMatches = filteredMatches
                await this.saveDeduplicationData(dedupeData)
                
                logger.info(
                    {
                        feature: 'custom-match-deduplication-drive',
                        removedEntries,
                        removedMatches,
                        remainingEntries: Object.keys(filteredMatches).length,
                        remainingMatches: matchesBefore - removedMatches,
                        cutoffDate: cutoffDateKey,
                    },
                    'Cleaned up old deduplication entries'
                )
            }
        } catch (error) {
            logger.error(
                {
                    error,
                    feature: 'custom-match-deduplication-drive',
                },
                'Failed to cleanup old deduplication entries'
            )
        }
    }

    /**
     * Get statistics about stored deduplication data
     */
    async getStats(): Promise<{
        totalFiles: number
        dateRange: { earliest: string; latest: string } | null
        recentFiles: Array<{ date: string; matchCount: number }>
    }> {
        try {
            const dedupeData = await this.loadDeduplicationData()
            
            const dates = Object.keys(dedupeData.processedMatches).sort()
            const recentFiles: Array<{ date: string; matchCount: number }> = []
            
            // Get the last 5 dates for recent files info
            const recentDates = dates.slice(-5)
            for (const date of recentDates) {
                const matchCount = dedupeData.processedMatches[date]?.length || 0
                recentFiles.push({ date, matchCount })
            }

            return {
                totalFiles: 1, // Single JSON file approach
                dateRange: dates.length > 0 ? {
                    earliest: dates[0],
                    latest: dates[dates.length - 1]
                } : null,
                recentFiles: recentFiles.reverse(), // Most recent first
            }
        } catch (error) {
            logger.error(
                {
                    error,
                    feature: 'custom-match-deduplication-drive',
                },
                'Failed to get deduplication stats'
            )
            return {
                totalFiles: 0,
                dateRange: null,
                recentFiles: [],
            }
        }
    }

    /**
     * Load the complete deduplication data from Drive (with caching)
     */
    private async loadDeduplicationData(): Promise<DeduplicationData> {
        // Check cache first
        const now = Date.now()
        if (this.cachedData && (now - this.lastCacheTime) < this.CACHE_TTL_MS) {
            return this.cachedData
        }

        try {
            await this.ensureFolder()
            const content = await this.getFileContent(this.config.fileName)
            
            let dedupeData: DeduplicationData
            
            if (content) {
                dedupeData = JSON.parse(content)
                // Validate structure
                if (!dedupeData.metadata || !dedupeData.processedMatches) {
                    throw new Error('Invalid deduplication data structure')
                }
            } else {
                // Create empty structure
                dedupeData = {
                    metadata: {
                        schemaVersion: '1.0.0',
                        lastUpdated: new Date().toISOString(),
                        totalDates: 0,
                        totalMatches: 0,
                    },
                    processedMatches: {}
                }
            }

            // Update cache
            this.cachedData = dedupeData
            this.lastCacheTime = now

            return dedupeData
        } catch (error) {
            logger.error(
                {
                    error,
                    feature: 'custom-match-deduplication-drive',
                },
                'Failed to load deduplication data'
            )
            throw error
        }
    }

    /**
     * Save the complete deduplication data to Drive
     */
    private async saveDeduplicationData(dedupeData: DeduplicationData): Promise<void> {
        try {
            await this.ensureFolder()
            
            // Update metadata (no filtering during regular saves - only during cleanup)
            dedupeData.metadata.totalDates = Object.keys(dedupeData.processedMatches).length
            dedupeData.metadata.totalMatches = Object.values(dedupeData.processedMatches)
                .reduce((sum, matches) => sum + matches.length, 0)
            dedupeData.metadata.lastUpdated = new Date().toISOString()
            
            // Convert to JSON
            const content = JSON.stringify(dedupeData, null, 2)
            
            // Upload to Drive
            await this.uploadFile(this.config.fileName, content)
            
            // Update cache
            this.cachedData = dedupeData
            this.lastCacheTime = Date.now()
            

        } catch (error) {
            logger.error(
                {
                    error,
                    feature: 'custom-match-deduplication-drive',
                },
                'Failed to save deduplication data'
            )
            throw error
        }
    }

    /**
     * Ensure the deduplication folder exists in Drive
     */
    private async ensureFolder(): Promise<void> {
        if (this.folderId) {
            return
        }

        try {
            await this.authenticateGoogleDrive()
            const drive = google.drive({ version: 'v3' })
            
            // Check if folder already exists
            const searchResponse = await drive.files.list({
                q: `name='${this.folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id,name)',
            })

            if (searchResponse.data.files && searchResponse.data.files.length > 0) {
                this.folderId = searchResponse.data.files[0].id!
                return
            }

            // Create folder if it doesn't exist
            const createResponse = await drive.files.create({
                requestBody: {
                    name: this.folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                },
                fields: 'id',
            })

            this.folderId = createResponse.data.id!
            
            logger.info(
                {
                    feature: 'custom-match-deduplication-drive',
                    folderName: this.folderName,
                    folderId: this.folderId,
                },
                'Created deduplication folder in Drive'
            )
        } catch (error) {
            logger.error(
                {
                    error,
                    feature: 'custom-match-deduplication-drive',
                    folderName: this.folderName,
                },
                'Failed to ensure deduplication folder'
            )
            throw error
        }
    }

    /**
     * Get file content from Drive
     */
    private async getFileContent(fileName: string): Promise<string | null> {
        try {
            await this.authenticateGoogleDrive()
            const drive = google.drive({ version: 'v3' })
            
            // Find file by name
            const searchResponse = await drive.files.list({
                q: `'${this.folderId}' in parents and name='${fileName}' and trashed=false`,
                fields: 'files(id)',
            })

            if (!searchResponse.data.files || searchResponse.data.files.length === 0) {
                return null
            }

            const fileId = searchResponse.data.files[0].id!
            
            // Get file content
            const getResponse = await drive.files.get({
                fileId,
                alt: 'media',
            }, {
                responseType: 'text', // Important: specify text response type
            })

            return getResponse.data as string
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
                return null // File not found
            }
            throw error
        }
    }

    /**
     * Upload file content to Drive
     */
    private async uploadFile(fileName: string, content: string): Promise<void> {
        await this.authenticateGoogleDrive()
        const drive = google.drive({ version: 'v3' })
        
        // Check if file already exists
        const searchResponse = await drive.files.list({
            q: `'${this.folderId}' in parents and name='${fileName}' and trashed=false`,
            fields: 'files(id)',
        })

        const media = {
            mimeType: 'application/json',
            body: content,
        }

        if (searchResponse.data.files && searchResponse.data.files.length > 0) {
            // Update existing file
            const fileId = searchResponse.data.files[0].id!
            await drive.files.update({
                fileId,
                media,
            })
        } else {
            // Create new file
            await drive.files.create({
                requestBody: {
                    name: fileName,
                    parents: [this.folderId!],
                },
                media,
            })
        }
    }

    /**
     * Authenticate with Google Drive (reusing existing patterns)
     */
    private async authenticateGoogleDrive(): Promise<void> {
        try {
            const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}')

            const auth = new google.auth.GoogleAuth({
                credentials: SERVICE_ACCOUNT_KEY,
                scopes: ['https://www.googleapis.com/auth/drive'],
            })

            const client = await auth.getClient()
            google.options({ auth: client as any })
        } catch (error) {
            logger.error(
                { error, feature: 'custom-match-deduplication-drive' },
                'Failed to authenticate with Google Drive'
            )
            throw error
        }
    }
}

// Create singleton instance
export const customMatchDeduplicationDriveService = new CustomMatchDeduplicationDriveService()