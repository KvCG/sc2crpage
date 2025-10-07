import { useState, useCallback } from 'react'
import { getPlayerActivityAnalysis } from '../services/api'
import {
    PlayerActivityResponse,
    PlayerActivityData,
    ActivityQueryParams,
    CachedActivityData,
} from '../types/communityStats'
import { loadData, saveData, isValid } from '../utils/localStorage'

const CACHE_KEY = 'playerActivityCache'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export const usePlayerActivity = (initialParams?: ActivityQueryParams) => {
    const [data, setData] = useState<PlayerActivityData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)

    const fetchData = useCallback(async (params?: ActivityQueryParams) => {
        setLoading(true)
        setError(null)

        try {
            // Check cache first
            const cached = loadData(CACHE_KEY) as CachedActivityData | null
            if (cached && isValid(CACHE_KEY, cached)) {
                setData(cached.data)
                setLastUpdated(cached.createdAt)
                setLoading(false)
                return cached.data
            }

            // Fetch fresh data
            const response = await getPlayerActivityAnalysis(params)
            const responseData = response.data as PlayerActivityResponse

            if (responseData.success) {
                const activityData = responseData.data
                setData(activityData)

                // Cache the data with expiry
                const now = new Date().toISOString()
                const cacheData: CachedActivityData = {
                    data: activityData,
                    createdAt: now,
                    expiry: Date.now() + CACHE_TTL_MS,
                }

                saveData(CACHE_KEY, cacheData)
                setLastUpdated(now)

                return activityData
            } else {
                throw new Error('Failed to fetch activity data')
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
            setError(errorMessage)
            console.error('Player Activity fetch error:', err)
            return null
        } finally {
            setLoading(false)
        }
    }, [])

    const refresh = useCallback(() => {
        // Clear cache and fetch fresh data
        localStorage.removeItem(CACHE_KEY)
        return fetchData(initialParams)
    }, [fetchData, initialParams])

    return {
        data,
        loading,
        error,
        lastUpdated,
        fetch: fetchData,
        refresh,
    }
}