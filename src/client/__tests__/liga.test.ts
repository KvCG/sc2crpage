import { describe, it, expect } from 'vitest'
import { liga, LigaContent } from '../constants/liga'

describe('constants/liga — bloque de contenido Liga Tica', () => {
    it('exporta un único objeto tipado con los campos de la liga', () => {
        const content: LigaContent = liga
        for (const field of [
            'temporada',
            'fechaInicio',
            'cierreInscripciones',
            'partidasSemanales',
            'ctaUrl',
        ] as const) {
            expect(content, field).toHaveProperty(field)
            expect(typeof content[field]).toBe('string')
        }
    })

    it('trae los valores de Temporada 2', () => {
        expect(liga.temporada).toBe('Temporada 2')
        expect(liga.fechaInicio).toBe('28 de octubre')
        expect(liga.cierreInscripciones).toBe('22 de octubre')
        expect(liga.partidasSemanales).toBe('2 partidas semanales')
        expect(liga.ctaUrl).toBe('https://tico-devcr.github.io/sc2-ligatica-divisiones/')
    })

    it('las fechas del contador son instantes válidos y coinciden con las fechas mostradas', () => {
        const inicio = new Date(liga.inicioISO)
        const cierre = new Date(liga.cierreInscripcionesISO)
        expect(Number.isNaN(+inicio)).toBe(false)
        expect(Number.isNaN(+cierre)).toBe(false)
        expect(+cierre).toBeLessThan(+inicio)
        // Día del mes en hora de Costa Rica = el número de la fecha mostrada.
        const diaCR = (d: Date) =>
            new Intl.DateTimeFormat('es-CR', { day: 'numeric', timeZone: 'America/Costa_Rica' }).format(d)
        expect(liga.fechaInicio).toMatch(new RegExp(`^${diaCR(inicio)} de `))
        expect(liga.cierreInscripciones).toMatch(new RegExp(`^${diaCR(cierre)} de `))
    })
})
