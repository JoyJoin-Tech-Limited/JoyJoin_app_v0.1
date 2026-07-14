// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// TeammateCard's tap/longpress handlers are embedded in a Taro component and
// this workspace has no React render harness for Taro components (component
// internals are locked via source assertions — see DragRevealRibbon.test.ts).
// These assertions pin the structural guarantees of the trailing-tap guard:
// longpress-then-immediate-tap = single focus; longpress-then-late-tap = tap
// processed; the guard can never double-swallow.
const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), 'TeammateCard.tsx')

describe('TeammateCard longpress trailing-tap guard', () => {
  const source = readFileSync(componentPath, 'utf8')

  const handleTapBody = source.slice(
    source.indexOf('const handleTap = useCallback'),
    source.indexOf('const handleLongPress = useCallback'),
  )
  const handleLongPressBody = source.slice(
    source.indexOf('const handleLongPress = useCallback'),
    source.indexOf('const opacity'),
  )

  it('arms a pending-trailing-tap flag on longpress (timestamp kept too)', () => {
    expect(handleLongPressBody).toContain('lastLongPressAtRef.current = Date.now()')
    expect(handleLongPressBody).toContain('pendingTrailingTapRef.current = true')
    expect(handleLongPressBody).toContain('onFocus()')
  })

  it('consumes the flag on the first tap regardless of the swallow decision (never double-swallow)', () => {
    const flagCheck = handleTapBody.indexOf('if (pendingTrailingTapRef.current)')
    const flagClear = handleTapBody.indexOf('pendingTrailingTapRef.current = false')
    expect(flagCheck).toBeGreaterThanOrEqual(0)
    expect(flagClear).toBeGreaterThan(flagCheck)
    // The flag is cleared before the swallow return, so a second tap is
    // always processed and an expired flag still falls through to onFocus().
    const swallowReturn = handleTapBody.indexOf('TRAILING_TAP_MAX_AGE_MS) return')
    expect(swallowReturn).toBeGreaterThan(flagClear)
    expect(handleTapBody.indexOf('onFocus()')).toBeGreaterThan(swallowReturn)
  })

  it('bounds the swallow window to 3s so a stale flag cannot eat an unrelated future tap', () => {
    expect(source).toContain('TRAILING_TAP_MAX_AGE_MS = 3000')
    expect(handleTapBody).toContain('Date.now() - lastLongPressAtRef.current < TRAILING_TAP_MAX_AGE_MS')
    // Regression lock: the old pure 600ms time window must not come back.
    expect(handleTapBody).not.toContain('< 600')
  })
})

describe('TeammateCard fan template + deal geometry (Cascading Hand Fan)', () => {
  const source = readFileSync(componentPath, 'utf8')

  it('renders the rich collectible template (art zone + 4-row info grid)', () => {
    expect(source).toContain('squad-unboxing__deck-card-art')
    expect(source).toContain('squad-unboxing__deck-card-info')
    // Round-3 restructure (2026-07-13): the art zone is pure art + 我 badge /
    // +N overflow chip / 最佳拍档 stamp only. The info zone is a strict 4-row
    // grid: name, accent archetype, grey meta line (age·gender · industry),
    // one pill. The nameplate strip and art-zone meta chip are gone.
    expect(source).toContain('squad-unboxing__deck-card-badges')
    expect(source).toContain('squad-unboxing__deck-card-meta-chip')
    expect(source).toContain('squad-unboxing__deck-card-name')
    expect(source).toContain('squad-unboxing__deck-card-archetype')
    expect(source).toContain('squad-unboxing__deck-card-meta')
    expect(source).toContain('squad-unboxing__deck-card-pills')
    // Regression locks: inline name+trailing row truncated names to 1 char on
    // covered cards; nameplate space-between squeezed archetype to "社…".
    expect(source).not.toContain('squad-unboxing__deck-card-name-row')
    expect(source).not.toContain('squad-unboxing__deck-card-name-trailing')
    expect(source).not.toContain('squad-unboxing__deck-card-nameplate')
    expect(source).not.toContain('squad-unboxing__deck-card-industry')
  })

  it('shows exactly one connection-point pill on the card (full list in detail)', () => {
    // Visual-fit lock: two 2-line pills overflow the info zone at fan widths
    // and clip at the card bottom (verified in the 2026-07-13 smoke).
    expect(source).toContain('connectionPointsWithRarity.slice(0, 1)')
    expect(source).toContain("connectionPoints.slice(0, 1)")
  })

  it('silently omits privacy-hidden fields (no placeholders)', () => {
    expect(source).toContain('member.ageVisible === false')
    expect(source).toContain('member.industryVisible === false')
  })

  it('derives the flip from isRevealed (dealt), not from per-card local state', () => {
    // The front face shows once the card is dealt; focus only lifts it.
    expect(source).toContain("isRevealed ? 'squad-unboxing__deck-card--flipped' : ''")
    // No useState-backed local flip flag may be reintroduced.
    expect(source).not.toMatch(/useState\(.*flip/i)
    expect(source).not.toContain('const [flipped')
  })

  it('toggles fan pose classes (no inline rpx transforms)', () => {
    // The fan pose lives in index.scss per-(row-length,index) rules; the
    // component only toggles state classes. Inline rpx/deg is not transformed
    // by the Taro H5 build and collapsed the cards to ~2px (2026-07-13 smoke).
    expect(source).toContain('squad-unboxing__deck-card--focused-lift')
    expect(source).toContain('squad-unboxing__deck-card--focused-lift-deg')
    expect(source).toContain('squad-unboxing__deck-card--peek')
    expect(source).not.toContain('squad-unboxing__deck-card--dimmed')
    expect(source).not.toContain('focusScale')
    expect(source).not.toContain('focusLiftRpx')
    // Flat-row compact mode is gone.
    expect(source).not.toContain('compact')
  })

  it('keeps rpx out of the inline style object entirely (H5 safety)', () => {
    const styleBlock = source.slice(source.indexOf('style={{'), source.indexOf('onClick={handleTap}'))
    expect(styleBlock).not.toContain('rpx')
    // Unitless + ms + color values are safe inline in both runtimes.
    expect(styleBlock).toContain('opacity')
    expect(styleBlock).toContain('transitionDuration')
    expect(styleBlock).toContain('borderColor')
  })

  it('keeps unfocused siblings fully opaque while another card is focused', () => {
    expect(source).toContain('const opacity = isRevealed ? 1 : 0')
    expect(source).not.toContain('isDimmed')
    expect(source).not.toContain('anyFocused')
  })

  it('renders the 我 badge and the 最佳拍档 stamp', () => {
    expect(source).toContain('squad-unboxing__deck-card-me-badge')
    expect(source).toContain('squad-unboxing__deck-card-stamp')
    expect(source).toContain('最佳拍档')
    expect(source).toContain('isBestPartner')
  })

  it('builds an aria-label that includes age + industry', () => {
    const ariaStart = source.indexOf('const ariaLabel = [')
    expect(ariaStart).toBeGreaterThanOrEqual(0)
    const ariaBlock = source.slice(ariaStart, source.indexOf(']', ariaStart))
    expect(ariaBlock).toContain('agePart')
    expect(ariaBlock).toContain('industry')
    expect(ariaBlock).toContain('最佳拍档')
  })

  it('renders a premium card back (foil + logo mark)', () => {
    expect(source).toContain('squad-unboxing__deck-card-back-foil')
    expect(source).toContain('squad-unboxing__deck-card-back-logo')
    expect(source).toContain('BrandLogo')
  })

  it('animates only transform/opacity/box-shadow (no layout-triggering properties)', () => {
    // The component never declares transitionProperty or the transition
    // shorthand inline — the transition property list lives in index.scss
    // (transform, opacity, box-shadow only).
    expect(source).not.toContain('transitionProperty')
    expect(source).not.toMatch(/[^a-zA-Z]transition\s*:/)
  })
})
