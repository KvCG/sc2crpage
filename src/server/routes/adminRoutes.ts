// src/server/routes/adminRoutes.ts
//
// Admin authentication endpoint.
//
// POST /api/admin/login
//   Body:    { password: string }
//   Returns: { token: string }  on success (200)
//   Returns: { error: string }  on wrong password (401) or misconfiguration (500)

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { signToken } from '../services/jwtService'
import logger from '../logging/logger'

const router = Router()

const loginBodySchema = z.object({
    password: z.string({ required_error: 'password is required' }).min(1, 'password must not be empty'),
})

const EIGHT_HOURS_IN_SECONDS = 8 * 60 * 60

/**
 * POST /api/admin/login
 *
 * Validates the provided password against the ADMIN_PASSWORD env var and
 * returns a signed 8-hour HS256 JWT on success.
 *
 * The JWT is signed with ADMIN_PASSWORD as the HMAC secret.
 */
router.post('/admin/login', (req: Request, res: Response) => {
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
        logger.error({ feature: 'admin' }, 'ADMIN_PASSWORD env var is not set')
        return res.status(500).json({ error: 'Server misconfiguration' })
    }

    const parsed = loginBodySchema.safeParse(req.body)

    if (!parsed.success) {
        const details = parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            received: (req.body as Record<string, unknown>)[issue.path[0] as string],
        }))
        return res.status(400).json({ error: 'Invalid request body', details })
    }

    const { password } = parsed.data

    if (password !== adminPassword) {
        logger.warn({ feature: 'admin' }, 'Admin login attempt failed: wrong password')
        return res.status(401).json({ error: 'Unauthorized' })
    }

    const token = signToken({}, adminPassword, EIGHT_HOURS_IN_SECONDS)

    logger.info({ feature: 'admin' }, 'Admin login successful')

    return res.status(200).json({ token })
})

export default router
