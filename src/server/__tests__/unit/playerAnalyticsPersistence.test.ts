import { describe, test, expect, beforeEach, vi } from 'vitest'
import { google } from 'googleapis'
import { DateTime } from 'luxon'
import { PlayerAnalyticsPersistence } from '../../services/playerAnalyticsPersistence'
import logger from '../../logging/logger'

// Mock external dependencies
vi.mock('googleapis')
vi.mock('../../logging/logger', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}))

describe('PlayerAnalyticsPersistence', () => {
    const mockAuth = {
        getClient: vi.fn()
    }
    
    const mockDrive = {
        files: {
            list: vi.fn(),
            create: vi.fn(),
            get: vi.fn(),
            delete: vi.fn()
        }
    }

    const mockSnapshot = {
        createdAt: '2025-01-16T10:30:00Z',
        expiry: Date.now() + 86400000, // 24 hours from now
        data: [
            { id: 1, name: 'Player1', mmr: 1500, rank: 'Gold' },
            { id: 2, name: 'Player2', mmr: 2000, rank: 'Diamond' }
        ]
    }

    beforeEach(() => {
        vi.clearAllMocks()
        
        // Reset static properties
        ;(PlayerAnalyticsPersistence as any).auth = null
        ;(PlayerAnalyticsPersistence as any).folderIds = {}
        
        // Setup Google API mocks
        ;(google.auth.GoogleAuth as any).mockImplementation(() => mockAuth)
        ;(google.drive as any).mockImplementation(() => mockDrive)
        ;(google.options as any) = vi.fn()

        // Setup environment
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
            type: 'service_account',
            project_id: 'test-project'
        })
    })

    describe('Authentication', () => {
        test('initializes Google Drive authentication successfully', async () => {
            mockAuth.getClient.mockResolvedValue({ authenticated: true })
            
            // Call private method through reflection
            const result = await (PlayerAnalyticsPersistence as any).authenticate()
            
            expect(result).toBeDefined()
            expect(google.auth.GoogleAuth).toHaveBeenCalledWith({
                credentials: expect.any(Object),
                scopes: ['https://www.googleapis.com/auth/drive']
            })
            expect(logger.info).toHaveBeenCalledWith(
                { feature: 'persistence' },
                'Google Drive authentication initialized'
            )
        })

        test('handles authentication failure', async () => {
            mockAuth.getClient.mockRejectedValue(new Error('Auth failed'))
            
            await expect((PlayerAnalyticsPersistence as any).authenticate())
                .rejects.toThrow('Auth failed')
            
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    feature: 'persistence'
                }),
                'Failed to authenticate with Google Drive'
            )
        })

        test('reuses existing authentication', async () => {
            // Set up existing auth
            ;(PlayerAnalyticsPersistence as any).auth = { existing: true }
            
            const result = await (PlayerAnalyticsPersistence as any).authenticate()
            
            expect(result).toEqual({ existing: true })
            expect(mockAuth.getClient).not.toHaveBeenCalled()
        })
    })

    describe('Folder Management', () => {
        beforeEach(() => {
            mockAuth.getClient.mockResolvedValue({ authenticated: true })
        })

        test('creates new folder when not exists', async () => {
            mockDrive.files.list.mockResolvedValue({
                data: { files: [] }
            })
            
            mockDrive.files.create.mockResolvedValue({
                data: { id: 'folder123' }
            })
            
            const folderId = await (PlayerAnalyticsPersistence as any).getOrCreateFolder('TestFolder')
            
            expect(folderId).toBe('folder123')
            expect(mockDrive.files.list).toHaveBeenCalledWith({
                q: "name='TestFolder' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields: 'files(id, name)'
            })
            expect(mockDrive.files.create).toHaveBeenCalledWith({
                requestBody: {
                    name: 'TestFolder',
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            })
        })

        test('returns existing folder ID when folder exists', async () => {
            mockDrive.files.list.mockResolvedValue({
                data: {
                    files: [{ id: 'existing123', name: 'TestFolder' }]
                }
            })
            
            const folderId = await (PlayerAnalyticsPersistence as any).getOrCreateFolder('TestFolder')
            
            expect(folderId).toBe('existing123')
            expect(mockDrive.files.create).not.toHaveBeenCalled()
        })

        test('creates folder with parent ID', async () => {
            mockDrive.files.list.mockResolvedValue({
                data: { files: [] }
            })
            
            mockDrive.files.create.mockResolvedValue({
                data: { id: 'subfolder123' }
            })
            
            await (PlayerAnalyticsPersistence as any).getOrCreateFolder('SubFolder', 'parent123')
            
            expect(mockDrive.files.list).toHaveBeenCalledWith({
                q: "name='SubFolder' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'parent123' in parents",
                fields: 'files(id, name)'
            })
            expect(mockDrive.files.create).toHaveBeenCalledWith({
                requestBody: {
                    name: 'SubFolder',
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: ['parent123']
                },
                fields: 'id'
            })
        })

        test('caches folder IDs to avoid repeated API calls', async () => {
            mockDrive.files.list.mockResolvedValue({
                data: {
                    files: [{ id: 'cached123', name: 'CachedFolder' }]
                }
            })
            
            // First call
            const folderId1 = await (PlayerAnalyticsPersistence as any).getOrCreateFolder('CachedFolder')
            // Second call
            const folderId2 = await (PlayerAnalyticsPersistence as any).getOrCreateFolder('CachedFolder')
            
            expect(folderId1).toBe('cached123')
            expect(folderId2).toBe('cached123')
            expect(mockDrive.files.list).toHaveBeenCalledTimes(1)
        })
    })

    describe('Snapshot Backup', () => {
        beforeEach(() => {
            mockAuth.getClient.mockResolvedValue({ authenticated: true })
            
            // Mock folder structure creation
            mockDrive.files.list
                .mockResolvedValueOnce({ data: { files: [] } }) // PlayerAnalytics folder
                .mockResolvedValueOnce({ data: { files: [] } }) // Snapshots folder
                .mockResolvedValueOnce({ data: { files: [] } }) // Year folder
                .mockResolvedValueOnce({ data: { files: [] } }) // Month folder
            
            mockDrive.files.create
                .mockResolvedValueOnce({ data: { id: 'analytics-folder' } })
                .mockResolvedValueOnce({ data: { id: 'snapshots-folder' } })
                .mockResolvedValueOnce({ data: { id: 'year-folder' } })
                .mockResolvedValueOnce({ data: { id: 'month-folder' } })
                .mockResolvedValueOnce({
                    data: {
                        id: 'backup-file-123',
                        name: 'snapshot-2025-01-16-10-30-00.json',
                        size: '1024'
                    }
                })
        })

        test('successfully backs up snapshot to Google Drive', async () => {
            const fileId = await PlayerAnalyticsPersistence.backupSnapshot(mockSnapshot)
            
            expect(fileId).toBe('backup-file-123')
            
            // Check that the file creation was called with the correct structure
            const createCall = mockDrive.files.create.mock.calls.find(
                call => call[0].media?.mimeType === 'application/json'
            )
            
            expect(createCall).toBeDefined()
            expect(createCall![0].requestBody.parents).toEqual(['month-folder'])
            expect(createCall![0].requestBody.name).toMatch(/snapshot-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json/)
            expect(createCall![0].media.body).toContain('"backupVersion": "1.0"')
            
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    fileId: 'backup-file-123',
                    playerCount: 2,
                    feature: 'persistence'
                }),
                'Snapshot backed up to Google Drive'
            )
        })

        test('handles backup failure gracefully', async () => {
            // Reset all mocks and make the final create call fail
            vi.clearAllMocks()
            mockAuth.getClient.mockResolvedValue({ authenticated: true })
            
            // Setup folder creation to succeed
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } })
            mockDrive.files.create
                .mockResolvedValueOnce({ data: { id: 'analytics-folder' } })
                .mockResolvedValueOnce({ data: { id: 'snapshots-folder' } })
                .mockResolvedValueOnce({ data: { id: 'year-folder' } })
                .mockResolvedValueOnce({ data: { id: 'month-folder' } })
                .mockRejectedValueOnce(new Error('Drive API error')) // File creation fails
            
            const fileId = await PlayerAnalyticsPersistence.backupSnapshot(mockSnapshot)
            
            expect(fileId).toBeNull()
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    feature: 'persistence'
                }),
                'Failed to backup snapshot to Google Drive'
            )
        })

        test('creates proper backup data structure', async () => {
            // Reset mocks for clean test
            vi.clearAllMocks()
            mockAuth.getClient.mockResolvedValue({ authenticated: true })
            
            // Mock folder structure creation
            mockDrive.files.list.mockResolvedValue({ data: { files: [] } })
            mockDrive.files.create
                .mockResolvedValueOnce({ data: { id: 'analytics-folder' } })
                .mockResolvedValueOnce({ data: { id: 'snapshots-folder' } })
                .mockResolvedValueOnce({ data: { id: 'year-folder' } })
                .mockResolvedValueOnce({ data: { id: 'month-folder' } })
                .mockResolvedValueOnce({ data: { id: 'backup-file-123' } })
                
            await PlayerAnalyticsPersistence.backupSnapshot(mockSnapshot)
            
            const createCall = mockDrive.files.create.mock.calls.find(
                call => call[0].media?.mimeType === 'application/json'
            )
            
            expect(createCall).toBeDefined()
            const backupData = JSON.parse(createCall![0].media.body)
            
            expect(backupData).toEqual({
                metadata: {
                    type: 'snapshot',
                    timestamp: '2025-01-16T10:30:00Z',
                    playerCount: 2,
                    dataSize: expect.any(Number),
                    backupVersion: '1.0'
                },
                snapshot: mockSnapshot
            })
        })
    })

    describe('Backup Listing', () => {
        beforeEach(() => {
            mockAuth.getClient.mockResolvedValue({ authenticated: true })
        })

        test('lists available backups with proper filtering', async () => {
            const now = DateTime.now()
            const recentTime = now.minus({ hours: 2 }).toISO()
            const oldTime = now.minus({ days: 2 }).toISO()
            
            // Mock folder creation and file listing
            mockDrive.files.list
                .mockResolvedValueOnce({ data: { files: [{ id: 'analytics-folder' }] } }) // Root folder
                .mockResolvedValueOnce({
                    data: {
                        files: [
                            {
                                id: 'recent-backup',
                                name: 'snapshot-2025-01-16-08-00-00.json',
                                createdTime: recentTime,
                                size: '1024'
                            },
                            {
                                id: 'old-backup',
                                name: 'snapshot-2025-01-14-08-00-00.json',
                                createdTime: oldTime,
                                size: '2048'
                            },
                            {
                                id: 'invalid-backup',
                                name: 'invalid-file.json',
                                createdTime: recentTime,
                                size: '512'
                            }
                        ]
                    }
                })
            
            const backups = await PlayerAnalyticsPersistence.listBackups({ maxAge: 24 })
            
            expect(backups).toHaveLength(1)
            expect(backups[0]).toEqual({
                fileId: 'recent-backup',
                fileName: 'snapshot-2025-01-16-08-00-00.json',
                timestamp: expect.any(DateTime),
                metadata: {
                    type: 'snapshot',
                    timestamp: expect.any(String),
                    playerCount: 0,
                    dataSize: 1024
                }
            })
        })

        test('sorts backups by timestamp descending', async () => {
            const now = DateTime.now()
            
            mockDrive.files.list
                .mockResolvedValueOnce({ data: { files: [{ id: 'analytics-folder' }] } })
                .mockResolvedValueOnce({
                    data: {
                        files: [
                            {
                                id: 'older-backup',
                                name: 'snapshot-2025-01-16-08-00-00.json',
                                createdTime: now.minus({ hours: 4 }).toISO(),
                                size: '1024'
                            },
                            {
                                id: 'newer-backup',
                                name: 'snapshot-2025-01-16-10-00-00.json',
                                createdTime: now.minus({ hours: 2 }).toISO(),
                                size: '2048'
                            }
                        ]
                    }
                })
            
            const backups = await PlayerAnalyticsPersistence.listBackups({ maxAge: 24 })
            
            expect(backups).toHaveLength(2)
            expect(backups[0].fileId).toBe('newer-backup')
            expect(backups[1].fileId).toBe('older-backup')
        })

        test('handles listing errors gracefully', async () => {
            mockDrive.files.list
                .mockResolvedValueOnce({ data: { files: [{ id: 'analytics-folder' }] } })
                .mockRejectedValueOnce(new Error('List API error'))
            
            const backups = await PlayerAnalyticsPersistence.listBackups()
            
            expect(backups).toEqual([])
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    feature: 'persistence'
                }),
                'Failed to list backups'
            )
        })
    })

    describe('Snapshot Restoration', () => {
        beforeEach(() => {
            mockAuth.getClient.mockResolvedValue({ authenticated: true })
        })

        test('restores specific backup by file ID', async () => {
            const backupData = {
                metadata: {
                    type: 'snapshot',
                    timestamp: '2025-01-16T10:30:00Z',
                    playerCount: 2
                },
                snapshot: mockSnapshot
            }
            
            mockDrive.files.get.mockResolvedValue({
                data: JSON.stringify(backupData)
            })
            
            const restored = await PlayerAnalyticsPersistence.restoreSnapshot('specific-file-123')
            
            expect(restored).toEqual(mockSnapshot)
            expect(mockDrive.files.get).toHaveBeenCalledWith({
                fileId: 'specific-file-123',
                alt: 'media'
            })
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    fileId: 'specific-file-123',
                    timestamp: '2025-01-16T10:30:00Z',
                    playerCount: 2,
                    feature: 'persistence'
                }),
                'Snapshot restored from Google Drive backup'
            )
        })

        test('restores most recent backup when no file ID provided', async () => {
            // Mock the listBackups call
            mockDrive.files.list
                .mockResolvedValueOnce({ data: { files: [{ id: 'analytics-folder' }] } })
                .mockResolvedValueOnce({
                    data: {
                        files: [{
                            id: 'recent-backup',
                            name: 'snapshot-2025-01-16-10-00-00.json',
                            createdTime: DateTime.now().minus({ hours: 1 }).toISO(),
                            size: '1024'
                        }]
                    }
                })
            
            const backupData = {
                metadata: {
                    type: 'snapshot',
                    timestamp: '2025-01-16T10:00:00Z',
                    playerCount: 1
                },
                snapshot: { ...mockSnapshot, data: [mockSnapshot.data[0]] }
            }
            
            mockDrive.files.get.mockResolvedValue({
                data: JSON.stringify(backupData)
            })
            
            const restored = await PlayerAnalyticsPersistence.restoreSnapshot()
            
            expect(restored).toEqual(backupData.snapshot)
            expect(mockDrive.files.get).toHaveBeenCalledWith({
                fileId: 'recent-backup',
                alt: 'media'
            })
        })

        test('returns null when no backups available', async () => {
            // Mock empty backup list
            mockDrive.files.list
                .mockResolvedValueOnce({ data: { files: [{ id: 'analytics-folder' }] } })
                .mockResolvedValueOnce({ data: { files: [] } })
            
            const restored = await PlayerAnalyticsPersistence.restoreSnapshot()
            
            expect(restored).toBeNull()
            expect(logger.warn).toHaveBeenCalledWith(
                { feature: 'persistence' },
                'No backups available for restore'
            )
        })

        test('handles invalid backup file format', async () => {
            mockDrive.files.get.mockResolvedValue({
                data: JSON.stringify({ invalid: 'format' })
            })
            
            const restored = await PlayerAnalyticsPersistence.restoreSnapshot('invalid-file')
            
            expect(restored).toBeNull()
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    fileId: 'invalid-file',
                    feature: 'persistence'
                }),
                'Failed to restore snapshot from backup'
            )
        })
    })

    describe('Cleanup Operations', () => {
        beforeEach(() => {
            mockAuth.getClient.mockResolvedValue({ authenticated: true })
        })

        test('deletes files older than retention period', async () => {
            const cutoffDate = DateTime.now().minus({ days: 90 })
            
            mockDrive.files.list.mockResolvedValueOnce({
                data: {
                    files: [
                        {
                            id: 'old-file-1',
                            name: 'snapshot-2024-10-15-10-00-00.json',
                            createdTime: cutoffDate.minus({ days: 5 }).toISO()
                        },
                        {
                            id: 'old-file-2',
                            name: 'snapshot-2024-10-16-10-00-00.json',
                            createdTime: cutoffDate.minus({ days: 3 }).toISO()
                        }
                    ]
                }
            })
            
            mockDrive.files.delete.mockResolvedValue({})
            
            const deletedCount = await PlayerAnalyticsPersistence.cleanupOldBackups()
            
            expect(deletedCount).toBe(2)
            expect(mockDrive.files.delete).toHaveBeenCalledWith({ fileId: 'old-file-1' })
            expect(mockDrive.files.delete).toHaveBeenCalledWith({ fileId: 'old-file-2' })
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    deletedCount: 2,
                    retentionDays: 90,
                    feature: 'persistence'
                }),
                'Completed cleanup of old backups'
            )
        })

        test('handles individual file deletion failures gracefully', async () => {
            const cutoffDate = DateTime.now().minus({ days: 90 })
            
            mockDrive.files.list.mockResolvedValueOnce({
                data: {
                    files: [
                        {
                            id: 'deletable-file',
                            name: 'snapshot-old.json',
                            createdTime: cutoffDate.minus({ days: 5 }).toISO()
                        },
                        {
                            id: 'protected-file',
                            name: 'snapshot-protected.json',
                            createdTime: cutoffDate.minus({ days: 3 }).toISO()
                        }
                    ]
                }
            })
            
            mockDrive.files.delete
                .mockResolvedValueOnce({}) // First delete succeeds
                .mockRejectedValueOnce(new Error('Protected file')) // Second delete fails
            
            const deletedCount = await PlayerAnalyticsPersistence.cleanupOldBackups()
            
            expect(deletedCount).toBe(1)
            expect(logger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    fileId: 'protected-file',
                    feature: 'persistence'
                }),
                'Failed to delete old backup file'
            )
        })
    })

    describe('Status Information', () => {
        test('returns connected status with folder and backup information', async () => {
            mockAuth.getClient.mockResolvedValue({ authenticated: true })
            
            // Mock recent backups (last week)
            mockDrive.files.list.mockResolvedValueOnce({
                data: {
                    files: [{
                        id: 'recent-backup',
                        name: 'snapshot-2025-01-16-10-00-00.json',
                        createdTime: DateTime.now().minus({ hours: 2 }).toISO(),
                        size: '1024'
                    }]
                }
            })
            
            // Mock all backups (last 90 days)
            .mockResolvedValueOnce({
                data: {
                    files: [
                        {
                            id: 'recent-backup',
                            name: 'snapshot-2025-01-16-10-00-00.json',
                            createdTime: DateTime.now().minus({ hours: 2 }).toISO(),
                            size: '1024'
                        },
                        {
                            id: 'older-backup',
                            name: 'snapshot-2025-01-15-10-00-00.json',
                            createdTime: DateTime.now().minus({ days: 10 }).toISO(),
                            size: '2048'
                        }
                    ]
                }
            })
            
            const status = await PlayerAnalyticsPersistence.getStatus()
            
            expect(status).toEqual({
                connected: true,
                folderStructure: expect.any(Object),
                recentBackups: 1,
                totalBackups: 2
            })
        })

        test('returns disconnected status on authentication failure', async () => {
            mockAuth.getClient.mockRejectedValue(new Error('Auth failed'))
            
            const status = await PlayerAnalyticsPersistence.getStatus()
            
            expect(status).toEqual({
                connected: false,
                folderStructure: {},
                recentBackups: 0,
                totalBackups: 0
            })
            
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.any(Error),
                    feature: 'persistence'
                }),
                'Failed to get persistence status'
            )
        })
    })
})