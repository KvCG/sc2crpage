import { describe, it, expect, beforeEach, vi } from 'vitest'

// Hoisted state for mocks
const hoisted = vi.hoisted(() => ({
    getMock: vi.fn(),
    readCsvMock: vi.fn(),
    // Luxon-now controls
    daysDiff: 0,
    minutesDiff: 0,
    timeFmt: '7:33 AM',
    // Control toCostaRicaTime behavior
    toCostaRicaShouldThrowOnArg: false,
}))

// Mock csv parser
vi.mock('../../utils/csvParser', () => ({
    readCsv: (...args: any[]) => hoisted.readCsvMock(...args),
}))

// Mock axios
vi.mock('axios', () => {
    const { getMock } = hoisted
    return { default: { create: vi.fn(() => ({ get: getMock })) } }
})

// Mock luxon DateTime to control diffs
vi.mock('luxon', () => ({
    DateTime: {
        now: vi.fn(() => ({
            setZone: vi.fn(() => ({
                startOf: vi.fn(() => ({
                    diff: vi.fn((_other: any, unit: 'days' | 'minutes') =>
                        unit === 'days'
                            ? { days: hoisted.daysDiff }
                            : { minutes: hoisted.minutesDiff }
                    ),
                })),
                diff: vi.fn((_other: any, unit: 'days' | 'minutes') =>
                    unit === 'days'
                        ? { days: hoisted.daysDiff }
                        : { minutes: hoisted.minutesDiff }
                ),
            })),
        })),
    },
}))

// Mock toCostaRicaTime to return a DateTime-like object or throw
vi.mock('../../utils/pulseApiHelper', () => ({
    toCostaRicaTime: vi.fn((arg: any) => {
        if (
            hoisted.toCostaRicaShouldThrowOnArg &&
            (arg === undefined || arg === null)
        ) {
            throw new Error('Invalid date')
        }
        return {
            startOf: vi.fn(() => ({
                // paired with luxon mock's now.diff
            })),
            toFormat: vi.fn(() => hoisted.timeFmt),
        }
    }),
}))

// Import after mocks
const { getMock, readCsvMock } = hoisted

const seasonOK = () => {
    getMock.mockImplementation((url: string) => {
        if (url.startsWith('season/list/all')) {
            return Promise.resolve({ data: [{ battlenetId: 'S1' }] })
        }
        if (url.startsWith('group/team')) {
            return Promise.resolve({ data: [] })
        }
        return Promise.resolve({ data: [] })
    })
}

describe('pulseApi branches', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        vi.resetModules()
        // reset mock implementations and calls
        hoisted.readCsvMock.mockReset()
        hoisted.getMock.mockReset()
        hoisted.daysDiff = 0
        hoisted.minutesDiff = 0
        hoisted.timeFmt = '7:33 AM'
        hoisted.toCostaRicaShouldThrowOnArg = false
        const cache = (await import('../../utils/cache')).default
        cache.clear()
    })

    it('returns [] when getPlayersIds errors (no retry behavior in current impl)', async () => {
        readCsvMock.mockImplementation(() => {
            throw new Error('fail')
        })
        seasonOK()
        const pulse = await import('../../services/pulseApi')
        const res = await pulse.getTop(0, 3)
        expect(res).toEqual([])
        expect(readCsvMock).toHaveBeenCalledTimes(1)
    })

    // getPlayersIds returns []

    it('handles empty players list (no ids) early', async () => {
        readCsvMock.mockResolvedValueOnce([])
        seasonOK()
        const pulse = await import('../../services/pulseApi')
        const res = await pulse.getTop()
        expect(res).toEqual([])
        // Should not call group/team
        const teamCalls = getMock.mock.calls.filter(([u]) =>
            (u as string).startsWith('group/team')
        ).length
        expect(teamCalls).toBe(0)
    })

    it('lastDatePlayed returns time when same day and online true when <=30m', async () => {
        readCsvMock.mockResolvedValueOnce([{ id: '1' }])
        hoisted.daysDiff = 0
        hoisted.minutesDiff = 20 // online
        getMock.mockImplementation((url: string) => {
            if (url.startsWith('season/list/all'))
                return Promise.resolve({ data: [{ battlenetId: 'S1' }] })
            if (url.startsWith('group/team'))
                return Promise.resolve({
                    data: [
                        {
                            members: [
                                {
                                    character: { id: '1' },
                                    raceGames: { PROTOSS: 10 },
                                    protossGamesPlayed: 10,
                                },
                            ],
                            lastPlayed: '2024-01-01T12:00:00Z',
                            league: { type: 'MASTER' },
                            rating: 3000,
                        },
                    ],
                })
            return Promise.resolve({ data: [] })
        })
        const pulse = await import('../../services/pulseApi')
        const [player] = await pulse.getTop()
        expect(player.lastDatePlayed).toBe('7:33 AM')
        expect(player.online).toBe(true)
    })

    it('lastDatePlayed returns "-" when invalid/missing and online false when >30m', async () => {
        readCsvMock.mockResolvedValueOnce([{ id: '1' }])
        hoisted.daysDiff = 2
        hoisted.minutesDiff = 45
        hoisted.toCostaRicaShouldThrowOnArg = true
        getMock.mockImplementation((url: string) => {
            if (url.startsWith('season/list/all'))
                return Promise.resolve({ data: [{ battlenetId: 'S1' }] })
            if (url.startsWith('group/team'))
                return Promise.resolve({
                    data: [
                        {
                            members: [
                                {
                                    character: { id: '1' },
                                    protossGamesPlayed: 0,
                                    terranGamesPlayed: 0,
                                    zergGamesPlayed: 0,
                                    randomGamesPlayed: 0,
                                },
                            ],
                            lastPlayed: undefined as any,
                            league: { type: 'PLATINUM' },
                            rating: 1500,
                        },
                    ],
                })
            return Promise.resolve({ data: [] })
        })
        const pulse = await import('../../services/pulseApi')
        const [player] = await pulse.getTop()
        expect(player.lastDatePlayed).toBe('-')
        expect(player.online).toBe(false)
    })

    it('extracts race from various member fields and highest rating team', async () => {
        readCsvMock.mockResolvedValueOnce([{ id: '1' }])
        getMock.mockImplementation((url: string) => {
            if (url.startsWith('season/list/all'))
                return Promise.resolve({ data: [{ battlenetId: 'S1' }] })
            if (url.startsWith('group/team'))
                return Promise.resolve({
                    data: [
                        // lower rating with raceGames PROTOSS
                        {
                            members: [
                                {
                                    character: { id: '1' },
                                    raceGames: { PROTOSS: 10 },
                                },
                            ],
                            lastPlayed: '2024',
                            league: { type: 'DIAMOND' },
                            rating: 2100,
                        },
                        // highest rating indicates TERRAN by numeric fields
                        {
                            members: [
                                {
                                    character: { id: '1' },
                                    terranGamesPlayed: 5,
                                    protossGamesPlayed: 0,
                                    zergGamesPlayed: 0,
                                    randomGamesPlayed: 0,
                                },
                            ],
                            lastPlayed: '2024',
                            league: { type: 'MASTER' },
                            rating: 3200,
                        },
                    ],
                })
            return Promise.resolve({ data: [] })
        })
        const pulse = await import('../../services/pulseApi')
        const [player] = await pulse.getTop()
        expect(player.race).toBe('TERRAN')
        expect(player.ratingLast).toBe(3200)
        expect(player.leagueTypeLast).toBe('MASTER')
    })
})
