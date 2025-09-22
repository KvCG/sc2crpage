import { Router, Request, Response } from 'express'
import logger from '../logging/logger'
import { refreshDataCache } from '../utils/csvParser'

const router = Router()

router.get('/refreshCache', async (req: Request, res: Response) => {
    await refreshDataCache()
    res.status(200).json('Done!')
})

router.get('/health', async (req: Request, res: Response) => {
    const verbose = req.query.verbose === '1'
    if (verbose) logger.info({ route: '/api/health' }, 'health ping')
    res.status(200).json({ status: 'ok' })
})

export default router
