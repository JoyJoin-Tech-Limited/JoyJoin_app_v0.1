import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import {
  NAME_CARD_PLACEMENT,
  rowPerspectiveScale,
  seatIndexFor,
  seatZIndex,
} from './GatheringRoomScene'

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

describe('gathering room name-plate collision contract (2026-10-14)', () => {
  /**
   * Regression lock: name plates used to hang at a fixed +48rpx below every
   * seat anchor with z-index above all avatars — at full house (6 members,
   * row pitch 125rpx < avatar 144rpx) back-row plates stamped onto the front
   * row's characters. Placement must be collision-audited per seat: "below"
   * is only allowed where nothing sits under the plate (front-centre seat 4),
   * the back-centre seat 0 floats its plate above the head, and every
   * flanking seat hangs the plate to a side.
   */
  it('covers every seat and never places a "below" plate on a flanking row', () => {
    expect(NAME_CARD_PLACEMENT).toHaveLength(8)
    // Seats 1,2 (mid row) and 3,5 (front flanks) sit directly above another
    // row's avatar band — a below-plate there is the original overlap bug.
    for (const seat of [1, 2, 3, 5]) {
      expect(NAME_CARD_PLACEMENT[seat]).not.toBe('below')
    }
    // Back-centre (0) must not hang below either — its below-band runs into
    // the mid row's avatars.
    expect(NAME_CARD_PLACEMENT[0]).not.toBe('below')
    // Front-centre (4) is the only safe below seat.
    expect(NAME_CARD_PLACEMENT[4]).toBe('below')
  })

  it('paints front rows above back rows (painter order)', () => {
    const back = seatZIndex(36)
    const mid = seatZIndex(45)
    const front = seatZIndex(68.5)
    expect(back).toBeLessThan(mid)
    expect(mid).toBeLessThan(front)
    // Every seat must sit above the room-art layers (z 0–2) AND above the
    // quick-poke catcher (z 40) so a tap on another seat retargets the
    // bubble instead of dismissing it.
    expect(back).toBeGreaterThan(40)
  })

  it('scales deeper rows down and keeps the front row at full size', () => {
    expect(rowPerspectiveScale(36)).toBeLessThan(rowPerspectiveScale(45))
    expect(rowPerspectiveScale(45)).toBeLessThan(rowPerspectiveScale(58))
    expect(rowPerspectiveScale(58)).toBe(1)
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
    // The forbidden shape is "absent → render nothing" (literal null branch).
    // Bounded to the ternary itself: the earlier [^;]* form false-positived
    // on any `return null` appearing later in the file (JSX has no
    // semicolons), which broke once sibling Views joined the absent branch.
    expect(SCENE_TSX).not.toMatch(/presence\s*===\s*['"]absent['"]\s*\?\s*(?:\(\s*)?null/)
    expect(SCENE_TSX).not.toMatch(/\{[^}]*presence\s*===\s*['"]absent['"][^}]*\?\s*null/)
  })

  it('provides the seat-anchored silhouette modifier for absent members', () => {
    expect(SCENE_SCSS).toMatch(/&--absent\s*\{/)
    // The silhouette must be a static dim/desaturate treatment, not a
    // walk-in animation that would replay at the seat.
    expect(SCENE_SCSS).toMatch(/&--absent\s*\{[^}]*opacity/)
  })
})
