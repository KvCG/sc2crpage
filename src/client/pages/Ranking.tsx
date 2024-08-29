import { useState, useEffect } from 'react'
import { getTop } from '../services/api'
import { AxiosResponse } from 'axios'

type rankingInfo = {
    string: string
}

export const Ranking = () => {
    const [rankingInfo, setRankingInfo] = useState<rankingInfo[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)

	
    useEffect(() => {
		fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            const response: AxiosResponse<rankingInfo[]> = await getTop()
			setRankingInfo(response.data ?? [])
        } catch (error) {
            console.error('Error fetching ranking data:', error)
            setError('Failed to fetch data. Please try again later.')
            setRankingInfo([])
        } finally {
            setLoading(false)
        }
    }


    const renderResults = () => {
        if (loading) {
            return <p>Loading...</p>
        }
        if (error) {
            return <p style={{ color: 'red' }}>{error}</p>
        }
        if (rankingInfo) {
            return JSON.stringify(rankingInfo)
        }
        return <p>No results found.</p>
    }

    return (
        <div>
            <h1>TOP</h1>
            {renderResults()}
        </div>
    )
}
