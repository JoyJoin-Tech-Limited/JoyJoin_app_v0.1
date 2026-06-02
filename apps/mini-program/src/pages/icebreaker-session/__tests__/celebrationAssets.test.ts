import { describe, expect, it } from 'vitest'
import { CELEBRATION_FRAME_MAP, type CelebrationFrameKey } from '../celebrationAssets'

// ── CELEBRATION_FRAME_MAP ──────────────────────────────────────────────
describe('CELEBRATION_FRAME_MAP', () => {
  it('has exactly 5 celebration frames', () => {
    const keys = Object.keys(CELEBRATION_FRAME_MAP)
    expect(keys).toHaveLength(5)
  })

  it('has non-empty URLs for all frames', () => {
    for (const [key, url] of Object.entries(CELEBRATION_FRAME_MAP)) {
      expect(url.length).toBeGreaterThan(0)
      expect(typeof url).toBe('string')
    }
  })

  it('includes all expected frame keys', () => {
    expect(CELEBRATION_FRAME_MAP).toHaveProperty('auction_sold')
    expect(CELEBRATION_FRAME_MAP).toHaveProperty('dice_reveal')
    expect(CELEBRATION_FRAME_MAP).toHaveProperty('undercover_secret')
    expect(CELEBRATION_FRAME_MAP).toHaveProperty('mirror_result')
    expect(CELEBRATION_FRAME_MAP).toHaveProperty('quip_champion')
  })

  it('all frame keys are valid CelebrationFrameKey type values', () => {
    const validKeys: CelebrationFrameKey[] = [
      'auction_sold',
      'dice_reveal',
      'undercover_secret',
      'mirror_result',
      'quip_champion',
    ]
    for (const key of validKeys) {
      const value = CELEBRATION_FRAME_MAP[key]
      expect(value).toBeDefined()
      expect(typeof value).toBe('string')
    }
  })

  it('all URLs have distinct paths', () => {
    const urls = Object.values(CELEBRATION_FRAME_MAP)
    expect(new Set(urls).size).toBe(urls.length)
  })
})
