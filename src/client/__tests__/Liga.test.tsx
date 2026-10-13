import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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

/** Valores del contador en orden: días, horas, minutos, segundos. */
const countdownValues = () =>
    Array.from(screen.getByRole('timer').querySelectorAll('span[class*="digits"]')).map(
        (el) => el.textContent
    )

describe('Página /liga — Liga Tica', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    describe('con inscripciones abiertas (13 oct, 14:30:15 CR)', () => {
        beforeEach(() => {
            vi.setSystemTime(new Date('2026-10-13T14:30:15-06:00'))
        })

        it('ancla el CTA principal al challenge de inscripciones (ctaUrl)', () => {
            renderLiga()
            const cta = screen.getByRole('link', { name: liga.textos.ctaInscripcion })
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

        it('cuenta hasta el 28 de octubre 00:00 CR y avanza cada segundo', () => {
            renderLiga()
            expect(countdownValues()).toEqual(['14', '09', '29', '45'])
            act(() => {
                vi.advanceTimersByTime(1000)
            })
            expect(countdownValues()).toEqual(['14', '09', '29', '44'])
        })

        it('muestra cuánto falta para que cierren las inscripciones', () => {
            renderLiga()
            expect(document.body.textContent).toContain(
                `${liga.textos.inscripcionesAbiertas} · cierran en 9 d 9 h`
            )
        })
    })

    it('en el último día de inscripciones muestra horas y minutos', () => {
        vi.setSystemTime(new Date('2026-10-22T20:15:00-06:00'))
        renderLiga()
        expect(document.body.textContent).toContain('cierran en 3 h 44 min')
    })

    it('entre el cierre y el inicio: inscripciones cerradas, el contador sigue', () => {
        vi.setSystemTime(new Date('2026-10-25T12:00:00-06:00'))
        renderLiga()
        expect(document.body.textContent).toContain(liga.textos.inscripcionesCerradas)
        expect(countdownValues()).toEqual(['2', '12', '00', '00'])
    })

    it('desde el inicio: temporada en curso, sin contador y el CTA lleva a la tabla', () => {
        vi.setSystemTime(new Date('2026-10-28T00:00:00-06:00'))
        renderLiga()
        expect(screen.queryByRole('timer')).toBeNull()
        expect(document.body.textContent).toContain(liga.textos.enCurso)
        expect(screen.getByRole('link', { name: liga.textos.ctaEnCurso })).toHaveAttribute(
            'href',
            liga.ctaUrl
        )
    })

    it('la página no trae texto propio: título, descripción y etiquetas salen del bloque', () => {
        vi.setSystemTime(new Date('2026-10-13T14:30:15-06:00'))
        renderLiga()
        const text = document.body.textContent ?? ''
        for (const key of [
            'titulo',
            'descripcion',
            'etiquetaInicio',
            'etiquetaCierre',
            'contadorTitulo',
        ] as const) {
            expect(text, key).toContain(liga.textos[key])
        }
    })
})
