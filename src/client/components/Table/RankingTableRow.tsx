import { Group, Table } from '@mantine/core'
import cx from 'clsx'
import classes from './Table.module.css'
import { addOnlineIndicator, getLeagueSrc } from '../../utils/rankingHelper'
import { raceAssets } from '../../constants/races'
import { getStandardName } from '../../utils/common'
import { formatPositionChange } from '../../utils/tableHelpers'
import type { DecoratedRow } from '../../utils/rankingHelper'
import type { ColumnOptions } from './TableColumnFilters'
import type { H2HQuickViewPlayer } from '../../types/h2hQuickView'

// Mirror of getLeagueSrc (src/client/utils/rankingHelper.ts) — leagueType → display name
export const LEAGUE_NAMES: Record<number, string> = {
    0: 'Bronze',
    1: 'Silver',
    2: 'Gold',
    3: 'Platinum',
    4: 'Diamond',
    5: 'Master',
    6: 'Grandmaster',
}

const getLeagueName = (leagueType: number): string => LEAGUE_NAMES[leagueType] ?? 'Unranked'

interface RankingTableRowProps {
    row: DecoratedRow
    index: number
    visibleColumns: ColumnOptions
    onOpenH2HQuickView?: (player: H2HQuickViewPlayer) => void
}

export function RankingTableRow({ row, index, visibleColumns, onOpenH2HQuickView }: RankingTableRowProps) {
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

    const displayName = getStandardName(row)
    const characterId = typeof row.id === 'number' ? row.id : null

    const handleOpenH2H = () => {
        if (characterId === null || !onOpenH2HQuickView || typeof rating !== 'number') {
            return
        }

        onOpenH2HQuickView({
            characterId,
            displayName,
            btag,
            mmr: rating,
            mainRace,
            leagueType,
        })
    }

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
                    <Group justify="space-between" wrap="nowrap" gap="xs" className={classes.nameCellContent}>
                        <span className={classes.playerName}>{displayName}</span>
                        <button
                            type="button"
                            className={classes.h2hAction}
                            onClick={handleOpenH2H}
                            disabled={characterId === null}
                            aria-label={`Open H2H with ${displayName}`}
                        >
                            H2H
                        </button>
                    </Group>
                </Table.Td>
            )}
            {visibleColumns.mmr && <Table.Td className={classes.mmr}>{rating}</Table.Td>}
            {visibleColumns.rank && (
                <Table.Td>
                    <img
                        className={cx(classes.rank, classes.league)}
                        src={getLeagueSrc(leagueType)}
                        title={getLeagueName(leagueType)}
                        alt="league"
                    />
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