import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider, Table } from '@mantine/core'
import { RankingTableRow } from './RankingTableRow'

const visibleColumns = {
    top: true,
    name: true,
    mmr: true,
    rank: true,
    race: true,
    lastPlayed: true,
    terran: true,
    protoss: true,
    zerg: true,
    random: true,
    total: true,
}

describe('RankingTableRow H2H action', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens H2H quick-view with player A context when action is clicked', () => {
        const onOpenH2HQuickView = vi.fn()

        render(
            <MantineProvider>
                <Table>
                    <Table.Tbody>
                        <RankingTableRow
                            row={{
                                id: 101,
                                btag: 'Pistola#1234',
                                rating: 5300,
                                mainRace: 'TERRAN',
                                leagueType: 6,
                                positionChangeIndicator: 'none',
                                lastDatePlayed: '-',
                                gamesPerRace: { TERRAN: 100 },
                                totalGames: 100,
                                online: false,
                            }}
                            index={0}
                            visibleColumns={visibleColumns}
                            onOpenH2HQuickView={onOpenH2HQuickView}
                        />
                    </Table.Tbody>
                </Table>
            </MantineProvider>
        )

        const h2hAction = screen.getByRole('button', { name: /open h2h with pistola/i })
        fireEvent.click(h2hAction)

        expect(onOpenH2HQuickView).toHaveBeenCalledWith({
            characterId: 101,
            displayName: 'Pistola',
        })
    })

    it('renders disabled action when ranking row has no character id', () => {
        render(
            <MantineProvider>
                <Table>
                    <Table.Tbody>
                        <RankingTableRow
                            row={{
                                btag: 'NoId#0001',
                                rating: 4900,
                                mainRace: 'PROTOSS',
                                leagueType: 5,
                                positionChangeIndicator: 'none',
                                lastDatePlayed: '-',
                                gamesPerRace: { PROTOSS: 80 },
                                totalGames: 80,
                                online: false,
                            }}
                            index={2}
                            visibleColumns={visibleColumns}
                        />
                    </Table.Tbody>
                </Table>
            </MantineProvider>
        )

        const h2hAction = screen.getByRole('button', { name: /open h2h with noid/i })
        expect(h2hAction).toBeDisabled()
    })
})
