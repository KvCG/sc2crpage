import { describe, it, expect, vi, beforeAll } from 'vitest'

const captures = vi.hoisted(() => ({
    uses: [] as any[],
    gets: [] as Array<{ path: string; handler: Function }>,
}))

vi.mock('cors', () => ({
    default: () => (_req: any, _res: any, next: any) => next(),
}))

vi.mock('express', () => {
    const app = {
        use: (...args: any[]) => captures.uses.push(args),
        get: (path: string, handler: Function) =>
            captures.gets.push({ path, handler }),
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

vi.mock('../../routes/apiRoutes', () => ({
    default: (_req: any, _res: any, next: any) => next(),
}))

beforeAll(async () => {
    await import('../../server')
})

describe('server app routes', () => {
    it('SPA fallback sends index.html', () => {
        const entry = captures.gets.find(g => g.path === '*')
        expect(entry).toBeTruthy()
        const sent: string[] = []
        const res = { sendFile: (p: string) => sent.push(p) }
        entry!.handler({}, res)
        expect(sent.length).toBe(1)
        expect(sent[0].toLowerCase()).toMatch(/index\.html$/)
    })

    it('error handler returns 500 and logs', () => {
        const errMwTuple = captures.uses.find(
            args => typeof args[0] === 'function' && args[0].length === 4
        )
        expect(errMwTuple).toBeTruthy()
        const errMw = errMwTuple![0] as Function
        const statusCalls: any[] = []
        const sendCalls: any[] = []
        const res = {
            status: (code: number) => {
                statusCalls.push(code)
                return res
            },
            send: (body: any) => {
                sendCalls.push(body)
            },
        } as any
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {})

        errMw(new Error('boom'), {}, res, () => {})

        expect(consoleSpy).toHaveBeenCalled()
        expect(statusCalls[0]).toBe(500)
        expect(sendCalls[0]).toBe('Internal Server Error')

        consoleSpy.mockRestore()
    })
})
