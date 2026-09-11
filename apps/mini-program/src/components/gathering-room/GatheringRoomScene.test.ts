import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { seatIndexFor } from './GatheringRoomScene'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCENE_TSX = readFileSync(path.join(HERE, 'GatheringRoomScene.tsx'), 'utf8')
const SCENE_SCSS = readFileSync(path.join(HERE, 'GatheringRoomScene.scss'), 'utf8')

describe('gathering room seat map', () => {
  it('maps 3-person groups to a triangle around the table', () => {
    expect([0, 1, 2].map((i) => seatIndexFor(i, 3))).toEqual([1, 2, 4])
  })

  it('keeps the existing 4–6 seat arrangements', () => {
    expect([0, 1, 2, 3].map((i) => seatIndexFor(i, 4))).toEqual([1, 2, 3, 5])
    expect([0, 1, 2, 3, 4].map((i) => seatIndexFor(i, 5))).toEqual([0, 1, 2, 3, 5])
    expect([0, 1, 2, 3, 4, 5].map((i) => seatIndexFor(i, 6))).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('uses door-side standing anchors for 7–8 members', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => seatIndexFor(i, 7))).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => seatIndexFor(i, 8))).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('clamps oversized groups to 8 seats without out-of-range indices', () => {
    const indices = Array.from({ length: 12 }, (_, i) => seatIndexFor(i, 12))
    expect(indices.every((s) => s >= 0 && s <= 7)).toBe(true)
    expect(new Set(indices).size).toBe(8)
  })

  it('does not crash on degenerate 1–2 member groups', () => {
    expect(seatIndexFor(0, 1)).toBeGreaterThanOrEqual(0)
    expect(seatIndexFor(1, 2)).toBeGreaterThanOrEqual(0)
    expect(seatIndexFor(5, 1)).toBeGreaterThanOrEqual(0)
  })
})

describe('gathering room absent-member rendering contract', () => {
  /**
   * Regression lock (2026-09-10): absent members previously rendered NO avatar
   * (`if (presence === 'absent') return null`), so on device every tablemate
   * who hadn't explicitly confirmed or wasn't concurrently online showed a
   * blank seat — "only my own avatar renders". Every member must render their
   * seat; absent ones show a muted silhouette.
   */
  it('never suppresses the avatar/seat for absent members', () => {
    expect(SCENE_TSX).not.toMatch(/presence\s*===\s*['"]absent['"][^;]*return null/)
    expect(SCENE_TSX).not.toMatch(/\{[^}]*presence\s*===\s*['"]absent['"][^}]*\?\s*null/)
  })

  it('provides the seat-anchored silhouette modifier for absent members', () => {
    expect(SCENE_SCSS).toMatch(/&--absent\s*\{/)
    // The silhouette must be a static dim/desaturate treatment, not a
    // walk-in animation that would replay at the seat.
    expect(SCENE_SCSS).toMatch(/&--absent\s*\{[^}]*opacity/)
  })
})
