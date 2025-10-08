/**
 * Custom Match Drive Storage Service
 *
 * Handles date-partitioned JSON file storage for custom matches using
 * exi    async getMatches(dateKey: string):     async listAvailableDates(): Promise<string[]> {
        try {
            await this.driveService.ensureFolder()

            const files = await this.driveService.listFiles()se<ProcessedCustomMatch[]> {
        try {
            await this.driveService.ensureFolder()

            const fileName = this.config.fileNamePattern.replace('{date}', dateKey)
            const fileContent = await this.driveService.readFile(fileName)Google Drive integration patterns. Creates one file per day
 * with structured JSON records for each match.
 */


import logger from '../logging/logger'
import { getH2HConfig } from '../config/h2hConfig'
import { GoogleDriveService } from './googleApi'
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
}

/**
 * Default storage configuration
 */
const DEFAULT_STORAGE_CONFIG: CustomMatchStorageConfig = {
    baseFolderName: 'CustomMatches',
    fileNamePattern: 'custom-matches-{date}.json',
    maxMatchesPerFile: 1000, // Will be overridden by H2HConfig
}

/**
 * Custom match storage service using Google Drive
 */
export class CustomMatchStorageService {
    private config: CustomMatchStorageConfig
    private driveService: GoogleDriveService

    constructor(config: Partial<CustomMatchStorageConfig> = {}) {
        const h2hConfig = getH2HConfig()
        this.config = { 
            ...DEFAULT_STORAGE_CONFIG, 
            ...config,
            maxMatchesPerFile: h2hConfig.maxMatchesPerFile,
        }
        this.driveService = new GoogleDriveService(
            this.config.baseFolderName, 
            'custom-match-storage',
            true // use environment suffix
        )
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
        await this.driveService.ensureFolder()

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
            await this.driveService.ensureFolder()

            const fileName = this.config.fileNamePattern.replace('{date}', dateKey)
            
            try {
                const content = await this.driveService.readFile(fileName)
                const data = JSON.parse(content)
                return data.matches || []
            } catch (fileError) {
                // File doesn't exist, return empty array
                return []
            }
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
            await this.driveService.ensureFolder()

            const files = await this.driveService.listFiles()
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
                folderName: this.config.baseFolderName,
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
                folderName: this.config.baseFolderName,
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

        const jsonContent = JSON.stringify(fileContent, null, 2)

        // Upload to Drive
        await this.driveService.writeFile(fileName, jsonContent)


    }
}

// Export singleton instance
export const customMatchStorageService = new CustomMatchStorageService()
