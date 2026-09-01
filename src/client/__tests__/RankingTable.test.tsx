import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { RankingTable } from '../components/Table/Table'
import type { DecoratedRow } from '../utils/rankingHelper'

// Controllable mock: default `undefined` matches jsdom (no matchMedia) → `?? false` → desktop path,
// so the existing cases below keep running the table branch
vi.mock('@mantine/hooks', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@mantine/hooks')>()
    return {
        ...actual,
        useMediaQuery: vi.fn(() => undefined),
    }
})

// One player per race; minimal shape — getStandardName reads `name`, and
// RankingTable only renders rows whose `rating` is truthy
const rows: DecoratedRow[] = [
    { btag: 'Z#1', rating: 5000, name: 'Z', mainRace: 'ZERG', positionChangeIndicator: 'none' },
    { btag: 'P#1', rating: 4900, name: 'P', mainRace: 'PROTOSS', positionChangeIndicator: 'none' },
    { btag: 'T#1', rating: 4800, name: 'T', mainRace: 'TERRAN', positionChangeIndicator: 'none' },
    { btag: 'R#1', rating: 4700, name: 'R', mainRace: 'RANDOM', positionChangeIndicator: 'none' },
]

const wrap = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

const allRows = () => {
    expect(screen.getByText('Z')).toBeTruthy()
    expect(screen.getByText('P')).toBeTruthy()
    expect(screen.getByText('T')).toBeTruthy()
    expect(screen.getByText('R')).toBeTruthy()
}

describe('RankingTable race chip toggle', () => {
    it('renders one chip per race with the player count', () => {
        wrap(<RankingTable data={rows} loading={false} />)

        expect(screen.getByRole('img', { name: 'zerg' })).toBeTruthy()
        expect(screen.getByRole('img', { name: 'protoss' })).toBeTruthy()
        expect(screen.getByRole('img', { name: 'terran' })).toBeTruthy()
        expect(screen.getByRole('img', { name: 'random' })).toBeTruthy()
    })

    it('clicking a race chip filters the table to that race', () => {
        wrap(<RankingTable data={rows} loading={false} />)
        allRows()

        fireEvent.click(screen.getByRole('img', { name: 'zerg' }))

        expect(screen.getByText('Z')).toBeTruthy()
        expect(screen.queryByText('P')).toBeNull()
        expect(screen.queryByText('T')).toBeNull()
        expect(screen.queryByText('R')).toBeNull()
    })

    it('keeps the race icon visible on every chip, selected or not', () => {
        wrap(<RankingTable data={rows} loading={false} />)
        fireEvent.click(screen.getByRole('img', { name: 'zerg' }))

        expect(screen.getByRole('img', { name: 'zerg' })).toBeTruthy()
        expect(screen.getByRole('img', { name: 'protoss' })).toBeTruthy()
        expect(screen.getByRole('img', { name: 'terran' })).toBeTruthy()
        expect(screen.getByRole('img', { name: 'random' })).toBeTruthy()

        const zergCheckbox = screen.getByRole('checkbox', { name: /zerg/i })
        expect((zergCheckbox as HTMLInputElement).checked).toBe(true)
        expect((screen.getByRole('checkbox', { name: /protoss/i }) as HTMLInputElement).checked).toBe(false)
    })

    it('renders the column menu trigger in the same row as the chips', () => {
        wrap(<RankingTable data={rows} loading={false} />)

        const trigger = screen.getByRole('button', { name: 'Select Columns To Display' })
        const zergChip = screen.getByRole('img', { name: 'zerg' })

        // Both the trigger and the chips live in the same Flex row
        const chipsRow = zergChip.closest('.mantine-Flex-root') as HTMLElement
        expect(chipsRow).toBeTruthy()
        expect(trigger.parentElement).toBe(chipsRow)
    })

    it('clicking the selected chip again restores all rows', () => {
        wrap(<RankingTable data={rows} loading={false} />)

        fireEvent.click(screen.getByRole('img', { name: 'zerg' }))
        expect(screen.queryByText('P')).toBeNull()

        fireEvent.click(screen.getByRole('img', { name: 'zerg' }))

        allRows()
    })
})

describe('RankingTable mobile branch (S21-T7)', () => {
    it('renders the card list, not a table, and hides the column trigger at the 48em breakpoint', () => {
        vi.mocked(useMediaQuery).mockReturnValue(true)

        wrap(<RankingTable data={rows} loading={false} onOpenH2HQuickView={vi.fn()} />)

        expect(document.querySelector('table')).toBeNull()
        for (const name of ['Z', 'P', 'T', 'R']) {
            expect(screen.getByRole('button', { name: `Open H2H with ${name}` })).toBeTruthy()
        }
        expect(screen.queryByRole('button', { name: 'Select Columns To Display' })).toBeNull()

        vi.mocked(useMediaQuery).mockReturnValue(undefined)
    })

    it('race chips still filter the list on small screens', () => {
        vi.mocked(useMediaQuery).mockReturnValue(true)

        wrap(<RankingTable data={rows} loading={false} />)
        allRows()

        fireEvent.click(screen.getByRole('img', { name: 'zerg' }))

        expect(screen.getByRole('button', { name: 'Open H2H with Z' })).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Open H2H with P' })).toBeNull()

        vi.mocked(useMediaQuery).mockReturnValue(undefined)
    })
})
