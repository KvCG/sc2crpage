import { Router, Request, Response } from 'express'
import logger from '../logging/logger'
import { extractRequestId } from '../utils/requestId'
import { refreshDataCache } from '../utils/csvParser'

const router = Router()

router.get('/refreshCache', async (_req: Request, res: Response) => {
    await refreshDataCache()
    res.status(200).json('Done!')
})

router.get('/health', async (req: Request, res: Response) => {
    const isDebugEnabled = (logger as any).isLevelEnabled?.('debug') || logger.level === 'debug'
    if (isDebugEnabled) {
        logger.debug(
            {
                route: '/api/health',
                ua: req.headers['user-agent'],
                ip: (req.headers['x-forwarded-for'] as string) || (req.ip as string),
                id: extractRequestId(req, res) || '',
            },
            'health check'
        )
    } else {
        logger.info('health ok')
    }
    res.status(200).json({ status: 'ok' })
})

export default router
