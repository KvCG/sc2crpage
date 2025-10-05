import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Google APIs
const driveFilesMock = {
    list: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn()
}

const googleAuthMock = {
    getClient: vi.fn().mockResolvedValue({}),
    GoogleAuth: vi.fn().mockImplementation(() => ({ getClient: googleAuthMock.getClient }))
}

const googleMock = {
    auth: googleAuthMock,
    drive: vi.fn(() => ({ files: driveFilesMock })),
    options: vi.fn()
}

vi.mock('googleapis', () => ({
    google: googleMock
}))

// Mock filesystem operations
vi.mock('fs', () => ({
    default: {
        mkdirSync: vi.fn(),
        createWriteStream: vi.fn(() => ({
            on: vi.fn(),
            pipe: vi.fn()
        }))
    },
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(() => ({
        on: vi.fn(),
        pipe: vi.fn()
    }))
}))

// Mock path operations
vi.mock('path', () => ({
    default: {
        join: vi.fn((...args) => args.join('/'))
    },
    join: vi.fn((...args) => args.join('/'))
}))

// Mock logger
vi.mock('../../logging/logger', () => ({
    default: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    }
}))

// Mock detectAppEnv
vi.mock('../../../shared/runtimeEnv', () => ({
    detectAppEnv: vi.fn().mockReturnValue('test')
}))

describe('DriveFileStorage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
            type: 'service_account',
            project_id: 'test-project'
        })
    })

    describe('downloadFile', () => {
        it('downloads a file to data directory', async () => {
            // Mock folder exists
            driveFilesMock.list
                .mockResolvedValueOnce({
                    data: { files: [{ id: 'folder-123', name: 'RankedPlayers_test' }] }
                })
                .mockResolvedValueOnce({
                    data: { files: [{ id: 'file-123', name: 'ladderCR.csv', size: '1024' }] }
                })

            // Mock successful file download with Promise-based stream
            const mockStream = {
                pipe: vi.fn().mockImplementation((writer) => {
                    // Simulate successful write
                    setTimeout(() => writer.emit('finish'), 0)
                    return writer
                }),
                on: vi.fn()
            }

            driveFilesMock.get.mockResolvedValueOnce({
                data: mockStream
            })

            const { DriveFileStorage } = await import('../../services/driveFileStorage')
            
            // Wrap in promise to handle async stream operations
            await expect(DriveFileStorage.downloadFile('ladderCR.csv')).resolves.toBeUndefined()
        })

        it('creates folder if it does not exist', async () => {
            // Mock folder doesn't exist, then file exists after folder creation
            driveFilesMock.list
                .mockResolvedValueOnce({ data: { files: [] } })
                .mockResolvedValueOnce({ data: { files: [{ id: 'file-123', name: 'ladderCR.csv' }] } })

            // Mock folder creation
            driveFilesMock.create.mockResolvedValueOnce({
                data: { id: 'new-folder-123' }
            })

            // Mock file download
            const mockStream = {
                pipe: vi.fn().mockImplementation((writer) => {
                    setTimeout(() => writer.emit('finish'), 0)
                    return writer
                }),
                on: vi.fn()
            }
            driveFilesMock.get.mockResolvedValueOnce({ data: mockStream })

            const { DriveFileStorage } = await import('../../services/driveFileStorage')
            await expect(DriveFileStorage.downloadFile('ladderCR.csv')).resolves.toBeUndefined()

            expect(driveFilesMock.create).toHaveBeenCalledWith({
                requestBody: {
                    name: 'RankedPlayers_test',
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            })
        })

        it('throws error when file not found', async () => {
            // Mock folder exists but file doesn't exist
            driveFilesMock.list
                .mockResolvedValueOnce({
                    data: { files: [{ id: 'folder-123', name: 'RankedPlayers_test' }] }
                })
                .mockResolvedValueOnce({
                    data: { files: [] }
                })

            const { DriveFileStorage } = await import('../../services/driveFileStorage')
            await expect(DriveFileStorage.downloadFile('ladderCR.csv'))
                .rejects.toThrow("File 'ladderCR.csv' not found in RankedPlayers_test folder")
        })
    })

    describe('uploadFile', () => {
        it('uploads a file and replaces existing file', async () => {
            const buffer = Buffer.from('test,data\n1,2')

            // Mock folder exists, existing file found, then successful upload
            driveFilesMock.list
                .mockResolvedValueOnce({
                    data: { files: [{ id: 'folder-123', name: 'RankedPlayers_test' }] }
                })
                .mockResolvedValueOnce({
                    data: { files: [{ id: 'old-file-123', name: 'ladderCR.csv' }] }
                })

            // Mock file deletion and creation
            driveFilesMock.delete.mockResolvedValueOnce({})
            driveFilesMock.create.mockResolvedValueOnce({
                data: { id: 'new-file-123', name: 'ladderCR.csv', size: '1024' }
            })

            const { DriveFileStorage } = await import('../../services/driveFileStorage')
            await DriveFileStorage.uploadFile(buffer, 'ladderCR.csv', 'text/csv')

            expect(driveFilesMock.delete).toHaveBeenCalledWith({ fileId: 'old-file-123' })
            expect(driveFilesMock.create).toHaveBeenCalledWith({
                requestBody: {
                    name: 'ladderCR.csv',
                    parents: ['folder-123']
                },
                media: {
                    mimeType: 'text/csv',
                    body: buffer
                },
                fields: 'id,name,size'
            })
        })
    })

    describe('fileExists', () => {
        it('returns true when file exists', async () => {
            // Mock folder exists and file exists
            driveFilesMock.list
                .mockResolvedValueOnce({
                    data: { files: [{ id: 'folder-123', name: 'RankedPlayers_test' }] }
                })
                .mockResolvedValueOnce({
                    data: { files: [{ id: 'file-123', name: 'ladderCR.csv' }] }
                })

            const { DriveFileStorage } = await import('../../services/driveFileStorage')
            const exists = await DriveFileStorage.fileExists('ladderCR.csv')

            expect(exists).toBe(true)
        })

        it('returns false when file does not exist', async () => {
            // Mock folder exists but file doesn't exist
            driveFilesMock.list
                .mockResolvedValueOnce({
                    data: { files: [{ id: 'folder-123', name: 'RankedPlayers_test' }] }
                })
                .mockResolvedValueOnce({
                    data: { files: [] }
                })

            const { DriveFileStorage } = await import('../../services/driveFileStorage')
            const exists = await DriveFileStorage.fileExists('ladderCR.csv')

            expect(exists).toBe(false)
        })
    })
})