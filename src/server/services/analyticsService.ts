import { CacheKeys } from '../utils/cacheKeys'
import { DataDerivationsService, OnlineStatusCalculator } from '../services/dataDerivations'
import { pulseService } from '../services/pulseService'
import { getDailySnapshot } from '../services/snapshotService'
import logger from '../logging/logger'
import { DateTime } from 'luxon'
import { incrementAnalyticsCacheHit, incrementAnalyticsCacheMiss, incrementAnalyticsError } from '../metrics/lite'
import { toCostaRicaTime } from '../utils/pulseApiHelper'
import { RankedPlayer } from '../../shared/types'

/**
 * Advanced Analytics Service providing comprehensive player statistics
 * Built on top of the existing DataDerivationsService infrastructure
 */
export class AnalyticsService {
    private static readonly CACHE_TTL_MINUTES = 15
    private static readonly EXPENSIVE_CACHE_TTL_MINUTES = 60

    /**
     * Generate comprehensive player analytics with caching
     */
    static async generatePlayerAnalytics(options: {
        timeframe?: 'current' | 'daily'
        includeInactive?: boolean
        race?: 'TERRAN' | 'PROTOSS' | 'ZERG' | 'RANDOM'
        minimumGames?: number
    }) {
        const { timeframe = 'current', includeInactive = false, race, minimumGames = 20 } = options

        // Create cache key for this specific request
        const cacheKey = this.generateCacheKey('player-analytics', {
            timeframe,
            includeInactive,
            race,
            minimumGames,
        })

        logger.info(
            {
                cacheKey,
                options,
                feature: 'analytics',
            },
            'Generating player analytics'
        )

        try {
            // Get raw player data
            const rawData = await this.fetchPlayerData(timeframe)

            // Apply filters
            let filteredData = rawData

            if (!includeInactive) {
                filteredData = DataDerivationsService.filterByMinimumGames(filteredData, minimumGames)
            }

            if (race) {
                filteredData = filteredData.filter((player) => player.mainRace === race)
            }

            // Generate comprehensive analytics
            const analytics = {
                metadata: {
                    totalPlayers: filteredData.length,
                    dataSource: timeframe,
                    filters: { includeInactive, race, minimumGames },
                    generatedAt: DateTime.now().toISO(),
                    cacheTTL: this.CACHE_TTL_MINUTES * 60,
                },
                playerActivity: this.generateActivityAnalytics(filteredData),
                raceDistribution: this.generateRaceAnalytics(filteredData),
                leagueDistribution: this.generateLeagueAnalytics(filteredData),
                ratingStatistics: this.generateRatingAnalytics(filteredData),
                gameActivity: this.generateGameActivityAnalytics(filteredData),
                onlineStatus: this.generateOnlineStatusAnalytics(filteredData),
                performanceMetrics: this.generatePerformanceMetrics(filteredData),
            }

            logger.info(
                {
                    totalPlayers: analytics.metadata.totalPlayers,
                    feature: 'analytics',
                },
                'Player analytics generated successfully'
            )

            return analytics
        } catch (error) {
            incrementAnalyticsError('service')

            logger.error(
                {
                    error,
                    options,
                    feature: 'analytics',
                },
                'Failed to generate player analytics'
            )
            throw error
        }
    }

    /**
     * Generate advanced activity analysis with temporal patterns
     */
    static async generateActivityAnalysis(options: {
        includeInactive?: boolean
        groupBy?: 'race' | 'league' | 'activity'
        timeframe?: 'current' | 'daily'
        minimumGames?: number
    }) {
        const { includeInactive = false, groupBy = 'activity', timeframe = 'current', minimumGames = 20 } = options

        const cacheKey = this.generateCacheKey('activity-analysis', options)

        logger.info(
            {
                cacheKey,
                options,
                feature: 'analytics',
            },
            'Generating activity analysis'
        )

        try {
            const rawData = await this.fetchPlayerData(timeframe)

            let filteredData = rawData
            if (!includeInactive) {
                filteredData = DataDerivationsService.filterByMinimumGames(filteredData, minimumGames)
            }

            const analysis: any = {
                metadata: {
                    totalPlayers: filteredData.length,
                    groupBy,
                    generatedAt: DateTime.now().toISO(),
                    cacheTTL: this.EXPENSIVE_CACHE_TTL_MINUTES * 60,
                },
                activityBuckets: this.generateActivityBuckets(filteredData),
                temporalPatterns: this.generateTemporalPatterns(filteredData),
                engagementMetrics: this.generateEngagementMetrics(filteredData),
                retentionAnalysis: this.generateRetentionAnalysis(filteredData),
            }

            // Group results based on groupBy parameter
            if (groupBy === 'race') {
                analysis.raceBreakdown = this.generateRaceActivityBreakdown(filteredData)
            } else if (groupBy === 'league') {
                analysis.leagueBreakdown = this.generateLeagueActivityBreakdown(filteredData)
            }

            logger.info(
                {
                    totalPlayers: analysis.metadata.totalPlayers,
                    feature: 'analytics',
                },
                'Activity analysis generated successfully'
            )

            return analysis
        } catch (error) {
            incrementAnalyticsError('service')

            logger.error(
                {
                    error,
                    options,
                    feature: 'analytics',
                },
                'Failed to generate activity analysis'
            )
            throw error
        }
    }

    /**
     * Fetch player data based on timeframe
     */
    private static async fetchPlayerData(timeframe: 'current' | 'daily'): Promise<RankedPlayer[]> {
        if (timeframe === 'daily') {
            const snapshot = await getDailySnapshot()
            return snapshot.data || []
        } else {
            const rawData = await pulseService.getRanking()
            return rawData || []
        }
    }

    /**
     * Generate activity analytics
     */
    private static generateActivityAnalytics(players: RankedPlayer[]) {
        const onlineCount = players.filter((p) => p.online).length
        const offlineCount = players.length - onlineCount

        return {
            onlinePlayerCount: onlineCount,
            offlinePlayerCount: offlineCount,
            onlinePercentage: players.length > 0 ? ((onlineCount / players.length) * 100).toFixed(2) : '0.00',
            totalActivePlayers: players.length,
        }
    }

  
    // Helper to aggregate games by race for readability and reuse
    private static aggregateGamesByRace(players: RankedPlayer[]): Record<string, number> {
        return players.reduce((acc: Record<string, number>, player: RankedPlayer) => {
            Object.entries(player.gamesPerRace || {}).forEach(([race, games]) => {
                acc[race] = (acc[race] || 0) + games
            })
            return acc
        }, {})
    }

    
    /**
     * Generate race distribution analytics
     */
    private static generateRaceAnalytics(players: RankedPlayer[]): {
        distribution: Record<string, number>
        percentages: Record<string, string>
        totalGamesPlayed: number
        gamesByRace: Record<string, number>
    } {
        const raceStats = DataDerivationsService.getRankingStatistics(players)

        const gamesByRace = this.aggregateGamesByRace(players)
        const totalGames = players.reduce((sum, player) => sum + (player.totalGames || 0), 0) 

        const percentages = Object.entries(raceStats.raceDistribution).reduce((acc: Record<string, string>, [race, count]) => {
            acc[race] = players.length > 0 ? ((count / players.length) * 100).toFixed(2) : '0.00'
            return acc
        }, {})

        return {
            distribution: raceStats.raceDistribution,
            percentages,
            totalGamesPlayed: totalGames,
            gamesByRace,
        }
    }

    /**
     * Generate league distribution analytics
     */
    private static generateLeagueAnalytics(players: RankedPlayer[]) {
        const raceStats = DataDerivationsService.getRankingStatistics(players)

        return {
            distribution: raceStats.leagueDistribution,
            percentages: Object.entries(raceStats.leagueDistribution).reduce((acc, [league, count]) => {
                acc[league] = players.length > 0 ? ((count / players.length) * 100).toFixed(2) : '0.00'
                return acc
            }, {} as Record<string, string>),
        }
    }

    /**
     * Generate rating statistics
     */
    private static generateRatingAnalytics(players: RankedPlayer[]) {
        const ratings = players
            .map((p) => Array.isArray(p.rating) ? p.rating[0] : p.rating)
            .filter((r) => r !== null && r !== undefined)
            .sort((a, b) => a - b)

        if (ratings.length === 0) {
            return {
                average: 0,
                median: 0,
                min: 0,
                max: 0,
                standardDeviation: 0,
            }
        }

        const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        const median = ratings[Math.floor(ratings.length / 2)]
        const variance = ratings.reduce((sum, r) => sum + Math.pow(r - average, 2), 0) / ratings.length
        const standardDeviation = Math.sqrt(variance)

        return {
            average: Math.round(average),
            median,
            min: Math.min(...ratings),
            max: Math.max(...ratings),
            standardDeviation: Math.round(standardDeviation),
        }
    }

    /**
     * Generate game activity analytics
     */
    private static generateGameActivityAnalytics(players: RankedPlayer[]) {
        const totalGames = players.reduce((sum, p) => sum + (p.totalGames || 0), 0)
        const averageGames = players.length > 0 ? totalGames / players.length : 0
        const gamesDistribution = players.reduce(
            (acc, player) => {
                const games = player.totalGames || 0
                if (games === 0) acc.noGames++
                else if (games < 10) acc.lowActivity++
                else if (games < 50) acc.moderateActivity++
                else acc.highActivity++
                return acc
            },
            { noGames: 0, lowActivity: 0, moderateActivity: 0, highActivity: 0 }
        )

        return {
            totalGames,
            averageGames: Math.round(averageGames * 100) / 100,
            activityDistribution: gamesDistribution,
        }
    }

    /**
     * Generate online status analytics
     */
    private static generateOnlineStatusAnalytics(players: RankedPlayer[]) {
        return {
            currentlyOnline: players.filter((p) => p.online).length,
            totalPlayers: players.length,
            onlinePercentage:
                players.length > 0
                    ? ((players.filter((p) => p.online).length / players.length) * 100).toFixed(2)
                    : '0.00',
        }
    }

    /**
     * Generate performance metrics
     */
    private static generatePerformanceMetrics(players: RankedPlayer[]) {
        const playersWithWinData = players.filter(p => {
            const wins = Array.isArray(p.wins) ? p.wins[0] : p.wins
            const losses = Array.isArray(p.losses) ? p.losses[0] : p.losses
            return wins !== undefined && losses !== undefined
        })

        if (playersWithWinData.length === 0) {
            return {
                averageWinRate: 0,
                playersWithWinRateData: 0,
                note: 'Win rate data available but no valid records found',
            }
        }

        const totalWinRate = playersWithWinData.reduce((sum, player) => {
            const wins = Array.isArray(player.wins) ? player.wins[0] : player.wins
            const losses = Array.isArray(player.losses) ? player.losses[0] : player.losses
            const totalGames = wins + losses
            return sum + (totalGames > 0 ? (wins / totalGames) * 100 : 0)
        }, 0)

        return {
            averageWinRate: Math.round((totalWinRate / playersWithWinData.length) * 100) / 100,
            playersWithWinRateData: playersWithWinData.length,
        }
    }

    /**
     * Generate activity buckets based on last played time
     */
    private static generateActivityBuckets(players: RankedPlayer[]) {
        const buckets = {
            veryRecent: 0, // < 1 hour
            recent: 0, // 1-6 hours
            today: 0, // 6-24 hours
            yesterday: 0, // 1-2 days
            thisWeek: 0, // 2-7 days
            older: 0, // > 7 days
        }

        players.forEach((player) => {
            const lastPlayed = player.lastPlayed
            const hours = OnlineStatusCalculator.getHoursSinceLastActivity(String(lastPlayed))

            if (hours !== null) {
                if (hours < 1) buckets.veryRecent++
                else if (hours < 6) buckets.recent++
                else if (hours < 24) buckets.today++
                else if (hours < 48) buckets.yesterday++
                else if (hours < 168) buckets.thisWeek++
                else buckets.older++
            }
        })

        return buckets
    }

    /**
     * Generate temporal activity patterns
     */
    private static generateTemporalPatterns(players: RankedPlayer[]) {
        // Analyze activity patterns by day of week, hour, etc.
        const hourlyActivity = Array(24).fill(0)
        const dailyActivity = Array(7).fill(0)

        players.forEach((player) => {
            const lastPlayed = player.lastPlayed
            if (lastPlayed) {
                const date = toCostaRicaTime(String(lastPlayed))
                if (date.isValid) {
                    hourlyActivity[date.hour]++
                    dailyActivity[date.weekday - 1]++
                }
            }
        })

        return {
            hourlyDistribution: hourlyActivity,
            dailyDistribution: dailyActivity,
            peakHour: hourlyActivity.indexOf(Math.max(...hourlyActivity)),
            peakDay: dailyActivity.indexOf(Math.max(...dailyActivity)),
        }
    }

    /**
     * Generate engagement metrics
     */
    private static generateEngagementMetrics(players: RankedPlayer[]) {
        const totalGames = players.reduce((sum, p) => sum + (p.totalGames || 0), 0)
        const activePlayers = players.filter((p) => (p.totalGames || 0) > 0)

        const activeCount = activePlayers.length
        const engagementRate = players.length > 0 ? ((activeCount / players.length) * 100).toFixed(2) : '0.00'
        const averageGamesPerActive = activeCount > 0 ? totalGames / activeCount : 0

        return {
            totalGames,
            activePlayers: activeCount,
            averageGamesPerActivePlayer: averageGamesPerActive,
            engagementRate,
        }
    }

    /**
     * Generate retention analysis
     */
    private static generateRetentionAnalysis(players: RankedPlayer[]) {
        const retentionBuckets = {
            daily: 0, // Active within 24 hours
            weekly: 0, // Active within 7 days
            monthly: 0, // Active within 30 days
            inactive: 0, // Not active for > 30 days
        }

        players.forEach((player) => {
            const hours = OnlineStatusCalculator.getHoursSinceLastActivity(player.lastDatePlayed)

            if (hours !== null) {
                if (hours <= 24) retentionBuckets.daily++
                else if (hours <= 168) retentionBuckets.weekly++
                else if (hours <= 720) retentionBuckets.monthly++
                else retentionBuckets.inactive++
            }
        })

        return retentionBuckets
    }

    /**
     * Generate race-specific activity breakdown
     */
    private static generateRaceActivityBreakdown(players: RankedPlayer[]) {
        const races = ['TERRAN', 'PROTOSS', 'ZERG', 'RANDOM']
        const breakdown: Record<string, any> = {}

        races.forEach((race) => {
            const racePlayers = players.filter((p) => p.mainRace === race)
            breakdown[race] = {
                totalPlayers: racePlayers.length,
                activityBuckets: this.generateActivityBuckets(racePlayers),
                averageGames:
                    racePlayers.length > 0
                        ? racePlayers.reduce((sum, p) => sum + (p.totalGames || 0), 0) / racePlayers.length
                        : 0,
            }
        })

        return breakdown
    }

    /**
     * Generate league-specific activity breakdown
     */
    private static generateLeagueActivityBreakdown(players: RankedPlayer[]) {
        const leagues = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER']
        const breakdown: Record<string, any> = {}

        leagues.forEach((league) => {
            const leaguePlayers = players.filter((p) => this.getLeagueName(p.leagueType) === league)
            breakdown[league] = {
                totalPlayers: leaguePlayers.length,
                activityBuckets: this.generateActivityBuckets(leaguePlayers),
                averageRating:
                    leaguePlayers.length > 0
                        ? leaguePlayers.reduce((sum, p) => {
                            const rating = Array.isArray(p.rating) ? p.rating[0] : p.rating
                            return sum + (rating || 0)
                        }, 0) / leaguePlayers.length
                        : 0,
            }
        })

        return breakdown
    }

    /**
     * Convert league type number to name
     */
    private static getLeagueName(leagueType: number | number[] | undefined): string {
        const type = Array.isArray(leagueType) ? leagueType[0] : leagueType
        
        switch (type) {
            case 0: return 'BRONZE'
            case 1: return 'SILVER'
            case 2: return 'GOLD'
            case 3: return 'PLATINUM'
            case 4: return 'DIAMOND'
            case 5: return 'MASTER'
            case 6: return 'GRANDMASTER'
            default: return 'UNKNOWN'
        }
    }

    /**
     * Generate cache key for analytics requests
     */
    private static generateCacheKey(prefix: string, params: Record<string, any>): string {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((acc, key) => {
                acc[key] = params[key]
                return acc
            }, {} as Record<string, any>)

        return CacheKeys.analytics
            .playerActivity()
            .withIdentifier(prefix + '-' + JSON.stringify(sortedParams))
            .build()
    }
}
