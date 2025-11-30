/**
 * Main Replays Page Component
 * 
 * Comprehensive replay management interface with folder organization.
 * Features hierarchical folder navigation, replay filtering, and CRUD operations.
 * 
 * Key Features:
 * - Folder-based organization with hierarchy
 * - System views: All Replays, Unorganized Replays
 * - Inline folder management with optimized performance
 * - Drag-free folder operations with modal interfaces
 * - Real-time filtering and search
 * 
 * @component
 */

import { useState, useEffect } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { Container, Button, Group, Title, Text, Notification } from '@mantine/core'
import { UploadReplayModal } from '../components/Replays/UploadReplayModal'
import { DeleteReplayModal } from '../components/Replays/DeleteReplayModal'
import { MoveReplayModal } from '../components/Replays/MoveReplayModal'
import { CreateFolderModal } from '../components/Replays/CreateFolderModal'
import { RenameFolderModal } from '../components/Replays/RenameFolderModal'
import { DeleteFolderModal } from '../components/Replays/DeleteFolderModal'
import { FolderManageModal } from '../components/Replays/FolderManageModal'
import { FolderBreadcrumb } from '../components/Replays/FolderBreadcrumb'
import { ReplayList } from '../components/Replays/ReplayList'
import { FilterReplaysBar } from '../components/Replays/FilterReplaysBar'
import { useFetch } from '../hooks/useFetch'
import { usePost } from '../hooks/usePost'
import { Folder, ReplayWithFolder } from '../../shared/folderTypes'

export const Replay = () => {
    // Modal state management
    const [opened, { open, close }] = useDisclosure(false)
    const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false)
    const [moveModalOpened, { open: openMoveModal, close: closeMoveModal }] = useDisclosure(false)
    const [folderModalOpened, { open: openFolderModal, close: closeFolderModal }] = useDisclosure(false)
    const [folderManageModalOpened, { open: openFolderManageModal, close: closeFolderManageModal }] = useDisclosure(false)
    const [renameModalOpened, { open: openRenameModal, close: closeRenameModal }] = useDisclosure(false)
    const [deleteConfirmModalOpened, { open: openDeleteConfirmModal, close: closeDeleteConfirmModal }] = useDisclosure(false)

    // Entity state for operations
    const [fileToDelete, setFileToDelete] = useState<object | null>(null)
    const [replayToMove, setReplayToMove] = useState<ReplayWithFolder | null>(null)
    const [parentFolderForNew, setParentFolderForNew] = useState<string | null>(null)
    const [folderToRename, setFolderToRename] = useState<{ id: string; name: string } | null>(null)
    const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string; hasSubfolders: boolean; hasReplays: boolean } | null>(null)

    // Navigation and UI state
    const [currentFolderId, setCurrentFolderId] = useState('all')
    const [expandedFolders, setExpandedFolders] = useState(new Set(['root']))

    // Loading states for folder operations (optimized for better UX)
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [isRenamingFolder, setIsRenamingFolder] = useState(false)
    const [isDeletingFolder, setIsDeletingFolder] = useState(false)
    const [isMovingReplay, setIsMovingReplay] = useState(false)

    // Success notification for move operation
    const [showMoveSuccess, setShowMoveSuccess] = useState(false)
    const [moveSuccessMessage, setMoveSuccessMessage] = useState('')

    // Data fetching and filtering
    const { data: fetchData, loading: fetchLoading, error: fetchError, fetch } = useFetch('replays')
    const { data: foldersData, fetch: fetchFolders } = useFetch('folders')
    const [folderFilteredData, setFolderFilteredData] = useState<ReplayWithFolder[]>([])
    const [filteredData, setFilteredData] = useState<ReplayWithFolder[]>([])

    // API operations
    const { post: createFolderPost, error: createFolderError } = usePost('createFolder')
    const { post: moveReplayPost } = usePost('moveReplay')
    const { post: deleteFolderPost } = usePost('deleteFolder')
    const { post: renameFolderPost, error: renameFolderError } = usePost('renameFolder')

    // Helper functions for data fetching
    const fetchReplays = async () => {
        await fetch()
    }

    const fetchFoldersData = async () => {
        await fetchFolders()
    }

    /**
     * Optimized folder filtering effect
     * Filters replays based on current folder selection:
     * - 'all': Shows all replays
     * - 'unorganized': Shows replays without folder assignment
     * - folder ID: Shows replays in specific folder
     */
    useEffect(() => {
        if (fetchData && Array.isArray(fetchData)) {
            if (currentFolderId === 'all') {
                setFolderFilteredData(fetchData)
            } else if (currentFolderId === 'unorganized') {
                // Show replays that don't have a folderId or have null/undefined folderId
                const filtered = fetchData.filter((replay: ReplayWithFolder) =>
                    !replay.folderId || replay.folderId === null || replay.folderId === undefined
                )
                setFolderFilteredData(filtered)
            } else {
                const filtered = fetchData.filter((replay: ReplayWithFolder) =>
                    replay.folderId === currentFolderId
                )
                setFolderFilteredData(filtered)
            }
        }
    }, [fetchData, currentFolderId])

    // Initialize filteredData when folderFilteredData changes
    useEffect(() => {
        setFilteredData(folderFilteredData)
    }, [folderFilteredData])

    // Initial data load
    useEffect(() => {
        fetchReplays()
        fetchFoldersData()
    }, [])

    // Event handlers for replay operations
    const confirmDelete = (file: object) => {
        setFileToDelete(file)
        openDeleteModal()
    }

    const confirmMove = (replay: object) => {
        setReplayToMove(replay as ReplayWithFolder)
        openMoveModal()
    }

    // Navigation handlers
    const handleFolderSelect = (folderId: string) => {
        setCurrentFolderId(folderId)
    }

    /**
     * Toggles folder expansion in tree view
     * Optimized to handle multiple folder states efficiently
     */
    const handleToggleExpand = (folderId: string) => {
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId)
        } else {
            newExpanded.add(folderId)
        }
        setExpandedFolders(newExpanded)
    }

    /**
     * Initiates folder creation process
     * Sets up parent context and opens creation modal
     */
    const handleCreateFolder = (parentId: string | null) => {
        setParentFolderForNew(parentId)
        closeFolderManageModal()
        openFolderModal()
    }

    /**
     * Handles folder creation with optimized refresh strategy
     * Uses delayed fetch to improve perceived performance
     */
    const handleFolderCreated = async (folderName: string) => {
        setIsCreatingFolder(true)
        try {
            await createFolderPost({
                name: folderName,
                parentId: parentFolderForNew
            })

            // Delay folder refetch to improve perceived performance
            setTimeout(() => fetchFoldersData(), 100)
        } finally {
            setIsCreatingFolder(false)
        }
    }

    /**
     * Handles replay movement between folders with optimized refresh
     */
    const handleMoveReplay = async (targetFolderId: string | null) => {
        if (replayToMove) {
            setIsMovingReplay(true)
            try {
                await moveReplayPost({
                    replayId: replayToMove.id,
                    targetFolderId
                })

                // Create success message
                const currentFolder = replayToMove.folderId ?
                    folders.find(f => f.id === replayToMove.folderId)?.name || 'Unknown Folder' :
                    'Unorganized Replays'
                const destFolder = targetFolderId ?
                    folders.find(f => f.id === targetFolderId)?.name || 'Unknown Folder' :
                    'All Replays (Root)'

                setMoveSuccessMessage(`"${replayToMove.name}" moved from ${currentFolder} to ${destFolder}`)
                setShowMoveSuccess(true)

                // Auto-hide notification after 4 seconds
                setTimeout(() => setShowMoveSuccess(false), 4000)

                setReplayToMove(null)

                // Delay replay refetch to improve perceived performance
                setTimeout(() => fetchReplays(), 100)
            } finally {
                setIsMovingReplay(false)
            }
        }
    }

    /**
     * Initiates folder rename process
     */
    const handleRenameFolder = async (folderId: string) => {
        const folder = folders.find(f => f.id === folderId)
        if (folder) {
            setFolderToRename({ id: folderId, name: folder.name })
            closeFolderManageModal()
            openRenameModal()
        }
    }

    /**
     * Handles folder rename with optimized refresh
     */
    const handleRenameFolderSubmit = async (newName: string) => {
        if (folderToRename) {
            setIsRenamingFolder(true)
            try {
                await renameFolderPost({
                    folderId: folderToRename.id,
                    name: newName
                })

                // Delay folder refetch to improve perceived performance
                setTimeout(() => fetchFoldersData(), 100)
                setFolderToRename(null)
            } finally {
                setIsRenamingFolder(false)
            }
        }
    }

    /**
     * Initiates folder deletion process with validation
     */
    const handleDeleteFolder = async (folderId: string) => {
        const folder = folders.find(f => f.id === folderId)
        if (folder) {
            const hasSubfolders = folder.children.length > 0
            const hasReplays = folder.replayIds.length > 0

            setFolderToDelete({
                id: folderId,
                name: folder.name,
                hasSubfolders,
                hasReplays
            })
            closeFolderManageModal()
            openDeleteConfirmModal()
        }
    }

    /**
     * Handles folder deletion with immediate UI feedback and optimized refresh
     */
    const handleDeleteFolderConfirm = async () => {
        if (folderToDelete) {
            setIsDeletingFolder(true)
            try {
                await deleteFolderPost({ folderId: folderToDelete.id })

                // Update current folder immediately if we're deleting the selected one
                if (currentFolderId === folderToDelete.id) {
                    setCurrentFolderId('all')
                }
                setFolderToDelete(null)

                // Delay folder refetch to improve perceived performance
                setTimeout(() => fetchFoldersData(), 100)
            } finally {
                setIsDeletingFolder(false)
            }
        }
    }

    // Data processing and hierarchy building
    const folders: Folder[] = (foldersData as any)?.folders || []
    const currentFolderName = folders.find(f => f.id === currentFolderId)?.name

    /**
     * Builds hierarchical folder structure from flat folder array
     * Creates parent-child relationships and maintains tree structure
     */
    const buildFolderHierarchy = (folders: Folder[]): Folder[] => {
        const folderMap = new Map<string, Folder>()

        folders.forEach(folder => {
            folderMap.set(folder.id, { ...folder, children: [] })
        })

        const rootFolders: Folder[] = []

        folders.forEach(folder => {
            const currentFolder = folderMap.get(folder.id)!

            if (folder.parentId && folderMap.has(folder.parentId)) {
                const parent = folderMap.get(folder.parentId)!
                parent.children.push(currentFolder)
            } else {
                rootFolders.push(currentFolder)
            }
        })

        return rootFolders
    }

    const hierarchicalFolders = buildFolderHierarchy(folders)

    // Count replays in current folder
    const replayCount = filteredData.length

    return (
        <Container fluid p="md" style={{ maxWidth: '1400px' }}>
            {/* Success Notification */}
            {showMoveSuccess && (
                <Notification
                    color="green"
                    title="Replay Moved Successfully"
                    onClose={() => setShowMoveSuccess(false)}
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        zIndex: 1000,
                        maxWidth: '400px'
                    }}
                >
                    {moveSuccessMessage}
                </Notification>
            )}

            {/* Header */}
            <Group justify="space-between" mb="lg">
                <div>
                    <Title order={2}>
                        {currentFolderId === 'all' ? 'All Replays' :
                            currentFolderId === 'unorganized' ? '🗂️ Unorganized Replays' :
                                `📁 ${currentFolderName || 'Folder'}`}
                    </Title>
                    <Text size="sm" c="dimmed">
                        {replayCount} replay{replayCount !== 1 ? 's' : ''}
                    </Text>
                </div>

                <Group>
                    <Button variant="light" onClick={openFolderManageModal}>
                        📁 Manage Folders
                    </Button>
                    <Button onClick={open}>
                        Upload Replay
                    </Button>
                </Group>
            </Group>

            {/* Folder Navigation */}
            <Group mb="md">
                <FolderBreadcrumb
                    currentFolderId={currentFolderId}
                    folders={hierarchicalFolders}
                    onFolderSelect={handleFolderSelect}
                />
            </Group>

            {/* Filters */}
            <FilterReplaysBar fetchData={folderFilteredData} setFilteredData={setFilteredData} />

            {/* Replay Grid */}
            <div style={{ marginTop: '24px' }}>
                <ReplayList
                    confirmDelete={confirmDelete}
                    confirmMove={confirmMove}
                    fetchData={filteredData}
                    fetchLoading={fetchLoading}
                    fetchError={fetchError}
                />
            </div>

            {/* All Modals */}
            <UploadReplayModal opened={opened} close={close} fetchReplays={fetchReplays} />

            <DeleteReplayModal
                opened={deleteModalOpened}
                close={closeDeleteModal}
                fileToDelete={fileToDelete}
                fetchReplays={fetchReplays}
            />

            <MoveReplayModal
                opened={moveModalOpened}
                close={closeMoveModal}
                replayName={replayToMove?.name || ''}
                currentFolderId={replayToMove?.folderId || 'unorganized'}
                folders={hierarchicalFolders}
                onMoveReplay={handleMoveReplay}
                isLoading={isMovingReplay}
            />

            <CreateFolderModal
                opened={folderModalOpened}
                close={closeFolderModal}
                parentFolderName={parentFolderForNew ? folders.find(f => f.id === parentFolderForNew)?.name : undefined}
                onCreateFolder={handleFolderCreated}
                isLoading={isCreatingFolder}
                error={createFolderError}
            />

            <RenameFolderModal
                opened={renameModalOpened}
                close={closeRenameModal}
                folderName={folderToRename?.name || ''}
                onRenameFolder={handleRenameFolderSubmit}
                isLoading={isRenamingFolder}
                error={renameFolderError}
            />

            <DeleteFolderModal
                opened={deleteConfirmModalOpened}
                close={closeDeleteConfirmModal}
                folderName={folderToDelete?.name || ''}
                hasSubfolders={folderToDelete?.hasSubfolders || false}
                hasReplays={folderToDelete?.hasReplays || false}
                onDeleteFolder={handleDeleteFolderConfirm}
                isLoading={isDeletingFolder}
            />

            <FolderManageModal
                opened={folderManageModalOpened}
                close={closeFolderManageModal}
                folders={hierarchicalFolders}
                expandedFolders={expandedFolders}
                currentFolderId={currentFolderId}
                onFolderSelect={handleFolderSelect}
                onToggleExpand={handleToggleExpand}
                onCreateFolder={handleCreateFolder}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
            />
        </Container>
    )
}