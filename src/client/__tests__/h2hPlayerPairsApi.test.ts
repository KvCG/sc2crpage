import { describe, it, expect, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
    mockGet: vi.fn(),
}))

vi.mock('axios', () => ({
    default: {
        create: vi.fn(() => ({
            get: hoisted.mockGet,
            interceptors: { request: { use: vi.fn() } },
        })),
    },
}))

vi.mock('../services/config', () => ({ default: { API_URL: 'http://localhost:3000/' } }))
vi.mock('../utils/requestIdentity', () => ({ default: vi.fn() }))

import { getPlayerH2HPairs } from '../services/api'

describe('getPlayerH2HPairs', () => {
    it('calls api/h2h/player-pairs with the correct player param', async () => {
        hoisted.mockGet.mockResolvedValueOnce({ data: [], status: 200 })

        await getPlayerH2HPairs(42)

        expect(hoisted.mockGet).toHaveBeenCalledWith('api/h2h/player-pairs', { params: { player: 42 } })
    })
})
