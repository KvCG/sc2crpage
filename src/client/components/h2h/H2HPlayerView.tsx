import { useEffect, useRef, useState } from 'react'
import { Autocomplete, Group, Skeleton, Table, Text } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import { getPlayerH2HPairs, getSnapshot } from '../../services/api'
import { raceAssets } from '../../constants/races'
import type { TopPairEntry, RankedPlayer } from '../../../shared/types'

interface PlayerOption {
    value: string
    label: string
    id: number
}

interface H2HPlayerViewProps {
    players: PlayerOption[]
    onSelectPair: (p1Id: number, p2Id: number) => void
    initialFocalId?: number
}

const formatWinPct = (wins: number, total: number): string => {
    if (total === 0) return '—'
    return `${(wins / total * 100).toFixed(0)}%`
}

const formatDate = (iso: string): string => iso.slice(0, 10)

export const H2HPlayerView = ({ players, onSelectPair, initialFocalId }: H2HPlayerViewProps) => {
    const [focalInput, setFocalInput] = useState('')
    const [focalId, setFocalId] = useState<number | null>(initialFocalId ?? null)
    const [pairs, setPairs] = useState<TopPairEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [raceMap, setRaceMap] = useState<Map<number, string>>(new Map())
    const initialPopulated = useRef(false)

    // Pre-populate focal player from URL param once players array is ready
    useEffect(() => {
        if (initialPopulated.current || initialFocalId === undefined || players.length === 0) return
        const opt = players.find(p => p.id === initialFocalId)
        if (opt) {
            setFocalInput(opt.label)
            initialPopulated.current = true
        }
    }, [initialFocalId, players])

    // Build raceMap from ranking snapshot on mount (best-effort)
    useEffect(() => {
        getSnapshot()
            .then(res => {
                const players = res.data?.data as RankedPlayer[] | undefined
                if (!Array.isArray(players)) return
                const map = new Map<number, string>()
                for (const p of players) {
                    if (typeof p.id === 'number' && p.mainRace) {
                        map.set(p.id, p.mainRace)
                    }
                }
                setRaceMap(map)
            })
            .catch(() => { /* race display is best-effort */ })
    }, [])

    // Fetch pairs when a focal player is selected
    useEffect(() => {
        if (focalId === null) {
            setPairs([])
            return
        }
        setLoading(true)
        getPlayerH2HPairs(focalId)
            .then(res => setPairs(res.data as TopPairEntry[]))
            .catch(() => setPairs([]))
            .finally(() => setLoading(false))
    }, [focalId])

    const handleFocalChange = (value: string) => {
        setFocalInput(value)
        const opt = players.find(p => p.label === value)
        setFocalId(opt?.id ?? null)
    }

    const focalOption = focalId !== null ? players.find(p => p.id === focalId) : undefined
    const focalRace = focalId !== null ? raceMap.get(focalId) : undefined
    const focalRaceAsset = focalRace ? raceAssets[focalRace as keyof typeof raceAssets] : undefined

    const renderContent = () => {
        if (focalId === null) {
            return (
                <Text c="dimmed" ta="center">
                    Select a player to see their match record
                </Text>
            )
        }

        if (loading) {
            return (
                <Skeleton visible>
                    <Table>
                        <Table.Tbody>
                            {[1, 2, 3].map(i => (
                                <Table.Tr key={i}>
                                    <Table.Td>Loading…</Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Skeleton>
            )
        }

        if (pairs.length === 0) {
            return (
                <Text c="dimmed">No recorded matches for this player</Text>
            )
        }

        return (
            <Table highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>Opponent</Table.Th>
                        <Table.Th>Race</Table.Th>
                        <Table.Th>W</Table.Th>
                        <Table.Th>L</Table.Th>
                        <Table.Th>Total</Table.Th>
                        <Table.Th>Win%</Table.Th>
                        <Table.Th>Last Played</Table.Th>
                        <Table.Th />
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {pairs.map(pair => {
                        const opponent = pair.player2
                        const opponentRace = raceMap.get(opponent.characterId)
                        const opponentRaceAsset = opponentRace
                            ? raceAssets[opponentRace as keyof typeof raceAssets]
                            : undefined
                        const opponentName = opponent.name?.trim() || opponent.btag.split('#')[0]
                        return (
                            <Table.Tr
                                key={opponent.characterId}
                                style={{ cursor: 'pointer' }}
                                onClick={() => onSelectPair(focalId, opponent.characterId)}
                            >
                                <Table.Td>{opponentName}</Table.Td>
                                <Table.Td>
                                    {opponentRaceAsset ? (
                                        <img
                                            src={opponentRaceAsset.assetPath}
                                            alt={opponentRace}
                                            style={{ width: 20, height: 20 }}
                                        />
                                    ) : '—'}
                                </Table.Td>
                                <Table.Td>{pair.player1Wins}</Table.Td>
                                <Table.Td>{pair.player2Wins}</Table.Td>
                                <Table.Td>{pair.matchCount}</Table.Td>
                                <Table.Td>{formatWinPct(pair.player1Wins, pair.matchCount)}</Table.Td>
                                <Table.Td>{formatDate(pair.lastMatchDate)}</Table.Td>
                                <Table.Td>
                                    <IconChevronRight size={16} />
                                </Table.Td>
                            </Table.Tr>
                        )
                    })}
                </Table.Tbody>
            </Table>
        )
    }

    return (
        <div>
            <Autocomplete
                label="Focal player"
                placeholder="Search player…"
                data={players.map(p => p.label)}
                value={focalInput}
                onChange={handleFocalChange}
                mb="md"
            />
            {focalOption && (
                <Group mb="sm" gap="xs">
                    {focalRaceAsset && (
                        <img
                            src={focalRaceAsset.assetPath}
                            alt={focalRace}
                            style={{ width: 20, height: 20 }}
                        />
                    )}
                    <Text fw={600}>{focalOption.label}</Text>
                </Group>
            )}
            {renderContent()}
        </div>
    )
}
