import { useEffect, useState, useCallback } from 'react'
import {
    Alert,
    Badge,
    Button,
    Group,
    Loader,
    Paper,
    Stack,
    Tabs,
    Text,
    Textarea,
    Title,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import {
    getCommunityPlayers,
    getAdminFlags,
    patchAdminFlag,
} from '../services/api'
import type { H2HFlagWithMatch, MatchFlagStatus } from '../../shared/types'

// Map characterId → display name (name if set, else btag without discriminator)
type PlayerNameMap = Map<number, string>

const FLAG_TABS: { value: MatchFlagStatus | 'all'; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
]

const STATUS_COLORS: Record<MatchFlagStatus, string> = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
}

const FLAG_TYPE_LABELS: Record<string, string> = {
    void: 'Void',
    showmatch: 'Showmatch',
    tournament: 'Tournament',
}

const formatDate = (iso: string): string => iso.slice(0, 10)

const resolvePlayerName = (characterId: number, nameMap: PlayerNameMap): string => {
    return nameMap.get(characterId) ?? String(characterId)
}

interface FlagCardProps {
    flag: H2HFlagWithMatch
    nameMap: PlayerNameMap
    onApprove: (flagId: number) => Promise<void>
    onReject: (flagId: number, note: string) => Promise<void>
}

const FlagCard: React.FC<FlagCardProps> = ({ flag, nameMap, onApprove, onReject }) => {
    const [rejectOpen, setRejectOpen] = useState(false)
    const [adminNote, setAdminNote] = useState('')
    const [busy, setBusy] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    const player1Name = resolvePlayerName(flag.player1CharacterId, nameMap)
    const player2Name = resolvePlayerName(flag.player2CharacterId, nameMap)

    const handleApprove = async () => {
        setBusy(true)
        setActionError(null)
        try {
            await onApprove(flag.id)
        } catch {
            setActionError('Approve failed. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    const handleRejectSubmit = async () => {
        setBusy(true)
        setActionError(null)
        try {
            await onReject(flag.id, adminNote)
        } catch {
            setActionError('Reject failed. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Paper withBorder p="md" radius="sm">
            <Group justify="space-between" mb="xs">
                <Group gap="xs">
                    <Badge color={STATUS_COLORS[flag.status]}>{flag.status}</Badge>
                    <Badge variant="outline">{FLAG_TYPE_LABELS[flag.flagType] ?? flag.flagType}</Badge>
                </Group>
                <Text size="xs" c="dimmed">#{flag.id}</Text>
            </Group>

            <Stack gap={4} mb="sm">
                <Text size="sm">
                    <Text span fw={600}>Players: </Text>
                    {player1Name} vs {player2Name}
                </Text>
                <Text size="sm">
                    <Text span fw={600}>Date: </Text>
                    {formatDate(flag.match.date)}
                </Text>
                <Text size="sm">
                    <Text span fw={600}>Map: </Text>
                    {flag.match.map ?? '—'}
                </Text>
                {flag.reason && (
                    <Text size="sm">
                        <Text span fw={600}>Reason: </Text>
                        {flag.reason}
                    </Text>
                )}
                <Text size="sm">
                    <Text span fw={600}>Submitted by: </Text>
                    {flag.submittedBy}
                </Text>
                {flag.adminNote && (
                    <Text size="sm">
                        <Text span fw={600}>Admin note: </Text>
                        {flag.adminNote}
                    </Text>
                )}
            </Stack>

            {actionError && (
                <Text c="red" size="sm" mb="xs">{actionError}</Text>
            )}

            {flag.status === 'pending' && (
                <Stack gap="xs">
                    {!rejectOpen ? (
                        <Group gap="xs">
                            <Button
                                size="xs"
                                color="green"
                                loading={busy}
                                onClick={handleApprove}
                            >
                                Approve
                            </Button>
                            <Button
                                size="xs"
                                color="red"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setRejectOpen(true)}
                            >
                                Reject
                            </Button>
                        </Group>
                    ) : (
                        <Stack gap="xs">
                            <Textarea
                                placeholder="Admin note (optional)"
                                value={adminNote}
                                onChange={(event) => setAdminNote(event.currentTarget.value)}
                                maxLength={500}
                                autosize
                                minRows={2}
                            />
                            <Group gap="xs">
                                <Button
                                    size="xs"
                                    color="red"
                                    loading={busy}
                                    onClick={handleRejectSubmit}
                                >
                                    Confirm Reject
                                </Button>
                                <Button
                                    size="xs"
                                    variant="subtle"
                                    disabled={busy}
                                    onClick={() => {
                                        setRejectOpen(false)
                                        setAdminNote('')
                                    }}
                                >
                                    Cancel
                                </Button>
                            </Group>
                        </Stack>
                    )}
                </Stack>
            )}
        </Paper>
    )
}

export const FlagReview: React.FC = () => {
    const [activeTab, setActiveTab] = useState<MatchFlagStatus | 'all'>('pending')
    const [flags, setFlags] = useState<H2HFlagWithMatch[]>([])
    const [nameMap, setNameMap] = useState<PlayerNameMap>(new Map())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Load community player name map once on mount
    useEffect(() => {
        getCommunityPlayers()
            .then((res) => {
                const players = res.data as Array<{ id: string; btag: string; name?: string | null }>
                const map: PlayerNameMap = new Map(
                    players.map((player) => [
                        Number(player.id),
                        player.name?.trim() || player.btag.trim().split('#')[0],
                    ])
                )
                setNameMap(map)
            })
            .catch(() => {
                // Non-fatal: cards will fall back to characterId
            })
    }, [])

    const loadFlags = useCallback(async (tab: MatchFlagStatus | 'all') => {
        setLoading(true)
        setError(null)
        try {
            const statusParam = tab === 'all' ? undefined : tab
            const rawFlags = await getAdminFlags(statusParam ? { status: statusParam } : {})
            setFlags(rawFlags)
        } catch {
            setError('Failed to load flags. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadFlags(activeTab)
    }, [activeTab, loadFlags])

    const handleTabChange = (value: string | null) => {
        if (value) {
            setActiveTab(value as MatchFlagStatus | 'all')
        }
    }

    const handleApprove = async (flagId: number) => {
        const updated = await patchAdminFlag(flagId, { action: 'approve' })
        setFlags((current) =>
            current.map((flag) => (flag.id === flagId ? { ...flag, ...updated } : flag))
        )
    }

    const handleReject = async (flagId: number, adminNote: string) => {
        const updated = await patchAdminFlag(flagId, {
            action: 'reject',
            adminNote: adminNote.trim() || null,
        })
        setFlags((current) =>
            current.map((flag) => (flag.id === flagId ? { ...flag, ...updated } : flag))
        )
    }

    // When viewing 'all' tab, show updated status in-place; other tabs filter out non-matching
    const visibleFlags =
        activeTab === 'all'
            ? flags
            : flags.filter((flag) => flag.status === activeTab)

    return (
        <>
            <Title order={2} mb="md">Flag Review</Title>

            <Tabs value={activeTab} onChange={handleTabChange} mb="md">
                <Tabs.List>
                    {FLAG_TABS.map((tab) => (
                        <Tabs.Tab key={tab.value} value={tab.value}>
                            {tab.label}
                        </Tabs.Tab>
                    ))}
                </Tabs.List>
            </Tabs>

            {loading && <Loader size="sm" />}

            {!loading && error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
                    {error}
                </Alert>
            )}

            {!loading && !error && visibleFlags.length === 0 && (
                <Text c="dimmed">No flags found.</Text>
            )}

            {!loading && !error && visibleFlags.length > 0 && (
                <Stack gap="sm">
                    {visibleFlags.map((flag) => (
                        <FlagCard
                            key={flag.id}
                            flag={flag}
                            nameMap={nameMap}
                            onApprove={handleApprove}
                            onReject={handleReject}
                        />
                    ))}
                </Stack>
            )}
        </>
    )
}
