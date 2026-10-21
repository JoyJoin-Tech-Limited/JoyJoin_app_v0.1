import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 2026-10-21 T46 audit CONCERN C2 source-lock: EventFaqAccordion carries the
// promise-behavior order lock (cancel_refund renders ONLY when
// preRevealRefundEnabled === true — the same fail-closed read as the checkout
// RefundGuaranteeLine) and the frozen motion contract (no height animation,
// chevron transform-only, ONE item open at a time via single-value state).
// Lock at source level so a "quick polish" can't silently reopen the promise
// gap or reintroduce a layout-thrashing animation.

const here = dirname(fileURLToPath(import.meta.url))
const compRoot = resolve(here, '..', '..', '..', 'components', 'event-detail')
const tsx = readFileSync(resolve(compRoot, 'EventFaqAccordion.tsx'), 'utf-8')
const scss = readFileSync(resolve(compRoot, 'EventFaqAccordion.scss'), 'utf-8')

describe('EventFaqAccordion cancel_refund promise gate (fail-closed, 2026-10-21 lock)', () => {
  it('filters cancel_refund out unless preRevealRefundEnabled === true', () => {
    expect(tsx).toContain("const CANCEL_REFUND_ITEM_ID = 'cancel_refund'")
    // The fail-closed branch: flag falsy → the refund item is REMOVED.
    expect(tsx).toMatch(
      /preRevealRefundEnabled\s*\?[\s\S]*?EVENT_FAQ_ITEMS[\s\S]*?\.filter\(\(item\)\s*=>\s*item\.id\s*!==\s*CANCEL_REFUND_ITEM_ID\)/,
    )
  })

  it('never renders a hardcoded refund promise in the component', () => {
    // All copy comes verbatim from EVENT_FAQ_ITEMS (packages/shared copy module).
    expect(tsx).toContain("@shared/copy/eventFaqCopy")
    expect(tsx).not.toContain('全额退款')
    expect(tsx).not.toContain('免费取消')
  })
})

describe('EventFaqAccordion motion contract (frozen, spec §5.3.3)', () => {
  it('animates no height/max-height property anywhere', () => {
    expect(scss).not.toMatch(/transition\s*:[^;]*\bheight\b/i)
    expect(scss).not.toMatch(/animation\s*:[^;]*\bheight\b/i)
    // Keyframe bodies must only touch opacity/transform.
    const keyframesBodies = scss
      .split('@keyframes')
      .slice(1)
      .map((block) => block.slice(block.indexOf('{') + 1, block.lastIndexOf('}')))
    expect(keyframesBodies.length).toBeGreaterThan(0)
    for (const body of keyframesBodies) {
      expect(body).not.toMatch(/\bheight\s*:/)
      expect(body).not.toMatch(/\bmax-height\s*:/)
      expect(body).not.toMatch(/\bwidth\s*:/)
    }
  })

  it('drives the chevron with transform only', () => {
    const chevronBlock = scss.slice(
      scss.indexOf('&__chevron'),
      scss.indexOf('&__item--open'),
    )
    expect(chevronBlock).toContain('transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)')
    expect(chevronBlock).toContain('transform: rotate(45deg)')
    expect(chevronBlock).not.toMatch(/transition\s*:[^;]*\b(width|height|color|opacity|background)\b/)
    // Open state flips via rotation, not a swap.
    expect(scss).toContain('transform: rotate(225deg)')
  })

  it('answers enter (250ms) and exit (150ms) with opacity/transform keyframes', () => {
    expect(scss).toContain('@keyframes event-faq-answer-enter')
    expect(scss).toContain('@keyframes event-faq-answer-exit')
    expect(scss).toMatch(/event-faq-answer-enter\s+0\.25s/)
    expect(scss).toMatch(/event-faq-answer-exit\s+0\.15s/)
  })

  it('never declares an infinite animation', () => {
    expect(scss).not.toMatch(/animation\s*:[^;]*infinite/i)
    expect(scss).not.toContain('animation-iteration-count')
  })

  it('renders fully static under reduced motion (JS modifier + media query)', () => {
    expect(tsx).toContain('getSystemReducedMotion()')
    expect(tsx).toContain("'event-faq-accordion--rm'")
    expect(scss).toMatch(/&--rm\s*\{[\s\S]*?animation:\s*none/)
    expect(scss).toContain('@media (prefers-reduced-motion: reduce)')
    // Reduced-motion path swaps instantly with no timers.
    const rmBranch = tsx.slice(tsx.indexOf('if (reduceMotion)'))
    expect(rmBranch.slice(0, rmBranch.indexOf('return')).length).toBeGreaterThan(0)
    expect(rmBranch.slice(0, rmBranch.indexOf('return'))).not.toContain('setTimeout')
  })
})

describe('EventFaqAccordion one-open-at-a-time state machine', () => {
  it('tracks a single open target (no multi-open array/set state)', () => {
    expect(tsx).toContain("useState<string | null>(null)")
    // openId is the logical single-open driver — never an array.
    expect(tsx).not.toMatch(/openIds|openItems|openSet/)
    expect(tsx).toContain('const [openId, setOpenId]')
    expect(tsx).toContain('const [visibleId, setVisibleId]')
    expect(tsx).toContain('exitTimerRef')
  })

  it('mounts at most one answer block (conditional render on the visible id)', () => {
    expect(tsx).toContain('{isMounted ? (')
    expect(tsx).toContain('const isMounted = visibleId === item.id')
    // The exit modifier replays opacity→0 before unmount; answers never stack.
    expect(tsx).toContain("' event-faq-accordion__item--open'")
    expect(tsx).toContain('event-faq-accordion__answer--exit')
  })

  it('fires haptics on tap and keeps the Q row touch target ≥88rpx', () => {
    expect(tsx).toContain("haptics('light')")
    expect(scss).toContain('min-height: 88rpx')
    expect(tsx).toContain("hoverClass='event-faq-accordion__row--pressed'")
  })
})
