import { AsyncLocalStorage } from 'async_hooks'
import { getReqObs } from './reqObs'
import { extractRequestId } from '../utils/requestId'

// Per-request context stored via AsyncLocalStorage
type RequestContext = { requestId?: string }
const als = new AsyncLocalStorage<RequestContext>()

// Middleware: capture request id and run handler within ALS context
export function withRequestContext(req: any, res: any, next: any) {
    const id = extractRequestId(req, res)
    als.run({ requestId: id }, () => next())
}

// Read current request id from ALS (if any)
export function getRequestId(): string | undefined {
    return als.getStore()?.requestId
}

// Get observability bucket for the current request (if available)
function getObsForCurrentRequest() {
    const id = getRequestId()
    if (!id) return undefined
    // Fabricate the minimal request shape expected by getReqObs
    const reqLike: any = { headers: { 'x-request-id': id } }
    return getReqObs(reqLike)
}

// Increment count of pulse calls for this request
export function bumpPulseReq() {
    const obs = getObsForCurrentRequest()
    if (obs) obs.pulseCalls += 1
}

// Increment categorized pulse error count
export function bumpPulseErr(kind: string) {
    const obs = getObsForCurrentRequest()
    if (obs) obs.pulseErrs[kind] = (obs.pulseErrs[kind] || 0) + 1
}

// Track cache hit/miss for this request
export function bumpCache(hit: boolean) {
    const obs = getObsForCurrentRequest()
    if (!obs) return
    if (hit) obs.cacheHits += 1
    else obs.cacheMisses += 1
}

// Extract a request id from req/res using common header/id fields
// extractRequestId now lives in utils/requestId to keep it shared
