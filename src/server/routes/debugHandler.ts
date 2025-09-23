import { Request, Response } from 'express' // Express request/response types
import { metrics, estimateQuantile } from '../metrics/lite' // App metrics and quantile estimator
import { getReqObsById } from '../observability/requestObservability' // Accessor for per-request observability data

// Factory that creates the debug handler with injected build info
export function createDebugHandler(deps: { buildInfo: any }) {
    const { buildInfo } = deps
    return function debugHandler(req: Request, res: Response) {
        // Accepts ?type=
        const type = (req.query.type) as string | undefined
        if (!type) {
            return res.status(400).json({ error: 'Missing query', expected: { type: 'buildInfo|metrics|req' } })
        }

        // Return build info payload
        if (type === 'buildInfo') {
            res.setHeader('content-type', 'application/json') // Ensure JSON content-type
            return res.end(JSON.stringify(buildInfo, null, 2)) // Pretty-print for readability
        }

        // Return current metrics snapshot
        if (type === 'metrics') {
            const body = {
                http_total: metrics.http_total, // All HTTP requests
                http_5xx_total: metrics.http_5xx_total, // 5xx responses
                pulse_req_total: metrics.pulse_req_total, // Pulse requests processed
                pulse_err_total: metrics.pulse_err_total, // Pulse errors observed
                cache_hit_total: metrics.cache_hit_total, // Cache hits
                cache_miss_total: metrics.cache_miss_total, // Cache misses
                pulse_p95_ms: estimateQuantile(0.95), // 95th percentile latency (ms)
                pulse_p99_ms: estimateQuantile(0.99), // 99th percentile latency (ms)
            }
            return res.json(body)
        }

        // Return a single request observability record by id
        if (type === 'req') {
            const id = String(req.query.id || '') // ?id= required
            if (!id) return res.status(400).json({ error: 'Missing id' })
            const found = getReqObsById(id)
            if (!found) return res.status(404).json({ error: 'Not found' })
            return res.json(found)
        }

        // Unknown type
        return res.status(400).json({ error: 'Unsupported type', supported: ['buildInfo', 'metrics', 'req'] })
    }
}

export default createDebugHandler
