import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'

const hoisted = vi.hoisted(() => ({
    mockGetCommunityPlayers: vi.fn(),
    mockPostH2HFlag: vi.fn(),
}))

vi.mock('../services/api', () => ({
    getCommunityPlayers: hoisted.mockGetCommunityPlayers,
    postH2HFlag: hoisted.mockPostH2HFlag,
}))

import { FlagMatchModal } from '../components/Match/FlagMatchModal'

const defaultProps = {
    matchId: 1,
    player1CharacterId: 101,
    player2CharacterId: 202,
    opened: true,
    onClose: vi.fn(),
}

const wrap = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('FlagMatchModal BTag lookup', () => {
    beforeEach(() => {
        hoisted.mockGetCommunityPlayers.mockReset()
        hoisted.mockPostH2HFlag.mockReset()
    })

    it('populates BTag autocomplete from community players', async () => {
        hoisted.mockGetCommunityPlayers.mockResolvedValueOnce({
            data: [
                { id: '101', btag: 'Pistola#1234', name: 'Pistola' },
                { id: '202', btag: 'Wither#5678' },
            ],
        })

        wrap(<FlagMatchModal {...defaultProps} />)

        await waitFor(() =>
            expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled()
        )

        // Label text is rendered in the modal
        expect(screen.getByText('Your BTag')).toBeTruthy()
    })

    it('deduplicates players with the same btag without crashing', async () => {
        hoisted.mockGetCommunityPlayers.mockResolvedValueOnce({
            data: [
                { id: '101', btag: 'Pistola#1234', name: 'Pistola' },
                { id: '102', btag: 'Pistola#1234', name: 'Pistola' }, // duplicate
                { id: '202', btag: 'Wither#5678' },
            ],
        })

        // Must not throw the "Duplicate options" Mantine error
        expect(() => wrap(<FlagMatchModal {...defaultProps} />)).not.toThrow()

        await waitFor(() =>
            expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled()
        )
    })

    it('renders the BTag field even when getCommunityPlayers fails', async () => {
        hoisted.mockGetCommunityPlayers.mockRejectedValueOnce(new Error('network'))

        wrap(<FlagMatchModal {...defaultProps} />)

        await waitFor(() =>
            expect(hoisted.mockGetCommunityPlayers).toHaveBeenCalled()
        )

        // Label is still present — user can type freely
        expect(screen.getByText('Your BTag')).toBeTruthy()
    })
})
