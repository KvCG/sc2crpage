import { describe, it, expect, vi, beforeAll } from 'vitest'

const analyzeReplayBase64Mock = vi.fn()
const analyzeReplayUrlMock = vi.fn()

vi.mock('../../services/replayAnalyzerApi', () => ({
    analyzeReplayBase64: (...args: any[]) => analyzeReplayBase64Mock(...args),
    analyzeReplayUrl: (...args: any[]) => analyzeReplayUrlMock(...args),
}))

const captures = vi.hoisted(() => ({
    routes: [] as Array<{ method: string; path: string; handler: Function }>,
}))

vi.mock('express', async orig => {
    const mod = await (orig as any)()
    return {
        ...mod,
        Router: () => ({
            post: (path: string, handler: Function) =>
                captures.routes.push({ method: 'post', path, handler }),
        }),
    }
})

beforeAll(async () => {
    await import('../../routes/replayAnalyzerRoutes')
})

const runPost = async (path: string, body: any) => {
    const entry = captures.routes.find(
        r => r.path === path && r.method === 'post'
    )
    if (!entry) throw new Error('route not found: ' + path)
    const res: any = {
        jsonBody: undefined as any,
        json(payload: any) {
            this.jsonBody = payload
        },
    }
    await entry.handler({ body } as any, res)
    return res.jsonBody
}

describe('replayAnalyzerRoutes', () => {
    it('analyzeReplayBase64 returns service data', async () => {
        analyzeReplayBase64Mock.mockResolvedValueOnce({ ok: true, kind: 'b64' })
        const out = await runPost('/analyzeReplayBase64', { fileBase64: 'AAA' })
        expect(analyzeReplayBase64Mock).toHaveBeenCalledWith('AAA')
        expect(out).toEqual({ ok: true, kind: 'b64' })
    })

    it('analyzeReplayBase64 returns error json on failure', async () => {
        analyzeReplayBase64Mock.mockRejectedValueOnce(new Error('oops'))
        const out = await runPost('/analyzeReplayBase64', { fileBase64: 'BBB' })
        expect(out).toEqual({ error: 'Error analyzing replay data' })
    })

    it('analyzeReplayUrl returns service data', async () => {
        analyzeReplayUrlMock.mockResolvedValueOnce({ ok: true, kind: 'url' })
        const out = await runPost('/analyzeReplayUrl', { fileUrl: 'http://x' })
        expect(analyzeReplayUrlMock).toHaveBeenCalledWith('http://x')
        expect(out).toEqual({ ok: true, kind: 'url' })
    })

    it('analyzeReplayUrl returns error json on failure', async () => {
        analyzeReplayUrlMock.mockRejectedValueOnce(new Error('oops'))
        const out = await runPost('/analyzeReplayUrl', { fileUrl: 'http://y' })
        expect(out).toEqual({ error: 'Error analyzing replay data' })
    })
})
