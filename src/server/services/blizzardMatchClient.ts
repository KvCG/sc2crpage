import axios from 'axios'
import { getAccessToken } from './blizzardAuthClient'
import logger from '../logging/logger'

// ============================================================================
// Types
// ============================================================================

export interface BlizzardProfile {
    /** character.battlenetId from Pulse character-teams response */
    profileId: number
    /** character.realm from Pulse character-teams response */
    realmId: number
    /** Derived from character.region — US=1, EU=2, KR=3, CN=5 */
    regionId: number
    /** 'US' | 'EU' | 'KR' | 'CN' */
    region: string
}

export interface BlizzardPlayerMatch {
    map: string
    /** 'Custom', '1v1', '2v2', 'Coop', 'Unknown', etc. (title-case from Blizzard) */
    type: string
    /** 'Win', 'Loss', 'Tie', 'Observer', 'Left', 'Disagree' */
    decision: string
    speed: string
    /** Unix timestamp (seconds) — identical for both players in the same match */
    date: number
}

// ============================================================================
// Region maps
// ============================================================================

const REGION_ID: Record<string, number> = { US: 1, EU: 2, KR: 3, CN: 5 }

const BLIZZARD_HOST: Record<string, string> = {
    US: 'us.api.blizzard.com',
    EU: 'eu.api.blizzard.com',
    KR: 'kr.api.blizzard.com',
    CN: 'gateway.battlenet.com.cn',
}

export function regionToId(region: string): number {
    const id = REGION_ID[region.toUpperCase()]
    if (id === undefined) throw new Error(`Unknown Blizzard region: ${region}`)
    return id
}

// ============================================================================
// Rate limiter — 10 RPS
// ============================================================================

const MIN_INTERVAL_MS = 100
let lastRequestMs = 0

async function throttle(): Promise<void> {
    const now = Date.now()
    const wait = MIN_INTERVAL_MS - (now - lastRequestMs)
    if (wait > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, wait))
    }
    lastRequestMs = Date.now()
}

// ============================================================================
// API call
// ============================================================================

/**
 * Fetches the last ~25 Blizzard match history entries for the given profile.
 * Returns an empty array on network/auth errors to keep the poll cycle alive.
 */
export async function fetchPlayerMatches(profile: BlizzardProfile): Promise<BlizzardPlayerMatch[]> {
    const host = BLIZZARD_HOST[profile.region.toUpperCase()]
    if (!host) throw new Error(`Unknown Blizzard region: ${profile.region}`)

    const token = await getAccessToken()
    await throttle()

    const url = `https://${host}/sc2/legacy/profile/${profile.regionId}/${profile.realmId}/${profile.profileId}/matches`

    try {
        const res = await axios.get<{ matches: BlizzardPlayerMatch[] }>(url, {
            headers: { Authorization: `Bearer ${token}`, Connection: 'close' },
            timeout: 6_000,
        })
        return res.data.matches ?? []
    } catch (err: unknown) {
        const e = err as { response?: { status?: number }; code?: string; message?: string }
        const status = e?.response?.status
        const code = e?.code

        // 404 = profile not in Blizzard legacy API (inactive / deleted account,
        //       or stale battlenetId in Pulse — profile may have been migrated).
        // ECONNABORTED = consistent timeout (e.g. Latin America realm 2 — legacy API dead zone).
        if (status === 404) {
            logger.warn(
                {
                    feature: 'blizzard-match-client',
                    profileId: profile.profileId,
                    region: profile.region,
                    regionId: profile.regionId,
                    realmId: profile.realmId,
                },
                'Blizzard legacy profile returned 404 — profile unreachable; player matches will not be polled. Check if battlenetId is stale in Pulse.'
            )
            return []
        }
        if (code === 'ECONNABORTED') return []

        logger.warn(
            {
                feature: 'blizzard-match-client',
                profileId: profile.profileId,
                region: profile.region,
                regionId: profile.regionId,
                realmId: profile.realmId,
                status,
                code,
                message: e?.message,
            },
            'Failed to fetch Blizzard match history'
        )
        return []
    }
}
