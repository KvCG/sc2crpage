// routes/userRoutes.ts
import { Router, Request, Response, query } from 'express'
import { getTop, searchPlayer } from '../services/pulseApi'
import { formatData } from '../utils/formatData'
import { uploadFile } from '../middleware/fbFileManagement'
import { getClientInfo } from '../utils/getClientInfo'

const router = Router()

// Define your routes here
router.get('/top', async (req: Request, res: Response) => {
	const userAgent = req.headers['user-agent']
    const details = {
        referer: req.headers.referer,
		...getClientInfo(userAgent)
    }
	
    console.log('\nGetting live ranking data')
    console.log('\nINFO: ', details, '\n')
    const rankingData = await getTop()
    const formattedData = await formatData(rankingData, 'ranking')
    res.send(JSON.stringify(formattedData))
})

router.get('/search', async (req: Request, res: Response) => {
    const term = req.query.term
    const userAgent = req.headers['user-agent']
    const details = {
        referer: req.headers.referer,
		query: term,
		...getClientInfo(userAgent)
    }
    console.error('\nSearching:', term)
    console.log('INFO:', details, '\n')

    const playerData = await searchPlayer(term)
    const formattedData = await formatData(playerData, 'search')
    res.json(formattedData)
})

router.post('/upload', async (req: Request, res: Response) => {
    const { fileBase64, fileName, fileExtension } = req.body

    if (!fileBase64 || !fileName || !fileExtension) {
        return res.status(400).json({ error: 'Invalid data' })
    }

    // TODO: Separete firebase path selection in util files
    let contentType = ''
    let location = ''

    if (fileExtension == 'csv') {
        location = 'ranked_players/' + fileName
        contentType = 'text/csv'
    }

    if (fileExtension == 'SC2Replay') {
        location = 'replays/' + fileName
        contentType = 'application/octet-stream'
    }

    const buffer = Buffer.from(fileBase64, 'base64')

    try {
        await uploadFile(buffer, location, contentType)
        res.status(200).json({ status: 'uploaded' })
    } catch (error) {
        console.error('Error uploading file:', error)
        res.status(500).json({ status: 'error', error: error.message })
    }
})

// router.get('/download/:filename', async (req: Request, res: Response) => {
// 	console.log(req.params)
// 	const fileName = req.params.filename
// 	res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
// 	res.setHeader('Content-Type', 'application/octet-stream')
//     try {
//         const readStream = await downloadFile(fileName)
//         readStream.pipe(res)
//     } catch (err) {
//         console.error('Download failed:', err)
//         res.status(500).send('Failed to download file')
//     }
// })

router.get('/health', async (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' })
})

export default router
