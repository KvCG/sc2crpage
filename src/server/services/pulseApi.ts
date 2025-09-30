/**
 * StarCraft II Pulse API Service
 * Provides functions to fetch, process, and cache player and ranking data from the SC2Pulse API.
 * Includes helpers for player stats aggregation, race extraction, online status, and cache management.
 *
 * REFACTORING NOTE (Phase 1 Complete):
 * - This service maintains backward compatibility while infrastructure for analytics features is established
 * - Business logic extraction to dataDerivations.ts service is available but not yet integrated
 * - Future phases will gradually migrate to the new service for better maintainability and testability
 * - See dataDerivations.ts for the new approach to data processing and business rules
 *
 * @module pulseApi
 */

import { AxiosError } from 'axios'
import { readCsv } from '../utils/csvParser'
import cache from '../utils/cache'
import { toCostaRicaTime } from '../utils/pulseApiHelper'
import { DateTime } from 'luxon'
import { get, withBasePath, endpoints } from './pulseHttpClient'
import { metrics } from '../metrics/lite'
import { bumpCache } from '../observability/requestContext'
import { pulseAdapter } from './pulseAdapter'
import { RankedTeamConsolidator } from './dataDerivations'

/**
 * Searches for a player by name or BattleTag.
 * @param {string} term - The search term (player name or BattleTag).
 * @returns {Promise<any>} The search results from the API.
 */
export const searchPlayer = async (term: string) => {
    try {
        // Node automatically decodes URL params so we encode the search term again.
        const data = await get<any>(withBasePath(endpoints.searchCharacter), {
            term: encodeURIComponent(term),
        })
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
        const us = data?.find((s: any) => s?.region === 'US')
        return us?.battlenetId ?? data?.[0]?.battlenetId
    } catch (error) {
        const axiosError = error as AxiosError
        console.error(`[getCurrentSeason] Error fetching current season: ${axiosError.message}`)
    }
}

/**
 * Reads the CSV file and returns an array of player character IDs.
 * @returns {Promise<string[]>} Array of player character IDs.
 */
const getPlayersIds = async (): Promise<string[]> => {
    try {
        const players = (await readCsv()) as unknown as Array<{ id: string }>
        return players.map((player) => player.id)
    } catch (error) {
        console.error(`[getPlayersIds] Error reading CSV: ${(error as Error).message}`)
        return []
    }
}

// Anti-stampede: share one ongoing refresh across concurrent callers.
// A single in-flight promise is created per cold-cache window and reset in finally.
let inflightPromise: Promise<any[]> | null = null

export const getTop = async (): Promise<any[]> => {
    const cacheKey = 'snapShot'
    const cachedData = cache.get(cacheKey)
    if (cachedData) {
        metrics.cache_hit_total++
        bumpCache(true)
        // If cache is valid, return it immediately.
        return cachedData
    }
    metrics.cache_miss_total++
    bumpCache(false)
    if (inflightPromise) {
        // If a fetch is already in progress, return the same promise.
        // This prevents multiple concurrent fetches for the same data.
        return inflightPromise
    }

    // No cache and no fetch in progress: start a new fetch and store the promise.
    inflightPromise = (async (): Promise<any[]> => {
        try {
            const characterIds = await getPlayersIds()
            const currentSeason = await getCurrentSeason()
            if (!characterIds || characterIds.length === 0) {
                return []
            }

            try {
                const allRankedTeams = await pulseAdapter.fetchRankedTeams(characterIds, currentSeason)
                const singleTeamPerPlayer = RankedTeamConsolidator.consolidateRankedTeams(allRankedTeams)
                const mainTeamList = RankedTeamConsolidator.getMainTeam(singleTeamPerPlayer)
                const rankedPlayers = RankedTeamConsolidator.getRankingPlayers(mainTeamList)
                cache.set(cacheKey, rankedPlayers)
                return mainTeamList
            } catch (err) {
                // continue to next attempt without recursion
            }
            return []
        } catch (error) {
            console.error(`[getTop] Error:`, error)
            return []
        } finally {
            // Always reset inflightPromise so future requests can trigger a new fetch if needed.
            inflightPromise = null
        }
    })()

    // Return the in-flight promise so all concurrent callers share the same result.
    return inflightPromise
}
