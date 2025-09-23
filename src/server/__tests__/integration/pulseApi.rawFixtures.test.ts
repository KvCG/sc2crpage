import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadJsonFixture } from '../../../test/fixtures/loadJson'

const hoisted = vi.hoisted(() => ({ getMock: vi.fn(), readCsvMock: vi.fn() }))

vi.mock('../../utils/csvParser', () => ({
    readCsv: (...a: any[]) => hoisted.readCsvMock(...a),
}))

vi.mock('axios', () => ({
    default: { create: vi.fn(() => ({ get: hoisted.getMock })) },
}))

describe('pulseApi with raw JSON fixtures', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        vi.resetModules()
        hoisted.getMock.mockReset()
        hoisted.readCsvMock.mockReset()
        const cache = (await import('../../utils/cache')).default
        cache.clear()
    })

    it('handles array group/team response', async () => {
        const seasons = loadJsonFixture<any[]>('pulse/raw/seasons.json')
        const groupTeam = loadJsonFixture<any[]>(
            'pulse/raw/groupTeam.array.json'
        )
        hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
        hoisted.getMock.mockImplementation((url: string) => {
            if (url.startsWith('season/list/all'))
                return Promise.resolve({ data: seasons })
            if (url.startsWith('group/team'))
                return Promise.resolve({ data: groupTeam })
            return Promise.resolve({ data: [] })
        })
        const pulse = await import('../../services/pulseApi')
        const [player] = await pulse.getTop()
        expect(player.playerCharacterId).toBe('1')
        expect(player.ratingLast).toBe(3000)
        expect(player.leagueTypeLast).toBe('MASTER')
    })

    it('handles single object group/team response', async () => {
        const seasons = loadJsonFixture<any[]>('pulse/raw/seasons.json')
        const groupTeamSingle = loadJsonFixture<any>(
            'pulse/raw/groupTeam.single.json'
        )
        hoisted.readCsvMock.mockResolvedValueOnce([{ id: '1' }])
        hoisted.getMock.mockImplementation((url: string) => {
            if (url.startsWith('season/list/all'))
                return Promise.resolve({ data: seasons })
            if (url.startsWith('group/team'))
                return Promise.resolve({ data: groupTeamSingle })
            return Promise.resolve({ data: [] })
        })
        const pulse = await import('../../services/pulseApi')
        const [player] = await pulse.getTop()
        expect(player.playerCharacterId).toBe('1')
        expect(player.ratingLast).toBe(2500)
        expect(player.leagueTypeLast).toBe('DIAMOND')
    })
})
