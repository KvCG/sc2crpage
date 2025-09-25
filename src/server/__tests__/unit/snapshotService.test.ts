import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({ getTopMock: vi.fn(), formatMock: vi.fn() }))

vi.mock('../../services/pulseApi', () => ({
    getTop: (...a: any[]) => hoisted.getTopMock(...a),
}))
vi.mock('../../utils/formatData', () => ({
    formatData: (...a: any[]) => hoisted.formatMock(...a),
}))

describe('snapshotService', () => {
    beforeEach(async () => {
        vi.resetModules()
        hoisted.getTopMock.mockReset()
        hoisted.formatMock.mockReset()
        const cache = (await import('../../utils/snapshotCache')).default
        cache.clear()
    })

    it('computes and caches snapshot for 24h key', async () => {
        hoisted.getTopMock.mockResolvedValueOnce([{ playerCharacterId: '1' }])
        hoisted.formatMock.mockResolvedValueOnce([{ playerCharacterId: '1' }])
        const svc = await import('../../services/snapshotService')

        const one = await svc.getDailySnapshot()
        const two = await svc.getDailySnapshot()

        expect(one.data.length).toBe(1)
        expect(two.data.length).toBe(1)
        expect(hoisted.getTopMock).toHaveBeenCalledTimes(1)
        expect(hoisted.formatMock).toHaveBeenCalledTimes(1)
    expect(typeof one.createdAt).toBe('string')
    expect(typeof one.expiry).toBe('number')
    })
})
