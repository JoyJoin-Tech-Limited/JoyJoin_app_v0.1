import express from 'express'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withServerForApp as withServer } from '../test-utils/withServer'

const mockInsert = vi.fn()
const mockValues = vi.fn()
const mockTransaction = vi.fn()

vi.mock('../db', () => ({
  db: { transaction: mockTransaction },
}))

vi.mock('@shared/schema', () => ({
  participationExperimentEvents: 'participation_experiment_events',
  discoverAnalyticsEvents: 'discover_analytics_events',
  paymentRitualEvents: 'payment_ritual_events',
}))

async function buildTestApp() {
  const { registerAnalyticsRoutes } = await import('../routes/domains/analytics')
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as any).requestId = 'test-request-id'
    ;(req as any).session = { userId: 'must-not-be-stored' }
    ;(req as any).sessionID = 'must-not-be-stored'
    next()
  })
  registerAnalyticsRoutes(app)
  return app
}

describe('POST /api/analytics/flash-story', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValues.mockReturnValue(undefined)
    mockInsert.mockReturnValue({ values: mockValues })
    mockTransaction.mockImplementation(async (callback: any) => callback({ insert: mockInsert }))
  })

  it('accepts all six events for every stable unit and strips identity and caller metadata', async () => {
    const app = await buildTestApp()
    const events = [
      'story_start',
      'object_interaction_start',
      'object_complete',
      'story_complete',
      'next_npc_click',
      'exit_before_complete',
    ]

    await withServer(app, async (base) => {
      for (const eventType of events) {
        const response = await fetch(`${base}/api/analytics/flash-story`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitId: 's1-p2-momo',
            eventType,
            timestamp: Date.now(),
            metadata: { latitude: 22.5, phone: '13800000000', encounterId: 'private' },
          }),
        })
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: true })
      }
    })

    for (const [values] of mockValues.mock.calls) {
      expect(values).toMatchObject({
        userId: null,
        sessionId: null,
        poolId: null,
        metadata: { unitId: 's1-p2-momo' },
      })
      expect(JSON.stringify(values)).not.toContain('13800000000')
      expect(JSON.stringify(values)).not.toContain('22.5')
      expect(JSON.stringify(values)).not.toContain('private')
    }
  })

  it('returns 200 and does not write unknown events', async () => {
    const app = await buildTestApp()
    await withServer(app, async (base) => {
      const response = await fetch(`${base}/api/analytics/flash-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: 's1-p1-shiqi', eventType: 'gps_collected', timestamp: Date.now() }),
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: false, error: 'invalid story event' })
    })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('fails open when persistence fails', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('db unavailable'))
    const app = await buildTestApp()
    await withServer(app, async (base) => {
      const response = await fetch(`${base}/api/analytics/flash-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: 's1-p1-shiqi', eventType: 'story_start', timestamp: Date.now() }),
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: false, error: 'analytics write failed' })
    })
  })
})
