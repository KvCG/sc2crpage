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
import { getReqObs, finalizeReq } from './observability/reqObs'
import { withRequestContext } from './observability/reqContext'
import { extractRequestId } from './utils/requestId'
import createDebugHandler from './routes/debugHandler'
import logger from './logging/logger'

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
    logger.debug({ route: req.url, method: req.method, corr }, 'request start')
    const requestId = extractRequestId(req, res) || corr
    if (requestId) {
        const reqLike: any = { headers: { 'x-request-id': String(requestId) } }
        getReqObs(reqLike)
        res.on('finish', () => {
            try { res.setHeader('x-response-time-ms', String(Date.now() - start)) } catch {}
            finalizeReq(reqLike)
            logger.debug({ route: req.url, method: req.method, corr, status: res.statusCode }, 'request end')
        })
    } else {
        res.on('finish', () => {
            try { res.setHeader('x-response-time-ms', String(Date.now() - start)) } catch {}
            logger.debug({ route: req.url, method: req.method, corr, status: res.statusCode }, 'request end')
        })
    }
    next()
})
// Remove root debug handler; use canonical /api/build for debug
app.use(express.static(path.join(__dirname, '../')))
app.use(express.json({ limit: '30mb' }))
app.use(express.urlencoded({ limit: '30mb', extended: true }))
app.use('/api', apiRoutes)
// General debug endpoint driven by query parameter (unguarded by design)
app.get('/api/debug', createDebugHandler({ buildInfo }))

// Handle SPA routing
app.get('*', (_req: Request, res: Response) => {
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
