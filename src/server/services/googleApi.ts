import axios from 'axios'
import { google, drive_v3 } from 'googleapis'
import dotenv from 'dotenv'
import { Request } from 'express'
import { detectAppEnv } from '../../shared/runtimeEnv'
import logger from '../logging/logger'

dotenv.config()

const SERVICE_ACCOUNT_KEY = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'
)
const SCOPES = ['https://www.googleapis.com/auth/drive']

const REPLAY_FOLDER_NAME = 'ReplaysStarcraft2'
const REPLAY_ANALYSIS_FOLDER_NAME = 'ReplayAnalysisStarcraft2'

/**
 * Authenticates with Google API using service account credentials.
 * @returns {Promise<any>} Authenticated client.
 */
const authenticate = async () => {
    const auth = new google.auth.GoogleAuth({
        credentials: SERVICE_ACCOUNT_KEY,
        scopes: SCOPES,
    })

    const authClient = await auth.getClient()
    return authClient
}

/**
 * Retrieves the access token from the authenticated client.
 * @param {any} auth - Authenticated client.
 * @returns {Promise<string>} Access token.
 */
const getAccessToken = async (auth: any) => {
    const token = await auth.getAccessToken()
    return token.token
}

/**
 * Retrieves or creates a folder in Google Drive.
 * @param {any} auth - Authenticated client.
 * @param {string} folderName - Name of the folder.
 * @returns {Promise<string>} Folder ID.
 */
const getOrCreateFolder = async (auth: any, folderName: string) => {
    const drive = google.drive({ version: 'v3', auth })

    // Check if the folder already exists
    const response = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
    })

    // If the folder exists, return its ID
    if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id
    } else {
        // If the folder does not exist, create it
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
        }

        const folder = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        })

        return folder.data.id
    }
}

/**
 * Makes a file publicly accessible.
 * @param {string} fileId - ID of the file.
 * @param {any} auth - Authenticated client.
 */
const makeFilePublic = async (fileId: string, auth: any) => {
    const drive = google.drive({ version: 'v3', auth })
    await drive.permissions.create({
        fileId: fileId,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    })
}

/**
 * Retrieves all files from a specified folder in Google Drive.
 * @param {string} folderId - ID of the folder.
 * @param {string} accessToken - Access token.
 * @returns {Promise<Array>} List of files.
 */
const getFilesFromFolder = async (folderId: string, accessToken: string) => {
    const response = await axios.get(
        'https://www.googleapis.com/drive/v3/files',
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                q: `'${folderId}' in parents and trashed=false`,
                pageSize: 1000,
                fields: 'files(id, name, mimeType, modifiedTime, size, webContentLink, properties)',
                orderBy: 'name',
            },
        }
    )

    // Map the response data to include custom properties
    return response.data.files.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        size: file.size,
        downloadUrl: file.webContentLink,
        player1Race: file.properties?.player1Race || '',
        player2Race: file.properties?.player2Race || '',
        description: file.properties?.description || '',
        replayAnalysisFileId: file.properties?.replayAnalysisFileId || '',
    }))
}

/**
 * Retrieves all replays from the 'ReplaysStarcraft2' folder in Google Drive.
 * @returns {Promise<Array>} List of replays.
 */
export const getAllReplays = async () => {
    try {
        const auth = await authenticate() // Authenticate with Google API
        const accessToken = await getAccessToken(auth) // Get access token
        const folderId = await getOrCreateFolder(auth, REPLAY_FOLDER_NAME) // Get or create the folder
        if (!folderId) {
            throw new Error('Failed to get or create folder')
        }
        return await getFilesFromFolder(folderId, accessToken) // Retrieve files from the folder
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Google Drive API error:', error.message)
        } else {
            console.error('Unexpected error:', error)
        }
        return []
    }
}

/**
 * Retrieves a single JSON file from a specified folder in Google Drive.
 * @param {string} folderId - ID of the folder.
 * @param {string} fileId - ID of the file.
 * @param {string} accessToken - Access token.
 * @returns {Promise<object>} JSON object.
 */
const getJsonFileFromFolder = async (_folderId: string, fileId: string, accessToken: string): Promise<object> => {
    // Get the file metadata
    const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                fields: 'id, name, mimeType, modifiedTime, size, webContentLink, properties',
            },
        }
    )

    if (!response.data) {
        return {} // Return an empty object if no file is found
    }

    return response.data // Return the JSON content of the file
}

/**
 * Retrieves a single replay analysis JSON file from the 'ReplayAnalysisStarcraft2' folder in Google Drive.
 * @param {Request} req - Express request object containing the file id.
 * @returns {Promise<object>} JSON object.
 */
export const getReplayAnalysis = async (req: Request): Promise<object> => {
    try {
        const { replayAnalysisFileId } = req.body

        const auth = await authenticate() // Authenticate with Google API
        const accessToken = await getAccessToken(auth) // Get access token
        const folderId = await getOrCreateFolder(auth, REPLAY_ANALYSIS_FOLDER_NAME) // Get or create the folder
        if (!folderId) {
            throw new Error('Failed to get or create folder')
        }
        return await getJsonFileFromFolder(folderId, replayAnalysisFileId, accessToken) // Retrieve the JSON file from the folder
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Google Drive API error on replay analysis retrieving:', error.message)
        } else {
            console.error('Unexpected error:', error)
        }
        return {}
    }
}

/**
 * Helper function to upload a file to Google Drive.
 * @param {string} accessToken - Access token.
 * @param {object} fileMetadata - Metadata of the file.
 * @param {string} fileContent - Content of the file.
 * @param {string} contentType - Content type of the file.
 * @returns {Promise<string>} Uploaded file ID.
 */
const uploadFile = async (
    accessToken: string,
    fileMetadata: object,
    fileContent: string,
    contentType: string
): Promise<string> => {
    const boundary = 'foo_bar_baz'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        `Content-Type: ${contentType}\r\n` +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        fileContent +
        closeDelimiter

    const response = await axios.post(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        multipartRequestBody,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
        }
    )

    return response.data.id
}

/**
 * Uploads a replay analysis to a specified folder in Google Drive.
 * @param {Request} req - Express request object containing the file and metadata.
 * @param {string} folderId - ID of the folder.
 * @param {string} accessToken - Access token.
 * @returns {Promise<string>} Uploaded file ID.
 */
const uploadReplayAnalysisToFolder = async (
    req: Request,
    folderId: string,
    accessToken: string
) => {
    const { fileName, replayAnalysis } = req.body

    const fileMetadata = {
        name: fileName + '_analysis.json',
        parents: [folderId],
        properties: {},
    }

    const fileContent = Buffer.from(JSON.stringify(replayAnalysis)).toString('base64')

    return await uploadFile(accessToken, fileMetadata, fileContent, 'application/json')
}

/**
 * Uploads a replay to a specified folder in Google Drive.
 * @param {Request} req - Express request object containing the file and metadata.
 * @param {string} folderId - ID of the folder.
 * @param {string} accessToken - Access token.
 * @returns {Promise<string>} Uploaded file ID.
 */
const uploadReplayToFolder = async (
    req: Request,
    folderId: string,
    accessToken: string,
    replayAnalysisFileId: string
) => {
    const { fileBase64, fileName, player1Race, player2Race, description } =
        req.body

    const fileMetadata = {
        name: fileName,
        parents: [folderId],
        properties: {
            player1Race,
            player2Race,
            description,
            replayAnalysisFileId,
        },
    }

    return await uploadFile(accessToken, fileMetadata, fileBase64, 'application/octet-stream')
}

/**
 * Uploads a replay file to the 'ReplaysStarcraft2' folder in Google Drive.
 * @param {Request} req - Express request object containing the file and metadata.
 * @returns {Promise<string|null>} Uploaded file ID or null if an error occurred.
 */
export const uploadReplay = async (req: Request) => {
    try {
        // First we need to authenticate with Google API and gather the access token
        const auth = await authenticate() // Authenticate with Google API
        const accessToken = await getAccessToken(auth) // Get access token

        // Next we need to upload the replay analysis file to drive and gather the file ID of the uploaded file
        const replayAnalysisFolderId = await getOrCreateFolder(auth, REPLAY_ANALYSIS_FOLDER_NAME) // Get or create the folder
        if (!replayAnalysisFolderId) {
            throw new Error('Failed to get or create replay analysis folder')
        }
        const replayAnalysisFileId = await uploadReplayAnalysisToFolder(req, replayAnalysisFolderId, accessToken) // Upload the file to the folder
        await makeFilePublic(replayAnalysisFileId, auth) // Make the file publicly accessible
        console.log('Replay analysis file ID:', replayAnalysisFileId)

        // Finally we can upload the replay file to drive and attach it the replay analysis file id
        const replayFolderId = await getOrCreateFolder(auth, REPLAY_FOLDER_NAME) // Get or create the folder
        if (!replayFolderId) {
            throw new Error('Failed to get or create replay folder')
        }
        const replayFileId = await uploadReplayToFolder(req, replayFolderId, accessToken, replayAnalysisFileId) // Upload the file to the folder
        await makeFilePublic(replayFileId, auth) // Make the file publicly accessible
        console.log('Replay file ID:', replayFileId)

        return replayFileId
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Google Drive API error:', error.message)
        } else {
            console.error('Unexpected error:', error)
        }
        return null
    }
}

/**
 * Deletes a file from Google Drive.
 * @param {Request} req - Express request object containing the file and metadata.
 * @returns {Promise<boolean>} - Returns true if the deletion was successful, false otherwise.
 */
export const deleteReplay = async (req: Request): Promise<boolean> => {
    try {
        const { replayFileId, replayAnalysisFileId } = req.body
        
        // Use the new GoogleDriveService for consistency
        const driveService = new GoogleDriveService('temp', 'replay-deletion')
        const drive = await driveService.getDriveClient()
        
        if (replayAnalysisFileId) await drive.files.delete({ fileId: replayAnalysisFileId }) // Delete the replay analysis file
        if (replayFileId) await drive.files.delete({ fileId: replayFileId }) // Delete the replay file
        return true // Return true if deletion was successful
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Google Drive API error:', error.message)
        } else {
            console.error('Unexpected error:', error)
        }
        return false // Return false if there was an error
    }
}

/**
 * Enhanced Google Drive Service Class
 * 
 * A modern, reusable service for Google Drive operations with proper TypeScript types,
 * structured logging, and configurable folder management. Supports both replay functionality
 * and H2H custom match operations.
 */
export class GoogleDriveService {
    private folderId: string | null = null
    private driveClient: drive_v3.Drive | null = null
    
    constructor(
        private folderBaseName: string,
        private feature: string = 'google-drive',
        private useEnvironmentSuffix: boolean = false
    ) {}

    /**
     * Get authenticated Google Drive client
     */
    async getDriveClient(): Promise<drive_v3.Drive> {
        if (this.driveClient) {
            return this.driveClient
        }

        try {
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set')
            }

            const SERVICE_ACCOUNT_KEY = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}')
            const auth = new google.auth.GoogleAuth({
                credentials: SERVICE_ACCOUNT_KEY,
                scopes: ['https://www.googleapis.com/auth/drive.file'],
            })

            this.driveClient = google.drive({ version: 'v3', auth })
            
            return this.driveClient
        } catch (error) {
            logger.error(
                { error, feature: this.feature },
                'Failed to create Google Drive client'
            )
            throw error
        }
    }

    /**
     * Ensure the target folder exists, create if necessary
     */
    async ensureFolder(): Promise<string> {
        if (this.folderId) {
            return this.folderId
        }

        const drive = await this.getDriveClient()
        const folderName = this.useEnvironmentSuffix 
            ? `${this.folderBaseName}_${detectAppEnv()}`
            : this.folderBaseName

        try {
            // Search for existing folder
            const searchResponse = await drive.files.list({
                q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id, name)',
            })

            if (searchResponse.data.files && searchResponse.data.files.length > 0) {
                this.folderId = searchResponse.data.files[0].id!
                logger.info(
                    { folderId: this.folderId, folderName, feature: this.feature },
                    'Using existing Drive folder'
                )
            } else {
                // Create new folder
                const createResponse = await drive.files.create({
                    requestBody: {
                        name: folderName,
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                    fields: 'id',
                })

                this.folderId = createResponse.data.id!
                logger.info(
                    { folderId: this.folderId, folderName, feature: this.feature },
                    'Created new Drive folder'
                )
            }

            return this.folderId
        } catch (error) {
            logger.error(
                { error, folderName, feature: this.feature },
                'Failed to ensure Drive folder exists'
            )
            throw error
        }
    }

    /**
     * Check if a file exists in the folder
     */
    async fileExists(fileName: string): Promise<{ exists: boolean; fileId?: string }> {
        const drive = await this.getDriveClient()
        const folderId = await this.ensureFolder()

        try {
            const response = await drive.files.list({
                q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
                fields: 'files(id, name)',
            })

            const exists = !!(response.data.files && response.data.files.length > 0)
            const fileId = exists ? response.data.files![0].id || undefined : undefined

            return { exists, fileId }
        } catch (error) {
            logger.error(
                { error, fileName, folderId, feature: this.feature },
                'Failed to check file existence'
            )
            throw error
        }
    }

    /**
     * Read file content from Drive
     */
    async readFile(fileName: string): Promise<string> {
        const drive = await this.getDriveClient()
        const { exists, fileId } = await this.fileExists(fileName)

        if (!exists || !fileId) {
            throw new Error(`File '${fileName}' not found in Drive folder`)
        }

        try {
            const response = await drive.files.get({
                fileId,
                alt: 'media',
            })

            return response.data as string
        } catch (error) {
            logger.error(
                { error, fileName, fileId, feature: this.feature },
                'Failed to read file from Drive'
            )
            throw error
        }
    }

    /**
     * Write/update file content to Drive
     */
    async writeFile(fileName: string, content: string): Promise<string> {
        const drive = await this.getDriveClient()
        const folderId = await this.ensureFolder()
        const { exists, fileId } = await this.fileExists(fileName)

        try {
            if (exists && fileId) {
                // Update existing file
                await drive.files.update({
                    fileId,
                    media: {
                        mimeType: 'application/json',
                        body: content,
                    },
                })

                logger.info(
                    { fileName, fileId, feature: this.feature },
                    'Updated existing file in Drive'
                )
                
                return fileId
            } else {
                // Create new file
                const createResponse = await drive.files.create({
                    requestBody: {
                        name: fileName,
                        parents: [folderId],
                    },
                    media: {
                        mimeType: 'application/json',
                        body: content,
                    },
                    fields: 'id',
                })

                const newFileId = createResponse.data.id!
                logger.info(
                    { fileName, fileId: newFileId, feature: this.feature },
                    'Created new file in Drive'
                )
                
                return newFileId
            }
        } catch (error) {
            logger.error(
                { error, fileName, feature: this.feature },
                'Failed to write file to Drive'
            )
            throw error
        }
    }

    /**
     * List all files in the folder
     */
    async listFiles(): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
        const drive = await this.getDriveClient()
        const folderId = await this.ensureFolder()

        try {
            const response = await drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, modifiedTime)',
                orderBy: 'modifiedTime desc',
            })

            return (response.data.files || [])
                .filter(file => file.id && file.name)
                .map(file => ({
                    id: file.id!,
                    name: file.name!,
                    modifiedTime: file.modifiedTime || undefined,
                }))
        } catch (error) {
            logger.error(
                { error, folderId, feature: this.feature },
                'Failed to list files from Drive folder'
            )
            throw error
        }
    }

    /**
     * Delete a file from Drive
     */
    async deleteFile(fileName: string): Promise<void> {
        const { exists, fileId } = await this.fileExists(fileName)
        
        if (!exists || !fileId) {
            return // File doesn't exist, nothing to delete
        }

        const drive = await this.getDriveClient()

        try {
            await drive.files.delete({
                fileId,
            })

            logger.info(
                { fileName, fileId, feature: this.feature },
                'Deleted file from Drive'
            )
        } catch (error) {
            logger.error(
                { error, fileName, fileId, feature: this.feature },
                'Failed to delete file from Drive'
            )
            throw error
        }
    }

    /**
     * Make a file publicly accessible
     */
    async makeFilePublic(fileId: string): Promise<void> {
        const drive = await this.getDriveClient()

        try {
            await drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            })

            logger.info(
                { fileId, feature: this.feature },
                'Made file publicly accessible'
            )
        } catch (error) {
            logger.error(
                { error, fileId, feature: this.feature },
                'Failed to make file public'
            )
            throw error
        }
    }

    /**
     * Get folder statistics
     */
    async getFolderStats(): Promise<{
        totalFiles: number
        fileNames: string[]
        lastModified?: string
    }> {
        const files = await this.listFiles()
        
        return {
            totalFiles: files.length,
            fileNames: files.map(f => f.name),
            lastModified: files.length > 0 ? files[0].modifiedTime : undefined,
        }
    }

    /**
     * Legacy compatibility: Get the folder ID (same as ensureFolder)
     */
    async getFolderId(): Promise<string> {
        return this.ensureFolder()
    }
}