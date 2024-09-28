import { useEffect } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { List, rem } from '@mantine/core'
import classes from './Participants.module.css'
import { getStandardName } from '../../utils/common'
import { getLeagueSrc } from '../../utils/rankingHelper'

export const Participants = () => {
    const { data, loading, error, fetch } = useFetch('participants')

    useEffect(() => {
        fetch()
    }, [])

    const renderResults = () => {
        if (error) {
            return <p>{error}</p>
        }
        if (loading) {
            return <p>Loading</p>
        }
        if (!data?.length) {
            return <p>There are no ongoing tournaments at the moment.</p>
        }
        if (data?.length) {
            return (
                <List className={classes.participants} size="md">
                    {data.map(participant => {
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
                                    src={getLeagueSrc(
                                        participant.leagueTypeLast
                                    )}
                                />
                            </List.Item>
                        )
                    })}
                </List>
            )
        }

        return <p>No results found.</p>
    }

    return renderResults()
}
