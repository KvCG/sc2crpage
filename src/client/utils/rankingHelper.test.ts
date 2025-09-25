import { describe, it, expect } from 'vitest'
import { addPositionChangeIndicator } from './rankingHelper'

const baseline = [
  { btag: 'A#1' },
  { btag: 'B#2' },
  { btag: 'C#3' },
  { btag: 'D#4' },
]

describe('addPositionChangeIndicator', () => {
  it('marks moved up/down with correct deltas', () => {
    const current = [
      { btag: 'B#2' }, // from 1 -> 0 delta +1 (up)
      { btag: 'A#1' }, // from 0 -> 1 delta -1 (down)
      { btag: 'D#4' }, // from 3 -> 2 delta +1 (up)
      { btag: 'C#3' }, // from 2 -> 3 delta -1 (down)
    ]
    const out = addPositionChangeIndicator(current, baseline)
    expect(out[0].positionChangeIndicator).toBe('up')
    expect(out[0].positionDelta).toBe(1)
    expect(out[1].positionChangeIndicator).toBe('down')
    expect(out[1].positionDelta).toBe(-1)
    expect(out[2].positionChangeIndicator).toBe('up')
    expect(out[2].positionDelta).toBe(1)
    expect(out[3].positionChangeIndicator).toBe('down')
    expect(out[3].positionDelta).toBe(-1)
  })

  it('marks unchanged as none and no delta', () => {
    const current = [...baseline]
    const out = addPositionChangeIndicator(current, baseline)
    expect(out[0].positionChangeIndicator).toBe('none')
    expect(out[0].positionDelta).toBeUndefined()
  })

  it('handles new player absent from baseline', () => {
    const current = [{ btag: 'X#9' }, ...baseline]
    const out = addPositionChangeIndicator(current, baseline)
    expect(out[0].positionChangeIndicator).toBe('none')
    expect(out[0].positionDelta).toBeUndefined()
  })

  it('handles missing/empty baseline', () => {
    const out1 = addPositionChangeIndicator(baseline, undefined)
    expect(out1[0].positionChangeIndicator).toBe('none')
    const out2 = addPositionChangeIndicator(baseline, [])
    expect(out2[0].positionChangeIndicator).toBe('none')
  })
})
