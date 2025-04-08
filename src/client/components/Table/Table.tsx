import { useState, useEffect } from 'react'
import { Table, Skeleton, Grid, Text } from '@mantine/core'
import classes from './Table.module.css'
import cx from 'clsx'
import { getLeagueSrc } from '../../utils/rankingHelper'
import { raceAssets } from '../../constants/races'
import { getStandardName } from '../../utils/common'
import { RacesTable } from '../RaceTable/RacesTable'
import { RankingTableColumnFilters, ColumnOptions } from './TableColumnFilters'

const defaultVisibleColumns: ColumnOptions = {
  top: true,
  name: true,
  mmr: true,
  rank: true,
  race: true,
  lastPlayed: false,
  terran: false,
  protoss: false,
  zerg: false,
  random: false,
}

export function RankingTable({ data, loading }) {
    const [tableData, setTableData] = useState(data)

    // Initialize visibleColumns from localStorage if available
    const [visibleColumns, setVisibleColumns] = useState<ColumnOptions>(() => {
        const stored = localStorage.getItem('visibleColumns')
        return stored ? JSON.parse(stored) as ColumnOptions : defaultVisibleColumns
    })

    // Persist visibleColumns state changes to localStorage
    useEffect(() => {
        localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns))
    }, [visibleColumns])

    const rows = tableData?.map((row, index) => {
        if (row.ratingLast) {
            const {
                btag,
                ratingLast,
                race,
                leagueTypeLast,
                positionChangeIndicator,
                name,
                lastDatePlayed,
                gamesPerRace
            } = row
            return (
                <Table.Tr key={btag}>
                    <Table.Td
                        className={classes.posIndicator}
                        data-content={positionChangeIndicator}
                    >
                        {positionChangeIndicator}
                    </Table.Td>
                    {visibleColumns.top && <Table.Td className={classes.top}>{index + 1}</Table.Td>}
                    {visibleColumns.name && (
                        <Table.Td title={btag}>
                            {getStandardName(row)}
                        </Table.Td>
                    )}
                    {visibleColumns.mmr && <Table.Td>{ratingLast}</Table.Td>}
                    {visibleColumns.rank && (
                        <Table.Td>
                            <img
                                className={classes.rank}
                                src={getLeagueSrc(leagueTypeLast)}
                                alt="league"
                            />
                        </Table.Td>
                    )}
                    {visibleColumns.race && (
                        <Table.Td
                            className={cx('', {
                                [raceAssets[race]?.className]: true,
                            })}
                        >
                            <img
                                className={classes.rank}
                                src={raceAssets[race]?.assetPath}
                                alt={race}
                            />
                        </Table.Td>
                    )}
                    {visibleColumns.lastPlayed && <Table.Td>{lastDatePlayed}</Table.Td>}
                    {visibleColumns.terran && <Table.Td>{gamesPerRace?.terranGamesPlayed}</Table.Td>}
                    {visibleColumns.protoss && <Table.Td>{gamesPerRace?.protossGamesPlayed}</Table.Td>}
                    {visibleColumns.zerg && <Table.Td>{gamesPerRace?.zergGamesPlayed}</Table.Td>}
                    {visibleColumns.random && <Table.Td>{gamesPerRace?.randomGamesPlayed}</Table.Td>}
                </Table.Tr>
            )
        }
    })

    if (!loading && !tableData?.length)
        return <p>Sc2Pulse is failing to respond, please refresh the page.</p>

    return (
        <Grid gutter='md'>
            <Grid.Col span={12}>
                {!loading && tableData?.length &&
                    <Text align="center" mb="md">
                        Select a race to filter the table. Click the same race twice to remove the filter.
                    </Text>
                }
                <RacesTable data={data} setTableData={setTableData} loading={loading} />
            </Grid.Col>

            <Grid.Col span={12}>
                {!loading && tableData?.length &&
                    <RankingTableColumnFilters columns={visibleColumns} onColumnChange={setVisibleColumns} />
                }
            </Grid.Col>

            <Skeleton className={classes.skeleton} visible={loading} maw={700} miw={250}>
                <Table
                    verticalSpacing={'3'}
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
                            <Table.Th></Table.Th>
                            {visibleColumns.top && <Table.Th>Top</Table.Th>}
                            {visibleColumns.name && <Table.Th>Name</Table.Th>}
                            {visibleColumns.mmr && <Table.Th>MMR</Table.Th>}
                            {visibleColumns.rank && <Table.Th>Rank</Table.Th>}
                            {visibleColumns.race && <Table.Th>Race</Table.Th>}
                            {visibleColumns.lastPlayed && <Table.Th>Last Played</Table.Th>}
                            {visibleColumns.terran && <Table.Th># Terran</Table.Th>}
                            {visibleColumns.protoss && <Table.Th># Protoss</Table.Th>}
                            {visibleColumns.zerg && <Table.Th># Zerg</Table.Th>}
                            {visibleColumns.random && <Table.Th># Random</Table.Th>}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>{rows}</Table.Tbody>
                </Table>
            </Skeleton>
        </Grid>
    )
}