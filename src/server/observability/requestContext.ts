import { AsyncLocalStorage } from 'async_hooks'
import { getReqObsById } from './requestObservability'
import { extractRequestId } from '../utils/requestIdentity'

type RequestContext = { requestId?: string }
const als = new AsyncLocalStorage<RequestContext>()

export function withRequestContext(req: any, res: any, next: any) {
    const id = extractRequestId(req, res)
    als.run({ requestId: id }, () => next())
}

export function getRequestId(): string | undefined {
    return als.getStore()?.requestId
}

function getObsForCurrentRequest() {
    const id = getRequestId()
    if (!id) return undefined
    return getReqObsById(id)
}

export function bumpPulseReq() {
    const obs = getObsForCurrentRequest()
    if (obs) obs.pulseCalls += 1
}

export function bumpPulseErr(kind: string) {
    const obs = getObsForCurrentRequest()
    if (obs) obs.pulseErrs[kind] = (obs.pulseErrs[kind] || 0) + 1
}

export function bumpCache(hit: boolean) {
    const obs = getObsForCurrentRequest()
    if (!obs) return
    if (hit) obs.cacheHits += 1
    else obs.cacheMisses += 1
}
