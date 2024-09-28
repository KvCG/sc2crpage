import { Router, Request, Response } from 'express'
import { refreshDataCache } from '../utils/csvParser'

const router = Router()

router.get('/refreshCache', async (req: Request, res: Response) => {
    await refreshDataCache()
    res.status(200).json('Done!')
})

router.get('/health', async (req: Request, res: Response) => {
    console.log(
        `----${
            new Date()
                .toLocaleString('en-US', {
                    timeZone: 'America/Costa_Rica',
                })
                .split(',')[1]
        } ----`
    )
    res.status(200).json({ status: 'ok' })
})

export default router
