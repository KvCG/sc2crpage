import { Router, Request, Response } from 'express'
import { getDailySnapshot, getTop, searchPlayer, updatePlayerInformation } from '../services/pulseApi'
import { formatData } from '../utils/formatData'
import { uploadFile } from '../middleware/fbFileManagement'
import { getClientInfo } from '../utils/getClientInfo'

const router = Router()

router.get('/top/:daysAgo', async (req: Request, res: Response) => {
    const daysAgo = req.params.daysAgo
    const userAgent = req.headers['user-agent']
	const { device, os } = getClientInfo(userAgent)
    const details = {
        referer: req.headers.referer,
        device,
		os,
		ip: req.headers['x-forwarded-for'] || req.ip
    }

    console.log('\nGetting live ranking data')
    console.log('INFO: ', details)
    const rankingData = await getTop(daysAgo)
    const updatedRankingData = await updatePlayerInformation(rankingData)
    const formattedData = await formatData(updatedRankingData, 'ranking')
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
    console.log('INFO:', details)

    const playerData = await searchPlayer(term)
    const formattedData = await formatData(playerData, 'search')
    res.json(formattedData)
})

router.get('/snapshot', async (req: Request, res: Response) => {
    const snapshotRanking = await getDailySnapshot()
    if (!snapshotRanking) res.json(null)
    const formattedData = {}
    const updatedSnapshotRanking = await updatePlayerInformation(snapshotRanking)
    for (const [key, value] of Object.entries(updatedSnapshotRanking[0])) {
        if (key != 'expiry') {
            formattedData[key] = await formatData(value, 'ranking')
        } else {
            formattedData[key] = value
        }
    }

    res.json(formattedData)
})

export default router
