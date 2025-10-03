import { describe, it, expect, beforeEach, vi } from 'vitest'
import cache from '../../utils/cache'

// Mock csv parser to control player IDs
vi.mock('../../utils/csvParser', () => ({
    readCsv: vi.fn(async () => [{ id: '1' }]),
}))

// Prepare axios mock that captures create().get calls.
const hoisted = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('axios', () => {
    const { getMock } = hoisted
    return { default: { create: vi.fn(() => ({ get: getMock })) } }
})

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

// Import after mocks
import * as pulse from '../../services/pulseApi'
const { getMock } = hoisted

describe('pulseApi.getTop', () => {
    beforeEach(() => {
        cache.clear()
        getMock.mockReset()
        getMock.mockImplementation((url: string) => {
            if (url.startsWith('season/list/all')) {
                return Promise.resolve({ data: [{ battlenetId: 'S1' }] })
            }
            if (url.startsWith('group/team')) {
                return Promise.resolve({
                    data: [
                        {
                            members: [
                                {
                                    character: { id: '1' },
                                    raceGames: { PROTOSS: 10 },
                                    zergGamesPlayed: 0,
                                    protossGamesPlayed: 10,
                                    terranGamesPlayed: 0,
                                    randomGamesPlayed: 0,
                                },
                            ],
                            lastPlayed: new Date().toISOString(),
                            league: { type: 'MASTER' },
                            rating: 4200,
                        },
                    ],
                })
            }
            return Promise.resolve({ data: [] })
        })
    })

    it('returns cached data when available', async () => {
        const key = 'snapShot'
        const mock = [{ playerCharacterId: '1', ratingLast: 100 }]
        cache.set(key, mock)

        const result = await pulse.getTop()
        expect(result).toEqual(mock)
        expect(getMock).not.toHaveBeenCalled()
    })

    it('prevents cache stampede by sharing in-flight promise', async () => {
        getMock.mockImplementationOnce((url: string) => {
            if (url.startsWith('season/list/all')) {
                return Promise.resolve({ data: [{ battlenetId: 'S1' }] })
            }
            return sleep(100).then(() => ({
                data: [
                    {
                        members: [
                            {
                                character: { id: '1' },
                                raceGames: { PROTOSS: 10 },
                            },
                        ],
                        lastPlayed: new Date().toISOString(),
                        league: { type: 'MASTER' },
                        rating: 4200,
                    },
                ],
            }))
        })

        const p1 = pulse.getTop()
        const p2 = pulse.getTop()

        const [r1, r2] = await Promise.all([p1, p2])
        expect(r1).toEqual(r2)
        expect(
            getMock.mock.calls.filter(([u]) =>
                (u as string).startsWith('character-teams')
            ).length
        ).toBe(1)
    })

    it('caches results for subsequent calls', async () => {
        const r1 = await pulse.getTop()
        const r2 = await pulse.getTop()
        expect(r1).toEqual(r2)
        const teamCalls = getMock.mock.calls.filter(([u]) =>
            (u as string).startsWith('character-teams')
        ).length
        expect(teamCalls).toBe(1)
    })
})
