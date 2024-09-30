import classes from './Participants.module.css'
import { getStandardName } from '../../utils/common'
import { Flex, List, Text } from '@mantine/core'
import { raceAssets } from '../../constants/races'
import unknowRace from '../../assets/unknownRank.svg'
import { useState } from 'react'

export const Participants = ({ participants }) => {
    const [nameMap, setNameMap] = useState({})

    const toggleName = id => {
        setNameMap(prev => ({
            ...prev,
            [id]: prev[id] === 'btag' ? 'standard' : 'btag',
        }))
    }

    const getDisplayName = participant => {
        // Si no hay btag, siempre devuelve el nombre estándar
        if (!participant.btag) {
            return getStandardName(participant)
        }

        return nameMap[participant.id] === 'btag'
            ? participant.btag
            : getStandardName(participant)
    }

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
                                alt="avatar"
                            />
                            <Text onClick={() => toggleName(participant.id)}>
                                {getDisplayName(participant)}
                            </Text>

                            {participant.race ? (
                                <img
                                    className={classes.race}
                                    src={
                                        raceAssets[participant.race]?.assetPath
                                    }
                                    alt={participant.race}
                                />
                            ) : (
                                <img
                                    className={classes.race}
                                    src={unknowRace}
                                    alt="unknown race"
                                />
                            )}
                        </List.Item>
                    )
                })}
            </List>
        )
    }

    return null // si no hay participantes
}
