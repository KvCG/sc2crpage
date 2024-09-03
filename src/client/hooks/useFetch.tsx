import { useState } from 'react'
import { search, getTop } from '../services/api'

export const useFetch = () => {
    const [data, setData] = useState<[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetch = async (params?) => {
        setLoading(true)
        try {
            setData((await search(params)).data ?? [])
        } catch (error) {
            console.error('Error fetching ranking data:', error)
            setError('Failed to fetch data. Please try again later.')
            setData([])
        } finally {
            setLoading(false)
        }
    }

    return { data, loading, error, fetch}
}
