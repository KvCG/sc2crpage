import classes from './Match.module.css'
import cx from 'clsx'
import { raceAssets } from '../../constants/races'
import { getParticipant, getStandardName } from '../../utils/common'
import unknowRace from '../../assets/unknownRank.svg'
import { useRef } from 'react'
import { Tooltip } from '@mantine/core'
import { forwardRef } from 'react'

export const Match = ({ match }) => {
    const {
        state,
        player1_id,
        player2_id,
        winner_id,
        loser_id,
        round,
        scores_csv,
        number,
    } = match

    const player1 = getParticipant(player1_id)
    const player2 = getParticipant(player2_id)
    const player1race = raceAssets[player1.race]?.assetPath
    const player2race = raceAssets[player2.race]?.assetPath
    let highlightMatch = false

    if (Math.abs(player1.ratingLast - player2.ratingLast) <= 200) {
        highlightMatch = true
    }

    const MatchComponent = forwardRef((_, ref) => {
        return (
            <div
                ref={ref}
                className={cx(classes.match, {
                    [classes.highlight]: highlightMatch,
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
                        {highlightMatch ? 'Premier ' : 'Match'}
                    </div>
                    <div className={classes.number}>{number}</div>
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
                            {scores_csv ? scores_csv : 'vs'}
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
    // <Tooltip>

    // </Tooltip>

    return highlightMatch ? (
        <Tooltip label={'Buenos pichazos'}>
            <MatchComponent />
        </Tooltip>
    ) : (
        <MatchComponent />
    )
}
