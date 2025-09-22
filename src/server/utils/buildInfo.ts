// Purpose: produce standardized build metadata for the server.
// Strategy: rely solely on CI/CD-provided env vars. No git calls.
import { detectAppEnv, isLocalAppEnv } from '../../shared/runtimeEnv'
import {
    getBranchFromGit,
    getCommitMessageFromGit,
    getShortShaFromGit,
} from './gitInfo'

export type BuildInfo = {
    app: 'client' | 'server'
    env: 'prod' | 'dev' | 'local'
    commit: string
    commitMessage?: string
    branch?: string
    pr?: string
    buildNum?: string
}

function isLocal(): boolean {
    return isLocalAppEnv(process.env)
}

function getShortSha(): string {
    if (isLocal()) {
        // Enrich from local git when available for integrity
        return getShortShaFromGit() || 'local'
    }
    const envSha =
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.RENDER_GIT_COMMIT ||
        process.env.GITHUB_SHA
    return envSha ? String(envSha).slice(0, 7) : 'unknown'
}

function getPr(): string | undefined {
    // Vercel exposes PR number directly; GitHub exposes it via ref path
    const vercelPr = process.env.VERCEL_GIT_PULL_REQUEST
    if (vercelPr) return String(vercelPr)
    const ref = process.env.GITHUB_REF || ''
    const m = ref.match(/refs\/pull\/(\d+)\/merge/)
    if (m) return m[1]
    return undefined
}

function getBranch(): string | undefined {
    if (isLocal()) {
        return getBranchFromGit()
    }
    if (process.env.VERCEL_GIT_COMMIT_REF)
        return String(process.env.VERCEL_GIT_COMMIT_REF)
    if (process.env.GITHUB_REF_NAME) return String(process.env.GITHUB_REF_NAME)
    const ref = process.env.GITHUB_REF || ''
    const m = ref.match(/^refs\/heads\/(.+)$/)
    if (m) return m[1]
    return undefined
}

function getEnv(): BuildInfo['env'] {
    return detectAppEnv(process.env)
}

function getCommitMessage(): string | undefined {
    if (isLocal()) {
        return getCommitMessageFromGit()
    }
    const envMsg = process.env.VERCEL_GIT_COMMIT_MESSAGE
    return envMsg ? String(envMsg) : undefined
}

export function getBackendBuildInfo(): BuildInfo {
    // app identifies the layer; 'server' complements 'client' in FE outputs
    return {
        app: 'server',
        env: getEnv(),
        commit: getShortSha(),
        commitMessage: getCommitMessage(),
        branch: getBranch(),
        pr: getPr(),
        buildNum: process.env.GITHUB_RUN_NUMBER,
    }
}
