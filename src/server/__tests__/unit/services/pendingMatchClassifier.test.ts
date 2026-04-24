import { describe, it, expect } from 'vitest'
import { classifyPendingBucket } from '../../../services/pendingMatchClassifier'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a flat decisions array from a shorthand map (WIN/LOSS/OBSERVER). */
function decisions(...args: string[]) {
    return args
}

// ---------------------------------------------------------------------------
// Reason & inferredMode: core scenarios
// ---------------------------------------------------------------------------

describe('classifyPendingBucket — reason', () => {
    it('normal 1v1 (WIN + LOSS) → reason null', () => {
        const result = classifyPendingBucket(decisions('WIN', 'LOSS'))
        expect(result.reason).toBeNull()
    })

    it('WIN + WIN + LOSS → multi_winner', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'LOSS'))
        expect(result.reason).toBe('multi_winner')
    })

    it('2v2 (WIN WIN LOSS LOSS) → 3plus_active_after_dedup', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'LOSS', 'LOSS'))
        expect(result.reason).toBe('3plus_active_after_dedup')
    })

    it('3v3 (WIN×3 LOSS×3) → 3plus_active_after_dedup', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'WIN', 'LOSS', 'LOSS', 'LOSS'))
        expect(result.reason).toBe('3plus_active_after_dedup')
    })

    it('4v4 (WIN×4 LOSS×4) → 3plus_active_after_dedup', () => {
        const result = classifyPendingBucket(
            decisions('WIN', 'WIN', 'WIN', 'WIN', 'LOSS', 'LOSS', 'LOSS', 'LOSS')
        )
        expect(result.reason).toBe('3plus_active_after_dedup')
    })

    it('uneven sides (WIN×3 LOSS×2) → uneven_active_sides', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'WIN', 'LOSS', 'LOSS'))
        expect(result.reason).toBe('uneven_active_sides')
    })

    it('uneven sides (WIN×2 LOSS×3) → uneven_active_sides', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'LOSS', 'LOSS', 'LOSS'))
        expect(result.reason).toBe('uneven_active_sides')
    })

    it('< 3 active with lossCount 0 (WIN WIN) → reason null (not stageable)', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN'))
        expect(result.reason).toBeNull()
    })
})

// ---------------------------------------------------------------------------
// inferredMode
// ---------------------------------------------------------------------------

describe('classifyPendingBucket — inferredMode', () => {
    it('multi_winner (WIN WIN LOSS) → inferredMode unknown (3 active, mixed)', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'LOSS'))
        expect(result.inferredMode).toBe('unknown')
    })

    it('2v2 → inferredMode 2v2', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'LOSS', 'LOSS'))
        expect(result.inferredMode).toBe('2v2')
    })

    it('3v3 → inferredMode 3v3', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'WIN', 'LOSS', 'LOSS', 'LOSS'))
        expect(result.inferredMode).toBe('3v3')
    })

    it('4v4 → inferredMode 4v4', () => {
        const result = classifyPendingBucket(
            decisions('WIN', 'WIN', 'WIN', 'WIN', 'LOSS', 'LOSS', 'LOSS', 'LOSS')
        )
        expect(result.inferredMode).toBe('4v4')
    })

    it('uneven sides (WIN×3 LOSS×2) → inferredMode uneven', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'WIN', 'LOSS', 'LOSS'))
        expect(result.inferredMode).toBe('uneven')
    })

    it('all-WIN (FFA pattern) → inferredMode ffa', () => {
        const result = classifyPendingBucket(decisions('WIN', 'WIN', 'WIN'))
        expect(result.inferredMode).toBe('ffa')
    })

    it('all-LOSS (FFA pattern) → inferredMode ffa', () => {
        const result = classifyPendingBucket(decisions('LOSS', 'LOSS', 'LOSS'))
        expect(result.inferredMode).toBe('ffa')
    })
})

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

describe('classifyPendingBucket — counts', () => {
    it('counts observers and excludes them from activePlayerCount', () => {
        // WIN + LOSS + OBSERVER = 1v1 with observer
        const result = classifyPendingBucket(decisions('WIN', 'LOSS', 'OBSERVER'))
        expect(result.activePlayerCount).toBe(2)
        expect(result.observerCount).toBe(1)
        expect(result.winCount).toBe(1)
        expect(result.lossCount).toBe(1)
    })

    it('2v2 with 1 observer: counts', () => {
        const result = classifyPendingBucket(
            decisions('WIN', 'WIN', 'LOSS', 'LOSS', 'OBSERVER')
        )
        expect(result.activePlayerCount).toBe(4)
        expect(result.observerCount).toBe(1)
        expect(result.winCount).toBe(2)
        expect(result.lossCount).toBe(2)
    })

    it('decision strings are case-insensitive', () => {
        const result = classifyPendingBucket(['win', 'loss'])
        expect(result.reason).toBeNull()
        expect(result.winCount).toBe(1)
        expect(result.lossCount).toBe(1)
    })
})

// ---------------------------------------------------------------------------
// Evidence preservation: cardinality unchanged by classifier
// ---------------------------------------------------------------------------

describe('classifyPendingBucket — evidence preservation', () => {
    const scenarios = [
        { name: '2v2', input: ['WIN', 'WIN', 'LOSS', 'LOSS'] },
        { name: '3v3', input: ['WIN', 'WIN', 'WIN', 'LOSS', 'LOSS', 'LOSS'] },
        { name: '4v4', input: ['WIN', 'WIN', 'WIN', 'WIN', 'LOSS', 'LOSS', 'LOSS', 'LOSS'] },
        { name: 'uneven', input: ['WIN', 'WIN', 'WIN', 'LOSS', 'LOSS'] },
        { name: 'multi_winner', input: ['WIN', 'WIN', 'LOSS'] },
    ]

    for (const { name, input } of scenarios) {
        it(`${name}: classifier does not mutate input array`, () => {
            const copy = [...input]
            classifyPendingBucket(input)
            expect(input).toEqual(copy)
        })

        it(`${name}: activePlayerCount + observerCount equals input length`, () => {
            const result = classifyPendingBucket(input)
            // No observers in these fixtures, so activePlayerCount === input.length
            expect(result.activePlayerCount + result.observerCount).toBe(input.length)
        })
    }
})
