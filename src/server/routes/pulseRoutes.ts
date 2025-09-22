import { Router, Request, Response } from 'express'
import { getTop, searchPlayer} from '../services/pulseApi'
import { formatData } from '../utils/formatData'
import { getClientInfo } from '../utils/getClientInfo'
import logger from '../logging/logger'

const router = Router()

router.get('/top', async (req: Request, res: Response) => {
    const userAgent = req.headers['user-agent']
	const { device, os } = getClientInfo(userAgent)
    const details = {
        referer: req.headers.referer,
        device,
		os,
		ip: req.headers['x-forwarded-for'] || req.ip
    }

    logger.info({ route: '/api/top', details }, 'fetch live ranking')
    res.setHeader('x-sc2pulse-attribution', 'Data courtesy of sc2pulse.nephest.com (non-commercial use)')
    const rankingData = await getTop()
    const formattedData = await formatData(rankingData, 'ranking')
    res.json(formattedData)
})

router.get('/search', async (req: Request, res: Response) => {
    const term = req.query.term
    const userAgent = req.headers['user-agent']
    const { device, os } = getClientInfo(userAgent)
    const details = {
        referer: req.headers.referer,
        query: term,
        device,
		os,
		ip: req.headers['x-forwarded-for'] || req.ip
    }
    logger.info({ route: '/api/search', details }, 'search player')

    res.setHeader('x-sc2pulse-attribution', 'Data courtesy of sc2pulse.nephest.com (non-commercial use)')
    const playerData = await searchPlayer(term as string)
    const formattedData = await formatData(playerData, 'search')
    res.json(formattedData)
})

export default router
