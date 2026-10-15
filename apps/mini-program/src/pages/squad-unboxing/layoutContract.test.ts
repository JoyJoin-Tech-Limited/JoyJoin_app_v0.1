// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const pageSource = readFileSync(resolve(here, 'index.tsx'), 'utf8')
const pageStyles = readFileSync(resolve(here, 'index.scss'), 'utf8')
const pageConfig = readFileSync(resolve(here, 'index.config.ts'), 'utf8')
const panelSource = readFileSync(resolve(here, 'SquadUnboxingTonightsPanel.tsx'), 'utf8')
const controllerSource = readFileSync(resolve(here, 'useSquadUnboxingController.ts'), 'utf8')

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
    // 2026-10-15: raised 184 → 244rpx to match the measured tallest dock
    // (fan states stack the reveal/fold chip above the confirm CTA at 256rpx,
    // which previously left the panel's bottom corners behind the dock).
    expect(pageStyles).toContain('@include fixed-footer-reserve(244rpx, $spacing-sm);')

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
    // 2026-10-14 PRD A2: the audit measured the focused top-row card clipping
    // ~29rpx past the stage top on a 640rpx stage. Fan tightened to 0.84 with
    // a −8rpx lift, stage clamp floor 440→460rpx — both sides anchored here.
    expect(pageStyles).toContain('transform: translateY(-8rpx) scale(0.84);')
    expect(pageStyles).toContain('height: clamp(460rpx, 46dvh, 640rpx);')
    expect(pageStyles).not.toContain('transform: translateY(-88rpx) scale(0.84);')
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

/**
 * 2026-10-15 visual-validation fix set.
 *
 * Measured on the H5 render (390×844) with the revealed column hard-locked:
 * the content region is 407px tall and the panel chapter alone measures 402px,
 * of which the 主题 row is 145.6px. So in the fan phase the column can only show
 * the panel — its tail (主题/亮点/开场钩子), the 桌卡 teaser and the return thread
 * land below 740px, under the fixed dock. The 2026-08-19 precedent for content
 * that cannot fit the locked column is to debut it post-fold
 * (`deckPhase !== 'fan'`), which is what these gates now do.
 *
 * Auto-pocket only arms when no card is focused, and any focus cancels it
 * permanently (掌控感) — so a user who flips card-by-card never reaches the
 * relaxed column, which is why the manual 收起卡组 affordance now exists.
 */
describe('fan-phase budget: post-fold content gating + manual fold affordance (2026-10-15)', () => {
  /** Extract a top-level nested rule body (no nested braces inside these rules). */
  const rule = (selector: string) =>
    pageStyles.match(new RegExp(`${selector}\\s*\\{[\\s\\S]*?\\}`))?.[0] ?? ''

  it('gates the panel theme row to the relaxed column', () => {
    expect(panelSource).toContain('showThemeRow &&')
    expect(panelSource).toContain('showThemeRow: boolean')
    expect(pageSource).toContain("showThemeRow={deckPhase !== 'fan'}")
  })

  it('gates the return thread to the relaxed column', () => {
    // Measured at top 819.7 in the fan column (region ends at 740) — invisible.
    expect(pageSource).toContain("allCardsUp && deckPhase !== 'fan' ? (")
  })

  it('ships a fold chip wired to collapseDeck, hidden while the auto-fold holds', () => {
    expect(pageSource).toContain('squad-unboxing__fold-chip')
    expect(pageSource).toContain('onClick={collapseDeck}')
    expect(pageSource).toContain('!autoFoldPending')
    // The chip must not flicker during the auto-fold hold on the reveal-all path.
    expect(controllerSource).toContain("getState() === 'armed'")
    const foldChipRule = rule('&__fold-chip')
    expect(foldChipRule).toContain('min-height: 88rpx')
    expect(foldChipRule).toContain('&--pressed')
  })

  it('clamps narration with real CSS (the numberOfLines prop is alipay-only)', () => {
    const bubbleTextRule = rule('&__analysis-bubble-text')
    expect(bubbleTextRule).toContain('display: -webkit-box')
    expect(bubbleTextRule).toContain('-webkit-box-orient: vertical')
    expect(bubbleTextRule).toContain('-webkit-line-clamp: 4')
    expect(bubbleTextRule).toContain('overflow: hidden')

    const verdictRule = rule('&__narrative-verdict')
    expect(verdictRule).toContain('display: -webkit-box')
    expect(verdictRule).toContain('-webkit-box-orient: vertical')
    expect(verdictRule).toContain('-webkit-line-clamp: 3')
  })

  it('keeps the fan all-up voice short and debuts the soul line after the fold', () => {
    // 2026-10-15: a 5-line soul paragraph + panel measured 392px against a
    // ~378px fan column, pushing the panel tail behind the dock. The fan
    // resting voice is the short burst line; the reflection is chapter 2.
    const chainStart = pageSource.indexOf("const bubbleText = bubbleNarration?.kind === 'burst'")
    expect(chainStart).toBeGreaterThan(-1)
    const chain = pageSource.slice(chainStart, chainStart + 1200)
    expect(chain).toContain(": deckPhase === 'fan' || showPocketHint")
    expect(chain).toContain('? SQUAD_BURST_COMPLETION_BUBBLE_TEXT')
    expect(chain).toContain(': buildSquadSoulBubbleText(')

    // …and the burst line must not outlive its beat once the fan folds.
    expect(pageSource).toContain("setBubbleNarration((current) => (current?.kind === 'burst' ? null : current))")

    // The state-aware dock reserve: the fan dock stacks a chip above the CTA
    // (244rpx) while the folded dock is CTA-only (184rpx = the original value).
    expect(pageSource).toContain("flowState === 'revealed' && deckPhase !== 'fan' ? 'squad-unboxing__scroll-inner--pocketed'")
    expect(pageStyles).toMatch(
      /&__scroll--revealed &__scroll-inner--pocketed\s*\{[\s\S]*?fixed-footer-reserve\(160rpx, \$spacing-sm\)/,
    )
  })
})
