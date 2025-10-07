import { useState, useCallback } from 'react'
import { getPlayerAnalytics } from '../services/api'
import {
    PlayerAnalyticsResponse,
    PlayerAnalyticsData,
    AnalyticsQueryParams,
    CachedAnalyticsData,
} from '../types/communityStats'
import { loadData, saveData, isValid } from '../utils/localStorage'

const CACHE_KEY = 'communityStatsCache'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export const useCommunityStats = (initialParams?: AnalyticsQueryParams) => {
    const [data, setData] = useState<PlayerAnalyticsData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [lastUpdated, setLastUpdated] = useState<string | null>(null)

    const fetchData = useCallback(async (params?: AnalyticsQueryParams) => {
        setLoading(true)
        setError(null)

        try {
            // Check cache first
            const cached = loadData(CACHE_KEY) as CachedAnalyticsData | null
            if (cached && isValid(CACHE_KEY, cached)) {
                setData(cached.data)
                setLastUpdated(cached.createdAt)
                setLoading(false)
                return cached.data
            }

            // Fetch fresh data
            const response = await getPlayerAnalytics(params)
            const responseData = response.data as PlayerAnalyticsResponse

            if (responseData.success) {
                const analyticsData = responseData.data
                setData(analyticsData)

                // Cache the data with expiry
                const now = new Date().toISOString()
                const cacheData: CachedAnalyticsData = {
                    data: analyticsData,
                    createdAt: now,
                    expiry: Date.now() + CACHE_TTL_MS,
                }

                saveData(CACHE_KEY, cacheData)
                setLastUpdated(now)

                return analyticsData
            } else {
                throw new Error('Failed to fetch analytics data')
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
            setError(errorMessage)
            console.error('Community Stats fetch error:', err)
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
