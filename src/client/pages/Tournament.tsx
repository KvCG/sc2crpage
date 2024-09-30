import { Container, Text } from '@mantine/core'
import { TournamentTabs } from '../components/TabList/TournamentTabs'
import { useFetch } from '../hooks/useFetch'
import { useEffect } from 'react'
import { Description } from '../components/Description/Description'
import { toCRtime } from '../utils/common'
import { save } from '../utils/localStorage'

export const Tournament = () => {
    const { data, loading, error, fetch } = useFetch('tournament')

    useEffect(() => {
        fetch()
    }, [])

    if (error) {
        return <p>{error}</p>
    } else if (loading) {
        return <p>Loading...</p>
    } else if (!data) {
        return <p>There are no ongoing tournaments at the moment.</p>
    }

    const tournament = data?.info
    const participants = data?.participants
    const matches = data?.matches

	save('participants', participants)

    return (
        <>
            <h1>{tournament.name}</h1>
            <Text>
                <strong>Inicio: </strong>
                {toCRtime(tournament.start_at)}
            </Text>
            <br />
            <Description descriptionHtml={tournament.description} />
            <Container size={'md'}>
                <br />
                <TournamentTabs
                    matches={matches}
                    participants={participants}
                    participantCount={tournament.participants_count}
                />
            </Container>
			<br />
        </>
    )
}
