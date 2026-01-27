/**
 * Centralized Community Data Service
 *
 * Single source of truth for community player data loaded from CSV.
 * Provides consistent access patterns and avoids duplicate CSV reads.
 */

import { readCsv } from '../utils/csvParser'
import logger from '../logging/logger'

/**
 * Community player record from CSV
 */
export interface CommunityPlayer {
    /** Pulse character ID (primary key) */
    id: string
    /** Battle tag (e.g., "Player#1234") */
    btag: string
    /** Display name (custom or real name) */
    name?: string
    /** Challonge participant ID for tournament correlation */
    challongeId?: string
}

/**
 * Processed community data with lookup optimizations
 */
export interface CommunityData {
    /** All players as array */
    players: CommunityPlayer[]
    /** Player IDs for quick membership checks */
    playerIds: Set<string>
    /** Battle tag to display name mapping */
    displayNames: Map<string, string>
    /** Character ID to player record mapping */
    playerById: Map<string, CommunityPlayer>
    /** Loading timestamp */
    loadedAt: Date
}

/**
 * Centralized service for community data management
 */
export class CommunityDataService {
    private static instance: CommunityDataService | null = null
    private communityData: CommunityData | null = null
    private loadingPromise: Promise<CommunityData> | null = null

    private constructor() {}

    /**
     * Get singleton instance
     */
    static getInstance(): CommunityDataService {
        if (!CommunityDataService.instance) {
            CommunityDataService.instance = new CommunityDataService()
        }
        return CommunityDataService.instance
    }

    /**
     * Get community data (loads if not cached)
     */
    async getCommunityData(): Promise<CommunityData> {
        // Return cached data if available
        if (this.communityData) {
            return this.communityData
        }

        // Return in-flight promise if already loading
        if (this.loadingPromise) {
            return this.loadingPromise
        }

        // Start loading
        this.loadingPromise = this.loadCommunityData()
        
        try {
            const data = await this.loadingPromise
            this.communityData = data
            return data
        } finally {
            this.loadingPromise = null
        }
    }

    /**
     * Check if a character ID belongs to the community
     */
    async isCommunityPlayer(characterId: string | number): Promise<boolean> {
        const data = await this.getCommunityData()
        return data.playerIds.has(String(characterId))
    }

    /**
     * Get display name for a battle tag
     */
    async getDisplayName(btag: string): Promise<string | null> {
        const data = await this.getCommunityData()
        return data.displayNames.get(btag) || null
    }

    /**
     * Get community player record by character ID
     */
    async getCommunityPlayer(characterId: string | number): Promise<CommunityPlayer | null> {
        const data = await this.getCommunityData()
        return data.playerById.get(String(characterId)) || null
    }

    /**
     * Get all community player IDs
     */
    async getCommunityPlayerIds(): Promise<string[]> {
        const data = await this.getCommunityData()
        return data.players.map(p => p.id)
    }

    /**
     * Get community statistics
     */
    async getCommunityStats() {
        const data = await this.getCommunityData()
        return {
            totalPlayers: data.players.length,
            playersWithNames: data.players.filter(p => p.name).length,
            playersWithChallongeIds: data.players.filter(p => p.challongeId).length,
            loadedAt: data.loadedAt.toISOString(),
        }
    }

    /**
     * Force reload community data (for testing/refresh)
     */
    async reloadCommunityData(): Promise<CommunityData> {
        this.communityData = null
        this.loadingPromise = null
        return this.getCommunityData()
    }

    /**
     * Internal method to load and process CSV data
     */
    private async loadCommunityData(): Promise<CommunityData> {
        try {
            logger.info({ feature: 'community-data-service' }, 'Loading community data from CSV')

            const rawData = (await readCsv()) as unknown as Array<{
                id?: string
                btag?: string
                name?: string
                challongeId?: string
                [key: string]: any // Allow other CSV fields
            }>

            // Handle empty or invalid CSV data
            if (!Array.isArray(rawData) || rawData.length === 0) {
                logger.warn(
                    { feature: 'community-data-service' },
                    'CSV data is empty or invalid, returning empty community data'
                )
                return this.createEmptyCommunityData()
            }

            const players: CommunityPlayer[] = []
            const playerIds = new Set<string>()
            const displayNames = new Map<string, string>()
            const playerById = new Map<string, CommunityPlayer>()

            // Process each CSV row
            for (const row of rawData) {
                // Skip null/undefined rows and rows without required fields
                if (!row || !row.id || !row.btag) {
                    logger.warn(
                        { feature: 'community-data-service', row },
                        'Skipping CSV row with missing id or btag'
                    )
                    continue
                }

                const player: CommunityPlayer = {
                    id: String(row.id),
                    btag: row.btag,
                    name: row.name,
                    challongeId: row.challongeId,
                }

                players.push(player)
                playerIds.add(player.id)
                playerById.set(player.id, player)

                // Build display name lookup if custom name exists
                if (player.name && player.btag) {
                    displayNames.set(player.btag, player.name)
                }
            }

            // Validate we have at least some valid data
            if (players.length === 0) {
                logger.warn(
                    { feature: 'community-data-service' },
                    'No valid players found in CSV, returning empty community data'
                )
                return this.createEmptyCommunityData()
            }

            const communityData: CommunityData = {
                players,
                playerIds,
                displayNames,
                playerById,
                loadedAt: new Date(),
            }

            logger.info(
                {
                    feature: 'community-data-service',
                    playerCount: players.length,
                    displayNameCount: displayNames.size,
                },
                'Community data loaded successfully'
            )

            return communityData
        } catch (error) {
            logger.error(
                { error, feature: 'community-data-service' },
                'Failed to load community data, returning empty fallback'
            )
            
            // Return empty data instead of throwing to allow system to continue
            return this.createEmptyCommunityData()
        }
    }

    /**
     * Create empty community data for fallback scenarios
     */
    private createEmptyCommunityData(): CommunityData {
        return {
            players: [],
            playerIds: new Set(),
            displayNames: new Map(),
            playerById: new Map(),
            loadedAt: new Date(),
        }
    }
}

// Export singleton instance
export const communityDataService = CommunityDataService.getInstance()