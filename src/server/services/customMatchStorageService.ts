/**
 * Custom Match Drive Storage Service
 *
 * Handles date-partitioned JSON file storage for custom matches using
 * existing Google Drive integration patterns. Creates one file per day
 * with structured JSON records for each match.
 */

import { google } from 'googleapis'

import { detectAppEnv } from '../../shared/runtimeEnv'
import logger from '../logging/logger'
import { ProcessedCustomMatch } from '../../shared/customMatchTypes'

/**
 * Configuration for custom match storage
 */
interface CustomMatchStorageConfig {
    /** Base folder name pattern (will be suffixed with environment) */
    baseFolderName: string
    /** File name pattern for daily files */
    fileNamePattern: string
    /** Maximum matches per file before creating new file */
    maxMatchesPerFile: number
    /** Whether to compress JSON output */
    compressOutput: boolean
}

/**
 * Default storage configuration
 */
const DEFAULT_STORAGE_CONFIG: CustomMatchStorageConfig = {
    baseFolderName: 'CustomMatches',
    fileNamePattern: 'custom-matches-{date}.json',
    maxMatchesPerFile: Number(process.env.H2H_MAX_MATCHES_PER_FILE) || 1000,
    compressOutput: false,
}

/**
 * Custom match storage service using Google Drive
 */
export class CustomMatchStorageService {
    private config: CustomMatchStorageConfig
    private folderName: string
    private folderId: string | null = null

    constructor(config: Partial<CustomMatchStorageConfig> = {}) {
        this.config = { ...DEFAULT_STORAGE_CONFIG, ...config }
        this.folderName = `${this.config.baseFolderName}_${detectAppEnv()}`
    }

    /**
     * Store processed matches to Drive, partitioned by date
     */
    async storeMatches(matches: ProcessedCustomMatch[]): Promise<{
        filesWritten: number
        matchesStored: number
        errors: Array<{ date: string; error: string }>
    }> {
        const result = {
            filesWritten: 0,
            matchesStored: 0,
            errors: [] as Array<{ date: string; error: string }>,
        }

        if (matches.length === 0) {
            return result
        }

        // Group matches by date for partitioned storage
        const matchesByDate = this.groupMatchesByDate(matches)

        // Ensure folder exists
        await this.ensureFolder()

        // Process each date partition
        for (const [dateKey, dateMatches] of matchesByDate) {
            try {
                await this.storeDateMatches(dateKey, dateMatches)
                result.filesWritten++
                result.matchesStored += dateMatches.length

                logger.info(
                    {
                        feature: 'custom-match-storage',
                        date: dateKey,
                        matchCount: dateMatches.length,
                    },
                    'Matches stored successfully'
                )
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                result.errors.push({ date: dateKey, error: errorMessage })

                logger.error(
                    {
                        error,
                        feature: 'custom-match-storage',
                        date: dateKey,
                        matchCount: dateMatches.length,
                    },
                    'Failed to store matches for date'
                )
            }
        }

        logger.info(
            {
                feature: 'custom-match-storage',
                filesWritten: result.filesWritten,
                matchesStored: result.matchesStored,
                errors: result.errors.length,
            },
            'Match storage operation completed'
        )

        return result
    }

    /**
     * Retrieve matches for a specific date
     */
    async getMatches(dateKey: string): Promise<ProcessedCustomMatch[]> {
        try {
            await this.ensureFolder()

            const fileName = this.config.fileNamePattern.replace('{date}', dateKey)
            const content = await this.getFileContent(fileName)

            if (!content) {
                return []
            }

            const data = JSON.parse(content)
            return data.matches || []
        } catch (error) {
            logger.error(
                {
                    error: error instanceof Error ? {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    } : error,
                    feature: 'custom-match-storage',
                    date: dateKey,
                    folderId: this.folderId,
                },
                'Failed to retrieve matches for date'
            )
            return []
        }
    }

    /**
     * List all available date keys (files)
     */
    async listAvailableDates(): Promise<string[]> {
        try {
            await this.ensureFolder()

            const files = await this.listFolderFiles()
            const dateKeys: string[] = []

            for (const file of files) {
                const match = file.name?.match(/custom-matches-(\d{4}-\d{2}-\d{2})\.json/)
                if (match) {
                    dateKeys.push(match[1])
                }
            }

            return dateKeys.sort()
        } catch (error) {
            logger.error(
                { error, feature: 'custom-match-storage' },
                'Failed to list available dates'
            )
            return []
        }
    }

    /**
     * Get storage statistics
     */
    async getStorageStats() {
        try {
            const dates = await this.listAvailableDates()
            let totalMatches = 0
            const dateStats: Array<{ date: string; matchCount: number }> = []

            // Sample a few recent dates for match counts
            const recentDates = dates.slice(-5)
            for (const date of recentDates) {
                const matches = await this.getMatches(date)
                totalMatches += matches.length
                dateStats.push({ date, matchCount: matches.length })
            }

            return {
                totalFiles: dates.length,
                sampledMatches: totalMatches,
                dateRange:
                    dates.length > 0
                        ? {
                              earliest: dates[0],
                              latest: dates[dates.length - 1],
                          }
                        : null,
                recentDateStats: dateStats,
                folderName: this.folderName,
            }
        } catch (error) {
            logger.error(
                { error, feature: 'custom-match-storage' },
                'Failed to get storage statistics'
            )
            return {
                totalFiles: 0,
                sampledMatches: 0,
                dateRange: null,
                recentDateStats: [],
                folderName: this.folderName,
            }
        }
    }

    // ========================================================================
    // Private Helper Methods
    // ========================================================================

    /**
     * Group matches by their date key
     */
    private groupMatchesByDate(
        matches: ProcessedCustomMatch[]
    ): Map<string, ProcessedCustomMatch[]> {
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
     * Store matches for a specific date
     */
    private async storeDateMatches(
        dateKey: string,
        matches: ProcessedCustomMatch[]
    ): Promise<void> {
        const fileName = this.config.fileNamePattern.replace('{date}', dateKey)

        // Check if file already exists and load existing matches
        let existingMatches: ProcessedCustomMatch[] = []
        try {
            existingMatches = await this.getMatches(dateKey)
        } catch (error) {
            // File doesn't exist yet, that's fine
        }

        // Merge new matches with existing ones (avoiding duplicates by matchId)
        const existingMatchIds = new Set(existingMatches.map((m) => m.matchId))
        const newMatches = matches.filter((m) => !existingMatchIds.has(m.matchId))
        const allMatches = [...existingMatches, ...newMatches]

        // Create file content with metadata
        const fileContent = {
            metadata: {
                date: dateKey,
                matchCount: allMatches.length,
                lastUpdated: new Date().toISOString(),
                schemaVersion: '1.0.0',
            },
            matches: allMatches,
        }

        const jsonContent = this.config.compressOutput
            ? JSON.stringify(fileContent)
            : JSON.stringify(fileContent, null, 2)

        // Upload to Drive
        await this.uploadFile(fileName, jsonContent)


    }

    /**
     * Ensure the storage folder exists in Drive
     */
    private async ensureFolder(): Promise<void> {
        if (this.folderId) {
            return
        }

        try {
            // Use existing Drive authentication patterns
            await this.authenticateGoogleDrive()

            const drive = google.drive({ version: 'v3' })

            // Search for existing folder
            const response = await drive.files.list({
                q: `name='${this.folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                spaces: 'drive',
            })

            if (response.data.files && response.data.files.length > 0) {
                this.folderId = response.data.files[0].id!
            } else {
                // Create new folder
                const createResponse = await drive.files.create({
                    requestBody: {
                        name: this.folderName,
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                })
                this.folderId = createResponse.data.id!
            }

            logger.info(
                {
                    feature: 'custom-match-storage',
                    folderName: this.folderName,
                    folderId: this.folderId,
                },
                'Storage folder initialized'
            )
        } catch (error) {
            logger.error(
                { error, folderName: this.folderName, feature: 'custom-match-storage' },
                'Failed to ensure storage folder'
            )
            throw error
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
                { error, feature: 'custom-match-storage' },
                'Failed to authenticate with Google Drive'
            )
            throw error
        }
    }

    /**
     * Upload file content to Drive
     */
    private async uploadFile(fileName: string, content: string): Promise<void> {
        const drive = google.drive({ version: 'v3' })

        // Check if file already exists
        const existingFile = await this.findFile(fileName)

        // Import Readable for stream-based upload
        const { Readable } = await import('stream')
        const contentStream = Readable.from([content])

        if (existingFile) {
            // Update existing file
            await drive.files.update({
                fileId: existingFile.id!,
                media: {
                    mimeType: 'application/json',
                    body: contentStream,
                },
            })
        } else {
            // Create new file
            await drive.files.create({
                requestBody: {
                    name: fileName,
                    parents: [this.folderId!],
                    mimeType: 'application/json',
                },
                media: {
                    mimeType: 'application/json',
                    body: contentStream,
                },
            })
        }
    }

    /**
     * Get file content from Drive
     */
    private async getFileContent(fileName: string): Promise<string | null> {
        try {
            const file = await this.findFile(fileName)
            if (!file) {
                return null
            }

            const drive = google.drive({ version: 'v3' })
            const response = await drive.files.get({
                fileId: file.id!,
                alt: 'media',
            }, {
                responseType: 'text'  // Force response as text
            })

            // Handle different response formats from Google Drive API
            const rawData = response.data as any
            let content: string
            
            if (Buffer.isBuffer(rawData)) {
                content = rawData.toString('utf8')
            } else if (typeof rawData === 'string') {
                content = rawData
            } else {
                content = String(rawData)
            }

            return content
        } catch (error) {
            logger.error(
                {
                    error: error instanceof Error ? {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    } : error,
                    feature: 'custom-match-storage',
                    fileName,
                },
                'Failed to get file content from Drive'
            )
            throw error
        }
    }

    /**
     * Find a file in the storage folder
     */
    private async findFile(fileName: string): Promise<any> {
        const drive = google.drive({ version: 'v3' })

        const response = await drive.files.list({
            q: `name='${fileName}' and parents in '${this.folderId}' and trashed=false`,
            spaces: 'drive',
        })

        return response.data.files?.[0] || null
    }

    /**
     * List all files in the storage folder
     */
    private async listFolderFiles(): Promise<any[]> {
        const drive = google.drive({ version: 'v3' })

        const response = await drive.files.list({
            q: `parents in '${this.folderId}' and trashed=false`,
            spaces: 'drive',
        })

        return response.data.files || []
    }
}

// Export singleton instance
export const customMatchStorageService = new CustomMatchStorageService()

// Export factory function for testing with custom configuration
export function createCustomMatchStorageService(
    config?: Partial<CustomMatchStorageConfig>
): CustomMatchStorageService {
    return new CustomMatchStorageService(config)
}
