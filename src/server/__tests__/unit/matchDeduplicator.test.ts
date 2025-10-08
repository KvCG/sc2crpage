/**
 * Unit Tests for Match De-duplication
 * 
 * Tests the match de-duplication utilities with file-based tracking.
 * Uses temporary directories for isolated testing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMatchDeduplicator } from '../../services/matchDeduplicator'
import { ProcessedCustomMatch } from '../../../shared/customMatchTypes'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('MatchDeduplicator', () => {
    let tempDir: string
    let deduplicator: any

    beforeEach(async () => {
        // Create temporary directory for test files
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dedupe-test-'))
        
        deduplicator = createMatchDeduplicator({
            trackingDir: tempDir,
            retentionHours: 1,
            cacheLimit: 100
        })
    })

    afterEach(async () => {
        // Clean up temporary files
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch (error) {
            // Ignore cleanup errors
        }
    })

    describe('duplicate detection', () => {
        it('should detect unique matches on first run', async () => {
            const matches = [
                createTestMatch(1001, '2024-01-15'),
                createTestMatch(1002, '2024-01-15'),
                createTestMatch(1003, '2024-01-16')
            ]

            const result = await deduplicator.filterDuplicates(matches)

            expect(result.uniqueMatches).toHaveLength(3)
            expect(result.duplicateCount).toBe(0)
            expect(result.duplicateMatchIds).toEqual([])
        })

        it('should detect duplicates on subsequent runs', async () => {
            const firstBatch = [
                createTestMatch(2001, '2024-01-15'),
                createTestMatch(2002, '2024-01-15')
            ]

            const secondBatch = [
                createTestMatch(2001, '2024-01-15'), // Duplicate
                createTestMatch(2003, '2024-01-15')  // New
            ]

            // Process first batch
            await deduplicator.filterDuplicates(firstBatch)
            await deduplicator.recordProcessedMatches(firstBatch)

            // Process second batch
            const result = await deduplicator.filterDuplicates(secondBatch)

            expect(result.uniqueMatches).toHaveLength(1)
            expect(result.duplicateCount).toBe(1)
            expect(result.duplicateMatchIds).toContain('2001')
        })

        it('should handle matches across different dates independently', async () => {
            const matches = [
                createTestMatch(3001, '2024-01-15'),
                createTestMatch(3001, '2024-01-16') // Same ID, different date
            ]

            const result = await deduplicator.filterDuplicates(matches)

            expect(result.uniqueMatches).toHaveLength(2)
            expect(result.duplicateCount).toBe(0)
        })
    })

    describe('individual match checking', () => {
        it('should correctly identify new matches', async () => {
            const isDupe = await deduplicator.isDuplicate('4001', '2024-01-15')
            expect(isDupe).toBe(false)
        })

        it('should correctly identify duplicates after recording', async () => {
            const matches = [createTestMatch(4001, '2024-01-15')]
            await deduplicator.recordProcessedMatches(matches)

            const isDupe = await deduplicator.isDuplicate('4001', '2024-01-15')
            expect(isDupe).toBe(true)
        })
    })

    describe('statistics', () => {
        it('should provide accurate stats', async () => {
            const matches = [
                createTestMatch(5001, '2024-01-15'),
                createTestMatch(5002, '2024-01-16')
            ]
            await deduplicator.recordProcessedMatches(matches)

            const stats = await deduplicator.getStats()

            expect(stats.trackingDir).toBe(tempDir)
            expect(stats.cacheSize).toBeGreaterThanOrEqual(0)
        })
    })
})

// ========================================================================
// Test Helper Functions
// ========================================================================

/**
 * Create a test match with minimal required fields
 */
function createTestMatch(matchId: number, date: string): ProcessedCustomMatch {
    return {
        matchId,
        matchDate: `${date}T14:30:00Z`,
        dateKey: date,
        map: 'Test Map',
        duration: 300,
        participants: [
            {
                characterId: 123,
                battleTag: 'Player1#1234',
                name: 'Player1',
                isCommunityPlayer: true
            },
            {
                characterId: 456,
                battleTag: 'Player2#5678',
                name: 'Player2',
                isCommunityPlayer: true
            }
        ],
        confidence: 'medium',
        confidenceFactors: {
            hasValidCharacterIds: true,
            bothCommunityPlayers: true,
            bothActiveRecently: false,
            hasReasonableDuration: true,
            similarSkillLevel: false,
            recognizedMap: false
        },
        processedAt: new Date().toISOString(),
        schemaVersion: '1.0.0'
    }
}