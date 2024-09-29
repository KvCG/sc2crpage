import { List } from '@mantine/core'
import classes from './Participants.module.css'
import { getStandardName } from '../../utils/common'
import { getLeagueSrc } from '../../utils/rankingHelper'

export const Participants = ({ participants }) => {
    if (participants?.length) {
        return (
            <List className={classes.participants} size="md">
                {participants.map(participant => {
                    return (
                        <List.Item
                            id={participant.id}
                            key={participant.id}
                            classNames={{
                                itemWrapper: classes.wrapper,
                                item: classes.participant,
                                itemLabel: classes.label,
                            }}
                        >
                            <img
                                className={classes.avatar}
                                src={
                                    participant.attached_participatable_portrait_url
                                }
                            />
                            <span>{getStandardName(participant)}</span>
                            <img
                                className={classes.rank}
                                src={getLeagueSrc(participant.leagueTypeLast)}
                            />
                        </List.Item>
                    )
                })}
            </List>
        )
    }
}
