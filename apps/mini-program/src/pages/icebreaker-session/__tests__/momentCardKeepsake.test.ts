import { describe, expect, it } from 'vitest'
import {
  KEEPSAKE_MIN_BLOCK_HEIGHT,
  resolveKeepsakeLayout,
} from '../overlays/MomentCardView'

// SCALE is not exported; recover it from the exported minimal block height
// (59 units × SCALE) so expectations stay in the same scaled-px space.
const SCALE = KEEPSAKE_MIN_BLOCK_HEIGHT / 59

const u = (n: number) => n * SCALE

describe('resolveKeepsakeLayout (audit C9)', () => {
  it('roomy layout uses the full metrics with no degradation', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      topY: 0,
      maxBottomY: u(1000),
    })
    expect(layout.skip).toBe(false)
    expect(layout.compact).toBe(false)
    expect(layout.lineCount).toBe(2)
    expect(layout.dropPermission).toBe(false)
    // full total: 12 + 18 + 8 + 24*2 + (6 + 14) + 12 = 118
    expect(layout.blockHeight).toBe(u(118))
  })

  it('tier 1: tight space trades full paddings for compact', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      topY: 0,
      maxBottomY: u(100), // full 118 > 100, compact 98 ≤ 100
    })
    expect(layout.compact).toBe(true)
    expect(layout.lineCount).toBe(2)
    expect(layout.dropPermission).toBe(false)
    // compact total: 8 + 16 + 5 + 22*2 + (4 + 13) + 8 = 98
    expect(layout.blockHeight).toBe(u(98))
  })

  it('tier 2: extreme space clamps the question to one line', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      topY: 0,
      maxBottomY: u(90), // compact 2-line 98 > 90, 1-line 76 ≤ 90
    })
    expect(layout.compact).toBe(true)
    expect(layout.lineCount).toBe(1)
    expect(layout.dropPermission).toBe(false)
    // compact 1-line: 8 + 16 + 5 + 22 + (4 + 13) + 8 = 76
    expect(layout.blockHeight).toBe(u(76))
  })

  it('tier 3: the 悦仔说 row is dropped when one line still overflows', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      topY: 0,
      maxBottomY: u(70), // compact 1-line w/ permission 76 > 70, minimal 59 ≤ 70
    })
    expect(layout.dropPermission).toBe(true)
    expect(layout.lineCount).toBe(1)
    // minimal block: 8 + 16 + 5 + 22 + 8 = 59
    expect(layout.blockHeight).toBe(u(59))
  })

  it('audit worst case: 12-cast + quote + permission + medals bottom ≤ 440', () => {
    // Reproduces the audited overflow: block previously bottomed at ≈462
    // against a 440 maxBlockBottom and overlapped the footer.
    const topY = u(372)
    const maxBottomY = u(440)
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      topY,
      maxBottomY,
    })
    expect(layout.skip).toBe(false)
    expect(topY + layout.blockHeight).toBeLessThanOrEqual(maxBottomY)
  })

  it('last resort: skips the keepsake when topY exceeds the floor', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      topY: u(400),
      maxBottomY: u(440), // 40 < KEEPSAKE_MIN_BLOCK_HEIGHT
    })
    expect(layout.skip).toBe(true)
  })

  it('no-permission blocks skip the permission tiers entirely', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: false,
      topY: 0,
      maxBottomY: u(1000),
    })
    expect(layout.dropPermission).toBe(false)
    // full total without permission: 12 + 18 + 8 + 24*2 + 12 = 98
    expect(layout.blockHeight).toBe(u(98))
  })

  it('invariant: blockHeight never exceeds the available space (sweep)', () => {
    for (let available = 0; available <= 200; available += 7) {
      const layout = resolveKeepsakeLayout({
        questionLineCount: 2,
        hasPermission: true,
        topY: 0,
        maxBottomY: u(available),
      })
      if (!layout.skip) {
        expect(layout.blockHeight).toBeLessThanOrEqual(u(available))
      }
    }
  })
})

describe('resolveKeepsakeLayout — AIGC microline row (Q1-4)', () => {
  it('label row adds its height to the roomy full layout', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      hasAigcLabel: true,
      topY: 0,
      maxBottomY: u(1000),
    })
    expect(layout.skip).toBe(false)
    expect(layout.compact).toBe(false)
    // full total with label: 118 + (6 gap + 13 row) = 137
    expect(layout.blockHeight).toBe(u(137))
    expect(layout.aigcRow).toBe(u(13))
    expect(layout.gapBeforeAigc).toBe(u(6))
  })

  it('label row survives every degradation tier (never dropped)', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      hasAigcLabel: true,
      topY: 0,
      maxBottomY: u(80), // minimal labelled block: 59 + (4 + 12) = 75 ≤ 80
    })
    expect(layout.skip).toBe(false)
    expect(layout.compact).toBe(true)
    expect(layout.lineCount).toBe(1)
    expect(layout.dropPermission).toBe(true)
    // minimal labelled: 8 + 16 + 5 + 22 + (4 + 12) + 8 = 75
    expect(layout.blockHeight).toBe(u(75))
    expect(layout.aigcRow).toBe(u(12))
  })

  it('skips when even the minimal labelled block cannot fit', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      hasAigcLabel: true,
      topY: 0,
      maxBottomY: u(70), // 70 < 75 minimal labelled block
    })
    expect(layout.skip).toBe(true)
  })

  it('omitting the flag keeps the legacy (pre-label) budget', () => {
    const layout = resolveKeepsakeLayout({
      questionLineCount: 2,
      hasPermission: true,
      topY: 0,
      maxBottomY: u(1000),
    })
    expect(layout.blockHeight).toBe(u(118))
    expect(layout.aigcRow).toBe(0)
  })

  it('invariant: labelled blockHeight never exceeds the available space (sweep)', () => {
    for (let available = 0; available <= 200; available += 7) {
      const layout = resolveKeepsakeLayout({
        questionLineCount: 2,
        hasPermission: true,
        hasAigcLabel: true,
        topY: 0,
        maxBottomY: u(available),
      })
      if (!layout.skip) {
        expect(layout.blockHeight).toBeLessThanOrEqual(u(available))
      }
    }
  })
})
