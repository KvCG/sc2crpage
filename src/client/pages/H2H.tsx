import { useEffect, useState, useCallback } from 'react'
import {
    Autocomplete,
    ActionIcon,
    Button,
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
import { IconAlertCircle, IconFlag } from '@tabler/icons-react'
import { useSearchParams } from 'react-router-dom'
import { getCommunityPlayers, getH2H, getTopH2HPairs } from '../services/api'
import type { H2HResponse, H2HMatch, TopPairEntry } from '../../shared/types'
import { FlagMatchModal } from '../components/Match/FlagMatchModal'
import { H2HTopPairs } from '../components/h2h/H2HTopPairs'

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
const MATCH_TYPE_SHOWMATCH = 'showmatch'
const MATCH_TYPE_TOURNAMENT = 'tournament'

const parseCharacterIdParam = (rawValue: string | null): number | null => {
    if (rawValue === null) return null

    let decodedValue = rawValue
    try {
        decodedValue = decodeURIComponent(rawValue).trim()
    } catch {
        return null
    }

    if (!/^\d+$/.test(decodedValue)) return null

    const parsedValue = Number(decodedValue)
    if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) return null

    return parsedValue
}

export const H2H = () => {
    const [searchParams] = useSearchParams()
    const [players, setPlayers] = useState<PlayerOption[]>([])
    const [showPicker, setShowPicker] = useState(false)
    const [player1Input, setPlayer1Input] = useState('')
    const [player2Input, setPlayer2Input] = useState('')
    const [player1Id, setPlayer1Id] = useState<number | null>(null)
    const [player2Id, setPlayer2Id] = useState<number | null>(null)
    const [isUrlPairHydrated, setIsUrlPairHydrated] = useState(false)

    const [topPairs, setTopPairs] = useState<TopPairEntry[]>([])
    const [topPairsLoading, setTopPairsLoading] = useState(true)

    const [h2hData, setH2hData] = useState<H2HResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [activeTab, setActiveTab] = useState<string>(MATCH_TYPE_ALL)
    const [flaggedMatchId, setFlaggedMatchId] = useState<number | string | null>(null)

    // Fetch top active rivalries on mount for the landing state.
    useEffect(() => {
        getTopH2HPairs()
            .then(res => setTopPairs(res.data as TopPairEntry[]))
            .catch(() => { /* non-fatal */ })
            .finally(() => setTopPairsLoading(false))
    }, [])

    // Load community player roster on mount for picker options.
    // Uses the community CSV (all known players) rather than the ranked
    // ladder so inactive or below-threshold players are still reachable.
    useEffect(() => {
        getCommunityPlayers()
            .then(res => {
                const opts: PlayerOption[] = (res.data as Array<{ id: string; btag: string; name?: string | null }>)
                    .map(p => ({
                        value: p.id,
                        label: (p.name?.trim() || p.btag.trim().split('#')[0]), // Show name if available, else btag without discriminator. Limit length for display.
                        id: Number(p.id),
                    }))
                    .filter(p => p.label.length > 0)
                setPlayers(opts)
            })
            .catch(() => {
                // Non-fatal: picker will just be empty
            })
    }, [])

    // Hydrate picker state from URL when launched with preselected players.
    useEffect(() => {
        const player1FromUrl = parseCharacterIdParam(searchParams.get('player1'))
        const player2FromUrl = parseCharacterIdParam(searchParams.get('player2'))

        setPlayer1Id(player1FromUrl)
        setPlayer2Id(player2FromUrl)

        const hasAnyPlayerParam = searchParams.get('player1') !== null || searchParams.get('player2') !== null
        const hasBothPlayers = player1FromUrl !== null && player2FromUrl !== null

        setIsUrlPairHydrated(hasBothPlayers)
        if (hasAnyPlayerParam && !hasBothPlayers) {
            setShowPicker(true)
        }
    }, [searchParams])

    const fetchH2H = useCallback(async (p1: number, p2: number) => {
        setLoading(true)
        setError(null)
        setH2hData(null)
        setActiveTab(MATCH_TYPE_ALL)
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

    const searchInitiated = player1Id !== null && player2Id !== null

    const handleCancel = useCallback(() => {
        setShowPicker(false)
        setIsUrlPairHydrated(false)
        setPlayer1Input('')
        setPlayer2Input('')
        setPlayer1Id(null)
        setPlayer2Id(null)
        setH2hData(null)
        setError(null)
    }, [])

    const handleSelectPair = useCallback((p1Id: number, p2Id: number) => {
        const p1 = players.find(p => p.id === p1Id)
        const p2 = players.find(p => p.id === p2Id)
        if (!p1 || !p2) return
        setShowPicker(true)
        setPlayer1Input(p1.label)
        setPlayer1Id(p1.id)
        setPlayer2Input(p2.label)
        setPlayer2Id(p2.id)
    }, [players])

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
        let result: H2HMatch[]
        if (activeTab === MATCH_TYPE_ALL) result = matches
        else if (activeTab === MATCH_TYPE_SHOWMATCH) result = matches.filter(m => m.matchLabel === 'showmatch')
        else if (activeTab === MATCH_TYPE_TOURNAMENT) result = matches.filter(m => m.matchLabel === 'tournament')
        else result = matches.filter(m => m.type === activeTab)
        return [...result].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }

    const resolveWinner = (match: H2HMatch): string => {
        if (!h2hData) return String(match.winnerCharacterId)
        if (match.winnerCharacterId === h2hData.player1.characterId) return h2hData.player1.name ?? h2hData.player1.btag.split('#')[0]
        if (match.winnerCharacterId === h2hData.player2.characterId) return h2hData.player2.name ?? h2hData.player2.btag.split('#')[0]
        return String(match.winnerCharacterId)
    }

    const renderSummaryBanner = () => {
        if (!h2hData) return null
        const { player1, player2, summary } = h2hData
        const p1Name = player1.name ?? player1.btag.split('#')[0]
        const p2Name = player2.name ?? player2.btag.split('#')[0]
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
                {summary.voidedCount > 0 && (
                    <Text ta="center" size="sm" c="dimmed" mt={4}>
                        {summary.voidedCount} match{summary.voidedCount !== 1 ? 'es' : ''} not counted (voided)
                    </Text>
                )}
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
                        <Table.Th>Type</Table.Th>
                        <Table.Th />
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {matches.map(match => (
                        <Table.Tr key={match.matchId} style={match.isVoided ? { opacity: 0.5 } : undefined}>
                            <Table.Td>{formatDate(match.date)}</Table.Td>
                            <Table.Td>{match.map}</Table.Td>
                            <Table.Td>
                                {match.isVoided ? (
                                    <Group gap="xs" wrap="nowrap" align="center" justify="center">
                                        <Text span td="line-through" inherit>{resolveWinner(match)}</Text>
                                        <Badge color="orange" size="xs" variant="light">Voided</Badge>
                                    </Group>
                                ) : resolveWinner(match)}
                            </Table.Td>
                            <Table.Td>{match.durationSeconds > 0 ? formatDuration(match.durationSeconds) : '—'}</Table.Td>
                            <Table.Td>
                                {match.matchLabel === 'showmatch' && (
                                    <Badge color="violet" size="xs" variant="light">Showmatch</Badge>
                                )}
                                {match.matchLabel === 'tournament' && (
                                    <Badge color="yellow" size="xs" variant="light">Tournament</Badge>
                                )}
                            </Table.Td>
                            <Table.Td>
                                <Group gap={4} wrap="nowrap" align="center">
                                    {match.hasPendingFlag && (
                                        <span role="img" aria-label="Pending flag">
                                            <IconFlag size={14} style={{ opacity: 0.35 }} />
                                        </span>
                                    )}
                                    <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        size="sm"
                                        aria-label="Flag match"
                                        onClick={() => setFlaggedMatchId(match.matchId)}
                                    >
                                        <IconFlag size={14} />
                                    </ActionIcon>
                                </Group>
                            </Table.Td>
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
                        {h2hData.matches.some(m => m.matchLabel === 'showmatch') && (
                            <Tabs.Tab value={MATCH_TYPE_SHOWMATCH}>Showmatch</Tabs.Tab>
                        )}
                        {h2hData.matches.some(m => m.matchLabel === 'tournament') && (
                            <Tabs.Tab value={MATCH_TYPE_TOURNAMENT}>Tournament</Tabs.Tab>
                        )}
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
            <FlagMatchModal
                matchId={flaggedMatchId}
                player1CharacterId={h2hData?.player1.characterId ?? 0}
                player2CharacterId={h2hData?.player2.characterId ?? 0}
                opened={flaggedMatchId !== null}
                onClose={() => setFlaggedMatchId(null)}
            />

            {(showPicker || searchInitiated) && !isUrlPairHydrated && (
                <Group align="flex-end" mb="lg" justify="center">
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
                    {(showPicker || searchInitiated) && (
                        <Button variant="subtle" color="gray" onClick={handleCancel} aria-label="Close compare">
                            Cancel
                        </Button>
                    )}
                </Group>
            )}

            {!searchInitiated ? (
                <Stack gap="xs" mb="xl">
                    <Group justify="space-between" align="center" wrap="nowrap">
                        <div style={{ flex: 1 }} />
                        <Stack gap={2} align="center" style={{ flex: 2 }}>
                            <Title order={3} ta="center">Top Rivalries</Title>
                            <Text size="sm" c="dimmed" ta="center">The most contested matchups in the CR scene</Text>
                        </Stack>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                            {!showPicker && (
                                <Button variant="light" onClick={() => setShowPicker(true)}>
                                    Compare Players
                                </Button>
                            )}
                        </div>
                    </Group>
                    <H2HTopPairs
                        pairs={topPairs}
                        onSelectPair={handleSelectPair}
                        isLoading={topPairsLoading}
                    />
                </Stack>
            ) : (
                renderContent()
            )}
        </>
    )
}
