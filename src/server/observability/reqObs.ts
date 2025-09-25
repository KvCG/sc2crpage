export type ReqObs = {
  id: string
  startMs: number
  durationMs?: number
  pulseCalls: number
  pulseErrs: Record<string, number>
  cacheHits: number
  cacheMisses: number
}

const ENABLE_REQ_OBS = String(process.env.ENABLE_REQ_OBS ?? 'true').toLowerCase() === 'true'
const SIZE = 200
const ring: (ReqObs | undefined)[] = new Array(SIZE)
let head = 0
const byId = new Map<string, ReqObs>()

export function getReqObs(req: any): ReqObs | undefined {
  if (!ENABLE_REQ_OBS) return undefined
  const id = (req.headers?.['x-request-id'] as string) || (req.headers?.['x-correlation-id'] as string) || (req.id as string) || ''
  if (!id) return undefined
  let obs = byId.get(id)
  if (!obs) {
    obs = { id, startMs: Date.now(), pulseCalls: 0, pulseErrs: {}, cacheHits: 0, cacheMisses: 0 }
    byId.set(id, obs)
    ring[head] = obs
    head = (head + 1) % SIZE
  }
  return obs
}

export function finalizeReq(req: any) {
  if (!ENABLE_REQ_OBS) return
  const id = (req.headers?.['x-request-id'] as string) || (req.headers?.['x-correlation-id'] as string) || (req.id as string) || ''
  if (!id) return
  const obs = byId.get(id)
  if (obs) {
    obs.durationMs = Math.max(0, Date.now() - obs.startMs)
  }
}

export function getById(id: string): ReqObs | undefined {
  return byId.get(id)
}
