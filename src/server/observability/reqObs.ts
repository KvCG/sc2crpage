export type ReqObs = {
    id: string                  // request identifier
    startMs: number             // start timestamp (ms since epoch)
    durationMs?: number         // total duration (set on finalize)
    pulseCalls: number          // number of pulse calls during request
    pulseErrs: Record<string, number> // error counts by key/type
    cacheHits: number           // cache hits during request
    cacheMisses: number         // cache misses during request
}

// Lightweight, in-memory request observability store.
// - Pull-based only (no background logging)
// - Keeps the last ~200 entries in a ring buffer for cheap iteration if needed
// - Lookups are O(1) via map keyed by requestId

type RequestLike = { headers?: Record<string, unknown>; id?: string | number }

// Feature flag (default: enabled via ENV ENABLE_REQ_OBS)
const REQUEST_OBS_ENABLED: boolean =
    String(process.env.ENABLE_REQ_OBS ?? 'true').toLowerCase() === 'true'

const OBS_RING_SIZE = 200 // ring buffer capacity

const store = {
    ring: new Array<ReqObs | undefined>(OBS_RING_SIZE), // circular buffer of recent entries
    head: 0,                                             // next write position in ring
    byId: new Map<string, ReqObs>(),                     // fast lookup by request id
}

// Extracts request id from common headers or req.id; returns null if absent
function resolveRequestId(req: RequestLike): string | null {
    const headers = (req && req.headers) || {}
    const requestId = (headers['x-request-id'] as string) ||
        (headers['x-correlation-id'] as string) ||
        (req as any)?.id || ''
    return requestId ? String(requestId) : null
}

// Ensures an observability entry exists; creates and indexes it if missing
function ensureEntry(id: string): ReqObs {
    // Check if we already have it in the store
    let obs = store.byId.get(id)
    if (obs) return obs
    // if not, create a new entry
    obs = { id, startMs: Date.now(), pulseCalls: 0, pulseErrs: {}, cacheHits: 0, cacheMisses: 0 }
    store.byId.set(id, obs)
    // Write into ring and advance head (overwrite oldest when full)
    store.ring[store.head] = obs
    store.head = (store.head + 1) % OBS_RING_SIZE
    return obs
}

// Gets or creates an observability entry for a request (if feature enabled)
export function getReqObs(req: RequestLike): ReqObs | undefined {
    if (!REQUEST_OBS_ENABLED) return undefined
    // Lets grab the request id
    const id = resolveRequestId(req)
    if (!id) return undefined
    return ensureEntry(id)
}

// Finalizes a request by computing its duration
export function finalizeReq(req: RequestLike) {
    if (!REQUEST_OBS_ENABLED) return
    const id = resolveRequestId(req)
    if (!id) return
    const obs = store.byId.get(id)
    if (obs) obs.durationMs = Math.max(0, Date.now() - obs.startMs)
}

// Direct lookup by request id (current API)
export function getById(id: string): ReqObs | undefined {
    return store.byId.get(id)
}

// Back-compat alias for getById
export function getReqObsById(id: string): ReqObs | undefined {
    return store.byId.get(id)
}
