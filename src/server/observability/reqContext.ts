import { AsyncLocalStorage } from 'async_hooks'
import { getReqObs } from './reqObs'

type Ctx = { requestId?: string }
const als = new AsyncLocalStorage<Ctx>()

export function withRequestContext(req: any, res: any, next: any) {
  const id = (req.headers?.['x-request-id'] as string) || (res.getHeader?.('x-request-id') as string) || (req.id as string) || undefined
  als.run({ requestId: id }, () => next())
}

export function getRequestId(): string | undefined {
  return als.getStore()?.requestId
}

export function bumpPulseReq() {
  const id = getRequestId()
  if (!id) return
  const dummyReq: any = { headers: { 'x-request-id': id } }
  const obs = getReqObs(dummyReq)
  if (obs) obs.pulseCalls += 1
}

export function bumpPulseErr(kind: string) {
  const id = getRequestId()
  if (!id) return
  const dummyReq: any = { headers: { 'x-request-id': id } }
  const obs = getReqObs(dummyReq)
  if (obs) obs.pulseErrs[kind] = (obs.pulseErrs[kind] || 0) + 1
}

export function bumpCache(hit: boolean) {
  const id = getRequestId()
  if (!id) return
  const dummyReq: any = { headers: { 'x-request-id': id } }
  const obs = getReqObs(dummyReq)
  if (!obs) return
  if (hit) obs.cacheHits += 1
  else obs.cacheMisses += 1
}
