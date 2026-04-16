import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Hoisted mocks — must be above all imports
// ============================================================================

const hoisted = vi.hoisted(() => ({
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    mockSupabaseFrom: vi.fn(),
    mockGetCommunityPlayer: vi.fn(),
}))

vi.mock('../../../logging/logger', () => ({ default: hoisted.mockLogger }))

vi.mock('../../../db/supabaseClient', () => ({
    default: { from: hoisted.mockSupabaseFrom },
}))

vi.mock('../../../services/communityDataService', () => ({
    CommunityDataService: {
        getInstance: vi.fn(() => ({
            getCommunityPlayer: hoisted.mockGetCommunityPlayer,
        })),
    },
}))

// Import module under test AFTER mocks
import {
    findMatchByExternalId,
    submitFlag,
    FlagServiceError,
} from '../../../services/h2hFlagService'

// ============================================================================
// Helpers
// ============================================================================

/** Mocks one supabase.from() call that ends with .maybeSingle() */
function mockFromMaybeSingle(result: { data: unknown; error: unknown }) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(result),
    }
    hoisted.mockSupabaseFrom.mockReturnValueOnce(chain)
    return chain
}

/** Mocks one supabase.from() call that ends with .insert().select() */
function mockFromInsertSelect(result: { data: unknown; error: unknown }) {
    const chain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue(result),
    }
    hoisted.mockSupabaseFrom.mockReturnValueOnce(chain)
    return chain
}

// ============================================================================
// Tests
// ============================================================================

describe('h2hFlagService', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ------------------------------------------------------------------------
    // findMatchByExternalId
    // ------------------------------------------------------------------------

    describe('findMatchByExternalId', () => {
        it('returns the match row when the DB row exists', async () => {
            const matchRow = { id: 99, match_id: '12345' }
            mockFromMaybeSingle({ data: matchRow, error: null })

            const result = await findMatchByExternalId('12345')

            expect(result).toEqual(matchRow)
        })

        it('returns null when no row exists in h2h_matches', async () => {
            mockFromMaybeSingle({ data: null, error: null })

            const result = await findMatchByExternalId('99999')

            expect(result).toBeNull()
        })

        it('rethrows Supabase errors and logs them', async () => {
            const dbError = Object.assign(new Error('DB connection failed'), { code: 'PGRST301' })
            mockFromMaybeSingle({ data: null, error: dbError })

            await expect(findMatchByExternalId('12345')).rejects.toThrow('DB connection failed')
            expect(hoisted.mockLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({ feature: 'flags', matchId: '12345' }),
                expect.any(String),
            )
        })
    })

    // ------------------------------------------------------------------------
    // submitFlag
    // ------------------------------------------------------------------------

    describe('submitFlag', () => {
        const validParams = {
            matchId: '12345',
            player1CharacterId: 101,
            player2CharacterId: 202,
            flagType: 'void' as const,
            reason: 'Connection dropped mid-game',
            submittedBy: 'Player1#1234',
        }

        const player1Record = { id: '101', btag: 'Player1#1234', name: 'Player One' }
        const player2Record = { id: '202', btag: 'Player2#5678', name: 'Player Two' }
        const matchRow = { id: 99, match_id: '12345' }

        it('inserts a pending flag row and returns { flagId, status: "pending" }', async () => {
            mockFromMaybeSingle({ data: matchRow, error: null })
            hoisted.mockGetCommunityPlayer
                .mockResolvedValueOnce(player1Record)
                .mockResolvedValueOnce(player2Record)
            const insertChain = mockFromInsertSelect({ data: [{ id: 42 }], error: null })

            const result = await submitFlag(validParams)

            expect(result).toEqual({ flagId: 42, status: 'pending' })
            expect(insertChain.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    match_db_id: 99,
                    flag_type: 'void',
                    reason: 'Connection dropped mid-game',
                    submitted_by: 'Player1#1234',
                    status: 'pending',
                }),
            )
        })

        it('throws MATCH_NOT_FOUND when the match does not exist', async () => {
            mockFromMaybeSingle({ data: null, error: null })

            await expect(submitFlag(validParams)).rejects.toMatchObject({
                name: 'FlagServiceError',
                code: 'MATCH_NOT_FOUND',
            })
        })

        it('throws NOT_A_PARTICIPANT when submitter btag matches neither player', async () => {
            mockFromMaybeSingle({ data: matchRow, error: null })
            hoisted.mockGetCommunityPlayer
                .mockResolvedValueOnce(player1Record)
                .mockResolvedValueOnce(player2Record)

            await expect(
                submitFlag({ ...validParams, submittedBy: 'Outsider#9999' }),
            ).rejects.toMatchObject({
                name: 'FlagServiceError',
                code: 'NOT_A_PARTICIPANT',
            })
        })

        it('throws NOT_A_PARTICIPANT when a player is absent from communityDataService', async () => {
            mockFromMaybeSingle({ data: matchRow, error: null })
            // Both players unknown in community data
            hoisted.mockGetCommunityPlayer.mockResolvedValue(null)

            await expect(submitFlag(validParams)).rejects.toMatchObject({
                name: 'FlagServiceError',
                code: 'NOT_A_PARTICIPANT',
            })
        })

        it('throws DUPLICATE_PENDING_FLAG on Postgres 23505 unique violation', async () => {
            mockFromMaybeSingle({ data: matchRow, error: null })
            hoisted.mockGetCommunityPlayer
                .mockResolvedValueOnce(player1Record)
                .mockResolvedValueOnce(player2Record)
            mockFromInsertSelect({
                data: null,
                error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            })

            await expect(submitFlag(validParams)).rejects.toMatchObject({
                name: 'FlagServiceError',
                code: 'DUPLICATE_PENDING_FLAG',
            })
        })

        it('rethrows unexpected Supabase insert errors and logs them', async () => {
            mockFromMaybeSingle({ data: matchRow, error: null })
            hoisted.mockGetCommunityPlayer
                .mockResolvedValueOnce(player1Record)
                .mockResolvedValueOnce(player2Record)
            mockFromInsertSelect({
                data: null,
                error: { code: 'PGRST301', message: 'Unexpected DB error' },
            })

            await expect(submitFlag(validParams)).rejects.toMatchObject({
                message: 'Unexpected DB error',
            })
            expect(hoisted.mockLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({ feature: 'flags', matchId: '12345' }),
                expect.any(String),
            )
        })

        it('accepts submitter as player2 (not just player1)', async () => {
            mockFromMaybeSingle({ data: matchRow, error: null })
            hoisted.mockGetCommunityPlayer
                .mockResolvedValueOnce(player1Record)
                .mockResolvedValueOnce(player2Record)
            mockFromInsertSelect({ data: [{ id: 77 }], error: null })

            const result = await submitFlag({ ...validParams, submittedBy: 'Player2#5678' })

            expect(result).toEqual({ flagId: 77, status: 'pending' })
        })

        it('stores reason as null when not provided', async () => {
            mockFromMaybeSingle({ data: matchRow, error: null })
            hoisted.mockGetCommunityPlayer
                .mockResolvedValueOnce(player1Record)
                .mockResolvedValueOnce(player2Record)
            const insertChain = mockFromInsertSelect({ data: [{ id: 55 }], error: null })

            await submitFlag({ ...validParams, flagType: 'showmatch', reason: null })

            expect(insertChain.insert).toHaveBeenCalledWith(
                expect.objectContaining({ reason: null, flag_type: 'showmatch' }),
            )
        })
    })

    // ------------------------------------------------------------------------
    // FlagServiceError
    // ------------------------------------------------------------------------

    describe('FlagServiceError', () => {
        it('carries the expected name and code discriminant', () => {
            const error = new FlagServiceError('MATCH_NOT_FOUND', 'not found')

            expect(error).toBeInstanceOf(Error)
            expect(error.name).toBe('FlagServiceError')
            expect(error.code).toBe('MATCH_NOT_FOUND')
            expect(error.message).toBe('not found')
        })
    })
})
