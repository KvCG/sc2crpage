import { Modal, Button, Text, ScrollArea, UnstyledButton, Group, Stack, Box, Divider } from '@mantine/core'
import { IconFolder, IconFolderOpen, IconChevronRight, IconChevronDown, IconArrowRight } from '@tabler/icons-react'
import { useState } from 'react'
import { Folder } from '../../../shared/folderTypes'

interface MoveReplayModalProps {
    opened: boolean
    close: () => void
    replayName: string
    currentFolderId: string
    folders: Folder[]
    onMoveReplay: (targetFolderId: string | null) => Promise<void>
    isLoading?: boolean
}

export const MoveReplayModal = ({
    opened,
    close,
    replayName,
    currentFolderId,
    folders,
    onMoveReplay,
    isLoading = false
}: MoveReplayModalProps) => {
    const [expandedFolders, setExpandedFolders] = useState(new Set(['root']))
    const [selectedFolder, setSelectedFolder] = useState<string | null>(currentFolderId)

    const toggleExpand = (folderId: string) => {
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(folderId)) {
            newExpanded.delete(folderId)
        } else {
            newExpanded.add(folderId)
        }
        setExpandedFolders(newExpanded)
    }

    const renderFolder = (folder: Folder, depth = 0) => {
        const isExpanded = expandedFolders.has(folder.id)
        const isSelected = selectedFolder === folder.id
        const isCurrent = currentFolderId === folder.id
        const hasChildren = folder.children.length > 0

        return (
            <div key={folder.id}>
                <UnstyledButton
                    disabled={isCurrent}
                    style={{
                        width: '100%',
                        padding: `8px ${8 + depth * 16}px`,
                        backgroundColor: isSelected ? 'var(--mantine-color-dark-5)' : 'transparent',
                        opacity: isCurrent ? 0.6 : 1,
                        borderRadius: '4px',
                        border: isSelected ? '1px solid var(--mantine-color-blue-4)' : '1px solid transparent',
                        transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                        if (!isCurrent && !isSelected) {
                            e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-6)'
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isCurrent && !isSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }
                    }}
                >
                    <Group gap="xs" wrap="nowrap">
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                if (hasChildren) toggleExpand(folder.id)
                            }}
                            style={{
                                width: '16px',
                                cursor: hasChildren ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: hasChildren ? '#c1c2c5' : 'transparent'
                            }}
                        >
                            {hasChildren && (isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />)}
                        </div>
                        <div
                            onClick={() => setSelectedFolder(folder.id)}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer'
                            }}
                        >
                            {isExpanded ?
                                <IconFolderOpen size={16} color={isSelected ? '#74c0fc' : '#ffd43b'} /> :
                                <IconFolder size={16} color={isSelected ? '#74c0fc' : '#adb5bd'} />
                            }
                            <Text
                                size="sm"
                                c={isCurrent ? "dimmed" : isSelected ? "#74c0fc" : "white"}
                                fw={isSelected ? 600 : 400}
                            >
                                {folder.name} {isCurrent && "(current)"}
                            </Text>
                        </div>
                    </Group>
                </UnstyledButton>

                {isExpanded && hasChildren && (
                    <div>
                        {folder.children.map(child => renderFolder(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    const handleMove = () => {
        if (selectedFolder !== currentFolderId) {
            onMoveReplay(selectedFolder === 'root' ? null : selectedFolder)
            close()
            setSelectedFolder(currentFolderId) // Reset selection
        }
    }

    // Helper function to find folder by ID recursively
    const findFolderById = (folderId: string, folderList: Folder[]): Folder | null => {
        for (const folder of folderList) {
            if (folder.id === folderId) return folder
            if (folder.children.length > 0) {
                const found = findFolderById(folderId, folder.children)
                if (found) return found
            }
        }
        return null
    }

    // Get current folder info
    const getCurrentFolderInfo = () => {
        if (currentFolderId === 'all') return { name: 'All Replays', icon: '📁' }
        if (currentFolderId === 'unorganized') return { name: 'Unorganized Replays', icon: '🗂️' }

        const currentFolder = findFolderById(currentFolderId, folders)
        return currentFolder ? { name: currentFolder.name, icon: '📁' } : { name: 'Unknown', icon: '❓' }
    }

    // Get destination folder info
    const getDestinationFolderInfo = () => {
        if (selectedFolder === 'root') return { name: 'All Replays (Root)', icon: '📁' }
        if (!selectedFolder) return null

        const destFolder = findFolderById(selectedFolder, folders)
        return destFolder ? { name: destFolder.name, icon: '📁' } : null
    }

    const currentFolderInfo = getCurrentFolderInfo()
    const destinationFolderInfo = getDestinationFolderInfo()
    const isMoving = selectedFolder !== currentFolderId

    // Use the hierarchical folders directly since they're already properly structured
    const rootFolders = folders

    return (
        <Modal
            opened={opened}
            onClose={close}
            title={`Move "${replayName}"`}
            size="md"
            closeOnClickOutside={!isLoading}
            withCloseButton={!isLoading}
        >
            {/* Current Location Display */}
            <Box mb="md" p="sm" style={{
                backgroundColor: 'var(--mantine-color-dark-6)',
                borderRadius: '6px',
                border: '1px solid var(--mantine-color-dark-4)'
            }}>
                <Text size="xs" c="dimmed" mb="xs">CURRENTLY IN:</Text>
                <Group gap="xs">
                    <Text size="sm">{currentFolderInfo.icon}</Text>
                    <Text size="sm" c="white" fw={500}>{currentFolderInfo.name}</Text>
                </Group>
            </Box>

            {/* Move Preview */}
            {isMoving && destinationFolderInfo && (
                <Box mb="md" p="sm" style={{
                    backgroundColor: 'var(--mantine-color-blue-9)',
                    borderRadius: '6px',
                    border: '1px solid var(--mantine-color-blue-6)'
                }}>
                    <Text size="xs" c="blue.4" mb="xs">MOVING TO:</Text>
                    <Group gap="sm" align="center">
                        <Group gap="xs">
                            <Text size="sm">{currentFolderInfo.icon}</Text>
                            <Text size="sm" c="blue.2">{currentFolderInfo.name}</Text>
                        </Group>
                        <IconArrowRight size={14} color="#74c0fc" />
                        <Group gap="xs">
                            <Text size="sm">{destinationFolderInfo.icon}</Text>
                            <Text size="sm" c="blue.1" fw={600}>{destinationFolderInfo.name}</Text>
                        </Group>
                    </Group>
                </Box>
            )}

            <Divider mb="md" />

            <Text size="sm" c="dimmed" mb="md" fw={500}>
                Select destination folder:
            </Text>

            <ScrollArea
                h={400}
                type="auto"
                style={{
                    backgroundColor: 'var(--mantine-color-dark-7)',
                    borderRadius: '6px',
                    border: '1px solid var(--mantine-color-dark-4)',
                    opacity: isLoading ? 0.6 : 1,
                    pointerEvents: isLoading ? 'none' : 'auto',
                    transition: 'opacity 0.2s ease'
                }}
            >
                <Stack gap="xs" p="xs">
                    <UnstyledButton
                        onClick={() => setSelectedFolder('root')}
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: selectedFolder === 'root' ? 'var(--mantine-color-dark-5)' : 'transparent',
                            borderRadius: '4px',
                            opacity: isLoading ? 0.5 : 1,
                            border: selectedFolder === 'root' ? '1px solid var(--mantine-color-blue-4)' : '1px solid transparent',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            if (!isLoading && selectedFolder !== 'root') {
                                e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-6)'
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isLoading && selectedFolder !== 'root') {
                                e.currentTarget.style.backgroundColor = 'transparent'
                            }
                        }}
                    >
                        <Group>
                            <IconFolder size={16} color={selectedFolder === 'root' ? '#74c0fc' : '#adb5bd'} />
                            <Text
                                size="sm"
                                c={selectedFolder === 'root' ? "#74c0fc" : "white"}
                                fw={selectedFolder === 'root' ? 600 : 400}
                            >
                                📁 All Replays (Root)
                            </Text>
                        </Group>
                    </UnstyledButton>

                    {rootFolders.map(folder => renderFolder(folder))}
                </Stack>
            </ScrollArea>

            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={close} disabled={isLoading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleMove}
                    disabled={!isMoving || isLoading}
                    loading={isLoading}
                    color="blue"
                    leftSection={isLoading ? null : <IconArrowRight size={16} />}
                >
                    {isLoading ? 'Moving...' : isMoving ? `Move to ${destinationFolderInfo?.name || 'Destination'}` : 'Select Destination'}
                </Button>
            </Group>
        </Modal>
    )
}