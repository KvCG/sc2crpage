import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies first
const hoisted = vi.hoisted(() => ({
    getMock: vi.fn(),
    readCsvMock: vi.fn(),
    cacheMock: {
        get: vi.fn(),
        set: vi.fn(),
        clear: vi.fn(),
    },
}))

vi.mock('../../utils/csvParser', () => ({
    readCsv: hoisted.readCsvMock,
}))

vi.mock('../../utils/cache', () => ({
    default: hoisted.cacheMock,
}))

vi.mock('../../../shared/runtimeEnv', () => ({
    isTest: () => true,
}))

vi.mock('../../services/pulseHttpClient', () => ({
    get: hoisted.getMock,
    withBasePath: vi.fn((path: string) => path),
    endpoints: {
        searchCharacter: 'character/search',
        listSeasons: 'season/list/all',
        groupTeam: 'group/team',
    },
}))

describe('pulseApi core functions', () => {
    beforeEach(() => {
        vi.resetModules()
        hoisted.getMock.mockReset()
        hoisted.readCsvMock.mockReset()
        hoisted.cacheMock.get.mockReset()
        hoisted.cacheMock.set.mockReset()
        hoisted.cacheMock.clear.mockReset()
    })

    describe('searchPlayer', () => {
        it('handles empty search term', async () => {
            const { searchPlayer } = await import('../../services/pulseApi')
            
            hoisted.getMock.mockResolvedValueOnce([])
            
            const result = await searchPlayer('')
            
            expect(hoisted.getMock).toHaveBeenCalledWith(
                'character/search',
                { term: '' }
            )
            expect(result).toEqual([])
        })

        it('properly encodes search terms with special characters', async () => {
            const { searchPlayer } = await import('../../services/pulseApi')
            
            hoisted.getMock.mockResolvedValueOnce([])
            
            await searchPlayer('Player#1234')
            
            expect(hoisted.getMock).toHaveBeenCalledWith(
                'character/search',
                { term: 'Player%231234' }
            )
        })

        it('handles API errors gracefully', async () => {
            const { searchPlayer } = await import('../../services/pulseApi')
            
            hoisted.getMock.mockRejectedValueOnce(new Error('API Error'))
            
            const result = await searchPlayer('TestPlayer')
            
            // Currently returns undefined on error - this is existing behavior
            expect(result).toBeUndefined()
        })
    })

    describe('getPlayersStats', () => {
        beforeEach(async () => {
            // Reset modules to get fresh import
            vi.resetModules()
        })

        it('handles empty CSV data gracefully', async () => {
            hoisted.readCsvMock.mockResolvedValueOnce([])
            hoisted.getMock.mockImplementation((url: string) => {
                if (url.startsWith('season/list/all')) {
                    return Promise.resolve([{ battlenetId: 'S1' }])
                }
                return Promise.resolve([])
            })
            
            const pulse = await import('../../services/pulseApi')
            const result = await pulse.getTop()
            
            expect(result).toEqual([])
        })

        it('handles large datasets with multiple API calls', async () => {
            // Create test data with many players to trigger chunking
            const manyPlayers = Array.from({ length: 150 }, (_, i) => ({ id: `${i}` }))
            hoisted.readCsvMock.mockResolvedValueOnce(manyPlayers)
            
            hoisted.getMock.mockImplementation((url: string) => {
                if (url.startsWith('season/list/all')) {
                    return Promise.resolve([{ battlenetId: 'S1' }])
                }
                if (url.startsWith('group/team')) {
                    return Promise.resolve([])
                }
                return Promise.resolve([])
            })
            
            const pulse = await import('../../services/pulseApi')
            await pulse.getTop()
            
            // Should make multiple requests due to chunking
            const teamCalls = hoisted.getMock.mock.calls.filter(([url]) =>
                (url as string).startsWith('group/team')
            )
            expect(teamCalls.length).toBeGreaterThan(1)
        })
    })

    describe('race extraction integration', () => {
        it('correctly identifies PROTOSS from raceGames', async () => {
            hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
            hoisted.getMock.mockImplementation((url: string) => {
                if (url.startsWith('season/list/all')) {
                    return Promise.resolve([{ battlenetId: 'S1' }])
                }
                if (url.startsWith('group/team')) {
                    return Promise.resolve([{
                        members: [{
                            character: { id: '1' },
                            raceGames: { PROTOSS: 10, ZERG: 5 }
                        }],
                        rating: 3500,
                        league: { type: 'MASTER' }
                    }])
                }
                return Promise.resolve([])
            })
            
            const pulse = await import('../../services/pulseApi')
            const [player] = await pulse.getTop()
            
            expect(player.race).toBe('PROTOSS')
        })

        it('correctly identifies RANDOM race from legacy fields', async () => {
            hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
            hoisted.getMock.mockImplementation((url: string) => {
                if (url.startsWith('season/list/all')) {
                    return Promise.resolve([{ battlenetId: 'S1' }])
                }
                if (url.startsWith('group/team')) {
                    return Promise.resolve([{
                        members: [{
                            character: { id: '1' },
                            randomGamesPlayed: 25,
                            zergGamesPlayed: 0,
                            protossGamesPlayed: 0,
                            terranGamesPlayed: 0
                        }],
                        rating: 3200,
                        league: { type: 'PLATINUM' }
                    }])
                }
                return Promise.resolve([])
            })
            
            const pulse = await import('../../services/pulseApi')
            const [player] = await pulse.getTop()
            
            expect(player.race).toBe('RANDOM')
        })

        it('handles missing race data gracefully', async () => {
            hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
            hoisted.getMock.mockImplementation((url: string) => {
                if (url.startsWith('season/list/all')) {
                    return Promise.resolve([{ battlenetId: 'S1' }])
                }
                if (url.startsWith('group/team')) {
                    return Promise.resolve([{
                        members: [{
                            character: { id: '1' },
                            // No race information
                        }],
                        rating: 2800,
                        league: { type: 'GOLD' }
                    }])
                }
                return Promise.resolve([])
            })
            
            const pulse = await import('../../services/pulseApi')
            const [player] = await pulse.getTop()
            
            expect(player.race).toBe(null)
        })
    })

    describe('online status detection', () => {
        it('marks recent players as online', async () => {
            const recentDate = new Date()
            recentDate.setMinutes(recentDate.getMinutes() - 5) // 5 minutes ago
            
            hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
            hoisted.getMock.mockImplementation((url: string) => {
                if (url.startsWith('season/list/all')) {
                    return Promise.resolve([{ battlenetId: 'S1' }])
                }
                if (url.startsWith('group/team')) {
                    return Promise.resolve([{
                        members: [{ character: { id: '1' } }],
                        lastPlayed: recentDate.toISOString(),
                        rating: 3500,
                        league: { type: 'MASTER' }
                    }])
                }
                return Promise.resolve([])
            })
            
            const pulse = await import('../../services/pulseApi')
            const [player] = await pulse.getTop()
            
            expect(player.online).toBe(true)
        })

        it('marks old players as offline', async () => {
            const oldDate = new Date()
            oldDate.setHours(oldDate.getHours() - 25) // 25 hours ago
            
            hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
            hoisted.getMock.mockImplementation((url: string) => {
                if (url.startsWith('season/list/all')) {
                    return Promise.resolve([{ battlenetId: 'S1' }])
                }
                if (url.startsWith('group/team')) {
                    return Promise.resolve([{
                        members: [{ character: { id: '1' } }],
                        lastPlayed: oldDate.toISOString(),
                        rating: 2800,
                        league: { type: 'GOLD' }
                    }])
                }
                return Promise.resolve([])
            })
            
            const pulse = await import('../../services/pulseApi')
            const [player] = await pulse.getTop()
            
            expect(player.online).toBe(false)
        })
    })

    describe('game counting and rating selection', () => {
        it('correctly aggregates game counts across multiple teams', async () => {
            hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
            hoisted.getMock.mockImplementation((url: string) => {
                if (url.startsWith('season/list/all')) {
                    return Promise.resolve([{ battlenetId: 'S1' }])
                }
                if (url.startsWith('group/team')) {
                    return Promise.resolve([
                        {
                            members: [{
                                character: { id: '1' }
                            }],
                            wins: 10,
                            losses: 5,
                            ties: 1,
                            rating: 2500,
                            league: { type: 'PLATINUM' }
                        },
                        {
                            members: [{
                                character: { id: '1' }
                            }],
                            wins: 8,
                            losses: 3,
                            ties: 0,
                            rating: 3200,
                            league: { type: 'MASTER' }
                        }
                    ])
                }
                return Promise.resolve([])
            })
            
            const pulse = await import('../../services/pulseApi')
            const [player] = await pulse.getTop()
            
            expect(player.gamesThisSeason).toBe(27) // 10+5+1+8+3+0
            expect(player.ratingLast).toBe(3200) // Highest rating team
            expect(player.leagueTypeLast).toBe('MASTER')
        })

        it('handles empty or malformed team data', async () => {
            hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
            hoisted.getMock.mockImplementation((url: string) => {
                if (url.startsWith('season/list/all')) {
                    return Promise.resolve([{ battlenetId: 'S1' }])
                }
                if (url.startsWith('group/team')) {
                    return Promise.resolve([
                        { members: [{}], rating: null }, // Missing data
                        { members: null, rating: 2500 }, // Null members
                        {} // Empty object
                    ])
                }
                return Promise.resolve([])
            })
            
            const pulse = await import('../../services/pulseApi')
            
            // The function handles the error by retrying and eventually returning empty array
            const result = await pulse.getTop()
            expect(result).toEqual([])
        })
    })
})