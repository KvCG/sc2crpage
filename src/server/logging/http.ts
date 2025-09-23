import pinoHttp from 'pino-http'
import type { IncomingMessage, ServerResponse } from 'http'
import logger from './logger'
import { metrics } from '../metrics/lite'
import { extractRequestId } from '../utils/requestId'

// Keep logs simple: log all requests except health pings

// HTTP logger middleware
// - Assigns/returns a `x-request-id`
// - Ignores /api/health by default
// - Logs 2xx/3xx at info, 4xx/5xx at error
export const httpLogger = pinoHttp({
    logger,
    genReqId: function (req: IncomingMessage, res: ServerResponse) {
        const id = extractRequestId(req, res) || Math.random().toString(16).slice(2)
        res.setHeader('x-request-id', id)
        return id
    },
    autoLogging: {
        ignore: (req: any) => {
            const url: string = req.url || ''
            if (url.startsWith('/api/health')) return true
            return false
        },
    },
    serializers: {
        req(req: any) {
            return { method: req.method, url: req.url, id: (req as any).id }
        },
        res(res: any) {
            return { status: res.statusCode }
        },
    },
    customSuccessMessage: function () {
        return undefined as any
    },
    customErrorMessage: function (req: any, res: any) {
        return `${req.method} ${req.url} -> ${res.statusCode}`
    },
    customLogLevel: function (res: any, err: any) {
        if (err || res.statusCode >= 400) return 'error'
        return 'info'
    },
})

export function httpMetricsMiddleware(_req: any, res: any, next: any) {
    res.on('finish', () => {
        metrics.http_total++
        if (res.statusCode >= 500) metrics.http_5xx_total++
    })
    next()
}

export default httpLogger
