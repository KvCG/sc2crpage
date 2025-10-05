import { describe, it, expect } from 'vitest'

// Basic test to ensure the hook module can be imported
describe('useCommunityStats Hook', () => {
    it('should export useCommunityStats function', async () => {
        const module = await import('../hooks/useCommunityStats.tsx')
        expect(typeof module.useCommunityStats).toBe('function')
    })
})