import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// Hoisted capture for middlewares registered via app.use(fn)
const captures = vi.hoisted(() => ({ middlewares: [] as Array<Function> }))

// Mock cors to a no-op handler
vi.mock('cors', () => ({
    default: () => (_req: any, _res: any, next: any) => next(),
}))

// Mock express to capture middlewares and avoid starting a real server
vi.mock('express', () => {
    const app = {
        use: (...args: any[]) => {
            if (typeof args[0] === 'function')
                captures.middlewares.push(args[0])
        },
        get: (_path: string, _handler: any) => {},
        listen: (_port: number, cb?: () => void) => {
            if (cb) cb()
        },
    }
    const expressFn: any = () => app
    expressFn.static = () => (_req: any, _res: any, next: any) => next()
    expressFn.json = () => (_req: any, _res: any, next: any) => next()
    expressFn.urlencoded = () => (_req: any, _res: any, next: any) => next()
    return { default: expressFn }
})

// Mock the apiRoutes module imported by server.ts to a no-op router
vi.mock('../../routes/apiRoutes', () => ({
    default: (_req: any, _res: any, next: any) => next(),
}))

// Mock h2hScheduler to prevent a long-running setTimeout from blocking the test worker
vi.mock('../../services/h2hScheduler', () => ({ startH2HScheduler: vi.fn() }))

// Mock snapshotService to prevent real HTTP calls during server module import
vi.mock('../../services/snapshotService', () => ({
    retrieveInitialRankingData: vi.fn().mockResolvedValue({
        data: [],
        createdAt: new Date().toISOString(),
        expiry: Date.now() + 86400000,
    }),
    clearDailySnapshot: vi.fn(),
}))

// Utility to build a minimal req/res/next triple
const buildReqRes = () => {
    const headers: Record<string, string> = {}
    let finishHandler: (() => void) | undefined
    const req = { headers: {} as Record<string, string | undefined> }
    const res = {
        setHeader: (k: string, v: any) => {
            headers[k.toLowerCase()] = String(v)
        },
        on: (evt: string, cb: () => void) => {
            if (evt === 'finish') finishHandler = cb
        },
    } as any
    const next = vi.fn()
    return { req, res, next, headers, triggerFinish: () => finishHandler?.() }
}

// Import server after mocks so middlewares are captured
beforeAll(async () => {
    await import('../../server')
})

// Find the headers middleware by probing for the one that sets x-powered-by
const findHeadersMiddleware = (): Function => {
    for (const mw of captures.middlewares) {
        const ctx = buildReqRes()
        mw(ctx.req, ctx.res, ctx.next)
        if (ctx.headers['x-powered-by'] === 'sc2cr') return mw
    }
    throw new Error('Headers middleware not found')
}

describe('server headers middleware', () => {
    let headersMw: Function

    beforeEach(() => {
        headersMw = findHeadersMiddleware()
    })

    it('sets powered-by header and records response time on finish', () => {
        const { req, res, next, headers } = buildReqRes()
        headersMw(req, res, next)
        expect(next).toHaveBeenCalled()
        expect(headers['x-powered-by']).toBe('sc2cr')
    })

    it('sets response time header on finish', () => {
        const { req, res, next, headers, triggerFinish } = buildReqRes()
        headersMw(req, res, next)
        // simulate response finish to trigger x-response-time-ms
        triggerFinish()
        expect(headers['x-response-time-ms']).toBeDefined()
        expect(Number(headers['x-response-time-ms'])).toBeGreaterThanOrEqual(0)
    })
})
