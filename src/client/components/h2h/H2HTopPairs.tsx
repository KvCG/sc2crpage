import { SimpleGrid, Card, Badge, Text, Progress, Skeleton, Center, Table, Stack, Group } from '@mantine/core'
import { IconCrown, IconFlame, IconActivity } from '@tabler/icons-react'
import type { TopPairEntry } from '../../../shared/types'

interface H2HTopPairsProps {
    pairs: TopPairEntry[]
    onSelectPair: (p1Id: number, p2Id: number) => void
    isLoading: boolean
}

const RANK_BADGE_COLORS = ['yellow', 'gray', 'orange'] as const

const HEAT_CONFIG = {
    low:    { count: 1, color: 'var(--mantine-color-dimmed)' },
    medium: { count: 2, color: 'var(--mantine-color-orange-5)' },
    high:   { count: 3, color: 'var(--mantine-color-red-5)' },
} as const

function heatLevel(normalized: number): keyof typeof HEAT_CONFIG {
    if (normalized > 0.66) return 'high'
    if (normalized > 0.33) return 'medium'
    return 'low'
}

function isRecentlyActive(lastMatchDate: string | null | undefined): boolean {
    if (!lastMatchDate) return false
    return (Date.now() - new Date(lastMatchDate).getTime()) / (1000 * 60 * 60 * 24) < 30
}

const formatDate = (iso: string): string => iso.slice(0, 10)

const displayName = (player: { btag: string; name?: string }): string =>
    player.name ?? player.btag.split('#')[0]

export const H2HTopPairs = ({ pairs, onSelectPair, isLoading }: H2HTopPairsProps) => {
    const maxHeat = pairs.reduce((max, p) => Math.max(max, p.heatScore), 0) || 1
    const topThree = pairs.slice(0, 3)
    const rest = pairs.slice(3)

    return (
        <Skeleton visible={isLoading}>
            {pairs.length === 0 && !isLoading ? (
                <Center py="xl">
                    <Text c="dimmed">No rivalries recorded yet</Text>
                </Center>
            ) : (
                <Stack gap="md">
                    {topThree.length > 0 && (
                        <SimpleGrid cols={3}>
                            {topThree.map((pair, index) => {
                                const level = heatLevel(pair.heatScore / maxHeat)
                                const { count, color } = HEAT_CONFIG[level]
                                const total = pair.player1Wins + pair.player2Wins || 1
                                const active = isRecentlyActive(pair.lastMatchDate)
                                const p1Leading = pair.player1Wins > pair.player2Wins
                                const p2Leading = pair.player2Wins > pair.player1Wins
                                return (
                                    <Card
                                        key={index}
                                        withBorder
                                        style={{ cursor: 'pointer' }}
                                        data-testid="h2h-rivalry-card"
                                        onClick={() => onSelectPair(pair.player1.characterId, pair.player2.characterId)}
                                    >
                                        <Badge color={RANK_BADGE_COLORS[index]} mb="xs">#{index + 1}</Badge>
                                        <Group gap={4} wrap="nowrap" align="center">
                                            {p1Leading && <IconCrown size={14} color="var(--mantine-color-teal-5)" />}
                                            <Text fw={700} size="lg" c={p1Leading ? 'teal' : undefined}>
                                                {displayName(pair.player1)}
                                            </Text>
                                            <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>{pair.player1Wins}</Text>
                                        </Group>
                                        <Group gap={4} wrap="nowrap" align="center">
                                            {p2Leading && <IconCrown size={14} color="var(--mantine-color-teal-5)" />}
                                            <Text fw={700} size="lg" c={p2Leading ? 'teal' : undefined}>
                                                {displayName(pair.player2)}
                                            </Text>
                                            <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>{pair.player2Wins}</Text>
                                        </Group>
                                        <Progress.Root size="sm" my="xs" data-testid="win-split-bar">
                                            <Progress.Section
                                                value={(pair.player1Wins / total) * 100}
                                                color="blue"
                                            />
                                            <Progress.Section
                                                value={(pair.player2Wins / total) * 100}
                                                color="red"
                                            />
                                        </Progress.Root>
                                        <Text size="xs" c="dimmed" mt={2}>{pair.player1Wins}–{pair.player2Wins}</Text>
                                        <Group gap={4} mt={2}>
                                            {active && <IconActivity size={14} color="var(--mantine-color-teal-5)" aria-label="active" />}
                                            <Group gap={2} data-testid={`heat-${level}`}>
                                                {Array.from({ length: count }, (_, i) => (
                                                    <IconFlame key={i} size={16} color={color} />
                                                ))}
                                            </Group>
                                        </Group>
                                    </Card>
                                )
                            })}
                        </SimpleGrid>
                    )}
                    {rest.length > 0 && (
                        <Table stickyHeader highlightOnHover highlightOnHoverColor="dark" verticalSpacing="sm">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Rank</Table.Th>
                                    <Table.Th>Players</Table.Th>
                                    <Table.Th>Matches</Table.Th>
                                    <Table.Th>Recency</Table.Th>
                                    <Table.Th>Last Played</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {rest.map((pair, index) => {
                                    const rank = index + 4
                                    const active = isRecentlyActive(pair.lastMatchDate)
                                    const p1Leading = pair.player1Wins > pair.player2Wins
                                    const p2Leading = pair.player2Wins > pair.player1Wins
                                    return (
                                        <Table.Tr
                                            key={rank}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => onSelectPair(pair.player1.characterId, pair.player2.characterId)}
                                        >
                                            <Table.Td>#{rank}</Table.Td>
                                            <Table.Td>
                                                <Group gap={6} wrap="nowrap" align="center">
                                                    <Group gap={3} wrap="nowrap" align="center">
                                                        {p1Leading && <IconCrown size={12} color="var(--mantine-color-teal-5)" />}
                                                        <Text size="sm" fw={p1Leading ? 600 : undefined} c={p1Leading ? 'teal' : undefined}>
                                                            {displayName(pair.player1)} ({pair.player1Wins})
                                                        </Text>
                                                    </Group>
                                                    <Text size="sm" c="dimmed">vs</Text>
                                                    <Group gap={3} wrap="nowrap" align="center">
                                                        {p2Leading && <IconCrown size={12} color="var(--mantine-color-teal-5)" />}
                                                        <Text size="sm" fw={p2Leading ? 600 : undefined} c={p2Leading ? 'teal' : undefined}>
                                                            {displayName(pair.player2)} ({pair.player2Wins})
                                                        </Text>
                                                    </Group>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>{pair.matchCount}</Table.Td>
                                            <Table.Td>{active ? <IconActivity size={14} color="var(--mantine-color-teal-5)" aria-label="active" /> : '—'}</Table.Td>
                                            <Table.Td>{pair.lastMatchDate ? formatDate(pair.lastMatchDate) : '—'}</Table.Td>
                                        </Table.Tr>
                                    )
                                })}
                            </Table.Tbody>
                        </Table>
                    )}
                </Stack>
            )}
        </Skeleton>
    )
}
