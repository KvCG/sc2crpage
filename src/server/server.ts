import express, { Request, Response, NextFunction } from 'express'
import apiRoutes from './routes/apiRoutes'
import path from 'path'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import crypto from 'crypto'
import chokidar from 'chokidar'
import 'dotenv/config'
import { getBackendBuildInfo } from './utils/buildInfo'
import { isLocalAppEnv } from '../shared/runtimeEnv'
import { httpLogger, httpMetricsMiddleware } from './logging/http'
import { metrics, estimateQuantile } from './metrics/lite'
import { getReqObs, finalizeReq, getById } from './observability/reqObs'
import { withRequestContext } from './observability/reqContext'

const app = express()
const port = process.env.PORT || 3000
const wsPort = 4000 // Port for WebSocket server
// Detect local early; compute build info for all envs to keep behavior consistent
const isLocal = isLocalAppEnv(process.env)
const buildInfo = getBackendBuildInfo()
if (!isLocal && buildInfo) console.log('[build]', JSON.stringify(buildInfo))

// WebSocket server for development reloads
if (process.env.NODE_ENV === 'development') {
    const wsServer = createServer() // Separate HTTP server for WebSocket
    const wss = new WebSocketServer({ server: wsServer })

    // Start the WebSocket server
    wsServer.listen(wsPort, () => {
        console.log(`WebSocket server running at ws://localhost:${wsPort}`)
    })

    // Handle WebSocket connections
    wss.on('connection', ws => {
        ws.on('message', message => {
            if (typeof message === 'string' && message === 'reload') {
                ws.send('reload')
            }
        })

        ws.on('close', () => {})
    })

    // Watch for file changes and trigger reload
    chokidar.watch('./src/server').on('all', () => {
        // Ensure the WebSocket server has clients
        if (wss.clients.size > 0) {
            console.log(`Broadcasting reload to ${wss.clients.size} client(s)`)
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send('reload')
                }
            })
        }
    })
}

// Middleware and routes
app.use(cors())
app.use(httpLogger)
app.use(withRequestContext)
app.use(httpMetricsMiddleware)
// Correlation + response time
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()
    const corr = (req.headers['x-correlation-id'] as string) || crypto.randomUUID?.() || crypto.randomBytes(16).toString('hex')
    res.setHeader('x-correlation-id', corr)
    res.setHeader('x-powered-by', 'sc2cr')
    res.setHeader('x-response-start-ms', String(start))
    getReqObs(req)
    res.on('finish', () => {
        const ms = Date.now() - start
        try { res.setHeader('x-response-time-ms', String(ms)) } catch {}
        finalizeReq(req)
    })
    next()
})
// Remove root debug handler; use canonical /api/build for debug
app.use(express.static(path.join(__dirname, '../')))
app.use(express.json({ limit: '30mb' }))
app.use(express.urlencoded({ limit: '30mb', extended: true }))
app.use('/api', apiRoutes)
// General debug endpoint driven by query parameter
app.get('/api/debug', (req: Request, res: Response) => {
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
        const found = getById(id)
        if (!found) return res.status(404).json({ error: 'Not found' })
        return res.json(found)
    }
    return res.status(400).json({ error: 'Unsupported type', supported: ['buildInfo'] })
})

// Back-compat alias for build info (deprecated)
app.get('/api/build', (req: Request, res: Response) => {
    const q = (req.query.debug || req.query.type) as string | undefined
    if (q && q !== 'buildInfo') {
        return res.status(400).json({ error: 'Unsupported param', supported: ['buildInfo'] })
    }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(buildInfo, null, 2))
})

// Handle SPA routing
app.get('*', (_req: Request, res: Response) => {
    // SPA fallback
    res.sendFile(path.join(__dirname, '../index.html'))
})

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.message)
    res.status(500).send('Internal Server Error')
})

// Start the Express server
app.listen(port, () => {
    console.log(`Express server running at http://localhost:${port}`)
})
