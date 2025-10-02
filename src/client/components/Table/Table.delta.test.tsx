import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { RankingTable } from './Table'

describe('RankingTable position delta rendering', () => {
    it('renders ▲ N and ▼ N for moved rows, hides for none', () => {
        const rows = [
            {
                btag: 'B#2',
                rating: 3500,
                mainRace: 'ZERG',
                leagueType: 6,
                positionChangeIndicator: 'up',
                positionDelta: 3,
                lastDatePlayed: '-',
                gamesPerRace: {},
            },
            {
                btag: 'A#1',
                rating: 3400,
                mainRace: 'TERRAN',
                leagueType: 5,
                positionChangeIndicator: 'down',
                positionDelta: -2,
                lastDatePlayed: '-',
                gamesPerRace: {},
            },
            {
                btag: 'X#9',
                rating: 3300,
                mainRace: 'PROTOSS',
                leagueType: 4,
                positionChangeIndicator: 'none',
                lastDatePlayed: '-',
                gamesPerRace: {},
            },
        ]

        render(
            <MantineProvider>
                <RankingTable data={rows as any} loading={false} />
            </MantineProvider>
        )

        expect(screen.getByText('▲ 3')).toBeTruthy()
        expect(screen.getByText('▼ 2')).toBeTruthy()
        // Ensure no stray number rendered for 'none'
        expect(screen.queryByText(/none\s*\d+/i)).toBeNull()
    })
})
