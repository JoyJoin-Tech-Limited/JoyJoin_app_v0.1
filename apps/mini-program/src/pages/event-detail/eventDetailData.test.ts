import { describe, expect, it, vi } from 'vitest'
import type { ApiTransport } from '@shared/api'
import { loadEventDetail, mapEventPoolToEventDetail } from './eventDetailData'

describe('event detail data loading', () => {
  it('maps event pool details into the event detail view model', () => {
    expect(
      mapEventPoolToEventDetail({
        id: 'pool-1',
        title: '南山饭局',
        eventType: '饭局',
        city: '深圳',
        district: '南山区',
        dateTime: '2026-07-29T11:32:00.000Z',
        status: 'active',
        description: '测试活动',
        currentParticipants: 3,
      }),
    ).toMatchObject({
      id: 'pool-1',
      title: '南山饭局',
      type: '饭局',
      location: '深圳 · 南山区',
      attendeeCount: 3,
      source: 'event_pool',
    })
  })

  it('loads event pools before falling back to legacy blind-box events', async () => {
    const api = vi.fn(async ({ path }) => {
      if (path === '/api/event-pools/pool-1') {
        return {
          id: 'pool-1',
          title: '南山饭局',
          city: '深圳',
          district: '南山区',
        }
      }
      throw new Error(`unexpected path ${path}`)
    }) as ApiTransport

    const detail = await loadEventDetail(api, 'pool-1')

    expect(detail).toMatchObject({
      id: 'pool-1',
      title: '南山饭局',
      location: '深圳 · 南山区',
      source: 'event_pool',
    })
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('keeps legacy blind-box event detail links working', async () => {
    const api = vi.fn(async ({ path }) => {
      if (path === '/api/event-pools/legacy-1') {
        throw new Error('Event pool not found')
      }
      if (path === '/api/blind-box-events/legacy-1') {
        return {
          id: 'legacy-1',
          title: '老活动',
          location: '上海',
        }
      }
      throw new Error(`unexpected path ${path}`)
    }) as ApiTransport

    await expect(loadEventDetail(api, 'legacy-1')).resolves.toMatchObject({
      id: 'legacy-1',
      title: '老活动',
      location: '上海',
    })
    expect(api).toHaveBeenCalledTimes(2)
  })
})
