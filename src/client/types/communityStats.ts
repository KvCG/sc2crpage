/**
 * Type definitions for Community Stats feature
 * Based on OpenAPI schema for /api/player-analytics endpoint
 */

// Query parameter types
export interface AnalyticsQueryParams {
    timeframe?: 'current' | 'daily'
    includeInactive?: boolean
    minimumGames?: number
    race?: string | null
}

export interface ActivityQueryParams extends AnalyticsQueryParams {
    groupBy?: 'race' | 'league' | 'activity'
}

// Player Activity specific types (based on actual API response)
export interface ActivityBuckets {
    veryRecent: number
    recent: number
    today: number
    yesterday: number
    thisWeek: number
    older: number
}

export interface TemporalPatterns {
    hourlyDistribution: number[] // 24 hours array
    dailyDistribution: number[]  // 7 days array (Sun=0, Sat=6)
    peakHour: number
    peakDay: number
}

export interface EngagementMetrics {
    totalGames: number
    activePlayers: number
    averageGamesPerActivePlayer: number
    engagementRate: string // percentage as string
}

export interface RetentionAnalysis {
    daily: number
    weekly: number
    monthly: number
    inactive: number
}

export interface ActivityMetadata {
    totalPlayers: number
    groupBy: string
    generatedAt: string
    cacheTTL: number
}

export interface PlayerActivityData {
    metadata: ActivityMetadata
    activityBuckets: ActivityBuckets
    temporalPatterns: TemporalPatterns
    engagementMetrics: EngagementMetrics
    retentionAnalysis: RetentionAnalysis
}

export interface PlayerActivityResponse {
    success: boolean
    data: PlayerActivityData
}

// Response types (matching actual API schema)
export interface PlayerAnalyticsMetadata {
    totalPlayers: number
    dataSource: string
    filters: {
        includeInactive: boolean
        minimumGames: number
    }
    generatedAt: string
    cacheTTL: number
}

export interface PlayerActivity {
    onlinePlayerCount: number
    offlinePlayerCount: number
    onlinePercentage: string
    totalActivePlayers: number
}

export interface RaceDistribution {
    distribution: {
        PROTOSS: number
        ZERG: number
        TERRAN: number
        RANDOM: number
    }
    percentages: {
        PROTOSS: string
        ZERG: string
        TERRAN: string
        RANDOM: string
    }
    totalGamesPlayed: number
    gamesByRace: {
        PROTOSS: number
        TERRAN: number
        ZERG: number
        RANDOM: number
    }
}

export interface LeagueDistribution {
    distribution: {
        [key: string]: number // League IDs as keys
    }
    percentages: {
        [key: string]: string // League IDs as keys with percentage strings
    }
}

export interface RatingStatistics {
    average: number
    median: number
    min: number
    max: number
    standardDeviation: number
}

export interface GameActivity {
    totalGames: number
    averageGames: number
    activityDistribution: {
        noGames: number
        lowActivity: number
        moderateActivity: number
        highActivity: number
    }
}

export interface OnlineStatus {
    currentlyOnline: number
    totalPlayers: number
    onlinePercentage: string
}

export interface PerformanceMetrics {
    averageWinRate: number
    playersWithWinRateData: number
}

export interface PlayerAnalyticsData {
    metadata: PlayerAnalyticsMetadata
    playerActivity: PlayerActivity
    raceDistribution: RaceDistribution
    leagueDistribution: LeagueDistribution
    ratingStatistics: RatingStatistics
    gameActivity: GameActivity
    onlineStatus: OnlineStatus
    performanceMetrics: PerformanceMetrics
}

export interface PlayerAnalyticsResponse {
    success: boolean
    data: PlayerAnalyticsData
}

// UI State types
export interface CommunityStatsFilters {
    timeframe: 'current' | 'daily'
    includeInactive: boolean
    minimumGames: number
    selectedRace: string | null
}

// Chart data types
export interface ChartProps {
    data: any
    loading?: boolean
    error?: string
    title: string
    height?: number
}

// Cached data structure
export interface CachedAnalyticsData {
    data: PlayerAnalyticsData
    createdAt: string
    expiry: number
}

export interface CachedActivityData {
    data: PlayerActivityData
    createdAt: string
    expiry: number
}

// Movement analysis for histogram
export interface MovementBin {
    range: string
    count: number
    color: string
}