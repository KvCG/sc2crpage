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
    listFlags,
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

/**
 * Mocks one supabase.from() call for a filterable select query
 * (used by listFlags: .select(...).order(...)[.eq(...)...] → awaited).
 */
function mockFromSelectQuery(result: { data: unknown; error: unknown }) {
    const promise = Promise.resolve(result)
    const chain = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: promise.then.bind(promise),
        catch: promise.catch.bind(promise),
        finally: promise.finally.bind(promise),
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

    // ------------------------------------------------------------------------
    // listFlags
    // ------------------------------------------------------------------------

    describe('listFlags', () => {
        const rawFlagRow = {
            id: 1,
            match_db_id: 99,
            flag_type: 'void',
            reason: 'practice match',
            submitted_by: 'Alpha#1234',
            status: 'pending',
            admin_note: null,
            reviewed_by: null,
            created_at: '2026-04-18T10:00:00.000Z',
            reviewed_at: null,
            h2h_matches: {
                match_id: 'pulse-12345',
                match_date: '2026-04-17T20:00:00.000Z',
                map_name: 'Equilibrium',
                match_type: '1v1',
                winner_character_id: 49312,
                h2h_pairs: {
                    player1_character_id: 49312,
                    player2_character_id: 2741271,
                },
            },
        }

        it('returns all flags mapped to H2HFlagWithMatch when no filters applied', async () => {
            mockFromSelectQuery({ data: [rawFlagRow], error: null })

            const result = await listFlags()

            expect(result).toHaveLength(1)
            const flag = result[0]
            expect(flag.id).toBe(1)
            expect(flag.matchDbId).toBe(99)
            expect(flag.flagType).toBe('void')
            expect(flag.reason).toBe('practice match')
            expect(flag.submittedBy).toBe('Alpha#1234')
            expect(flag.status).toBe('pending')
            expect(flag.adminNote).toBeNull()
            expect(flag.reviewedBy).toBeNull()
            expect(flag.createdAt).toBe('2026-04-18T10:00:00.000Z')
            expect(flag.reviewedAt).toBeNull()
        })

        it('includes all required match context fields on every result row', async () => {
            mockFromSelectQuery({ data: [rawFlagRow], error: null })

            const [flag] = await listFlags()

            expect(flag.match.matchId).toBe('pulse-12345')
            expect(flag.match.date).toBe('2026-04-17T20:00:00.000Z')
            expect(flag.match.map).toBe('Equilibrium')
            expect(flag.match.winnerCharacterId).toBe(49312)
            expect(flag.match.type).toBe('1v1')
            expect(flag.player1CharacterId).toBe(49312)
            expect(flag.player2CharacterId).toBe(2741271)
        })

        it('returns empty array when Supabase returns no rows', async () => {
            mockFromSelectQuery({ data: [], error: null })

            const result = await listFlags()

            expect(result).toEqual([])
        })

        it('passes status filter as eq() call when provided', async () => {
            const chain = mockFromSelectQuery({ data: [], error: null })

            await listFlags({ status: 'approved' })

            expect(chain.eq).toHaveBeenCalledWith('status', 'approved')
        })

        it('passes flagType filter as eq() call when provided', async () => {
            const chain = mockFromSelectQuery({ data: [], error: null })

            await listFlags({ flagType: 'showmatch' })

            expect(chain.eq).toHaveBeenCalledWith('flag_type', 'showmatch')
        })

        it('applies both filters when both provided', async () => {
            const chain = mockFromSelectQuery({ data: [], error: null })

            await listFlags({ status: 'rejected', flagType: 'void' })

            expect(chain.eq).toHaveBeenCalledWith('status', 'rejected')
            expect(chain.eq).toHaveBeenCalledWith('flag_type', 'void')
        })

        it('does not call eq() when no filters are provided', async () => {
            const chain = mockFromSelectQuery({ data: [], error: null })

            await listFlags()

            expect(chain.eq).not.toHaveBeenCalled()
        })

        it('throws and logs when Supabase returns an error', async () => {
            const dbError = Object.assign(new Error('DB failure'), { code: 'PGRST301' })
            mockFromSelectQuery({ data: null, error: dbError })

            await expect(listFlags()).rejects.toThrow('DB failure')
            expect(hoisted.mockLogger.error).toHaveBeenCalledWith(
                expect.objectContaining({ feature: 'flags' }),
                expect.any(String),
            )
        })
    })
})
