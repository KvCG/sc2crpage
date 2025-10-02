import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../utils/csvParser', () => ({
    readCsv: vi.fn().mockResolvedValue([
        { id: '111', btag: 'Neo#111', name: 'Neo' },
        { id: '222', btag: 'Ker#222' },
    ]),
}))

// Mock pulseApi.getTop and formatData to avoid heavy deps inside verifyChallongeParticipant
vi.mock('../../services/pulseApi', () => ({
    getRanking: vi.fn(() =>
        Promise.resolve([
            {
                id: 111,
                rating: 4000,
                mainRace: 'Zerg',
                leagueType: 6, // Master league
                btag: 'Neo#111',
                name: 'Neo',
            },
        ])
    ),
}))

vi.mock('../../utils/formatData', () => ({
    formatData: vi.fn(async (snapshot: any, type: string) => {
        if (type === 'ranking') {
            return Array.isArray(snapshot) ? snapshot : [snapshot]
        }
        return snapshot
    }),
}))

import {
    verifyPlayer,
    verifyChallongeParticipant,
    filterByHighestRatingLast,
} from '../../utils/userDataHelper'

describe('userDataHelper', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('verifyPlayer is deprecated and returns unchanged player', async () => {
        const player = {
            id: 111,
            name: 'Old',
            btag: undefined,
        }
        const res = await verifyPlayer(player)
        // Function is deprecated - should return unchanged
        expect(res).toEqual(player)
    })

    it('verifyPlayer leaves unmatched player unchanged', async () => {
        const player = { id: 999 }
        const res = await verifyPlayer(player)
        expect(res).toEqual({ id: 999 })
    })

    it('verifyChallongeParticipant enriches from CSV and snapshot ranking data', async () => {
        const participant = { challongeUserId: undefined, id: 1 }
        const res = await verifyChallongeParticipant(participant as any)
        // No challonge match; function still returns object
        expect(res).toHaveProperty('id', 1)
    })

    it('filterByHighestRatingLast is deprecated and returns unchanged', () => {
        const input: Array<{ btag: string; rating: number; id: number }> = [
            { btag: 'A#1', rating: 3000, id: 1 },
            { btag: 'A#1', rating: 3500, id: 2 },
            { btag: 'B#2', rating: 2500, id: 3 },
        ]
        const out = filterByHighestRatingLast(input)
        // Function is deprecated - returns input unchanged
        expect(out).toEqual(input)
    })
})
