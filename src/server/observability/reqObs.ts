export type ReqObs = {
    id: string
    startMs: number
    durationMs?: number
    pulseCalls: number
    pulseErrs: Record<string, number>
    cacheHits: number
    cacheMisses: number
}

// Lightweight, in-memory request observability store.
// - Pull-based only (no background logging)
// - Keeps the last ~200 entries in a ring buffer for cheap iteration if needed
// - Lookups are O(1) via map keyed by requestId

type RequestLike = { headers?: Record<string, unknown>; id?: string | number }

const REQUEST_OBS_ENABLED: boolean =
    String(process.env.ENABLE_REQ_OBS ?? 'true').toLowerCase() === 'true'
const OBS_RING_SIZE = 200

const store = {
    ring: new Array<ReqObs | undefined>(OBS_RING_SIZE),
    head: 0,
    byId: new Map<string, ReqObs>(),
}

function resolveRequestId(req: RequestLike): string | null {
    const headers = (req && req.headers) || {}
    const rid = (headers['x-request-id'] as string) ||
        (headers['x-correlation-id'] as string) ||
        (req as any)?.id || ''
    return rid ? String(rid) : null
}

function ensureEntry(id: string): ReqObs {
    let obs = store.byId.get(id)
    if (obs) return obs
    obs = { id, startMs: Date.now(), pulseCalls: 0, pulseErrs: {}, cacheHits: 0, cacheMisses: 0 }
    store.byId.set(id, obs)
    store.ring[store.head] = obs
    store.head = (store.head + 1) % OBS_RING_SIZE
    return obs
}

export function getReqObs(req: RequestLike): ReqObs | undefined {
    if (!REQUEST_OBS_ENABLED) return undefined
    const id = resolveRequestId(req)
    if (!id) return undefined
    return ensureEntry(id)
}

export function finalizeReq(req: RequestLike) {
    if (!REQUEST_OBS_ENABLED) return
    const id = resolveRequestId(req)
    if (!id) return
    const obs = store.byId.get(id)
    if (obs) obs.durationMs = Math.max(0, Date.now() - obs.startMs)
}

export function getById(id: string): ReqObs | undefined {
    return store.byId.get(id)
}

export function getReqObsById(id: string): ReqObs | undefined {
    return store.byId.get(id)
}
