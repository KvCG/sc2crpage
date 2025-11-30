/**
 * Folder Management Modal Component
 * 
 * Provides a comprehensive interface for managing folder hierarchy and organization.
 * Features hierarchical folder navigation, inline actions, and system views.
 * 
 * @component
 * @example
 * ```tsx
 * <FolderManageModal
 *   opened={isOpen}
 *   close={handleClose}
 *   folders={folderHierarchy}
 *   currentFolderId={selectedFolderId}
 *   onFolderSelect={handleFolderSelect}
 *   // ... other props
 * />
 * ```
 */

import { useState } from 'react'
import { Modal, Text, UnstyledButton, Group, ActionIcon, Stack, Button, Collapse } from '@mantine/core'
import { IconFolder, IconFolderOpen, IconChevronRight, IconChevronDown, IconPlus, IconDots, IconEdit, IconTrash, IconFolders } from '@tabler/icons-react'
import { Folder } from '../../../shared/folderTypes'

interface FolderManageModalProps {
    /** Whether the modal is open */
    opened: boolean
    /** Function to close the modal */
    close: () => void
    /** Array of folders in hierarchical structure */
    folders: Folder[]
    /** Set of folder IDs that are currently expanded */
    expandedFolders: Set<string>
    /** ID of the currently selected folder */
    currentFolderId: string
    /** Callback when a folder is selected */
    onFolderSelect: (folderId: string) => void
    /** Callback to toggle folder expansion */
    onToggleExpand: (folderId: string) => void
    /** Callback to create a new folder */
    onCreateFolder: (parentId: string | null) => void
    /** Callback to rename a folder */
    onRenameFolder: (folderId: string) => void
    /** Callback to delete a folder */
    onDeleteFolder: (folderId: string) => void
}

interface FolderItemProps {
    /** The folder data */
    folder: Folder
    /** Whether this folder is currently selected */
    isSelected: boolean
    /** Whether this folder is expanded to show children */
    isExpanded: boolean
    /** Nesting depth for visual indentation */
    depth: number
    /** Whether the actions panel is visible for this folder */
    showActions: boolean
    /** Callback when folder is selected */
    onSelect: () => void
    /** Callback to toggle expansion */
    onToggleExpand: () => void
    /** Callback to toggle actions panel */
    onToggleActions: () => void
    /** Callback to create a subfolder */
    onCreateFolder: (parentId: string) => void
    /** Callback to rename this folder */
    onRenameFolder: () => void
    /** Callback to delete this folder */
    onDeleteFolder: () => void
}

/**
 * Individual folder item component with inline actions
 * Handles folder display, expansion, and action menu without dropdown clipping
 */
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
            {/* Folder Row */}
            <UnstyledButton
                style={{
                    width: '100%',
                    padding: `6px ${8 + depth * 16}px`,
                    backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                    borderRadius: '4px'
                }}
            >
                <Group gap="xs" wrap="nowrap">
                    {/* Expand/Collapse Button */}
                    <ActionIcon
                        variant="transparent"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            if (hasChildren) onToggleExpand()
                        }}
                        style={{ opacity: hasChildren ? 1 : 0 }}
                        aria-label={hasChildren ? (isExpanded ? 'Collapse folder' : 'Expand folder') : ''}
                    >
                        {hasChildren && (isExpanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />)}
                    </ActionIcon>

                    {/* Folder Name */}
                    <div
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={onSelect}
                    >
                        {isExpanded ?
                            <IconFolderOpen size={16} color={isSelected ? '#1976d2' : undefined} /> :
                            <IconFolder size={16} color={isSelected ? '#1976d2' : undefined} />
                        }
                        <Text size="sm" c={isSelected ? '#1976d2' : undefined} fw={isSelected ? 600 : 400}>
                            {folder.name}
                        </Text>
                    </div>

                    {/* Actions Menu Button */}
                    <ActionIcon
                        variant="transparent"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation()
                            onToggleActions()
                        }}
                        aria-label="Folder actions"
                    >
                        <IconDots size={12} />
                    </ActionIcon>
                </Group>
            </UnstyledButton>

            {/* Inline Actions Panel */}
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

/**
 * Main folder management modal component
 * Provides organized sections for system views and user folders
 */
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
    // State for tracking which folder has actions panel open (only one at a time)
    const [showActionsFor, setShowActionsFor] = useState<string | null>(null)

    /**
     * Recursively renders a folder and its children with proper indentation
     * @param folder The folder to render
     * @param depth Current nesting depth for indentation
     */
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

                {/* Render children when expanded */}
                {isExpanded && folder.children.length > 0 && (
                    <div>
                        {folder.children.map(child => renderFolder(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    // Filter root folders (folders without parent)
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