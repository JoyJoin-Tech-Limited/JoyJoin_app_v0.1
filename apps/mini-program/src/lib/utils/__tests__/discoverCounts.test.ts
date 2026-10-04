import { describe, it, expect } from 'vitest'
import {
  buildDiscoverCounts,
  formatNextEventLabel,
  WEEK_WINDOW_MS,
} from '../discoverCounts'
import { getClusterIdByDistrictName } from '@shared/districts'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-03T12:00:00+08:00')

function pool(district: string | null, inDays: number | null, id = Math.random().toString(36).slice(2)) {
  return {
    id,
    district,
    dateTime: inDays === null ? null : new Date(NOW.getTime() + inDays * DAY).toISOString(),
  }
}

describe('buildDiscoverCounts', () => {
  it('counts pools within the 7-day window per cluster', () => {
    const counts = buildDiscoverCounts(
      [
        pool('南山区', 1),
        pool('南山区', 6),
        pool('福田区', 3),
        pool('南山区', 10), // beyond window
        pool(null, 1), // unmappable
      ],
      NOW,
    )
    expect(counts.weekCountsByCluster).toEqual({ nanshan: 2, futian: 1 })
    expect(counts.weekTotal).toBe(3)
  })

  it('maps legacy short-form districts through the shared mapping', () => {
    const counts = buildDiscoverCounts([pool('南山', 2)], NOW)
    expect(counts.weekCountsByCluster).toEqual({ nanshan: 1 })
  })

  it('tracks the next event dateTime per cluster (only in-window events)', () => {
    const counts = buildDiscoverCounts(
      [
        { ...pool('南山区', 5, 'later'), dateTime: new Date(NOW.getTime() + 5 * DAY).toISOString() },
        { ...pool('南山区', 2, 'sooner'), dateTime: new Date(NOW.getTime() + 2 * DAY + 3600_000).toISOString() },
        pool('南山区', 9, 'outside'),
      ],
      NOW,
    )
    const next = counts.nextEventByCluster.nanshan
    expect(new Date(next).getTime()).toBe(NOW.getTime() + 2 * DAY + 3600_000)
  })

  it('handles empty input and null districts', () => {
    const counts = buildDiscoverCounts([], NOW)
    expect(counts.weekCountsByCluster).toEqual({})
    expect(counts.weekTotal).toBe(0)
    expect(counts.nextEventByCluster).toEqual({})
  })

  it('uses the exported window constant consistently', () => {
    const boundary = buildDiscoverCounts([pool('南山区', 6)], NOW)
    expect(boundary.weekTotal).toBe(1)
    const outside = buildDiscoverCounts(
      [pool('南山区', (WEEK_WINDOW_MS + 1) / DAY)],
      NOW,
    )
    expect(outside.weekTotal).toBe(0)
  })
})

describe('formatNextEventLabel', () => {
  it('labels today / tomorrow / weekday', () => {
    expect(formatNextEventLabel(new Date(NOW.getTime() + 2 * 3600_000).toISOString(), NOW)).toBe('今天')
    expect(formatNextEventLabel(new Date(NOW.getTime() + DAY).toISOString(), NOW)).toBe('明天')
    // 2026-10-03 is a Saturday; +3 days = Tuesday
    expect(formatNextEventLabel(new Date(NOW.getTime() + 3 * DAY).toISOString(), NOW)).toBe('周二')
  })

  it('falls back to a generic label for missing dates', () => {
    expect(formatNextEventLabel(undefined, NOW)).toBe('近期')
  })
})

describe('mapping parity', () => {
  it('uses the same shared mapping the feed filter uses', () => {
    // Guard: counts must agree with the feed's cluster filter for every
    // canonical + short-form district string.
    for (const name of ['南山区', '福田区', '南山', '福田', '罗湖区']) {
      const counts = buildDiscoverCounts([pool(name, 2)], NOW)
      const clusterId = getClusterIdByDistrictName(name)
      if (clusterId) {
        expect(counts.weekCountsByCluster[clusterId]).toBe(1)
      }
    }
  })
})
