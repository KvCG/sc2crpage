import { describe, it, expect, vi, beforeEach } from 'vitest'

const fileMock = { download: vi.fn() }
const bucketMock = { file: vi.fn(() => fileMock) }

vi.mock('../../services/firebase', () => ({ bucket: bucketMock }))

// stub fs to avoid real disk writes
vi.mock('fs', () => ({ default: { mkdirSync: vi.fn() }, mkdirSync: vi.fn() }))

describe('fbFileManagement.downloadFile', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('downloads a file to data directory', async () => {
        fileMock.download.mockResolvedValueOnce(undefined)
        const mod = await import('../../middleware/fbFileManagement')
        await mod.downloadFile('replays', 'test.json')
        expect(bucketMock.file).toHaveBeenCalledWith('replays/test.json')
        expect(fileMock.download).toHaveBeenCalled()
    })

    it('handles errors gracefully and logs', async () => {
        const consoleSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {})
        fileMock.download.mockRejectedValueOnce(new Error('boom'))
        const mod = await import('../../middleware/fbFileManagement')
        await mod.downloadFile('replays', 'test.json')
        expect(consoleSpy).toHaveBeenCalled()
        consoleSpy.mockRestore()
    })
})
