import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'

const hoisted = vi.hoisted(() => ({
    mockGetCommunityPlayers: vi.fn(),
    mockGetH2H: vi.fn(),
}))

vi.mock('../services/api', () => ({
    getCommunityPlayers: hoisted.mockGetCommunityPlayers,
    getH2H: hoisted.mockGetH2H,
}))

import { H2H } from '../pages/H2H'

const communityPlayersResponse = {
    data: [
        { id: '101', btag: 'Pistola#1234', name: 'Pistola' },
        { id: '202', btag: 'Wither#5678' },
        { id: '303', btag: 'OtherPlayer#0000' },
    ],
}

const h2hResponse = {
    data: {
        player1: { characterId: 101, btag: 'Pistola#1234', name: 'Pistola' },
        player2: { characterId: 202, btag: 'Wither#5678', name: 'Wither' },
        summary: {
            player1Wins: 2,
            player2Wins: 1,
            totalGames: 3,
            lastPlayed: '2026-04-10T18:00:00',
        },
        matches: [
            {
                matchId: 1,
                date: '2026-04-10T18:00:00',
                map: 'Equilibrium',
                durationSeconds: 720,
                region: 'US',
                type: '_1V1',
                winnerCharacterId: 101,
                player1RatingChange: 20,
                player2RatingChange: -20,
                player1RatingAtTime: 5400,
                player2RatingAtTime: 5300,
                source: 'pulse',
            },
            {
                matchId: 2,
                date: '2026-04-08T20:00:00',
                map: 'Solaris',
                durationSeconds: 480,
                region: 'US',
                type: '_1V1',
                winnerCharacterId: 101,
                player1RatingChange: 18,
                player2RatingChange: -18,
                player1RatingAtTime: 5380,
                player2RatingAtTime: 5320,
                source: 'pulse',
            },
            {
                matchId: 3,
                date: '2026-04-05T15:00:00',
                map: 'Altitude',
                durationSeconds: 600,
                region: 'US',
                type: '_1V1',
                winnerCharacterId: 202,
                player1RatingChange: -15,
                player2RatingChange: 15,
                player1RatingAtTime: 5360,
                player2RatingAtTime: 5340,
                source: 'pulse',
            },
        ],
    },
}

const wrap = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('H2H page', () => {
    beforeEach(() => {
        hoisted.mockGetCommunityPlayers.mockResolvedValue(communityPlayersResponse)
        hoisted.mockGetH2H.mockResolvedValue(h2hResponse)
    })

    it('renders two player pickers on mount', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())
        expect(screen.getByLabelText('Select Player 1')).toBeTruthy()
        expect(screen.getByLabelText('Select Player 2')).toBeTruthy()
    })

    it('calls getH2H when both players are selected and renders match rows', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        const p1Input = screen.getByLabelText('Select Player 1')
        const p2Input = screen.getByLabelText('Select Player 2')

        fireEvent.change(p1Input, { target: { value: 'Pistola' } })
        fireEvent.change(p2Input, { target: { value: 'Wither' } })

        await waitFor(() =>
            expect(hoisted.mockGetH2H).toHaveBeenCalledWith(101, 202)
        )

        // Summary banner shows win counts
        await waitFor(() => {
            expect(screen.getAllByText('2').length).toBeGreaterThan(0)
            expect(screen.getAllByText('1').length).toBeGreaterThan(0)
        })

        // Match rows rendered
        await waitFor(() => {
            expect(screen.getByText('Equilibrium')).toBeTruthy()
            expect(screen.getByText('Solaris')).toBeTruthy()
            expect(screen.getByText('Altitude')).toBeTruthy()
        })

        // Duration formatted as mm:ss
        expect(screen.getByText('12:00')).toBeTruthy()
        expect(screen.getByText('8:00')).toBeTruthy()
        expect(screen.getByText('10:00')).toBeTruthy()
    })

    it('shows data note below the table after fetching', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() =>
            expect(screen.getByText(/Match history sourced from SC2Pulse/i)).toBeTruthy()
        )
    })

    it('shows error alert on API failure', async () => {
        hoisted.mockGetH2H.mockRejectedValueOnce({
            response: { data: { error: 'Players not found' } },
        })

        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() =>
            expect(screen.getByText('Players not found')).toBeTruthy()
        )
    })

    it('Custom tab shows empty state when no custom matches exist', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        const customTab = screen.getByRole('tab', { name: 'Custom' })
        fireEvent.click(customTab)

        expect(screen.getByText('No custom matches recorded')).toBeTruthy()
    })

    it('shows — for custom matches with zero duration', async () => {
        hoisted.mockGetH2H.mockResolvedValueOnce({
            data: {
                ...h2hResponse.data,
                matches: [
                    {
                        matchId: 'BZ-1712964000_Ruby_Rock_LE',
                        date: '2026-04-10T18:00:00',
                        map: 'Ruby Rock LE',
                        durationSeconds: 0,
                        region: 'US',
                        type: 'CUSTOM',
                        winnerCharacterId: 101,
                        player1RatingChange: null,
                        player2RatingChange: null,
                        player1RatingAtTime: null,
                        player2RatingAtTime: null,
                        source: 'blizzard',
                    },
                ],
            },
        })

        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Ruby Rock LE')).toBeTruthy())

        expect(screen.getByText('—')).toBeTruthy()
    })
})

