export type AppEnv = 'prod' | 'dev' | 'local'

// Detect coarse runtime environment from process-like env.
// Centralized to keep client/server/vite consistent and readable.
export function detectAppEnv(
    env: Record<string, string | undefined> = process.env
): AppEnv {
    if (env.RENDER || env.RENDER_EXTERNAL_URL) return 'prod'
    if (env.FLY_ALLOC_ID) return 'dev'
    // Vercel indicates managed deploy (prod or preview) for client builds
    if (env.VERCEL) {
        // Vercel Preview deployments have VERCEL_ENV === 'preview'
        if (env.VERCEL_ENV === 'preview') return 'dev'
        return 'prod'
    }
    if (env.NODE_ENV === 'production') return 'prod'
    return 'local'
}

export function isLocalAppEnv(
    env: Record<string, string | undefined> = process.env
): boolean {
    return detectAppEnv(env) === 'local'
}
