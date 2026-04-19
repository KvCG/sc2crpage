import { Router } from 'express'
import pulseRoutes from './pulseRoutes'
import challongeRoutes from './challongeRoutes'
import utilityRoutes from './utilityRoutes'
import googleRoutes from './googleRoutes'
import replayAnalyzerRoutes from './replayAnalyzerRoutes'
import analyticsRoutes from './analyticsRoutes'
import h2hRoutes from './h2hRoutes'
import adminRoutes from './adminRoutes'
const router = Router()

router.use('/', pulseRoutes)
router.use('/', challongeRoutes)
router.use('/', utilityRoutes)
router.use('/', googleRoutes)
router.use('/', replayAnalyzerRoutes)
router.use('/', analyticsRoutes)
router.use('/', h2hRoutes)
router.use('/', adminRoutes)

export default router
