import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'

// Hoist mocks to top level
const hoisted = vi.hoisted(() => ({
    mockLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    },
    getClientInfo: vi.fn(() => ({ device: 'Desktop', os: 'Windows' }))
}))

vi.mock('../../logging/logger', () => ({
    default: hoisted.mockLogger
}))

vi.mock('../../utils/getClientInfo', () => ({
    getClientInfo: hoisted.getClientInfo
}))

// Import after mocks
import { 
    requireAnalyticsFeature, 
    validateAnalyticsRequest,
    analyticsSecurityHeaders,
    analyticsPerformanceMonitoring
} from '../../middleware/analyticsMiddleware'

describe('Analytics Middleware', () => {
    let mockReq: Partial<Request>
    let mockRes: Partial<Response>
    let mockNext: NextFunction
    let originalEnv: any

    beforeEach(() => {
        originalEnv = { ...process.env }
        mockReq = {
            ip: '127.0.0.1',
            path: '/api/analytics/test',
            headers: {
                'user-agent': 'test-agent'
            },
            get: vi.fn((header: string) => {
                if (header === 'User-Agent') return 'test-agent'
                return undefined
            }) as any,
            query: {},
            validatedQuery: undefined
        }
        // Create response mock with chaining methods
        const statusMock = vi.fn()
        const jsonMock = vi.fn()
        const setHeaderMock = vi.fn()
        
        mockRes = {
            status: statusMock,
            json: jsonMock,
            setHeader: setHeaderMock
        } as any
        
        // Set up method chaining
        statusMock.mockReturnValue(mockRes)
        jsonMock.mockReturnValue(mockRes)
        setHeaderMock.mockReturnValue(mockRes)
        
        mockNext = vi.fn()
    })

    afterEach(() => {
        process.env = originalEnv
    })

    describe('requireAnalyticsFeature', () => {
        it('should allow request when feature is enabled', () => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'true'
            
            requireAnalyticsFeature(mockReq as Request, mockRes as Response, mockNext)
            
            expect(mockNext).toHaveBeenCalled()
            expect(mockRes.status).not.toHaveBeenCalled()
        })

        it('should block request when feature is disabled', () => {
            delete process.env.ENABLE_PLAYER_ANALYTICS
            
            requireAnalyticsFeature(mockReq as Request, mockRes as Response, mockNext)
            
            expect(mockRes.status).toHaveBeenCalledWith(404)
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Feature not available',
                message: 'Player analytics feature is currently disabled'
            })
            expect(mockNext).not.toHaveBeenCalled()
        })

        it('should log warning when accessing disabled feature', () => {
            process.env.ENABLE_PLAYER_ANALYTICS = 'false'
            
            requireAnalyticsFeature(mockReq as Request, mockRes as Response, mockNext)
            
            expect(hoisted.mockLogger.warn).toHaveBeenCalled()
        })
    })

    describe('validateAnalyticsRequest', () => {
        const testSchema = z.object({
            test: z.string().optional().default('default'),
            number: z.string().optional().transform((val?: string) => val ? parseInt(val, 10) : 0)
        })

        it('should validate and transform query parameters correctly', () => {
            mockReq.query = { test: 'value', number: '42' }
            const middleware = validateAnalyticsRequest(testSchema)
            
            middleware(mockReq as Request, mockRes as Response, mockNext)
            
            expect(mockReq.validatedQuery).toEqual({
                test: 'value',
                number: 42
            })
            expect(mockNext).toHaveBeenCalled()
        })

        it('should use default values for missing parameters', () => {
            mockReq.query = {}
            const middleware = validateAnalyticsRequest(testSchema)
            
            middleware(mockReq as Request, mockRes as Response, mockNext)
            
            expect(mockReq.validatedQuery).toEqual({
                test: 'default',
                number: 0
            })
            expect(mockNext).toHaveBeenCalled()
        })

        it('should return 400 for invalid parameters', () => {
            const strictSchema = z.object({
                required: z.string()
            })
            mockReq.query = {}
            const middleware = validateAnalyticsRequest(strictSchema)
            
            middleware(mockReq as Request, mockRes as Response, mockNext)
            
            expect(mockRes.status).toHaveBeenCalledWith(400)
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Invalid request parameters',
                    details: expect.any(Array)
                })
            )
            expect(mockNext).not.toHaveBeenCalled()
        })

        it('should log successful validation', () => {
            mockReq.query = { test: 'value' }
            const middleware = validateAnalyticsRequest(testSchema)
            
            middleware(mockReq as Request, mockRes as Response, mockNext)
            
            expect(hoisted.mockLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    feature: 'analytics',
                    endpoint: mockReq.path
                }),
                'Analytics request received'
            )
        })
    })

    describe('analyticsSecurityHeaders', () => {
        it('should set security headers', () => {
            analyticsSecurityHeaders(mockReq as Request, mockRes as Response, mockNext)
            
            expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-cache, no-store, must-revalidate')
            expect(mockRes.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache')
            expect(mockRes.setHeader).toHaveBeenCalledWith('Expires', '0')
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
            expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY')
            expect(mockNext).toHaveBeenCalled()
        })
    })

    describe('analyticsPerformanceMonitoring', () => {
        it('should monitor response time and log completion', () => {
            const originalJson = vi.fn()
            mockRes.json = originalJson
            mockRes.statusCode = 200
            
            analyticsPerformanceMonitoring(mockReq as Request, mockRes as Response, mockNext)
            
            // Simulate calling res.json
            const modifiedJson = mockRes.json as any
            modifiedJson({ test: 'data' })
            
            expect(hoisted.mockLogger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    feature: 'analytics',
                    responseTime: expect.any(Number),
                    statusCode: 200
                }),
                'Analytics request completed'
            )
        })

        it('should log warning for slow responses', () => {
            const originalJson = vi.fn()
            mockRes.json = originalJson
            mockRes.statusCode = 200
            
            // Mock Date.now to simulate slow response
            const originalNow = Date.now
            let callCount = 0
            vi.spyOn(Date, 'now').mockImplementation(() => {
                callCount++
                if (callCount === 1) return 0 // Start time
                return 6000 // End time (6 seconds later)
            })
            
            analyticsPerformanceMonitoring(mockReq as Request, mockRes as Response, mockNext)
            
            // Simulate calling res.json
            const modifiedJson = mockRes.json as any
            modifiedJson({ test: 'data' })
            
            expect(hoisted.mockLogger.warn).toHaveBeenCalledWith(
                expect.objectContaining({
                    feature: 'analytics',
                    responseTime: 6000
                }),
                'Slow analytics response detected'
            )
            
            // Restore Date.now
            Date.now = originalNow
        })
    })
})