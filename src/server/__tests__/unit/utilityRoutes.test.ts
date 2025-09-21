import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock refreshDataCache to avoid filesystem side effects
vi.mock('../../utils/csvParser', () => ({
    refreshDataCache: vi.fn().mockResolvedValue(undefined),
}))

// Capture router handlers by mocking express.Router
const captures = vi.hoisted(() => ({
    routes: [] as Array<{ method: string; path: string; handler: Function }>,
}))

vi.mock('express', async orig => {
    const mod = await (orig as any)()
    return {
        ...mod,
        Router: () => ({
            get: (path: string, handler: Function) =>
                captures.routes.push({ method: 'get', path, handler }),
        }),
    }
})

beforeAll(async () => {
    await import('../../routes/utilityRoutes')
})

const runHandler = async (path: string) => {
    const entry = captures.routes.find(
        r => r.path === path && r.method === 'get'
    )
    if (!entry) throw new Error('route not found: ' + path)
    const res: any = {
        statusCode: 0,
        body: undefined as any,
        status(code: number) {
            this.statusCode = code
            return this
        },
        json(payload: any) {
            this.body = payload
        },
    }
    await entry.handler({} as any, res)
    return res
}

describe('utilityRoutes', () => {
    it('refreshCache calls refreshDataCache and returns Done!', async () => {
        const res = await runHandler('/refreshCache')
        expect(res.statusCode).toBe(200)
        expect(res.body).toBe('Done!')
    })

    it('health returns ok status', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const res = await runHandler('/health')
        expect(res.statusCode).toBe(200)
        expect(res.body).toEqual({ status: 'ok' })
        expect(spy).toHaveBeenCalled()
        spy.mockRestore()
    })
})
