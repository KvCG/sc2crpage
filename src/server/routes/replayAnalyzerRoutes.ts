import { Router, Request, Response } from 'express'
import { analyzeReplayBase64, analyzeReplayUrl } from '../services/replayAnalyzerApi'
const router = Router()

router.post('/analyzeReplayBase64', async (req: Request, res: Response) => {
    try {
        const { fileBase64 } = req.body
        const replayInformation = await analyzeReplayBase64(fileBase64)
        res.json(replayInformation)
    } catch (error) {
        res.json({ error: 'Error analyzing replay data' })
    }
})

router.post('/analyzeReplayUrl', async (req: Request, res: Response) => {
    try {
        const { fileUrl } = req.body
        const replayInformation = await analyzeReplayUrl(fileUrl)
        res.json(replayInformation)
    } catch (error) {
        res.json({ error: 'Error analyzing replay data' })
    }
})

export default router
