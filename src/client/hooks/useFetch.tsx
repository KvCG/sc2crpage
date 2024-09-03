import { useState } from 'react'
import { search, getTop } from '../services/api'

export const useFetch = (type) => {
    const [data, setData] = useState<[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

	const getData = async (params) => {
        let data = []
        switch (type) {
            case 'search':
                data = (await search(params)).data
                break
            case 'ranking':
                data = (await getTop()).data
                break
        }

        return data
    }

    const fetch = async (params?) => {
        setLoading(true)
        try {
            setData(await getData(params) ?? [])
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
