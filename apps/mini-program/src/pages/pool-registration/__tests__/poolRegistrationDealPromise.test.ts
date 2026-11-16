import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(resolve(__dirname, '../index.tsx'), 'utf8')

describe('S5 报名页保底承诺接线', () => {
  it('承诺 flag、兑现 flag 与 pool.hasGuaranteedDeal 必须同时为 true', () => {
    expect(page).toContain('user?.features?.venueDealPromiseEnabled === true')
    expect(page).toContain('user?.features?.venueDealsEnabled === true')
    expect(page).toContain('pool?.hasGuaranteedDeal === true')
    expect(page).toContain('dealPromise={hasDealPromise}')
  })

  it('短屏有真实承诺时改 compact，不再整段 collapse', () => {
    expect(page).toContain('windowHeightPx >= POOL_INCLUSIONS_COLLAPSE_BELOW_PX || hasDealPromise')
    expect(page).toContain('hasDealPromise && windowHeightPx < POOL_INCLUSIONS_COLLAPSE_BELOW_PX')
    expect(page).toContain('compact={compactInclusions}')
  })

  it('既有 registration_inclusions_viewed 继续由真实可见 gate 守护', () => {
    expect(page).toContain('if (!showInclusions) return')
    expect(page).toContain("discoverAnalytics.track('registration_inclusions_viewed', poolId)")
  })
})
