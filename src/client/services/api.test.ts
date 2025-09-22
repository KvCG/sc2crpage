import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios', () => {
    const get = vi.fn()
    const post = vi.fn()
    const create = vi.fn(() => ({ get, post }))
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
})
