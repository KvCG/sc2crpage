import { describe, it, expect, vi, beforeAll } from 'vitest'

const getReplayAnalysis = vi.fn()
const getAllReplays = vi.fn()
const uploadReplay = vi.fn()
const deleteReplay = vi.fn()

vi.mock('../../services/googleApi', () => ({
    getReplayAnalysis: (...a: any[]) => getReplayAnalysis(...a),
    getAllReplays: (...a: any[]) => getAllReplays(...a),
    uploadReplay: (...a: any[]) => uploadReplay(...a),
    deleteReplay: (...a: any[]) => deleteReplay(...a),
}))

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
            post: (path: string, handler: Function) =>
                captures.routes.push({ method: 'post', path, handler }),
        }),
    }
})

beforeAll(async () => {
    await import('../../routes/googleRoutes')
})

const run = async (
    method: 'get' | 'post',
    path: string,
    reqBody: any = undefined
) => {
    const entry = captures.routes.find(
        r => r.method === method && r.path === path
    )
    if (!entry) throw new Error('route not found: ' + method + ' ' + path)
    const res: any = {
        jsonBody: undefined as any,
        json(payload: any) {
            this.jsonBody = payload
        },
    }
    await entry.handler({ body: reqBody } as any, res)
    return res.jsonBody
}

describe('googleRoutes', () => {
    it('getReplays returns list and handles error', async () => {
        getAllReplays.mockResolvedValueOnce([{ id: '1' }])
        expect(await run('get', '/getReplays')).toEqual([{ id: '1' }])
        getAllReplays.mockRejectedValueOnce(new Error('x'))
        expect(await run('get', '/getReplays')).toEqual({
            error: 'Error getting replays',
        })
    })

    it('getReplayAnalysis returns analysis and error path', async () => {
        getReplayAnalysis.mockResolvedValueOnce({ ok: true })
        expect(await run('post', '/getReplayAnalysis', { id: '1' })).toEqual({
            ok: true,
        })
        getReplayAnalysis.mockRejectedValueOnce(new Error('x'))
        expect(await run('post', '/getReplayAnalysis', { id: '1' })).toEqual({
            error: 'Error uploading the file',
        })
    })

    it('uploadReplay returns fileId and error path', async () => {
        uploadReplay.mockResolvedValueOnce('abc')
        expect(await run('post', '/uploadReplay', { f: 1 })).toEqual({
            fileId: 'abc',
        })
        uploadReplay.mockRejectedValueOnce(new Error('x'))
        expect(await run('post', '/uploadReplay', { f: 1 })).toEqual({
            error: 'Error uploading the file',
        })
    })

    it('deleteReplay returns empty object on true and error otherwise', async () => {
        deleteReplay.mockResolvedValueOnce(true)
        expect(await run('post', '/deleteReplay', { id: '1' })).toEqual({})
        deleteReplay.mockResolvedValueOnce(false)
        expect(await run('post', '/deleteReplay', { id: '2' })).toEqual({
            error: 'Error deleting the file',
        })
        deleteReplay.mockRejectedValueOnce(new Error('x'))
        expect(await run('post', '/deleteReplay', { id: '3' })).toEqual({
            error: 'Error deleting the file',
        })
    })
})
