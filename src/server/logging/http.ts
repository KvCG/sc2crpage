import pinoHttp from 'pino-http'
import type { IncomingMessage, ServerResponse } from 'http'
import logger from './logger'
import { metrics } from '../metrics/lite'
import crypto from 'crypto'

const LOG_HTTP_SUCCESS = String(process.env.LOG_HTTP_SUCCESS ?? 'false').toLowerCase() === 'true'

export const httpLogger = pinoHttp({
  logger,
  genReqId: function (req: IncomingMessage, res: ServerResponse) {
    const hdr = (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string)
    const id = hdr || (crypto.randomUUID?.() || Math.random().toString(16).slice(2))
    res.setHeader('x-request-id', id)
    return id
  },
  autoLogging: {
    ignore: (req: any) => {
      const url: string = req.url || ''
      // Quiet /api/health by default
      if (url.startsWith('/api/health')) return true
      if (!LOG_HTTP_SUCCESS) return true // we handle errors manually
      return false
    }
  },
  serializers: {
    req(req: any) {
      return { method: req.method, url: req.url, id: (req as any).id }
    },
    res(res: any) {
      return { status: res.statusCode }
    },
  },
  customSuccessMessage: function () { return undefined as any },
  customErrorMessage: function (req: any, res: any) {
    return `${req.method} ${req.url} -> ${res.statusCode}`
  },
  customLogLevel: function (res: any, err: any) {
    if (err || res.statusCode >= 400) return 'error'
    return LOG_HTTP_SUCCESS ? 'info' : 'silent'
  }
})

// Hook counters on finish
export function httpMetricsMiddleware(_req: any, res: any, next: any) {
  const started = Date.now()
  res.on('finish', () => {
    metrics.http_total++
    if (res.statusCode >= 500) metrics.http_5xx_total++
    const rt = Date.now() - started
    // Attach as header for convenience
    try { res.setHeader('x-response-time-ms', String(rt)) } catch {}
  })
  next()
}

export default httpLogger
