import { describe, it, expect } from 'vitest'
import { addPositionChangeIndicator } from '../utils/rankingHelper'

const baseline = [
    { btag: 'A#1' },
    { btag: 'B#2' },
    { btag: 'C#3' },
    { btag: 'D#4' },
]

describe('addPositionChangeIndicator', () => {
    it('marks moved up/down with correct deltas', () => {
        const current = [
            { btag: 'B#2' },
            { btag: 'A#1' },
            { btag: 'D#4' },
            { btag: 'C#3' },
        ]
        const out = addPositionChangeIndicator(current as any, baseline as any)
        expect(out![0].positionChangeIndicator).toBe('up')
        expect(out![0].positionDelta).toBe(1)
        expect(out![1].positionChangeIndicator).toBe('down')
        expect(out![1].positionDelta).toBe(-1)
        expect(out![2].positionChangeIndicator).toBe('up')
        expect(out![2].positionDelta).toBe(1)
        expect(out![3].positionChangeIndicator).toBe('down')
        expect(out![3].positionDelta).toBe(-1)
    })

    it('marks unchanged as none and no delta', () => {
        const current = [...baseline]
        const out = addPositionChangeIndicator(current as any, baseline as any)
        expect(out![0].positionChangeIndicator).toBe('none')
        expect(out![0].positionDelta).toBeUndefined()
    })

    it('handles new player absent from baseline', () => {
        const current = [{ btag: 'X#9' }, ...baseline]
        const out = addPositionChangeIndicator(current as any, baseline as any)
        expect(out![0].positionChangeIndicator).toBe('none')
        expect(out![0].positionDelta).toBeUndefined()
    })

    it('handles missing/empty baseline', () => {
        const out1 = addPositionChangeIndicator(
            baseline as any,
            undefined as any
        )
        expect(out1![0].positionChangeIndicator).toBe('none')
        const out2 = addPositionChangeIndicator(baseline as any, [] as any)
        expect(out2![0].positionChangeIndicator).toBe('none')
    })
})
