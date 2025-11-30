/**
 * Folder Breadcrumb Navigation Component
 * 
 * Provides hierarchical navigation showing the current folder path.
 * Supports both system views (All Replays, Unorganized) and user folders.
 * Features dropdown menus for quick navigation to any folder in the hierarchy.
 * 
 * @component
 * @example
 * ```tsx
 * <FolderBreadcrumb
 *   currentFolderId="folder123"
 *   folders={folderHierarchy}
 *   onFolderSelect={handleNavigation}
 * />
 * ```
 */

import { Group, Button, Text, Menu, UnstyledButton, Flex } from '@mantine/core'
import { IconFolder, IconChevronRight, IconChevronDown } from '@tabler/icons-react'
import { useState } from 'react'
import { Folder } from '../../../shared/folderTypes'

interface FolderBreadcrumbProps {
    /** ID of the currently selected folder ('all', 'unorganized', or folder ID) */
    currentFolderId: string
    /** Array of folders in hierarchical structure */
    folders: Folder[]
    /** Callback when user navigates to a different folder */
    onFolderSelect: (folderId: string) => void
}

/**
 * Displays breadcrumb navigation for folder hierarchy
 */
export const FolderBreadcrumb = ({
    currentFolderId,
    folders,
    onFolderSelect
}: FolderBreadcrumbProps) => {
    // Track which dropdown menu is currently open
    const [openDropdown, setOpenDropdown] = useState<string | null>(null)

    /**
     * Builds a flat map of all folders for efficient lookup
     */
    const folderMap = new Map<string, Folder>()
    const addToMap = (folderList: Folder[]) => {
        folderList.forEach(folder => {
            folderMap.set(folder.id, folder)
            if (folder.children.length > 0) {
                addToMap(folder.children)
            }
        })
    }
    addToMap(folders)

    /**
     * Builds the breadcrumb path from root to current folder
     * @param folderId The folder ID to build path for
     * @returns Array of folders representing the path
     */
    const buildPath = (folderId: string): Folder[] => {
        // System views don't have breadcrumb paths
        if (folderId === 'all' || folderId === 'unorganized') return []

        const path: Folder[] = []
        let currentFolder = folderMap.get(folderId)

        // Walk up the parent chain to build the path
        while (currentFolder) {
            path.unshift(currentFolder)
            currentFolder = currentFolder.parentId ? folderMap.get(currentFolder.parentId) : undefined
        }

        return path
    }

    const currentPath = buildPath(currentFolderId)

    /**
     * Recursively renders folder options in dropdown menus with proper indentation
     * @param folderList Array of folders to render
     * @param depth Current nesting depth for indentation
     */
    const renderFolderOptions = (folderList: Folder[], depth = 0) => {
        return folderList.map(folder => (
            <div key={folder.id}>
                <Menu.Item
                    onClick={() => onFolderSelect(folder.id)}
                    leftSection={<IconFolder size={14} />}
                    style={{ paddingLeft: 8 + depth * 16 }}
                >
                    {folder.name}
                </Menu.Item>
                {folder.children.length > 0 && renderFolderOptions(folder.children, depth + 1)}
            </div>
        ))
    }

    return (
        <Flex align="center" gap="xs" wrap="wrap">
            {/* Root / All Replays */}
            <Menu opened={openDropdown === 'root'} onChange={(opened) => setOpenDropdown(opened ? 'root' : null)}>
                <Menu.Target>
                    <UnstyledButton
                        style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: (currentFolderId === 'all' || currentFolderId === 'unorganized') ? '#e3f2fd' : 'transparent',
                            border: currentFolderId === 'unorganized' ? '1px dashed var(--mantine-color-orange-4)' : '1px solid #e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <IconFolder
                            size={16}
                            color={
                                currentFolderId === 'all' ? '#1976d2' :
                                    currentFolderId === 'unorganized' ? 'var(--mantine-color-orange-6)' :
                                        undefined
                            }
                        />
                        <Text
                            size="sm"
                            c={(currentFolderId === 'all' || currentFolderId === 'unorganized') ? '#1976d2' : undefined}
                            fw={(currentFolderId === 'all' || currentFolderId === 'unorganized') ? 600 : 400}
                        >
                            {currentFolderId === 'unorganized' ? 'Unorganized Replays' : 'All Replays'}
                        </Text>
                        <IconChevronDown
                            size={12}
                            color={
                                currentFolderId === 'all' ? '#1976d2' :
                                    currentFolderId === 'unorganized' ? 'var(--mantine-color-orange-6)' :
                                        undefined
                            }
                        />
                    </UnstyledButton>
                </Menu.Target>
                <Menu.Dropdown>
                    <Menu.Item
                        onClick={() => onFolderSelect('all')}
                        leftSection={<IconFolder size={14} />}
                    >
                        All Replays
                    </Menu.Item>
                    <Menu.Item
                        onClick={() => onFolderSelect('unorganized')}
                        leftSection={<IconFolder size={14} color="var(--mantine-color-orange-6)" />}
                    >
                        Unorganized Replays
                    </Menu.Item>
                    <Menu.Divider />
                    {renderFolderOptions(folders)}
                </Menu.Dropdown>
            </Menu>

            {/* Breadcrumb path */}
            {currentPath.map((folder, index) => (
                <Group key={folder.id} gap={4} style={{ alignItems: 'center' }}>
                    <IconChevronRight size={12} color="#666" />

                    {index === currentPath.length - 1 ? (
                        // Current folder (not clickable)
                        <Button
                            variant="filled"
                            size="compact-sm"
                            leftSection={<IconFolder size={14} />}
                            style={{ pointerEvents: 'none' }}
                        >
                            {folder.name}
                        </Button>
                    ) : (
                        // Parent folders with dropdown to children
                        <Menu opened={openDropdown === folder.id} onChange={(opened) => setOpenDropdown(opened ? folder.id : null)}>
                            <Menu.Target>
                                <Button
                                    variant="light"
                                    size="compact-sm"
                                    leftSection={<IconFolder size={14} />}
                                    rightSection={folder.children.length > 0 ? <IconChevronDown size={10} /> : null}
                                >
                                    {folder.name}
                                </Button>
                            </Menu.Target>
                            {folder.children.length > 0 && (
                                <Menu.Dropdown>
                                    <Menu.Item
                                        onClick={() => onFolderSelect(folder.id)}
                                        leftSection={<IconFolder size={14} />}
                                    >
                                        {folder.name}
                                    </Menu.Item>
                                    <Menu.Divider />
                                    {renderFolderOptions(folder.children)}
                                </Menu.Dropdown>
                            )}
                        </Menu>
                    )}
                </Group>
            ))}
        </Flex>
    )
}