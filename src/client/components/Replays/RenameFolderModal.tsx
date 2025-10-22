import { Modal, TextInput, Button, Group } from '@mantine/core'
import { useState, useEffect, useRef } from 'react'

interface RenameFolderModalProps {
    opened: boolean
    close: () => void
    folderName: string
    onRenameFolder: (newName: string) => Promise<void>
    isLoading?: boolean
}

export const RenameFolderModal = ({
    opened,
    close,
    folderName,
    onRenameFolder,
    isLoading = false
}: RenameFolderModalProps) => {
    const [newName, setNewName] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (opened) {
            setNewName(folderName)
            // Select all text when modal opens
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.select()
                }
            }, 100)
        }
    }, [opened, folderName])

    const handleSubmit = async () => {
        if (newName.trim() && newName.trim() !== folderName && !isLoading) {
            await onRenameFolder(newName.trim())
            close()
        }
    }

    const handleClose = () => {
        if (!isLoading) {
            setNewName(folderName)
            close()
        }
    }

    return (
        <Modal opened={opened} onClose={handleClose} title="Rename Folder">
            <TextInput
                ref={inputRef}
                label="Folder name"
                placeholder="Enter new folder name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                autoFocus
                disabled={isLoading}
            />
            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={handleClose} disabled={isLoading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    disabled={!newName.trim() || newName.trim() === folderName || isLoading}
                    loading={isLoading}
                >
                    Rename
                </Button>
            </Group>
        </Modal>
    )
}