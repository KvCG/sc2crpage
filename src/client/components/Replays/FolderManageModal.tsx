import { useState } from 'react'
import { Modal, Text, UnstyledButton, Group, ActionIcon, Stack, Button, Collapse } from '@mantine/core'
import { IconFolder, IconFolderOpen, IconChevronRight, IconChevronDown, IconPlus, IconDots, IconEdit, IconTrash, IconFolders } from '@tabler/icons-react'
import { Folder } from '../../../shared/folderTypes'

interface FolderManageModalProps {
    opened: boolean
    close: () => void
    folders: Folder[]
    expandedFolders: Set<string>
    currentFolderId: string
    onFolderSelect: (folderId: string) => void
    onToggleExpand: (folderId: string) => void
    onCreateFolder: (parentId: string | null) => void
    onRenameFolder: (folderId: string) => void
    onDeleteFolder: (folderId: string) => void
}

interface FolderItemProps {
    folder: Folder
    isSelected: boolean
    isExpanded: boolean
    depth: number
    showActions: boolean
    onSelect: () => void
    onToggleExpand: () => void
    onToggleActions: () => void
    onCreateFolder: (parentId: string) => void
    onRenameFolder: () => void
    onDeleteFolder: () => void
}

const FolderItem = ({
    folder,
    isSelected,
    isExpanded,
    depth,
    showActions,
    onSelect,
    onToggleExpand,
    onToggleActions,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder
}: FolderItemProps) => {
    const hasChildren = folder.children.length > 0

    return (
        <div>
            <UnstyledButton
                style={{
                    width: '100%',
                    padding: `6px ${8 + depth * 16}px`,
                    backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                    borderRadius: '4px'
                }}
            >
                <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                        variant="transparent"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            if (hasChildren) onToggleExpand()
                        }}
                        style={{ opacity: hasChildren ? 1 : 0 }}
                    >
                        {hasChildren && (isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />)}
                    </ActionIcon>

                    <div
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={onSelect}
                    >
                        {isExpanded ? <IconFolderOpen size={16} color={isSelected ? '#1976d2' : undefined} /> : <IconFolder size={16} color={isSelected ? '#1976d2' : undefined} />}
                        <Text size="sm" c={isSelected ? '#1976d2' : undefined} fw={isSelected ? 600 : 400}>
                            {folder.name}
                        </Text>
                    </div>

                    <ActionIcon
                        variant="transparent"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggleActions()
                        }}
                    >
                        <IconDots size={12} />
                    </ActionIcon>
                </Group>
            </UnstyledButton>

            <Collapse in={showActions}>
                <div style={{
                    marginLeft: `${24 + depth * 16}px`,
                    marginTop: '4px',
                    marginBottom: '8px',
                    padding: '10px',
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderRadius: '6px',
                    border: '1px solid var(--mantine-color-dark-4)'
                }}>
                    <Group gap="sm">
                        <Button
                            variant="filled"
                            size="xs"
                            color="blue"
                            leftSection={<IconPlus size={12} />}
                            onClick={() => {
                                onCreateFolder(folder.id)
                                onToggleActions()
                            }}
                        >
                            New Folder
                        </Button>
                        <Button
                            variant="filled"
                            size="xs"
                            color="gray"
                            leftSection={<IconEdit size={12} />}
                            onClick={() => {
                                onRenameFolder()
                                onToggleActions()
                            }}
                        >
                            Rename
                        </Button>
                        <Button
                            variant="filled"
                            size="xs"
                            color="red"
                            leftSection={<IconTrash size={12} />}
                            onClick={() => {
                                onDeleteFolder()
                                onToggleActions()
                            }}
                        >
                            Delete
                        </Button>
                    </Group>
                </div>
            </Collapse>
        </div>
    )
}

export const FolderManageModal = ({
    opened,
    close,
    folders,
    expandedFolders,
    currentFolderId,
    onFolderSelect,
    onToggleExpand,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder
}: FolderManageModalProps) => {
    const [showActionsFor, setShowActionsFor] = useState<string | null>(null)

    const renderFolder = (folder: Folder, depth = 0) => {
        const isExpanded = expandedFolders.has(folder.id)
        const isSelected = currentFolderId === folder.id

        return (
            <div key={folder.id}>
                <FolderItem
                    folder={folder}
                    isSelected={isSelected}
                    isExpanded={isExpanded}
                    depth={depth}
                    showActions={showActionsFor === folder.id}
                    onSelect={() => {
                        onFolderSelect(folder.id)
                        close()
                    }}
                    onToggleExpand={() => onToggleExpand(folder.id)}
                    onToggleActions={() => {
                        setShowActionsFor(showActionsFor === folder.id ? null : folder.id)
                    }}
                    onCreateFolder={(parentId) => onCreateFolder(parentId)}
                    onRenameFolder={() => onRenameFolder(folder.id)}
                    onDeleteFolder={() => onDeleteFolder(folder.id)}
                />

                {isExpanded && folder.children.length > 0 && (
                    <div>
                        {folder.children.map(child => renderFolder(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    const rootFolders = folders.filter(f => f.parentId === null)

    return (
        <Modal
            opened={opened}
            onClose={close}
            title="Manage Folders"
            size="md"
            centered
            styles={{
                body: { padding: '1.5rem' },
                content: { maxHeight: '70vh' }
            }}
        >
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}>
                <Group justify="space-between" mb="lg">
                    <Text size="xl" fw={600}>Select Folder</Text>
                    <Button variant="light" onClick={() => onCreateFolder(null)}>
                        <IconPlus size={16} style={{ marginRight: 8 }} />
                        New Folder
                    </Button>
                </Group>

                {/* System Views Section */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <Text size="sm" fw={500} c="dimmed" mb="xs">SYSTEM VIEWS</Text>

                    {/* All Replays */}
                    <UnstyledButton
                        style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: currentFolderId === 'all' ? '#e3f2fd' : 'transparent',
                            borderRadius: '4px',
                            marginBottom: '2px'
                        }}
                        onClick={() => {
                            onFolderSelect('all')
                            close()
                        }}
                    >
                        <Group gap="xs" wrap="nowrap">
                            <IconFolders size={16} color={currentFolderId === 'all' ? '#1976d2' : 'var(--mantine-color-blue-6)'} />
                            <Text size="sm" c={currentFolderId === 'all' ? '#1976d2' : undefined} fw={currentFolderId === 'all' ? 600 : 400}>
                                All Replays
                            </Text>
                        </Group>
                    </UnstyledButton>

                    {/* Unorganized Replays */}
                    <UnstyledButton
                        style={{
                            width: '100%',
                            padding: '6px 8px',
                            backgroundColor: currentFolderId === 'unorganized' ? '#fff3e0' : 'transparent',
                            borderRadius: '4px',
                            border: currentFolderId === 'unorganized' ? '1px solid var(--mantine-color-orange-4)' : '1px dashed var(--mantine-color-gray-4)'
                        }}
                        onClick={() => {
                            onFolderSelect('unorganized')
                            close()
                        }}
                    >
                        <Group gap="xs" wrap="nowrap">
                            <IconFolder size={16} color={currentFolderId === 'unorganized' ? 'var(--mantine-color-orange-7)' : 'var(--mantine-color-orange-6)'} />
                            <Text size="sm" c={currentFolderId === 'unorganized' ? 'var(--mantine-color-orange-7)' : undefined} fw={currentFolderId === 'unorganized' ? 600 : 400}>
                                Unorganized Replays
                            </Text>
                        </Group>
                    </UnstyledButton>
                </div>

                {/* User Folders Section */}
                <div style={{ flex: 1, overflow: 'visible' }}>
                    <Text size="sm" fw={500} c="dimmed" mb="xs">YOUR FOLDERS</Text>
                    {rootFolders.length > 0 ? (
                        <Stack gap="xs">
                            {rootFolders.map(folder => renderFolder(folder))}
                        </Stack>
                    ) : (
                        <div style={{
                            padding: '1.5rem',
                            textAlign: 'center',
                            backgroundColor: 'var(--mantine-color-dark-7)',
                            borderRadius: '8px',
                            border: '1px dashed var(--mantine-color-dark-4)'
                        }}>
                            <IconFolder size={32} color="var(--mantine-color-gray-6)" style={{ marginBottom: '0.5rem' }} />
                            <Text size="sm" c="dimmed">
                                No folders created yet
                            </Text>
                            <Text size="xs" c="dimmed">
                                Click "New Folder" to organize your replays
                            </Text>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    )
}