import { Router } from 'express'
import pulseRoutes from './pulseRoutes'
import challongeRoutes from './challongeRoutes'

const router = Router()

router.use('/', pulseRoutes)
router.use('/', challongeRoutes)

export default router
