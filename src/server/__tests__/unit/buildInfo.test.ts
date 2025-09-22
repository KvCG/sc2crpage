import { describe, it, expect } from 'vitest'
import { getBackendBuildInfo } from '../../utils/buildInfo'

// Run callback with a clean environment setup, then restore previous env.
// Why: keep tests deterministic and isolated from the host/CI environment.
function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
    const prev = { ...process.env }
    Object.keys(process.env).forEach(key => {
        delete (process.env as any)[key]
    })
    Object.assign(process.env, env)
    try {
        return fn()
    } finally {
        Object.keys(process.env).forEach(key => {
            delete (process.env as any)[key]
        })
        Object.assign(process.env, prev)
    }
}

describe('buildInfo', () => {
    it('returns local env with optional git enrichment', () => {
        const info = withEnv({ NODE_ENV: 'development' }, () =>
            getBackendBuildInfo()
        )
        expect(info.env).toBe('local')
        expect(info.app).toBe('server')
        // In local, commit is 'local' if git unavailable, or short sha when git exists
        expect(info.commit.length).toBeGreaterThan(0)
        // Branch/message may be present when git exists; otherwise undefined
        // We assert type and do not force presence
        expect(['string', 'undefined']).toContain(typeof info.branch)
        expect(['string', 'undefined']).toContain(typeof info.commitMessage)
    })

    it('uses CI vars when available (vercel) and prod env', () => {
        const info = withEnv(
            {
                NODE_ENV: 'production',
                VERCEL: '1',
                VERCEL_GIT_COMMIT_SHA: 'abcdef012345',
                VERCEL_GIT_COMMIT_REF: 'dev',
                VERCEL_GIT_COMMIT_MESSAGE: 'feat: x',
                GITHUB_RUN_NUMBER: '42',
            },
            () => getBackendBuildInfo()
        )
        expect(info.env).toBe('prod')
        expect(info.commit).toBe('abcdef0')
        expect(info.branch).toBe('dev')
        expect(info.commitMessage).toBe('feat: x')
        expect(info.buildNum).toBe('42')
    })

    it('falls back to github ref parsing for PR id', () => {
        const info = withEnv(
            {
                GITHUB_REF: 'refs/pull/123/merge',
                GITHUB_SHA: '1234567',
                NODE_ENV: 'production',
            },
            () => getBackendBuildInfo()
        )
        expect(info.env).toBe('prod')
        expect(info.pr).toBe('123')
        expect(info.commit).toBe('1234567')
    })
})
