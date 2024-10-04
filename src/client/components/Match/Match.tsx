import classes from './Match.module.css'
import cx from 'clsx'
import { raceAssets } from '../../constants/races'
import { getParticipant, getStandardName } from '../../utils/common'
import unknowRace from '../../assets/unknownRank.svg'
import { forwardRef } from 'react'

export const Match = forwardRef(({ match }, ref) => {
    const {
        state,
        player1Id,
        player2Id,
        winnerId,
        loserId,
        round,
        scoresCsv,
        number,
        isClose,
        isPremier,
    } = match

    const player1 = getParticipant(player1Id)
    const player2 = getParticipant(player2Id)
    const player1race = raceAssets[player1.race]?.assetPath
    const player2race = raceAssets[player2.race]?.assetPath

    return (
        <div
            ref={ref}
            className={cx(classes.match, {
                [classes.premier]: isPremier,
                [classes.closeMatch]: isClose,
            })}
        >
            <div className={classes.header}>
                <div
                    title={state}
                    className={cx(classes.status, {
                        [classes.open]: state == 'open',
                    })}
                ></div>
                <div className={classes.title}>
                    {isPremier || isClose ? 'Premier ' : 'Match'}
                </div>
                <div className={classes.number}>
                    <div>{`R${round}`}</div>
                    <div>{`#${number}`}</div>
                </div>
            </div>

            <div className={classes.content}>
                <div className={classes.colunm}>
                    <div className={classes.race}>
                        <img src={player1race ?? unknowRace} alt="" />
                    </div>
                    <span className={classes.playerName}>
                        {getStandardName(player1)}
                    </span>
                </div>
                <div className={classes.colunm}>
                    <div className={classes.scores}>
                        {scoresCsv ? scoresCsv : 'vs'}
                    </div>
                </div>
                <div className={classes.colunm}>
                    <div className={classes.race}>
                        <img src={player2race ?? unknowRace} alt="" />
                    </div>
                    <span className={classes.playerName}>
                        {getStandardName(player2)}
                    </span>
                </div>
            </div>
        </div>
    )
})
