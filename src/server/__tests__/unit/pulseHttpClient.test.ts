import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock('axios', () => {
    const { getMock } = hoisted
    return { default: { create: vi.fn(() => ({ get: getMock })) } }
})

beforeEach(() => {
    const { getMock } = hoisted
    getMock.mockReset()
    // ensure test env disables rate limiter/backoff delays
    process.env.NODE_ENV = 'test'
})

describe('pulseHttpClient.get', () => {
    it('passes params and returns data on success', async () => {
        const { get } = await import('../../services/pulseHttpClient')
        hoisted.getMock.mockResolvedValueOnce({ data: { ok: true } })
        const res = await get('character/search', { term: 'Neo' })
        expect(res).toEqual({ ok: true })
        expect(hoisted.getMock).toHaveBeenCalledWith('character/search', {
            params: { term: 'Neo' },
        })
    })

    it('retries on 429 then succeeds', async () => {
        const { get } = await import('../../services/pulseHttpClient')
        hoisted.getMock
            .mockRejectedValueOnce({
                response: { status: 429 },
                message: 'Too Many Requests',
                config: { url: 'x', method: 'get' },
            })
            .mockResolvedValueOnce({ data: { ok: true } })
        const res = await get('character/search', { term: 'Neo' })
        expect(res).toEqual({ ok: true })
        expect(hoisted.getMock).toHaveBeenCalledTimes(2)
    })

    it('retries on 5xx then succeeds', async () => {
        const { get } = await import('../../services/pulseHttpClient')
        hoisted.getMock
            .mockRejectedValueOnce({
                response: { status: 503 },
                message: 'Service Unavailable',
                config: { url: 'x', method: 'get' },
            })
            .mockResolvedValueOnce({ data: { ok: true } })
        const res = await get('group/team', { a: 1 })
        expect(res).toEqual({ ok: true })
        expect(hoisted.getMock).toHaveBeenCalledTimes(2)
    })

    it('maps error after exceeding retries', async () => {
        const { get } = await import('../../services/pulseHttpClient')
        hoisted.getMock.mockRejectedValue({
            response: { status: 500 },
            message: 'boom',
            config: { url: 'x', method: 'get' },
        })
        await expect(get('group/team', { a: 1 })).rejects.toMatchObject({
            error: 'boom',
            code: 500,
        })
    })

    it('enforces rate limiting when not in test env', async () => {
        vi.resetModules()
        const OLD_ENV = process.env.NODE_ENV
        process.env.NODE_ENV = 'development'
        process.env.SC2PULSE_RPS = '1'
        vi.useFakeTimers()

        const axios = await vi.importMock<any>('axios')
        const calls: number[] = []
        axios.default.create.mockReturnValue({
            get: vi.fn(async () => {
                calls.push(Date.now())
                return { data: { ok: true } }
            }),
        })

        const { get } = await import('../../services/pulseHttpClient')
        const p1 = get('/x')
        const p2 = get('/y')

        // First call now, second after ~1s due to RPS=1
        await Promise.resolve()
        expect(calls.length).toBe(1)
        vi.advanceTimersByTime(999)
        expect(calls.length).toBe(1)
        vi.advanceTimersByTime(2)
        await Promise.all([p1, p2])
        expect(calls.length).toBe(2)

        vi.useRealTimers()
        process.env.NODE_ENV = OLD_ENV
    })

})
