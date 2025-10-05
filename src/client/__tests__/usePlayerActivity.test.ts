/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest'

describe('usePlayerActivity Hook', () => {
    it('should export usePlayerActivity function', async () => {
        const module = await import('../hooks/usePlayerActivity.tsx')
        expect(typeof module.usePlayerActivity).toBe('function')
    })
})