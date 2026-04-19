import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'

const hoisted = vi.hoisted(() => ({
    mockGetAdminFlags: vi.fn(),
}))

vi.mock('../services/api', () => ({
    getAdminFlags: hoisted.mockGetAdminFlags,
}))

import { AdminDashboard } from '../pages/AdminDashboard'

const wrap = (ui: React.ReactElement) =>
    render(
        <MemoryRouter>
            <MantineProvider>{ui}</MantineProvider>
        </MemoryRouter>
    )

describe('AdminDashboard', () => {
    beforeEach(() => {
        hoisted.mockGetAdminFlags.mockReset()
    })

    it('shows yellow badge with count when pending flags exist', async () => {
        hoisted.mockGetAdminFlags.mockResolvedValueOnce([
            { id: 1 },
            { id: 2 },
            { id: 3 },
        ])

        wrap(<AdminDashboard />)

        await waitFor(() =>
            expect(screen.getByText('3 pending')).toBeTruthy()
        )
    })

    it('shows gray badge with 0 when no pending flags', async () => {
        hoisted.mockGetAdminFlags.mockResolvedValueOnce([])

        wrap(<AdminDashboard />)

        await waitFor(() =>
            expect(screen.getByText('0 pending')).toBeTruthy()
        )
    })

    it('hides badge on API error', async () => {
        hoisted.mockGetAdminFlags.mockRejectedValueOnce(new Error('network'))

        wrap(<AdminDashboard />)

        await waitFor(() =>
            expect(screen.queryByText(/pending/i)).toBeNull()
        )
    })

    it('links to Flag Review page', async () => {
        hoisted.mockGetAdminFlags.mockResolvedValueOnce([])

        wrap(<AdminDashboard />)

        await waitFor(() => expect(screen.getByText('Go to Flag Review')).toBeTruthy())

        const link = screen.getByRole('link', { name: 'Go to Flag Review' })
        expect(link.getAttribute('href')).toBe('/admin/h2h-flags')
    })
})
