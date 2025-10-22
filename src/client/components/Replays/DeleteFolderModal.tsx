import { Modal, Text, Button, Group, Alert } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'

interface DeleteFolderModalProps {
    opened: boolean
    close: () => void
    folderName: string
    hasSubfolders: boolean
    hasReplays: boolean
    onDeleteFolder: () => Promise<void>
    isLoading?: boolean
}

export const DeleteFolderModal = ({
    opened,
    close,
    folderName,
    hasSubfolders,
    hasReplays,
    onDeleteFolder,
    isLoading = false
}: DeleteFolderModalProps) => {
    const handleDelete = async () => {
        if (!isLoading) {
            await onDeleteFolder()
            close()
        }
    }

    return (
        <Modal opened={opened} onClose={close} title="Delete Folder">
            <Alert variant="light" color="red" icon={<IconAlertTriangle size={16} />} mb="md">
                This action cannot be undone!
            </Alert>

            <Text size="sm" mb="md">
                Are you sure you want to delete the folder <strong>"{folderName}"</strong>?
            </Text>

            {hasSubfolders && (
                <Text size="sm" c="orange" mb="xs">
                    ⚠️ This folder contains subfolders that will also be deleted.
                </Text>
            )}

            {hasReplays && (
                <Text size="sm" c="orange" mb="xs">
                    ⚠️ This folder contains replays that will be moved to "All Replays".
                </Text>
            )}

            <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={close} disabled={isLoading}>
                    Cancel
                </Button>
                <Button color="red" onClick={handleDelete} loading={isLoading}>
                    Delete Folder
                </Button>
            </Group>
        </Modal>
    )
}