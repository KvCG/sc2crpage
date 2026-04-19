import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
    mockAxiosGet: vi.fn(),
    mockGetAccessToken: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('axios', () => ({ default: { get: hoisted.mockAxiosGet } }))
vi.mock('../../../services/blizzardAuthClient', () => ({
    getAccessToken: hoisted.mockGetAccessToken,
}))
vi.mock('../../../logging/logger', () => ({ default: hoisted.mockLogger }))

import { fetchPlayerMatches, regionToId, type BlizzardProfile } from '../../../services/blizzardMatchClient'

const US_PROFILE: BlizzardProfile = {
    profileId: 883917,
    realmId: 1,
    regionId: 1,
    region: 'US',
}

const EU_PROFILE: BlizzardProfile = {
    profileId: 123456,
    realmId: 1,
    regionId: 2,
    region: 'EU',
}

const SAMPLE_MATCHES = [
    { map: 'Ruby Rock LE', type: 'Custom', decision: 'Win', speed: 'Faster', date: 1712964000 },
    { map: 'Site Delta LE', type: '1v1', decision: 'Loss', speed: 'Faster', date: 1712950000 },
]

describe('regionToId', () => {
    it('maps US to 1', () => expect(regionToId('US')).toBe(1))
    it('maps EU to 2', () => expect(regionToId('EU')).toBe(2))
    it('maps KR to 3', () => expect(regionToId('KR')).toBe(3))
    it('maps CN to 5', () => expect(regionToId('CN')).toBe(5))
    it('is case-insensitive', () => expect(regionToId('eu')).toBe(2))
    it('throws for unknown regions', () => expect(() => regionToId('XX')).toThrow('Unknown Blizzard region'))
})

describe('fetchPlayerMatches', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hoisted.mockGetAccessToken.mockResolvedValue('test-token')
    })

    it('calls the correct US Blizzard endpoint', async () => {
        hoisted.mockAxiosGet.mockResolvedValue({ data: { matches: SAMPLE_MATCHES } })

        await fetchPlayerMatches(US_PROFILE)

        const [url, config] = hoisted.mockAxiosGet.mock.calls[0]
        expect(url).toBe(
            'https://us.api.blizzard.com/sc2/legacy/profile/1/1/883917/matches'
        )
        expect(config.headers.Authorization).toBe('Bearer test-token')
    })

    it('calls the correct EU Blizzard endpoint', async () => {
        hoisted.mockAxiosGet.mockResolvedValue({ data: { matches: [] } })

        await fetchPlayerMatches(EU_PROFILE)

        const [url] = hoisted.mockAxiosGet.mock.calls[0]
        expect(url).toBe(
            'https://eu.api.blizzard.com/sc2/legacy/profile/2/1/123456/matches'
        )
    })

    it('returns the matches array from the response', async () => {
        hoisted.mockAxiosGet.mockResolvedValue({ data: { matches: SAMPLE_MATCHES } })

        const result = await fetchPlayerMatches(US_PROFILE)

        expect(result).toHaveLength(2)
        expect(result[0].map).toBe('Ruby Rock LE')
        expect(result[0].type).toBe('Custom')
    })

    it('returns an empty array when the response has no matches field', async () => {
        hoisted.mockAxiosGet.mockResolvedValue({ data: {} })

        const result = await fetchPlayerMatches(US_PROFILE)

        expect(result).toEqual([])
    })

    it('returns an empty array and logs a warning on network error', async () => {
        hoisted.mockAxiosGet.mockRejectedValue({ response: { status: 429 } })

        const result = await fetchPlayerMatches(US_PROFILE)

        expect(result).toEqual([])
        expect(hoisted.mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'blizzard-match-client', profileId: 883917, status: 429 }),
            expect.any(String)
        )
    })

    it('returns an empty array silently on 404 (profile not found)', async () => {
        hoisted.mockAxiosGet.mockRejectedValue({ response: { status: 404 } })

        const result = await fetchPlayerMatches(US_PROFILE)

        expect(result).toEqual([])
        expect(hoisted.mockLogger.warn).not.toHaveBeenCalled()
    })

    it('returns an empty array silently on ECONNABORTED (Latin America realm dead zone)', async () => {
        hoisted.mockAxiosGet.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 6000ms exceeded' })

        const result = await fetchPlayerMatches(US_PROFILE)

        expect(result).toEqual([])
        expect(hoisted.mockLogger.warn).not.toHaveBeenCalled()
    })

    it('throws for an unknown region', async () => {
        const badProfile = { ...US_PROFILE, region: 'ZZ' }
        await expect(fetchPlayerMatches(badProfile)).rejects.toThrow('Unknown Blizzard region')
    })
})
