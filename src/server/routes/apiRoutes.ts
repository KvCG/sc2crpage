import { Router } from 'express'
import pulseRoutes from './pulseRoutes'
import challongeRoutes from './challongeRoutes'
import utilityRoutes from './utilityRoutes'

const router = Router()

router.use('/', pulseRoutes)
router.use('/', challongeRoutes)
router.use('/', utilityRoutes)

export default router
