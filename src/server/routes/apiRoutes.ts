// routes/userRoutes.ts
import { Router, Request, Response } from 'express'
import { players } from '../constants/players'
import { getTop, searchPlayer } from '../services/pulseApi'
import { formatData } from '../utils/formatData'

const router = Router()

// Define your routes here
router.get('/top', async (_req: Request, res: Response) => {
	console.log('Pase por aqui')
    const rankingData = await getTop()
	console.log('Pase por aqui2 rankingData: ', rankingData)
	const formattedData = formatData(rankingData, 'ranking')
    res.send(JSON.stringify(formattedData))
})

router.get('/search', async (req: Request, res: Response) => {
    const playerData = await searchPlayer(req.query.term)
    const formattedData = formatData(playerData, 'search')
    res.json(formattedData)
})

export default router
