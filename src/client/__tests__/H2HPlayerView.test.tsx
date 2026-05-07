import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'

const hoisted = vi.hoisted(() => ({
    mockGetPlayerH2HPairs: vi.fn(),
    mockGetSnapshot: vi.fn(),
}))

vi.mock('../services/api', () => ({
    getPlayerH2HPairs: hoisted.mockGetPlayerH2HPairs,
    getSnapshot: hoisted.mockGetSnapshot,
}))

import { H2HPlayerView } from '../components/h2h/H2HPlayerView'

const players = [
    { value: '101', label: 'Pistola', id: 101 },
    { value: '202', label: 'Wither', id: 202 },
    { value: '303', label: 'OtherPlayer', id: 303 },
]

const snapshotResponse = {
    data: {
        data: [
            { id: 101, btag: 'Pistola#1234', mainRace: 'TERRAN', name: 'Pistola', rating: 5300 },
            { id: 202, btag: 'Wither#5678', mainRace: 'ZERG', name: 'Wither', rating: 5100 },
        ],
    },
}

const pairsResponse = {
    data: [
        {
            player1: { characterId: 101, btag: 'Pistola#1234', name: 'Pistola' },
            player2: { characterId: 202, btag: 'Wither#5678', name: 'Wither' },
            matchCount: 4,
            player1Wins: 3,
            player2Wins: 1,
            lastMatchDate: '2026-04-10T18:00:00',
            heatScore: 80,
        },
        {
            player1: { characterId: 101, btag: 'Pistola#1234', name: 'Pistola' },
            player2: { characterId: 303, btag: 'OtherPlayer#0000', name: 'OtherPlayer' },
            matchCount: 2,
            player1Wins: 1,
            player2Wins: 1,
            lastMatchDate: '2026-03-20T12:00:00',
            heatScore: 30,
        },
    ],
}

const wrap = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('H2HPlayerView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hoisted.mockGetSnapshot.mockResolvedValue(snapshotResponse)
        hoisted.mockGetPlayerH2HPairs.mockResolvedValue(pairsResponse)
    })

    it('shows prompt text when no player is selected', async () => {
        wrap(<H2HPlayerView players={players} onSelectPair={vi.fn()} />)
        await waitFor(() => expect(hoisted.mockGetSnapshot).toHaveBeenCalledTimes(1))
        expect(screen.getByText('Select a player to see their match record')).toBeTruthy()
    })

    it('calls getPlayerH2HPairs with the correct id when a player is selected', async () => {
        wrap(<H2HPlayerView players={players} onSelectPair={vi.fn()} />)
        await waitFor(() => expect(hoisted.mockGetSnapshot).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Focal player', { selector: 'input' }), { target: { value: 'Pistola' } })

        await waitFor(() => expect(hoisted.mockGetPlayerH2HPairs).toHaveBeenCalledWith(101))
    })

    it('renders one row per opponent with correct name, W, L after load', async () => {
        wrap(<H2HPlayerView players={players} onSelectPair={vi.fn()} />)
        await waitFor(() => expect(hoisted.mockGetSnapshot).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Focal player', { selector: 'input' }), { target: { value: 'Pistola' } })

        await waitFor(() => expect(screen.getByText('Wither')).toBeTruthy())
        expect(screen.getByText('OtherPlayer')).toBeTruthy()
        // W=3 appears once; L=1 appears in multiple cells, so use getAllByText
        expect(screen.getByText('3')).toBeTruthy()
        expect(screen.getAllByText('1').length).toBeGreaterThan(0)
    })

    it('computes Win% correctly (3W / 4 total → 75%)', async () => {
        wrap(<H2HPlayerView players={players} onSelectPair={vi.fn()} />)
        await waitFor(() => expect(hoisted.mockGetSnapshot).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Focal player', { selector: 'input' }), { target: { value: 'Pistola' } })

        await waitFor(() => expect(screen.getByText('75%')).toBeTruthy())
    })

    it('calls onSelectPair(focalId, opponentId) when opponent row is clicked', async () => {
        const onSelectPair = vi.fn()
        wrap(<H2HPlayerView players={players} onSelectPair={onSelectPair} />)
        await waitFor(() => expect(hoisted.mockGetSnapshot).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Focal player', { selector: 'input' }), { target: { value: 'Pistola' } })

        await waitFor(() => expect(screen.getByText('Wither')).toBeTruthy())

        fireEvent.click(screen.getByText('Wither').closest('tr')!)

        expect(onSelectPair).toHaveBeenCalledWith(101, 202)
    })

    it('shows skeleton while loading', async () => {
        let resolvePairs!: (v: unknown) => void
        hoisted.mockGetPlayerH2HPairs.mockReturnValue(
            new Promise(r => { resolvePairs = r })
        )

        wrap(<H2HPlayerView players={players} onSelectPair={vi.fn()} />)
        await waitFor(() => expect(hoisted.mockGetSnapshot).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Focal player', { selector: 'input' }), { target: { value: 'Pistola' } })

        // While promise is pending, the skeleton placeholder rows are rendered
        await waitFor(() => {
            expect(screen.getAllByText('Loading\u2026').length).toBeGreaterThan(0)
        })
        // Opponent data is not yet in the DOM
        expect(screen.queryByText('Wither')).toBeNull()

        resolvePairs(pairsResponse)
        await waitFor(() => expect(screen.getByText('Wither')).toBeTruthy())
    })

    it('shows empty state when API returns []', async () => {
        hoisted.mockGetPlayerH2HPairs.mockResolvedValue({ data: [] })

        wrap(<H2HPlayerView players={players} onSelectPair={vi.fn()} />)
        await waitFor(() => expect(hoisted.mockGetSnapshot).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Focal player', { selector: 'input' }), { target: { value: 'Pistola' } })

        await waitFor(() =>
            expect(screen.getByText('No recorded matches for this player')).toBeTruthy()
        )
    })

    it('shows race icon for opponent in snapshot and — for opponent not in snapshot', async () => {
        // OtherPlayer (303) is NOT in snapshot; Wither (202) IS in snapshot with ZERG
        wrap(<H2HPlayerView players={players} onSelectPair={vi.fn()} />)
        await waitFor(() => expect(hoisted.mockGetSnapshot).toHaveBeenCalledTimes(1))

        fireEvent.change(screen.getByLabelText('Focal player', { selector: 'input' }), { target: { value: 'Pistola' } })

        await waitFor(() => expect(screen.getByText('Wither')).toBeTruthy())

        // Wither has ZERG → img with alt="ZERG"
        expect(screen.getByAltText('ZERG')).toBeTruthy()

        // OtherPlayer not in snapshot → shows '—'
        const dashCells = screen.getAllByText('—')
        expect(dashCells.length).toBeGreaterThan(0)
    })
})
