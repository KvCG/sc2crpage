import { useState } from 'react'
import { Modal, Radio, Textarea, TextInput, Button, Stack, Text } from '@mantine/core'
import { postH2HFlag } from '../../services/api'
import type { MatchFlagType } from '../../../shared/types'

interface FlagMatchModalProps {
    matchId: number | string | null
    player1CharacterId: number
    player2CharacterId: number
    opened: boolean
    onClose: () => void
}

export const FlagMatchModal = ({
    matchId,
    player1CharacterId,
    player2CharacterId,
    opened,
    onClose,
}: FlagMatchModalProps) => {
    const [flagType, setFlagType] = useState<MatchFlagType>('void')
    const [reason, setReason] = useState('')
    const [btag, setBtag] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleClose = () => {
        setFlagType('void')
        setReason('')
        setBtag('')
        setSubmitting(false)
        setSuccess(false)
        setError(null)
        onClose()
    }

    const handleSubmit = async () => {
        if (!matchId) return
        setSubmitting(true)
        setError(null)
        try {
            await postH2HFlag({
                matchId: String(matchId),
                player1CharacterId,
                player2CharacterId,
                flagType,
                reason: flagType === 'void' ? reason : null,
                submittedBy: btag,
            })
            setSuccess(true)
        } catch (err: any) {
            const msg: string =
                err?.response?.data?.error ??
                err?.response?.data?.message ??
                'Failed to submit flag. Please try again.'
            setError(msg)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Modal opened={opened} onClose={handleClose} title="Flag Match" size="sm">
            {success ? (
                <Text size="sm" c="green">Flag submitted — pending admin review</Text>
            ) : (
                <Stack gap="sm">
                    <Radio.Group
                        label="Flag type"
                        value={flagType}
                        onChange={(val) => setFlagType(val as MatchFlagType)}
                    >
                        <Stack gap="xs" mt="xs">
                            <Radio value="void" label="Void" />
                            <Radio value="showmatch" label="Showmatch" />
                            <Radio value="tournament" label="Tournament" />
                        </Stack>
                    </Radio.Group>

                    {flagType === 'void' && (
                        <Textarea
                            label="Reason"
                            placeholder="Explain why this match should be voided"
                            required
                            value={reason}
                            onChange={(e) => setReason(e.currentTarget.value)}
                            minRows={3}
                        />
                    )}

                    <TextInput
                        label="Your BTag"
                        placeholder="PlayerName#1234"
                        required
                        value={btag}
                        onChange={(e) => setBtag(e.currentTarget.value)}
                    />

                    {error && (
                        <Text size="sm" c="red">{error}</Text>
                    )}

                    <Button
                        onClick={handleSubmit}
                        loading={submitting}
                        disabled={!btag.trim() || (flagType === 'void' && !reason.trim())}
                        color="red"
                        variant="filled"
                    >
                        Submit Flag
                    </Button>
                </Stack>
            )}
        </Modal>
    )
}
