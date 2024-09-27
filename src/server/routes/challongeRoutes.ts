import { Router, Request, Response } from 'express'
import { getParticipants } from '../services/challongeApi'

const router = Router()

// Define your Challonge API routes here
// Example:
router.get('/participants', async (req: Request, res: Response) => {
    // Implement Challonge API logic
    res.json(await getParticipants())
})

export default router
