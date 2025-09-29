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

import {
    Account,
    Clan,
    Member,
    RaceGames,
    RankedPlayer,
    RankingPlayer,
    Team,
    TeamStats,
} from '../../shared/types' // Ensure types are imported

export interface PositionChange {
    positionChangeIndicator: 'up' | 'down' | 'none'
    previousPosition?: number
    currentPosition: number
}

/**
 * Race extraction utilities
 */
export class RaceExtractor {
    /**
     * Extract race from team member data using multiple fallback strategies
     */
    static extractRace(member: Member): string | null {
        if (!member) return null

        // Strategy 1: Use raceGames object (preferred)
        if (member.raceGames) {
            const races = Object.entries(member.raceGames)
            if (races.length === 0) return null

            // Find race with most games
            const [mostPlayedRace] = races.reduce((max, current) =>
                current[1] > max[1] ? current : max
            )
            return mostPlayedRace
        }

        // Strategy 2: Use individual race game fields
        const raceGames = {
            TERRAN: member.terranGamesPlayed || 0,
            PROTOSS: member.protossGamesPlayed || 0,
            ZERG: member.zergGamesPlayed || 0,
            RANDOM: member.randomGamesPlayed || 0,
        }

        const maxGames = Math.max(...Object.values(raceGames))
        if (maxGames === 0) return null

        // Return race with most games
        const raceEntry = Object.entries(raceGames).find(
            ([_, games]) => games === maxGames
        )
        return raceEntry ? raceEntry[0] : null
    }

    /**
     * Get games per race from member data
     */
    static getGamesPerRace(member: Member): Record<string, number> {
        const games = {
            TERRAN: 0,
            PROTOSS: 0,
            ZERG: 0,
            RANDOM: 0,
        }

        if (member.raceGames) {
            // Use raceGames object if available
            Object.entries(member.raceGames).forEach(([race, count]) => {
                if (race in games) {
                    games[race as keyof typeof games] = count
                }
            })
        } else {
            // Fallback to individual fields
            games.TERRAN = member.terranGamesPlayed || 0
            games.PROTOSS = member.protossGamesPlayed || 0
            games.ZERG = member.zergGamesPlayed || 0
            games.RANDOM = member.randomGamesPlayed || 0
        }

        return games
    }

    /**
     * Calculate total games from member data
     */
    static getTotalGames(member: Member): number {
        return (member.wins || 0) + (member.losses || 0) + (member.ties || 0)
    }
}

/**
 * Online status determination utilities
 */
export class OnlineStatusCalculator {
    private static readonly ONLINE_THRESHOLD_HOURS = 24

    /**
     * Determine if a player is likely online based on last played timestamp
     */
    static isPlayerOnline(
        lastPlayed: string | null,
        currentTime: DateTime = DateTime.now()
    ): boolean {
        if (!lastPlayed) return false

        try {
            const lastPlayedTime = DateTime.fromISO(lastPlayed)
            if (!lastPlayedTime.isValid) return false

            const hoursSinceLastPlayed = currentTime.diff(
                lastPlayedTime,
                'hours'
            ).hours
            return hoursSinceLastPlayed <= this.ONLINE_THRESHOLD_HOURS
        } catch {
            return false
        }
    }

    /**
     * Calculate hours since last activity
     */
    static getHoursSinceLastActivity(
        lastPlayed: string | null,
        currentTime: DateTime = DateTime.now()
    ): number | null {
        if (!lastPlayed) return null

        try {
            const lastPlayedTime = DateTime.fromISO(lastPlayed)
            if (!lastPlayedTime.isValid) return null

            return currentTime.diff(lastPlayedTime, 'hours').hours
        } catch {
            return null
        }
    }

    /**
     * Get activity status description
     */
    static getActivityStatus(
        lastPlayed: string | null,
        currentTime: DateTime = DateTime.now()
    ): 'online' | 'recent' | 'inactive' | 'unknown' {
        const hours = this.getHoursSinceLastActivity(lastPlayed, currentTime)

        if (hours === null) return 'unknown'
        if (hours <= 1) return 'online'
        if (hours <= this.ONLINE_THRESHOLD_HOURS) return 'recent'
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
        currentRanking: RankingPlayer[],
        previousRanking: RankingPlayer[]
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
        currentRanking: RankingPlayer[],
        previousRanking: RankingPlayer[]
    ): RankingPlayer[] {
        const changes = this.calculatePositionChanges(
            currentRanking,
            previousRanking
        )

        return currentRanking.map(player => ({
            ...player,
            positionChangeIndicator: player.btag
                ? changes.get(player.btag)?.positionChangeIndicator || 'none'
                : 'none',
        })) as RankingPlayer[]
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

        changes.forEach(change => {
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

/**
 * Team statistics aggregation utilities
 */
export class TeamStatsAggregator {
    /**
     * Group team statistics by character ID
     */
    static groupStatsByCharacterId(
        teamStats: TeamStats[]
    ): Map<number, TeamStats[]> {
        const grouped = new Map<number, TeamStats[]>()

        teamStats.forEach(team => {
            team.members.forEach(member => {
                const characterId = member.character.id
                if (!grouped.has(characterId)) {
                    grouped.set(characterId, [])
                }
                grouped.get(characterId)!.push(team)
            })
        })

        return grouped
    }

    /**
     * Find team with highest rating for a player
     */
    static getHighestRatingTeam(playerTeams: TeamStats[]): TeamStats | null {
        if (playerTeams.length === 0) return null

        return playerTeams.reduce((highest, current) =>
            current.rating > highest.rating ? current : highest
        )
    }

    /**
     * Get most recent activity timestamp from team data
     */
    static getMostRecentActivity(playerTeams: TeamStats[]): string | null {
        if (playerTeams.length === 0) return null

        const timestamps = playerTeams
            .map(team => team.lastPlayed)
            .filter(Boolean)
            .map(timestamp => DateTime.fromISO(timestamp))
            .filter(dt => dt.isValid)

        if (timestamps.length === 0) return null

        const mostRecent = timestamps.reduce((latest, current) =>
            current > latest ? current : latest
        )

        return mostRecent.toISO()
    }

    /**
     * Calculate aggregated player statistics from team data
     */
    static aggregatePlayerStats(
        characterId: number,
        playerTeams: TeamStats[]
    ): Partial<RankingPlayer> {
        const highestRatingTeam = this.getHighestRatingTeam(playerTeams)
        const mostRecentActivity = this.getMostRecentActivity(playerTeams)

        if (!highestRatingTeam) {
            return {
                playerCharacterId: characterId,
                race: null,
                ratingLast: null,
                leagueTypeLast: null,
                gamesThisSeason: 0,
                gamesPerRace: { TERRAN: 0, PROTOSS: 0, ZERG: 0, RANDOM: 0 },
                lastDatePlayed: null,
                online: false,
            }
        }

        // Find member data for this character in the highest rating team
        const memberData = highestRatingTeam.members.find(
            member => member.character.id === Number(characterId)
        )

        if (!memberData) {
            throw new Error(
                `Member data not found for character ${characterId}`
            )
        }

        const race = RaceExtractor.extractRace(memberData)
        const gamesPerRace = RaceExtractor.getGamesPerRace(memberData)
        const totalGames = RaceExtractor.getTotalGames(memberData)
        const online = OnlineStatusCalculator.isPlayerOnline(mostRecentActivity)

        return {
            playerCharacterId: characterId,
            race,
            ratingLast: highestRatingTeam.rating,
            leagueTypeLast: highestRatingTeam.league.type,
            gamesThisSeason: totalGames,
            gamesPerRace,
            lastDatePlayed: mostRecentActivity,
            online,
        }
    }
}

export class RankedTeamConsolidator {
    static consolidateRankedTeams(teamsPerPlayer: Team[]): RankedPlayer[] {
        // Each player can have up to 4 teams in ranked 1v1 ladder (1 for each race + random)
        const consolidatedPlayerMap = {} as Record<string, RankedPlayer>
        teamsPerPlayer.forEach(team => {
            const btag = team.members[0].account.battleTag
            if (consolidatedPlayerMap[btag]) {
                let tempRankedPlayer = consolidatedPlayerMap[btag]
                // Merge all values as arrays, but for members, keep all raceGames keys/values
                consolidatedPlayerMap[btag] = {
                    ...tempRankedPlayer,
                    globalRank: [...tempRankedPlayer.globalRank, team.globalRank],
                    regionRank: [...tempRankedPlayer.regionRank, team.regionRank],
                    lastPlayed: [...tempRankedPlayer.lastPlayed, team.lastPlayed],
                    leagueRank: [...tempRankedPlayer.leagueRank, team.leagueRank],
                    leagueType: [...tempRankedPlayer.leagueType, team.league.type],
                    losses: [...tempRankedPlayer.losses, team.losses],
                    ties: [...tempRankedPlayer.ties, team.ties],
                    wins: [...tempRankedPlayer.wins, team.wins],
                    rating: [...tempRankedPlayer.rating, team.rating],
                    members: {
                        ...tempRankedPlayer.members,
                        ...team.members[0],
                        raceGames: {
                            ...tempRankedPlayer.members.raceGames,
                            ...team.members[0].raceGames,
                        },
                    },
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
}

/**
 * Main derivations service that combines all utilities
 */
export class DataDerivationsService {
    /**
     * Process raw team statistics into ranking data
     */
    static processTeamStatsToRanking(
        teamStats: TeamStats[],
        csvPlayerData: Array<{ id: string; btag?: string; name?: string }> = []
    ): RankingPlayer[] {
        const groupedStats =
            TeamStatsAggregator.groupStatsByCharacterId(teamStats)
        const ranking: RankingPlayer[] = []

        // Create lookup for CSV data
        const csvLookup = new Map(
            csvPlayerData.map(player => [player.id, player])
        )

        // Process each character's team data
        groupedStats.forEach((playerTeams, characterId) => {
            const derivedStats = TeamStatsAggregator.aggregatePlayerStats(
                characterId,
                playerTeams
            )
            const csvData = csvLookup.get(String(characterId))

            const player: RankingPlayer = {
                ...derivedStats,
                btag: csvData?.btag,
                name: csvData?.name,
                playerCharacterId: characterId,
                race: derivedStats.race || null,
                ratingLast: derivedStats.ratingLast || null,
                leagueTypeLast: derivedStats.leagueTypeLast || null,
                gamesThisSeason: derivedStats.gamesThisSeason || 0,
                gamesPerRace: derivedStats.gamesPerRace || {
                    TERRAN: 0,
                    PROTOSS: 0,
                    ZERG: 0,
                    RANDOM: 0,
                },
                lastDatePlayed: derivedStats.lastDatePlayed || null,
                online: derivedStats.online || false,
                lastPlayed: derivedStats.lastDatePlayed || null,
            }

            ranking.push(player)
        })

        // Sort by rating (highest first)
        return ranking.sort((a, b) => (b.ratingLast || 0) - (a.ratingLast || 0))
    }

    /**
     * Add position indicators to ranking data using baseline comparison
     */
    static addPositionIndicators(
        currentRanking: RankingPlayer[],
        baselineRanking: RankingPlayer[]
    ): RankingPlayer[] {
        return PositionCalculator.addPositionChangeIndicators(
            currentRanking,
            baselineRanking
        )
    }

    /**
     * Filter ranking data based on minimum games threshold
     */
    static filterByMinimumGames(
        ranking: RankingPlayer[],
        minimumGames: number = 20
    ): RankingPlayer[] {
        return ranking.filter(player => player.gamesThisSeason >= minimumGames)
    }

    /**
     * Get ranking statistics summary
     */
    static getRankingStatistics(ranking: RankingPlayer[]): {
        totalPlayers: number
        activePlayers: number
        averageRating: number
        raceDistribution: Record<string, number>
        leagueDistribution: Record<string, number>
    } {
        const activePlayers = ranking.filter(player => player.online).length
        const averageRating =
            ranking.length > 0
                ? ranking.reduce(
                      (sum, player) => sum + (player.ratingLast || 0),
                      0
                  ) / ranking.length
                : 0

        const raceDistribution: Record<string, number> = {}
        const leagueDistribution: Record<string, number> = {}

        ranking.forEach(player => {
            // Count race distribution
            const race = player.race || 'UNKNOWN'
            raceDistribution[race] = (raceDistribution[race] || 0) + 1

            // Count league distribution
            const league = player.leagueTypeLast || 'UNKNOWN'
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
