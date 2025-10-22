/**
 * Shared Types for Folder Management System
 * 
 * Defines the core data structures and interfaces used throughout
 * the folder management feature for replay organization.
 */

/**
 * Represents a folder in the hierarchical structure
 * Supports nested folders with parent-child relationships
 */
export interface Folder {
    /** Unique identifier for the folder */
    id: string
    /** Display name of the folder */
    name: string
    /** ID of the parent folder, null for root folders */
    parentId: string | null
    /** Array of direct child folders */
    children: Folder[]
    /** Array of replay IDs contained in this folder */
    replayIds: string[]
    /** ISO timestamp when folder was created */
    createdAt: string
    /** ISO timestamp when folder was last updated */
    updatedAt: string
}

/**
 * State management interface for folder operations
 */
export interface FolderState {
    /** Map of folder ID to folder data */
    folders: Record<string, Folder>
    /** Set of folder IDs that are currently expanded in UI */
    expandedFolders: Set<string>
    /** Currently selected folder ID */
    currentFolderId: string
}

/**
 * Extended replay interface with folder association
 */
export interface ReplayWithFolder {
    /** Unique replay identifier */
    id: string
    /** Display name of the replay file */
    name: string
    /** MIME type of the replay file */
    mimeType: string
    /** ISO timestamp of last modification */
    modifiedTime: string
    /** File size in bytes as string */
    size: string
    /** Direct download URL for the replay file */
    downloadUrl: string
    /** Race of player 1 */
    player1Race: string
    /** Race of player 2 */
    player2Race: string
    /** Optional description or notes */
    description: string
    /** ID of associated replay analysis file */
    replayAnalysisFileId: string
    /** ID of the folder containing this replay (null if unorganized) */
    folderId?: string | null
}

/**
 * Request interface for moving replays between folders
 */
export interface MoveReplayRequest {
    /** ID of the replay to move */
    replayId: string
    /** ID of the target folder (null to remove from all folders) */
    targetFolderId: string | null
}

/**
 * Request interface for creating new folders
 */
export interface CreateFolderRequest {
    /** Name for the new folder */
    name: string
    /** ID of the parent folder (null for root level) */
    parentId: string | null
}

/**
 * API response interface for folder operations
 */
export interface FolderApiResponse {
    /** Array of folders returned by the API */
    folders: Folder[]
    /** Whether the operation was successful */
    success: boolean
    /** Error message if operation failed */
    error?: string
}