import { Request, Response, NextFunction } from 'express'
import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { z } from 'zod'
import logger from '../logging/logger'
import { getClientInfo } from '../utils/getClientInfo'
import {
    incrementAnalyticsRequest,
    incrementAnalyticsRateLimit,
    incrementAnalyticsFeatureDisabled,
    incrementAnalyticsError,
    observeAnalyticsLatency,
} from '../metrics/lite'

// Validation schemas for analytics requests
const analyticsQuerySchema = z.object({
    race: z.enum(['TERRAN', 'PROTOSS', 'ZERG', 'RANDOM']).optional(),
    includeInactive: z
        .string()
        .optional()
        .default('false')
        .transform((val: string) => val === 'true'),
    timeframe: z.enum(['current', 'daily']).optional().default('current'),
    minimumGames: z
        .string()
        .optional()
        .transform((val?: string) => (val ? parseInt(val, 10) : 20))
        .refine((val: number) => val >= 0 && val <= 1000, {
            message: 'Minimum games must be between 0 and 1000',
        }),
})

const activityAnalysisQuerySchema = z.object({
    includeInactive: z
        .string()
        .optional()
        .default('false')
        .transform((val: string) => val === 'true'),
    groupBy: z
        .enum(['race', 'league', 'activity'])
        .optional()
        .default('activity'),
    timeframe: z.enum(['current', 'daily']).optional().default('current'),
    minimumGames: z
        .string()
        .optional()
        .transform((val?: string) => (val ? parseInt(val, 10) : 20))
        .refine((val: number) => val >= 0 && val <= 1000, {
            message: 'Minimum games must be between 0 and 1000',
        }),
})

// Rate limiting for analytics endpoints
export const analyticsRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many analytics requests, please try again later.',
        retryAfter: '15 minutes',
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req: Request) => {
        // Simple IP-based rate limiting to avoid IPv6 issues
        return ipKeyGenerator(req.ip || req.socket?.remoteAddress || 'unknown')
    },
    skip: (_req: Request) => {
        // Skip rate limiting in test environment
        return process.env.NODE_ENV === 'test'
    },
    handler: (req: Request, res: Response) => {
        incrementAnalyticsRateLimit()

        const clientInfo = getClientInfo(req.headers['user-agent'] || '')
        logger.warn(
            {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                clientInfo,
                feature: 'analytics',
                endpoint: req.path,
            },
            'Analytics rate limit exceeded'
        )

        res.status(429).json({
            error: 'Too many analytics requests, please try again later.',
            retryAfter: '15 minutes',
        })
    },
})

// Stricter rate limiting for expensive analytics operations
export const expensiveAnalyticsRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // Limit each IP to 20 requests per hour for expensive operations
    message: {
        error: 'Too many expensive analytics requests, please try again later.',
        retryAfter: '1 hour',
    },
    keyGenerator: (req: Request) => {
        // Simple IP-based rate limiting for expensive operations
        return ipKeyGenerator(
            `expensive-${req.ip || req.socket?.remoteAddress || 'unknown'}`
        )
    },
    skip: (_req: Request) => {
        return process.env.NODE_ENV === 'test'
    },
})

// Feature flag middleware
export const requireAnalyticsFeature = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const analyticsEnabled =
        String(process.env.ENABLE_PLAYER_ANALYTICS ?? 'false').toLowerCase() ===
        'true'

    if (!analyticsEnabled) {
        incrementAnalyticsFeatureDisabled()

        const clientInfo = getClientInfo(req.headers['user-agent'] || '')
        logger.warn(
            {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                clientInfo,
                feature: 'analytics',
                endpoint: req.path,
            },
            'Analytics feature accessed while disabled'
        )

        return res.status(404).json({
            error: 'Feature not available',
            message: 'Player analytics feature is currently disabled',
        })
    }

    next()
}

// Request validation middleware factory
export const validateAnalyticsRequest = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate query parameters
            const validatedQuery = schema.parse(req.query)

            // Add validated data to request for use in handlers
            req.validatedQuery = validatedQuery

            // Log analytics request for monitoring
            const clientInfo = getClientInfo(req.headers['user-agent'] || '')
            logger.info(
                {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    clientInfo,
                    feature: 'analytics',
                    endpoint: req.path,
                    query: validatedQuery,
                },
                'Analytics request received'
            )

            next()
        } catch (error) {
            if (error instanceof z.ZodError) {
                incrementAnalyticsError('validation')

                return res.status(400).json({
                    error: 'Invalid request parameters',
                    details: error.issues.map((err: any) => ({
                        field: err.path.join('.'),
                        message: err.message,
                        received: err.received,
                    })),
                })
            }

            logger.error(
                {
                    error,
                    feature: 'analytics',
                    endpoint: req.path,
                },
                'Unexpected validation error'
            )

            return res.status(500).json({
                error: 'Internal server error during validation',
            })
        }
    }
}

// Security headers middleware for analytics endpoints
export const analyticsSecurityHeaders = (
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    // Add security headers specific to analytics data
    res.setHeader(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate'
    )
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')

    next()
}

// Request size limiting for analytics endpoints
export const analyticsBodyLimit = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Analytics endpoints should not accept large payloads
    const contentLength = req.get('content-length')
    if (contentLength && parseInt(contentLength) > 1024) {
        // 1KB limit
        return res.status(413).json({
            error: 'Request payload too large',
            message: 'Analytics endpoints accept only small requests',
        })
    }

    next()
}

// Performance monitoring middleware
export const analyticsPerformanceMonitoring = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const startTime = Date.now()

    // Track analytics request
    incrementAnalyticsRequest()

    // Override res.json to capture response time
    const originalJson = res.json
    res.json = function (data: any) {
        const responseTime = Date.now() - startTime

        // Record latency metrics
        observeAnalyticsLatency(responseTime)

        const clientInfo = getClientInfo(req.headers['user-agent'] || '')

        logger.info(
            {
                ip: req.ip,
                clientInfo,
                feature: 'analytics',
                endpoint: req.path,
                responseTime,
                statusCode: res.statusCode,
            },
            'Analytics request completed'
        )

        // Log slow responses for monitoring
        if (responseTime > 5000) {
            // 5 seconds
            logger.warn(
                {
                    ip: req.ip,
                    clientInfo,
                    feature: 'analytics',
                    endpoint: req.path,
                    responseTime,
                    statusCode: res.statusCode,
                },
                'Slow analytics response detected'
            )
        }

        return originalJson.call(this, data)
    }

    next()
}

// Combined middleware for standard analytics endpoints
export const standardAnalyticsMiddleware = [
    requireAnalyticsFeature,
    analyticsRateLimit,
    analyticsSecurityHeaders,
    analyticsBodyLimit,
    analyticsPerformanceMonitoring,
    validateAnalyticsRequest(analyticsQuerySchema),
]

// Combined middleware for expensive analytics operations
export const expensiveAnalyticsMiddleware = [
    requireAnalyticsFeature,
    expensiveAnalyticsRateLimit,
    analyticsSecurityHeaders,
    analyticsBodyLimit,
    analyticsPerformanceMonitoring,
    validateAnalyticsRequest(activityAnalysisQuerySchema),
]

// Type augmentation for Express Request to include validated query
declare global {
    namespace Express {
        interface Request {
            validatedQuery?: any
        }
    }
}
