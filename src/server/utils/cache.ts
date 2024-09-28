import NodeCache from 'node-cache'

// Create a cache instance
const cache = new NodeCache({ deleteOnExpire: true })

export default cache

export const getTimeUntilNextRefresh = () => {
    const now = new Date()
    const nextRefresh = new Date()

    // Set the refresh time for 6 AM UTC (which is 12 AM Costa Rica time, UTC-6)
    nextRefresh.setUTCHours(6, 0, 0, 0) // 6 AM UTC = 12 AM UTC-6 (Costa Rica)

    // If the current time is exactly or past 12 AM Costa Rica time, set the next refresh for tomorrow
    if (now.getTime() >= nextRefresh.getTime()) {
        nextRefresh.setDate(nextRefresh.getDate() + 1)
    }
    const timeUntilRefresh = nextRefresh.getTime() - now.getTime() // in ms
    return timeUntilRefresh
}
