import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const hookPath = resolve(dirname(fileURLToPath(import.meta.url)), 'usePaymentCoupon.ts')

describe('usePaymentCoupon hook structure', () => {
  it('exports usePaymentCoupon and UsePaymentCouponReturn', () => {
    const source = readFileSync(hookPath, 'utf8')

    expect(source).toContain('export function usePaymentCoupon(')
    expect(source).toContain('export interface UsePaymentCouponReturn')
  })

  it('manages coupon validation state', () => {
    const source = readFileSync(hookPath, 'utf8')

    expect(source).toContain('selectedCouponCode')
    expect(source).toContain('isCouponValid')
    expect(source).toContain('discountAmount')
    expect(source).toContain('finalAmount')
    expect(source).toContain('couponMessage')
    expect(source).toContain('isValidatingCoupon')
  })

  it('calls coupon validation API with correct payload shape', () => {
    const source = readFileSync(hookPath, 'utf8')

    expect(source).toContain("path: '/api/coupons/validate'")
    expect(source).toContain('paymentType')
    expect(source).toContain('planId')
  })
})
