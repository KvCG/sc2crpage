import { describe, it, expect } from 'vitest'

import { getClientInfo } from '../../utils/getClientInfo'

describe('getClientInfo', () => {
    it('parses Windows Chrome UA', () => {
        const ua =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        const info = getClientInfo(ua)
        expect(info.os).toContain('Windows NT')
        expect(info.device).toBe('Unknown Device')
        expect(info.browser).toContain('Chrome')
    })

    it('parses iPhone Safari UA', () => {
        const ua =
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
        const info = getClientInfo(ua)
        expect(info.os).toContain('iPhone OS')
        expect(info.device).toContain('iPhone')
        expect(info.browser).toContain('Safari')
    })

    it('parses Android Chrome UA', () => {
        const ua =
            'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        const info = getClientInfo(ua)
        expect(info.os).toContain('Android')
        expect(info.device).toContain('Android')
        expect(info.browser).toContain('Chrome')
    })

    it('handles unknown UA', () => {
        const info = getClientInfo('')
        expect(info.os).toBe('Unknown OS')
        expect(info.device).toBe('Unknown Device')
        expect(info.browser).toBe('Unknown Browser')
    })
})
