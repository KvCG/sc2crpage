import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { RankingCardList } from './RankingCardList'
import type { DecoratedRow } from '../../utils/rankingHelper'
import type { H2HQuickViewPlayer } from '../../types/h2hQuickView'

// Resolved from the project root — vitest runs from the repo root (see vitest.client.config.ts include)
const css = readFileSync('src/client/components/Table/RankingCardList.module.css', 'utf-8')

/** Returns the first rule body for a selector, e.g. rule('.row') → ".row { ... }" */
function rule(selector: string): string {
    const marker = selector + ' {'
    const start = css.indexOf(marker)
    expect(start, `CSS rule ${selector} not found in RankingCardList.module.css`).toBeGreaterThan(-1)
    const end = css.indexOf('}', start)
    return css.slice(start, end + 1)
}

const rows: DecoratedRow[] = [
    {
        id: 11,
        name: 'Tortuguero-Guanacaste',
        btag: 'Tortuguero#1',
        rating: 3450,
        mainRace: 'ZERG',
        leagueType: 4,
        positionChangeIndicator: 'up',
        positionDelta: 2,
        lastDatePlayed: '2026-08-30',
        gamesPerRace: { ZERG: 40 },
        totalGames: 40,
        online: true,
    } as unknown as DecoratedRow,
    {
        id: 22,
        name: 'DobleR',
        btag: 'DobleR#42',
        rating: 3100,
        mainRace: 'TERRAN',
        leagueType: 1,
        positionChangeIndicator: 'none',
        lastDatePlayed: '2026-08-29',
        gamesPerRace: { TERRAN: 60 },
        totalGames: 60,
        online: false,
    } as unknown as DecoratedRow,
    {
        id: 'not-a-number',
        name: 'SinId',
        btag: 'SinId#99',
        rating: 2900,
        mainRace: 'PROTOSS',
        leagueType: 0,
        positionChangeIndicator: 'none',
        lastDatePlayed: '-',
        gamesPerRace: { PROTOSS: 10 },
        totalGames: 10,
        online: false,
    } as unknown as DecoratedRow,
    {
        id: 33,
        name: 'SinMmr',
        btag: 'SinMmr#7',
        rating: null,
        mainRace: 'RANDOM',
        leagueType: 2,
        positionChangeIndicator: 'none',
        lastDatePlayed: '-',
        gamesPerRace: {},
        totalGames: 0,
        online: false,
    } as unknown as DecoratedRow,
]

describe('RankingCardList (SC2CR-S21-T6)', () => {
    beforeEach(() => vi.clearAllMocks())

    it('renders one row per player with truthy rating and none for the others', () => {
        render(
            <MantineProvider>
                <RankingCardList data={rows} />
            </MantineProvider>
        )

        const rowsOnScreen = screen.getAllByRole('button')
        expect(rowsOnScreen).toHaveLength(3)
        expect(screen.queryByText('SinMmr')).toBeNull()
    })

    it('shows the full player name untruncated', () => {
        render(
            <MantineProvider>
                <RankingCardList data={rows} />
            </MantineProvider>
        )

        const row = screen.getByRole('button', { name: 'Open H2H with Tortuguero-Guanacaste' })
        expect(row.textContent).toContain('Tortuguero-Guanacaste')
    })

    it('renders each row as a <button> with the H2H aria-label', () => {
        render(
            <MantineProvider>
                <RankingCardList data={rows} />
            </MantineProvider>
        )

        for (const name of ['Tortuguero-Guanacaste', 'DobleR', 'SinId']) {
            const row = screen.getByRole('button', { name: `Open H2H with ${name}` })
            expect(row.tagName).toBe('BUTTON')
            expect(row).toHaveAttribute('type', 'button')
        }
    })

    it('calls onOpenH2HQuickView with the player fields on row click', () => {
        const onOpen = vi.fn()
        render(
            <MantineProvider>
                <RankingCardList data={rows} onOpenH2HQuickView={onOpen} />
            </MantineProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: 'Open H2H with Tortuguero-Guanacaste' }))

        expect(onOpen).toHaveBeenCalledTimes(1)
        expect(onOpen).toHaveBeenCalledWith({
            characterId: 11,
            displayName: 'Tortuguero-Guanacaste',
            btag: 'Tortuguero#1',
            mmr: 3450,
            mainRace: 'ZERG',
            leagueType: 4,
        } satisfies H2HQuickViewPlayer)
    })

    it('disables the button and skips the callback when row.id is not a number', () => {
        const onOpen = vi.fn()
        render(
            <MantineProvider>
                <RankingCardList data={rows} onOpenH2HQuickView={onOpen} />
            </MantineProvider>
        )

        const row = screen.getByRole('button', { name: 'Open H2H with SinId' })
        expect(row).toBeDisabled()

        fireEvent.click(row)
        expect(onOpen).not.toHaveBeenCalled()
    })

    it('declares min-height: 44px on the row rule', () => {
        expect(rule('.row')).toContain('min-height: 44px')
    })
})
