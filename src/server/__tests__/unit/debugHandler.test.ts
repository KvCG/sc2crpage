import { describe, it, expect } from 'vitest'
import { createDebugHandler } from '../../routes/debugHandler'

function mockReq(query: Record<string, any> = {}) {
    return { query } as any
}

function mockRes() {
    const headers: Record<string, string> = {}
    return {
        status(code: number) {
            this.statusCode = code
            return this
        },
        json(payload: any) {
            this.body = payload
            return this
        },
        setHeader(k: string, v: string) {
            headers[k] = v
        },
        end(payload?: any) {
            this.body = payload
        },
        get headers() {
            return headers
        },
        statusCode: 200,
        body: undefined as any,
    } as any
}

describe('debugHandler', () => {
    const buildInfo = { version: '1.2.3' }
    const handler = createDebugHandler({ buildInfo })

    it('returns 400 when missing type', () => {
        const req = mockReq()
        const res = mockRes()
        handler(req, res)
        expect(res.statusCode).toBe(400)
        expect(res.body.error).toBe('Missing query')
    })

    it('returns buildInfo JSON', () => {
        const req = mockReq({ type: 'buildInfo' })
        const res = mockRes()
        handler(req, res)
        expect(res.body).toContain('1.2.3')
        expect(res.headers['content-type']).toBe('application/json')
    })

    it('returns metrics with p95/p99', () => {
        const req = mockReq({ type: 'metrics' })
        const res = mockRes()
        handler(req, res)
        expect(res.body).toHaveProperty('http_total')
        expect(res.body).toHaveProperty('pulse_req_total')
        expect(res.body).toHaveProperty('pulse_p95_ms')
        expect(res.body).toHaveProperty('pulse_p99_ms')
    })

    it('errors on req without id', () => {
        const req = mockReq({ type: 'req' })
        const res = mockRes()
        handler(req, res)
        expect(res.statusCode).toBe(400)
        expect(res.body.error).toBe('Missing id')
    })
})
