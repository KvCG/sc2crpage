import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { H2HTopPairs } from '../components/h2h/H2HTopPairs'
import type { TopPairEntry } from '../../shared/types'

// Fix date to April 19, 2026 for deterministic recency calculations
const FIXED_DATE = new Date('2026-04-19T12:00:00Z')

const makePair = (
    p1Id: number,
    p1Name: string,
    p2Id: number,
    p2Name: string,
    wins: [number, number],
    matchCount: number,
    lastMatchDate: string,
    heatScore: number,
): TopPairEntry => ({
    player1: { characterId: p1Id, btag: `${p1Name}#0001`, name: p1Name },
    player2: { characterId: p2Id, btag: `${p2Name}#0002`, name: p2Name },
    matchCount,
    player1Wins: wins[0],
    player2Wins: wins[1],
    lastMatchDate,
    heatScore,
})

// Five entries: first 3 → cards, last 2 → compact table
// Recency relative to FIXED_DATE (2026-04-19):
//   Alpha  2026-04-10 →  9 days  → Active
//   Bravo  2026-03-20 → 30 days  → Recent
//   Charlie 2026-02-01 → 77 days → Recent
//   Delta  2026-04-15 →  4 days  → Active  (table row)
//   Echo   2025-12-01 → ~140 days → no badge (table row)
const fivePairs: TopPairEntry[] = [
    makePair(1, 'Alpha', 2, 'Beta', [6, 4], 10, '2026-04-10T00:00:00', 100),
    makePair(3, 'Bravo', 4, 'Charlie', [8, 2], 10, '2026-03-20T00:00:00', 80),
    makePair(5, 'Delta', 6, 'Echo', [5, 5], 10, '2026-02-01T00:00:00', 50),
    makePair(7, 'Foxtrot', 8, 'Golf', [7, 3], 10, '2026-04-15T00:00:00', 30),
    makePair(9, 'Hotel', 10, 'India', [4, 6], 10, '2025-12-01T00:00:00', 10),
]

const wrap = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('H2HTopPairs', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(FIXED_DATE)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders top 3 entries as rivalry cards', () => {
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={vi.fn()} isLoading={false} />)
        expect(screen.getAllByTestId('h2h-rivalry-card')).toHaveLength(3)
    })

    it('renders entries 4+ in a compact table with Last Played column', () => {
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={vi.fn()} isLoading={false} />)
        expect(screen.getByText('Last Played')).toBeTruthy()
        // table entries show player names with plain win counts
        expect(screen.getByText('Foxtrot (7)')).toBeTruthy()
        expect(screen.getByText('Golf (3)')).toBeTruthy()
        expect(screen.getByText('Hotel (4)')).toBeTruthy()
        expect(screen.getByText('India (6)')).toBeTruthy()
    })

    it('renders win-split progress bar inside each rivalry card', () => {
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={vi.fn()} isLoading={false} />)
        expect(screen.getAllByTestId('win-split-bar')).toHaveLength(3)
    })

    it('renders heat intensity indicator on each card based on normalized heatScore', () => {
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={vi.fn()} isLoading={false} />)
        // Alpha: 100/100 = 1.0 → high
        // Bravo: 80/100 = 0.8  → high
        // Delta: 50/100 = 0.5  → medium
        expect(screen.getAllByTestId('heat-high')).toHaveLength(2)
        expect(screen.getAllByTestId('heat-medium')).toHaveLength(1)
    })

    it('shows active icon for pairs matched within last 30 days', () => {
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={vi.fn()} isLoading={false} />)
        // Alpha card: 9 days ago → active icon present
        expect(screen.getAllByLabelText('active').length).toBeGreaterThan(0)
    })

    it('shows no active icon for pairs matched 30 or more days ago', () => {
        const oldPair = [makePair(1, 'Zulu', 2, 'Yankee', [3, 7], 10, '2025-10-01T00:00:00', 50)]
        wrap(<H2HTopPairs pairs={oldPair} onSelectPair={vi.fn()} isLoading={false} />)
        expect(screen.queryByLabelText('active')).toBeNull()
    })

    it('clicking a rivalry card calls onSelectPair with the correct player IDs', () => {
        const onSelect = vi.fn()
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={onSelect} isLoading={false} />)
        fireEvent.click(screen.getAllByTestId('h2h-rivalry-card')[0])
        expect(onSelect).toHaveBeenCalledWith(1, 2) // Alpha(1) vs Beta(2)
    })

    it('clicking a compact table row calls onSelectPair with the correct player IDs', () => {
        const onSelect = vi.fn()
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={onSelect} isLoading={false} />)
        // Foxtrot(7) vs Golf(8) is the 4th entry → first table row
        // find via rank badge in the table cell
        fireEvent.click(screen.getByText('#4').closest('tr')!)
        expect(onSelect).toHaveBeenCalledWith(7, 8)
    })

    it('renders without error when the list has fewer than 4 entries', () => {
        wrap(<H2HTopPairs pairs={fivePairs.slice(0, 2)} onSelectPair={vi.fn()} isLoading={false} />)
        expect(screen.getAllByTestId('h2h-rivalry-card')).toHaveLength(2)
        expect(screen.queryByText('Last Played')).toBeNull()
    })

    it('renders empty state when pairs list is empty', () => {
        wrap(<H2HTopPairs pairs={[]} onSelectPair={vi.fn()} isLoading={false} />)
        expect(screen.getByText('No rivalries recorded yet')).toBeTruthy()
    })

    it('shows rank badges #1 #2 #3 on the top three cards', () => {
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={vi.fn()} isLoading={false} />)
        expect(screen.getByText('#1')).toBeTruthy()
        expect(screen.getByText('#2')).toBeTruthy()
        expect(screen.getByText('#3')).toBeTruthy()
    })

    it('clicking a card player name calls onSelectPlayer with correct id and does not call onSelectPair', () => {
        const onSelectPair = vi.fn()
        const onSelectPlayer = vi.fn()
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={onSelectPair} onSelectPlayer={onSelectPlayer} isLoading={false} />)
        fireEvent.click(screen.getByLabelText('View Alpha in Player View'))
        expect(onSelectPlayer).toHaveBeenCalledWith(1)
        expect(onSelectPair).not.toHaveBeenCalled()
    })

    it('clicking a table row player name calls onSelectPlayer with correct id and does not call onSelectPair', () => {
        const onSelectPair = vi.fn()
        const onSelectPlayer = vi.fn()
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={onSelectPair} onSelectPlayer={onSelectPlayer} isLoading={false} />)
        fireEvent.click(screen.getByLabelText('View Foxtrot in Player View'))
        expect(onSelectPlayer).toHaveBeenCalledWith(7)
        expect(onSelectPair).not.toHaveBeenCalled()
    })

    it('player names have no aria-label and no click handler when onSelectPlayer is not provided', () => {
        wrap(<H2HTopPairs pairs={fivePairs} onSelectPair={vi.fn()} isLoading={false} />)
        expect(screen.queryByLabelText(/View .* in Player View/)).toBeNull()
    })
})
