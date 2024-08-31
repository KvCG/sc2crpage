// routes/userRoutes.ts
import { Router, Request, Response } from 'express'
import { getTop, searchPlayer } from '../services/pulseApi'
import { formatData } from '../utils/formatData'

const router = Router()

// Define your routes here
router.get('/top', async (_req: Request, res: Response) => {
    const rankingData = await getTop()
    let formattedData = await formatData(rankingData, 'ranking')
    res.send(JSON.stringify(formattedData))
})

router.get('/search', async (req: Request, res: Response) => {
    const playerData = await searchPlayer(req.query.term)
    const formattedData = formatData(playerData, 'search')
    res.json(formattedData)
})

router.get('/health', async (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' })
})

export default router
