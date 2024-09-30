import { Container } from '@mantine/core'
import classes from './Match.module.css'
import cx from 'clsx'
import { raceAssets } from '../../constants/races'
raceAssets

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

    return (
        <Container className={classes.match}>
            <div className={classes.header}>
                <div
                    className={cx(classes.status, {
                        [classes.pending]: state == 'pending',
                    })}
                ></div>
                <div className={classes.title}>Premier</div>
                <div className={classes.number}>{number}</div>
            </div>

            <div className={classes.content}>
                <div className={classes.colunm}>
                    <div className={classes.race}>
                        <img src={raceAssets['TERRAN']?.assetPath} alt="" />
                    </div>
                    <span className={classes.playerName}>{player1_id}</span>
                </div>
                <div className={classes.colunm}>
                    <div className={classes.scores}>{scores_csv}</div>
                </div>
                <div className={classes.colunm}>
                    <div className={classes.race}>
                        <img src={raceAssets['PROTOSS']?.assetPath} alt="" />
                    </div>
                    <span className={classes.playerName}>{player2_id}</span>
                </div>
            </div>
        </Container>
    )
}
