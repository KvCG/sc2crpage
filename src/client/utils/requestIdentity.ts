// Resolve a request id strictly from URL params
// Supported param keys: rid, reqid, requestId
export function resolveRequestId(): string | undefined {
    try {
        const url = new URL(window.location.href)
        for (const key of ['rid', 'reqid', 'requestId']) {
            const val = url.searchParams.get(key)
            if (val) return val
        }
    } catch (_) {
        // ignore URL parsing issues
    }
    return undefined
}

export default resolveRequestId
