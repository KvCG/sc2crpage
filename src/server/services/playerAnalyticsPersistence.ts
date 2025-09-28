import { google } from 'googleapis'
import { DateTime } from 'luxon'
import logger from '../logging/logger'
import { SnapshotResponse } from './snapshotService'
import { detectAppEnv } from '../../shared/runtimeEnv'

/**
 * Player Analytics Persistence Service
 * 
 * Extends existing Google Drive integration for automated backup
 * and disaster recovery of player analytics data.
 * 
 * Features:
 * - Automatic snapshot backup with 90-day retention
 * - Disaster recovery restore capabilities  
 * - Structured folder organization by date
 * - JSON file format for easy inspection and restoration
 */

const ANALYTICS_FOLDER_NAME = 'PlayerAnalytics_' + detectAppEnv()
const SNAPSHOTS_SUBFOLDER = 'Snapshots_' + detectAppEnv()
const RETENTION_DAYS = 90

export interface BackupMetadata {
    type: 'snapshot' | 'analytics' | 'deltas'
    timestamp: string
    playerCount: number
    dataSize: number
}

export interface RestoreOptions {
    maxAge?: number // Maximum age in hours, defaults to 24
    type?: 'snapshot' | 'analytics' | 'deltas'
}

export class PlayerAnalyticsPersistence {
    private static auth: any = null
    private static folderIds: Record<string, string> = {}

    /**
     * Initialize Google Drive authentication using existing service account
     */
    private static async authenticate(): Promise<any> {
        if (this.auth) return this.auth

        try {
            const SERVICE_ACCOUNT_KEY = JSON.parse(
                process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'
            )

            const auth = new google.auth.GoogleAuth({
                credentials: SERVICE_ACCOUNT_KEY,
                scopes: ['https://www.googleapis.com/auth/drive']
            })

            this.auth = await auth.getClient()
            google.options({ auth: this.auth })

            logger.info({ feature: 'persistence' }, 'Google Drive authentication initialized')
            return this.auth
        } catch (error) {
            logger.error({ error, feature: 'persistence' }, 'Failed to authenticate with Google Drive')
            throw error
        }
    }

    /**
     * Get or create structured folder hierarchy for analytics data
     */
    private static async getOrCreateFolder(folderName: string, parentId?: string): Promise<string> {
        const cacheKey = parentId ? `${parentId}/${folderName}` : folderName
        
        if (this.folderIds[cacheKey]) {
            return this.folderIds[cacheKey]
        }

        const auth = await this.authenticate()
        const drive = google.drive({ version: 'v3', auth })

        // Build query for existing folder
        let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
        if (parentId) {
            query += ` and '${parentId}' in parents`
        }

        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name)'
        })

        if (response.data.files && response.data.files.length > 0) {
            const folderId = response.data.files[0].id!
            this.folderIds[cacheKey] = folderId
            return folderId
        }

        // Create new folder
        const fileMetadata: any = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        }

        if (parentId) {
            fileMetadata.parents = [parentId]
        }

        const folder = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id'
        })

        const folderId = folder.data.id!
        this.folderIds[cacheKey] = folderId

        logger.info({
            folderName,
            folderId,
            parentId,
            feature: 'persistence'
        }, 'Created Google Drive folder')

        return folderId
    }

    /**
     * Get folder structure for date-based organization
     */
    private static async getDateFolder(date: DateTime): Promise<string> {
        const rootFolder = await this.getOrCreateFolder(ANALYTICS_FOLDER_NAME)
        const snapshotsFolder = await this.getOrCreateFolder(SNAPSHOTS_SUBFOLDER, rootFolder)
        
        // Year folder (2025)
        const year = date.year.toString()
        const yearFolder = await this.getOrCreateFolder(year, snapshotsFolder)
        
        // Month folder (09-September)
        const month = date.toFormat('dd-MMMM')
        const monthFolder = await this.getOrCreateFolder(month, yearFolder)
        
        return monthFolder
    }

    /**
     * Backup snapshot data to Google Drive
     */
    static async backupSnapshot(snapshot: SnapshotResponse): Promise<string | null> {
        try {
            const auth = await this.authenticate()
            const drive = google.drive({ version: 'v3', auth })
            
            const timestamp = DateTime.fromISO(snapshot.createdAt)
            const dateFolder = await this.getDateFolder(timestamp)
            
            // Create filename with timestamp
            const fileName = `snapshot-${timestamp.toFormat('yyyy-MM-dd-HH-mm-ss')}.json`
            
            // Prepare backup data with metadata
            const backupData = {
                metadata: {
                    type: 'snapshot' as const,
                    timestamp: snapshot.createdAt,
                    playerCount: snapshot.data?.length || 0,
                    dataSize: JSON.stringify(snapshot.data).length,
                    backupVersion: '1.0'
                },
                snapshot
            }

            const fileMetadata = {
                name: fileName,
                parents: [dateFolder]
            }

            const media = {
                mimeType: 'application/json',
                body: JSON.stringify(backupData, null, 2)
            }

            const file = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id,name,size'
            })

            logger.info({
                fileId: file.data.id,
                fileName: file.data.name,
                size: file.data.size,
                playerCount: backupData.metadata.playerCount,
                feature: 'persistence'
            }, 'Snapshot backed up to Google Drive')

            return file.data.id!

        } catch (error) {
            logger.error({ error, feature: 'persistence' }, 'Failed to backup snapshot to Google Drive')
            return null
        }
    }

    /**
     * List available backups for restore operations
     */
    static async listBackups(options: RestoreOptions = {}): Promise<Array<{
        fileId: string
        fileName: string
        timestamp: DateTime
        metadata: BackupMetadata
    }>> {
        try {
            const auth = await this.authenticate()
            const drive = google.drive({ version: 'v3', auth })
            
            // Search for JSON files in the analytics folder tree recursively
            const query = `name contains 'snapshot-' and name contains '.json' and trashed=false`
            
            const response = await drive.files.list({
                q: query,
                fields: 'files(id, name, createdTime, size)',
                orderBy: 'createdTime desc'
            })

            const backups = []
            const maxAge = options.maxAge || 24
            const cutoffTime = DateTime.now().minus({ hours: maxAge })

            for (const file of response.data.files || []) {
                if (!file.id || !file.name || !file.createdTime) continue

                const fileTime = DateTime.fromISO(file.createdTime)
                
                // Skip files older than maxAge
                if (fileTime < cutoffTime) continue

                // Extract timestamp from filename
                const timestampMatch = file.name.match(/snapshot-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.json/)
                if (!timestampMatch) continue

                const timestamp = DateTime.fromFormat(timestampMatch[1], 'yyyy-MM-dd-HH-mm-ss')
                
                backups.push({
                    fileId: file.id,
                    fileName: file.name,
                    timestamp,
                    metadata: {
                        type: 'snapshot' as const,
                        timestamp: timestamp.toISO() || timestamp.toString(),
                        playerCount: 0, // Will be filled when file is actually read
                        dataSize: parseInt(file.size || '0')
                    }
                })
            }

            logger.info({
                backupCount: backups.length,
                maxAge,
                feature: 'persistence'
            }, 'Listed available backups')

            return backups.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis())

        } catch (error) {
            logger.error({ error, feature: 'persistence' }, 'Failed to list backups')
            return []
        }
    }

    /**
     * Restore snapshot from Google Drive backup
     */
    static async restoreSnapshot(fileId?: string, options: RestoreOptions = {}): Promise<SnapshotResponse | null> {
        try {
            const auth = await this.authenticate()
            const drive = google.drive({ version: 'v3', auth })

            let targetFileId = fileId
            
            if (!targetFileId) {
                // Find most recent backup
                const backups = await this.listBackups(options)
                if (backups.length === 0) {
                    logger.warn({ feature: 'persistence' }, 'No backups available for restore')
                    return null
                }
                targetFileId = backups[0].fileId
            }

            // Download and parse backup file
            const response = await drive.files.get({
                fileId: targetFileId,
                alt: 'media'
            })

            const backupData = JSON.parse(JSON.stringify(response.data))
            if (!backupData.snapshot || !backupData.metadata) {
                throw new Error('Invalid backup file format')
            }

            logger.info({
                fileId: targetFileId,
                timestamp: backupData.metadata.timestamp,
                playerCount: backupData.metadata.playerCount,
                feature: 'persistence'
            }, 'Snapshot restored from Google Drive backup')

            return backupData.snapshot as SnapshotResponse

        } catch (error) {
            logger.error({ error, fileId, feature: 'persistence' }, 'Failed to restore snapshot from backup')
            return null
        }
    }

    /**
     * Cleanup old backups based on retention policy
     */
    static async cleanupOldBackups(): Promise<number> {
        try {
            const auth = await this.authenticate()
            const drive = google.drive({ version: 'v3', auth })
            
            const cutoffDate = DateTime.now().minus({ days: RETENTION_DAYS })
            
            // Find files older than retention period
            const query = `name contains 'snapshot-' and name contains '.json' and createdTime < '${cutoffDate.toISO()}' and trashed=false`
            
            const response = await drive.files.list({
                q: query,
                fields: 'files(id, name, createdTime)'
            })

            const filesToDelete = response.data.files || []
            let deletedCount = 0

            for (const file of filesToDelete) {
                if (!file.id) continue

                try {
                    await drive.files.delete({ fileId: file.id })
                    deletedCount++
                    
                    logger.info({
                        fileId: file.id,
                        fileName: file.name,
                        createdTime: file.createdTime,
                        feature: 'persistence'
                    }, 'Deleted old backup file')
                } catch (deleteError) {
                    logger.warn({
                        error: deleteError,
                        fileId: file.id,
                        feature: 'persistence'
                    }, 'Failed to delete old backup file')
                }
            }

            if (deletedCount > 0) {
                logger.info({
                    deletedCount,
                    retentionDays: RETENTION_DAYS,
                    feature: 'persistence'
                }, 'Completed cleanup of old backups')
            }
            if(deletedCount === 0) {
                logger.info({
                    deletedCount,
                    retentionDays: RETENTION_DAYS,
                    feature: 'persistence'
                }, 'No old backups to delete')
            }
            return deletedCount

        } catch (error) {
            logger.error({ error, feature: 'persistence' }, 'Failed to cleanup old backups')
            return 0
        }
    }

    /**
     * Get status information about persistence layer
     */
    static async getStatus(): Promise<{
        connected: boolean
        folderStructure: Record<string, string>
        recentBackups: number
        totalBackups: number
    }> {
        try {
            await this.authenticate()
            
            const backups = await this.listBackups({ maxAge: 168 }) // Last week
            const allBackups = await this.listBackups({ maxAge: RETENTION_DAYS * 24 }) // All within retention
            
            return {
                connected: true,
                folderStructure: { ...this.folderIds },
                recentBackups: backups.length,
                totalBackups: allBackups.length
            }
        } catch (error) {
            logger.error({ error, feature: 'persistence' }, 'Failed to get persistence status')
            return {
                connected: false,
                folderStructure: {},
                recentBackups: 0,
                totalBackups: 0
            }
        }
    }
}