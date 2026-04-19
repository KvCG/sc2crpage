import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ============================================================================
// Hoisted mocks — must be above all imports
// ============================================================================

const hoisted = vi.hoisted(() => ({
    mockSupabaseFrom: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../db/supabaseClient', () => ({
    default: { from: hoisted.mockSupabaseFrom },
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.mockLogger,
}))

vi.mock('../../services/communityDataService', () => ({
    communityDataService: {
        getCommunityData: vi.fn(),
        getCommunityPlayer: vi.fn(),
    },
    CommunityDataService: {
        getInstance: vi.fn(() => ({ getCommunityPlayer: vi.fn() })),
    },
}))

// Import module under test AFTER mocks
import { signToken } from '../../services/jwtService'
import h2hRoutes from '../../routes/h2hRoutes'

// ============================================================================
// App
// ============================================================================

const app = express()
app.use(express.json())
app.use('/', h2hRoutes)

// ============================================================================
// Constants
// ============================================================================

const TEST_ADMIN_PASSWORD = 'test-admin-secret-integration'
const EPOCH = '1970-01-01T00:00:00.000Z'

// ============================================================================
// Helpers
// ============================================================================

function makeValidJwt(): string {
    return signToken({ role: 'admin' }, TEST_ADMIN_PASSWORD, 3600)
}

/** Mocks one supabase.from() call ending with .select().eq().maybeSingle() */
function mockFromMaybeSingle(result: { data: unknown; error: unknown }) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(result),
    }
    hoisted.mockSupabaseFrom.mockReturnValueOnce(chain)
    return chain
}

/** Mocks one supabase.from() call ending with .update().eq() */
function mockFromUpdate(result: { error: unknown }) {
    const chain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, ...result }),
    }
    hoisted.mockSupabaseFrom.mockReturnValueOnce(chain)
    return chain
}

// ============================================================================
// Fixtures
// ============================================================================

const pendingVoidFlag = { id: 10, match_db_id: 99, flag_type: 'void', status: 'pending' }
const pendingShowmatchFlag = { id: 11, match_db_id: 99, flag_type: 'showmatch', status: 'pending' }
const pendingTournamentFlag = { id: 12, match_db_id: 99, flag_type: 'tournament', status: 'pending' }
const pendingFlagForReject = { id: 20, status: 'pending' }
const matchWithPair = { id: 99, pair_id: 7 }

// ============================================================================
// Tests
// ============================================================================

describe('PATCH /h2h/flags/:flagId — integration (approve & reject flows)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.ADMIN_PASSWORD = TEST_ADMIN_PASSWORD
    })

    // -------------------------------------------------------------------------
    // JWT authentication — all requests must carry a valid token
    // -------------------------------------------------------------------------

    describe('JWT authentication', () => {
        it('returns 401 when Authorization header is absent', async () => {
            const res = await request(app)
                .patch('/h2h/flags/10')
                .send({ action: 'approve' })

            expect(res.status).toBe(401)
            expect(res.body.error).toBe('Unauthorized')
            expect(hoisted.mockSupabaseFrom).not.toHaveBeenCalled()
        })

        it('returns 401 when JWT is signed with the wrong secret', async () => {
            const badToken = signToken({ role: 'admin' }, 'wrong-secret', 3600)

            const res = await request(app)
                .patch('/h2h/flags/10')
                .set('Authorization', `Bearer ${badToken}`)
                .send({ action: 'approve' })

            expect(res.status).toBe(401)
            expect(res.body.error).toBe('Unauthorized')
            expect(hoisted.mockSupabaseFrom).not.toHaveBeenCalled()
        })

        it('returns 401 when JWT has expired', async () => {
            const expiredToken = signToken({ role: 'admin' }, TEST_ADMIN_PASSWORD, -1)

            const res = await request(app)
                .patch('/h2h/flags/10')
                .set('Authorization', `Bearer ${expiredToken}`)
                .send({ action: 'approve' })

            expect(res.status).toBe(401)
            expect(res.body.error).toBe('Unauthorized')
        })

        it('proceeds past auth with a valid JWT', async () => {
            // label path — 2 Supabase calls
            mockFromMaybeSingle({ data: pendingShowmatchFlag, error: null })
            mockFromUpdate({ error: null }) // set match_label
            mockFromUpdate({ error: null }) // approve flag

            const res = await request(app)
                .patch('/h2h/flags/11')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'approve' })

            expect(res.status).toBe(200)
        })
    })

    // -------------------------------------------------------------------------
    // Approve void flag
    // -------------------------------------------------------------------------

    describe('approve void flag', () => {
        it('sets h2h_matches.is_voided = true', async () => {
            mockFromMaybeSingle({ data: pendingVoidFlag, error: null })   // fetch flag
            mockFromMaybeSingle({ data: matchWithPair, error: null })     // fetch match
            const voidUpdateChain = mockFromUpdate({ error: null })       // void match
            mockFromUpdate({ error: null })                                // reset pair
            mockFromUpdate({ error: null })                                // approve flag

            await request(app)
                .patch('/h2h/flags/10')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'approve' })

            expect(voidUpdateChain.update).toHaveBeenCalledWith(
                expect.objectContaining({ is_voided: true }),
            )
        })

        it('sets h2h_pairs.pulse_synced_at to epoch', async () => {
            mockFromMaybeSingle({ data: pendingVoidFlag, error: null })   // fetch flag
            mockFromMaybeSingle({ data: matchWithPair, error: null })     // fetch match
            mockFromUpdate({ error: null })                                // void match
            const pairUpdateChain = mockFromUpdate({ error: null })       // reset pair
            mockFromUpdate({ error: null })                                // approve flag

            await request(app)
                .patch('/h2h/flags/10')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'approve' })

            expect(pairUpdateChain.update).toHaveBeenCalledWith(
                expect.objectContaining({ pulse_synced_at: EPOCH }),
            )
        })

        it('resets the correct pair (targets pair_id from the match row)', async () => {
            mockFromMaybeSingle({ data: pendingVoidFlag, error: null })
            mockFromMaybeSingle({ data: matchWithPair, error: null })
            mockFromUpdate({ error: null })
            const pairUpdateChain = mockFromUpdate({ error: null })
            mockFromUpdate({ error: null })

            await request(app)
                .patch('/h2h/flags/10')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'approve' })

            expect(pairUpdateChain.eq).toHaveBeenCalledWith('id', matchWithPair.pair_id)
        })

        it('returns 200 with flagId and status approved', async () => {
            mockFromMaybeSingle({ data: pendingVoidFlag, error: null })
            mockFromMaybeSingle({ data: matchWithPair, error: null })
            mockFromUpdate({ error: null })
            mockFromUpdate({ error: null })
            mockFromUpdate({ error: null })

            const res = await request(app)
                .patch('/h2h/flags/10')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'approve' })

            expect(res.status).toBe(200)
            expect(res.body.flagId).toBe(pendingVoidFlag.id)
            expect(res.body.status).toBe('approved')
        })
    })

    // -------------------------------------------------------------------------
    // Approve label flag
    // -------------------------------------------------------------------------

    describe('approve label flag', () => {
        it('sets h2h_matches.match_label to showmatch', async () => {
            mockFromMaybeSingle({ data: pendingShowmatchFlag, error: null })
            const labelUpdateChain = mockFromUpdate({ error: null })
            mockFromUpdate({ error: null })

            await request(app)
                .patch('/h2h/flags/11')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'approve' })

            expect(labelUpdateChain.update).toHaveBeenCalledWith(
                expect.objectContaining({ match_label: 'showmatch' }),
            )
        })

        it('sets h2h_matches.match_label to tournament', async () => {
            mockFromMaybeSingle({ data: pendingTournamentFlag, error: null })
            const labelUpdateChain = mockFromUpdate({ error: null })
            mockFromUpdate({ error: null })

            await request(app)
                .patch('/h2h/flags/12')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'approve' })

            expect(labelUpdateChain.update).toHaveBeenCalledWith(
                expect.objectContaining({ match_label: 'tournament' }),
            )
        })

        it('returns 200 with flagId and status approved', async () => {
            mockFromMaybeSingle({ data: pendingShowmatchFlag, error: null })
            mockFromUpdate({ error: null })
            mockFromUpdate({ error: null })

            const res = await request(app)
                .patch('/h2h/flags/11')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'approve' })

            expect(res.status).toBe(200)
            expect(res.body.flagId).toBe(pendingShowmatchFlag.id)
            expect(res.body.status).toBe('approved')
        })
    })

    // -------------------------------------------------------------------------
    // Reject flag
    // -------------------------------------------------------------------------

    describe('reject flag', () => {
        it('stores admin_note and sets status = rejected', async () => {
            mockFromMaybeSingle({ data: pendingFlagForReject, error: null })
            const rejectUpdateChain = mockFromUpdate({ error: null })

            await request(app)
                .patch('/h2h/flags/20')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'reject', adminNote: 'Confirmed practice match, not competitive' })

            expect(rejectUpdateChain.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'rejected',
                    admin_note: 'Confirmed practice match, not competitive',
                }),
            )
        })

        it('stores null admin_note when adminNote is omitted', async () => {
            mockFromMaybeSingle({ data: pendingFlagForReject, error: null })
            const rejectUpdateChain = mockFromUpdate({ error: null })

            await request(app)
                .patch('/h2h/flags/20')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'reject' })

            expect(rejectUpdateChain.update).toHaveBeenCalledWith(
                expect.objectContaining({ admin_note: null }),
            )
        })

        it('returns 200 with flagId and status rejected', async () => {
            mockFromMaybeSingle({ data: pendingFlagForReject, error: null })
            mockFromUpdate({ error: null })

            const res = await request(app)
                .patch('/h2h/flags/20')
                .set('Authorization', `Bearer ${makeValidJwt()}`)
                .send({ action: 'reject', adminNote: 'Duplicate flag' })

            expect(res.status).toBe(200)
            expect(res.body.flagId).toBe(pendingFlagForReject.id)
            expect(res.body.status).toBe('rejected')
        })
    })
})
