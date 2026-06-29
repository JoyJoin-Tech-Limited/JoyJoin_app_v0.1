import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const MINI_PROGRAM_ROOT = resolve(__dirname, '../../../..')
const COUPON_WEBP_PATH = resolve(
  MINI_PROGRAM_ROOT,
  'src/assets/lovart/gift-card/coupon.webp',
)

/**
 * Regression test: the Lovart welcome-coupon illustration must be bundled so
 * WelcomeGiftCard never renders an empty surface in production.
 */
describe('WelcomeGiftCard assets', () => {
  it('has the bundled coupon WebP asset', () => {
    expect(existsSync(COUPON_WEBP_PATH)).toBe(true)
  })
})
