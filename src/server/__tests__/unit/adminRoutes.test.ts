import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Request, Response } from 'express'

// ============================================================================
// Hoisted mocks — must be above all imports
// ============================================================================

const hoisted = vi.hoisted(() => ({
    signTokenMock: vi.fn(),
    loggerMock: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
    adminPassword: undefined as string | undefined,
}))

vi.mock('../../services/jwtService', () => ({
    signToken: hoisted.signTokenMock,
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.loggerMock,
}))

// Router capture — same pattern used in challongeRoutes.test.ts
const captures = vi.hoisted(() => ({
    routes: [] as Array<{ method: string; path: string; handler: Function }>,
}))

vi.mock('express', async (orig) => {
    const mod = await (orig as () => Promise<typeof import('express')>)()
    return {
        ...mod,
        Router: () => ({
            post: (path: string, handler: Function) =>
                captures.routes.push({ method: 'post', path, handler }),
        }),
    }
})

// Import module under test AFTER mocks
import '../../routes/adminRoutes'

// ============================================================================
// Helpers
// ============================================================================

function createMockResponse() {
    const res = {
        jsonData: undefined as unknown,
        statusCode: 200,
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
    return res as unknown as Response & { jsonData: unknown; statusCode: number }
}

function createMockRequest(body: Record<string, unknown> = {}): Request {
    return { body } as unknown as Request
}

function getLoginHandler(): Function {
    const entry = captures.routes.find((route) => route.path === '/admin/login' && route.method === 'post')
    if (!entry) throw new Error('POST /admin/login route not registered')
    return entry.handler
}

// ============================================================================
// Tests
// ============================================================================

describe('adminRoutes — POST /admin/login', () => {
    const MOCK_PASSWORD = 'super-secret-password'
    const MOCK_TOKEN = 'header.payload.signature'

    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('ADMIN_PASSWORD', MOCK_PASSWORD)
        hoisted.signTokenMock.mockReturnValue(MOCK_TOKEN)
    })

    it('returns 200 and a signed token when the correct password is provided', async () => {
        const req = createMockRequest({ password: MOCK_PASSWORD })
        const res = createMockResponse()

        await getLoginHandler()(req, res)

        expect(res.statusCode).toBe(200)
        expect(res.jsonData).toEqual({ token: MOCK_TOKEN })
        expect(hoisted.signTokenMock).toHaveBeenCalledWith(
            {},
            MOCK_PASSWORD,
            8 * 60 * 60
        )
    })

    it('returns 401 when the password is wrong', async () => {
        const req = createMockRequest({ password: 'wrong-password' })
        const res = createMockResponse()

        await getLoginHandler()(req, res)

        expect(res.statusCode).toBe(401)
        expect(res.jsonData).toEqual({ error: 'Unauthorized' })
        expect(hoisted.signTokenMock).not.toHaveBeenCalled()
    })

    it('returns 401 when no password field is sent', async () => {
        const req = createMockRequest({})
        const res = createMockResponse()

        await getLoginHandler()(req, res)

        // Empty/missing password fails Zod validation → 400
        expect(res.statusCode).toBe(400)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Invalid request body')
        expect(hoisted.signTokenMock).not.toHaveBeenCalled()
    })

    it('returns 401 when an empty string password is sent', async () => {
        const req = createMockRequest({ password: '' })
        const res = createMockResponse()

        await getLoginHandler()(req, res)

        expect(res.statusCode).toBe(400)
        expect((res.jsonData as Record<string, unknown>).error).toBe('Invalid request body')
    })

    it('returns 500 when ADMIN_PASSWORD env var is not configured', async () => {
        vi.stubEnv('ADMIN_PASSWORD', '')
        const req = createMockRequest({ password: 'any-password' })
        const res = createMockResponse()

        await getLoginHandler()(req, res)

        expect(res.statusCode).toBe(500)
        expect(res.jsonData).toEqual({ error: 'Server misconfiguration' })
        expect(hoisted.signTokenMock).not.toHaveBeenCalled()
    })

    it('passes expiry of exactly 8 hours in seconds to signToken', async () => {
        const req = createMockRequest({ password: MOCK_PASSWORD })
        const res = createMockResponse()

        await getLoginHandler()(req, res)

        const [, , expiryArg] = hoisted.signTokenMock.mock.calls[0] as [unknown, unknown, number]
        expect(expiryArg).toBe(8 * 60 * 60)
    })
})
