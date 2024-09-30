import classes from './Participants.module.css'
import { getStandardName } from '../../utils/common'
import { Flex, List, Text } from '@mantine/core'

import { raceAssets } from '../../constants/races'
import unknowRace from '../../assets/unknownRank.svg'

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
                            <Text>{getStandardName(participant)}</Text>

                            {participant.race ? (
                                <img
                                    className={classes.race}
                                    src={
                                        raceAssets[participant.race]?.assetPath
                                    }
                                    alt={participant.race}
                                />
                            ) : (
                                <img className={classes.race} src={unknowRace}></img>
                            )}
                        </List.Item>
                    )
                })}
            </List>
        )
    }
}
