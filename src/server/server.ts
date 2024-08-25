import express, { Request, Response, NextFunction } from 'express'
import path from 'path'

const app = express()
const port = 3000

if (process.env.ENVIRONMENT == 'dev') {
    app.use(express.static(path.join(__dirname, '../../dist')))
    app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(__dirname, '../../dist/index.html'))
    })
}

app.use(express.static(path.join(__dirname, '../')))

// Handle SPA routing
app.get('*', (_req: Request, res: Response) => {	
    res.sendFile(path.join(__dirname, '../index.html'))
})

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err.message)
    res.status(500).send('Internal Server Error')
})

// Start the server and log the port number
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
})
