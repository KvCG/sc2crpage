import { Router, Request, Response } from 'express'
import { getReplayAnalysis, getAllReplays, uploadReplay, deleteReplay } from '../services/googleApi'

const router = Router()

router.get('/getReplays', async (req: Request, res: Response) => {
    try {
        const replays = await getAllReplays()
        res.json(replays)
    } catch (error) {
        res.json({ error: 'Error getting replays' })
    }
})

router.post('/getReplayAnalysis', async (req: Request, res: Response) => {
    try {
        const replayAnalysis = await getReplayAnalysis(req)
        res.json(replayAnalysis)
    } catch (error) {
        res.json({ error: 'Error uploading the file' })
    }
})

router.post('/uploadReplay', async (req: Request, res: Response) => {
    try {
        const fileId = await uploadReplay(req)
        res.json({ fileId })
    } catch (error) {
        res.json({ error: 'Error uploading the file' })
    }
})

router.post('/deleteReplay', async (req: Request, res: Response) => {
    try {
        const deleted = await deleteReplay(req)
        if (deleted) {
            res.json({})
        } else {
            res.json({ error: 'Error deleting the file' })
        }
    } catch (error) {
        res.json({ error: 'Error deleting the file' })
    }
})

export default router