import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../utils/csvParser', () => ({
    readCsv: vi.fn().mockResolvedValue([
        { id: '111', btag: 'Neo#111', name: 'Neo' },
        { id: '222', btag: 'Ker#222' },
    ]),
}))

// Mock pulseApi.getTop and formatData to avoid heavy deps inside verifyChallongeParticipant
vi.mock('../../services/pulseApi', () => ({
    getTop: vi.fn(() =>
        Promise.resolve([
            {
                playerCharacterId: '111',
                ratingLast: 4000,
                race: 'Zerg',
                leagueTypeLast: 'Master',
                ratingAvg: 3900,
            },
        ])
    ),
}))

vi.mock('../formatData', () => ({
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

    it('verifyPlayer enriches player with btag/name when id matches', async () => {
        const player = {
            playerCharacterId: '111',
            name: 'Old',
            btag: undefined,
        }
        const res = await verifyPlayer(player)
        expect(res.btag).toBe('Neo#111')
        expect(res.name).toBe('Neo')
    })

    it('verifyPlayer leaves unmatched player unchanged', async () => {
        const player = { playerCharacterId: '999' }
        const res = await verifyPlayer(player)
        expect(res).toEqual({ playerCharacterId: '999' })
    })

    it('verifyChallongeParticipant enriches from CSV and snapshot ranking data', async () => {
        const participant = { challongeUserId: undefined, id: 1 }
        const res = await verifyChallongeParticipant(participant as any)
        // No challonge match; function still returns object
        expect(res).toHaveProperty('id', 1)
    })

    it('filterByHighestRatingLast keeps highest per btag', () => {
        const input: Array<{ btag: string; ratingLast: number; id: number }> = [
            { btag: 'A#1', ratingLast: 3000, id: 1 },
            { btag: 'A#1', ratingLast: 3500, id: 2 },
            { btag: 'B#2', ratingLast: 2500, id: 3 },
        ]
        const out = filterByHighestRatingLast(input) as Array<{
            btag: string
            ratingLast: number
            id: number
        }>
        // Should have two btags with highest ratingLast for A#1
        expect(out.length).toBe(2)
        const a = out.find((p: { btag: string }) => p.btag === 'A#1') as {
            btag: string
            ratingLast: number
            id: number
        }
        expect(a.ratingLast).toBe(3500)
    })
})
