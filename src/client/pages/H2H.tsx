import { useEffect, useState, useCallback } from 'react'
import {
    Autocomplete,
    Group,
    Title,
    Text,
    Loader,
    Alert,
    Table,
    Tabs,
    Badge,
    Stack,
    Paper,
    Center,
} from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { getCommunityPlayers, getH2H } from '../services/api'
import type { H2HResponse, H2HMatch } from '../../shared/types'

interface PlayerOption {
    value: string   // characterId as string
    label: string   // display name (btag)
    id: number
}

const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
}

const formatDate = (iso: string): string => iso.slice(0, 10)

const MATCH_TYPE_ALL = 'ALL'
const MATCH_TYPE_LADDER = '_1V1'
const MATCH_TYPE_CUSTOM = 'CUSTOM'

export const H2H = () => {
    const [players, setPlayers] = useState<PlayerOption[]>([])
    const [player1Input, setPlayer1Input] = useState('')
    const [player2Input, setPlayer2Input] = useState('')
    const [player1Id, setPlayer1Id] = useState<number | null>(null)
    const [player2Id, setPlayer2Id] = useState<number | null>(null)

    const [h2hData, setH2hData] = useState<H2HResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [activeTab, setActiveTab] = useState<string>(MATCH_TYPE_ALL)

    // Load community player roster on mount for picker options.
    // Uses the community CSV (all known players) rather than the ranked
    // ladder so inactive or below-threshold players are still reachable.
    useEffect(() => {
        getCommunityPlayers()
            .then(res => {
                const opts: PlayerOption[] = (res.data as Array<{ id: string; btag: string; name?: string | null }>)
                    .map(p => ({
                        value: p.id,
                        label: (p.name?.trim() || p.btag.trim()),
                        id: Number(p.id),
                    }))
                    .filter(p => p.label.length > 0)
                setPlayers(opts)
            })
            .catch(() => {
                // Non-fatal: picker will just be empty
            })
    }, [])

    const fetchH2H = useCallback(async (p1: number, p2: number) => {
        setLoading(true)
        setError(null)
        setH2hData(null)
        try {
            const res = await getH2H(p1, p2)
            setH2hData(res.data as H2HResponse)
        } catch (err: any) {
            const msg: string =
                err?.response?.data?.error ??
                err?.response?.data?.message ??
                'Failed to load match history. Please try again.'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    // Trigger fetch when both players are selected
    useEffect(() => {
        if (player1Id !== null && player2Id !== null) {
            fetchH2H(player1Id, player2Id)
        }
    }, [player1Id, player2Id, fetchH2H])

    const resolvePlayerOption = (label: string): PlayerOption | undefined =>
        players.find(p => p.label === label)

    const handlePlayer1Change = (value: string) => {
        setPlayer1Input(value)
        const opt = resolvePlayerOption(value)
        setPlayer1Id(opt?.id ?? null)
    }

    const handlePlayer2Change = (value: string) => {
        setPlayer2Input(value)
        const opt = resolvePlayerOption(value)
        setPlayer2Id(opt?.id ?? null)
    }

    const filteredMatches = (matches: H2HMatch[]): H2HMatch[] => {
        if (activeTab === MATCH_TYPE_ALL) return matches
        return matches.filter(m => m.type === activeTab)
    }

    const resolveWinner = (match: H2HMatch): string => {
        if (!h2hData) return String(match.winnerCharacterId)
        if (match.winnerCharacterId === h2hData.player1.characterId) return h2hData.player1.name ?? h2hData.player1.btag
        if (match.winnerCharacterId === h2hData.player2.characterId) return h2hData.player2.name ?? h2hData.player2.btag
        return String(match.winnerCharacterId)
    }

    const renderSummaryBanner = () => {
        if (!h2hData) return null
        const { player1, player2, summary } = h2hData
        const p1Name = player1.name ?? player1.btag
        const p2Name = player2.name ?? player2.btag
        const p1Leading = summary.player1Wins > summary.player2Wins
        const p2Leading = summary.player2Wins > summary.player1Wins

        return (
            <Paper withBorder p="md" mb="md">
                <Group justify="center" gap="lg">
                    <Stack align="center" gap={4}>
                        <Text fw={700} size="lg" c={p1Leading ? 'green' : undefined}>
                            {p1Name}
                        </Text>
                        <Badge size="xl" color={p1Leading ? 'green' : 'gray'} variant="filled">
                            {summary.player1Wins}
                        </Badge>
                    </Stack>
                    <Text size="xl" fw={500} c="dimmed">vs</Text>
                    <Stack align="center" gap={4}>
                        <Text fw={700} size="lg" c={p2Leading ? 'green' : undefined}>
                            {p2Name}
                        </Text>
                        <Badge size="xl" color={p2Leading ? 'green' : 'gray'} variant="filled">
                            {summary.player2Wins}
                        </Badge>
                    </Stack>
                </Group>
                <Text ta="center" size="sm" c="dimmed" mt="xs">
                    {summary.totalGames} game{summary.totalGames !== 1 ? 's' : ''} total
                    {summary.lastPlayed ? ` · Last played ${formatDate(summary.lastPlayed)}` : ''}
                </Text>
            </Paper>
        )
    }

    const renderMatchTable = (matches: H2HMatch[]) => {
        if (matches.length === 0) {
            return (
                <Center py="xl">
                    <Text c="dimmed">No custom matches recorded</Text>
                </Center>
            )
        }

        return (
            <Table stickyHeader highlightOnHover highlightOnHoverColor="dark" verticalSpacing="">
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Date</Table.Th>
                        <Table.Th>Map</Table.Th>
                        <Table.Th>Winner</Table.Th>
                        <Table.Th>Duration</Table.Th>
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {matches.map(match => (
                        <Table.Tr key={match.matchId}>
                            <Table.Td>{formatDate(match.date)}</Table.Td>
                            <Table.Td>{match.map}</Table.Td>
                            <Table.Td>{resolveWinner(match)}</Table.Td>
                            <Table.Td>{match.durationSeconds > 0 ? formatDuration(match.durationSeconds) : '—'}</Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        )
    }

    const renderContent = () => {
        if (player1Id === null || player2Id === null) return null

        if (loading) {
            return (
                <Center py="xl">
                    <Loader color="green" />
                </Center>
            )
        }

        if (error) {
            return (
                <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
                    {error}
                </Alert>
            )
        }

        if (!h2hData) return null

        const allMatches = filteredMatches(h2hData.matches)

        return (
            <>
                {renderSummaryBanner()}

                    <Tabs value={activeTab} onChange={tab => setActiveTab(tab ?? MATCH_TYPE_ALL)}>
                    <Tabs.List mb="sm">
                        <Tabs.Tab value={MATCH_TYPE_ALL}>All</Tabs.Tab>
                        <Tabs.Tab value={MATCH_TYPE_LADDER}>Ladder</Tabs.Tab>
                        <Tabs.Tab value={MATCH_TYPE_CUSTOM}>Custom</Tabs.Tab>
                    </Tabs.List>
                </Tabs>

                {renderMatchTable(allMatches)}

                <Text size="xs" c="dimmed" mt="md">
                    Match history sourced from SC2Pulse (up to 90 days). Includes ladder and custom
                    matches. Custom matches may be missing if not captured in time.
                </Text>
            </>
        )
    }

    return (
        <>
            <Title order={2} mb="md">Head to Head</Title>

            <Group align="flex-end" mb="lg">
                <Autocomplete
                    label="Player 1"
                    placeholder="Search player…"
                    data={players.map(p => ({ value: p.value, label: p.label }))}
                    value={player1Input}
                    onChange={handlePlayer1Change}
                    miw={220}
                    aria-label="Select Player 1"
                />
                <Autocomplete
                    label="Player 2"
                    placeholder="Search player…"
                    data={players.map(p => ({ value: p.value, label: p.label }))}
                    value={player2Input}
                    onChange={handlePlayer2Change}
                    miw={220}
                    aria-label="Select Player 2"
                />
            </Group>

            {renderContent()}
        </>
    )
}
