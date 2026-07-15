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
    expect(handleLongPressBody).toContain('onLongPress()')
  })

  it('consumes the flag on the first tap regardless of the swallow decision (never double-swallow)', () => {
    const flagCheck = handleTapBody.indexOf('if (pendingTrailingTapRef.current)')
    const flagClear = handleTapBody.indexOf('pendingTrailingTapRef.current = false')
    expect(flagCheck).toBeGreaterThanOrEqual(0)
    expect(flagClear).toBeGreaterThan(flagCheck)
    // The flag is cleared before the swallow return, so a second tap is
    // always processed and an expired flag still falls through to onTap().
    const swallowReturn = handleTapBody.indexOf('TRAILING_TAP_MAX_AGE_MS) return')
    expect(swallowReturn).toBeGreaterThan(flagClear)
    expect(handleTapBody.indexOf('onTap()')).toBeGreaterThan(swallowReturn)
  })

  it('bounds the swallow window to 3s so a stale flag cannot eat an unrelated future tap', () => {
    expect(source).toContain('TRAILING_TAP_MAX_AGE_MS = 3000')
    expect(handleTapBody).toContain('Date.now() - lastLongPressAtRef.current < TRAILING_TAP_MAX_AGE_MS')
    // Regression lock: the old pure 600ms time window must not come back.
    expect(handleTapBody).not.toContain('< 600')
  })

  it('routes tap and long-press to separate parent handlers (AC-12 composition)', () => {
    // Long-press fires the medium haptic in the card; the page skips its own
    // light focus haptic for the long-press path so they never stack.
    expect(handleLongPressBody).toContain("haptics('medium')")
    expect(handleTapBody).not.toContain("haptics(")
    expect(source).toContain('onTap: () => void')
    expect(source).toContain('onLongPress: () => void')
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

  it('prefers member avatars and falls back to archetype art after an avatar error', () => {
    expect(source).toContain('member.avatarUrl && !avatarFailed')
    expect(source).toContain('setAvatarFailed(true)')
    expect(source).toContain("mode={usingAvatar ? 'aspectFill' : 'aspectFit'}")
    expect(source).toContain('squad-unboxing__deck-card-art-img--avatar')
  })

  it('shows exactly one connection-point pill on the card (full list in detail)', () => {
    // Visual-fit lock: two 2-line pills overflow the info zone at fan widths
    // and clip at the card bottom (verified in the 2026-07-13 smoke).
    expect(source).toMatch(/connectionPointsWithRarity\s*\n?\s*\.slice\(0, 1\)/)
    expect(source).toMatch(/connectionPoints\s*\n?\s*\.slice\(0, 1\)/)
  })

  it('strips wrapping full-width parens before the pill text (A3)', () => {
    // A leading （ under 1-line ellipsis read as a severed fragment
    // (`（都偏内向…`); the strip helper lives in the pure view-model module.
    expect(source).toContain('stripConnectionPointParens')
    expect(source).toContain("from './squadUnboxingViewModels'")
    const pointsBlock = source.slice(
      source.indexOf('function getConnectionPoints'),
      source.indexOf('function getArchetypeAssetUrl'),
    )
    expect(pointsBlock.match(/stripConnectionPointParens/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('silently omits privacy-hidden fields (no placeholders)', () => {
    expect(source).toContain('member.ageVisible === false')
    expect(source).toContain('member.industryVisible === false')
  })

  it('derives the flip from isDealt && isFaceUp (controller-owned set), never local state', () => {
    // REL-01: --flipped renders only when dealt, and the face derives from
    // the single controller-owned flip set passed down as isFaceUp.
    expect(source).toContain("isDealt && isFaceUp ? 'squad-unboxing__deck-card--flipped' : ''")
    // No useState-backed local flip flag may be reintroduced (AC-13).
    expect(source).not.toMatch(/useState\(.*flip/i)
    expect(source).not.toContain('const [flipped')
    expect(source).not.toContain('isRevealed')
  })

  it('toggles fan pose classes (no inline rpx transforms), peek retired', () => {
    // The fan pose lives in index.scss per-(row-length,index) rules; the
    // component only toggles state classes. Inline rpx/deg is not transformed
    // by the Taro H5 build and collapsed the cards to ~2px (2026-07-13 smoke).
    expect(source).toContain('squad-unboxing__deck-card--focused-lift')
    expect(source).toContain('squad-unboxing__deck-card--focused-lift-deg')
    // No sibling dim (upstream: focus = lift only, layered deck stays legible).
    expect(source).not.toContain('squad-unboxing__deck-card--dimmed')
    expect(source).not.toContain('focusScale')
    expect(source).not.toContain('focusLiftRpx')
    // MNT-02: the auto-peek code path is deleted, not commented.
    expect(source).not.toContain('isPeek')
    expect(source).not.toContain('--peek')
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
    // Upstream: focus = lift only. Dealt siblings render at full opacity so the
    // layered deck stays legible; the tap-to-reveal model keys opacity on the
    // deal (not the retired `isRevealed`). Pocket-the-deck (2026-07-15) adds a
    // leading `pocketPose ? 0 :` arm — cards fade out as they fold into the
    // pill — but the dealt-sibling rule is unchanged: opacity still derives
    // from `isDealt`, never from a sibling's focus.
    expect(source).toContain('const opacity = pocketPose ? 0 : isDealt ? 1 : 0')
    expect(source).not.toContain('isDimmed')
    expect(source).not.toContain('anyFocused')
  })

  it('drives the flip transition delay from the burst-stagger prop (ms-safe inline)', () => {
    expect(source).toContain('style={{ transitionDelay: `${flipDelayMs}ms` }}')
  })

  it('renders the 我 badge and the 最佳拍档 stamp on the front', () => {
    expect(source).toContain('squad-unboxing__deck-card-me-badge')
    expect(source).toContain('squad-unboxing__deck-card-stamp')
    expect(source).toContain('最佳拍档')
    expect(source).toContain('isBestPartner')
  })

  it('builds a face-up aria-label with age + industry, and a face-down reveal-invitation label', () => {
    const ariaStart = source.indexOf('const ariaLabel = isFaceUp')
    expect(ariaStart).toBeGreaterThanOrEqual(0)
    const ariaBlock = source.slice(ariaStart, source.indexOf('return (', ariaStart))
    expect(ariaBlock).toContain('agePart')
    expect(ariaBlock).toContain('industry')
    expect(ariaBlock).toContain('最佳拍档')
    // AC: face-down cards are labelled tap targets with reveal-invitation
    // semantics (member name + invitation), via the craft-owned builder.
    expect(ariaBlock).toContain('buildFaceDownCardAriaLabel(name, isCurrentUser)')
  })

  it('renders the enriched CSS-lattice card back (foil + SCSS-sized logo image, NO identity text)', () => {
    // AC-09: lattice layer is SCSS-gradient-only; the retired raster pattern
    // asset is never referenced anywhere in source.
    expect(source).toContain('squad-unboxing__deck-card-back-lattice')
    expect(source).toContain('squad-unboxing__deck-card-back-foil')
    expect(source).toContain('squad-unboxing__deck-card-back-logo')
    expect(source).not.toContain('squad-card-back-pattern')
    // A8: the back logo is a bundled <Image> sized in SCSS, NOT BrandLogo —
    // BrandLogo's inline rpx sizing is dropped by the H5 postcss pass and
    // collapsed the back logo to a broken-image glyph in the H5 preview.
    expect(source).not.toContain("import BrandLogo")
    expect(source).not.toContain('<BrandLogo')
    const backStart = source.indexOf("squad-unboxing__deck-card-face--back',\n")
    expect(backStart).toBeGreaterThanOrEqual(0)
    const backBlock = source.slice(backStart, source.indexOf('{/* Card front', backStart))
    expect(backBlock).toContain('squad-unboxing__deck-card-back-logo-img')
    expect(backBlock).toContain("/assets/joyjoin-logo-tab.png")
    // The only image on the back is the logo mark — no archetype art here.
    expect(backBlock).not.toContain('deck-card-art-img')
    // Uniform backs: the 我 badge lives on the FRONT only — no identity text
    // on any back (AC-06).
    expect(backBlock).not.toContain('squad-unboxing__deck-card-me-badge')
    expect(backBlock).not.toContain('{name}')
    expect(backBlock).not.toContain('archetypeName')
  })

  it('marks the best-partner back with the gold-foil modifier (only back variant)', () => {
    // AC-06: the gold tease is the only non-uniform back.
    expect(source).toContain("isBestPartner ? 'squad-unboxing__deck-card-face--back-gold' : ''")
  })

  it('mirrors the +N overflow chip on the card back (AC-10)', () => {
    const backStart = source.indexOf("squad-unboxing__deck-card-face--back',\n")
    const backBlock = source.slice(backStart, source.indexOf('{/* Card front', backStart))
    expect(backBlock).toContain('squad-unboxing__deck-card-back-overflow')
    expect(backBlock).toContain('squad-unboxing__deck-card-meta-chip--overflow')
    expect(backBlock).toContain('+{overflowBadge}')
  })

  it('renders the per-flip sheen element with an inline ms animation delay (AC-08)', () => {
    expect(source).toContain('squad-unboxing__deck-card-sheen')
    expect(source).toContain("sheenActive ? 'squad-unboxing__deck-card-sheen--active' : ''")
    expect(source).toContain('animationDelay: `${sheenDelayMs}ms`')
  })

  it('animates only transform/opacity (no layout-triggering properties)', () => {
    // The component never declares transitionProperty or the transition
    // shorthand inline — the transition property list lives in index.scss
    // (transform + opacity only; box-shadow dropped in B1 — per-frame shadow
    // paint on the focus lift was wasted work).
    expect(source).not.toContain('transitionProperty')
    expect(source).not.toMatch(/[^a-zA-Z]transition\s*:/)
  })
})
