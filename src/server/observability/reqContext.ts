import { AsyncLocalStorage } from 'async_hooks'
import { getReqObs } from './reqObs'

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
    // Bridge into the request-scoped observability store by fabricating
    // the minimal shape it expects (a request with an id header).
    const reqLike: any = { headers: { 'x-request-id': id } }
    return getReqObs(reqLike)
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

export function extractRequestId(req: any, res?: any): string | undefined {
    return (
        (req?.headers?.['x-request-id'] as string) ||
        (res?.getHeader?.('x-request-id') as string) ||
        (req?.headers?.['x-correlation-id'] as string) ||
        (req?.id as string) ||
        undefined
    )
}
