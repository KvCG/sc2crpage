import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
    mockSyncPair: vi.fn(),
    mockGetCommunityData: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../../services/h2hService', () => ({
    syncPair: hoisted.mockSyncPair,
    H2HResolutionError: class H2HResolutionError extends Error {
        readonly characterId: number
        constructor(characterId: number) {
            super(`No 1v1 team found for characterId ${characterId}`)
            this.name = 'H2HResolutionError'
            this.characterId = characterId
        }
    },
}))

vi.mock('../../../services/communityDataService', () => ({
    CommunityDataService: {
        getInstance: () => ({
            getCommunityData: hoisted.mockGetCommunityData,
        }),
    },
}))

vi.mock('../../../logging/logger', () => ({ default: hoisted.mockLogger }))

import { runFullSync } from '../../../services/h2hScheduler'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FOUR_PLAYERS = [
    { id: '100', btag: 'Alpha#1', name: 'Alpha' },
    { id: '200', btag: 'Beta#2',  name: 'Beta' },
    { id: '300', btag: 'Gamma#3', name: 'Gamma' },
    { id: '400', btag: 'Delta#4', name: 'Delta' },
]

const makeCommunityData = (players: typeof FOUR_PLAYERS) => ({
    players,
    playerIds: new Set(players.map((p) => p.id)),
    displayNames: new Map(players.map((p) => [p.btag, p.name ?? p.btag])),
    playerById: new Map(players.map((p) => [p.id, p])),
    loadedAt: new Date(),
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runFullSync', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hoisted.mockGetCommunityData.mockResolvedValue(makeCommunityData(FOUR_PLAYERS))
        hoisted.mockSyncPair.mockResolvedValue(undefined)
    })

    it('calls syncPair exactly n*(n-1)/2 times for n players', async () => {
        await runFullSync()

        // 4 players → 4*3/2 = 6 pairs
        expect(hoisted.mockSyncPair).toHaveBeenCalledTimes(6)
    })

    it('calls syncPair with every unique unordered pair exactly once', async () => {
        await runFullSync()

        const calls = hoisted.mockSyncPair.mock.calls.map(([a, b]: [number, number]) =>
            [Math.min(a, b), Math.max(a, b)].join('-')
        )
        // All 6 pairs from players [100,200,300,400]
        expect(calls).toContain('100-200')
        expect(calls).toContain('100-300')
        expect(calls).toContain('100-400')
        expect(calls).toContain('200-300')
        expect(calls).toContain('200-400')
        expect(calls).toContain('300-400')
        // No duplicates
        expect(new Set(calls).size).toBe(6)
    })

    it('continues after a single pair failure and calls syncPair 6 times total', async () => {
        // Fail on the second pair call
        hoisted.mockSyncPair
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('Simulated sync failure'))
            .mockResolvedValue(undefined)

        await expect(runFullSync()).resolves.toBeUndefined()

        expect(hoisted.mockSyncPair).toHaveBeenCalledTimes(6)
        expect(hoisted.mockLogger.error).toHaveBeenCalledOnce()
    })

    it('logs run start and end with totalPairs and failures count', async () => {
        await runFullSync()

        expect(hoisted.mockLogger.info).toHaveBeenCalledWith(
            { feature: 'h2h', totalPairs: 6 },
            'H2H full sync started'
        )
        expect(hoisted.mockLogger.info).toHaveBeenCalledWith(
            { feature: 'h2h', totalPairs: 6, failures: 0 },
            'H2H full sync complete'
        )
    })
})
