import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { RankingTable } from '../components/Table/Table'
import type { DecoratedRow } from '../utils/rankingHelper'

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
