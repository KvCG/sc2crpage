import { useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { Table, Skeleton, Grid, Text, Box, Flex } from '@mantine/core'
import classes from './Table.module.css'
import { raceAssets } from '../../constants/races'
import { RankingTableColumnFilters } from './TableColumnFilters'
import { RankingTableRow } from './RankingTableRow'
import { usePersistedColumns } from '../../hooks/usePersistedColumns'
import { getInitialColumnConfig } from '../../utils/tableHelpers'
import { filterByRace, countRaces, normalizeRace, getRaceDisplayName } from '../../utils/raceUtils'
import type { DecoratedRow } from '../../utils/rankingHelper'

type TableProps = { data: DecoratedRow[] | null; loading: boolean }
export function RankingTable({ data, loading }: TableProps) {
    const isSmallScreen = useMediaQuery('(max-width: 48em)') ?? false
    const [selectedRace, setSelectedRace] = useState<string>('')

    const initialColumns = getInitialColumnConfig(isSmallScreen) // Adjust initial table columns based on screen size
    const [visibleColumns, setVisibleColumns] = usePersistedColumns(initialColumns) // Loads ans saves column preferences in localStorage

    // Filter data based on selected race
    const tableData = selectedRace && data ? filterByRace(data, selectedRace) : data

    const handleRaceFilter = (race: string) => {
        setSelectedRace(race)
    }

    if (!loading && !tableData?.length) {
        return <p>Sc2Pulse is failing to respond, please refresh the page.</p>
    }

    return (
        <Grid gutter="md">
            <Grid.Col span={12}>
                {!loading && Array.isArray(tableData) && tableData.length > 0 && (
                    <Text ta="center" mb="md">
                        Select a race to filter the table. Click again to remove.
                    </Text>
                )}
                {!loading && data && (
                    <Box>
                        <Flex direction="row" gap="xl" wrap="wrap" align="center" justify="center">
                            {Object.entries(countRaces(data)).map(([race, count]) => {
                                const normalizedRace = normalizeRace(race)
                                return (
                                    <Flex key={race} align="center" gap="0.5rem">
                                        <button
                                            style={{ 
                                                border: 'none', 
                                                background: 'none', 
                                                cursor: 'pointer',
                                                opacity: selectedRace === normalizedRace ? 0.7 : 1
                                            }}
                                            onClick={() => handleRaceFilter(selectedRace === normalizedRace ? '' : normalizedRace)}
                                        >
                                            <img
                                                src={raceAssets[normalizedRace as keyof typeof raceAssets]?.assetPath}
                                                alt={getRaceDisplayName(race)}
                                                style={{ width: '36px', height: '36px' }}
                                            />
                                        </button>
                                        <Text>{count}</Text>
                                    </Flex>
                                )
                            })}
                        </Flex>
                    </Box>
                )}
                {loading && <div>Loading...</div>}
            </Grid.Col>

            <Grid.Col span={12}>
                {!loading && Array.isArray(tableData) && tableData.length > 0 && (
                    <RankingTableColumnFilters
                        columns={visibleColumns}
                        onColumnChange={setVisibleColumns}
                    />
                )}
            </Grid.Col>

            <Skeleton className={classes.skeleton} visible={loading} maw={700} miw={250}>
                <div className={classes.tableContainer}>
                    <Table
                        verticalSpacing="3"
                        striped
                        stickyHeader
                        highlightOnHover
                        stripedColor="dark"
                        maw={700}
                        miw={250}
                        mb={50}
                    >
                        <Table.Thead className={classes.header}>
                            <Table.Tr>
                                <Table.Th className={classes.posIndicator}></Table.Th>
                                {visibleColumns.top && (
                                    <Table.Th className={classes.top}>Top</Table.Th>
                                )}
                                {visibleColumns.name && (
                                    <Table.Th className={classes.name}>Name</Table.Th>
                                )}
                                {visibleColumns.mmr && <Table.Th>MMR</Table.Th>}
                                {visibleColumns.rank && <Table.Th>Rank</Table.Th>}
                                {visibleColumns.race && <Table.Th>Race</Table.Th>}

                                {visibleColumns.terran && <Table.Th># Terran</Table.Th>}
                                {visibleColumns.protoss && <Table.Th># Protoss</Table.Th>}
                                {visibleColumns.zerg && <Table.Th># Zerg</Table.Th>}
                                {visibleColumns.random && <Table.Th># Random</Table.Th>}
                                {visibleColumns.total && (
                                    <Table.Th title="Total games played this season">
                                        Total Games
                                    </Table.Th>
                                )}
                                {visibleColumns.lastPlayed && <Table.Th>Last Played</Table.Th>}
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {tableData?.map((row: DecoratedRow, index: number) =>
                                row.rating ? (
                                    <RankingTableRow
                                        key={row.btag}
                                        row={row}
                                        index={index}
                                        visibleColumns={visibleColumns}
                                    />
                                ) : null
                            )}
                        </Table.Tbody>
                    </Table>
                </div>
            </Skeleton>
        </Grid>
    )
}
