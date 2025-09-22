import bronze from '../assets/Bronze.png'
import silver from '../assets/Silver.png'
import gold from '../assets/Gold.png'
import plat from '../assets/Platinum.png'
import diamond from '../assets/Diamond.png'
import master from '../assets/Master.png'
import gm from '../assets/Grandmaster.png'
import unknownRank from '../assets/unknownRank.svg'

 // Directional indicator for position movement
 export type Indicator = 'up' | 'down' | 'none'
type RowWithBtag = { btag?: string; [key: string]: any }
export type DecoratedRow = RowWithBtag & { positionChangeIndicator: Indicator; positionDelta?: number }

export const getLeagueSrc = (leagueType: number) => {
    switch (leagueType) {
        case 0:
            return bronze
        case 1:
            return silver
        case 2:
            return gold
        case 3:
            return plat
        case 4:
            return diamond
        case 5:
            return master
        case 6:
            return gm
        default:
            return unknownRank
    }
}

export const addPositionChangeIndicator = (
    current: RowWithBtag[] | null,
    baseline: RowWithBtag[] | null
): DecoratedRow[] | null => {
    if (!current) return null
    if (!Array.isArray(baseline) || baseline.length === 0) {
        return current.map((row) => ({ ...row, positionChangeIndicator: 'none' }))
    }

    // Fast lookup: map each player's battle tag to their previous index
    const previousIndexByBtag = new Map<string, number>()
    baseline.forEach((row, index) => {
        if (row?.btag) previousIndexByBtag.set(row.btag, index)
    })

    return current.map((row, currentIndex) => {
        const btag = row?.btag
        const previousIndex = btag ? previousIndexByBtag.get(btag) : undefined
        if (typeof previousIndex !== 'number') {
            // New player relative to baseline or missing btag → no indicator
            return { ...row, positionChangeIndicator: 'none' }
        }
        const delta = previousIndex - currentIndex // positive → moved up
        if (delta > 0) {
            return { ...row, positionChangeIndicator: 'up', positionDelta: delta }
        }
        if (delta < 0) {
            return { ...row, positionChangeIndicator: 'down', positionDelta: delta }
        }
        return { ...row, positionChangeIndicator: 'none' }
    })
}

export const addOnlineIndicator = (lastPlayed: string, online: boolean) => {
    if (online) {
		return '🟢'
	}
    return lastPlayed
}

