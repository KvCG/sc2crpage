import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { MantineProvider, Table } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import { RankingTable } from './Table'
import { RankingTableRow } from './RankingTableRow'
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

const allColumns = {
    top: true,
    name: true,
    mmr: true,
    rank: true,
    race: true,
    terran: true,
    protoss: true,
    zerg: true,
    random: true,
    total: true,
    lastPlayed: true,
}

describe('RankingTable SC2 polish — width & density (S20-T4)', () => {
    it('table is full-width, md bottom margin, 6px row spacing, no 700px cap', () => {
        const { container } = render(
            <MemoryRouter>
                <MantineProvider>
                    <RankingTable data={rows} loading={false} />
                </MantineProvider>
            </MemoryRouter>
        )

        const table = container.querySelector('table')
        expect(table, 'table element should be rendered').toBeTruthy()

        const tableEl = table as HTMLTableElement
        // verticalSpacing="6" → 6px (Kevin: 10px y 8px se veían demasiado espaciados)
        expect(tableEl.style.getPropertyValue('--table-vertical-spacing')).toBe('calc(0.375rem * var(--mantine-scale))')
        // mb={50} → mb="md"
        expect(tableEl.style.marginBottom).toBe('var(--mantine-spacing-md)')
        // full width, mobile min kept (Mantine renders miw={250} as a rem calc — pre-existing behavior)
        expect(tableEl.style.width).toBe('100%')
        expect(tableEl.style.minWidth).toBe('calc(15.625rem * var(--mantine-scale))')

        // maw={700} removed from both <Table> and the <Skeleton> wrapper
        for (const el of Array.from(container.querySelectorAll('*'))) {
            expect((el as HTMLElement).style.maxWidth, 'unexpected max-width: 700px cap').not.toBe('700px')
        }
    })

    it('MMR header and MMR cell share the .mmr alignment class', () => {
        const { container } = render(
            <MemoryRouter>
                <MantineProvider>
                    <RankingTable data={rows} loading={false} />
                </MantineProvider>
            </MemoryRouter>
        )

        const ths = Array.from(container.querySelectorAll('th'))
        const mmrHeader = ths.find(th => th.textContent === 'MMR')
        expect(mmrHeader, 'MMR header should exist').toBeTruthy()

        const tds = Array.from(container.querySelectorAll('td'))
        const mmrCell = tds.find(td => td.textContent === '3500')
        expect(mmrCell, 'MMR cell should exist').toBeTruthy()

        // th and td carry Mantine element classes that differ (mantine-Table-th vs -td),
        // so compare the CSS-module class token itself
        const mmHeaderClass = mmrHeader!.className.split(' ').find(t => t.startsWith('_mmr_'))
        const mmCellClass = mmrCell!.className.split(' ').find(t => t.startsWith('_mmr_'))
        expect(mmHeaderClass, 'MMR header should carry the alignment class').toBeTruthy()
        expect(mmCellClass, 'MMR cell should carry the alignment class').toBeTruthy()
        expect(mmCellClass).toBe(mmHeaderClass)

        // a plain numeric cell must not carry it
        const plainCell = tds.find(td => td.textContent === '100')
        expect(plainCell).toBeTruthy()
        expect(plainCell!.className).not.toContain('_mmr_')
    })
})

describe('RankingTableRow league icon (S20-T4)', () => {
    function renderRow(leagueType: number) {
        return render(
            <MantineProvider>
                <Table>
                    <Table.Tbody>
                        <RankingTableRow
                            row={{
                                btag: 'Pistola#1234',
                                rating: 5300,
                                mainRace: 'TERRAN',
                                leagueType,
                                positionChangeIndicator: 'none',
                                lastDatePlayed: '-',
                                gamesPerRace: { TERRAN: 100 },
                                totalGames: 100,
                                online: false,
                            }}
                            index={0}
                            visibleColumns={allColumns}
                        />
                    </Table.Tbody>
                </Table>
            </MantineProvider>
        )
    }

    it('shows the league name in title for known leagueTypes', () => {
        renderRow(6)
        expect(screen.getByAltText('league')).toHaveAttribute('title', 'Grandmaster')
    })

    it('falls back to Unranked for unknown leagueTypes', () => {
        renderRow(-1)
        expect(screen.getByAltText('league')).toHaveAttribute('title', 'Unranked')
    })
})

describe('Table.module.css SC2 polish contract (S20-T4)', () => {
    it('.mmr right-aligns with tabular numerals', () => {
        const r = rule('.mmr')
        expect(r).toContain('text-align: right')
        expect(r).toContain('font-variant-numeric: tabular-nums')
    })

    it('.posIndicator is sharper (opacity 0.95, not 0.7)', () => {
        const r = rule('.posIndicator')
        expect(r).toContain('opacity: 0.95')
        expect(r).not.toContain('opacity: 0.7')
    })

    it('league icon renders at 22px', () => {
        const r = rule('.league')
        expect(r).toContain('22px')
    })

    it('race backgrounds and the 30em sticky-column block are untouched', () => {
        expect(rule('.zerg')).toContain('rgba(103, 0, 129, 0.3)')
        expect(rule('.terran')).toContain('rgba(25, 0, 255, 0.3)')
        expect(rule('.protoss')).toContain('rgba(34, 182, 42, 0.3)')
        expect(rule('.random')).toContain('rgba(239, 240, 226, 0.288)')

        const media = css.indexOf('@media (max-width: 30em)')
        expect(media, 'max-width: 30em media query should exist').toBeGreaterThan(-1)
        const mediaBlock = css.slice(media)
        expect(mediaBlock).toContain('position: sticky')
        expect(mediaBlock).toContain('left: 0px')
    })
})
