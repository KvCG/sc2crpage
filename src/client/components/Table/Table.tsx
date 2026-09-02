import { useState } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { Table, Skeleton, Grid, Text, Flex, Chip, Button, Group } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import classes from './Table.module.css'
import { raceAssets } from '../../constants/races'
import { RankingTableColumnFilters } from './TableColumnFilters'
import { RankingTableRow } from './RankingTableRow'
import { usePersistedColumns } from '../../hooks/usePersistedColumns'
import { DEFAULT_VISIBLE_COLUMNS } from '../../utils/tableHelpers'
import { RankingCardList } from './RankingCardList'
import cx from 'clsx'
import { filterByRace, countRaces, normalizeRace, getRaceDisplayName } from '../../utils/raceUtils'
import type { DecoratedRow } from '../../utils/rankingHelper'
import type { H2HQuickViewPlayer } from '../../types/h2hQuickView'

type TableProps = {
    data: DecoratedRow[] | null
    loading: boolean
    onOpenH2HQuickView?: (player: H2HQuickViewPlayer) => void
    onRefresh?: () => void
    refreshLoading?: boolean
}
export function RankingTable({ data, loading, onOpenH2HQuickView, onRefresh, refreshLoading }: TableProps) {
    const isSmallScreen = useMediaQuery('(max-width: 48em)') ?? false
    const [selectedRace, setSelectedRace] = useState<string>('')

    const initialColumns = DEFAULT_VISIBLE_COLUMNS // Columns no longer depend on screen size (S21-T7: mobile renders a list)
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
                    <Text ta="left" mb="md" size="xs" c="dimmed">
                        Select a race to filter the table. Click again to remove.
                    </Text>
                )}
                {!loading && data && (
                    <Flex
                        direction="row"
                        wrap="wrap"
                        align="center"
                        justify="space-between"
                        gap="sm"
                        mb="md"
                        data-controls-row=""
                    >
                        <Flex direction="row" wrap="wrap" align="center" gap="md">
                            {Object.entries(countRaces(data)).map(([race, count]) => {
                                const normalizedRace = normalizeRace(race)
                                return (
                                    <Chip
                                        key={race}
                                        variant={selectedRace === normalizedRace ? 'filled' : 'light'}
                                        color="blue"
                                        checked={selectedRace === normalizedRace}
                                        onChange={() => handleRaceFilter(selectedRace === normalizedRace ? '' : normalizedRace)}
                                        size="lg"
                                        styles={{ checkIcon: { display: 'none' } }}
                                        classNames={{ label: classes.raceChip }}
                                    >
                                        <span className={classes.raceChipContent}>
                                            {/* Same alignment as the table's race/league icons: .rank + .league (text-top) */}
                                            <img
                                                className={cx(classes.rank, classes.league)}
                                                src={raceAssets[normalizedRace as keyof typeof raceAssets]?.assetPath}
                                                alt={getRaceDisplayName(race)}
                                            />
                                            <span className={classes.raceChipLabel}>{getRaceDisplayName(race)}</span>
                                            <span className={classes.raceChipCount}>{count}</span>
                                        </span>
                                    </Chip>
                                )
                            })}
                        </Flex>
                        <Group gap="sm" wrap="nowrap">
                            {onRefresh && (
                                <Button
                                    leftSection={<IconRefresh size={16} />}
                                    variant="light"
                                    size="xs"
                                    onClick={onRefresh}
                                    loading={refreshLoading}
                                >
                                    Refresh
                                </Button>
                            )}
                            {/* No column selector on small screens: the card list has no columns to toggle */}
                            {!isSmallScreen && (
                                <RankingTableColumnFilters
                                    columns={visibleColumns}
                                    onColumnChange={setVisibleColumns}
                                />
                            )}
                        </Group>
                    </Flex>
                )}
                {loading && <div>Loading...</div>}
            </Grid.Col>

            {isSmallScreen ? (
                // S21-T7: mobile renders the card list, not a table. tableData is already race-filtered.
                <Grid.Col span={12}>
                    {tableData?.length ? (
                        <RankingCardList data={tableData} onOpenH2HQuickView={onOpenH2HQuickView} />
                    ) : (
                        <Skeleton visible={loading} miw={250} h={250} />
                    )}
                </Grid.Col>
            ) : (
                <Skeleton className={classes.skeleton} visible={loading} miw={250}>
                    <div className={classes.tableContainer}>
                        <Table
                            verticalSpacing="6"
                            stickyHeader
                            highlightOnHover
                            w="100%"
                            miw={250}
                            mb="md"
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
                                    {visibleColumns.mmr && (
                                        <Table.Th className={classes.mmr}>MMR</Table.Th>
                                    )}
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
                                            onOpenH2HQuickView={onOpenH2HQuickView}
                                        />
                                    ) : null
                                )}
                            </Table.Tbody>
                        </Table>
                    </div>
                </Skeleton>
            )}
        </Grid>
    )
}
