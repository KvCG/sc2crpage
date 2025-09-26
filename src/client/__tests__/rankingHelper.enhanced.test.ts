import { describe, it, expect } from 'vitest'
import { addPositionChangeIndicator, getLeagueSrc, addOnlineIndicator } from '../utils/rankingHelper'

// Import league assets for testing
import bronze from '../assets/Bronze.png'
import silver from '../assets/Silver.png'
import gold from '../assets/Gold.png'
import plat from '../assets/Platinum.png'
import diamond from '../assets/Diamond.png'
import master from '../assets/Master.png'
import gm from '../assets/Grandmaster.png'
import unknownRank from '../assets/unknownRank.svg'

const sampleBaseline = [
    { btag: 'Player1#1234' },
    { btag: 'Player2#5678' },
    { btag: 'Player3#9012' },
    { btag: 'Player4#3456' },
]

describe('rankingHelper enhanced tests', () => {
    describe('addPositionChangeIndicator', () => {
        it('handles null current data gracefully', () => {
            const result = addPositionChangeIndicator(null, sampleBaseline as any)
            expect(result).toBe(null)
        })

        it('handles empty current array', () => {
            const result = addPositionChangeIndicator([], sampleBaseline as any)
            expect(result).toEqual([])
        })

        it('handles null baseline gracefully', () => {
            const current = [{ btag: 'Player1#1234' }]
            const result = addPositionChangeIndicator(current as any, null)
            
            expect(result).toEqual([
                { btag: 'Player1#1234', positionChangeIndicator: 'none' }
            ])
        })

        it('handles empty baseline array', () => {
            const current = [{ btag: 'Player1#1234' }]
            const result = addPositionChangeIndicator(current as any, [])
            
            expect(result).toEqual([
                { btag: 'Player1#1234', positionChangeIndicator: 'none' }
            ])
        })

        it('marks players missing from baseline as none', () => {
            const current = [
                { btag: 'NewPlayer#7777' },
                { btag: 'Player1#1234' },
                { btag: 'AnotherNew#8888' }
            ]
            
            const result = addPositionChangeIndicator(current as any, sampleBaseline as any)
            
            expect(result![0].positionChangeIndicator).toBe('none')
            expect(result![0].positionDelta).toBeUndefined()
            expect(result![1].positionChangeIndicator).toBe('down') // Player1 moved from 0 to 1
            expect(result![2].positionChangeIndicator).toBe('none')
        })

        it('handles players with missing btag', () => {
            const current = [
                { btag: undefined },
                { btag: null },
                { btag: '' },
                { btag: 'Player1#1234' }
            ]
            
            const result = addPositionChangeIndicator(current as any, sampleBaseline as any)
            
            expect(result![0].positionChangeIndicator).toBe('none')
            expect(result![1].positionChangeIndicator).toBe('none')
            expect(result![2].positionChangeIndicator).toBe('none')
            expect(result![3].positionChangeIndicator).toBe('down') // Player1 moved from 0 to 3
        })

        it('correctly calculates large position changes', () => {
            const current = [
                { btag: 'Player4#3456' }, // From position 3 to 0 = +3
                { btag: 'Player1#1234' }, // From position 0 to 1 = -1
            ]
            
            const result = addPositionChangeIndicator(current as any, sampleBaseline as any)
            
            expect(result![0].positionChangeIndicator).toBe('up')
            expect(result![0].positionDelta).toBe(3)
            expect(result![1].positionChangeIndicator).toBe('down')
            expect(result![1].positionDelta).toBe(-1)
        })

        it('preserves other player properties', () => {
            const current = [
                { 
                    btag: 'Player1#1234', 
                    rating: 3500, 
                    league: 'MASTER',
                    customProp: 'test'
                }
            ]
            
            const result = addPositionChangeIndicator(current as any, sampleBaseline as any)
            
            expect(result![0]).toMatchObject({
                btag: 'Player1#1234',
                rating: 3500,
                league: 'MASTER',
                customProp: 'test',
                positionChangeIndicator: 'none'
            })
        })

        it('handles duplicate btags in baseline', () => {
            const duplicateBaseline = [
                { btag: 'Player1#1234' },
                { btag: 'Player1#1234' }, // Duplicate
                { btag: 'Player2#5678' }
            ]
            
            const current = [{ btag: 'Player1#1234' }]
            
            const result = addPositionChangeIndicator(current as any, duplicateBaseline as any)
            
            // Should use the first occurrence (index 0)
            expect(result![0].positionChangeIndicator).toBe('none')
        })
    })

    describe('getLeagueSrc', () => {
        it('returns correct asset for each league type', () => {
            expect(getLeagueSrc(0)).toBe(bronze)
            expect(getLeagueSrc(1)).toBe(silver)
            expect(getLeagueSrc(2)).toBe(gold)
            expect(getLeagueSrc(3)).toBe(plat)
            expect(getLeagueSrc(4)).toBe(diamond)
            expect(getLeagueSrc(5)).toBe(master)
            expect(getLeagueSrc(6)).toBe(gm)
        })

        it('returns unknown rank for invalid league types', () => {
            expect(getLeagueSrc(-1)).toBe(unknownRank)
            expect(getLeagueSrc(7)).toBe(unknownRank)
            expect(getLeagueSrc(999)).toBe(unknownRank)
            expect(getLeagueSrc(null as any)).toBe(unknownRank)
            expect(getLeagueSrc(undefined as any)).toBe(unknownRank)
            expect(getLeagueSrc('invalid' as any)).toBe(unknownRank)
        })
    })

    describe('addOnlineIndicator', () => {
        it('returns green dot for online players', () => {
            const result = addOnlineIndicator('2024-01-01T10:00:00Z', true)
            expect(result).toBe('🟢')
        })

        it('returns last played date for offline players', () => {
            const lastPlayed = '2024-01-01T10:00:00Z'
            const result = addOnlineIndicator(lastPlayed, false)
            expect(result).toBe(lastPlayed)
        })

        it('handles empty or invalid lastPlayed when online', () => {
            expect(addOnlineIndicator('', true)).toBe('🟢')
            expect(addOnlineIndicator(null as any, true)).toBe('🟢')
            expect(addOnlineIndicator(undefined as any, true)).toBe('🟢')
        })

        it('handles empty or invalid lastPlayed when offline', () => {
            expect(addOnlineIndicator('', false)).toBe('')
            expect(addOnlineIndicator(null as any, false)).toBe(null)
            expect(addOnlineIndicator(undefined as any, false)).toBe(undefined)
        })
    })
})