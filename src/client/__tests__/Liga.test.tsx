import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { MemoryRouter } from 'react-router-dom'
import { Liga } from '../pages/Liga'
import { liga } from '../constants/liga'

const renderLiga = () =>
    render(
        <MantineProvider defaultColorScheme="dark">
            <MemoryRouter initialEntries={['/liga']}>
                <Liga />
            </MemoryRouter>
        </MantineProvider>
    )

describe('Página /liga — Liga Tica', () => {
    it('ancla el CTA principal al challenge de inscripciones (ctaUrl)', () => {
        renderLiga()
        const cta = screen.getByRole('link', { name: /inscribir/i })
        expect(cta).toHaveAttribute('href', liga.ctaUrl)
        expect(cta).toHaveAttribute('target', '_blank')
    })

    it('declara Temporada 2, las fechas y el ritmo de partidas', () => {
        renderLiga()
        const text = document.body.textContent ?? ''
        expect(text).toContain('Temporada 2')
        expect(text).toContain('28 de octubre')
        expect(text).toContain('22 de octubre')
        expect(text).toContain('2 partidas semanales')
    })
})
