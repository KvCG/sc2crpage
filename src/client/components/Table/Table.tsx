import { useState, useEffect } from 'react'
import { Table, Skeleton, Grid, Text } from '@mantine/core'
import cx from 'clsx'
import classes from './Table.module.css'
import { addOnlineIndicator, getLeagueSrc } from '../../utils/rankingHelper'
import { raceAssets } from '../../constants/races'
import { getStandardName } from '../../utils/common'
import { RacesTable } from '../RaceTable/RacesTable'
import { RankingTableColumnFilters, ColumnOptions } from './TableColumnFilters'
import type { DecoratedRow } from '../../utils/rankingHelper'

const defaultVisibleColumns: ColumnOptions = {
    top: true,
    name: true,
    mmr: true,
    rank: true,
    race: true,
    lastPlayed: true,
    terran: false,
    protoss: false,
    zerg: false,
    random: false,
    total: true,
}

type RowProps = { row: DecoratedRow; index: number; visibleColumns: ColumnOptions }
const RankingTableRow = ({ row, index, visibleColumns }: RowProps) => {
    const {
        btag,
        ratingLast,
        race,
        leagueTypeLast,
        positionChangeIndicator,
        positionDelta,
        lastDatePlayed,
        gamesPerRace,
		online
    } = row

    const totalGames =
        (gamesPerRace?.terranGamesPlayed ?? 0) +
        (gamesPerRace?.protossGamesPlayed ?? 0) +
        (gamesPerRace?.zergGamesPlayed ?? 0) +
        (gamesPerRace?.randomGamesPlayed ?? 0)

    const arrow = positionChangeIndicator === 'up' ? '▲' : positionChangeIndicator === 'down' ? '▼' : ''
    const deltaText = positionChangeIndicator !== 'none' && typeof positionDelta === 'number' && Math.abs(positionDelta) > 0
        ? ` ${Math.abs(positionDelta)}`
        : ''

    return (
        <Table.Tr key={btag}>
            <Table.Td className={classes.posIndicator} data-content={arrow}>
                {arrow}
                {deltaText}
            </Table.Td>
            {visibleColumns.top && <Table.Td className={classes.top}>{index + 1}</Table.Td>}
            {visibleColumns.name && <Table.Td title={btag}>{getStandardName(row)}</Table.Td>}
            {visibleColumns.mmr && <Table.Td>{ratingLast}</Table.Td>}
            {visibleColumns.rank && (
                <Table.Td>
                    <img className={classes.rank} src={getLeagueSrc(leagueTypeLast)} alt="league" />
                </Table.Td>
            )}
            {visibleColumns.race && (
                <Table.Td className={cx(raceAssets[race as keyof typeof raceAssets]?.className)}>
                    <img className={classes.rank} src={raceAssets[race as keyof typeof raceAssets]?.assetPath} alt={race} />
                </Table.Td>
            )}
            {visibleColumns.terran && <Table.Td>{gamesPerRace?.terranGamesPlayed}</Table.Td>}
            {visibleColumns.protoss && <Table.Td>{gamesPerRace?.protossGamesPlayed}</Table.Td>}
            {visibleColumns.zerg && <Table.Td>{gamesPerRace?.zergGamesPlayed}</Table.Td>}
            {visibleColumns.random && <Table.Td>{gamesPerRace?.randomGamesPlayed}</Table.Td>}
            {visibleColumns.total && <Table.Td>{totalGames}</Table.Td>}
            {visibleColumns.lastPlayed && <Table.Td>{addOnlineIndicator(lastDatePlayed, online)}</Table.Td>}
        </Table.Tr>
    )
}

type TableProps = { data: DecoratedRow[] | null; loading: boolean }
export function RankingTable({ data, loading }: TableProps) {
    const [tableData, setTableData] = useState<DecoratedRow[] | null>(data)

    const [visibleColumns, setVisibleColumns] = useState<ColumnOptions>(() => {
        const stored = localStorage.getItem('visibleColumns')
        return stored ? (JSON.parse(stored) as ColumnOptions) : defaultVisibleColumns
    })

    useEffect(() => {
        localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns))
    }, [visibleColumns])

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
                <RacesTable data={data} setTableData={setTableData} loading={loading} />
            </Grid.Col>

            <Grid.Col span={12}>
                {!loading && Array.isArray(tableData) && tableData.length > 0 && (
                    <RankingTableColumnFilters
                        columns={visibleColumns}
                        onColumnChange={setVisibleColumns}
                    />
                )}
            </Grid.Col>

            <Skeleton
                className={classes.skeleton}
                visible={loading}
                maw={700}
                miw={250}
            >
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
                            <Table.Th></Table.Th>
                            {visibleColumns.top && <Table.Th>Top</Table.Th>}
                            {visibleColumns.name && <Table.Th>Name</Table.Th>}
                            {visibleColumns.mmr && <Table.Th>MMR</Table.Th>}
                            {visibleColumns.rank && <Table.Th>Rank</Table.Th>}
                            {visibleColumns.race && <Table.Th>Race</Table.Th>}
                            
                            {visibleColumns.terran && <Table.Th># Terran</Table.Th>}
                            {visibleColumns.protoss && <Table.Th># Protoss</Table.Th>}
                            {visibleColumns.zerg && <Table.Th># Zerg</Table.Th>}
                            {visibleColumns.random && <Table.Th># Random</Table.Th>}
                            {visibleColumns.total && (
                                <Table.Th title="Total games played this season">Total Games</Table.Th>
                            )}
							{visibleColumns.lastPlayed && <Table.Th>Last Played</Table.Th>}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {tableData?.map((row: DecoratedRow, index: number) =>
                            row.ratingLast ? (
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
            </Skeleton>
        </Grid>
    )
}
