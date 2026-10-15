import { describe, expect, it } from 'vitest'
import {
  CITY_POOL_WINDOW_MS,
  countCityPoolsWithinWeek,
} from '../professionCityPoolLine'
import { buildCityPoolLine } from '../professionOverlayCopy'

const NOW = new Date('2026-10-15T12:00:00+08:00')
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString()
const pool = (city: string, dateTime: string | null | undefined) => ({
  city,
  dateTime,
}) as { city: string; dateTime: string }

const DAY = 24 * 60 * 60 * 1000

describe('countCityPoolsWithinWeek', () => {
  it('counts only exact-city pools inside [now, now+7d] — inclusive boundaries', () => {
    const pools = [
      pool('深圳市', at(0)),
      pool('深圳市', at(CITY_POOL_WINDOW_MS)),
      pool('深圳市', at(2 * DAY)),
      pool('广州市', at(DAY)),
      pool('深圳市', at(-1)),
      pool('深圳市', at(CITY_POOL_WINDOW_MS + 1)),
    ]
    expect(countCityPoolsWithinWeek(pools, '深圳市', NOW)).toBe(3)
  })

  it('trims the city argument and fails closed on empty input', () => {
    const pools = [pool('深圳市', at(DAY))]
    expect(countCityPoolsWithinWeek(pools, '  深圳市  ', NOW)).toBe(1)
    expect(countCityPoolsWithinWeek(pools, '', NOW)).toBe(0)
    expect(countCityPoolsWithinWeek(pools, '   ', NOW)).toBe(0)
  })

  it('skips missing and unparseable dateTime values instead of throwing', () => {
    const pools = [
      pool('深圳市', null),
      pool('深圳市', undefined),
      pool('深圳市', 'not-a-date'),
      pool('深圳市', at(DAY)),
    ]
    expect(countCityPoolsWithinWeek(pools, '深圳市', NOW)).toBe(1)
  })

  it('returns 0 for an empty pool list', () => {
    expect(countCityPoolsWithinWeek([], '深圳市', NOW)).toBe(0)
  })
})

describe('buildCityPoolLine (copy-consolidated 2026-10-15)', () => {
  it('renders the truthful 排桌 line and stays vocab-clean', () => {
    const line = buildCityPoolLine('深圳市', 12)
    expect(line).toBe('本周深圳市有 12 场局在排桌')
    expect(/匹配|社交|灵魂|撮合|AI/.test(line)).toBe(false)
  })
})
