import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import axios, { AxiosError } from 'axios'
import https from 'https';
import cors from 'cors';

const app = express()
const port = 3000
const agent = new https.Agent({ rejectUnauthorized: false });

if (process.env.ENVIRONMENT == 'dev') {
    app.use(express.static(path.join(__dirname, '../../dist')))
    app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(__dirname, '../../dist/index.html'))
    })
}
app.use(cors())

app.use(express.static(path.join(__dirname, '../')))

app.use('/api', async (req, res) => {
	const url = `https://sc2pulse.nephest.com/sc2/api${req.url}`
	console.log(url)
    try {
        const response = await axios({
            url: url,
			httpsAgent: agent,
            data: req.body,
			method: req.method,
        })
		// console.log(response.data)
        res.json(response.data)
    } catch (error) {
		const axiosError = error as AxiosError
		console.log(axiosError.message)
        res.status(axiosError.response?.status || 500).send(axiosError.message)
    }
})

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
