import { describe, it, expect } from 'vitest'

describe('server/constants/players', () => {
    it('exports a players mapping with expected keys', async () => {
        const { players } = await import('../../constants/players')
        expect(players).toMatchObject({
            wither: expect.any(String),
            kerverus: expect.any(String),
        })
    })
})
