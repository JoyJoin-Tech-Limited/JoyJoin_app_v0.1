import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const profileReviewSource = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/profile-review/index.tsx'),
  'utf8',
)
const discoverSource = readFileSync(
  resolve(process.cwd(), 'src/pages/discover/index.tsx'),
  'utf8',
)

describe('onboarding intro cross-page handoff', () => {
  it('persists the pending intro before auth invalidation can redirect the page', () => {
    const pendingIndex = profileReviewSource.indexOf(
      "markFlowPending('joyjoin-intro', user.id)",
    )
    const invalidationIndex = profileReviewSource.indexOf('await invalidateAuth()')

    expect(pendingIndex).toBeGreaterThan(-1)
    expect(invalidationIndex).toBeGreaterThan(pendingIndex)
  })

  it('lets Discover recover and complete a pending intro', () => {
    expect(discoverSource).toContain("hasPendingFlow('joyjoin-intro', user.id)")
    expect(discoverSource).toContain('<JoyJoinIntroFlow')
    expect(discoverSource).toContain("clearPendingFlow('joyjoin-intro', user.id)")
  })
})
