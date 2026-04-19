import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response, NextFunction } from 'express'

// ============================================================================
// Hoisted mocks — must be above all imports
// ============================================================================

const hoisted = vi.hoisted(() => ({
    verifyTokenMock: vi.fn(),
    loggerMock: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('../../services/jwtService', () => ({
    verifyToken: hoisted.verifyTokenMock,
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.loggerMock,
}))

// Import module under test AFTER mocks
import { requireAdminAuth } from '../../middleware/adminAuthMiddleware'

// ============================================================================
// Helpers
// ============================================================================

function createMockResponse() {
    const res = {
        statusCode: 200,
        jsonData: undefined as unknown,
        status: vi.fn(),
        json: vi.fn(),
    }
    res.status.mockImplementation((code: number) => {
        res.statusCode = code
        return res
    })
    res.json.mockImplementation((data: unknown) => {
        res.jsonData = data
        return res
    })
    return res as unknown as Response & { statusCode: number; jsonData: unknown }
}

function createMockRequest(headers: Record<string, string> = {}): Request & { admin?: unknown } {
    return { headers } as unknown as Request & { admin?: unknown }
}

// ============================================================================
// Tests
// ============================================================================

describe('requireAdminAuth', () => {
    const MOCK_PASSWORD = 'super-secret-password'
    const MOCK_PAYLOAD = { iat: 1000, exp: 9_999_999_999 }

    let mockNext: NextFunction

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('ADMIN_PASSWORD', MOCK_PASSWORD)
        mockNext = vi.fn()
    })

    describe('missing or malformed Authorization header', () => {
        it('returns 401 when Authorization header is absent', () => {
            const req = createMockRequest({})
            const res = createMockResponse()

            requireAdminAuth(req as Request, res as Response, mockNext)

            expect(res.statusCode).toBe(401)
            expect(res.jsonData).toEqual({ error: 'Unauthorized' })
            expect(mockNext).not.toHaveBeenCalled()
        })

        it('returns 401 when Authorization header is not Bearer format', () => {
            const req = createMockRequest({ authorization: 'Basic dXNlcjpwYXNz' })
            const res = createMockResponse()

            requireAdminAuth(req as Request, res as Response, mockNext)

            expect(res.statusCode).toBe(401)
            expect(res.jsonData).toEqual({ error: 'Unauthorized' })
            expect(mockNext).not.toHaveBeenCalled()
        })

        it('returns 401 when Bearer prefix is present but token is empty', () => {
            const req = createMockRequest({ authorization: 'Bearer ' })
            const res = createMockResponse()

            hoisted.verifyTokenMock.mockImplementation(() => {
                throw new Error('Invalid JWT: expected 3 parts')
            })

            requireAdminAuth(req as Request, res as Response, mockNext)

            expect(res.statusCode).toBe(401)
            expect(res.jsonData).toEqual({ error: 'Unauthorized' })
            expect(mockNext).not.toHaveBeenCalled()
        })
    })

    describe('invalid or expired token', () => {
        it('returns 401 when token signature does not match', () => {
            const req = createMockRequest({ authorization: 'Bearer bad.token.here' })
            const res = createMockResponse()

            hoisted.verifyTokenMock.mockImplementation(() => {
                throw new Error('Invalid JWT: signature mismatch')
            })

            requireAdminAuth(req as Request, res as Response, mockNext)

            expect(res.statusCode).toBe(401)
            expect(res.jsonData).toEqual({ error: 'Unauthorized' })
            expect(mockNext).not.toHaveBeenCalled()
        })

        it('returns 401 when token is expired', () => {
            const req = createMockRequest({ authorization: 'Bearer expired.token.here' })
            const res = createMockResponse()

            hoisted.verifyTokenMock.mockImplementation(() => {
                throw new Error('JWT expired')
            })

            requireAdminAuth(req as Request, res as Response, mockNext)

            expect(res.statusCode).toBe(401)
            expect(res.jsonData).toEqual({ error: 'Unauthorized' })
            expect(mockNext).not.toHaveBeenCalled()
        })

        it('returns 401 when token is malformed (wrong number of parts)', () => {
            const req = createMockRequest({ authorization: 'Bearer notajwt' })
            const res = createMockResponse()

            hoisted.verifyTokenMock.mockImplementation(() => {
                throw new Error('Invalid JWT: expected 3 parts')
            })

            requireAdminAuth(req as Request, res as Response, mockNext)

            expect(res.statusCode).toBe(401)
            expect(res.jsonData).toEqual({ error: 'Unauthorized' })
            expect(mockNext).not.toHaveBeenCalled()
        })
    })

    describe('server misconfiguration', () => {
        it('returns 401 (not 500) when ADMIN_PASSWORD env var is not set', () => {
            delete process.env.ADMIN_PASSWORD

            const req = createMockRequest({ authorization: 'Bearer some.valid.token' })
            const res = createMockResponse()

            requireAdminAuth(req as Request, res as Response, mockNext)

            expect(res.statusCode).toBe(401)
            expect(res.jsonData).toEqual({ error: 'Unauthorized' })
            expect(hoisted.verifyTokenMock).not.toHaveBeenCalled()
            expect(mockNext).not.toHaveBeenCalled()
            expect(hoisted.loggerMock.error).toHaveBeenCalledWith(
                { feature: 'admin' },
                expect.stringContaining('ADMIN_PASSWORD')
            )
        })
    })

    describe('valid token', () => {
        it('sets req.admin to the decoded payload and calls next()', () => {
            const req = createMockRequest({ authorization: 'Bearer valid.token.here' })
            const res = createMockResponse()

            hoisted.verifyTokenMock.mockReturnValue(MOCK_PAYLOAD)

            requireAdminAuth(req as Request, res as Response, mockNext)

            expect(hoisted.verifyTokenMock).toHaveBeenCalledWith('valid.token.here', MOCK_PASSWORD)
            expect((req as Request & { admin?: unknown }).admin).toEqual(MOCK_PAYLOAD)
            expect(mockNext).toHaveBeenCalled()
            expect(res.statusCode).toBe(200) // untouched
        })

        it('does not call res.status or res.json on a valid token', () => {
            const req = createMockRequest({ authorization: 'Bearer valid.token.here' })
            const res = createMockResponse()

            hoisted.verifyTokenMock.mockReturnValue(MOCK_PAYLOAD)

            requireAdminAuth(req as Request, res as Response, mockNext)

            expect(res.status).not.toHaveBeenCalled()
            expect(res.json).not.toHaveBeenCalled()
        })
    })
})
