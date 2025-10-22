import { Modal, TextInput, Button, Group } from '@mantine/core'
import { useState } from 'react'

interface CreateFolderModalProps {
    opened: boolean
    close: () => void
    parentFolderName?: string
    onCreateFolder: (folderName: string) => Promise<void>
    isLoading?: boolean
}

export const CreateFolderModal = ({
    opened,
    close,
    parentFolderName,
    onCreateFolder,
    isLoading = false
}: CreateFolderModalProps) => {
    const [folderName, setFolderName] = useState('')

    const handleSubmit = async () => {
        if (folderName.trim() && !isLoading) {
            await onCreateFolder(folderName.trim())
            setFolderName('')
            close()
        }
    }

    const handleClose = () => {
        if (!isLoading) {
            setFolderName('')
            close()
        }
    }

    return (
        <Modal opened={opened} onClose={handleClose} title="Create New Folder">
            <TextInput
                label={parentFolderName ? `Create folder inside "${parentFolderName}"` : "Create new folder"}
                placeholder="Enter folder name..."
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
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
                    disabled={!folderName.trim() || isLoading}
                    loading={isLoading}
                >
                    Create
                </Button>
            </Group>
        </Modal>
    )
}