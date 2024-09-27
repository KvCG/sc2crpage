import { Router, Request, Response } from 'express'
import { getParticipants } from '../services/challongeApi'

const router = Router()


router.get('/participants', async (req: Request, res: Response) => {
    res.json(await getParticipants())
})

export default router
