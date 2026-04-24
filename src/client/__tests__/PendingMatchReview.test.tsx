import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'

const hoisted = vi.hoisted(() => ({
    mockGetCommunityPlayers: vi.fn(),
    mockGetAdminPendingMatches: vi.fn(),
    mockConfirmAdminPendingMatch: vi.fn(),
    mockRejectAdminPendingMatch: vi.fn(),
}))

vi.mock('../services/api', () => ({
    getCommunityPlayers: hoisted.mockGetCommunityPlayers,
    getAdminPendingMatches: hoisted.mockGetAdminPendingMatches,
    confirmAdminPendingMatch: hoisted.mockConfirmAdminPendingMatch,
    rejectAdminPendingMatch: hoisted.mockRejectAdminPendingMatch,
}))

import { PendingMatchReview } from '../pages/PendingMatchReview'
import type { PendingMatch } from '../../shared/types'

const wrap = (ui: React.ReactElement) =>
    render(
        <MemoryRouter>
            <MantineProvider>{ui}</MantineProvider>
        </MemoryRouter>
    )

const makePendingMatch = (overrides: Partial<PendingMatch> = {}): PendingMatch => ({
    id: 1,
    matchId: 'BZ-123456_Ruby_Rock_LE',
    matchDate: '2026-04-20T12:00:00Z',
    mapName: 'Ruby Rock LE',
    region: 'US',
    candidateIds: [101, 202, 303],
    rawDecisions: [
        { characterId: 101, decision: 'win' },
        { characterId: 202, decision: 'loss' },
        { characterId: 303, decision: 'observer' },
    ],
    reason: 'multi_winner',
    activePlayerCount: 3,
    winCount: 1,
    lossCount: 1,
    observerCount: 1,
    inferredMode: 'unknown',
    reviewedAt: null,
    reviewOutcome: null,
    ...overrides,
})

const communityPlayersResponse = {
    data: [
        { id: '101', btag: 'Alpha#1111', name: 'Alpha' },
        { id: '202', btag: 'Beta#2222', name: null },
        { id: '303', btag: 'Gamma#3333', name: 'Gamma' },
    ],
}

describe('PendingMatchReview', () => {
    beforeEach(() => {
        hoisted.mockGetCommunityPlayers.mockReset()
        hoisted.mockGetAdminPendingMatches.mockReset()
        hoisted.mockConfirmAdminPendingMatch.mockReset()
        hoisted.mockRejectAdminPendingMatch.mockReset()

        // Default: community players resolve; no pending matches
        hoisted.mockGetCommunityPlayers.mockResolvedValue(communityPlayersResponse)
        hoisted.mockGetAdminPendingMatches.mockResolvedValue([])
    })

    it('shows empty state when no pending matches exist', async () => {
        wrap(<PendingMatchReview />)

        await waitFor(() =>
            expect(screen.getByText('No pending matches to review.')).toBeTruthy()
        )
    })

    it('renders page title', async () => {
        wrap(<PendingMatchReview />)

        await waitFor(() =>
            expect(screen.getByText('Pending Matches')).toBeTruthy()
        )
    })

    it('renders match metadata when pending rows exist', async () => {
        hoisted.mockGetAdminPendingMatches.mockResolvedValue([makePendingMatch()])

        wrap(<PendingMatchReview />)

        await waitFor(() => expect(screen.getByText('Ruby Rock LE')).toBeTruthy())
        expect(screen.getByText('2026-04-20')).toBeTruthy()
        expect(screen.getByText('US')).toBeTruthy()
    })

    it('displays human-readable reason badge', async () => {
        hoisted.mockGetAdminPendingMatches.mockResolvedValue([makePendingMatch()])

        wrap(<PendingMatchReview />)

        await waitFor(() =>
            expect(screen.getByText('Multiple winners')).toBeTruthy()
        )
    })

    it('displays inferred mode badge', async () => {
        hoisted.mockGetAdminPendingMatches.mockResolvedValue([
            makePendingMatch({ inferredMode: '2v2' }),
        ])

        wrap(<PendingMatchReview />)

        await waitFor(() => expect(screen.getByText('2v2')).toBeTruthy())
    })

    it('resolves candidate IDs to display names', async () => {
        hoisted.mockGetAdminPendingMatches.mockResolvedValue([makePendingMatch()])

        wrap(<PendingMatchReview />)

        // Alpha should appear at least once (resolved from characterId 101)
        await waitFor(() => expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0))
    })

    it('falls back to characterId when community players call fails', async () => {
        hoisted.mockGetCommunityPlayers.mockRejectedValue(new Error('network'))
        hoisted.mockGetAdminPendingMatches.mockResolvedValue([makePendingMatch()])

        wrap(<PendingMatchReview />)

        // Should still render without crashing and show the raw id at least once
        await waitFor(() => expect(screen.getAllByText('101').length).toBeGreaterThan(0))
    })

    it('shows error alert when list fetch fails', async () => {
        hoisted.mockGetAdminPendingMatches.mockRejectedValue(new Error('server error'))

        wrap(<PendingMatchReview />)

        await waitFor(() =>
            expect(
                screen.getByText('Failed to load pending matches. Please try again.')
            ).toBeTruthy()
        )
    })

    it('calls rejectAdminPendingMatch and removes row on Reject', async () => {
        hoisted.mockGetAdminPendingMatches.mockResolvedValue([makePendingMatch({ id: 42 })])
        hoisted.mockRejectAdminPendingMatch.mockResolvedValue(undefined)

        wrap(<PendingMatchReview />)

        await waitFor(() => expect(screen.getByText('Ruby Rock LE')).toBeTruthy())

        const rejectBtn = screen.getByRole('button', { name: /reject/i })
        fireEvent.click(rejectBtn)

        await waitFor(() =>
            expect(hoisted.mockRejectAdminPendingMatch).toHaveBeenCalledWith(42)
        )

        // Row is removed from the list
        expect(screen.queryByText('Ruby Rock LE')).toBeNull()
    })

    it('shows success banner after rejection', async () => {
        hoisted.mockGetAdminPendingMatches.mockResolvedValue([makePendingMatch()])
        hoisted.mockRejectAdminPendingMatch.mockResolvedValue(undefined)

        wrap(<PendingMatchReview />)

        await waitFor(() => expect(screen.getAllByRole('button', { name: /reject/i }).length > 0).toBeTruthy())

        const rejectBtn = screen.getByRole('button', { name: /reject/i })
        fireEvent.click(rejectBtn)

        await waitFor(() => expect(screen.getByText('Match rejected')).toBeTruthy())
    })
})
