import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import { RankingTable } from './Table'
import type { DecoratedRow } from '../../utils/rankingHelper'

// Resolved from the project root — vitest runs from the repo root (see vitest.client.config.ts include)
const css = readFileSync('src/client/components/Table/Table.module.css', 'utf-8')

/** Returns the first rule body for a selector, e.g. rule('.mmr') → ".mmr { ... }" */
function rule(selector: string): string {
    const marker = selector + ' {'
    const start = css.indexOf(marker)
    expect(start, `CSS rule ${selector} not found in Table.module.css`).toBeGreaterThan(-1)
    const end = css.indexOf('}', start)
    return css.slice(start, end + 1)
}

const rows: DecoratedRow[] = [
    {
        btag: 'A#1',
        rating: 3500,
        mainRace: 'TERRAN',
        leagueType: 6,
        positionChangeIndicator: 'none',
        lastDatePlayed: '-',
        gamesPerRace: { TERRAN: 100 },
        totalGames: 100,
    } as unknown as DecoratedRow,
]

describe('RankingTable panel & hairlines (S21-T10)', () => {
    it('.tableContainer is the chamfered panel', () => {
        const r = rule('.tableContainer')
        expect(r).toContain(
            'clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))'
        )
        expect(r).toContain('background: var(--mantine-color-dark-6)')
        expect(r).toContain('border: 1px solid var(--mantine-color-dark-4)')
    })

    it('the <Table> no longer receives striped — no Mantine striping in the DOM', () => {
        const { container } = render(
            <MemoryRouter>
                <MantineProvider>
                    <RankingTable data={rows} loading={false} />
                </MantineProvider>
            </MemoryRouter>
        )

        // Mantine implements striped with data-striped on the rows + a --table-striped-color var on the table
        expect(container.querySelectorAll('[data-striped]')).toHaveLength(0)
        const table = container.querySelector('table') as HTMLTableElement
        expect(table, 'table element should be rendered').toBeTruthy()
        expect(table.style.getPropertyValue('--table-striped-color')).toBe('')
    })
})
