// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const pageSource = readFileSync(resolve(here, 'index.tsx'), 'utf8')
const pageStyles = readFileSync(resolve(here, 'index.scss'), 'utf8')
const pageConfig = readFileSync(resolve(here, 'index.config.ts'), 'utf8')

describe('squad unboxing revealed layout contract', () => {
  it('keeps reveal-all directly above attendance without restoring retired actions', () => {
    expect(pageSource).toContain('squad-unboxing__confirm-btn')
    expect(pageSource).not.toContain('截图保存记忆')
    expect(pageSource).not.toContain('查看活动详情')
    expect(pageSource).not.toContain('稍后再看')
    expect(pageSource).toContain("className='squad-unboxing__reveal-chip'")
    expect(pageSource.indexOf("className='squad-unboxing__reveal-chip'"))
      .toBeLessThan(pageSource.indexOf('squad-unboxing__confirm-btn'))
  })

  it('locks the revealed state to the viewport instead of enabling page scroll', () => {
    expect(pageSource).toContain("scrollY={flowState !== 'revealed'}")
    expect(pageConfig).toContain('disableScroll: true')
    expect(pageStyles).toMatch(/&__scroll--revealed\s*\{[\s\S]*?overflow:\s*hidden;/)
    expect(pageStyles).toMatch(/&__scroll-content--revealed\s*\{[\s\S]*?justify-content:\s*center;/)
  })

  it('reserves the full fixed dock and moves its description with the CTA', () => {
    expect(pageStyles).toContain('@include fixed-footer-reserve(184rpx, $spacing-sm);')

    const dockStart = pageSource.indexOf("'squad-unboxing__bottom-dock'")
    const confirmStart = pageSource.indexOf('squad-unboxing__confirm-btn', dockStart)
    const descriptionStart = pageSource.indexOf('squad-unboxing__return-thread', confirmStart)
    // The overlay moved into its own component (2026-08-19) — the page-level
    // contract is that the component mounts after the dock, and the class
    // string itself lives in SquadUnboxingSuccessOverlay.tsx.
    const successOverlayStart = pageSource.indexOf('<SquadUnboxingSuccessOverlay', descriptionStart)
    expect(confirmStart).toBeGreaterThan(dockStart)
    expect(descriptionStart).toBeGreaterThan(confirmStart)
    expect(successOverlayStart).toBeGreaterThan(descriptionStart)
  })

  it('keeps the scaled card fan below the navigation bar', () => {
    // 2026-07-24 wow pass: fan scale raised 0.75 → 0.85 (stage clamp grew
    // 560 → 640rpx to absorb the taller scaled two-row fan).
    expect(pageStyles).toContain('transform: translateY(-16rpx) scale(0.85);')
    expect(pageStyles).not.toContain('transform: translateY(-88rpx) scale(0.85);')
  })

  it('keeps the 4-row card face inside the info-zone budget (2026-08-19 row-budget invariant)', () => {
    // Pure arithmetic guard: the next "one more row" addition fails CI here
    // instead of clipping on device. Anchors (update BOTH sides together):
    // - card height 332rpx — $fan-card-sizes in index.scss, drift-locked to
    //   computeFanLayout.ts in SquadDeckStage.test.ts (do not change).
    // - art zone `flex: 0 0 46%` — index.scss `&__deck-card-art`.
    // - info zone `flex: 1 1 auto` + `padding: 12rpx $spacing-sm` (12rpx × 2
    //   vertical, 8rpx recovered per edge by the 2026-08-20 overlap fix) —
    //   index.scss `&__deck-card-info`.
    const artBlock = pageStyles.split('&__deck-card-art {')[1]?.split('}')[0] ?? ''
    expect(artBlock).toContain('flex: 0 0 46%')
    const infoBlock = pageStyles
      .split('&__deck-card-info {')
      .slice(1)
      .map((tail) => tail.split('}')[0] ?? '')
      .find((block) => block.includes('flex: 1 1 auto')) ?? ''
    expect(infoBlock).toContain('padding: 12rpx $spacing-sm')

    const CARD_HEIGHT_RPX = 332
    const ART_SHARE = 0.46
    const INFO_VERTICAL_PADDING_RPX = 12 * 2 // 12rpx top + bottom
    const infoUsableRpx = CARD_HEIGHT_RPX * (1 - ART_SHARE) - INFO_VERTICAL_PADDING_RPX
    expect(infoUsableRpx).toBeGreaterThanOrEqual(147)

    // 4-row face: name ~34 + archetype ~31 + meta ~30 + hook pill ~30 + gaps ~10.
    const FOUR_ROW_BUDGET_RPX = 34 + 31 + 30 + 30 + 10
    expect(FOUR_ROW_BUDGET_RPX).toBeLessThanOrEqual(infoUsableRpx)
    // …and a hypothetical 5th row (~30rpx, e.g. the removed temp chip) must
    // NOT fit — that was the 2026-08-19 clipping bug.
    const FIVE_ROW_BUDGET_RPX = FOUR_ROW_BUDGET_RPX + 30
    expect(FIVE_ROW_BUDGET_RPX).toBeGreaterThan(infoUsableRpx)
  })
})
