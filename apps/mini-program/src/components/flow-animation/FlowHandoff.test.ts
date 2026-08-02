import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const profileReviewSource = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/profile-review/index.tsx'),
  'utf8',
)
describe('onboarding intro cross-page handoff', () => {
  it('renders the intro before auth invalidation can redirect the page', () => {
    const renderIndex = profileReviewSource.indexOf("setIntroNextStep('discover')")
    const invalidationIndex = profileReviewSource.indexOf('await invalidateAuth()')

    expect(renderIndex).toBeGreaterThan(-1)
    expect(invalidationIndex).toBeGreaterThan(renderIndex)
  })
})
