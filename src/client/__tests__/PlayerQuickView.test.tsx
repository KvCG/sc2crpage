import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import { PlayerQuickView } from '../components/h2h/PlayerQuickView'

const hoisted = vi.hoisted(() => ({
    mockUseMediaQuery: vi.fn(),
    mockGetTopH2HPairs: vi.fn(),
    mockNavigate: vi.fn(),
}))

vi.mock('@mantine/hooks', async () => {
    const actual = await vi.importActual<typeof import('@mantine/hooks')>('@mantine/hooks')
    return {
        ...actual,
        useMediaQuery: hoisted.mockUseMediaQuery,
    }
})

vi.mock('../services/api', () => ({
    getTopH2HPairs: hoisted.mockGetTopH2HPairs,
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => hoisted.mockNavigate,
    }
})

const player = {
    characterId: 101,
    displayName: 'Pistola',
    btag: 'Pistola#1234',
    mmr: 5300,
    mainRace: 'TERRAN',
    leagueType: 6,
}

const topPairsResponse = {
    data: [
        {
            player1: { characterId: 101, btag: 'Pistola#1234', name: 'Pistola' },
            player2: { characterId: 202, btag: 'Wither#5678', name: 'Wither' },
            matchCount: 10,
            player1Wins: 6,
            player2Wins: 4,
            lastMatchDate: '2026-04-10T18:00:00',
            heatScore: 90,
        },
        {
            player1: { characterId: 303, btag: 'OtherPlayer#0000', name: 'OtherPlayer' },
            player2: { characterId: 101, btag: 'Pistola#1234', name: 'Pistola' },
            matchCount: 7,
            player1Wins: 3,
            player2Wins: 4,
            lastMatchDate: '2026-04-08T20:00:00',
            heatScore: 70,
        },
    ],
}

const wrap = (ui: React.ReactElement) => render(
    <MemoryRouter>
        <MantineProvider>{ui}</MantineProvider>
    </MemoryRouter>
)

describe('PlayerQuickView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hoisted.mockGetTopH2HPairs.mockResolvedValue(topPairsResponse)
    })

    it('renders compact desktop overlay with player profile data', async () => {
        hoisted.mockUseMediaQuery.mockReturnValue(false)

        wrap(<PlayerQuickView opened player={player} onClose={vi.fn()} />)

        await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalledTimes(1))

        expect(screen.getByText('Player Quick View')).toBeTruthy()
        expect(screen.getByText('Pistola')).toBeTruthy()
        expect(screen.getByText('Pistola#1234')).toBeTruthy()
        expect(screen.getByText('Grandmaster')).toBeTruthy()
        expect(screen.getByText('5300')).toBeTruthy()
        expect(screen.getByText('TERRAN')).toBeTruthy()
        expect(screen.getByText('Rivals')).toBeTruthy()
    })

    it('closes desktop overlay when dismiss button is clicked', async () => {
        hoisted.mockUseMediaQuery.mockReturnValue(false)
        const onClose = vi.fn()

        wrap(<PlayerQuickView opened player={player} onClose={onClose} />)

        await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByRole('button', { name: /dismiss player quick view/i }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('renders mobile drawer variant with profile data', async () => {
        hoisted.mockUseMediaQuery.mockReturnValue(true)

        wrap(<PlayerQuickView opened player={player} onClose={vi.fn()} />)

        await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalledTimes(1))

        expect(screen.getByText('Player Quick View')).toBeTruthy()
        expect(screen.getByText('Pistola')).toBeTruthy()
        expect(screen.getByText('Pistola#1234')).toBeTruthy()
        expect(screen.getByText('Grandmaster')).toBeTruthy()
        expect(screen.getByText('5300')).toBeTruthy()
        expect(screen.getByText('TERRAN')).toBeTruthy()
        expect(screen.getByText('Rivals')).toBeTruthy()
        expect(screen.queryByLabelText('Search player 2')).toBeNull()
    })

    it('tapping a suggested rival launches H2H with both players', async () => {
        hoisted.mockUseMediaQuery.mockReturnValue(false)
        const onClose = vi.fn()

        wrap(<PlayerQuickView opened player={player} onClose={onClose} />)

        await waitFor(() => expect(screen.getByRole('button', { name: /Launch H2H versus Wither/i })).toBeTruthy())

        fireEvent.click(screen.getByRole('button', { name: /Launch H2H versus Wither/i }))

        expect(hoisted.mockNavigate).toHaveBeenCalledWith('/h2h?player1=101&player2=202')
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('hides compare search field when player has no H2H rivalry data', async () => {
        hoisted.mockUseMediaQuery.mockReturnValue(false)
        hoisted.mockGetTopH2HPairs.mockResolvedValueOnce({ data: [] })

        wrap(<PlayerQuickView opened player={player} onClose={vi.fn()} />)

        await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalledTimes(1))

        expect(screen.getByText('No rivalry data available for this player.')).toBeTruthy()
        expect(screen.queryByLabelText('Search player 2')).toBeNull()
    })
})