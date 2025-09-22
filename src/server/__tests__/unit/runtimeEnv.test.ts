import { describe, it, expect } from 'vitest'
import { detectAppEnv, isLocalAppEnv } from '../../../shared/runtimeEnv'

// Helper to run with a clean env snapshot
function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
    const prev = { ...process.env }
    Object.keys(process.env).forEach(k => {
        delete (process.env as any)[k]
    })
    Object.assign(process.env, env)
    try {
        return fn()
    } finally {
        Object.keys(process.env).forEach(k => {
            delete (process.env as any)[k]
        })
        Object.assign(process.env, prev)
    }
}

describe('runtimeEnv', () => {
    it('detects prod for Render (RENDER)', () => {
        const env = withEnv({ RENDER: '1' }, () => detectAppEnv())
        expect(env).toBe('prod')
    })

    it('detects prod for Render (RENDER_EXTERNAL_URL)', () => {
        const env = withEnv({ RENDER_EXTERNAL_URL: 'https://render.app' }, () =>
            detectAppEnv()
        )
        expect(env).toBe('prod')
    })

    it('detects dev for Fly.io (FLY_ALLOC_ID)', () => {
        const env = withEnv({ FLY_ALLOC_ID: 'alloc-123' }, () => detectAppEnv())
        expect(env).toBe('dev')
    })

    it('detects prod for Vercel (VERCEL)', () => {
        const env = withEnv({ VERCEL: '1' }, () => detectAppEnv())
        expect(env).toBe('prod')
    })

    it('detects prod when NODE_ENV=production', () => {
        const env = withEnv({ NODE_ENV: 'production' }, () => detectAppEnv())
        expect(env).toBe('prod')
    })

    it('defaults to local otherwise', () => {
        const env = withEnv({}, () => detectAppEnv())
        expect(env).toBe('local')
    })

    it('isLocalAppEnv mirrors detectAppEnv === local', () => {
        const a = withEnv({}, () => isLocalAppEnv())
        const b = withEnv({ NODE_ENV: 'production' }, () => isLocalAppEnv())
        expect(a).toBe(true)
        expect(b).toBe(false)
    })

    it('precedence favors Render over others', () => {
        const env = withEnv(
            {
                RENDER: '1',
                FLY_ALLOC_ID: 'x',
                VERCEL: '1',
                NODE_ENV: 'production',
            },
            () => detectAppEnv()
        )
        expect(env).toBe('prod')
    })

    it('precedence favors Fly dev over Vercel/production', () => {
        const env = withEnv(
            { FLY_ALLOC_ID: 'x', VERCEL: '1', NODE_ENV: 'production' },
            () => detectAppEnv()
        )
        expect(env).toBe('dev')
    })
})
