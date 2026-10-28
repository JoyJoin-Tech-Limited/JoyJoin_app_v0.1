import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { resolveGatheringRoomMemberState } from '../../pages/gathering-room/gatheringRoomPresence'
import { ROOM_TABLE_OVERLAY } from './room-table-overlay.meta'
import {
  NAME_CARD_PLACEMENT,
  SEAT_ANCHORS,
  SEATED_OFFSETS,
  resolveQuickPokeAnchor,
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

describe('gathering room table occlusion contract (2026-10-26)', () => {
  it('seats the back row behind the table plane and the front row in front', () => {
    // The old anchors put seat 4 at y=68.5 (body bottom below the tablecloth)
    // and painted every avatar above the flat backdrop, so people appeared to
    // stand on the table. Painter z is 10 + round(anchor.y).
    expect(seatZIndex(38.8)).toBe(49) // back-centre, behind the overlay (52)
    expect(seatZIndex(57.4)).toBe(67) // front flanks, in front
    expect(seatZIndex(71.3)).toBe(81) // front-centre, in front
  })

  it('lands every confirmed avatar foot line on its measured cushion top', () => {
    // Avatar body = 96×144rpx, wrapper translateY(-88%), frame scaleY(.85):
    // the foot line therefore sits 17.28rpx below the seat anchor. These are
    // the six cushion-top Y measurements from room-composite-v2.webp.
    const cushionTopYRpx = [389, 443, 443, 568, 701, 568]
    const footBelowAnchorRpx = 17.28
    SEAT_ANCHORS.forEach((anchor, seatIndex) => {
      const footY = (anchor.y / 100) * 960 + footBelowAnchorRpx + SEATED_OFFSETS[seatIndex].dy
      expect(Math.abs(footY - cushionTopYRpx[seatIndex]), `seat ${seatIndex}`).toBeLessThanOrEqual(4)
    })
  })

  it('keeps the table overlay and name plates on separate scene-level layers', () => {
    expect(SCENE_TSX).toContain('ROOM_TABLE_OVERLAY')
    expect(SCENE_TSX).toMatch(/layer--table-overlay/)
    expect(SCENE_TSX).toMatch(/GatheringRoomNameCard/)
    expect(SCENE_TSX).toMatch(/name-card-layer/)
    expect(SCENE_SCSS).toMatch(/&--table-overlay\s*\{[^}]*z-index:\s*52/)
    expect(SCENE_SCSS).toMatch(/&__name-card-layer\s*\{[^}]*z-index:\s*90/)
  })

  it('ships a transparent table-only cutout instead of a rectangular room crop', async () => {
    const assetPath = path.join(HERE, '../../pages/gathering-room/assets/room-table-overlay.webp')
    const { data, info } = await sharp(assetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect({ width: info.width, height: info.height }).toEqual({
      width: ROOM_TABLE_OVERLAY.designBox.width,
      height: ROOM_TABLE_OVERLAY.designBox.height,
    })
    const alphaAt = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3]
    for (const [x, y] of [[0, 0], [info.width - 1, 0], [0, info.height - 1], [info.width - 1, info.height - 1]]) {
      expect(alphaAt(x, y), `transparent corner ${x},${y}`).toBe(0)
    }
    expect(alphaAt(315, 160)).toBeGreaterThan(0)
    let covered = 0
    for (let index = 3; index < data.length; index += info.channels) {
      if (data[index] > 0) covered += 1
    }
    const coverage = covered / (info.width * info.height)
    expect(coverage).toBeLessThan(0.4)
    expect(Math.abs(coverage - ROOM_TABLE_OVERLAY.alphaCoverage)).toBeLessThan(0.000001)
  })

  it('keeps side plates inside the scene edge at the narrowest seat', () => {
    // Seats 3/5 are the outermost side-plate anchors. 160rpx + the 8rpx gap
    // leaves a design-space margin above 16rpx at a 750rpx scene width.
    const outerAnchorRpx = (32.5 / 100) * 750
    const plateRightRpx = outerAnchorRpx - 48 - 8
    expect(plateRightRpx - 160).toBeGreaterThanOrEqual(16)
    expect(SCENE_SCSS).toMatch(/max-width:\s*160rpx/)
  })
})

describe('gathering room quick-poke safety contract (2026-10-27)', () => {
  it('clamps the 420rpx bubble to a 16rpx scene gutter at every seat', () => {
    for (let seatIndex = 0; seatIndex < 8; seatIndex += 1) {
      const anchor = resolveQuickPokeAnchor(seatIndex)
      const centreRpx = (anchor.x / 100) * 750
      expect(centreRpx - 210, `seat ${seatIndex} left`).toBeGreaterThanOrEqual(16 - 1e-6)
      expect(750 - (centreRpx + 210), `seat ${seatIndex} right`).toBeGreaterThanOrEqual(16 - 1e-6)
    }
    expect(resolveQuickPokeAnchor(0).placement).toBe('below')
    expect(resolveQuickPokeAnchor(4).placement).toBe('above')
    expect(SCENE_SCSS).toMatch(/&__quick-poke\s*\{[^}]*width:\s*420rpx/)
    expect(SCENE_SCSS).toMatch(/&--below\s*\{[^}]*transform:/)
  })

  it('keeps detail on every tap and gates the long-press shortcut by member state', () => {
    expect(SCENE_TSX.match(/onClick=\{\(\) => onAvatarTap\?\.\(profile\)\}/g)).toHaveLength(2)
    expect(SCENE_TSX.match(/onLongPress=\{canLongPressPoke \? \(\) => onAvatarLongPress\?\.\(profile\) : undefined\}/g)).toHaveLength(2)
    expect(SCENE_TSX).toContain('memberState.canPoke && !isOwn && realtimeConnectionEnabled')
    expect(SCENE_TSX).toContain('quickPokeMemberState?.canPoke')
    expect(SCENE_TSX).not.toContain('onLongPress={() => onAvatarLongPress?.(profile)}')
  })

  it('locks the unscaled compact roster, internal scroll and 2×2 poke panel', () => {
    expect(SCENE_TSX).toContain('layout.scale < 0.75')
    expect(SCENE_TSX).toContain('memberProfiles.length > 6')
    expect(SCENE_TSX).toContain('<ScrollView')
    expect(SCENE_TSX).toContain('showScrollbar={false}')
    expect(SCENE_TSX).toContain('gathering-room-scene__compact-roster-own')
    expect(SCENE_TSX).toContain('gathering-room-scene__compact-roster-status')
    expect(SCENE_TSX).toContain('!compactInteractions && entranceArmed')
    expect(SCENE_SCSS).toMatch(/compact-roster-grid\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/)
    expect(SCENE_SCSS).toMatch(/compact-roster-item\s*\{[^}]*min-height:\s*112rpx/)
    expect(SCENE_SCSS).toMatch(/compact-roster-name\s*\{[^}]*font-size:\s*32rpx/)
    expect(SCENE_SCSS).toMatch(/compact-roster-status\s*\{[^}]*font-size:\s*24rpx/)
    expect(SCENE_SCSS).toMatch(/compact-roster-scroll\s*\{\s*height:\s*256rpx/)
    expect(SCENE_SCSS).toMatch(/compact-poke-action[\s\S]*?min-height:\s*104rpx/)
    expect(SCENE_SCSS).toMatch(/compact-poke-close\s*\{[^}]*min-height:\s*88rpx/)
    expect(SCENE_SCSS).toMatch(/compact-poke-grid\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  })
})

describe('gathering room G1 truth and motion contract (2026-10-27)', () => {
  it('uses the shared dual-axis resolver for seat, compact and quick-poke states', () => {
    expect(SCENE_TSX.match(/resolveGatheringRoomMemberState\(/g)).toHaveLength(3)
    expect(SCENE_TSX.match(/attendanceStatus: (?:profile|quickPokeMember)\.attendanceStatus/g)).toHaveLength(3)
    expect(SCENE_TSX.match(/isPresent: presentUserIds\.has\((?:profile|quickPokeMember)\.userId\)/g)).toHaveLength(3)
    expect(SCENE_TSX).toContain('aria-label={seatAriaLabel}')
    expect(SCENE_TSX).toContain('aria-label={ariaLabel}')
    expect(SCENE_TSX).toContain('memberState.statusLabel')
    expect(SCENE_TSX).toContain("staticMotion = reducedMotion || eventPhase === 'ended'")
    expect(SCENE_TSX).toContain("realtimeConnectionEnabled = wsConnected && eventPhase !== 'ended'")

    expect(resolveGatheringRoomMemberState({
      attendanceStatus: 'absent', isPresent: true, wsConnected: true, eventPhase: 'upcoming',
    }).canPoke).toBe(false)
    expect(resolveGatheringRoomMemberState({
      attendanceStatus: 'confirmed', isPresent: true, wsConnected: true, eventPhase: 'upcoming',
    }).canPoke).toBe(true)
    expect(resolveGatheringRoomMemberState({
      attendanceStatus: 'late', isPresent: true, wsConnected: true, eventPhase: 'live',
    }).canPoke).toBe(true)
    const disconnected = resolveGatheringRoomMemberState({
      attendanceStatus: 'pending', isPresent: true, wsConnected: false, eventPhase: 'upcoming',
    })
    expect(disconnected.canPoke).toBe(false)
    expect(disconnected.statusLabel).toContain('连接待恢复')
    const ended = resolveGatheringRoomMemberState({
      attendanceStatus: 'confirmed', isPresent: true, wsConnected: true, eventPhase: 'ended',
    })
    expect(ended.canPoke).toBe(false)
    expect(ended.statusLabel).toBe('已确认出席')
  })

  it('deletes decorative perpetual DOM/keyframes and leaves a static seal by default', () => {
    const removedTokens = [
      'layer--lamp-breathe',
      'seat-halo',
      'name-card-dot',
      'celebration-glow',
      'celebration-sparkle',
      'CELEBRATION_SPARKLES',
      'gathering-room-hop',
      'gathering-room-dot-pulse',
      'gathering-room-halo-pulse',
      'gathering-room-sparkle',
      'gathering-room-celebration-pop',
    ]
    for (const token of removedTokens) {
      expect(SCENE_TSX, `TSX retired ${token}`).not.toContain(token)
      expect(SCENE_SCSS, `SCSS retired ${token}`).not.toContain(token)
    }
    const infiniteAnimations = SCENE_SCSS.match(/animation:\s*[^;]*infinite/g) ?? []
    expect(infiniteAnimations).toHaveLength(1)
    expect(infiniteAnimations[0]).toContain('gathering-room-breathe')

    const sealBase = SCENE_SCSS.match(/&__confirmed-seal\s*\{[^}]*\}/)?.[0]
    expect(sealBase).toBeDefined()
    expect(sealBase).not.toContain('$color-brand-gold')
    expect(sealBase).not.toContain('box-shadow')
    expect(sealBase).not.toContain('animation:')
  })

  it('arms only the viewer success pulse once and locks 480ms/320ms motion', () => {
    expect(SCENE_TSX).toContain('ownConfirmationPulse={isOwn && ownConfirmationPulse}')
    expect(SCENE_TSX).toContain('ownPulseConsumedRef')
    expect(SCENE_TSX).toContain("presence !== 'confirmed') return")
    expect(SCENE_TSX).toContain('OWN_CONFIRMATION_PULSE_MS = 480')
    expect(SCENE_TSX).not.toContain('justConfirmed')
    expect(SCENE_TSX).not.toContain("prev !== 'confirmed'")
    expect(SCENE_SCSS).toMatch(/&--own-confirmation-pulse\s*\{\s*animation:\s*gathering-room-own-confirmation\s+480ms/)
    expect(SCENE_SCSS).toMatch(/&__confirmed-seal--own-pulse\s*\{\s*animation:\s*gathering-room-seal-stamp\s+320ms/)
    expect(SCENE_SCSS).toContain('@keyframes gathering-room-own-confirmation')
  })

  it('locks celebration copy, polite label, static contract and 360/1400/240 timing', () => {
    expect(SCENE_TSX).toContain("CELEBRATION_TITLE = '这桌齐了'")
    expect(SCENE_TSX).toContain("CELEBRATION_SUBTITLE = '悦仔先偷笑一下，现场见'")
    expect(SCENE_TSX).toContain("CELEBRATION_ARIA_LABEL = '全员已确认出席'")
    expect(SCENE_TSX).toContain('aria-label={CELEBRATION_ARIA_LABEL}')
    expect(SCENE_TSX).toContain('celebrationStatic || reducedMotion')
    expect(SCENE_TSX).toContain('CELEBRATION_ENTER_MS = 360')
    expect(SCENE_TSX).toContain('CELEBRATION_HOLD_MS = 1400')
    expect(SCENE_TSX).toContain('CELEBRATION_EXIT_MS = 240')
    expect(SCENE_TSX).toContain('CELEBRATION_ENTER_MS + CELEBRATION_HOLD_MS')
    expect(SCENE_TSX).toContain('!celebrationIsStatic && !wsConnected')
    expect(SCENE_TSX).not.toContain('haptics(')
    expect(SCENE_SCSS).toMatch(/&__celebration-card\s*\{[^}]*animation:\s*gathering-room-celebration-enter\s+360ms/)
    expect(SCENE_SCSS).toMatch(/&--leaving\s+\.gathering-room-scene__celebration-card\s*\{\s*animation:\s*gathering-room-celebration-exit\s+240ms/)
    expect(SCENE_SCSS).toMatch(/&--static\s+\.gathering-room-scene__celebration-card\s*\{\s*animation:\s*none/)
  })
})

describe('gathering room celebration stacking contract (2026-10-28)', () => {
  it('keeps the live celebration above seats and the independent name-card layer', () => {
    expect(SCENE_SCSS).toMatch(/&__celebration\s*\{\s*position:\s*absolute;\s*inset:\s*0;\s*z-index:\s*100;/)
  })
})
