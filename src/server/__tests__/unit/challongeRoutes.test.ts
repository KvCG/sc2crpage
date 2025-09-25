import { describe, it, expect, vi, beforeAll } from 'vitest'

vi.mock('../../services/challongeApi', () => ({
    getTournamentDetails: vi
        .fn()
        .mockResolvedValue({ tournament: { id: 1, name: 'Test Cup' } }),
}))

vi.mock('../../utils/formatData', () => ({
    formatData: vi.fn(async (data: any, _kind: string) => ({
        ...data,
        formatted: true,
    })),
}))

const captures = vi.hoisted(() => ({
    routes: [] as Array<{ path: string; handler: Function }>,
}))

vi.mock('express', async orig => {
    const mod = await (orig as any)()
    return {
        ...mod,
        Router: () => ({
            get: (path: string, handler: Function) =>
                captures.routes.push({ path, handler }),
        }),
    }
})

beforeAll(async () => {
    await import('../../routes/challongeRoutes')
})

describe('challongeRoutes', () => {
    it('returns formatted tournament data', async () => {
        const entry = captures.routes.find(r => r.path === '/tournament')
        expect(entry).toBeTruthy()
        const jsonCalls: any[] = []
        const res = { json: (payload: any) => jsonCalls.push(payload) } as any
        await entry!.handler({} as any, res)
        expect(jsonCalls[0]).toEqual({
            id: 1,
            name: 'Test Cup',
            formatted: true,
        })
    })
})
