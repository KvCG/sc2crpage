export interface Folder {
    id: string
    name: string
    parentId: string | null
    children: Folder[]
    replayIds: string[]
    createdAt: string
    updatedAt: string
}

export interface FolderState {
    folders: Record<string, Folder>
    expandedFolders: Set<string>
    currentFolderId: string
}

export interface ReplayWithFolder {
    id: string
    name: string
    mimeType: string
    modifiedTime: string
    size: string
    downloadUrl: string
    player1Race: string
    player2Race: string
    description: string
    replayAnalysisFileId: string
    folderId?: string | null
}

export interface MoveReplayRequest {
    replayId: string
    targetFolderId: string | null
}

export interface CreateFolderRequest {
    name: string
    parentId: string | null
}

export interface FolderApiResponse {
    folders: Folder[]
    success: boolean
    error?: string
}