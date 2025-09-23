import { Request, Response } from 'express'
import { metrics, estimateQuantile } from '../metrics/lite'
import { getReqObsById } from '../observability/reqObs'

export function createDebugHandler(deps: { buildInfo: any }) {
    const { buildInfo } = deps
    return function debugHandler(req: Request, res: Response) {
        const type = (req.query.type || req.query.debug) as string | undefined
        if (!type) {
            return res.status(400).json({ error: 'Missing query', expected: { type: 'buildInfo|metrics|req' } })
        }
        if (type === 'buildInfo') {
            res.setHeader('content-type', 'application/json')
            return res.end(JSON.stringify(buildInfo, null, 2))
        }
        if (type === 'metrics') {
            const body = {
                http_total: metrics.http_total,
                http_5xx_total: metrics.http_5xx_total,
                pulse_req_total: metrics.pulse_req_total,
                pulse_err_total: metrics.pulse_err_total,
                cache_hit_total: metrics.cache_hit_total,
                cache_miss_total: metrics.cache_miss_total,
                pulse_p95_ms: estimateQuantile(0.95),
                pulse_p99_ms: estimateQuantile(0.99),
            }
            return res.json(body)
        }
        if (type === 'req') {
            const id = String(req.query.id || '')
            if (!id) return res.status(400).json({ error: 'Missing id' })
            const found = getReqObsById(id)
            if (!found) return res.status(404).json({ error: 'Not found' })
            return res.json(found)
        }
        return res.status(400).json({ error: 'Unsupported type', supported: ['buildInfo', 'metrics', 'req'] })
    }
}

export default createDebugHandler
