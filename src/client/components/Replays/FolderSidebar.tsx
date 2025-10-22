import { Paper, Text, UnstyledButton, Group, ActionIcon, Menu, rem, Stack } from '@mantine/core'
import { IconFolder, IconFolderOpen, IconChevronRight, IconChevronDown, IconPlus, IconDots, IconEdit, IconTrash } from '@tabler/icons-react'
import { useDroppable } from '@dnd-kit/core'
import { Folder } from '../../../shared/folderTypes'

interface FolderSidebarProps {
    folders: Folder[]
    expandedFolders: Set<string>
    currentFolderId: string
    onFolderSelect: (folderId: string) => void
    onToggleExpand: (folderId: string) => void
    onCreateFolder: (parentId: string | null) => void
    onRenameFolder: (folderId: string) => void
    onDeleteFolder: (folderId: string) => void
}

interface DroppableFolderItemProps {
    folder: Folder
    isSelected: boolean
    isExpanded: boolean
    depth: number
    onSelect: () => void
    onToggleExpand: () => void
    onCreateFolder: (parentId: string) => void
    onRenameFolder: () => void
    onDeleteFolder: () => void
}

const DroppableFolderItem = ({
    folder,
    isSelected,
    isExpanded,
    depth,
    onSelect,
    onToggleExpand,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder
}: DroppableFolderItemProps) => {
    const { isOver, setNodeRef } = useDroppable({
        id: folder.id,
        data: {
            type: 'folder',
            folderId: folder.id
        }
    })

    const hasChildren = folder.children.length > 0

    return (
        <div ref={setNodeRef}>
            <UnstyledButton
                style={{
                    width: '100%',
                    padding: `3px ${6 + depth * 12}px`,
                    backgroundColor: isSelected ? '#e3f2fd' : isOver ? '#f3e5f5' : 'transparent',
                    borderRadius: '4px',
                    border: isOver ? '2px dashed #9c27b0' : '2px solid transparent'
                }}
            >
                <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                        variant="transparent"
                        size="xs"
                        onClick={(e) => {
                            e.stopPropagation()
                            if (hasChildren) onToggleExpand()
                        }}
                        style={{ opacity: hasChildren ? 1 : 0 }}
                    >
                        {hasChildren && (isExpanded ? <IconChevronDown size={10} /> : <IconChevronRight size={10} />)}
                    </ActionIcon>

                    <div
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={onSelect}
                    >
                        {isExpanded ? <IconFolderOpen size={14} /> : <IconFolder size={14} />}
                        <Text size="sm">{folder.name}</Text>
                        {isOver && <Text size="xs" c="dimmed">Drop here</Text>}
                    </div>

                    <Menu shadow="md" width={160}>
                        <Menu.Target>
                            <ActionIcon variant="transparent" size="xs">
                                <IconDots size={10} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item
                                leftSection={<IconPlus style={{ width: rem(14), height: rem(14) }} />}
                                onClick={() => onCreateFolder(folder.id)}
                            >
                                New Folder
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />}
                                onClick={onRenameFolder}
                            >
                                Rename
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconTrash style={{ width: rem(14), height: rem(14) }} />}
                                color="red"
                                onClick={onDeleteFolder}
                            >
                                Delete
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </UnstyledButton>
        </div>
    )
}

export const FolderSidebar = ({
    folders,
    expandedFolders,
    currentFolderId,
    onFolderSelect,
    onToggleExpand,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder
}: FolderSidebarProps) => {
    const renderFolder = (folder: Folder, depth = 0) => {
        const isExpanded = expandedFolders.has(folder.id)
        const isSelected = currentFolderId === folder.id

        return (
            <div key={folder.id}>
                <DroppableFolderItem
                    folder={folder}
                    isSelected={isSelected}
                    isExpanded={isExpanded}
                    depth={depth}
                    onSelect={() => onFolderSelect(folder.id)}
                    onToggleExpand={() => onToggleExpand(folder.id)}
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
        <Paper p="sm" style={{ width: 220, height: '100vh', overflowY: 'auto' }}>
            <Group justify="space-between" mb="sm">
                <Text fw={500} size="sm">Folders</Text>
                <ActionIcon variant="light" size="sm" onClick={() => onCreateFolder(null)}>
                    <IconPlus size={14} />
                </ActionIcon>
            </Group>

            <UnstyledButton
                onClick={() => onFolderSelect('all')}
                style={{
                    width: '100%',
                    padding: '6px 8px',
                    backgroundColor: currentFolderId === 'all' ? '#e3f2fd' : 'transparent',
                    borderRadius: '4px'
                }}
                mb="xs"
            >
                <Group gap="xs">
                    <IconFolder size={14} />
                    <Text size="sm">All Replays</Text>
                </Group>
            </UnstyledButton>

            <Stack gap="xs">
                {rootFolders.map(folder => renderFolder(folder))}
            </Stack>
        </Paper>
    )
}