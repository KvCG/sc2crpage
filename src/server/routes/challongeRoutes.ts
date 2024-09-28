import { Router, Request, Response } from 'express'
import { getParticipants } from '../services/challongeApi'
import { formatData } from '../utils/formatData'

const router = Router()

router.get('/participants', async (req: Request, res: Response) => {
	let participantsData = await getParticipants()
	participantsData = await formatData(participantsData, 'participants')
    res.json(participantsData)
})

export default router
