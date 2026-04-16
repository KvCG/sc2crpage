import { Modal, Text } from '@mantine/core'

interface FlagMatchModalProps {
    matchId: number | string | null
    opened: boolean
    onClose: () => void
}

export const FlagMatchModal = ({ matchId, opened, onClose }: FlagMatchModalProps) => {
    return (
        <Modal opened={opened} onClose={onClose} title="Flag Match" size="sm">
            <Text size="sm" c="dimmed">Match ID: {matchId}</Text>
        </Modal>
    )
}
