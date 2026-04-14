import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios', () => {
    const get = vi.fn()
    const post = vi.fn()
    const interceptors = {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
    }
    const instance = { get, post, interceptors }
    const create = vi.fn(() => instance)
    return { default: { create }, create, get, post }
})

vi.mock('./config', () => ({ default: { API_URL: 'http://api.test/' } }))

import * as api from './api'

describe('api client', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('builds search request with encoded term', async () => {
        const instance = (axios as any).create()
        ;(instance.get as any).mockResolvedValueOnce({ data: [] })
        const res = await api.search('Ne O#1')
        expect((axios as any).create).toHaveBeenCalled()
        expect(instance.get).toHaveBeenCalledWith('api/search/?term=Ne%20O%231')
        expect(res.data).toEqual([])
    })

    it('posts body for uploadReplay and returns response', async () => {
        const instance = (axios as any).create()
        ;(instance.post as any).mockResolvedValueOnce({ status: 200 })
        const res = await api.uploadReplay({ id: 'x' })
        expect(instance.post).toHaveBeenCalledWith('api/uploadReplay', {
            id: 'x',
        })
        expect(res.status).toBe(200)
    })

    it('propagates axios errors', async () => {
        const instance = (axios as any).create()
        ;(instance.get as any).mockRejectedValueOnce(new Error('boom'))
        await expect(api.getTop()).rejects.toThrow('boom')
    })

    it('sends only provided params to getTop', async () => {
        const instance = (axios as any).create()
        ;(instance.get as any).mockResolvedValueOnce({ data: [] })
        
        await api.getTop({ minimumGames: 0 })
        
        expect(instance.get).toHaveBeenCalledWith('api/top/', {
            params: { minimumGames: 0 }
        })
    })

    it('sends undefined params when no filters specified', async () => {
        const instance = (axios as any).create()
        ;(instance.get as any).mockResolvedValueOnce({ data: [] })
        
        await api.getTop()
        
        expect(instance.get).toHaveBeenCalledWith('api/top/', {
            params: undefined
        })
    })

    it('sends season param to getTop', async () => {
        const instance = (axios as any).create()
        ;(instance.get as any).mockResolvedValueOnce({ data: [] })

        await api.getTop({ season: 67 })

        expect(instance.get).toHaveBeenCalledWith('api/top/', {
            params: { season: 67 },
        })
    })

    it('calls api/seasons endpoint for getSeasons', async () => {
        const instance = (axios as any).create()
        const mockSeasons = [{ id: 67, year: 2026, number: 2, start: '2026-01-01', end: '2026-04-01' }]
        ;(instance.get as any).mockResolvedValueOnce({ data: mockSeasons })

        const res = await api.getSeasons()

        expect(instance.get).toHaveBeenCalledWith('api/seasons')
        expect(res.data).toEqual(mockSeasons)
    })
})
