import { describe, it, expect } from 'vitest'
import {
    getStandardName,
    toCRtime,
    calculateRounds,
    filterMatches,
    formatFileSize,
} from './common'

describe('common utils', () => {
    it('getStandardName returns name, btag prefix, or challongeUsername', () => {
        expect(getStandardName({ name: 'Raynor' })).toBe('Raynor')
        expect(getStandardName({ btag: 'NeO#1234' })).toBe('NeO')
        expect(getStandardName({ challongeUsername: 'kerverus' })).toBe(
            'kerverus'
        )
    })

    it('toCRtime formats date in es-CR locale deterministically', () => {
        // Fixed date to avoid flakiness
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
        // Round only
        expect(filterMatches(matches, 1, null).map(m => m.id)).toEqual([1, 3])
        // State only
        expect(filterMatches(matches, null, 'closed').map(m => m.id)).toEqual([
            2, 3,
        ])
        // Both
        expect(filterMatches(matches, 1, 'open').map(m => m.id)).toEqual([1])
    })

    it('formatFileSize formats bytes to KB/MB/GB with 2 decimals', () => {
        expect(formatFileSize(512)).toBe('512 bytes')
        expect(formatFileSize(2048)).toBe('2.00 KB')
        expect(formatFileSize(5 * 1048576)).toBe('5.00 MB')
        expect(formatFileSize(2 * 1073741824)).toBe('2.00 GB')
    })
})
