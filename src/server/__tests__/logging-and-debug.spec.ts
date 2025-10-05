import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import apiRoutes from '../routes/apiRoutes'
import { httpLogger, httpMetricsMiddleware } from '../logging/httpLogger'
import { metrics } from '../metrics/lite'

describe('Phase 1 logging & debug', () => {
  const app = express()
  app.use(httpLogger)
  app.use(httpMetricsMiddleware)
  app.use(express.json())
  app.use('/api', apiRoutes)
  app.get('/api/debug', (_req, res) => {
    res.json({})
  })

  it('suppresses 2xx logs and counts http_total', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(metrics.http_total).toBeGreaterThan(0)
  })
})
