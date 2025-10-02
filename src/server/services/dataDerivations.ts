/**
 * Data Derivations Service
 *
 * Extracts business logic for processing SC2 player and ranking data.
 * Provides pure functions for:
 * - Race extraction from various API response formats
 * - Online status determination based on last played timestamps
 * - Position change calculation for ranking movements
 * - Game counting and aggregation across different races
 *
 * All functions are pure (no side effects) with explicit dependencies,
 * making them easily testable and reusable across different contexts.
 */

import { DateTime } from 'luxon'

import { Clan, Member, RaceGames, RankedPlayer, Team } from '../../shared/types'
import { toCostaRicaTime } from '../utils/pulseApiHelper'
import { getDisplayName } from '../utils/csvDisplayNames'

export interface PositionChange {
    positionChangeIndicator: 'up' | 'down' | 'none'
    previousPosition?: number
    currentPosition: number
}

/**
 * Online status determination utilities
 */
export class OnlineStatusCalculator {
    /**
     * Determine if a player is likely online based on last played timestamp
     */
    static isPlayerOnline(lastPlayed: string): boolean {
        if (!lastPlayed) return false

        try {
            let online = false
            const lastCRPlayed = toCostaRicaTime(lastPlayed)
            const now = DateTime.now().setZone('America/Costa_Rica')
            const diffMinutes = now.diff(lastCRPlayed, 'minutes').minutes
            online = diffMinutes <= (Number(process.env.ONLINE_THRESHOLD_MINUTES) || 30)
            // Mins threshold to consider a player "online" A match duration + buffer but matches can be longer resulting in false negatives.
            return online
        } catch {
            return false
        }
    }

    /**
     * Calculate hours since last activity
     */
    static getHoursSinceLastActivity(lastPlayed: string | null, currentTime: DateTime = DateTime.now()): number | null {
        if (!lastPlayed) return null

        try {
            const lastPlayedTime = toCostaRicaTime(lastPlayed)
            if (!lastPlayedTime.isValid) return null

            return currentTime.diff(lastPlayedTime, 'hours').hours
        } catch {
            return null
        }
    }
    /**
     * Gets the last date a player played, formatted for Costa Rica time human readble.
     * @param {String} lastPlayed - String with a lastPlayed data.
     * @returns {string} Formatted last played date or '-' if unavailable.
     */
    static getPlayerLastDatePlayed = (lastPlayed: string) => {
        try {
            const lasCRPlayed = toCostaRicaTime(lastPlayed)
            const now = DateTime.now().setZone('America/Costa_Rica')
            const diffDays = now.startOf('day').diff(lasCRPlayed.startOf('day'), 'days').days
            if (isNaN(diffDays)) return '-'
            if (diffDays === 0) {
                return lasCRPlayed.toFormat('h:mm a') // e.g., "7:33 AM"
            }
            return `${Math.floor(diffDays)}d ago`
        } catch (error) {
            console.error(`[getPlayerLastDatePlayed] Error:`, error)
            return '-'
        }
    }

    /**
     * Get activity status description
     */
    static getActivityStatus(
        lastPlayed: string,
        currentTime: DateTime = DateTime.now()
    ): 'online' | 'recent' | 'inactive' | 'unknown' {
        const hours = this.getHoursSinceLastActivity(lastPlayed, currentTime)

        if (hours === null) return 'unknown'
        if (this.isPlayerOnline(lastPlayed)) return 'online'
        if (hours <= Number(process.env.ONLINE_THRESHOLD_HOURS) || 24) return 'recent'
        return 'inactive'
    }
}

/**
 * Position change calculation utilities
 */
export class PositionCalculator {
    /**
     * Calculate position changes between two ranking snapshots
     */
    static calculatePositionChanges(
        currentRanking: RankedPlayer[],
        previousRanking: RankedPlayer[]
    ): Map<string, PositionChange> {
        const changes = new Map<string, PositionChange>()

        // Create position lookup for previous ranking
        const previousPositions = new Map<string, number>()
        previousRanking.forEach((player, index) => {
            if (player.btag) {
                previousPositions.set(player.btag, index)
            }
        })

        // Calculate changes for current ranking
        currentRanking.forEach((player, currentIndex) => {
            if (!player.btag) return

            const previousIndex = previousPositions.get(player.btag)
            const change: PositionChange = {
                currentPosition: currentIndex,
                positionChangeIndicator: 'none',
            }

            if (previousIndex !== undefined) {
                change.previousPosition = previousIndex

                if (currentIndex < previousIndex) {
                    change.positionChangeIndicator = 'up'
                } else if (currentIndex > previousIndex) {
                    change.positionChangeIndicator = 'down'
                }
            }

            changes.set(player.btag, change)
        })

        return changes
    }

    /**
     * Add position change indicators to ranking data
     */
    static addPositionChangeIndicators(
        currentRanking: RankedPlayer[],
        previousRanking: RankedPlayer[]
    ): RankedPlayer[] {
        const changes = this.calculatePositionChanges(currentRanking, previousRanking)

        return currentRanking.map((player) => ({
            ...player,
            positionChangeIndicator: player.btag ? changes.get(player.btag)?.positionChangeIndicator || 'none' : 'none',
        }))
    }

    /**
     * Get position movement statistics
     */
    static getMovementStatistics(changes: Map<string, PositionChange>): {
        up: number
        down: number
        unchanged: number
        new: number
    } {
        let up = 0,
            down = 0,
            unchanged = 0,
            newPlayers = 0

        changes.forEach((change) => {
            switch (change.positionChangeIndicator) {
                case 'up':
                    up++
                    break
                case 'down':
                    down++
                    break
                case 'none':
                    if (change.previousPosition !== undefined) {
                        unchanged++
                    } else {
                        newPlayers++
                    }
                    break
            }
        })

        return { up, down, unchanged, new: newPlayers }
    }
}

export class RankedTeamConsolidator {
    static consolidateRankedTeams(teamsPerPlayer: Team[]): RankedPlayer[] {
        // Each player can have up to 4 teams in ranked 1v1 ladder (1 for each race + random)
        const consolidatedPlayerMap = {} as Record<string, RankedPlayer>
        teamsPerPlayer.forEach((team) => {
            const btag = String(team.members[0]?.account?.battleTag)
            if (consolidatedPlayerMap[btag]) {
                let tempRankedPlayer = consolidatedPlayerMap[btag]
                // Merge all values as arrays, but for members, keep all raceGames keys/values
                consolidatedPlayerMap[btag] = {
                    ...tempRankedPlayer,
                    globalRank: [...(tempRankedPlayer.globalRank as number[]), team.globalRank],
                    regionRank: [...(tempRankedPlayer.regionRank as number[]), team.regionRank],
                    lastPlayed: [...(tempRankedPlayer.lastPlayed as string[]), team.lastPlayed],
                    leagueRank: [...(tempRankedPlayer.leagueRank as number[]), team.leagueRank],
                    leagueType: [...(tempRankedPlayer.leagueType as number[]), team.league.type],
                    losses: [...(tempRankedPlayer.losses as number[]), team.losses],
                    ties: [...(tempRankedPlayer.ties as number[]), team.ties],
                    wins: [...(tempRankedPlayer.wins as number[]), team.wins],
                    rating: [...(tempRankedPlayer.rating as number[]), team.rating],
                    members: {
                        ...tempRankedPlayer.members,
                        ...team.members[0],
                        raceGames: {
                            ...tempRankedPlayer.members?.raceGames,
                            ...team.members[0].raceGames,
                        } as RaceGames,
                    } as Member,
                } as RankedPlayer
            } else {
                consolidatedPlayerMap[btag] = {
                    globalRank: [team.globalRank],
                    regionRank: [team.regionRank],
                    lastPlayed: [team.lastPlayed],
                    leagueRank: [team.leagueRank],
                    leagueType: [team.league.type],
                    losses: [team.losses],
                    ties: [team.ties],
                    rating: [team.rating],
                    wins: [team.wins],
                    members: team.members[0],
                } as RankedPlayer
            }
        })

        return Object.values(consolidatedPlayerMap)
    }

    static getMainTeam(consolidatedPlayer: RankedPlayer[]): RankedPlayer[] {
        // Display names are now automatically loaded by pulseService when reading CSV
        
        // main race calculation
        const singleTeamList = [] as RankedPlayer[]
        consolidatedPlayer.map((player) => {
            let gamesPerRace = player.members?.raceGames as RaceGames
            if (gamesPerRace) {
                const entries = Object.entries(gamesPerRace)
                let maxGames = -1
                let maxRace: string | undefined = undefined // the race that has more played games.
                let maxIndex = -1
                let totalGames = 0
                entries.forEach(([key, value], idx) => {
                    if (typeof value === 'number' && value > maxGames) {
                        totalGames += value
                        maxGames = value
                        maxRace = key
                        maxIndex = idx
                    }
                })
                const mainRating = player.rating as number[]
                const mainGlobalRank = player.globalRank as number[]
                const mainRegionRank = player.regionRank as number[]
                const mainLeagueRank = player.leagueRank as number[]
                const mainWins = player.wins as number[]
                const mainLosses = player.losses as number[]
                const mainTies = player.ties as number[]
                const mainLeagueType = player.leagueType as number[]
                const mainLastPlayed = player.lastPlayed as string[]
                const mainMembers = { ...player.members, gamesPerRace }

                if (typeof maxRace === 'string') {
                    switch (maxRace) {
                        case 'ZERG':
                            delete mainMembers?.protossGamesPlayed
                            delete mainMembers?.terranGamesPlayed
                            delete mainMembers?.randomGamesPlayed
                            break
                        case 'PROTOSS':
                            delete mainMembers?.zergGamesPlayed
                            delete mainMembers?.terranGamesPlayed
                            delete mainMembers?.randomGamesPlayed
                            break
                        case 'TERRAN':
                            delete mainMembers?.protossGamesPlayed
                            delete mainMembers?.zergGamesPlayed
                            delete mainMembers?.randomGamesPlayed
                            break
                        case 'RANDOM':
                            delete mainMembers?.protossGamesPlayed
                            delete mainMembers?.terranGamesPlayed
                            delete mainMembers?.zergGamesPlayed
                            break
                        default:
                            break
                    }
                }

                const lastPlayedStr = mainLastPlayed[maxIndex]
                
                // Get display name from CSV or fallback to account tag
                const characterId = player.members?.account?.id
                const displayName = getDisplayName(characterId)
                const playerName = displayName || player.members?.account?.tag || player.members?.account?.battleTag?.split('#')[0] || 'Unknown'
                
                const mainTeam: RankedPlayer = {
                    btag: player.members?.account?.battleTag,
                    discriminator: player.members?.account?.discriminator,
                    id: player.members?.account?.id,
                    name: playerName,
                    globalRank: mainGlobalRank[maxIndex],
                    regionRank: mainRegionRank[maxIndex],
                    lastPlayed: lastPlayedStr,
                    leagueRank: mainLeagueRank[maxIndex],
                    leagueType: mainLeagueType[maxIndex],
                    losses: mainLosses[maxIndex],
                    ties: mainTies[maxIndex],
                    wins: mainWins[maxIndex],
                    rating: mainRating[maxIndex],
                    clan: player.members?.clan as Clan,
                    mainRace: maxRace,
                    totalGames: totalGames,
                    gamesPerRace: gamesPerRace,
                    lastDatePlayed: OnlineStatusCalculator.getPlayerLastDatePlayed(lastPlayedStr),
                    online: OnlineStatusCalculator.isPlayerOnline(lastPlayedStr),
                }

                singleTeamList.push(mainTeam)
            }
        })

        return singleTeamList
    }

    static getLastPlayedInDays(lastPlayed: string | null): string {
        if (!lastPlayed) return '-' // No data available

        try {
            const lastPlayedCr = toCostaRicaTime(lastPlayed)
            const now = DateTime.now().setZone('America/Costa_Rica')
            const diffDays = now.startOf('day').diff(lastPlayedCr.startOf('day'), 'days').days
            if (isNaN(diffDays)) return '-'
            if (diffDays === 0) {
                return lastPlayedCr.toFormat('h:mm a') // e.g., "7:33 AM"
            }
            return `${Math.floor(diffDays)}d ago`
        } catch {
            return '-' // Error parsing date
        }
    }
}

/**
 * Main derivations service with streamlined RankedPlayer processing
 */
export class DataDerivationsService {
    /**
     * Process raw team data into final RankedPlayer format
     */
    static processTeamsToRankedPlayers(teams: Team[]): RankedPlayer[] {
        // Step 1: Consolidate multiple teams per player
        const consolidatedPlayers = RankedTeamConsolidator.consolidateRankedTeams(teams)

        // Step 2: Extract main team data (single values) with display names
        const rankedPlayers = RankedTeamConsolidator.getMainTeam(consolidatedPlayers)

        // Step 3: Sort by rating (highest first)
        return rankedPlayers.sort((a, b) => (b.rating as number) - (a.rating as number))
    }

    /**
     * Add position indicators to ranking data using baseline comparison
     */
    static addPositionIndicators(currentRanking: RankedPlayer[], baselineRanking: RankedPlayer[]): RankedPlayer[] {
        return PositionCalculator.addPositionChangeIndicators(currentRanking, baselineRanking)
    }

    /**
     * Filter ranking data based on minimum games threshold
     */
    static filterByMinimumGames(ranking: RankedPlayer[], minimumGames: number = 20): RankedPlayer[] {
        return ranking.filter((player) => (player.totalGames || 0) >= minimumGames)
    }

    /**
     * Get ranking statistics summary
     */
    static getRankingStatistics(ranking: RankedPlayer[]): {
        totalPlayers: number
        activePlayers: number
        averageRating: number
        raceDistribution: Record<string, number>
        leagueDistribution: Record<string, number>
    } {
        const activePlayers = ranking.filter((player) => player.online).length
        const averageRating =
            ranking.length > 0
                ? ranking.reduce((sum, player) => sum + ((player.rating as number) || 0), 0) / ranking.length
                : 0

        const raceDistribution: Record<string, number> = {}
        const leagueDistribution: Record<string, number> = {}

        ranking.forEach((player) => {
            // Count race distribution
            const race = player.mainRace || 'UNKNOWN'
            raceDistribution[race] = (raceDistribution[race] || 0) + 1

            // Count league distribution
            const league = String(player.leagueType) || 'UNKNOWN'
            leagueDistribution[league] = (leagueDistribution[league] || 0) + 1
        })

        return {
            totalPlayers: ranking.length,
            activePlayers,
            averageRating,
            raceDistribution,
            leagueDistribution,
        }
    }
}
