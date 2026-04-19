import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
    mockAxiosPost: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('axios', () => ({ default: { post: hoisted.mockAxiosPost } }))
vi.mock('../../../logging/logger', () => ({ default: hoisted.mockLogger }))

import { getAccessToken, _clearTokenCache } from '../../../services/blizzardAuthClient'

const FAKE_TOKEN = 'test-access-token'
const THIRTY_DAYS_S = 30 * 24 * 3600

function mockTokenResponse(token = FAKE_TOKEN, expiresIn = THIRTY_DAYS_S) {
    hoisted.mockAxiosPost.mockResolvedValue({
        data: { access_token: token, expires_in: expiresIn },
    })
}

describe('blizzardAuthClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        _clearTokenCache()
        process.env.BLIZZARD_CLIENT_ID = 'test-client-id'
        process.env.BLIZZARD_CLIENT_SECRET = 'test-client-secret'
    })

    it('fetches a token and returns it', async () => {
        mockTokenResponse()

        const token = await getAccessToken()

        expect(token).toBe(FAKE_TOKEN)
        expect(hoisted.mockAxiosPost).toHaveBeenCalledTimes(1)
    })

    it('posts to the correct Blizzard token URL with client credentials', async () => {
        mockTokenResponse()

        await getAccessToken()

        const [url, body, config] = hoisted.mockAxiosPost.mock.calls[0]
        expect(url).toBe('https://oauth.battle.net/token')
        expect(body).toBe('grant_type=client_credentials')
        expect(config.auth).toEqual({
            username: 'test-client-id',
            password: 'test-client-secret',
        })
    })

    it('returns the cached token on a second call without hitting the network', async () => {
        mockTokenResponse()

        await getAccessToken()
        const token = await getAccessToken()

        expect(hoisted.mockAxiosPost).toHaveBeenCalledTimes(1)
        expect(token).toBe(FAKE_TOKEN)
    })

    it('refreshes the token when less than 5 minutes remain before expiry', async () => {
        // First call — token expires in 4 min (< 5 min threshold)
        hoisted.mockAxiosPost.mockResolvedValueOnce({
            data: { access_token: 'expiring-soon', expires_in: 4 * 60 },
        })
        // Second call — new long-lived token
        hoisted.mockAxiosPost.mockResolvedValueOnce({
            data: { access_token: 'fresh-token', expires_in: THIRTY_DAYS_S },
        })

        await getAccessToken()
        const token = await getAccessToken()

        expect(hoisted.mockAxiosPost).toHaveBeenCalledTimes(2)
        expect(token).toBe('fresh-token')
    })

    it('logs token acquisition with expiresIn', async () => {
        mockTokenResponse(FAKE_TOKEN, 86400)

        await getAccessToken()

        expect(hoisted.mockLogger.info).toHaveBeenCalledWith(
            expect.objectContaining({ feature: 'blizzard-auth', expiresIn: 86400 }),
            expect.any(String)
        )
    })

    it('throws when BLIZZARD_CLIENT_ID is missing', async () => {
        delete process.env.BLIZZARD_CLIENT_ID

        await expect(getAccessToken()).rejects.toThrow(
            'BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET must be set'
        )
        expect(hoisted.mockAxiosPost).not.toHaveBeenCalled()
    })

    it('throws when BLIZZARD_CLIENT_SECRET is missing', async () => {
        delete process.env.BLIZZARD_CLIENT_SECRET

        await expect(getAccessToken()).rejects.toThrow(
            'BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET must be set'
        )
        expect(hoisted.mockAxiosPost).not.toHaveBeenCalled()
    })
})
