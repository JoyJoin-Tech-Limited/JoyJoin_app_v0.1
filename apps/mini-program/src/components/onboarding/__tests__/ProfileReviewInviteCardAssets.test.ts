import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const MINI_PROGRAM_ROOT = resolve(__dirname, '../../../..')
const INVITE_TEASER_WEBP_PATH = resolve(
  MINI_PROGRAM_ROOT,
  'src/assets/lovart/profile-review/invite-teaser.webp',
)

/**
 * Regression test: the Lovart invite-teaser illustration must be bundled so
 * ProfileReviewInviteCard never renders an empty surface in production.
 */
describe('ProfileReviewInviteCard assets', () => {
  it('has the bundled invite-teaser WebP asset', () => {
    expect(existsSync(INVITE_TEASER_WEBP_PATH)).toBe(true)
  })
})
