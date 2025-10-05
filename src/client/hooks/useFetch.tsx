import { useState } from 'react'
import {
    analyzeReplayBase64, 
    analyzeReplayUrl, 
    search,
    getTop,
	getTournament,
    getReplays,
    getReplayAnalysis,
    getPlayerAnalytics,
    getPlayerActivityAnalysis,
} from '../services/api'

export const useFetch = type => {
    const [data, setData] = useState<[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const getData = async params => {
        let data = null
        switch (type) {
            case 'search':
                data = (await search(params)).data
                break
            case 'ranking':
                data = (await getTop()).data
                break
            case 'tournament':
                data = (await getTournament()).data
                break
            case 'replays':
                data = (await getReplays()).data
                break
            case 'analyzeReplayBase64':
                data = (await analyzeReplayBase64(params)).data
                break
            case 'analyzeReplayUrl':
                data = (await analyzeReplayUrl(params)).data
                break
            case 'replayAnalysis':
                data = (await getReplayAnalysis(params)).data
                break
            case 'player-analytics':
                data = (await getPlayerAnalytics(params)).data
                break
            case 'player-analytics-activity':
                data = (await getPlayerActivityAnalysis(params)).data
                break
        }

        return data
    }

    const fetch = async (params?) => {
        setLoading(true)
        try {
            setData((await getData(params)) ?? [])
        } catch (error) {
            console.error('Error fetching ranking data:', error)
            setError('Failed to fetch data. Please try again later.')
            setData([])
        } finally {
            setLoading(false)
        }
    }

    return { data, loading, error, fetch }
}
