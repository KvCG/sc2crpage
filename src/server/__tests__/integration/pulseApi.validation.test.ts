import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all external dependencies to focus on interface validation
vi.mock('../../adapters/pulseAdapter', () => ({
    pulseAdapter: {
        getCurrentSeason: vi.fn().mockResolvedValue([{ battlenetId: 'test' }]),
        getRankingData: vi.fn().mockResolvedValue([]),
        searchPlayer: vi.fn().mockResolvedValue({}),
    },
}))

vi.mock('../../utils/csvDisplayNames', () => ({
    getDisplayName: vi.fn().mockReturnValue('TestPlayer'),
}))

describe('PulseApi Interface Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getTop() return interface validation', () => {
        it('should return RankedPlayer objects with correct property structure', async () => {
            // Mock pulseService to return a realistic RankedPlayer structure
            vi.doMock('../../services/pulseService', () => ({
                pulseService: {
                    getRanking: vi.fn().mockResolvedValue([
                        {
                            btag: 'TestPlayer#1234',
                            name: 'TestPlayer',
                            discriminator: 1234,
                            id: 12345,
                            rating: 3000,
                            wins: 15,
                            losses: 5,
                            ties: 0,
                            leagueType: 6,
                            globalRank: 1,
                            regionRank: 1,
                            leagueRank: 1,
                            lastPlayed: '2024-01-15T10:00:00Z',
                            online: true,
                            mainRace: 'TERRAN',
                            totalGames: 20,
                            gamesPerRace: { TERRAN: 20 },
                            lastDatePlayed: '10:00 AM',
                        }
                    ])
                }
            }))

            const pulseApi = await import('../../services/pulseApi')
            const result = await pulseApi.getTop()

            expect(result).toHaveLength(1)
            const player = result[0]
            
            // Validate actual RankedPlayer interface properties exist
            expect(player).toHaveProperty('btag')
            expect(player).toHaveProperty('name')
            expect(player).toHaveProperty('rating')
            expect(player).toHaveProperty('mainRace') // NOT 'race'
            expect(player).toHaveProperty('leagueType') // NOT 'leagueTypeLast'
            expect(player).toHaveProperty('lastDatePlayed')
            expect(player).toHaveProperty('online')
            
            // Validate expected values
            expect(player.btag).toBe('TestPlayer#1234')
            expect(player.mainRace).toBe('TERRAN')
            expect(player.online).toBe(true)
            expect(player.lastDatePlayed).toBe('10:00 AM')

            // Validate legacy properties DO NOT exist (these are obsolete)
            expect(player).not.toHaveProperty('race')
            expect(player).not.toHaveProperty('ratingLast')
            expect(player).not.toHaveProperty('leagueTypeLast')
        })

        it('should handle empty result gracefully', async () => {
            // Reset modules and remock for isolation
            vi.resetModules()
            
            vi.doMock('../../services/pulseService', () => ({
                pulseService: {
                    getRanking: vi.fn().mockResolvedValue([])
                }
            }))

            const pulseApi = await import('../../services/pulseApi')
            const result = await pulseApi.getTop()

            expect(result).toEqual([])
        })
    })

    describe('Legacy property mismatch documentation', () => {
        it('should document the property name changes between legacy and current interface', () => {
            const legacyExpectations = [
                'race',          // Now: mainRace
                'ratingLast',    // Now: rating (can be array or number)
                'leagueTypeLast' // Now: leagueType (can be array or number)
            ]
            
            const currentInterface = [
                'mainRace',
                'rating', 
                'leagueType'
            ]

            // This test documents the interface changes for future reference
            expect(legacyExpectations).not.toEqual(currentInterface)
            expect(currentInterface).toContain('mainRace')
            expect(currentInterface).not.toContain('race')
        })
    })
})
