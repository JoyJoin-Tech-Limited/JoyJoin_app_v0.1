import { describe, expect, it } from 'vitest'
import { CDN_ICON_TIERS } from '../emojiToIconMap.js'

describe('icon tier invariants', () => {
  it('keeps intent and category icons bundled locally (not CDN)', () => {
    // These tiers are used inside the pool-registration subpackage and must
    // not rely on a CDN fetch, which would block on weak networks. If this
    // test fails, the subpackage may crash or show emoji fallbacks.
    expect(CDN_ICON_TIERS.has('intent')).toBe(false)
    expect(CDN_ICON_TIERS.has('category')).toBe(false)
  })

  it('keeps locally-copied icon tiers out of the CDN set', () => {
    // Tiers that ship inside the WeChat package must not be in CDN_ICON_TIERS.
    const localTiers = ['mood', 'status', 'intent', 'category', 'chemistry', 'expression', 'semantic', 'ui']
    for (const tier of localTiers) {
      expect(CDN_ICON_TIERS.has(tier as any)).toBe(false)
    }
  })
})
