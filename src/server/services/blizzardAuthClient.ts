import axios from 'axios'
import logger from '../logging/logger'

// ============================================================================
// Constants
// ============================================================================

const TOKEN_URL = 'https://oauth.battle.net/token'
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000 // refresh when < 5 min remain

// ============================================================================
// State
// ============================================================================

interface TokenState {
    token: string
    expiresAt: number
}

let tokenState: TokenState | null = null

/** Exposed for testing only — do not call in production code. */
export function _clearTokenCache(): void {
    tokenState = null
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Returns a valid Blizzard OAuth2 access token.
 * Caches the token for its full lifetime and auto-refreshes when less than
 * 5 minutes remain before expiry.
 *
 * Reads `BLIZZARD_CLIENT_ID` and `BLIZZARD_CLIENT_SECRET` from environment.
 */
export async function getAccessToken(): Promise<string> {
    const now = Date.now()

    if (tokenState && tokenState.expiresAt - now > REFRESH_BEFORE_EXPIRY_MS) {
        return tokenState.token
    }

    const clientId = process.env.BLIZZARD_CLIENT_ID
    const clientSecret = process.env.BLIZZARD_CLIENT_SECRET

    if (!clientId || !clientSecret) {
        throw new Error('BLIZZARD_CLIENT_ID and BLIZZARD_CLIENT_SECRET must be set')
    }

    const response = await axios.post<{ access_token: string; expires_in: number }>(
        TOKEN_URL,
        'grant_type=client_credentials',
        {
            auth: { username: clientId, password: clientSecret },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 8000,
        }
    )

    tokenState = {
        token: response.data.access_token,
        expiresAt: now + response.data.expires_in * 1000,
    }

    logger.info(
        { feature: 'blizzard-auth', expiresIn: response.data.expires_in },
        'OAuth2 token acquired'
    )

    return tokenState.token
}
