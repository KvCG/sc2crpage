import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Router } from 'express'

vi.mock('../../services/pulseApi', () => ({
    getTop: vi.fn().mockResolvedValue([
        { playerCharacterId: '1', ratingLast: 3500, btag: 'A#1' },
    ]),
}))

vi.mock('../../utils/formatData', () => ({
    // passthrough for test: return input
    formatData: vi.fn(async (data: any) => data),
}))

// Import after mocks
import routes from '../../routes/pulseRoutes'

function runRoute(
    handler: Function,
    req: any = {},
    extraHeaders: Record<string, string> = {}
) {
    const headers: Record<string, string> = {}
    const res = {
        setHeader: (k: string, v: string) => {
            headers[k.toLowerCase()] = v
        },
        jsonPayload: undefined as any,
        json(payload: any) {
            this.jsonPayload = payload
        },
    }
    const reqObj = {
        headers: { 'user-agent': 'Mozilla/5.0', ...extraHeaders },
        ip: '127.0.0.1',
        query: req.query || {},
    }
    return handler(reqObj as any, res as any).then(() => ({
        headers,
        json: res.jsonPayload,
    }))
}

describe('pulseRoutes /snapshot', () => {
    beforeEach(async () => {
        vi.resetModules()
        const cache = (await import('../../utils/snapshotCache')).default
        cache.clear()
    })

    it('returns snapshot with attribution header', async () => {
        const r = routes as unknown as Router & { stack: any[] }
        const layer = r.stack.find(s => s.route?.path === '/snapshot')!
        const handler = layer.route!.stack[0].handle

        const result = await runRoute(handler)
        expect(result.headers['x-sc2pulse-attribution']).toBeDefined()
    expect(Array.isArray(result.json.data)).toBe(true)
    expect(typeof result.json.createdAt).toBe('string')
    expect(typeof result.json.expiry).toBe('number')
    })
})
