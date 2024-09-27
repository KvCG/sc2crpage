import { useEffect } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Container, List, rem } from '@mantine/core'
import classes from './Participants.module.css'

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
                <Container maw={'150px'}>
                    <List className={classes.participants} spacing="2" size="md">
                        {data.map(({ participant }) => {
                            return (
                                <List.Item
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
                                    <span>{participant.name}</span>
                                </List.Item>
                            )
                        })}
                    </List>
                </Container>
            )
        }

        return <p>No results found.</p>
    }

    return renderResults()
}
