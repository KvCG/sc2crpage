import { useEffect } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { List, rem } from '@mantine/core'
import classes from './Participants.module.css'
import { getStandardName } from '../../utils/common'

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
                                icon={
                                    <img
                                        style={{
                                            width: rem(18),
                                            height: rem(18),
                                        }}
                                        src={
                                            participant.attached_participatable_portrait_url
                                        }
                                    />
                                }
                            >
                                <span>{getStandardName(participant)}</span>
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
