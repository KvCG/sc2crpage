import { google } from 'googleapis'
import path from 'path'
import fs from 'fs'
import logger from '../logging/logger'
import { detectAppEnv } from '../../shared/runtimeEnv'

/**
 * Google Drive File Storage Service
 * 
 * Replaces Firebase Storage for ladder CSV file operations.
 * Uses environment-aware folder structure: RankedPlayers_{Env}/ladderCR.csv
 * 
 * Reuses existing Google Drive authentication patterns from playerAnalyticsPersistence
 * and googleApi services for consistency.
 */

const RANKED_PLAYERS_FOLDER_NAME = 'RankedPlayers_' + detectAppEnv()

export class DriveFileStorage {
    private static auth: any = null
    private static folderId: string | null = null

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

            logger.info({ feature: 'drive-storage' }, 'Google Drive authentication initialized')
            return this.auth
        } catch (error) {
            logger.error({ error, feature: 'drive-storage' }, 'Failed to authenticate with Google Drive')
            throw error
        }
    }

    /**
     * Get or create the RankedPlayers folder
     */
    private static async getRankedPlayersFolder(): Promise<string> {
        if (this.folderId) return this.folderId

        const auth = await this.authenticate()
        const drive = google.drive({ version: 'v3', auth })

        // Check if folder exists
        const response = await drive.files.list({
            q: `name='${RANKED_PLAYERS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id, name)'
        })

        if (response.data.files && response.data.files.length > 0) {
            this.folderId = response.data.files[0].id!
            logger.info({ 
                folderName: RANKED_PLAYERS_FOLDER_NAME, 
                folderId: this.folderId,
                feature: 'drive-storage' 
            }, 'Found existing RankedPlayers folder')
            return this.folderId
        }

        // Create new folder
        const fileMetadata = {
            name: RANKED_PLAYERS_FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
        }

        const folder = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id'
        })

        this.folderId = folder.data.id!
        logger.info({ 
            folderName: RANKED_PLAYERS_FOLDER_NAME, 
            folderId: this.folderId,
            feature: 'drive-storage' 
        }, 'Created new RankedPlayers folder')

        return this.folderId
    }

    /**
     * Upload file to Google Drive storage
     * Replaces fbFileManagement.uploadFile()
     */
    static async uploadFile(
        buffer: Buffer,
        fileName: string,
        contentType: string
    ): Promise<void> {
        try {
            const auth = await this.authenticate()
            const drive = google.drive({ version: 'v3', auth })
            const folderId = await this.getRankedPlayersFolder()

            // Check if file already exists and delete it
            const existingFiles = await drive.files.list({
                q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
                fields: 'files(id, name)'
            })

            if (existingFiles.data.files && existingFiles.data.files.length > 0) {
                for (const file of existingFiles.data.files) {
                    if (file.id) {
                        await drive.files.delete({ fileId: file.id })
                        logger.info({ 
                            fileName, 
                            fileId: file.id,
                            feature: 'drive-storage' 
                        }, 'Deleted existing file before upload')
                    }
                }
            }

            // Upload new file
            const fileMetadata = {
                name: fileName,
                parents: [folderId]
            }

            const media = {
                mimeType: contentType,
                body: buffer
            }

            const file = await drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id,name,size'
            })

            logger.info({ 
                fileName: file.data.name, 
                fileId: file.data.id,
                size: file.data.size,
                folderName: RANKED_PLAYERS_FOLDER_NAME,
                feature: 'drive-storage' 
            }, 'File uploaded to Google Drive storage')

        } catch (error) {
            logger.error({ 
                error, 
                fileName, 
                folderName: RANKED_PLAYERS_FOLDER_NAME,
                feature: 'drive-storage' 
            }, 'Failed to upload file to Google Drive storage')
            throw error
        }
    }

    /**
     * Download file from Google Drive storage
     * Replaces fbFileManagement.downloadFile()
     */
    static async downloadFile(fileName: string): Promise<void> {
        try {
            // Ensure the directory exists
            const dataDir = path.join(__dirname, '../data')
            fs.mkdirSync(dataDir, { recursive: true })

            const destinationPath = path.join(dataDir, fileName)
            logger.info({ 
                destinationPath,
                fileName,
                feature: 'drive-storage' 
            }, 'Starting file download from Google Drive')

            const auth = await this.authenticate()
            const drive = google.drive({ version: 'v3', auth })
            const folderId = await this.getRankedPlayersFolder()

            // Find the file in the folder
            const response = await drive.files.list({
                q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, size, modifiedTime)'
            })

            if (!response.data.files || response.data.files.length === 0) {
                throw new Error(`File '${fileName}' not found in ${RANKED_PLAYERS_FOLDER_NAME} folder`)
            }

            const file = response.data.files[0]
            if (!file.id) {
                throw new Error(`File '${fileName}' has no ID`)
            }

            // Download the file content
            const fileResponse = await drive.files.get({
                fileId: file.id,
                alt: 'media'
            }, { responseType: 'stream' })

            // Write to local file
            const writer = fs.createWriteStream(destinationPath)
            
            return new Promise((resolve, reject) => {
                fileResponse.data.pipe(writer)
                
                writer.on('finish', () => {
                    logger.info({ 
                        fileName, 
                        destinationPath,
                        fileSize: file.size,
                        modifiedTime: file.modifiedTime,
                        folderName: RANKED_PLAYERS_FOLDER_NAME,
                        feature: 'drive-storage' 
                    }, 'File downloaded from Google Drive storage')
                    resolve()
                })
                
                writer.on('error', (error) => {
                    logger.error({ 
                        error, 
                        fileName, 
                        destinationPath,
                        feature: 'drive-storage' 
                    }, 'Failed to write downloaded file')
                    reject(error)
                })
                
                fileResponse.data.on('error', (error) => {
                    logger.error({ 
                        error, 
                        fileName,
                        feature: 'drive-storage' 
                    }, 'Failed to download file from Google Drive')
                    reject(error)
                })
            })

        } catch (error) {
            logger.error({ 
                error, 
                fileName,
                folderName: RANKED_PLAYERS_FOLDER_NAME,
                feature: 'drive-storage' 
            }, 'Failed to download file from Google Drive storage')
            throw error
        }
    }

    /**
     * Check if file exists in Google Drive storage
     */
    static async fileExists(fileName: string): Promise<boolean> {
        try {
            const auth = await this.authenticate()
            const drive = google.drive({ version: 'v3', auth })
            const folderId = await this.getRankedPlayersFolder()

            const response = await drive.files.list({
                q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
                fields: 'files(id, name)'
            })

            const exists = !!(response.data.files && response.data.files.length > 0)
            logger.info({ 
                fileName, 
                exists,
                folderName: RANKED_PLAYERS_FOLDER_NAME,
                feature: 'drive-storage' 
            }, 'Checked file existence in Google Drive storage')

            return exists

        } catch (error) {
            logger.error({ 
                error, 
                fileName,
                folderName: RANKED_PLAYERS_FOLDER_NAME,
                feature: 'drive-storage' 
            }, 'Failed to check file existence in Google Drive storage')
            return false
        }
    }

    /**
     * Get storage status information
     */
    static async getStatus(): Promise<{
        connected: boolean
        folderName: string
        folderId: string | null
    }> {
        try {
            await this.authenticate()
            const folderId = await this.getRankedPlayersFolder()
            
            return {
                connected: true,
                folderName: RANKED_PLAYERS_FOLDER_NAME,
                folderId
            }
        } catch (error) {
            logger.error({ error, feature: 'drive-storage' }, 'Failed to get storage status')
            return {
                connected: false,
                folderName: RANKED_PLAYERS_FOLDER_NAME,
                folderId: null
            }
        }
    }
}

// Export functions with same signatures as fbFileManagement for drop-in replacement
export async function uploadFile(
    buffer: Buffer,
    destination: string,
    contentType: string
): Promise<void> {
    // Extract filename from destination path (e.g., "ranked_players/ladderCR.csv" -> "ladderCR.csv")
    const fileName = destination.includes('/') ? destination.split('/').pop()! : destination
    return DriveFileStorage.uploadFile(buffer, fileName, contentType)
}

export async function downloadFile(
    _drivePath: string,
    fileName: string
): Promise<void> {
    // Ignore _drivePath since we use environment-specific folder structure
    return DriveFileStorage.downloadFile(fileName)
}