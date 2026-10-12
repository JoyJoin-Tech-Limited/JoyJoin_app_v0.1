import { describe, it, expect } from 'vitest'
import { formatCouponValidUntilLabel } from './couponValidity'

describe('formatCouponValidUntilLabel', () => {
  it('formats an ISO timestamp as M月D日 (FirstTimeCouponBanner parity)', () => {
    const label = formatCouponValidUntilLabel('2026-12-25T15:59:59.000Z')
    // Local-tz rendering — assert shape, then exact value against Date math.
    expect(label).toMatch(/^\d{1,2}月\d{1,2}日$/)
    const d = new Date('2026-12-25T15:59:59.000Z')
    expect(label).toBe(`${d.getMonth() + 1}月${d.getDate()}日`)
  })

  it('formats a date-only string', () => {
    const d = new Date('2027-03-05')
    expect(formatCouponValidUntilLabel('2027-03-05')).toBe(`${d.getMonth() + 1}月${d.getDate()}日`)
  })

  it('fails closed on absent input', () => {
    expect(formatCouponValidUntilLabel(null)).toBeNull()
    expect(formatCouponValidUntilLabel(undefined)).toBeNull()
    expect(formatCouponValidUntilLabel('')).toBeNull()
  })

  it('fails closed on unparseable input', () => {
    expect(formatCouponValidUntilLabel('not-a-date')).toBeNull()
    expect(formatCouponValidUntilLabel('2026-13-99')).toBeNull()
  })
})
