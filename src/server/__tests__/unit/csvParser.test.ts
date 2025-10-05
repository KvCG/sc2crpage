import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('path', async () => {
    const actual = await vi.importActual<any>('path')
    // Mock path.join to return a temp path instead of real source path
    return { 
        ...actual, 
        join: (...args: string[]) => {
            // If this is the specific path used in csvParser, return a temp path
            if (args.includes('..') && args.includes('data') && args.includes('ladderCR.csv')) {
                return '/tmp/test-ladderCR.csv'
            }
            return actual.join(...args)
        }
    }
})

// Hoisted fs mock because module uses fs at import time
const fsMock = vi.hoisted(() => ({
    existsSync: vi.fn(),
    createReadStream: vi.fn(),
    unlink: vi.fn(),
    // Add additional fs methods to prevent real file operations
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    statSync: vi.fn(),
}))

vi.mock('fs', () => ({
    default: fsMock,
    ...fsMock,
}))

// Mock csv-parser to return a PassThrough transform stream
vi.mock('csv-parser', () => ({
    default: () => {
        const { PassThrough } = require('stream')
        return new PassThrough({ objectMode: true })
    },
}))

// Mock Firebase download to be a no-op
vi.mock('../../middleware/fbFileManagement', () => ({
    downloadFile: vi.fn().mockResolvedValue(undefined),
}))

describe('csvParser', () => {
    beforeEach(() => {
        vi.resetModules()
        // Clear any global mocks for this specific test
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('reads CSV and caches results', async () => {
        const { PassThrough } = await import('stream')
        const stream = new PassThrough({ objectMode: true })
        fsMock.existsSync.mockReturnValue(true)
        fsMock.createReadStream.mockReturnValue(stream)

        const { readCsv } = await import('../../utils/csvParser')

        // Write two rows then end
        queueMicrotask(() => {
            stream.write({ id: '1', btag: 'A#111' })
            stream.write({ id: '2', btag: 'B#222' })
            stream.end()
        })

        const first = await readCsv()
        expect(first).toEqual([
            { id: '1', btag: 'A#111' },
            { id: '2', btag: 'B#222' },
        ])

        // Second call should return cached result without re-reading stream
        fsMock.createReadStream.mockClear()
        const second = await readCsv()
        expect(second).toEqual(first)
        expect(fsMock.createReadStream).not.toHaveBeenCalled()
    })

    it('downloads file when missing', async () => {
        const { PassThrough } = await import('stream')
        const stream = new PassThrough({ objectMode: true })
        const { downloadFile } = await import(
            '../../middleware/fbFileManagement'
        )
        fsMock.existsSync.mockReturnValue(false)
        fsMock.createReadStream.mockReturnValue(stream)

        const { readCsv } = await import('../../utils/csvParser')
        queueMicrotask(() => {
            stream.write({ id: '1' })
            stream.end()
        })

        const data = await readCsv()
        expect(data).toEqual([{ id: '1' }])
        expect(downloadFile).toHaveBeenCalledWith(
            'ranked_players',
            'ladderCR.csv'
        )
    })

    it('refreshDataCache clears cache, deletes file and reloads', async () => {
        const { PassThrough } = await import('stream')
        const firstStream = new PassThrough({ objectMode: true })
        const secondStream = new PassThrough({ objectMode: true })
        fsMock.existsSync.mockReturnValue(true)

        // First read
        fsMock.createReadStream.mockReturnValueOnce(firstStream)
        const { readCsv, refreshDataCache } = await import(
            '../../utils/csvParser'
        )
        queueMicrotask(() => {
            firstStream.write({ id: '1' })
            firstStream.end()
        })
        const initial = await readCsv()
        expect(initial).toEqual([{ id: '1' }])

        // Prepare second read after refresh
        fsMock.createReadStream.mockReturnValueOnce(secondStream)
        fsMock.unlink.mockImplementation((_p: any, cb: any) => cb(null))
        queueMicrotask(() => {
            secondStream.write({ id: '2' })
            secondStream.end()
        })

        await refreshDataCache()
        const refreshed = await readCsv()
        expect(refreshed).toEqual([{ id: '2' }])
        expect(fsMock.unlink).toHaveBeenCalled()
    })
})
