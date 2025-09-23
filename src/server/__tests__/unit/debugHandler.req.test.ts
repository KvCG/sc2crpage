import { describe, it, expect } from 'vitest'
import { createDebugHandler } from '../../routes/debugHandler'
import * as reqObs from '../../observability/reqObs'

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

describe('debugHandler (req path)', () => {
    it('returns 200 with a request entry when present', () => {
        const fakeId = 'test-req-id-123'

        // Seed the request observability store with a minimal entry
        reqObs.getReqObs({ id: fakeId } as any)

        const handler = createDebugHandler({
            buildInfo: { version: 'x', commit: 'y', date: 'z' },
        })

        const req = mockReq({ type: 'req', id: fakeId })
        const res = mockRes()

        handler(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.body).toHaveProperty('id', fakeId)
    })
})
