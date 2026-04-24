import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { PlayerQuickView } from '../components/h2h/PlayerQuickView'

const hoisted = vi.hoisted(() => ({
    mockUseMediaQuery: vi.fn(),
}))

vi.mock('@mantine/hooks', async () => {
    const actual = await vi.importActual<typeof import('@mantine/hooks')>('@mantine/hooks')
    return {
        ...actual,
        useMediaQuery: hoisted.mockUseMediaQuery,
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

const wrap = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('PlayerQuickView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders compact desktop overlay with player profile data', () => {
        hoisted.mockUseMediaQuery.mockReturnValue(false)

        wrap(<PlayerQuickView opened player={player} onClose={vi.fn()} />)

        expect(screen.getByText('Player Quick View')).toBeTruthy()
        expect(screen.getByText('Pistola')).toBeTruthy()
        expect(screen.getByText('Pistola#1234')).toBeTruthy()
        expect(screen.getByText('Grandmaster')).toBeTruthy()
        expect(screen.getByText('5300')).toBeTruthy()
        expect(screen.getByText('TERRAN')).toBeTruthy()
    })

    it('closes desktop overlay when dismiss button is clicked', () => {
        hoisted.mockUseMediaQuery.mockReturnValue(false)
        const onClose = vi.fn()

        wrap(<PlayerQuickView opened player={player} onClose={onClose} />)

        fireEvent.click(screen.getByRole('button', { name: /dismiss player quick view/i }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('renders mobile drawer variant with profile data', () => {
        hoisted.mockUseMediaQuery.mockReturnValue(true)

        wrap(<PlayerQuickView opened player={player} onClose={vi.fn()} />)

        expect(screen.getByText('Player Quick View')).toBeTruthy()
        expect(screen.getByText('Pistola')).toBeTruthy()
        expect(screen.getByText('Pistola#1234')).toBeTruthy()
        expect(screen.getByText('Grandmaster')).toBeTruthy()
        expect(screen.getByText('5300')).toBeTruthy()
        expect(screen.getByText('TERRAN')).toBeTruthy()
    })
})