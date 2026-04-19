// src/server/middleware/adminAuthMiddleware.ts
//
// Middleware that enforces admin authentication on protected routes.
//
// Extracts and verifies the Authorization: Bearer <token> header using the
// same ADMIN_PASSWORD env var that was used to sign the token at login.
//
// On success: sets req.admin to the decoded JWT payload and calls next().
// On failure: returns 401 { error: 'Unauthorized' } with no leaking details.

import { Request, Response, NextFunction } from 'express'
import { verifyToken, JwtPayload } from '../services/jwtService'
import logger from '../logging/logger'

const BEARER_PREFIX = 'Bearer '

/**
 * Express middleware that validates an admin JWT on every request.
 *
 * Expected header format:
 *   Authorization: Bearer <signed-HS256-jwt>
 *
 * On success: populates req.admin with the decoded payload and calls next().
 * On failure: responds 401 and stops the middleware chain.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
        logger.warn(
            { feature: 'admin' },
            'Admin request rejected: missing or malformed Authorization header'
        )
        res.status(401).json({ error: 'Unauthorized' })
        return
    }

    const token = authHeader.slice(BEARER_PREFIX.length)

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
        // Misconfiguration — treated as auth failure to avoid leaking state
        logger.error(
            { feature: 'admin' },
            'ADMIN_PASSWORD env var is not set — cannot verify admin token'
        )
        res.status(401).json({ error: 'Unauthorized' })
        return
    }

    try {
        const payload = verifyToken(token, adminPassword)
        req.admin = payload
        next()
    } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error'
        logger.warn({ feature: 'admin', reason }, 'Admin request rejected: invalid or expired token')
        res.status(401).json({ error: 'Unauthorized' })
    }
}

// ---------------------------------------------------------------------------
// Type augmentation — extends Express Request with the admin context property
// ---------------------------------------------------------------------------

declare global {
    namespace Express {
        interface Request {
            admin?: JwtPayload
        }
    }
}
