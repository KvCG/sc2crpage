import { CacheKeys } from '../utils/cacheKeys'
import {
    DataDerivationsService,
    OnlineStatusCalculator,
    type RankingPlayer,
} from '../services/dataDerivations'
import { getTop } from '../services/pulseApi'
import { getDailySnapshot } from '../services/snapshotService'
import logger from '../logging/logger'
import { DateTime } from 'luxon'
import {
    incrementAnalyticsCacheHit,
    incrementAnalyticsCacheMiss,
    incrementAnalyticsError,
} from '../metrics/lite'

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
        const {
            timeframe = 'current',
            includeInactive = false,
            race,
            minimumGames = 20,
        } = options

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
                filteredData = DataDerivationsService.filterByMinimumGames(
                    filteredData,
                    minimumGames
                )
            }

            if (race) {
                filteredData = filteredData.filter(
                    player => player.race === race
                )
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
                performanceMetrics:
                    this.generatePerformanceMetrics(filteredData),
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
        const {
            includeInactive = false,
            groupBy = 'activity',
            timeframe = 'current',
            minimumGames = 20,
        } = options

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
                filteredData = DataDerivationsService.filterByMinimumGames(
                    filteredData,
                    minimumGames
                )
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
                analysis.raceBreakdown =
                    this.generateRaceActivityBreakdown(filteredData)
            } else if (groupBy === 'league') {
                analysis.leagueBreakdown =
                    this.generateLeagueActivityBreakdown(filteredData)
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
    private static async fetchPlayerData(
        timeframe: 'current' | 'daily'
    ): Promise<RankingPlayer[]> {
        if (timeframe === 'daily') {
            const snapshot = await getDailySnapshot()
            return snapshot.data || []
        } else {
            const rawData = await getTop()
            // Convert to RankingPlayer format
            return rawData.map((player: any) => ({
                playerCharacterId: player.playerCharacterId,
                race: player.race,
                leagueTypeLast: player.leagueTypeLast,
                lastDatePlayed: player.lastDatePlayed,
                online: player.online || false,
                ratingLast: player.ratingLast,
                gamesThisSeason: player.gamesThisSeason,
                gamesPerRace: player.gamesPerRace || {},
                winRate: player.winRate,
                rank: player.rank,
                lastPlayed: player.lastPlayed || null,
            }))
        }
    }

    /**
     * Generate activity analytics
     */
    private static generateActivityAnalytics(players: RankingPlayer[]) {
        const onlineCount = players.filter(p => p.online).length
        const offlineCount = players.length - onlineCount

        return {
            onlinePlayerCount: onlineCount,
            offlinePlayerCount: offlineCount,
            onlinePercentage:
                players.length > 0
                    ? ((onlineCount / players.length) * 100).toFixed(2)
                    : '0.00',
            totalActivePlayers: players.length,
        }
    }

    /**
     * Generate race distribution analytics
     */
    private static generateRaceAnalytics(players: RankingPlayer[]) {
        const raceStats = DataDerivationsService.getRankingStatistics(players)
        const totalGames = Object.values(
            players.reduce((acc, player) => {
                Object.entries(player.gamesPerRace || {}).forEach(
                    ([race, games]) => {
                        acc[race] = (acc[race] || 0) + games
                    }
                )
                return acc
            }, {} as Record<string, number>)
        ).reduce((sum, games) => sum + games, 0)

        return {
            distribution: raceStats.raceDistribution,
            percentages: Object.entries(raceStats.raceDistribution).reduce(
                (acc, [race, count]) => {
                    acc[race] =
                        players.length > 0
                            ? ((count / players.length) * 100).toFixed(2)
                            : '0.00'
                    return acc
                },
                {} as Record<string, string>
            ),
            totalGamesPlayed: totalGames,
            gamesByRace: players.reduce((acc, player) => {
                Object.entries(player.gamesPerRace || {}).forEach(
                    ([race, games]) => {
                        acc[race] = (acc[race] || 0) + games
                    }
                )
                return acc
            }, {} as Record<string, number>),
        }
    }

    /**
     * Generate league distribution analytics
     */
    private static generateLeagueAnalytics(players: RankingPlayer[]) {
        const raceStats = DataDerivationsService.getRankingStatistics(players)

        return {
            distribution: raceStats.leagueDistribution,
            percentages: Object.entries(raceStats.leagueDistribution).reduce(
                (acc, [league, count]) => {
                    acc[league] =
                        players.length > 0
                            ? ((count / players.length) * 100).toFixed(2)
                            : '0.00'
                    return acc
                },
                {} as Record<string, string>
            ),
        }
    }

    /**
     * Generate rating statistics
     */
    private static generateRatingAnalytics(players: RankingPlayer[]) {
        const ratings = players
            .map(p => p.ratingLast)
            .filter(r => r !== null && r !== undefined)
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
        const variance =
            ratings.reduce((sum, r) => sum + Math.pow(r - average, 2), 0) /
            ratings.length
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
    private static generateGameActivityAnalytics(players: RankingPlayer[]) {
        const totalGames = players.reduce(
            (sum, p) => sum + (p.gamesThisSeason || 0),
            0
        )
        const averageGames =
            players.length > 0 ? totalGames / players.length : 0
        const gamesDistribution = players.reduce(
            (acc, player) => {
                const games = player.gamesThisSeason || 0
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
    private static generateOnlineStatusAnalytics(players: RankingPlayer[]) {
        return {
            currentlyOnline: players.filter(p => p.online).length,
            totalPlayers: players.length,
            onlinePercentage:
                players.length > 0
                    ? (
                          (players.filter(p => p.online).length /
                              players.length) *
                          100
                      ).toFixed(2)
                    : '0.00',
        }
    }

    /**
     * Generate performance metrics
     */
    private static generatePerformanceMetrics(_players: RankingPlayer[]) {
        // Win rate data not available in current RankingPlayer type
        return {
            averageWinRate: 0,
            playersWithWinRateData: 0,
            note: 'Win rate data not available in current data structure',
        }
    }

    /**
     * Generate activity buckets based on last played time
     */
    private static generateActivityBuckets(players: RankingPlayer[]) {
        const buckets = {
            veryRecent: 0, // < 1 hour
            recent: 0, // 1-6 hours
            today: 0, // 6-24 hours
            yesterday: 0, // 1-2 days
            thisWeek: 0, // 2-7 days
            older: 0, // > 7 days
        }

        players.forEach(player => {
            const hours = OnlineStatusCalculator.getHoursSinceLastActivity(
                player.lastPlayed
            )

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
    private static generateTemporalPatterns(players: RankingPlayer[]) {
        // Analyze activity patterns by day of week, hour, etc.
        const hourlyActivity = Array(24).fill(0)
        const dailyActivity = Array(7).fill(0)

        players.forEach(player => {
            if (player.lastPlayed) {
                const date = DateTime.fromISO(player.lastPlayed)
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
    private static generateEngagementMetrics(players: RankingPlayer[]) {
        const totalGames = players.reduce(
            (sum, p) => sum + (p.gamesThisSeason || 0),
            0
        )
        const activePlayers = players.filter(p => (p.gamesThisSeason || 0) > 0)

        return {
            totalGames,
            activePlayers: activePlayers.length,
            averageGamesPerActivePlayer:
                activePlayers.length > 0
                    ? totalGames / activePlayers.length
                    : 0,
            engagementRate:
                players.length > 0
                    ? ((activePlayers.length / players.length) * 100).toFixed(2)
                    : '0.00',
        }
    }

    /**
     * Generate retention analysis
     */
    private static generateRetentionAnalysis(players: RankingPlayer[]) {
        const retentionBuckets = {
            daily: 0, // Active within 24 hours
            weekly: 0, // Active within 7 days
            monthly: 0, // Active within 30 days
            inactive: 0, // Not active for > 30 days
        }

        players.forEach(player => {
            const hours = OnlineStatusCalculator.getHoursSinceLastActivity(
                player.lastDatePlayed
            )

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
    private static generateRaceActivityBreakdown(players: RankingPlayer[]) {
        const races = ['TERRAN', 'PROTOSS', 'ZERG', 'RANDOM']
        const breakdown: Record<string, any> = {}

        races.forEach(race => {
            const racePlayers = players.filter(p => p.race === race)
            breakdown[race] = {
                totalPlayers: racePlayers.length,
                activityBuckets: this.generateActivityBuckets(racePlayers),
                averageGames:
                    racePlayers.length > 0
                        ? racePlayers.reduce(
                              (sum, p) => sum + (p.gamesThisSeason || 0),
                              0
                          ) / racePlayers.length
                        : 0,
            }
        })

        return breakdown
    }

    /**
     * Generate league-specific activity breakdown
     */
    private static generateLeagueActivityBreakdown(players: RankingPlayer[]) {
        const leagues = [
            'BRONZE',
            'SILVER',
            'GOLD',
            'PLATINUM',
            'DIAMOND',
            'MASTER',
            'GRANDMASTER',
        ]
        const breakdown: Record<string, any> = {}

        leagues.forEach(league => {
            const leaguePlayers = players.filter(
                p => p.leagueTypeLast === league
            )
            breakdown[league] = {
                totalPlayers: leaguePlayers.length,
                activityBuckets: this.generateActivityBuckets(leaguePlayers),
                averageRating:
                    leaguePlayers.length > 0
                        ? leaguePlayers.reduce(
                              (sum, p) => sum + (p.ratingLast || 0),
                              0
                          ) / leaguePlayers.length
                        : 0,
            }
        })

        return breakdown
    }

    /**
     * Generate cache key for analytics requests
     */
    private static generateCacheKey(
        prefix: string,
        params: Record<string, any>
    ): string {
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
