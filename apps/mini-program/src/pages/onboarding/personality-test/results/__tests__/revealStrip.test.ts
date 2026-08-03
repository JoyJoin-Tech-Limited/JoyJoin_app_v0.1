import { describe, expect, it } from 'vitest'
import { getRevealStripPreloadUrl } from '../ArchetypeRevealStrip'
import stripManifest from '../../../assets/archetype-strips/reveal-strips-manifest.json'

/**
 * Phase 2b (2026-08-01): archetype reveal-strip pipeline.
 *
 * Locks in the lazy-preload contract: a strip URL is returned ONLY when the
 * manifest has an entry for the archetype (strips land on CDN later via the
 * K3 pipeline); absent entries fall through to the static spritesheet with
 * zero network cost.
 */

describe('getRevealStripPreloadUrl', () => {
  it('returns null when the manifest has no strip entries (default state)', () => {
    expect(getRevealStripPreloadUrl('corgi')).toBeNull()
    expect(getRevealStripPreloadUrl('fox')).toBeNull()
    expect(getRevealStripPreloadUrl('')).toBeNull()
  })

  it('returns a CDN URL when a manifest entry exists', () => {
    // Inject a temporary entry into the imported manifest object
    const states = stripManifest.states as Record<string, unknown>
    states.test_archetype = {
      sheet: 'archetype-strip-test.webp',
      frameCount: 8,
      frameWidth: 384,
      frameHeight: 384,
      duration: 960,
      loop: true,
      oneShot: false,
    }
    try {
      const url = getRevealStripPreloadUrl('test_archetype')
      expect(url).not.toBeNull()
      expect(url).toContain('/assets/personality/archetype-strips/archetype-strip-test.webp')
    } finally {
      delete states.test_archetype
    }
  })

  it('manifest contract: ≤9 frames per strip (package budget per K3 doc)', () => {
    for (const meta of Object.values(stripManifest.states as Record<string, { frameCount: number }>)) {
      expect(meta.frameCount).toBeLessThanOrEqual(9)
      expect(meta.frameCount).toBeGreaterThan(0)
    }
  })
})
