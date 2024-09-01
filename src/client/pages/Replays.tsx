import { useEffect } from 'react'
import { useFetch } from '../hooks/useFetch'
import { RankingTable } from '../components/Table/Table'

export const Replay = () => {
    const { data, loading, error, fetch } = useFetch('ranking')

    useEffect(() => {
        fetch()
    }, [])

    const renderResults = () => {
        if (loading) {
            return <p>Loading...</p>
        }
        if (error) {
            return <p>{error}</p>
        }
        if (data) {
            return <RankingTable data={data} />
        }
        return <p>No results found.</p>
    }

    return (
        <div>
            <h1>Upload a replay</h1>
            <form action="">
                <input type="file" />
            </form>

            {/* {renderResults()} */}
        </div>
    )
}
