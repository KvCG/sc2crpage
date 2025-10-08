/**
 * Custom Match Discovery Service
 *
 * Discovers custom matches from SC2Pulse API for community players.
 * Currently implements a foundation that can be extended when match history
 * endpoints become available from Pulse API.
 */

import { PulseAdapter, pulseAdapter } from './pulseAdapter'
import { readCsv } from '../utils/csvParser'
import logger from '../logging/logger'
import { extractMatchResult } from './winnerTrackingService'
import {
    RawCustomMatch,
    ValidatedParticipant,
    ProcessedCustomMatch,
    CustomMatchConfig,
} from '../../shared/customMatchTypes'

/**
 * Service for discovering and validating custom matches from Pulse
 */
export class CustomMatchDiscoveryService {
    private adapter: PulseAdapter
    private communityPlayerIds: Set<string> = new Set()
    private communityPlayers: Map<string, any> = new Map()

    constructor(adapter: PulseAdapter = pulseAdapter) {
        this.adapter = adapter
    }

    /**
     * Initialize community player dataset from CSV
     */
    async initializeCommunityData(): Promise<void> {
        try {
            logger.info({ feature: 'custom-match-discovery' }, 'Loading community player data')

            // Read community player data from CSV (following existing patterns)
            const csvData = (await readCsv()) as any[]

            this.communityPlayerIds.clear()
            this.communityPlayers.clear()

            for (const row of csvData) {
                if (row.id) {
                    const playerId = String(row.id)
                    this.communityPlayerIds.add(playerId)
                    this.communityPlayers.set(playerId, {
                        id: playerId,
                        name: row.name || 'Unknown',
                        btag: row.btag,
                        rating: row.rating,
                        lastPlayed: row.lastPlayed,
                    })
                }
            }

            logger.info(
                {
                    feature: 'custom-match-discovery',
                    playerCount: this.communityPlayerIds.size,
                },
                'Community player data loaded'
            )
        } catch (error) {
            logger.error(
                { error, feature: 'custom-match-discovery' },
                'Failed to load community data'
            )
            throw error
        }
    }

    /**
     * Discover custom matches for community players using the /api/character-matches endpoint
     */
    async discoverCustomMatches(config: CustomMatchConfig): Promise<RawCustomMatch[]> {
        const cutoffDate = new Date(config.cutoffDate)
        const discoveredMatches: RawCustomMatch[] = []
        const seenMatchIds = new Set<number>()

        logger.info(
            {
                feature: 'custom-match-discovery',
                cutoffDate: config.cutoffDate,
                communityPlayerCount: this.communityPlayerIds.size,
            },
            'Starting custom match discovery'
        )

        // Get a sample of community players to query (to avoid overwhelming the API)
        const playerIds = Array.from(this.communityPlayerIds).slice(0, config.batchSize)

        for (const playerId of playerIds) {
            try {
                const playerMatches = await this.fetchPlayerMatches(playerId)

                // Filter and deduplicate matches
                for (const matchData of playerMatches) {
                    if (
                        this.isValidCustomMatch(matchData, cutoffDate) &&
                        !seenMatchIds.has(matchData.match.id)
                    ) {
                        discoveredMatches.push(matchData)
                        seenMatchIds.add(matchData.match.id)
                    }
                }

                // Add small delay to respect rate limits
                await this.delay(100)
            } catch (error) {
                logger.warn(
                    { error, playerId, feature: 'custom-match-discovery' },
                    'Failed to fetch matches for player'
                )
            }
        }

        logger.info(
            {
                feature: 'custom-match-discovery',
                matchCount: discoveredMatches.length,
                playersQueried: playerIds.length,
            },
            'Custom match discovery completed'
        )

        return discoveredMatches
    }

    /**
     * Validate match participants against community dataset
     */
    async validateParticipants(matches: RawCustomMatch[]): Promise<ProcessedCustomMatch[]> {
        const validatedMatches: ProcessedCustomMatch[] = []

        for (const match of matches) {
            try {
                const validatedParticipants = await this.validateMatchParticipants(match)

                // Only process matches with exactly 2 community participants (H2H)
                if (validatedParticipants.length === 2) {
                    // Extract match winner information
                    const matchResult = extractMatchResult(match, validatedParticipants)
                    
                    const processedMatch: ProcessedCustomMatch = {
                        matchId: match.match.id,
                        matchDate: match.match.date,
                        dateKey: match.match.date.split('T')[0], // YYYY-MM-DD
                        map: match.map.name,
                        duration: match.match.duration || undefined,
                        participants: validatedParticipants,
                        matchResult,
                        confidence: 'low', // Will be computed by confidence service
                        confidenceFactors: {
                            hasValidCharacterIds: validatedParticipants.every(
                                (p) => p.characterId > 0
                            ),
                            bothCommunityPlayers: validatedParticipants.every(
                                (p) => p.isCommunityPlayer
                            ),
                            bothActiveRecently: false, // Will be computed
                            hasReasonableDuration: (match.match.duration || 0) > 60,
                            similarSkillLevel: false, // Will be computed
                            recognizedMap: true, // Assume true for now
                        },
                        processedAt: new Date().toISOString(),
                        schemaVersion: '1.0.0',
                    }

                    validatedMatches.push(processedMatch)
                }
            } catch (error) {
                logger.warn(
                    { error, matchId: match.match.id, feature: 'custom-match-discovery' },
                    'Failed to validate match participants'
                )
            }
        }

        return validatedMatches
    }

    /**
     * Validate individual match participants
     */
    private async validateMatchParticipants(
        match: RawCustomMatch
    ): Promise<ValidatedParticipant[]> {
        const validatedParticipants: ValidatedParticipant[] = []

        for (const participantData of match.participants) {
            const participant = participantData.participant

            // Only consider competitive participants (WIN/LOSS, not OBSERVER)
            if (participant.decision !== 'WIN' && participant.decision !== 'LOSS') {
                continue
            }

            // Check if participant has a character ID
            if (!participant.playerCharacterId) {
                continue
            }

            const characterId = String(participant.playerCharacterId)

            // Check if this is a community player
            const isCommunityPlayer = this.communityPlayerIds.has(characterId)
            if (!isCommunityPlayer) {
                continue
            }

            const communityData = this.communityPlayers.get(characterId)

            const validated: ValidatedParticipant = {
                characterId: participant.playerCharacterId,
                battleTag: communityData?.btag || 'Unknown',
                name: communityData?.name || 'Unknown',
                rating: communityData?.rating,
                isCommunityPlayer: true,
            }

            validatedParticipants.push(validated)
        }

        return validatedParticipants
    }

    /**
     * Get community player statistics for monitoring
     */
    getCommunityStats() {
        return {
            totalPlayers: this.communityPlayerIds.size,
            playersWithRating: Array.from(this.communityPlayers.values()).filter(
                (p) => p.rating != null
            ).length,
            lastUpdated: new Date().toISOString(),
        }
    }

    /**
     * Check if a player is in the community dataset
     */
    isCommunityPlayer(characterId: string | number): boolean {
        return this.communityPlayerIds.has(String(characterId))
    }

    /**
     * Fetch matches for a specific player using the character-matches API
     */
    private async fetchPlayerMatches(playerId: string): Promise<RawCustomMatch[]> {
        try {
            const params = {
                characterId: playerId,
                type: 'CUSTOM',
                limit: '50', // Reasonable limit to avoid large responses
            }

            const response = await this.adapter.executeRequest('character-matches', params)

            return response?.result || []
        } catch (error) {
            logger.warn(
                { error, playerId, feature: 'custom-match-discovery' },
                'Failed to fetch character matches'
            )
            return []
        }
    }

    /**
     * Check if a match is a valid custom match within our criteria
     */
    private isValidCustomMatch(matchData: RawCustomMatch, cutoffDate: Date): boolean {
        const match = matchData.match

        // Must be a custom match
        if (match.type !== 'CUSTOM') {
            return false
        }

        // Must be after cutoff date
        const matchDate = new Date(match.date)
        if (matchDate < cutoffDate) {
            return false
        }

        // Must have exactly 2 participants with WIN/LOSS decisions (H2H)
        const competitiveParticipants = matchData.participants.filter(
            (p) => p.participant.decision === 'WIN' || p.participant.decision === 'LOSS'
        )

        if (competitiveParticipants.length !== 2) {
            return false
        }

        // Must have both participants as community players
        const communityParticipants = competitiveParticipants.filter((p) =>
            this.isCommunityPlayer(p.participant.playerCharacterId)
        )

        return communityParticipants.length === 2
    }

    /**
     * Simple delay utility for rate limiting
     */
    private async delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}

// Export singleton instance
export const customMatchDiscoveryService = new CustomMatchDiscoveryService()
