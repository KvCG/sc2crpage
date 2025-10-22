import { Modal, Button, Text, ScrollArea, UnstyledButton, Group, Stack } from '@mantine/core'
import { IconFolder, IconFolderOpen, IconChevronRight, IconChevronDown } from '@tabler/icons-react'
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
                    onClick={() => setSelectedFolder(folder.id)}
                    disabled={isCurrent}
                    style={{
                        width: '100%',
                        padding: `8px ${8 + depth * 16}px`,
                        backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                        opacity: isCurrent ? 0.5 : 1,
                        borderRadius: '4px'
                    }}
                >
                    <Group gap="xs">
                        <div
                            onClick={(e) => {
                                e.stopPropagation()
                                if (hasChildren) toggleExpand(folder.id)
                            }}
                            style={{ width: '16px', cursor: hasChildren ? 'pointer' : 'default' }}
                        >
                            {hasChildren && (isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />)}
                        </div>
                        {isExpanded ? <IconFolderOpen size={16} /> : <IconFolder size={16} />}
                        <Text size="sm" c={isCurrent ? "dimmed" : undefined}>
                            {folder.name} {isCurrent && "(current)"}
                        </Text>
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

    // Use the hierarchical folders directly since they're already properly structured
    const rootFolders = folders

    return (
        <Modal opened={opened} onClose={close} title={`Move "${replayName}"`} size="md">
            <Text size="sm" c="dimmed" mb="md">
                Select destination folder:
            </Text>

            <ScrollArea h={400} type="auto">
                <Stack gap="xs" p="xs">
                    <UnstyledButton
                        onClick={() => setSelectedFolder('root')}
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: selectedFolder === 'root' ? '#e3f2fd' : 'transparent',
                            borderRadius: '4px',
                            opacity: isLoading ? 0.5 : 1
                        }}
                    >
                        <Group>
                            <IconFolder size={16} />
                            <Text size="sm">📁 All Replays (Root)</Text>
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
                    disabled={selectedFolder === currentFolderId || isLoading}
                    loading={isLoading}
                >
                    Move Here
                </Button>
            </Group>
        </Modal>
    )
}