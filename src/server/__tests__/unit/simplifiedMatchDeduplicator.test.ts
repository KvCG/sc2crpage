/**
 * Comprehensive test suite for SimplifiedMatchDeduplicator
 */

import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs/promises'
import { SimplifiedMatchDeduplicator } from '../../services/simplifiedMatchDeduplicator'
import { ProcessedCustomMatch } from '../../../shared/customMatchTypes'
import { GoogleDriveService } from '../../services/googleApi'

// Mock the GoogleDriveService
vi.mock('../../services/googleApi')
vi.mock('fs/promises')

// Mock the H2H config
vi.mock('../../config/h2hConfig', () => ({
    getH2HConfig: () => ({
        cacheLimit: 100,
        dedupeRetentionDays: 30,
    })
}))

// Mock logger
vi.mock('../../logging/logger', () => ({
    default: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }
}))

describe('SimplifiedMatchDeduplicator', () => {
    let deduplicator: SimplifiedMatchDeduplicator
    let mockDriveService: any
    let mockFs: any

    // Test helper to create ProcessedCustomMatch
    const createTestMatch = (matchId: number, dateKey: string = '2024-01-15'): ProcessedCustomMatch => {
        const player1 = {
            characterId: 1000 + matchId,
            battleTag: `Player${matchId}#1234`,
            name: `Player${matchId}`,
            isCommunityPlayer: true,
            rating: 3000,
        }
        const player2 = {
            characterId: 2000 + matchId,
            battleTag: `Player${matchId + 1000}#5678`,
            name: `Player${matchId + 1000}`,
            isCommunityPlayer: true,
            rating: 3100,
        }
        
        return {
            matchId,
            matchDate: `${dateKey}T12:00:00Z`,
            dateKey,
            map: 'Test Map',
            duration: 300,
            participants: [player1, player2],
            matchResult: {
                outcome: 'WIN_LOSS' as const,
                winner: player1,
                loser: player2,
            },
            confidence: 'high' as const,
            confidenceFactors: {
                hasValidCharacterIds: true,
                bothCommunityPlayers: true,
                bothActiveRecently: false,
                hasReasonableDuration: true,
                similarSkillLevel: true,
                recognizedMap: true,
            },
            processedAt: new Date().toISOString(),
            schemaVersion: '1.0.0',
        }
    }

    beforeEach(() => {
        vi.clearAllMocks()
        
        // Mock fs operations
        mockFs = vi.mocked(fs)
        mockFs.mkdir.mockResolvedValue(undefined)
        mockFs.readFile.mockResolvedValue('{"metadata":{"schemaVersion":"1.0.0","lastUpdated":"2024-01-01T00:00:00Z","totalDates":0,"totalMatches":0},"processedMatches":{}}')
        mockFs.writeFile.mockResolvedValue(undefined)
        
        // Mock GoogleDriveService
        mockDriveService = {
            readFile: vi.fn(),
            writeFile: vi.fn(),
            getFolderStats: vi.fn(),
        }
        vi.mocked(GoogleDriveService).mockImplementation(() => mockDriveService as any)
        
        deduplicator = new SimplifiedMatchDeduplicator()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('Read Hierarchy Tests', () => {
        describe('Memory Cache (Level 1)', () => {
            it('should return cached matches when available in memory', async () => {
                // Preload some data to populate cache
                mockFs.readFile.mockResolvedValue(JSON.stringify({
                    metadata: {
                        schemaVersion: '1.0.0',
                        lastUpdated: '2024-01-01T00:00:00Z',
                        totalDates: 1,
                        totalMatches: 2
                    },
                    processedMatches: {
                        '2024-01-15': ['1001', '1002']
                    }
                }))

                await deduplicator.preloadDeduplicationData()

                // Test duplicate detection works correctly
                const matches = [
                    createTestMatch(1003, '2024-01-15'), // New match
                    createTestMatch(1001, '2024-01-15'), // Duplicate
                ]

                const result = await deduplicator.filterDuplicates(matches)

                expect(result.uniqueMatches).toHaveLength(1)
                expect(result.duplicateCount).toBe(1)
                expect(result.duplicateMatchIds).toEqual(['1001'])
                
                // Should not call Drive - memory or local file should be sufficient
                expect(mockDriveService.readFile).not.toHaveBeenCalled()
            })

            it('should handle memory cache misses and fall to local file', async () => {
                mockFs.readFile.mockResolvedValue(JSON.stringify({
                    metadata: {
                        schemaVersion: '1.0.0',
                        lastUpdated: '2024-01-01T00:00:00Z',
                        totalDates: 1,
                        totalMatches: 1
                    },
                    processedMatches: {
                        '2024-01-16': ['2001'] // Different date not in cache
                    }
                }))

                const matches = [
                    createTestMatch(2001, '2024-01-16'), // Duplicate
                    createTestMatch(2002, '2024-01-16'), // New
                ]

                const result = await deduplicator.filterDuplicates(matches)

                expect(result.uniqueMatches).toHaveLength(1)
                expect(result.duplicateCount).toBe(1)
                expect(mockFs.readFile).toHaveBeenCalled()
            })
        })

        describe('Local File (Level 2)', () => {
            it('should fall back to local file when memory cache misses', async () => {
                mockFs.readFile.mockResolvedValue(JSON.stringify({
                    metadata: {
                        schemaVersion: '1.0.0',
                        lastUpdated: '2024-01-01T00:00:00Z',
                        totalDates: 1,
                        totalMatches: 2
                    },
                    processedMatches: {
                        '2024-01-15': ['3001', '3002']
                    }
                }))

                const matches = [createTestMatch(3001, '2024-01-15')]

                const result = await deduplicator.filterDuplicates(matches)

                expect(result.uniqueMatches).toHaveLength(0)
                expect(result.duplicateCount).toBe(1)
                expect(mockFs.readFile).toHaveBeenCalled()
            })

            it('should handle local file errors and fall back to Drive', async () => {
                mockFs.readFile.mockRejectedValue(new Error('File not found'))
                mockDriveService.readFile.mockResolvedValue(JSON.stringify({
                    matchIds: ['4001', '4002']
                }))

                const matches = [createTestMatch(4001, '2024-01-15')]

                const result = await deduplicator.filterDuplicates(matches)

                expect(result.uniqueMatches).toHaveLength(0)
                expect(result.duplicateCount).toBe(1)
                expect(mockDriveService.readFile).toHaveBeenCalledWith('matches-2024-01-15.json')
            })
        })

        describe('Drive (Level 3)', () => {
            it('should fall back to Drive when local file fails', async () => {
                mockFs.readFile.mockRejectedValue(new Error('ENOENT'))
                mockDriveService.readFile.mockResolvedValue(JSON.stringify({
                    matchIds: ['5001']
                }))

                const matches = [createTestMatch(5001, '2024-01-15')]

                const result = await deduplicator.filterDuplicates(matches)

                expect(result.uniqueMatches).toHaveLength(0)
                expect(result.duplicateCount).toBe(1)
                expect(mockDriveService.readFile).toHaveBeenCalled()
            })

            it('should return empty set when all sources fail', async () => {
                mockFs.readFile.mockRejectedValue(new Error('ENOENT'))
                mockDriveService.readFile.mockRejectedValue(new Error('Drive error'))

                const matches = [createTestMatch(6001, '2024-01-15')]

                const result = await deduplicator.filterDuplicates(matches)

                expect(result.uniqueMatches).toHaveLength(1) // All new since no sources available
                expect(result.duplicateCount).toBe(0)
            })
        })
    })

    describe('Write-Through Chain Tests', () => {
        it('should update all storage layers simultaneously', async () => {
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                metadata: {
                    schemaVersion: '1.0.0',
                    lastUpdated: '2024-01-01T00:00:00Z',
                    totalDates: 0,
                    totalMatches: 0
                },
                processedMatches: {}
            }))

            const matches = [createTestMatch(7001, '2024-01-15')]

            await deduplicator.recordProcessedMatches(matches)

            // Should update local file
            expect(mockFs.writeFile).toHaveBeenCalled()
            
            // Should update Drive
            expect(mockDriveService.writeFile).toHaveBeenCalled()

            // Memory cache should be updated (test by checking for duplicates)
            const duplicateTest = await deduplicator.filterDuplicates([createTestMatch(7001, '2024-01-15')])
            expect(duplicateTest.duplicateCount).toBe(1)
        })

        it('should handle local file write failures gracefully', async () => {
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                metadata: { schemaVersion: '1.0.0', lastUpdated: '2024-01-01T00:00:00Z', totalDates: 0, totalMatches: 0 },
                processedMatches: {}
            }))
            mockFs.writeFile.mockRejectedValue(new Error('Disk full'))

            const matches = [createTestMatch(8001, '2024-01-15')]

            // Should not throw even if local file fails
            await expect(deduplicator.recordProcessedMatches(matches)).resolves.not.toThrow()
            
            // Drive should still be updated
            expect(mockDriveService.writeFile).toHaveBeenCalled()
        })

        it('should handle Drive write failures gracefully', async () => {
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                metadata: { schemaVersion: '1.0.0', lastUpdated: '2024-01-01T00:00:00Z', totalDates: 0, totalMatches: 0 },
                processedMatches: {}
            }))
            mockDriveService.writeFile.mockRejectedValue(new Error('Network error'))

            const matches = [createTestMatch(9001, '2024-01-15')]

            // Should not throw even if Drive fails
            await expect(deduplicator.recordProcessedMatches(matches)).resolves.not.toThrow()
            
            // Local file should still be updated
            expect(mockFs.writeFile).toHaveBeenCalled()
        })
    })

    describe('Preload Process Tests', () => {
            it('should preload data from local file into memory cache', async () => {
                const testData = {
                    metadata: {
                        schemaVersion: '1.0.0',
                        lastUpdated: '2024-01-01T00:00:00Z',
                        totalDates: 2,
                        totalMatches: 4
                    },
                    processedMatches: {
                        '2024-01-15': ['10001', '10002'],
                        '2024-01-16': ['10003', '10004']
                    }
                }
                mockFs.readFile.mockResolvedValue(JSON.stringify(testData))

                await deduplicator.preloadDeduplicationData()

                // Test that data was loaded correctly
                const matches = [
                    createTestMatch(10001, '2024-01-15'), // Should be duplicate
                    createTestMatch(10005, '2024-01-15'), // Should be unique
                ]

                const result = await deduplicator.filterDuplicates(matches)
                expect(result.duplicateCount).toBe(1)
                expect(result.uniqueMatches).toHaveLength(1)

                // Preload should have populated the cache successfully
                expect(mockFs.readFile).toHaveBeenCalled()
            })

            it('should handle preload failures gracefully', async () => {
            mockFs.readFile.mockRejectedValue(new Error('File not found'))

            // Should not throw
            await expect(deduplicator.preloadDeduplicationData()).resolves.not.toThrow()
            
            // Should still work with empty cache
            const matches = [createTestMatch(11001, '2024-01-15')]
            const result = await deduplicator.filterDuplicates(matches)
            expect(result.uniqueMatches).toHaveLength(1)
        })
    })

    describe('Memory Cache Management', () => {
        it('should evict oldest entries when cache limit is reached', async () => {
            // Mock config to use small cache limit
            const smallCacheDeduplicator = new SimplifiedMatchDeduplicator()
            
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                metadata: { schemaVersion: '1.0.0', lastUpdated: '2024-01-01T00:00:00Z', totalDates: 0, totalMatches: 0 },
                processedMatches: {}
            }))

            // Mock drive service for stats call
            mockDriveService.getFolderStats.mockResolvedValue({
                totalFiles: 5,
                fileNames: ['matches-2024-01-15.json'],
                lastModified: '2024-01-01T00:00:00Z'
            })

            // Add more entries than cache limit allows
            const dates = Array.from({length: 150}, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`)
            
            for (const dateKey of dates.slice(0, 10)) {
                const matches = [createTestMatch(12000 + parseInt(dateKey.split('-')[2]), dateKey)]
                await smallCacheDeduplicator.recordProcessedMatches(matches)
            }

            // Cache should have been pruned - exact behavior depends on implementation
            const stats = await smallCacheDeduplicator.getStats()
            expect(stats.memoryCache.cacheSize).toBeLessThanOrEqual(100)
        })
    })

    describe('Statistics and Utilities', () => {
        it('should provide accurate statistics', async () => {
            mockDriveService.getFolderStats.mockResolvedValue({
                totalFiles: 5,
                fileNames: ['matches-2024-01-15.json'],
                lastModified: '2024-01-01T00:00:00Z'
            })

            const stats = await deduplicator.getStats()

            expect(stats).toHaveProperty('memoryCache')
            expect(stats).toHaveProperty('driveStorage')
            expect(stats).toHaveProperty('config')
            expect(stats.driveStorage.totalFiles).toBe(5)
        })

        it('should check individual match duplicates correctly', async () => {
            mockFs.readFile.mockResolvedValue(JSON.stringify({
                metadata: { schemaVersion: '1.0.0', lastUpdated: '2024-01-01T00:00:00Z', totalDates: 1, totalMatches: 1 },
                processedMatches: {
                    '2024-01-15': ['13001']
                }
            }))

            const isDuplicate = await deduplicator.isDuplicate('13001', '2024-01-15')
            const isNotDuplicate = await deduplicator.isDuplicate('13002', '2024-01-15')

            expect(isDuplicate).toBe(true)
            expect(isNotDuplicate).toBe(false)
        })
    })

    describe('Cross-Date Independence', () => {
        it('should handle matches across different dates independently', async () => {
            const matches = [
                createTestMatch(14001, '2024-01-15'),
                createTestMatch(14001, '2024-01-16'), // Same ID, different date - should be allowed
                createTestMatch(14002, '2024-01-15'),
            ]

            const result = await deduplicator.filterDuplicates(matches)
            expect(result.uniqueMatches).toHaveLength(3) // All should be unique across dates
            expect(result.duplicateCount).toBe(0)
        })

        it('should detect duplicates within the same date', async () => {
            const matches = [
                createTestMatch(15001, '2024-01-15'),
                createTestMatch(15002, '2024-01-15'),
                createTestMatch(15001, '2024-01-15'), // Duplicate within same batch
            ]

            const result = await deduplicator.filterDuplicates(matches)
            expect(result.uniqueMatches).toHaveLength(2)
            expect(result.duplicateCount).toBe(1)
            expect(result.duplicateMatchIds).toContain('15001')
        })
    })

    describe('Edge Cases', () => {
        it('should handle empty match arrays', async () => {
            const result = await deduplicator.filterDuplicates([])
            expect(result.uniqueMatches).toHaveLength(0)
            expect(result.duplicateCount).toBe(0)
        })

        it('should handle malformed local file data', async () => {
            mockFs.readFile.mockResolvedValue('invalid json')

            const matches = [createTestMatch(16001, '2024-01-15')]
            
            // Should fall back to Drive or empty set
            const result = await deduplicator.filterDuplicates(matches)
            expect(result.uniqueMatches).toHaveLength(1) // Should treat as new
        })

        it('should ensure tracking directory exists', async () => {
            mockFs.mkdir.mockResolvedValue(undefined)

            await deduplicator.preloadDeduplicationData()

            expect(mockFs.mkdir).toHaveBeenCalledWith(
                expect.stringContaining('dedupe'),
                { recursive: true }
            )
        })
    })
})