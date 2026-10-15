import { describe, it, expect } from 'vitest'
import { resolveConfig } from './config'

describe('resolveConfig', () => {
    it('uses the prod API on prod hosts', () => {
        expect(
            resolveConfig('sc2cr.vercel.app', 'https://sc2cr.vercel.app').API_URL
        ).toBe('https://sc2cr-latest.onrender.com/')
    })

    it('uses the dev API on Fly and Vercel preview hosts', () => {
        expect(
            resolveConfig('sc2cr-dev.fly.dev', 'https://sc2cr-dev.fly.dev').API_URL
        ).toBe('https://sc2cr-dev.fly.dev')
        expect(
            resolveConfig('sc2cr-git-x-project.vercel.app', 'https://x').API_URL
        ).toBe('https://sc2cr-dev.fly.dev')
    })

    it('points the Vite dev server at the local API', () => {
        expect(resolveConfig('localhost', 'http://localhost:5173').API_URL).toBe(
            'http://localhost:3000/'
        )
        expect(resolveConfig('127.0.0.1', 'http://127.0.0.1:5173').API_URL).toBe(
            'http://localhost:3000/'
        )
    })

    it('uses the serving origin on any other host (QA on KevServer)', () => {
        expect(
            resolveConfig('100.82.76.60', 'http://100.82.76.60:4101').API_URL
        ).toBe('http://100.82.76.60:4101/')
        expect(resolveConfig('kevserver', 'http://kevserver:4101').API_URL).toBe(
            'http://kevserver:4101/'
        )
    })
})
