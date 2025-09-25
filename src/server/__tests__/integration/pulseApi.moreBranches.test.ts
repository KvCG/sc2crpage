import { describe, it, expect, beforeEach, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({ getMock: vi.fn(), readCsvMock: vi.fn() }))

vi.mock('../../utils/csvParser', () => ({
    readCsv: (...a: any[]) => hoisted.readCsvMock(...a),
}))
vi.mock('axios', () => ({
    default: { create: vi.fn(() => ({ get: hoisted.getMock })) },
}))

describe('pulseApi additional branches', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        vi.resetModules()
        hoisted.getMock.mockReset()
        hoisted.readCsvMock.mockReset()
        const cache = (await import('../../utils/cache')).default
        cache.clear()
    })

    it('handles empty seasons list safely', async () => {
        hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
        const groupTeam = [
            {
                members: [{ character: { id: '1' }, protossGamesPlayed: 2 }],
                lastPlayed: '2024-01-01T00:00:00Z',
                league: { type: 'MASTER' },
                rating: 3100,
            },
        ]
        hoisted.getMock.mockImplementation((url: string) => {
            if (url.startsWith('season/list/all'))
                return Promise.resolve({ data: [] })
            if (url.startsWith('group/team'))
                return Promise.resolve({ data: groupTeam })
            return Promise.resolve({ data: [] })
        })
        const pulse = await import('../../services/pulseApi')
        const top = await pulse.getTop()
        expect(top[0].playerCharacterId).toBe('1')
        expect(top[0].ratingLast).toBe(3100)
        expect(hoisted.getMock).toHaveBeenCalledWith(
            expect.stringContaining('group/team?season=undefined'),
            expect.any(Object)
        )
    })

    it('extracts RANDOM race when randomGamesPlayed > 0', async () => {
        hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
        const groupTeam = [
            {
                members: [{ character: { id: '1' }, randomGamesPlayed: 5 }],
                lastPlayed: '2024-01-01T00:00:00Z',
                league: { type: 'GOLD' },
                rating: 1200,
            },
        ]
        hoisted.getMock.mockImplementation((url: string) => {
            if (url.startsWith('season/list/all'))
                return Promise.resolve({ data: [{ battlenetId: 'S1' }] })
            if (url.startsWith('group/team'))
                return Promise.resolve({ data: groupTeam })
            return Promise.resolve({ data: [] })
        })
        const pulse = await import('../../services/pulseApi')
        const [player] = await pulse.getTop()
        expect(player.race).toBe('RANDOM')
    })

    it('aggregates games per race using raceGames fallback across members', async () => {
        hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
        const groupTeam = [
            {
                members: [
                    {
                        character: { id: '1' },
                        raceGames: {
                            ZERG: 3,
                            PROTOSS: 0,
                            TERRAN: 1,
                            RANDOM: 2,
                        },
                    },
                    {
                        character: { id: '1' },
                        raceGames: {
                            ZERG: 2,
                            PROTOSS: 4,
                            TERRAN: 0,
                            RANDOM: 0,
                        },
                    },
                ],
                lastPlayed: '2024-01-01T00:00:00Z',
                league: { type: 'PLATINUM' },
                rating: 1800,
            },
        ]
        hoisted.getMock.mockImplementation((url: string) => {
            if (url.startsWith('season/list/all'))
                return Promise.resolve({ data: [{ battlenetId: 'S1' }] })
            if (url.startsWith('group/team'))
                return Promise.resolve({ data: groupTeam })
            return Promise.resolve({ data: [] })
        })
        const pulse = await import('../../services/pulseApi')
        const [player] = await pulse.getTop()
        expect(player.gamesPerRace).toEqual({
            zergGamesPlayed: 5,
            protossGamesPlayed: 4,
            terranGamesPlayed: 1,
            randomGamesPlayed: 2,
        })
    })
})
