import axios, { AxiosError } from 'axios'
import https from 'https'
import { readCsv } from '../utils/csvParser'
import cache from '../utils/cache'
import { getTimeUntilNextRefresh } from '../utils/cache'
import {
    chunkArray,
    retryDelay,
    toCostaRicaTime,
} from '../utils/pulseApiHelper'
import { DateTime } from 'luxon'

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    keepAliveMsecs: 15000,
    timeout: 30000,
})

const api = axios.create({
    baseURL: 'https://sc2pulse.nephest.com/sc2/api',
    httpAgent: agent,
})

export const searchPlayer = async (term: string) => {
    try {
        // Node automatically decodes URL params so we encode the search term again.
        const response = await api.get(`/character/search?term=${encodeURIComponent(term)}`)
        return response.data
    } catch (error) {
        const axiosError = error as AxiosError
        console.error(`[searchPlayer] Error while searching for term "${term}": ${axiosError.message}`)
    }
}

const getCurrentSeason = async () => {
    try {
        const response = await api.get(`season/list/all`)
        // The current season is assumed to be the first element
        return response.data[0].battlenetId
    } catch (error) {
        const axiosError = error as AxiosError
        console.error(`[getCurrentSeason] Error fetching current season: ${axiosError.message}`)
    }
}

const getPlayersStats = async (playerIds: string[]) => {
    if (!playerIds || playerIds.length === 0) return []
    const seasonId = await getCurrentSeason()
    const params = playerIds.map(id => `characterId=${id}`).join('&')
    const url = `group/team?season=${seasonId}&queue=LOTV_1V1&race=TERRAN&race=PROTOSS&race=ZERG&race=RANDOM&${params}`
    try {
        const response = await api.get(url)
        // Always return an array
        return Array.isArray(response.data) ? response.data : [response.data]
    } catch (error) {
        const axiosError = error as AxiosError
        console.error(`[getPlayersStats] Error fetching stats: ${axiosError.message}`)
        return []
    }
}

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

export const updatePlayerInformation = async (playersInformation: any[]) => {
    const playersArray = Array.isArray(playersInformation) ? playersInformation : [playersInformation]
    const characterIds = playersArray
        .filter((player: any) => player && player.playerCharacterId)
        .map((player: { playerCharacterId: string }) => player.playerCharacterId)

    // Batch fetch all stats
    const allStats = await getPlayersStats(characterIds)

    // Group stats by characterId for fast lookup
    const statsByCharacterId: Record<string, any[]> = {}
    allStats.forEach(team => {
        team.members.forEach(member => {
            const charId = String(member.character?.id)
            if (!statsByCharacterId[charId]) statsByCharacterId[charId] = []
            // Attach lastPlayed from team to each member for correct date calculation
            statsByCharacterId[charId].push({
                ...member,
                lastPlayed: team.lastPlayed
            })
        })
    })

    // Map results in the same order as playersArray
    const updatedPlayers = await Promise.all(
        playersArray.map(async (player: { playerCharacterId: string }) => {
            const statsForPlayer = statsByCharacterId[player.playerCharacterId] || []
            const gamesPerRace = await getPlayerGamesPerRace(statsForPlayer)
            const lastDatePlayed = await getPlayerLastDatePlayed(statsForPlayer)
            const online = isPlayerLikelyOnline(statsForPlayer)
            return {
                ...player,
                gamesPerRace,
                lastDatePlayed,
                online
            }
        })
    )

    return updatedPlayers
}

const getPlayersIds = async () => {
    try {
        const players = await readCsv()
        return players.map((player: { id: any }) => player.id)
    } catch (error) {
        console.error(`[getPlayersIds] Error reading CSV: ${(error as Error).message}`)
        return []
    }
}

const handleApiError = async (error: AxiosError, retries: number, maxRetries: number, retryFunction: () => Promise<any>) => {
    if (error.code === 'ECONNABORTED') {
        console.error(`[handleApiError] Request timed out: ${error.message}`)
    }

    if (retries < maxRetries) {
        const delay = retryDelay(retries)
        console.error(`[handleApiError] Retry attempt ${retries + 1}/${maxRetries} in ${delay / 1000} seconds. Error code: ${error.code}`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return retryFunction()
    } else {
        console.error(`[handleApiError] Max retries reached. Aborting. Error code: ${error.code}`)
    }

    console.error(`[handleApiError] Error occurred: ${error.code}`)
    return []
}

export const getTop = async (retries = 0, maxRetries = 3) => {
    const daysAgo = 120 // Default to 30 days ago
    try {
        const ids = await getPlayersIds()
        const reqArray: any[] = []
        // Split the ids into chunks of 50
        const idChunks = chunkArray(ids, 50)
        idChunks.map(chunk => reqArray.push(api.get(`character/${chunk.join(',')}/summary/1v1/${daysAgo}`)))
        const rankingData = await Promise.all(reqArray)
        const finalRank = rankingData.flatMap(data => data.data)
        return finalRank
    } catch (error) {
        console.error(`[getTop] Error fetching top players for daysAgo="${daysAgo}": ${(error as AxiosError).message}`)
        return handleApiError(error as AxiosError, retries, maxRetries, () => getTop(retries + 1, maxRetries))
    }
}

// export const getDailySnapshot = async (retries = 0, maxRetries = 3) => {
//     const ids = await getPlayersIds()
//     const cachedData = cache.get('snapShot')
//     if (cachedData) {
//         return cachedData
//     } else {
//         try {
//             // Split the ids into chunks of 10
//             const idChunks = chunkArray(ids, 10)

//             // Function to request data for each chunk
//             const fetchDataForChunk = async (chunk: string[]) => {
//                 return await Promise.all([
//                     api.get(`character/${chunk.join(',')}/summary/1v1/30/`),
//                     api.get(`character/${chunk.join(',')}/summary/1v1/60/`),
//                     api.get(`character/${chunk.join(',')}/summary/1v1/90/`),
//                     api.get(`character/${chunk.join(',')}/summary/1v1/120/`),
//                 ])
//             }

//             // Fetch data for all chunks
//             const allResponses = await Promise.all(
//                 idChunks.map(chunk => fetchDataForChunk(chunk))
//             )
//             const timeUntilNextRefresh = getTimeUntilNextRefresh()
//             // Combine the results from all chunks
//             const response = {
//                 '30': allResponses.flatMap(responses => responses[0].data),
//                 '60': allResponses.flatMap(responses => responses[1].data),
//                 '90': allResponses.flatMap(responses => responses[2].data),
//                 '120': allResponses.flatMap(responses => responses[3].data),
//                 expiry: Date.now() + timeUntilNextRefresh, // Every day expires at 12am
//             }

//             cache.set('snapShot', response, timeUntilNextRefresh / 1000)
//             console.info(`[getDailySnapshot] Snapshot cached successfully. Next refresh in ${timeUntilNextRefresh / 1000} seconds.`)

//             cache.on('expired', async key => {
//                 console.info(`[Cache] Key "${key}" has expired at ${new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' })}`)
//                 if (key === 'snapShot') {
//                     console.info(`[Cache] Fetching new snapshot after cache expiration...`)
//                     await getDailySnapshot()
//                 }
//             })
//             return response
//         } catch (error) {
//             console.error(`[getDailySnapshot] Error fetching daily snapshot: ${(error as AxiosError).message}`)
//             return handleApiError(error as AxiosError, retries, maxRetries, () => getDailySnapshot(retries + 1, maxRetries))
//         }
//     }
// }