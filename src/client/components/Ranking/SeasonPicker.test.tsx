import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { SeasonPicker } from './SeasonPicker'
import type { SeasonEntry } from '../../../shared/types'

const seasons: SeasonEntry[] = [
    { id: 67, year: 2026, number: 2, start: '2026-01-01T00:00:00', end: '2026-04-01T00:00:00' },
    { id: 66, year: 2026, number: 1, start: '2025-10-01T00:00:00', end: '2026-01-01T00:00:00' },
]

const wrap = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('SeasonPicker', () => {
    it('renders nothing when seasons list is empty', () => {
        wrap(<SeasonPicker seasons={[]} value={0} onChange={vi.fn()} />)
        expect(screen.queryByLabelText('Select season')).toBeNull()
    })

    it('shows the current season label (with "(Current)") in the input', () => {
        wrap(<SeasonPicker seasons={seasons} value={67} onChange={vi.fn()} />)
        expect(screen.getByDisplayValue('Season 67 · 2026 S2 (Current)')).toBeTruthy()
    })

    it('shows a past season label without "(Current)"', () => {
        wrap(<SeasonPicker seasons={seasons} value={66} onChange={vi.fn()} />)
        expect(screen.getByDisplayValue('Season 66 · 2026 S1')).toBeTruthy()
    })

    it('calls onChange with a numeric id when an option is selected', () => {
        const onChange = vi.fn()
        wrap(<SeasonPicker seasons={seasons} value={67} onChange={onChange} />)

        const input = screen.getByRole('textbox', { name: 'Select season' })
        fireEvent.click(input)

        const option = screen.getByText('Season 66 · 2026 S1')
        fireEvent.click(option)

        expect(onChange).toHaveBeenCalledWith(66)
    })

    it('applies the fixed width (280px) so the full label fits at narrow viewports', () => {
        const { container } = wrap(<SeasonPicker seasons={seasons} value={67} onChange={vi.fn()} />)

        // Mantine converts w={280} to 17.5rem (280/16) scaled by --mantine-scale
        const root = container.querySelector('.mantine-Select-root')
        expect(root).toBeTruthy()
        expect(root?.getAttribute('style')).toContain('width: calc(17.5rem')
    })
})
