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
import {
    toCostaRicaTime,
} from '../utils/pulseApiHelper'
import { DateTime } from 'luxon'
import { get, withBasePath, endpoints } from './pulseHttpClient'
import { metrics } from '../metrics/lite'
import { bumpCache } from '../observability/requestContext'



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
        const us = data?.find((s: any) => s?.region === 'US')
        return us?.battlenetId ?? data?.[0]?.battlenetId
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
    // Each character can have up to 4 teams (one per race). API caps limit at 400.
    // Use chunks of up to 100 character IDs to stay within 4*100 = 400.
    const chunkSize = 100
    const chunks: string[][] = []
    for (let i = 0; i < playerIds.length; i += chunkSize) {
        chunks.push(playerIds.slice(i, i + chunkSize))
    }

    const all: any[] = []
    for (const chunk of chunks) {
        const params = chunk.map(id => `characterId=${id}`).join('&')
        const limit = Math.min(chunk.length * 4, 400)
        const url = `${withBasePath(endpoints.groupTeam)}?season=${seasonId}&queue=LOTV_1V1&race=TERRAN&race=PROTOSS&race=ZERG&race=RANDOM&limit=${limit}&${params}`
        try {
            const data = await get<any | any[]>(url)
            const arr = Array.isArray(data) ? data : [data]
            all.push(...arr)
        } catch (error) {
            const axiosError = error as AxiosError
            console.error(`[getPlayersStats] Error fetching stats: ${axiosError.message}`)
        }
    }
    return all
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
 * getTop: fetch and return the latest player ranking snapshot.
 *
 * Plain-English overview:
 * - SC2Pulse (the upstream API) can be slow or flaky. To keep our API fast,
 *   we cache the last successful result for ~30 seconds. If a request comes in
 *   during that window, we return the cached data immediately.
 * - When the cache is empty or expired, we start ONE refresh. While that
 *   refresh is running, any other requests will wait for the same work to
 *   finish (instead of kicking off duplicate fetches). This is handled by the
 *   `inflightPromise` variable.
 * - We first read the local CSV to get the list of player IDs (fast). Then we
 *   call SC2Pulse to get stats for those IDs. Because the upstream might fail,
 *   we retry that remote fetch a few times using a simple loop (no recursion).
 * - We only update the cache if the refresh succeeds. If there are no IDs or
 *   all attempts fail, we return an empty array (we don’t serve stale data).
 *
 * Why this design?
 * - Caching keeps common requests fast and reduces pressure on SC2Pulse.
 * - A single in-flight refresh prevents a “thundering herd” of duplicate calls.
 * - Loop-based retries are easy to read and avoid subtle bugs with recursion
 *   and in-flight state.
 */

// Anti-stampede: share one ongoing refresh across concurrent callers.
// A single in-flight promise is created per cold-cache window and reset in finally.
let inflightPromise: Promise<any[]> | null = null

export const getTop = async (retries = 0, maxRetries = 3): Promise<any[]> => {
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
            if (!characterIds || characterIds.length === 0) {
                return []
            }

                for (let attempt = retries; attempt <= maxRetries; attempt++) {
                try {
                    const allStats = await getPlayersStats(characterIds)
                    
                    // Use original logic for now to maintain compatibility
                    const statsByCharacterId: Record<string, any[]> = {}
                    allStats.forEach(team => {
                        team.members.forEach((member: any) => {
                            const charId = String(member.character?.id)
                            if (!statsByCharacterId[charId]) statsByCharacterId[charId] = []
                            statsByCharacterId[charId].push({
                                ...member,
                                lastPlayed: team.lastPlayed,
                                leagueType: team.league?.type,
                                rating: team.rating,
                                wins: team.wins ?? 0,
                                losses: team.losses ?? 0,
                                ties: team.ties ?? 0,
                            })
                        })
                    })

                    const finalRanking = await Promise.all(
                        characterIds.map(async (characterId: string) => {
                            const statsForPlayer = statsByCharacterId[characterId] || []
                            
                            // Use original games per race aggregation logic
                            const gamesPerRace = {
                                zergGamesPlayed: 0,
                                protossGamesPlayed: 0,
                                terranGamesPlayed: 0,
                                randomGamesPlayed: 0,
                            }

                            statsForPlayer.forEach(member => {
                                // Prefer direct fields, fallback to raceGames object if present
                                gamesPerRace.zergGamesPlayed += member.zergGamesPlayed ?? member.raceGames?.ZERG ?? 0
                                gamesPerRace.protossGamesPlayed += member.protossGamesPlayed ?? member.raceGames?.PROTOSS ?? 0
                                gamesPerRace.terranGamesPlayed += member.terranGamesPlayed ?? member.raceGames?.TERRAN ?? 0
                                gamesPerRace.randomGamesPlayed += member.randomGamesPlayed ?? member.raceGames?.RANDOM ?? 0
                            })
                            
                            const lastDatePlayed = await getPlayerLastDatePlayed(statsForPlayer)
                            
                            // Use original online logic
                            let online = false
                            if (statsForPlayer && statsForPlayer.length > 0) {
                                try {
                                    const mostRecent = statsForPlayer.reduce((a, b) =>
                                        new Date(b.lastPlayed) > new Date(a.lastPlayed) ? b : a
                                    )

                                    if (mostRecent.lastPlayed) {
                                        const lastPlayed = toCostaRicaTime(mostRecent.lastPlayed)
                                        const now = DateTime.now().setZone('America/Costa_Rica')
                                        const diffMinutes = now.diff(lastPlayed, 'minutes').minutes
                                        online = diffMinutes <= 30
                                    }
                                } catch (error) {
                                    console.error('[isPlayerLikelyOnline] Error:', error)
                                }
                            }

                            const highestRatingObj = statsForPlayer.reduce((best, curr) =>
                                curr.rating > (best?.rating ?? -Infinity) ? curr : best, null)
                            
                            const highestLeagueType = highestRatingObj?.leagueType ?? null
                            
                            // Use original race extraction logic
                            let race = null
                            if (highestRatingObj) {
                                if (highestRatingObj?.raceGames) {
                                    race = Object.keys(highestRatingObj.raceGames)[0] ?? null
                                } else if (typeof highestRatingObj?.zergGamesPlayed === 'number' && highestRatingObj.zergGamesPlayed > 0) {
                                    race = 'ZERG'
                                } else if (typeof highestRatingObj?.protossGamesPlayed === 'number' && highestRatingObj.protossGamesPlayed > 0) {
                                    race = 'PROTOSS'
                                } else if (typeof highestRatingObj?.terranGamesPlayed === 'number' && highestRatingObj.terranGamesPlayed > 0) {
                                    race = 'TERRAN'
                                } else if (typeof highestRatingObj?.randomGamesPlayed === 'number' && highestRatingObj.randomGamesPlayed > 0) {
                                    race = 'RANDOM'
                                }
                            }
                            
                            const gamesThisSeason = statsForPlayer.reduce((total, member) => {
                                const { wins = 0, losses = 0, ties = 0 } = member ?? {}
                                return total + wins + losses + ties
                            }, 0)

                            return {
                                playerCharacterId: characterId,
                                race,
                                gamesPerRace,
                                lastDatePlayed,
                                online,
                                ratingLast: highestRatingObj?.rating ?? null,
                                leagueTypeLast: highestLeagueType,
                                gamesThisSeason,
                            }
                        })
                    )                    // Store in cache for 30 seconds (lru-cache handles TTL)
                    cache.set(cacheKey, finalRanking)
                    return finalRanking
                } catch (err) {
                    if (attempt === maxRetries) {
                        console.error(`[getTop] Failed after ${maxRetries} retries:`, err)
                        return []
                    }
                    // continue to next attempt without recursion
                }
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