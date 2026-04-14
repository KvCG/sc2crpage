import { Request, Response } from 'express' // Express request/response types
import { metrics, estimateQuantile } from '../metrics/lite' // App metrics and quantile estimator

// Factory that creates the debug handler with injected build info
export function createDebugHandler(deps: { buildInfo: any }) {
    const { buildInfo } = deps
    return function debugHandler(req: Request, res: Response) {
        // Accepts ?type=
        const type = (req.query.type) as string | undefined
        if (!type) {
            return res.status(400).json({ error: 'Missing query', expected: { type: 'buildInfo|metrics' } })
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

        // Unknown type
        return res.status(400).json({ error: 'Unsupported type', supported: ['buildInfo', 'metrics'] })
    }
}

export default createDebugHandler
