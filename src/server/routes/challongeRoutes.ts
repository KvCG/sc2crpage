import { Router, Request, Response } from 'express'
import { getTournamentDetails } from '../services/challongeApi'
import { formatData } from '../utils/formatData'

const router = Router()

router.get('/tournament', async (req: Request, res: Response) => {
    let { tournament } = await getTournamentDetails()
    tournament.participants = await formatData( tournament.participants, 'participants')
    res.json(tournament)
})

export default router
