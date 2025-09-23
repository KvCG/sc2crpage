/**
 * Request-scoped context using AsyncLocalStorage.
 * Stores a per-request requestId and exposes helpers to bump observability counters
 * (pulse, error kinds, cache hits/misses) tied to the current request.
 */
import { AsyncLocalStorage } from 'async_hooks'
import { getReqObsById } from './requestObservability'
import { extractRequestId } from '../utils/requestIdentity'

type RequestContext = { requestId?: string }
const als = new AsyncLocalStorage<RequestContext>() // per-request store

export function withRequestContext(req: any, res: any, next: any) {
    // Initialize store for this request with its id
    const id = extractRequestId(req, res)
    als.run({ requestId: id }, () => next())
}

export function getRequestId(): string | undefined {
    // Read current request id from the store
    return als.getStore()?.requestId
}

function getObsForCurrentRequest() {
    // Resolve observability record for the current request id
    const id = getRequestId()
    if (!id) return undefined
    return getReqObsById(id)
}

export function bumpPulseReq() {
    // Increment total pulse calls
    const obs = getObsForCurrentRequest()
    if (obs) obs.pulseCalls += 1
}

export function bumpPulseErr(kind: string) {
    // Increment pulse error counter by kind
    const obs = getObsForCurrentRequest()
    if (obs) obs.pulseErrs[kind] = (obs.pulseErrs[kind] || 0) + 1
}

export function bumpCache(hit: boolean) {
    // Track cache hits/misses
    const obs = getObsForCurrentRequest()
    if (!obs) return
    if (hit) obs.cacheHits += 1
    else obs.cacheMisses += 1
}
