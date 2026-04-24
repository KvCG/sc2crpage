import { useEffect, useState, useCallback } from 'react'
import {
    Alert,
    Badge,
    Button,
    Group,
    Loader,
    Paper,
    Radio,
    Select,
    Stack,
    Table,
    Text,
    Title,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import {
    getCommunityPlayers,
    getAdminPendingMatches,
    confirmAdminPendingMatch,
    rejectAdminPendingMatch,
} from '../services/api'
import type { PendingMatch } from '../../shared/types'

// Map characterId → display name (name if set, else btag without discriminator)
type PlayerNameMap = Map<number, string>

const REASON_LABELS: Record<PendingMatch['reason'], string> = {
    multi_winner: 'Multiple winners',
    '3plus_active_after_dedup': '3+ active players',
    uneven_active_sides: 'Uneven active sides',
}

const formatDate = (iso: string): string => iso.slice(0, 10)

const resolvePlayerName = (characterId: number, nameMap: PlayerNameMap): string => {
    return nameMap.get(characterId) ?? String(characterId)
}

// ---------------------------------------------------------------------------
// PendingMatchCard — single row in the review list
// ---------------------------------------------------------------------------

interface PendingMatchCardProps {
    match: PendingMatch
    nameMap: PlayerNameMap
    onConfirm: (id: number, p1: number, p2: number, winner: number) => Promise<void>
    onReject: (id: number) => Promise<void>
}

const PendingMatchCard: React.FC<PendingMatchCardProps> = ({
    match,
    nameMap,
    onConfirm,
    onReject,
}) => {
    const [player1Id, setPlayer1Id] = useState<number | null>(null)
    const [player2Id, setPlayer2Id] = useState<number | null>(null)
    const [winnerId, setWinnerId] = useState<number | null>(null)
    const [busy, setBusy] = useState(false)
    const [actionError, setActionError] = useState<string | null>(null)

    const candidateOptions = match.candidateIds.map((id) => ({
        value: String(id),
        label: resolvePlayerName(id, nameMap),
    }))

    // Confirm is valid only when both players are selected, they differ, and a winner is chosen
    const confirmEnabled =
        player1Id !== null &&
        player2Id !== null &&
        player1Id !== player2Id &&
        winnerId !== null

    const handleConfirm = async () => {
        if (!confirmEnabled) return
        setBusy(true)
        setActionError(null)
        try {
            await onConfirm(match.id, player1Id!, player2Id!, winnerId!)
        } catch {
            setActionError('Confirm failed. Please try again.')
            setBusy(false)
        }
    }

    const handleReject = async () => {
        setBusy(true)
        setActionError(null)
        try {
            await onReject(match.id)
        } catch {
            setActionError('Reject failed. Please try again.')
            setBusy(false)
        }
    }

    // Winner options restricted to the two selected players
    const winnerOptions =
        player1Id !== null && player2Id !== null && player1Id !== player2Id
            ? [
                  { value: String(player1Id), label: resolvePlayerName(player1Id, nameMap) },
                  { value: String(player2Id), label: resolvePlayerName(player2Id, nameMap) },
              ]
            : []

    return (
        <Paper withBorder p="md" radius="sm">
            {/* Header row */}
            <Group justify="space-between" mb="xs">
                <Group gap="xs">
                    <Badge variant="outline">{REASON_LABELS[match.reason]}</Badge>
                    <Badge color="blue" variant="light">
                        {match.inferredMode}
                    </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                    #{match.id}
                </Text>
            </Group>

            {/* Match metadata */}
            <Stack gap={4} mb="sm">
                <Text size="sm">
                    <Text span fw={600}>Date: </Text>
                    {formatDate(match.matchDate)}
                </Text>
                <Text size="sm">
                    <Text span fw={600}>Map: </Text>
                    {match.mapName || '—'}
                </Text>
                <Text size="sm">
                    <Text span fw={600}>Region: </Text>
                    {match.region}
                </Text>
                <Text size="sm">
                    <Text span fw={600}>Counts: </Text>
                    {match.activePlayerCount} active · {match.winCount}W / {match.lossCount}L /{' '}
                    {match.observerCount} obs
                </Text>
            </Stack>

            {/* Raw decision context — preserved for non-1v1 awareness */}
            {match.rawDecisions.length > 0 && (
                <Table striped withTableBorder mb="sm" fz="xs">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Candidate</Table.Th>
                            <Table.Th>Decision</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {match.rawDecisions.map((d) => (
                            <Table.Tr key={d.characterId}>
                                <Table.Td>{resolvePlayerName(d.characterId, nameMap)}</Table.Td>
                                <Table.Td>{d.decision}</Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}

            {/* Selection controls */}
            <Stack gap="xs">
                <Group gap="sm" align="flex-end">
                    <Select
                        label="Player 1"
                        placeholder="Select player"
                        data={candidateOptions}
                        value={player1Id !== null ? String(player1Id) : null}
                        onChange={(val) => {
                            setPlayer1Id(val !== null ? Number(val) : null)
                            setWinnerId(null)
                        }}
                        style={{ flex: 1 }}
                        size="xs"
                    />
                    <Select
                        label="Player 2"
                        placeholder="Select player"
                        data={candidateOptions}
                        value={player2Id !== null ? String(player2Id) : null}
                        onChange={(val) => {
                            setPlayer2Id(val !== null ? Number(val) : null)
                            setWinnerId(null)
                        }}
                        style={{ flex: 1 }}
                        size="xs"
                    />
                </Group>

                {winnerOptions.length > 0 && (
                    <Radio.Group
                        label="Winner"
                        value={winnerId !== null ? String(winnerId) : undefined}
                        onChange={(val) => setWinnerId(Number(val))}
                    >
                        <Group gap="sm" mt={4}>
                            {winnerOptions.map((opt) => (
                                <Radio key={opt.value} value={opt.value} label={opt.label} size="xs" />
                            ))}
                        </Group>
                    </Radio.Group>
                )}

                {actionError && (
                    <Text c="red" size="xs">
                        {actionError}
                    </Text>
                )}

                <Group gap="xs">
                    <Button
                        size="xs"
                        color="green"
                        disabled={!confirmEnabled}
                        loading={busy}
                        onClick={handleConfirm}
                    >
                        Confirm
                    </Button>
                    <Button
                        size="xs"
                        color="red"
                        variant="outline"
                        disabled={busy}
                        onClick={handleReject}
                    >
                        Reject
                    </Button>
                </Group>
            </Stack>
        </Paper>
    )
}

// ---------------------------------------------------------------------------
// PendingMatchReview — page component
// ---------------------------------------------------------------------------

export const PendingMatchReview: React.FC = () => {
    const [matches, setMatches] = useState<PendingMatch[]>([])
    const [nameMap, setNameMap] = useState<PlayerNameMap>(new Map())
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // Per-row success messages keyed by pending match id
    const [successMessages, setSuccessMessages] = useState<Map<number, string>>(new Map())

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

    const loadPending = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const rows = await getAdminPendingMatches()
            setMatches(rows)
        } catch {
            setError('Failed to load pending matches. Please try again.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadPending()
    }, [loadPending])

    const handleConfirm = async (
        id: number,
        player1CharacterId: number,
        player2CharacterId: number,
        winnerCharacterId: number,
    ) => {
        await confirmAdminPendingMatch(id, {
            player1CharacterId,
            player2CharacterId,
            winnerCharacterId,
        })
        setMatches((current) => current.filter((m) => m.id !== id))
        setSuccessMessages((prev) => new Map(prev).set(id, 'Match confirmed'))
    }

    const handleReject = async (id: number) => {
        await rejectAdminPendingMatch(id)
        setMatches((current) => current.filter((m) => m.id !== id))
        setSuccessMessages((prev) => new Map(prev).set(id, 'Match rejected'))
    }

    return (
        <>
            <Title order={2} mb="md">
                Pending Matches
            </Title>

            {loading && <Loader size="sm" />}

            {!loading && error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
                    {error}
                </Alert>
            )}

            {/* Inline success banners for recently actioned rows */}
            {successMessages.size > 0 &&
                Array.from(successMessages.values()).map((msg, i) => (
                    <Alert key={i} color="green" mb="xs">
                        {msg}
                    </Alert>
                ))}

            {!loading && !error && matches.length === 0 && successMessages.size === 0 && (
                <Text c="dimmed">No pending matches to review.</Text>
            )}

            {!loading && !error && matches.length > 0 && (
                <Stack gap="sm">
                    {matches.map((match) => (
                        <PendingMatchCard
                            key={match.id}
                            match={match}
                            nameMap={nameMap}
                            onConfirm={handleConfirm}
                            onReject={handleReject}
                        />
                    ))}
                </Stack>
            )}
        </>
    )
}
