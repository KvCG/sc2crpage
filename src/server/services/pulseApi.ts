/**
 * StarCraft II Pulse API Service
 * Provides functions to fetch, process, and cache player and ranking data from the SC2Pulse API.
 * Includes helpers for player stats aggregation, race extraction, online status, and cache management.
 * 
 * @module pulseApi
 */

import { AxiosError } from 'axios'
import { readCsv } from '../utils/csvParser'
import cache from '../utils/cache'
import {
    toCostaRicaTime,
} from '../utils/pulseApiHelper'
import { DateTime } from 'luxon'
import { get, withBasePath, endpoints } from './pulseHttpClient'


/**
 * Searches for a player by name or BattleTag.
 * @param {string} term - The search term (player name or BattleTag).
 * @returns {Promise<any>} The search results from the API.
 */
export const searchPlayer = async (term: string) => {
    try {
        // Node automatically decodes URL params so we encode the search term again.
        const data = await get<any>(withBasePath(endpoints.searchCharacter), { term: encodeURIComponent(term) })
        return data
    } catch (error) {
        const axiosError = error as AxiosError
        console.error(`[searchPlayer] Error while searching for term "${term}": ${axiosError.message}`)
    }
}

/**
 * Fetches the current season ID from the API.
 * @returns {Promise<string|undefined>} The current season's Battle.net ID.
 */
const getCurrentSeason = async () => {
    try {
        const data = await get<any[]>(withBasePath(endpoints.listSeasons))
        return data?.[0]?.battlenetId
    } catch (error) {
        const axiosError = error as AxiosError
        console.error(`[getCurrentSeason] Error fetching current season: ${axiosError.message}`)
    }
}

/**
 * Fetches player stats for a list of player IDs.
 * @param {string[]} playerIds - Array of player character IDs.
 * @returns {Promise<any[]>} Array of team stats objects.
 */
const getPlayersStats = async (playerIds: string[]) => {
    if (!playerIds || playerIds.length === 0) return []
    const seasonId = await getCurrentSeason()
    const params = playerIds.map(id => `characterId=${id}`).join('&')
    const races = ['TERRAN', 'PROTOSS', 'ZERG', 'RANDOM']
        .map(r => `race=${r}`).join('&')
    const url = `${withBasePath(endpoints.groupTeam)}?season=${seasonId}&queue=LOTV_1V1&${races}&${params}`
    try {
        const data = await get<any | any[]>(url)
        return Array.isArray(data) ? data : [data]
    } catch (error) {
        const axiosError = error as AxiosError
        console.error(`[getPlayersStats] Error fetching stats: ${axiosError.message}`)
        return []
    }
}

/**
 * Aggregates the number of games played per race for a list of members.
 * @param {Array} members - Array of member objects.
 * @returns {Promise<{zergGamesPlayed: number, protossGamesPlayed: number, terranGamesPlayed: number, randomGamesPlayed: number}>}
 */
const getPlayerGamesPerRace = async (
    members: Array<{ zergGamesPlayed?: number, protossGamesPlayed?: number, terranGamesPlayed?: number, randomGamesPlayed?: number, raceGames?: any }>
) => {
    const gamesPerRace = {
        zergGamesPlayed: 0,
        protossGamesPlayed: 0,
        terranGamesPlayed: 0,
        randomGamesPlayed: 0,
    }

    members.forEach(member => {
        // Prefer direct fields, fallback to raceGames object if present
        gamesPerRace.zergGamesPlayed += member.zergGamesPlayed ?? member.raceGames?.ZERG ?? 0
        gamesPerRace.protossGamesPlayed += member.protossGamesPlayed ?? member.raceGames?.PROTOSS ?? 0
        gamesPerRace.terranGamesPlayed += member.terranGamesPlayed ?? member.raceGames?.TERRAN ?? 0
        gamesPerRace.randomGamesPlayed += member.randomGamesPlayed ?? member.raceGames?.RANDOM ?? 0
    })

    return gamesPerRace
}

/**
 * Gets the last date a player played, formatted for Costa Rica time.
 * @param {Array} playerStats - Array of objects with a lastPlayed property.
 * @returns {Promise<string>} Formatted last played date or '-' if unavailable.
 */
const getPlayerLastDatePlayed = async (
    playerStats: Array<{ lastPlayed: string }>
) => {
    try {
        if (!playerStats || playerStats.length === 0) return '-'

        const mostRecent = playerStats.reduce((a, b) =>
            new Date(b.lastPlayed) > new Date(a.lastPlayed) ? b : a
        )

        if (!mostRecent || !mostRecent.lastPlayed) return '-'

        const lastPlayed = toCostaRicaTime(mostRecent.lastPlayed)
        const now = DateTime.now().setZone('America/Costa_Rica')

        const diffDays = now
            .startOf('day')
            .diff(lastPlayed.startOf('day'), 'days').days

        if (isNaN(diffDays)) return '-'

        if (diffDays === 0) {
            return lastPlayed.toFormat('h:mm a') // e.g., "7:33 AM"
        }

        return `${Math.floor(diffDays)}d ago`
    } catch (error) {
        console.error(`[getPlayerLastDatePlayed] Error:`, error)
        return '-'
    }
}

/**
 * Determines if a player is likely online based on their last played time.
 * @param {Array} playerStats - Array of objects with a lastPlayed property.
 * @returns {boolean} True if the player is likely online, false otherwise.
 */
const isPlayerLikelyOnline = (
    playerStats: Array<{ lastPlayed: string }>
): boolean => {
    if (!playerStats || playerStats.length === 0) return false

    try {
        const mostRecent = playerStats.reduce((a, b) =>
            new Date(b.lastPlayed) > new Date(a.lastPlayed) ? b : a
        )

        const lastPlayed = toCostaRicaTime(mostRecent.lastPlayed)
        const now = DateTime.now().setZone('America/Costa_Rica')

        const diffMinutes = now.diff(lastPlayed, 'minutes').minutes

        return diffMinutes <= 30 //Its a long time but SC2Pulse api is slow and games could take longer
    } catch (error) {
        console.error('[isPlayerLikelyOnline] Error:', error)
        return false
    }
}

/**
 * Reads the CSV file and returns an array of player character IDs.
 * @returns {Promise<string[]>} Array of player character IDs.
 */
const getPlayersIds = async (): Promise<string[]> => {
    try {
        const players = await readCsv() as unknown as Array<{ id: string }>
        return players.map((player) => player.id)
    } catch (error) {
        console.error(`[getPlayersIds] Error reading CSV: ${(error as Error).message}`)
        return []
    }
}

/**
 * Groups stats by characterId for fast lookup.
 * @param {any[]} allStats - Array of team stats objects.
 * @returns {Record<string, any[]>} Object mapping characterId to an array of stats.
 */
function groupStatsByCharacterId(allStats: any[]): Record<string, any[]> {
    const statsByCharacterId: Record<string, any[]> = {}
    allStats.forEach(team => {
        team.members.forEach((member: any) => {
            const charId = String(member.character?.id)
            if (!statsByCharacterId[charId]) statsByCharacterId[charId] = []
            statsByCharacterId[charId].push({
                ...member,
                lastPlayed: team.lastPlayed,
                leagueType: team.league?.type,
                rating: team.rating
            })
        })
    })
    return statsByCharacterId
}

/**
 * Finds the member/team with the highest rating.
 * @param {any[]} statsForPlayer - Array of stats for a player.
 * @returns {any} The member/team object with the highest rating.
 */
function getHighestRatingObj(statsForPlayer: any[]): any {
    return statsForPlayer.reduce((best, curr) =>
        curr.rating > (best?.rating ?? -Infinity) ? curr : best, null)
}

/**
 * Extracts the race from the member with the highest rating.
 * @param {any} highestRatingObj - The member/team object with the highest rating.
 * @returns {string|null} The race string ("ZERG", "TERRAN", "PROTOSS", "RANDOM") or null.
 */
function extractRace(highestRatingObj: any): string | null {
    if (highestRatingObj?.raceGames) {
        return Object.keys(highestRatingObj.raceGames)[0] ?? null
    } else if (typeof highestRatingObj?.zergGamesPlayed === 'number' && highestRatingObj.zergGamesPlayed > 0) {
        return 'ZERG'
    } else if (typeof highestRatingObj?.protossGamesPlayed === 'number' && highestRatingObj.protossGamesPlayed > 0) {
        return 'PROTOSS'
    } else if (typeof highestRatingObj?.terranGamesPlayed === 'number' && highestRatingObj.terranGamesPlayed > 0) {
        return 'TERRAN'
    } else if (typeof highestRatingObj?.randomGamesPlayed === 'number' && highestRatingObj.randomGamesPlayed > 0) {
        return 'RANDOM'
    }
    return null
}

/**
 * inflightPromise is used to prevent a "cache stampede" problem.
 *
 * What is a cache stampede?
 * -------------------------
 * When the cache expires (or is empty), if multiple requests arrive at the same time,
 * each request would trigger a new fetch to the expensive data source (API, DB, etc.).
 * This can overwhelm your backend or external services, especially under high load.
 *
 * How does inflightPromise solve this?
 * ------------------------------------
 * - When a request comes in and the cache is empty, we start fetching the data and assign
 *   the resulting Promise to inflightPromise.
 * - If another request comes in while the first fetch is still in progress, it will see
 *   that inflightPromise is not null and simply "await" the same Promise, instead of
 *   starting a new fetch.
 * - Once the fetch completes (success or error), inflightPromise is set back to null.
 * - This ensures that, at most, only one fetch is in progress at any time, and all
 *   concurrent requests share the same result.
 *
 * This pattern is especially useful in stateless environments like Express/Node.js,
 * where many requests can arrive in parallel.
 */
let inflightPromise: Promise<any[]> | null = null

/**
 * Main function to get the top player rankings.
 * Caches the result to avoid excessive API calls and refreshes automatically on expiration.
 * Uses an in-flight promise to prevent cache stampede.
 * @param {number} [retries=0] - Current retry count.
 * @param {number} [maxRetries=3] - Maximum number of retries.
 * @returns {Promise<any[]>} Array of player ranking objects.
 */
export const getTop = async (retries = 0, maxRetries = 3): Promise<any[]> => {
    const cacheKey = 'snapShot'
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
        // If cache is valid, return it immediately.
        return cachedData
    }
    if (inflightPromise) {
        // If a fetch is already in progress, return the same promise.
        // This prevents multiple concurrent fetches for the same data.
        return inflightPromise
    }

    // No cache and no fetch in progress: start a new fetch and store the promise.
    inflightPromise = (async (): Promise<any[]> => {
        try {
            const characterIds = await getPlayersIds()
            const allStats = await getPlayersStats(characterIds)
            const statsByCharacterId = groupStatsByCharacterId(allStats)

            const finalRanking = await Promise.all(
                characterIds.map(async (characterId: string) => {
                    const statsForPlayer = statsByCharacterId[characterId] || []
                    const gamesPerRace = await getPlayerGamesPerRace(statsForPlayer)
                    const lastDatePlayed = await getPlayerLastDatePlayed(statsForPlayer)
                    const online = isPlayerLikelyOnline(statsForPlayer)

                    const highestRatingObj = getHighestRatingObj(statsForPlayer)
                    const highestLeagueType = highestRatingObj?.leagueType ?? null
                    const race = extractRace(highestRatingObj)

                    return {
                        playerCharacterId: characterId,
                        race,
                        gamesPerRace,
                        lastDatePlayed,
                        online,
                        ratingLast: highestRatingObj?.rating ?? null,
                        leagueTypeLast: highestLeagueType
                    }
                })
            )

            // Store in cache for 30 seconds (lru-cache handles TTL)
            cache.set(cacheKey, finalRanking)
            return finalRanking
        } catch (error) {
            console.error(`[getTop] Error:`, error)
            if (retries < maxRetries) {
                return getTop(retries + 1, maxRetries)
            }
            console.error(`[getTop] Failed after ${maxRetries} retries:`, error)
            return []
        } finally {
            // Always reset inflightPromise so future requests can trigger a new fetch if needed.
            inflightPromise = null
        }
    })()

    // Return the in-flight promise so all concurrent callers share the same result.
    return inflightPromise
}