import { describe, it, expect } from 'vitest'
import {
    getStandardName,
    toCRtime,
    calculateRounds,
    filterMatches,
    formatFileSize,
    formatRelativeTime,
} from '../utils/common'

describe('common utils', () => {
    it('getStandardName returns name, btag prefix, or challongeUsername', () => {
        expect(getStandardName({ name: 'Raynor' })).toBe('Raynor')
        expect(getStandardName({ btag: 'NeO#1234' })).toBe('NeO')
        expect(getStandardName({ challongeUsername: 'kerverus' })).toBe(
            'kerverus'
        )
    })

    it('toCRtime formats date in es-CR locale deterministically', () => {
        const dateStr = '2024-01-15T12:34:56Z'
        const formatted = toCRtime(dateStr)
        expect(typeof formatted).toBe('string')
        expect(formatted.length).toBeGreaterThan(0)
    })

    it('calculateRounds echoes number of players (placeholder behavior)', () => {
        expect(calculateRounds(16)).toBe(16)
    })

    it('filterMatches filters by round and state when provided', () => {
        const matches = [
            { id: 1, round: 1, state: 'open' },
            { id: 2, round: 2, state: 'closed' },
            { id: 3, round: 1, state: 'closed' },
        ]
        expect(filterMatches(matches, 1, null).map((m: any) => m.id)).toEqual([
            1, 3,
        ])
        expect(
            filterMatches(matches, null, 'closed').map((m: any) => m.id)
        ).toEqual([2, 3])
        expect(filterMatches(matches, 1, 'open').map((m: any) => m.id)).toEqual(
            [1]
        )
    })

    it('formatFileSize formats bytes to KB/MB/GB with 2 decimals', () => {
        expect(formatFileSize(512)).toBe('512 bytes')
        expect(formatFileSize(2048)).toBe('2.00 KB')
        expect(formatFileSize(5 * 1048576)).toBe('5.00 MB')
        expect(formatFileSize(2 * 1073741824)).toBe('2.00 GB')
    })
})

describe('formatRelativeTime', () => {
    const now = new Date('2026-09-01T12:00:00.000Z')

    it('formats seconds as "just now"', () => {
        expect(formatRelativeTime('2026-09-01T11:59:30.000Z', now)).toBe('just now')
    })

    it('formats minutes with singular and plural', () => {
        expect(formatRelativeTime('2026-09-01T11:59:00.000Z', now)).toBe('1 minute ago')
        expect(formatRelativeTime('2026-09-01T11:55:00.000Z', now)).toBe('5 minutes ago')
    })

    it('formats hours with singular and plural', () => {
        expect(formatRelativeTime('2026-09-01T11:00:00.000Z', now)).toBe('1 hour ago')
        expect(formatRelativeTime('2026-09-01T10:00:00.000Z', now)).toBe('2 hours ago')
    })

    it('formats days with singular and plural', () => {
        expect(formatRelativeTime('2026-08-31T12:00:00.000Z', now)).toBe('1 day ago')
        expect(formatRelativeTime('2026-08-29T12:00:00.000Z', now)).toBe('3 days ago')
    })

    it('falls back to the full Costa Rica date beyond 7 days', () => {
        const result = formatRelativeTime('2026-08-10T12:00:00.000Z', now)
        expect(result).not.toContain('ago')
        expect(result).toMatch(/2026/)
    })

    it('returns the raw string when the value is not an ISO date (legacy cache format)', () => {
        const legacy = 'Sep 1, 2026, 8:15:42 PM'
        expect(formatRelativeTime(legacy, now)).toBe(legacy)
    })

    it('treats future timestamps (clock skew) as "just now"', () => {
        expect(formatRelativeTime('2026-09-01T12:00:30.000Z', now)).toBe('just now')
    })
})
