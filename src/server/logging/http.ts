import pinoHttp from 'pino-http'
import type { IncomingMessage, ServerResponse } from 'http'
import logger from './logger'
import { metrics } from '../metrics/lite'
import crypto from 'crypto'

const LOG_HTTP_SUCCESS = String(process.env.LOG_HTTP_SUCCESS ?? 'false').toLowerCase() === 'true'

function resolveReqId(req: IncomingMessage) {
    const hdr = (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string)
    return hdr || crypto.randomUUID?.() || Math.random().toString(16).slice(2)
}

export const httpLogger = pinoHttp({
    logger,
    genReqId: function (req: IncomingMessage, res: ServerResponse) {
        const id = resolveReqId(req)
        res.setHeader('x-request-id', id)
        return id
    },
    autoLogging: {
        ignore: (req: any) => {
            const url: string = req.url || ''
            if (url.startsWith('/api/health')) return true
            if (!LOG_HTTP_SUCCESS) return true
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
        return LOG_HTTP_SUCCESS ? 'info' : 'silent'
    },
})

export function httpMetricsMiddleware(_req: any, res: any, next: any) {
    res.on('finish', () => {
        metrics.http_total++
        if (res.statusCode >= 500) metrics.http_5xx_total++
        // Response time header is set in server correlation middleware; avoid duplication here.
    })
    next()
}

export default httpLogger
