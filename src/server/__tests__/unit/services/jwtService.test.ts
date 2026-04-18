import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { signToken, verifyToken } from '../../../services/jwtService'

const TEST_SECRET = 'test-secret-password'

describe('jwtService', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    // -------------------------------------------------------------------------
    // signToken
    // -------------------------------------------------------------------------

    describe('signToken', () => {
        it('returns a string with 3 dot-separated parts', () => {
            const token = signToken({}, TEST_SECRET, 3600)
            const parts = token.split('.')
            expect(parts).toHaveLength(3)
        })

        it('encodes iat and exp correctly in the payload', () => {
            const fakeNow = new Date('2026-01-01T00:00:00Z')
            vi.setSystemTime(fakeNow)

            const expirySeconds = 8 * 3600
            const token = signToken({}, TEST_SECRET, expirySeconds)

            const payloadPart = token.split('.')[1]
            const decoded = JSON.parse(Buffer.from(payloadPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'))

            const expectedIat = Math.floor(fakeNow.getTime() / 1000)
            expect(decoded.iat).toBe(expectedIat)
            expect(decoded.exp - decoded.iat).toBe(expirySeconds)
        })

        it('embeds additional claims in the payload', () => {
            const token = signToken({ role: 'admin', sub: 'user-1' }, TEST_SECRET, 3600)
            const payloadPart = token.split('.')[1]
            const decoded = JSON.parse(Buffer.from(payloadPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'))

            expect(decoded.role).toBe('admin')
            expect(decoded.sub).toBe('user-1')
        })

        it('produces different signatures for different secrets', () => {
            const token1 = signToken({}, 'secret-a', 3600)
            const token2 = signToken({}, 'secret-b', 3600)
            // Same header and payload structure, but signatures must differ
            expect(token1.split('.')[2]).not.toBe(token2.split('.')[2])
        })
    })

    // -------------------------------------------------------------------------
    // verifyToken
    // -------------------------------------------------------------------------

    describe('verifyToken', () => {
        it('returns the decoded payload for a valid token', () => {
            vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
            const token = signToken({ role: 'admin' }, TEST_SECRET, 3600)
            const payload = verifyToken(token, TEST_SECRET)

            expect(payload.role).toBe('admin')
            expect(typeof payload.iat).toBe('number')
            expect(typeof payload.exp).toBe('number')
        })

        it('throws when the token has wrong number of parts', () => {
            expect(() => verifyToken('not.a.valid.jwt.part', TEST_SECRET)).toThrow(
                'Invalid JWT: expected 3 parts'
            )
        })

        it('throws when the signature does not match', () => {
            const token = signToken({}, TEST_SECRET, 3600)
            const [header, payload] = token.split('.')
            const tampered = `${header}.${payload}.invalidsignature`

            expect(() => verifyToken(tampered, TEST_SECRET)).toThrow(
                'Invalid JWT: signature mismatch'
            )
        })

        it('throws when the token is expired', () => {
            vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
            const token = signToken({}, TEST_SECRET, 1) // 1-second lifetime

            // Advance time past expiry
            vi.setSystemTime(new Date('2026-01-01T00:00:02Z'))

            expect(() => verifyToken(token, TEST_SECRET)).toThrow('JWT expired')
        })

        it('throws when verified with the wrong secret', () => {
            const token = signToken({}, TEST_SECRET, 3600)
            expect(() => verifyToken(token, 'wrong-secret')).toThrow(
                'Invalid JWT: signature mismatch'
            )
        })
    })
})
