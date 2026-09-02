import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'

const hoisted = vi.hoisted(() => ({
    mockFetch: vi.fn(),
    mockGetSeasons: vi.fn(),
    mockGetSnapshot: vi.fn(),
    mockGetTopH2HPairs: vi.fn(),
    // Driven per-test so new cases can load rows; null (the default) matches the
    // pre-refactor behavior pinned by the three existing cases.
    mockUseFetchData: null as unknown,
}))

vi.mock('../hooks/useFetch', () => ({
    useFetch: () => ({ data: hoisted.mockUseFetchData, loading: false, error: null, fetch: hoisted.mockFetch }),
}))

vi.mock('../services/api', () => ({
    getSeasons: hoisted.mockGetSeasons,
    getSnapshot: hoisted.mockGetSnapshot,
    getTopH2HPairs: hoisted.mockGetTopH2HPairs,
}))

vi.mock('../utils/localStorage.ts', () => ({
    isValid: () => false,
    loadData: () => null,
    saveSnapShot: vi.fn(),
}))

import { Ranking } from '../pages/Ranking'

const wrap = (ui: React.ReactElement) =>
    render(
        <MemoryRouter initialEntries={['/']}>
            <MantineProvider>{ui}</MantineProvider>
        </MemoryRouter>
    )

describe('Ranking toolbar (behavior pinned before hero refactor)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        hoisted.mockUseFetchData = null
        hoisted.mockFetch.mockResolvedValue([])
        hoisted.mockGetSeasons.mockResolvedValue({
            data: [
                { id: 246, year: 2026, number: 2, start: '2026-01-01T00:00:00Z', end: '2026-06-01T00:00:00Z' },
                { id: 245, year: 2026, number: 1, start: '2025-07-01T00:00:00Z', end: '2026-01-01T00:00:00Z' },
            ],
        })
        hoisted.mockGetSnapshot.mockResolvedValue({
            data: { data: [], createdAt: '2026-09-01T12:00:00.000Z', expiry: Date.now() + 86_400_000 },
        })
        hoisted.mockGetTopH2HPairs.mockResolvedValue({ data: [] })
    })

    it('renders the Refresh button and clicking it calls fetch', async () => {
        wrap(<Ranking />)

        const refresh = screen.getByRole('button', { name: 'Refresh' })
        fireEvent.click(refresh)

        expect(hoisted.mockFetch).toHaveBeenCalled()
    })

    it('renders the SeasonPicker Select once getSeasons resolves', async () => {
        wrap(<Ranking />)

        await waitFor(() => expect(hoisted.mockGetSeasons).toHaveBeenCalled())

        // Mantine 7's Select puts the aria-label on both the visible combobox target
        // and the closed options dropdown, so getByLabelText is ambiguous; pick the
        // target by its aria-haspopup attribute.
        await waitFor(() => {
            expect(
                screen.getAllByLabelText('Select season').some((el) => el.getAttribute('aria-haspopup') === 'listbox')
            ).toBe(true)
        })
    })

    it('renders the H1 with the exact existing title text', () => {
        wrap(<Ranking />)

        const h1 = screen.getByRole('heading', {
            level: 1,
            name: "StarCraft II Costa Rica's Top Players",
        })
        expect(h1.textContent).toBe("StarCraft II Costa Rica's Top Players")
    })

    it('shows player count and top MMR in the stats bar when data is loaded, and does not crash with empty data', async () => {
        hoisted.mockUseFetchData = [
            { btag: 'Alpha#1', rating: 2540 },
            { btag: 'Bravo#2', rating: 1830 },
        ]
        wrap(<Ranking />)

        await waitFor(() => {
            expect(screen.getByText('Players').parentElement?.textContent).toContain('2')
            expect(screen.getByText('Top MMR').parentElement?.textContent).toContain('2540')
        })

        cleanup()
        hoisted.mockUseFetchData = []
        wrap(<Ranking />)

        expect(screen.getByText('Players').parentElement?.textContent).toContain('0')
        expect(screen.queryByText('Top MMR')).toBeNull()
    })
})
