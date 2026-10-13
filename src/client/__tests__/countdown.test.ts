import { describe, it, expect } from 'vitest'
import { pad2, timeLeft } from '../utils/countdown'

describe('utils/countdown — timeLeft', () => {
    const target = new Date('2026-10-28T00:00:00-06:00')

    it('desglosa días, horas, minutos y segundos', () => {
        const now = new Date('2026-10-13T14:30:15-06:00')
        expect(timeLeft(target, now)).toEqual({
            days: 14,
            hours: 9,
            minutes: 29,
            seconds: 45,
            totalMs: (14 * 86400 + 9 * 3600 + 29 * 60 + 45) * 1000,
        })
    })

    it('respeta la zona de Costa Rica: medianoche CR son las 06:00 UTC', () => {
        expect(timeLeft(target, new Date('2026-10-28T05:59:59Z')).seconds).toBe(1)
        expect(timeLeft(target, new Date('2026-10-28T06:00:00Z')).totalMs).toBe(0)
    })

    it('nunca devuelve negativos cuando el destino ya pasó', () => {
        expect(timeLeft(target, new Date('2026-11-02T10:00:00-06:00'))).toEqual({
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            totalMs: 0,
        })
    })

    it('pad2 rellena a dos dígitos', () => {
        expect(pad2(4)).toBe('04')
        expect(pad2(12)).toBe('12')
    })
})
