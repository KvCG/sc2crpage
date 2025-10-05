import { Table } from '@mantine/core'
import cx from 'clsx'
import classes from './Table.module.css'
import { addOnlineIndicator, getLeagueSrc } from '../../utils/rankingHelper'
import { raceAssets } from '../../constants/races'
import { getStandardName } from '../../utils/common'
import { formatPositionChange } from '../../utils/tableHelpers'
import type { DecoratedRow } from '../../utils/rankingHelper'
import type { ColumnOptions } from './TableColumnFilters'

interface RankingTableRowProps {
    row: DecoratedRow
    index: number
    visibleColumns: ColumnOptions
}

export function RankingTableRow({ row, index, visibleColumns }: RankingTableRowProps) {
    const {
        btag,
        rating,
        mainRace,
        leagueType,
        positionChangeIndicator,
        positionDelta,
        lastDatePlayed,
        gamesPerRace,
        online,
        totalGames,
    } = row

    const { arrow, deltaText } = formatPositionChange(positionChangeIndicator, positionDelta)

    return (
        <Table.Tr key={btag}>
            <Table.Td className={classes.posIndicator} data-content={arrow}>
                {arrow}
                {deltaText}
            </Table.Td>
            {visibleColumns.top && <Table.Td className={classes.top}>{index + 1}</Table.Td>}
            {visibleColumns.name && (
                <Table.Td className={classes.name} title={btag}>
                    {getStandardName(row)}
                </Table.Td>
            )}
            {visibleColumns.mmr && <Table.Td>{rating}</Table.Td>}
            {visibleColumns.rank && (
                <Table.Td>
                    <img className={classes.rank} src={getLeagueSrc(leagueType)} alt="league" />
                </Table.Td>
            )}
            {visibleColumns.race && (
                <Table.Td className={cx(raceAssets[mainRace as keyof typeof raceAssets]?.className)}>
                    <img
                        className={classes.rank}
                        src={raceAssets[mainRace as keyof typeof raceAssets]?.assetPath}
                        alt={mainRace}
                    />
                </Table.Td>
            )}
            {visibleColumns.terran && <Table.Td>{gamesPerRace?.TERRAN || '-'}</Table.Td>}
            {visibleColumns.protoss && <Table.Td>{gamesPerRace?.PROTOSS || '-'}</Table.Td>}
            {visibleColumns.zerg && <Table.Td>{gamesPerRace?.ZERG || '-'}</Table.Td>}
            {visibleColumns.random && <Table.Td>{gamesPerRace?.RANDOM || '-'}</Table.Td>}
            {visibleColumns.total && <Table.Td>{totalGames}</Table.Td>}
            {visibleColumns.lastPlayed && (
                <Table.Td className={classes.lastPlayedColumn}>{addOnlineIndicator(lastDatePlayed, online)}</Table.Td>
            )}
        </Table.Tr>
    )
}