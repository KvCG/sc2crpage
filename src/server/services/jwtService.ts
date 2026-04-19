// src/server/services/jwtService.ts
//
// Minimal HS256 JWT implementation using Node's built-in crypto module.
// No third-party JWT library required.
//
// The same ADMIN_PASSWORD env var is used as both the password to validate
// and the HMAC signing secret — acceptable for a small single-admin setup.

import { createHmac, timingSafeEqual } from 'crypto'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function base64urlEncode(input: string): string {
    return Buffer.from(input, 'utf-8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

function base64urlDecode(input: string): string {
    // Restore standard base64 padding before decoding
    const padded = input.replace(/-/g, '+').replace(/_/g, '/')
    return Buffer.from(padded, 'base64').toString('utf-8')
}

function hmacSha256Base64url(data: string, secret: string): string {
    return createHmac('sha256', secret)
        .update(data)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface JwtPayload {
    iat: number
    exp: number
    [key: string]: unknown
}

/**
 * Signs a HS256 JWT.
 *
 * @param claims    - Additional claims to embed in the payload (iat/exp are added automatically)
 * @param secret    - HMAC signing secret
 * @param expirySeconds - Token lifetime in seconds
 */
export function signToken(
    claims: Record<string, unknown>,
    secret: string,
    expirySeconds: number
): string {
    const now = Math.floor(Date.now() / 1000)

    const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = base64urlEncode(
        JSON.stringify({ ...claims, iat: now, exp: now + expirySeconds })
    )

    const signingInput = `${header}.${payload}`
    const signature = hmacSha256Base64url(signingInput, secret)

    return `${signingInput}.${signature}`
}

/**
 * Verifies a HS256 JWT and returns its decoded payload.
 *
 * Throws if the token is malformed, the signature does not match, or the
 * token has expired.
 */
export function verifyToken(token: string, secret: string): JwtPayload {
    const parts = token.split('.')
    if (parts.length !== 3) {
        throw new Error('Invalid JWT: expected 3 parts')
    }

    const [header, payload, receivedSignature] = parts
    const signingInput = `${header}.${payload}`
    const expectedSignature = hmacSha256Base64url(signingInput, secret)

    // Constant-time comparison to prevent timing attacks
    const receivedBuf = Buffer.from(receivedSignature)
    const expectedBuf = Buffer.from(expectedSignature)
    if (
        receivedBuf.length !== expectedBuf.length ||
        !timingSafeEqual(receivedBuf, expectedBuf)
    ) {
        throw new Error('Invalid JWT: signature mismatch')
    }

    const decoded = JSON.parse(base64urlDecode(payload)) as JwtPayload

    const now = Math.floor(Date.now() / 1000)
    if (decoded.exp < now) {
        throw new Error('JWT expired')
    }

    return decoded
}
