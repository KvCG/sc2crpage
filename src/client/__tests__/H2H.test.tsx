import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'

const hoisted = vi.hoisted(() => ({
    mockGetCommunityPlayers: vi.fn(),
    mockGetH2H: vi.fn(),
    mockGetTopH2HPairs: vi.fn(),
    mockPostH2HFlag: vi.fn(),
}))

vi.mock('../services/api', () => ({
    getCommunityPlayers: hoisted.mockGetCommunityPlayers,
    getH2H: hoisted.mockGetH2H,
    getTopH2HPairs: hoisted.mockGetTopH2HPairs,
    postH2HFlag: hoisted.mockPostH2HFlag,
}))

import { H2H } from '../pages/H2H'

const topPairsResponse = {
    data: [
        {
            player1: { characterId: 101, btag: 'Pistola#1234', name: 'Pistola' },
            player2: { characterId: 202, btag: 'Wither#5678', name: 'Wither' },
            matchCount: 10,
            player1Wins: 6,
            player2Wins: 4,
            lastMatchDate: '2026-04-10T18:00:00',
            heatScore: 80,
        },
        {
            player1: { characterId: 202, btag: 'Wither#5678', name: 'Wither' },
            player2: { characterId: 303, btag: 'OtherPlayer#0000' },
            matchCount: 5,
            player1Wins: 3,
            player2Wins: 2,
            lastMatchDate: '2026-04-08T20:00:00',
            heatScore: 50,
        },
    ],
}

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
            voidedCount: 0,
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
        hoisted.mockGetTopH2HPairs.mockResolvedValue(topPairsResponse)
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

    it('shows voided note when voidedCount > 0', async () => {
        hoisted.mockGetH2H.mockResolvedValueOnce({
            data: {
                ...h2hResponse.data,
                summary: { ...h2hResponse.data.summary, voidedCount: 2 },
            },
        })

        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() =>
            expect(screen.getByText('2 matches not counted (voided)')).toBeTruthy()
        )
    })

    it('does not show voided note when voidedCount is 0', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        expect(screen.queryByText(/not counted \(voided\)/i)).toBeNull()
    })

    it('renders Voided badge for voided matches and not for non-voided matches', async () => {
        hoisted.mockGetH2H.mockResolvedValueOnce({
            data: {
                ...h2hResponse.data,
                matches: [
                    {
                        ...h2hResponse.data.matches[0],
                        matchId: 10,
                        isVoided: true,
                    },
                    {
                        ...h2hResponse.data.matches[1],
                        matchId: 11,
                        isVoided: false,
                    },
                ],
            },
        })

        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        // Voided badge appears exactly once (only for the voided row)
        expect(screen.getAllByText('Voided')).toHaveLength(1)
    })

    it('renders Showmatch badge for matches with matchLabel showmatch', async () => {
        hoisted.mockGetH2H.mockResolvedValueOnce({
            data: {
                ...h2hResponse.data,
                matches: [
                    { ...h2hResponse.data.matches[0], matchId: 20, matchLabel: 'showmatch' },
                    { ...h2hResponse.data.matches[1], matchId: 21, matchLabel: null },
                ],
            },
        })

        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        // 'Showmatch' appears in both the tab and the row badge
        expect(screen.getAllByText('Showmatch').length).toBeGreaterThanOrEqual(1)
        expect(screen.queryByText('Tournament')).toBeNull()
    })

    it('renders Tournament badge for matches with matchLabel tournament', async () => {
        hoisted.mockGetH2H.mockResolvedValueOnce({
            data: {
                ...h2hResponse.data,
                matches: [
                    { ...h2hResponse.data.matches[0], matchId: 30, matchLabel: 'tournament' },
                    { ...h2hResponse.data.matches[1], matchId: 31, matchLabel: null },
                ],
            },
        })

        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        // 'Tournament' appears in both the tab and the row badge
        expect(screen.getAllByText('Tournament').length).toBeGreaterThanOrEqual(1)
        expect(screen.queryByText('Showmatch')).toBeNull()
    })

    it('renders no label badge for matches with matchLabel null', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        expect(screen.queryByText('Showmatch')).toBeNull()
        expect(screen.queryByText('Tournament')).toBeNull()
    })

    it('Showmatch tab appears and filters when dataset has ≥1 showmatch', async () => {
        hoisted.mockGetH2H.mockResolvedValueOnce({
            data: {
                ...h2hResponse.data,
                matches: [
                    { ...h2hResponse.data.matches[0], matchId: 50, matchLabel: 'showmatch', map: 'Showmatch Map' },
                    { ...h2hResponse.data.matches[1], matchId: 51, matchLabel: null, map: 'Normal Map' },
                ],
            },
        })

        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Showmatch Map')).toBeTruthy())

        // Showmatch tab is present, Tournament tab is not
        expect(screen.getByRole('tab', { name: 'Showmatch' })).toBeTruthy()
        expect(screen.queryByRole('tab', { name: 'Tournament' })).toBeNull()

        // Clicking Showmatch tab shows only showmatch row
        fireEvent.click(screen.getByRole('tab', { name: 'Showmatch' }))
        expect(screen.getByText('Showmatch Map')).toBeTruthy()
        expect(screen.queryByText('Normal Map')).toBeNull()

        // Clicking All restores both rows
        fireEvent.click(screen.getByRole('tab', { name: 'All' }))
        expect(screen.getByText('Showmatch Map')).toBeTruthy()
        expect(screen.getByText('Normal Map')).toBeTruthy()
    })

    it('Tournament tab appears and filters when dataset has ≥1 tournament', async () => {
        hoisted.mockGetH2H.mockResolvedValueOnce({
            data: {
                ...h2hResponse.data,
                matches: [
                    { ...h2hResponse.data.matches[0], matchId: 60, matchLabel: 'tournament', map: 'Tournament Map' },
                    { ...h2hResponse.data.matches[1], matchId: 61, matchLabel: null, map: 'Ladder Map' },
                ],
            },
        })

        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Tournament Map')).toBeTruthy())

        // Tournament tab is present, Showmatch tab is not
        expect(screen.getByRole('tab', { name: 'Tournament' })).toBeTruthy()
        expect(screen.queryByRole('tab', { name: 'Showmatch' })).toBeNull()

        // Clicking Tournament tab shows only tournament row
        fireEvent.click(screen.getByRole('tab', { name: 'Tournament' }))
        expect(screen.getByText('Tournament Map')).toBeTruthy()
        expect(screen.queryByText('Ladder Map')).toBeNull()

        // Clicking All restores both rows
        fireEvent.click(screen.getByRole('tab', { name: 'All' }))
        expect(screen.getByText('Tournament Map')).toBeTruthy()
        expect(screen.getByText('Ladder Map')).toBeTruthy()
    })

    it('neither Showmatch nor Tournament tab appears when no labeled matches exist', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        expect(screen.queryByRole('tab', { name: 'Showmatch' })).toBeNull()
        expect(screen.queryByRole('tab', { name: 'Tournament' })).toBeNull()
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

    it('shows H2HTopPairs rivalry cards on mount before any player is selected', async () => {
        wrap(<H2H />)
        // rivalry cards are unique to the H2HTopPairs section
        await waitFor(() => expect(screen.getAllByTestId('h2h-rivalry-card').length).toBeGreaterThan(0))
        // Match results table not yet rendered
        expect(screen.queryByText('Equilibrium')).toBeNull()
    })

    it('clicking a top-pairs card pre-fills pickers and fetches H2H', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(screen.getAllByTestId('h2h-rivalry-card').length).toBeGreaterThan(0))

        // Click the first card (Pistola vs Wither)
        fireEvent.click(screen.getAllByTestId('h2h-rivalry-card')[0])

        await waitFor(() =>
            expect(hoisted.mockGetH2H).toHaveBeenCalledWith(101, 202)
        )

        // Both pickers are filled
        const p1Input = screen.getByLabelText('Select Player 1') as HTMLInputElement
        const p2Input = screen.getByLabelText('Select Player 2') as HTMLInputElement
        expect(p1Input.value).toBe('Pistola')
        expect(p2Input.value).toBe('Wither')
    })

    it('hides activity cards after a search is initiated', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        // Activity rivalry cards no longer visible
        expect(screen.queryAllByTestId('h2h-rivalry-card')).toHaveLength(0)
    })

    it('restores activity cards when both pickers are cleared', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())

        // Clear both pickers
        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: '' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: '' } })

        // Activity rivalry cards visible again
        await waitFor(() => expect(screen.getAllByTestId('h2h-rivalry-card').length).toBeGreaterThan(0))
    })

    it('shows ghost flag icon only on rows with hasPendingFlag true', async () => {
        hoisted.mockGetH2H.mockResolvedValueOnce({
            data: {
                ...h2hResponse.data,
                matches: [
                    { ...h2hResponse.data.matches[0], matchId: 40, hasPendingFlag: true },
                    { ...h2hResponse.data.matches[1], matchId: 41, hasPendingFlag: false },
                ],
            },
        })

        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        // Exactly one ghost icon — for the pending-flagged row only
        expect(screen.getAllByRole('img', { name: 'Pending flag' })).toHaveLength(1)
    })
})


