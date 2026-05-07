import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'

const hoisted = vi.hoisted(() => ({
    mockGetCommunityPlayers: vi.fn(),
    mockGetH2H: vi.fn(),
    mockGetTopH2HPairs: vi.fn(),
    mockPostH2HFlag: vi.fn(),
    mockGetPlayerH2HPairs: vi.fn(),
    mockGetSnapshot: vi.fn(),
}))

vi.mock('../services/api', () => ({
    getCommunityPlayers: hoisted.mockGetCommunityPlayers,
    getH2H: hoisted.mockGetH2H,
    getTopH2HPairs: hoisted.mockGetTopH2HPairs,
    postH2HFlag: hoisted.mockPostH2HFlag,
    getPlayerH2HPairs: hoisted.mockGetPlayerH2HPairs,
    getSnapshot: hoisted.mockGetSnapshot,
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

const wrap = (ui: React.ReactElement, path = '/h2h') => render(
    <MemoryRouter initialEntries={[path]}>
        <MantineProvider>{ui}</MantineProvider>
    </MemoryRouter>
)
const openPicker = () => fireEvent.click(screen.getByRole('button', { name: 'Compare Players' }))
const renderWithPicker = async () => {
    wrap(<H2H />)
    await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())
    openPicker()
}

describe('H2H page', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hoisted.mockGetCommunityPlayers.mockResolvedValue(communityPlayersResponse)
        hoisted.mockGetH2H.mockResolvedValue(h2hResponse)
        hoisted.mockGetTopH2HPairs.mockResolvedValue(topPairsResponse)
        hoisted.mockGetPlayerH2HPairs.mockResolvedValue({ data: [] })
        hoisted.mockGetSnapshot.mockResolvedValue({ data: { data: [] } })
    })

    it('renders Compare Players button and hides pickers on mount', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())
        expect(screen.getByRole('button', { name: 'Compare Players' })).toBeTruthy()
        expect(screen.queryByLabelText('Select Player 1')).toBeNull()
        expect(screen.queryByLabelText('Select Player 2')).toBeNull()
    })

    it('hydrates both players from URL params, fetches H2H, and hides picker UI', async () => {
        wrap(<H2H />, '/h2h?player1=101&player2=202')

        await waitFor(() =>
            expect(hoisted.mockGetH2H).toHaveBeenCalledWith(101, 202)
        )
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        expect(screen.queryByLabelText('Select Player 1')).toBeNull()
        expect(screen.queryByLabelText('Select Player 2')).toBeNull()
        expect(screen.queryByRole('button', { name: 'Close compare' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Compare Players' })).toBeNull()
    })

    it('hydrates one player from URL params and waits for manual second player selection', async () => {
        wrap(<H2H />, '/h2h?player1=101')

        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())
        expect(hoisted.mockGetH2H).not.toHaveBeenCalled()

        expect(screen.getByLabelText('Select Player 1')).toBeTruthy()
        expect(screen.getByLabelText('Select Player 2')).toBeTruthy()

        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() =>
            expect(hoisted.mockGetH2H).toHaveBeenCalledWith(101, 202)
        )
    })

    it('with no URL params does not prefetch H2H and keeps manual compare entry', async () => {
        wrap(<H2H />)

        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())
        expect(hoisted.mockGetH2H).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Compare Players' })).toBeTruthy()
        expect(screen.queryByLabelText('Select Player 1')).toBeNull()
        expect(screen.queryByLabelText('Select Player 2')).toBeNull()
    })

    it('shows pickers and Cancel button after clicking Compare Players', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())
        fireEvent.click(screen.getByRole('button', { name: 'Compare Players' }))
        expect(screen.getByLabelText('Select Player 1')).toBeTruthy()
        expect(screen.getByLabelText('Select Player 2')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Close compare' })).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Compare Players' })).toBeNull()
    })

    it('Cancel button hides pickers and restores Compare Players button', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())
        fireEvent.click(screen.getByRole('button', { name: 'Compare Players' }))
        fireEvent.click(screen.getByRole('button', { name: 'Close compare' }))
        expect(screen.queryByLabelText('Select Player 1')).toBeNull()
        expect(screen.getByRole('button', { name: 'Compare Players' })).toBeTruthy()
    })

    it('renders Top Rivalries heading and subtext on landing state', async () => {
        wrap(<H2H />)
        await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalled())
        expect(screen.getByRole('heading', { name: 'Top Rivalries' })).toBeTruthy()
        expect(screen.getByText('The most contested matchups in the CR scene')).toBeTruthy()
    })

    it('hides Top Rivalries heading once a search is initiated', async () => {
        await renderWithPicker()

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        expect(screen.queryByRole('heading', { name: 'Top Rivalries' })).toBeNull()
        expect(screen.queryByText('The most contested matchups in the CR scene')).toBeNull()
    })

    it('calls getH2H when both players are selected and renders match rows', async () => {
        await renderWithPicker()

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
        await renderWithPicker()

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

        await renderWithPicker()

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() =>
            expect(screen.getByText('Players not found')).toBeTruthy()
        )
    })

    it('Custom tab shows empty state when no custom matches exist', async () => {
        await renderWithPicker()

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

        await renderWithPicker()

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() =>
            expect(screen.getByText('2 matches not counted (voided)')).toBeTruthy()
        )
    })

    it('does not show voided note when voidedCount is 0', async () => {
        await renderWithPicker()

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

        await renderWithPicker()

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

        await renderWithPicker()

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

        await renderWithPicker()

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        // 'Tournament' appears in both the tab and the row badge
        expect(screen.getAllByText('Tournament').length).toBeGreaterThanOrEqual(1)
        expect(screen.queryByText('Showmatch')).toBeNull()
    })

    it('renders no label badge for matches with matchLabel null', async () => {
        await renderWithPicker()

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

        await renderWithPicker()

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

        await renderWithPicker()

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
        await renderWithPicker()

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

        await renderWithPicker()

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
        await renderWithPicker()
        await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalled())

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        // Activity rivalry cards no longer visible
        expect(screen.queryAllByTestId('h2h-rivalry-card')).toHaveLength(0)
    })

    it('restores activity cards when both pickers are cleared', async () => {
        await renderWithPicker()
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

    describe('landing mode toggle', () => {
        it('renders toggle before search is initiated and hides it after', async () => {
            wrap(<H2H />)
            await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalled())

            expect(screen.getByRole('radio', { name: 'Player View' })).toBeTruthy()

            fireEvent.click(screen.getByRole('button', { name: 'Compare Players' }))
            fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
            fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

            await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())

            expect(screen.queryByRole('radio', { name: 'Player View' })).toBeNull()
        })

        it('default mode shows H2HTopPairs and not H2HPlayerView', async () => {
            wrap(<H2H />)
            await waitFor(() => expect(screen.getAllByTestId('h2h-rivalry-card').length).toBeGreaterThan(0))
            expect(screen.queryByText('Select a player to see their match record')).toBeNull()
        })

        it('switching to Player View renders H2HPlayerView and hides H2HTopPairs', async () => {
            wrap(<H2H />)
            await waitFor(() => expect(screen.getAllByTestId('h2h-rivalry-card').length).toBeGreaterThan(0))

            fireEvent.click(screen.getByRole('radio', { name: 'Player View' }))

            await waitFor(() =>
                expect(screen.getByText('Select a player to see their match record')).toBeTruthy()
            )
            expect(screen.queryAllByTestId('h2h-rivalry-card')).toHaveLength(0)

            // Switch back
            fireEvent.click(screen.getByRole('radio', { name: 'Top Rivalries' }))
            await waitFor(() => expect(screen.getAllByTestId('h2h-rivalry-card').length).toBeGreaterThan(0))
            expect(screen.queryByText('Select a player to see their match record')).toBeNull()
        })

        it('selecting opponent in Player View calls getH2H with correct ids', async () => {
            hoisted.mockGetPlayerH2HPairs.mockResolvedValue({
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
                ],
            })

            wrap(<H2H />)
            await waitFor(() => expect(hoisted.mockGetTopH2HPairs).toHaveBeenCalled())

            fireEvent.click(screen.getByRole('radio', { name: 'Player View' }))
            await waitFor(() =>
                expect(screen.getByText('Select a player to see their match record')).toBeTruthy()
            )

            fireEvent.change(screen.getByPlaceholderText('Search player…'), { target: { value: 'Pistola' } })

            await waitFor(() => expect(hoisted.mockGetPlayerH2HPairs).toHaveBeenCalledWith(101))
            await waitFor(() => expect(screen.getByText('Wither')).toBeTruthy())

            fireEvent.click(screen.getByText('Wither'))

            await waitFor(() =>
                expect(hoisted.mockGetH2H).toHaveBeenCalledWith(101, 202)
            )
        })

        it('?mode=player URL param opens Player View mode on landing', async () => {
            wrap(<H2H />, '/h2h?mode=player')
            await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

            expect(screen.getByText('Select a player to see their match record')).toBeTruthy()
            expect(screen.queryAllByTestId('h2h-rivalry-card')).toHaveLength(0)
        })

        it('?mode=player&focal=101 pre-populates focal player in Player View', async () => {
            hoisted.mockGetPlayerH2HPairs.mockResolvedValue({
                data: [
                    {
                        player1: { characterId: 101, btag: 'Pistola#1234', name: 'Pistola' },
                        player2: { characterId: 202, btag: 'Wither#5678', name: 'Wither' },
                        matchCount: 8,
                        player1Wins: 5,
                        player2Wins: 3,
                        lastMatchDate: '2026-04-10T18:00:00',
                        heatScore: 75,
                    },
                ],
            })

            wrap(<H2H />, '/h2h?mode=player&focal=101')
            await waitFor(() => expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled())

            // Focal player pre-populated triggers getPlayerH2HPairs
            await waitFor(() => expect(hoisted.mockGetPlayerH2HPairs).toHaveBeenCalledWith(101))
            await waitFor(() => expect(screen.getByText('Wither')).toBeTruthy())
        })

        it('clicking a player name in top rivalries switches to Player View pre-loaded for that player', async () => {
            hoisted.mockGetPlayerH2HPairs.mockResolvedValue({
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
                ],
            })

            wrap(<H2H />)
            await waitFor(() => expect(screen.getAllByTestId('h2h-rivalry-card').length).toBeGreaterThan(0))

            fireEvent.click(screen.getByLabelText('View Pistola in Player View'))

            // Focal player auto-loaded
            await waitFor(() => expect(hoisted.mockGetPlayerH2HPairs).toHaveBeenCalledWith(101))
            await waitFor(() => expect(screen.getByText('Wither')).toBeTruthy())
        })
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

        await renderWithPicker()

        fireEvent.change(screen.getByLabelText('Select Player 1'), { target: { value: 'Pistola' } })
        fireEvent.change(screen.getByLabelText('Select Player 2'), { target: { value: 'Wither' } })

        await waitFor(() => expect(hoisted.mockGetH2H).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Equilibrium')).toBeTruthy())

        // Exactly one ghost icon — for the pending-flagged row only
        expect(screen.getAllByRole('img', { name: 'Pending flag' })).toHaveLength(1)
    })
})


