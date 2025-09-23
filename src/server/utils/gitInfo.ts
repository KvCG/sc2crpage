import { execSync } from 'node:child_process'

// Best-effort helpers to read git metadata. Intended for local-only enrichment.
// All functions return undefined on error.

export function getShortShaFromGit(): string | undefined {
    try {
        const out = execSync('git rev-parse --short HEAD', {
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .toString()
            .trim()
        return out || undefined
    } catch {
        return undefined
    }
}

export function getBranchFromGit(): string | undefined {
    try {
        const out = execSync('git rev-parse --abbrev-ref HEAD', {
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .toString()
            .trim()
        return out || undefined
    } catch {
        return undefined
    }
}

export function getCommitMessageFromGit(): string | undefined {
    try {
        const out = execSync('git log -1 --pretty=%s', {
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .toString()
            .trim()
        return out || undefined
    } catch {
        return undefined
    }
}
