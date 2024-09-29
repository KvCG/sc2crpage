import { Container } from '@mantine/core'
import { LeagueTabs } from '../components/TabList/LeagueTabs'
import { useFetch } from '../hooks/useFetch'
import { useEffect } from 'react'

export const League = () => {
    const { data, loading, error, fetch } = useFetch('tournament')

    useEffect(() => {
        fetch()
    }, [])

    if (error) {
        return <p>{error}</p>
    } else if (loading) {
        return <p>Loading...</p>
    } else if (!data || data.length === 0) {
        return <p>There are no ongoing tournaments at the moment.</p>
    }

    return (
        <>
            <Container size={'md'}>
                <LeagueTabs
                    matches={data.matches}
                    participants={data.participants}
                />
            </Container>
        </>
    )
}
