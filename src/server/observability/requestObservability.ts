export type ReqObs = {
    id: string                  // request identifier
    startMs: number             // start timestamp (ms since epoch)
    durationMs?: number         // total duration (set on finalize)
    pulseCalls: number          // number of pulse calls during request
    pulseErrs: Record<string, number> // error counts by key/type
    cacheHits: number           // cache hits during request
    cacheMisses: number         // cache misses during request
}

type RequestLike = { headers?: Record<string, unknown>; id?: string | number }

import { extractRequestId } from '../utils/requestIdentity'

const REQUEST_OBS_ENABLED: boolean =
    String(process.env.ENABLE_REQ_OBS ?? 'true').toLowerCase() === 'true'

const OBS_RING_SIZE = 200

const store = {
    ring: new Array<ReqObs | undefined>(OBS_RING_SIZE),
    head: 0,
    byId: new Map<string, ReqObs>(),
}

function ensureEntry(id: string): ReqObs {
    let obs = store.byId.get(id)
    if (obs) return obs
    obs = { id, startMs: Date.now(), pulseCalls: 0, pulseErrs: {}, cacheHits: 0, cacheMisses: 0 }
    store.byId.set(id, obs)
    const old = store.ring[store.head]
    if (old && old.id) {
        store.byId.delete(old.id)
    }
    store.ring[store.head] = obs
    store.head = (store.head + 1) % OBS_RING_SIZE
    return obs
}

export function getReqObs(req: RequestLike): ReqObs | undefined {
    if (!REQUEST_OBS_ENABLED) return undefined
    const id = extractRequestId(req as any)
    if (!id) return undefined
    return ensureEntry(id)
}

export function finalizeReq(req: RequestLike) {
    if (!REQUEST_OBS_ENABLED) return
    const id = extractRequestId(req as any)
    if (!id) return
    const obs = store.byId.get(id)
    if (obs) obs.durationMs = Math.max(0, Date.now() - obs.startMs)
}

export function getReqObsById(id: string): ReqObs | undefined {
    return store.byId.get(id)
}
