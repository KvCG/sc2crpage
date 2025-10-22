import { useState, useEffect } from 'react'
import { useDisclosure } from '@mantine/hooks'
import { Container, Button, Group, Title, Text } from '@mantine/core'
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
    const [opened, { open, close }] = useDisclosure(false)
    const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false)
    const [moveModalOpened, { open: openMoveModal, close: closeMoveModal }] = useDisclosure(false)
    const [folderModalOpened, { open: openFolderModal, close: closeFolderModal }] = useDisclosure(false)
    const [folderManageModalOpened, { open: openFolderManageModal, close: closeFolderManageModal }] = useDisclosure(false)
    const [renameModalOpened, { open: openRenameModal, close: closeRenameModal }] = useDisclosure(false)
    const [deleteConfirmModalOpened, { open: openDeleteConfirmModal, close: closeDeleteConfirmModal }] = useDisclosure(false)

    const [fileToDelete, setFileToDelete] = useState<object | null>(null)
    const [replayToMove, setReplayToMove] = useState<ReplayWithFolder | null>(null)
    const [parentFolderForNew, setParentFolderForNew] = useState<string | null>(null)
    const [folderToRename, setFolderToRename] = useState<{ id: string; name: string } | null>(null)
    const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string; hasSubfolders: boolean; hasReplays: boolean } | null>(null)
    const [currentFolderId, setCurrentFolderId] = useState('all')
    const [expandedFolders, setExpandedFolders] = useState(new Set(['root']))

    // Loading states for folder operations
    const [isCreatingFolder, setIsCreatingFolder] = useState(false)
    const [isRenamingFolder, setIsRenamingFolder] = useState(false)
    const [isDeletingFolder, setIsDeletingFolder] = useState(false)
    const [isMovingReplay, setIsMovingReplay] = useState(false)

    // Fetch hooks with optimized caching
    const { data: fetchData, loading: fetchLoading, error: fetchError, fetch } = useFetch('replays')
    const { data: foldersData, fetch: fetchFolders } = useFetch('folders')
    const [folderFilteredData, setFolderFilteredData] = useState<ReplayWithFolder[]>([])
    const [filteredData, setFilteredData] = useState<ReplayWithFolder[]>([])

    const { post: createFolderPost } = usePost('createFolder')
    const { post: moveReplayPost } = usePost('moveReplay')
    const { post: deleteFolderPost } = usePost('deleteFolder')
    const { post: renameFolderPost } = usePost('renameFolder')

    const fetchReplays = async () => {
        await fetch()
    }

    const fetchFoldersData = async () => {
        await fetchFolders()
    }

    // Performance optimization: Only filter by folder when data changes
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
    }, [folderFilteredData])    // Initial load only
    useEffect(() => {
        fetchReplays()
        fetchFoldersData()
    }, [])

    const confirmDelete = (file: object) => {
        setFileToDelete(file)
        openDeleteModal()
    }

    const confirmMove = (replay: object) => {
        setReplayToMove(replay as ReplayWithFolder)
        openMoveModal()
    }

    const handleFolderSelect = (folderId: string) => {
        setCurrentFolderId(folderId)
    }

    const handleToggleExpand = (folderId: string) => {
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId)
        } else {
            newExpanded.add(folderId)
        }
        setExpandedFolders(newExpanded)
    }

    const handleCreateFolder = (parentId: string | null) => {
        setParentFolderForNew(parentId)
        closeFolderManageModal()
        openFolderModal()
    }

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

    const handleMoveReplay = async (targetFolderId: string | null) => {
        if (replayToMove) {
            setIsMovingReplay(true)
            try {
                await moveReplayPost({
                    replayId: replayToMove.id,
                    targetFolderId
                })

                setReplayToMove(null)

                // Delay replay refetch to improve perceived performance
                setTimeout(() => fetchReplays(), 100)
            } finally {
                setIsMovingReplay(false)
            }
        }
    }

    const handleRenameFolder = async (folderId: string) => {
        const folder = folders.find(f => f.id === folderId)
        if (folder) {
            setFolderToRename({ id: folderId, name: folder.name })
            closeFolderManageModal()
            openRenameModal()
        }
    }

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

    const folders: Folder[] = (foldersData as any)?.folders || []
    const currentFolderName = folders.find(f => f.id === currentFolderId)?.name

    // Build folder hierarchy for management
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
                currentFolderId={currentFolderId}
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
            />

            <RenameFolderModal
                opened={renameModalOpened}
                close={closeRenameModal}
                folderName={folderToRename?.name || ''}
                onRenameFolder={handleRenameFolderSubmit}
                isLoading={isRenamingFolder}
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