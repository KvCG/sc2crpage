import { Router } from 'express'
import pulseRoutes from './pulseRoutes'
import challongeRoutes from './challongeRoutes'
import utilityRoutes from './utilityRoutes'
import googleRoutes from './googleRoutes'

const router = Router()

router.use('/', pulseRoutes)
router.use('/', challongeRoutes)
router.use('/', utilityRoutes)
router.use('/', googleRoutes)

export default router
