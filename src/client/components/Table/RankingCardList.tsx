import classes from './RankingCardList.module.css'
import { addOnlineIndicator, getLeagueSrc } from '../../utils/rankingHelper'
import type { DecoratedRow } from '../../utils/rankingHelper'
import { raceAssets } from '../../constants/races'
import { getStandardName } from '../../utils/common'
import { formatPositionChange } from '../../utils/tableHelpers'
import { LEAGUE_NAMES } from './RankingTableRow'
import type { H2HQuickViewPlayer } from '../../types/h2hQuickView'

type RankingCardListProps = {
    data: DecoratedRow[]
    onOpenH2HQuickView?: (player: H2HQuickViewPlayer) => void
}

type RankingCardProps = {
    row: DecoratedRow
    index: number
    onOpenH2HQuickView?: (player: H2HQuickViewPlayer) => void
}

function RankingCard({ row, index, onOpenH2HQuickView }: RankingCardProps) {
    const displayName = getStandardName(row)
    const characterId = typeof row.id === 'number' ? row.id : null
    const { arrow, deltaText } = formatPositionChange(row.positionChangeIndicator, row.positionDelta)
    const race = raceAssets[row.mainRace as keyof typeof raceAssets]

    // Mirror of handleOpenH2H in RankingTableRow.tsx
    const handleOpenH2H = () => {
        if (characterId === null || !onOpenH2HQuickView || typeof row.rating !== 'number') {
            return
        }

        onOpenH2HQuickView({
            characterId,
            displayName,
            btag: row.btag ?? '',
            mmr: row.rating,
            mainRace: row.mainRace,
            leagueType: row.leagueType,
        })
    }

    return (
        <button
            type="button"
            className={classes.row}
            onClick={handleOpenH2H}
            disabled={characterId === null}
            aria-label={`Open H2H with ${displayName}`}
        >
            <span className={classes.line1}>
                <span className={classes.position}>
                    {arrow}
                    {deltaText}
                    {index + 1}
                </span>
                <span className={classes.name}>{displayName}</span>
                <span className={classes.mmr}>{row.rating}</span>
            </span>
            <span className={classes.line2}>
                {race && (
                    <>
                        {/* decorative: the race name is rendered as text right next to it */}
                        <img className={race.className} src={race.assetPath} alt="" />
                        <span className={classes.raceName}>{row.mainRace}</span>
                    </>
                )}
                <img
                    className={classes.leagueIcon}
                    src={getLeagueSrc(row.leagueType)}
                    title={LEAGUE_NAMES[row.leagueType] ?? 'Unranked'}
                    alt=""
                />
                <span className={classes.lastPlayed}>{addOnlineIndicator(row.lastDatePlayed, row.online)}</span>
            </span>
        </button>
    )
}

export function RankingCardList({ data, onOpenH2HQuickView }: RankingCardListProps) {
    // Same truthy-rating filter as Table.tsx
    return (
        <div className={classes.list}>
            {data.map((row, index) =>
                row.rating ? (
                    <RankingCard key={row.btag} row={row} index={index} onOpenH2HQuickView={onOpenH2HQuickView} />
                ) : null
            )}
        </div>
    )
}
