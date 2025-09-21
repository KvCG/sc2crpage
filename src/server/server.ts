import express, { Request, Response, NextFunction } from 'express'
import apiRoutes from './routes/apiRoutes'
import path from 'path'
import cors from 'cors'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import crypto from 'crypto'
import chokidar from 'chokidar'
import 'dotenv/config'

const app = express()
const port = process.env.PORT || 3000
const wsPort = 4000 // Port for WebSocket server

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
// Correlation + response time
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now()
    const corr = (req.headers['x-correlation-id'] as string) || crypto.randomUUID?.() || crypto.randomBytes(16).toString('hex')
    res.setHeader('x-correlation-id', corr)
    res.setHeader('x-powered-by', 'sc2cr')
    res.setHeader('x-response-start-ms', String(start))
    res.on('finish', () => {
        const ms = Date.now() - start
        try { res.setHeader('x-response-time-ms', String(ms)) } catch {}
    })
    next()
})
app.use(express.static(path.join(__dirname, '../')))
app.use(express.json({ limit: '30mb' }))
app.use(express.urlencoded({ limit: '30mb', extended: true }))
app.use('/api', apiRoutes)

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
