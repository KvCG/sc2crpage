import { DateTime } from 'luxon'
import { PlayerAnalyticsPersistence } from './playerAnalyticsPersistence'
import { getDailySnapshot, SnapshotResponse } from './snapshotService'
import logger from '../logging/logger'

/**
 * Delta Computation Engine
 * 
 * Provides advanced analytics for player position changes, activity patterns,
 * and ranking evolution over configurable time windows. Builds upon existing
 * rankingHelper.ts patterns with enhanced server-side capabilities.
 */

export interface PlayerDelta {
    id: number
    btag?: string
    name?: string
    
    // Position Changes
    positionChangeIndicator: 'up' | 'down' | 'none'
    positionDelta?: number
    previousRank?: number
    currentRank: number
    
    // Rating Changes  
    ratingChange?: number
    previousRating?: number
    currentRating: number
    
    // Activity Metrics
    activityLevel: 'high' | 'medium' | 'low' | 'inactive'
    daysSinceLastGame?: number
    gamesPlayedWindow?: number
    
    // Confidence Scoring
    confidenceScore: number // 0-100, based on data freshness and sample size
    dataAge: number // hours since last snapshot
    
    // Metadata
    race?: string
    leagueType?: number
    timestamp: string
}

export interface DeltaComputationOptions {
    timeWindowHours?: number // Default: 24 hours
    includeInactive?: boolean // Default: false
    minimumConfidence?: number // Default: 50
    maxDataAge?: number // Default: 48 hours
}

export interface ActivityAnalysis {
    totalPlayers: number
    activePlayers: number
    movers: {
        promotions: number
        demotions: number
        significantRises: number // +5 or more positions
        significantFalls: number // -5 or more positions
    }
    activityLevels: {
        high: number
        medium: number  
        low: number
        inactive: number
    }
    averageRatingChange: number
    timestamp: string
}

export class DeltaComputationEngine {
    /**
     * Compute player deltas between current snapshot and historical baseline
     */
    static async computePlayerDeltas(options: DeltaComputationOptions = {}): Promise<PlayerDelta[]> {
        const { 
            timeWindowHours = 24, 
            includeInactive = false,
            minimumConfidence = 50,
            maxDataAge = 48
        } = options

        try {
            // Get current snapshot
            const currentSnapshot = await getDailySnapshot()
            
            // Find appropriate baseline snapshot
            const baselineSnapshot = await this.findBaselineSnapshot(timeWindowHours, maxDataAge)
            
            if (!baselineSnapshot) {
                logger.warn({
                    timeWindowHours,
                    feature: 'deltaComputation'
                }, 'No suitable baseline snapshot found')
                return this.computeBaselineDeltas(currentSnapshot)
            }

            const deltas = this.computeDeltasBetweenSnapshots(
                currentSnapshot,
                baselineSnapshot,
                { includeInactive, minimumConfidence, maxDataAge }
            )

            logger.info({
                currentPlayers: currentSnapshot.data?.length || 0,
                baselinePlayers: baselineSnapshot.data?.length || 0,
                deltaCount: deltas.length,
                timeWindowHours,
                feature: 'deltaComputation'
            }, 'Player deltas computed successfully')

            return deltas

        } catch (error) {
            logger.error({ error, options, feature: 'deltaComputation' }, 'Failed to compute player deltas')
            throw error
        }
    }

    /**
     * Compute activity analysis across the player base
     */
    static async computeActivityAnalysis(options: DeltaComputationOptions = {}): Promise<ActivityAnalysis> {
        try {
            const deltas = await this.computePlayerDeltas(options)
            
            const analysis: ActivityAnalysis = {
                totalPlayers: deltas.length,
                activePlayers: deltas.filter(d => d.activityLevel !== 'inactive').length,
                movers: {
                    promotions: deltas.filter(d => d.ratingChange && d.ratingChange > 0).length,
                    demotions: deltas.filter(d => d.ratingChange && d.ratingChange < 0).length,
                    significantRises: deltas.filter(d => d.positionDelta && d.positionDelta >= 5).length,
                    significantFalls: deltas.filter(d => d.positionDelta && d.positionDelta <= -5).length
                },
                activityLevels: {
                    high: deltas.filter(d => d.activityLevel === 'high').length,
                    medium: deltas.filter(d => d.activityLevel === 'medium').length,
                    low: deltas.filter(d => d.activityLevel === 'low').length,
                    inactive: deltas.filter(d => d.activityLevel === 'inactive').length
                },
                averageRatingChange: this.calculateAverageRatingChange(deltas),
                timestamp: DateTime.now().toISO()
            }

            logger.info({
                analysis,
                feature: 'deltaComputation'
            }, 'Activity analysis completed')

            return analysis

        } catch (error) {
            logger.error({ error, options, feature: 'deltaComputation' }, 'Failed to compute activity analysis')
            throw error
        }
    }

    /**
     * Get top movers (biggest position changes) within time window
     */
    static async getTopMovers(direction: 'up' | 'down' | 'both' = 'both', limit = 10, options: DeltaComputationOptions = {}): Promise<PlayerDelta[]> {
        try {
            const deltas = await this.computePlayerDeltas(options)
            
            let filtered = deltas.filter(d => d.positionDelta !== undefined && d.positionDelta !== 0)
            
            if (direction === 'up') {
                filtered = filtered.filter(d => d.positionDelta! > 0)
                filtered.sort((a, b) => (b.positionDelta || 0) - (a.positionDelta || 0))
            } else if (direction === 'down') {
                filtered = filtered.filter(d => d.positionDelta! < 0)
                filtered.sort((a, b) => (a.positionDelta || 0) - (b.positionDelta || 0))
            } else {
                filtered.sort((a, b) => Math.abs(b.positionDelta || 0) - Math.abs(a.positionDelta || 0))
            }

            const topMovers = filtered.slice(0, limit)

            logger.info({
                direction,
                totalMovers: filtered.length,
                returnedCount: topMovers.length,
                feature: 'deltaComputation'
            }, 'Top movers retrieved')

            return topMovers

        } catch (error) {
            logger.error({ error, direction, limit, feature: 'deltaComputation' }, 'Failed to get top movers')
            throw error
        }
    }

    /**
     * Find appropriate baseline snapshot within the specified time window
     */
    private static async findBaselineSnapshot(timeWindowHours: number, maxDataAge: number): Promise<SnapshotResponse | null> {
        try {
            const targetTime = DateTime.now().minus({ hours: timeWindowHours })
            
            // Get available backups within age limit
            const backups = await PlayerAnalyticsPersistence.listBackups({ 
                maxAge: maxDataAge 
            })
            
            if (backups.length === 0) return null

            // Find backup closest to target time window
            let bestBackup = backups[0]
            let bestTimeDiff = Math.abs(bestBackup.timestamp.diff(targetTime, 'hours').hours)
            
            for (const backup of backups) {
                const timeDiff = Math.abs(backup.timestamp.diff(targetTime, 'hours').hours)
                if (timeDiff < bestTimeDiff) {
                    bestBackup = backup
                    bestTimeDiff = timeDiff
                }
            }
            
            // Restore the selected backup
            return await PlayerAnalyticsPersistence.restoreSnapshot(bestBackup.fileId)

        } catch (error) {
            logger.warn({ error, timeWindowHours, feature: 'deltaComputation' }, 'Failed to find baseline snapshot')
            return null
        }
    }

    /**
     * Compute deltas between two snapshots using enhanced ranking helper patterns
     */
    private static computeDeltasBetweenSnapshots(
        current: SnapshotResponse,
        baseline: SnapshotResponse,
        options: { includeInactive: boolean, minimumConfidence: number, maxDataAge: number }
    ): PlayerDelta[] {
        const currentData = current.data || []
        const baselineData = baseline.data || []
        
        // Create lookup maps for efficient comparison
        const baselineMap = new Map()
        baselineData.forEach((player: any, index: number) => {
            if (player?.btag) {
                baselineMap.set(player.btag, { ...player, previousRank: index })
            }
        })

        const dataAge = DateTime.fromISO(current.createdAt).diffNow('hours').hours * -1

        return currentData.map((player: any, currentRank: number) => {
            const baseline = player?.btag ? baselineMap.get(player.btag) : null
            
            // Position delta calculation (same logic as client rankingHelper)
            const positionDelta = baseline?.previousRank !== undefined 
                ? baseline.previousRank - currentRank 
                : undefined
            
            const positionChangeIndicator = positionDelta === undefined ? 'none' :
                positionDelta > 0 ? 'up' :
                positionDelta < 0 ? 'down' : 'none'

            // Rating change calculation
            const currentRating = player?.ratingLast || player?.rating || 0
            const previousRating = baseline?.ratingLast || baseline?.rating
            const ratingChange = previousRating !== undefined 
                ? currentRating - previousRating 
                : undefined

            // Activity level assessment
            const daysSinceLastGame = player?.daysSinceLastGame || 0
            const activityLevel = this.calculateActivityLevel(daysSinceLastGame, player?.gamesPlayedRecent)

            // Confidence scoring based on data freshness and completeness
            const confidenceScore = this.calculateConfidenceScore(
                player, 
                baseline, 
                dataAge, 
                options.maxDataAge
            )

            const delta: PlayerDelta = {
                id: player?.id || player?.playerCharacterId || currentRank,
                btag: player?.btag,
                name: player?.name || player?.characterName,
                
                // Position metrics
                positionChangeIndicator,
                positionDelta,
                previousRank: baseline?.previousRank,
                currentRank,
                
                // Rating metrics  
                ratingChange,
                previousRating,
                currentRating,
                
                // Activity metrics
                activityLevel,
                daysSinceLastGame,
                gamesPlayedWindow: player?.gamesPlayedRecent,
                
                // Confidence and metadata
                confidenceScore,
                dataAge,
                race: player?.race,
                leagueType: player?.leagueTypeLast || player?.leagueType,
                timestamp: current.createdAt
            }

            return delta
        }).filter(delta => {
            // Apply filters
            if (!options.includeInactive && delta.activityLevel === 'inactive') {
                return false
            }
            if (delta.confidenceScore < options.minimumConfidence) {
                return false  
            }
            return true
        })
    }

    /**
     * Compute baseline deltas when no historical data is available
     */
    private static computeBaselineDeltas(snapshot: SnapshotResponse): PlayerDelta[] {
        const dataAge = DateTime.fromISO(snapshot.createdAt).diffNow('hours').hours * -1
        
        return (snapshot.data || []).map((player: any, index: number) => ({
            id: player?.id || player?.playerCharacterId || index,
            btag: player?.btag,
            name: player?.name || player?.characterName,
            
            positionChangeIndicator: 'none' as const,
            currentRank: index,
            currentRating: player?.ratingLast || player?.rating || 0,
            
            activityLevel: this.calculateActivityLevel(
                player?.daysSinceLastGame || 0, 
                player?.gamesPlayedRecent
            ),
            daysSinceLastGame: player?.daysSinceLastGame,
            gamesPlayedWindow: player?.gamesPlayedRecent,
            
            confidenceScore: 75, // Baseline score for current data
            dataAge,
            race: player?.race,
            leagueType: player?.leagueTypeLast || player?.leagueType,
            timestamp: snapshot.createdAt
        }))
    }

    /**
     * Calculate activity level based on recent gameplay
     */
    private static calculateActivityLevel(daysSinceLastGame: number, gamesPlayedRecent?: number): PlayerDelta['activityLevel'] {
        if (daysSinceLastGame > 14) return 'inactive'
        if (daysSinceLastGame <= 1 && (gamesPlayedRecent || 0) >= 10) return 'high'
        if (daysSinceLastGame <= 3 && (gamesPlayedRecent || 0) >= 5) return 'medium'
        if (daysSinceLastGame <= 7) return 'low'
        return 'inactive'
    }

    /**
     * Calculate confidence score based on data completeness and freshness
     */
    private static calculateConfidenceScore(
        current: any, 
        baseline: any, 
        dataAge: number, 
        maxDataAge: number
    ): number {
        let score = 100

        // Penalize stale data
        const agePenalty = (dataAge / maxDataAge) * 30
        score -= agePenalty

        // Penalize missing baseline data
        if (!baseline) {
            score -= 20
        }

        // Penalize incomplete player data
        if (!current?.btag) score -= 10
        if (!current?.ratingLast && !current?.rating) score -= 10
        if (!current?.race) score -= 5

        // Bonus for recent activity
        if ((current?.daysSinceLastGame || 999) <= 3) {
            score += 10
        }

        return Math.max(0, Math.min(100, Math.round(score)))
    }

    /**
     * Calculate average rating change across all players with rating deltas
     */
    private static calculateAverageRatingChange(deltas: PlayerDelta[]): number {
        const ratingChanges = deltas
            .map(d => d.ratingChange)
            .filter((change): change is number => typeof change === 'number')
        
        if (ratingChanges.length === 0) return 0
        
        const sum = ratingChanges.reduce((acc, change) => acc + change, 0)
        return Math.round((sum / ratingChanges.length) * 100) / 100 // Round to 2 decimals
    }
}