import { describe, it, expect, vi } from 'vitest'
import { Router } from 'express'

vi.mock('../../services/pulseApi', () => ({
    getTop: vi
        .fn()
        .mockResolvedValue([{ playerCharacterId: '1', ratingLast: 3500 }]),
    searchPlayer: vi
        .fn()
        .mockResolvedValue([
            {
                members: {
                    character: { id: '1' },
                    account: { battleTag: 'A#1' },
                },
                currentStats: {},
                leagueMax: '',
                ratingMax: 0,
                totalGamesPlayed: 0,
            },
        ]),
}))

vi.mock('../../utils/formatData', () => ({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    formatData: vi.fn(async (data: any, _type: string) => data),
}))

// Import after mocks
import routes from '../../routes/pulseRoutes'

function runRoute(
    handler: Function,
    req: any = {},
    resHdrs: Record<string, string> = {}
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
        headers: { 'user-agent': 'Mozilla/5.0', ...resHdrs },
        ip: '127.0.0.1',
        query: req.query || {},
    }
    return handler(reqObj as any, res as any).then(() => ({
        headers,
        json: res.jsonPayload,
    }))
}

describe('pulseRoutes', () => {
    it('sets attribution header on /top', async () => {
        // Find the /top route handler
        const r = routes as unknown as Router & { stack: any[] }
        const layer = r.stack.find(s => s.route?.path === '/top')!
        const handler = layer.route!.stack[0].handle

        const result = await runRoute(handler)
        expect(result.headers['x-sc2pulse-attribution']).toBeDefined()
        expect(Array.isArray(result.json)).toBe(true)
    })

    it('sets attribution header on /search and returns data', async () => {
        const r = routes as unknown as Router & { stack: any[] }
        const layer = r.stack.find(s => s.route?.path === '/search')!
        const handler = layer.route!.stack[0].handle

        const result = await runRoute(handler, { query: { term: 'neo' } })
        expect(result.headers['x-sc2pulse-attribution']).toBeDefined()
        expect(Array.isArray(result.json)).toBe(true)
    })
})
