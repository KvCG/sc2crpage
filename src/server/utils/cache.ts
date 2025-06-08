import NodeCache from 'node-cache'

/**
 * Creates a NodeCache instance for in-memory caching.
 * The cache will automatically delete expired entries.
 */
const cache = new NodeCache({ deleteOnExpire: true })

export default cache

/**
 * Calculates the number of milliseconds until the next 10-second interval.
 * This is used to set the cache expiration so that cached data refreshes every 10 seconds.
 * @returns {number} Milliseconds until the next 10-second interval.
 */
export const getTimeUntilNextRefresh = () => {
    const now = new Date()
    const nextInterval = new Date(now)
    const seconds = now.getSeconds()
    // Set to the next 10-second mark
    nextInterval.setSeconds(Math.ceil((seconds + 1) / 10) * 10, 0)
    return nextInterval.getTime() - now.getTime() // in ms
}