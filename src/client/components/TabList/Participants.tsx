import classes from './Participants.module.css'
import { getStandardName } from '../../utils/common'
import { Text } from '@mantine/core'
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

    const raceOrder = ['TERRAN', 'ZERG', 'PROTOSS', 'RANDOM']
    const raceSortedParticipants = [...participants].sort((a, b) => {
        const raceComparison =
            raceOrder.indexOf(a.race) - raceOrder.indexOf(b.race)

        // If races are the same, sort alphabetically by name
        if (raceComparison === 0) {
            return getStandardName(a).localeCompare(getStandardName(b)) // Alphabetical order by name
        }

        return raceComparison
    })

    if (raceSortedParticipants?.length) {
        return (
            <>
                <Text size="lg">Click on a participant to see btag!</Text>
                <br />
                <div className={classes.participants}>
                    {raceSortedParticipants.map(participant => {
                        return (
                            <div
                                id={participant.id}
                                key={participant.id}
                                className={classes.participant}
                                onClick={() => toggleName(participant.id)}
                            >
                                <img
                                    className={classes.avatar}
                                    src={
                                        participant.attachedParticipatablePortraitUrl
                                    }
                                    alt="avatar"
                                />
                                <Text>{getDisplayName(participant)}</Text>

                                {participant.race ? (
                                    <img
                                        className={classes.race}
                                        src={
                                            raceAssets[participant.race]
                                                ?.assetPath
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
                            </div>
                        )
                    })}
                </div>
            </>
        )
    }

    return null // si no hay participantes
}
