import { Table, Text, Skeleton, Center } from '@mantine/core'
import type { TopPairEntry } from '../../../shared/types'

interface H2HTopPairsProps {
    pairs: TopPairEntry[]
    onSelectPair: (p1Id: number, p2Id: number) => void
    isLoading: boolean
}

const formatDate = (iso: string): string => iso.slice(0, 10)

const displayName = (player: { btag: string; name?: string }): string =>
    player.name ?? player.btag.split('#')[0]

export const H2HTopPairs = ({ pairs, onSelectPair, isLoading }: H2HTopPairsProps) => {
    return (
        <Skeleton visible={isLoading}>
            {pairs.length === 0 && !isLoading ? (
                <Center py="xl">
                    <Text c="dimmed">No rivalries recorded yet</Text>
                </Center>
            ) : (
                <Table stickyHeader highlightOnHover highlightOnHoverColor="dark" verticalSpacing="sm">
                    <Table.Thead>
                        <Table.Tr>
                            <Table.Th>Player 1</Table.Th>
                            <Table.Th>Player 2</Table.Th>
                            <Table.Th>Matches</Table.Th>
                            <Table.Th>Record</Table.Th>
                            <Table.Th>Last Played</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {pairs.map((pair, index) => (
                            <Table.Tr
                                key={index}
                                style={{ cursor: 'pointer' }}
                                onClick={() =>
                                    onSelectPair(
                                        pair.player1.characterId,
                                        pair.player2.characterId,
                                    )
                                }
                            >
                                <Table.Td>{displayName(pair.player1)}</Table.Td>
                                <Table.Td>{displayName(pair.player2)}</Table.Td>
                                <Table.Td>{pair.matchCount}</Table.Td>
                                <Table.Td>{`${pair.player1Wins}–${pair.player2Wins}`}</Table.Td>
                                <Table.Td>
                                    {pair.lastMatchDate ? formatDate(pair.lastMatchDate) : '—'}
                                </Table.Td>
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}
        </Skeleton>
    )
}
