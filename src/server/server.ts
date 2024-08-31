import express, { Request, Response, NextFunction } from 'express';
import apiRoutes from './routes/apiRoutes';
import path from 'path';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import chokidar from 'chokidar';

const app = express();
const port = 3000;
const wsPort = 4000; // Port for WebSocket server

// Create the main HTTP server for Express
const mainServer = createServer(app);

// Start the Express server
mainServer.listen(port, () => {
    console.log(`Express server running at http://localhost:${port}`);
});

// WebSocket server for development reloads
if (process.env.NODE_ENV === 'development') {
    const wsServer = createServer(); // Separate HTTP server for WebSocket
    const wss = new WebSocketServer({ server: wsServer });

    // Start the WebSocket server
    wsServer.listen(wsPort, () => {
        console.log(`WebSocket server running at ws://localhost:${wsPort}`);
    });

    // Handle WebSocket connections
    wss.on('connection', ws => {
        console.log('WebSocket client connected');

        ws.on('message', message => {
            if (typeof message === 'string' && message === 'reload') {
                ws.send('reload');
            }
        });

        ws.on('close', () => {
            console.log('WebSocket client disconnected');
        });
    });

    // Watch for file changes and trigger reload
    chokidar.watch('./src/server').on('all', () => {
        // Ensure the WebSocket server has clients
        if (wss.clients.size > 0) {
            console.log(`Broadcasting reload to ${wss.clients.size} client(s)`)
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send('reload');
                }
            });
        }
    });
}

// Middleware and routes
app.use(cors());
app.use(express.static(path.join(__dirname, '../')));
app.use('/api', apiRoutes);

// Handle SPA routing
app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.message);
    res.status(500).send('Internal Server Error');
});

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});
