import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFetch } from './useFetch'

vi.mock('../services/api', () => ({
    search: vi.fn(async () => ({ data: [{ name: 'NeO' }] })),
    getTop: vi.fn(async () => ({ data: [{ name: 'Kerverus' }] })),
    getTournament: vi.fn(async () => ({ data: { name: 'SC2CR' } })),
    getReplays: vi.fn(async () => ({ data: [{ id: 'r1' }] })),
    analyzeReplayBase64: vi.fn(async () => ({ data: { id: 'a1' } })),
    analyzeReplayUrl: vi.fn(async () => ({ data: { id: 'u1' } })),
    getReplayAnalysis: vi.fn(async () => ({ data: { id: 'ra1' } })),
}))

const api = await import('../services/api')

describe('useFetch', () => {
    it('handles success path for ranking', async () => {
        const { result } = renderHook(() => useFetch('ranking'))
        expect(result.current.loading).toBe(false)
        await act(async () => {
            await result.current.fetch()
        })
        expect(api.getTop).toHaveBeenCalled()
        expect(result.current.error).toBeNull()
        expect(result.current.data).toEqual([{ name: 'Kerverus' }])
        expect(result.current.loading).toBe(false)
    })

    it('sets error on failure and returns empty array', async () => {
        ;(api.getTop as any).mockRejectedValueOnce(new Error('network'))
        const { result } = renderHook(() => useFetch('ranking'))

        await act(async () => {
            await result.current.fetch()
        })

        expect(result.current.error).toBe(
            'Failed to fetch data. Please try again later.'
        )
        expect(result.current.data).toEqual([])
        expect(result.current.loading).toBe(false)
    })

    it('passes params for search type', async () => {
        const { result } = renderHook(() => useFetch('search'))
        await act(async () => {
            await result.current.fetch('ne')
        })
        expect(api.search).toHaveBeenCalledWith('ne')
        expect(result.current.data).toEqual([{ name: 'NeO' }])
    })
})
