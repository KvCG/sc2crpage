import type { Plugin } from 'vite'
import { execSync } from 'node:child_process'
import { detectAppEnv } from '../src/shared/runtimeEnv'

export default function clientBuildInfo(): Plugin {
    // Local-only git helpers (best-effort)
    const gitSha = () => {
        try {
            return (
                execSync('git rev-parse --short HEAD', {
                    stdio: ['ignore', 'pipe', 'ignore'],
                })
                    .toString()
                    .trim() || undefined
            )
        } catch {
            return undefined
        }
    }
    const gitBranch = () => {
        try {
            return (
                execSync('git rev-parse --abbrev-ref HEAD', {
                    stdio: ['ignore', 'pipe', 'ignore'],
                })
                    .toString()
                    .trim() || undefined
            )
        } catch {
            return undefined
        }
    }
    const gitMsg = () => {
        try {
            return (
                execSync('git log -1 --pretty=%s', {
                    stdio: ['ignore', 'pipe', 'ignore'],
                })
                    .toString()
                    .trim() || undefined
            )
        } catch {
            return undefined
        }
    }

    const getEnv = () => detectAppEnv(process.env)
    const env = getEnv()
    const getShortSha = () => {
        if (env === 'local') return gitSha() || 'local'
        const envSha =
            process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA
        return envSha ? String(envSha).slice(0, 7) : 'unknown'
    }
    const getCommitMessage = () => {
        if (env === 'local') return gitMsg()
        const envMsg = process.env.VERCEL_GIT_COMMIT_MESSAGE
        return envMsg ? String(envMsg) : undefined
    }
    const getPr = () => process.env.VERCEL_GIT_PULL_REQUEST || undefined
    const getBranch = () => {
        if (env === 'local') return gitBranch()
        if (process.env.VERCEL_GIT_COMMIT_REF)
            return String(process.env.VERCEL_GIT_COMMIT_REF)
        if (process.env.GITHUB_REF_NAME)
            return String(process.env.GITHUB_REF_NAME)
        return undefined
    }
    const buildNum = process.env.GITHUB_RUN_NUMBER
    const build = {
        app: 'client' as const,
        env,
        commit: getShortSha(),
        commitMessage: getCommitMessage(),
        branch: getBranch(),
        pr: getPr(),
        buildNum,
    }

    return {
        name: 'sc2cr-build-meta',
        transformIndexHtml(html) {
            const pretty = JSON.stringify(build, null, 2)
            return html.replace(
                /<head>/,
                `<head>\n<!-- sc2cr build info (readable):\n${pretty}\n-->`
            )
        },
    }
}
