// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const hookPath = resolve(dirname(fileURLToPath(import.meta.url)), 'useSquadUnboxingController.ts')

describe('useSquadUnboxingController flowState derivation', () => {
  const source = readFileSync(hookPath, 'utf8')

  it('re-derives flowState when groupId changes', () => {
    expect(source).toContain('prevGroupIdRef')
    expect(source).toContain("prevGroupIdRef.current === groupId")
    expect(source).toContain("const nextFlow = readRevealFlag(groupId) ? 'revealed' : 'ready'")
    expect(source).toContain('setFlowState(nextFlow)')
  })

  it('tracks ready dwell and fires squad_unboxing_ready_dwell on box open (Batch A)', () => {
    expect(source).toContain('readyEnteredAtRef')
    expect(source).toContain('squad_unboxing_ready_dwell')
    expect(source).toContain('dwellMs')
  })

  it('holds the lid for 1000ms with a success haptic at the apex (Batch A)', () => {
    // Anticipation hold: 850 → 1000ms; success haptic at ~550ms lid apex
    // replaces the old end-of-shaking cardReveal+medium punch.
    expect(source).toContain('shouldReduceMotion ? 220 : 1000')
    expect(source).toContain("setTimeout(() => haptics('success'), shouldReduceMotion ? 150 : 550)")
    expect(source).not.toContain("haptics('cardReveal')")
  })

  it('runs the box→cards handoff overlay for 260ms, skipped on instant tiers (Batch B)', () => {
    // The opened box keeps rendering as a fixed overlay after flowState flips
    // to revealed so the dealt fan visually exits the box; reduce-motion and
    // degradation tiers (motionInstant) never mount it.
    expect(source).toContain('boxExiting')
    expect(source).toContain('setBoxExiting(true)')
    expect(source).toContain('setBoxExiting(false)')
    expect(source).toContain('if (!motionInstant)')
    expect(source).toContain('boxExiting,')
  })

  it('gates bubble + chapter entrance on dealSettled, true at cold re-entry (post-review fix)', () => {
    // First visit starts unsettled; the 团魂 bubble + 今晚这桌 chapter hold
    // until notifyDealSettled. Re-entry (reveal flag) starts settled.
    expect(source).toContain('readRevealFlag(groupId) : false')
    expect(source).toContain('setDealSettled(true)')
    expect(source).toContain('dealSettled,')
  })

  it('re-arms the ready-dwell clock on every page show while still ready (CONCERN-2)', () => {
    expect(source).toContain('useDidShow')
    expect(source).toContain("flowStateRef.current === 'ready'")
    expect(source).toContain('readyEnteredAtRef.current = Date.now()')
  })

  it('guards handleOpenBox so it only runs in ready state', () => {
    expect(source).toContain("if (flowState !== 'ready') return")
  })

  it('distinguishes box taps from ribbon reveals in analytics', () => {
    expect(source).toContain("(source: 'box' | 'ribbon' = 'box')")
    expect(source).toContain("if (source === 'box')")
    expect(source).toContain("squad_unboxing_box_tap")
  })

  it('reads the persisted reveal flag from storage', () => {
    expect(source).toContain('jj_revealed_${groupId}')
    expect(source).toContain('Taro.getStorageSync')
  })

  it('derives interactivity from the persisted reveal flag (first visit = face-down game)', () => {
    // First visit (no flag): interactive → cards land face-down and flips are
    // playable. Re-entry (flag present): all-up, zero unflipped, no hint chip.
    expect(source).toContain('setIsInteractiveSession(!readRevealFlag(groupId))')
    expect(source).toMatch(/isInteractiveSession\s*\?\s*computeUnflippedCount/)
  })
})

// Tap-to-reveal wiring (AC-13): flip state is controller-owned, focus stays
// page-owned. The pure flip session is injected with host timers + analytics
// and recreated per groupId; story mode seeds deterministic face-up sets.
describe('useSquadUnboxingController flip-state wiring (tap-to-reveal)', () => {
  const source = readFileSync(hookPath, 'utf8')

  it('creates one flip session per groupId with injectable timers + analytics', () => {
    expect(source).toContain('createSquadFlipSession')
    expect(source).toContain('flipSessionGroupRef')
    expect(source).toContain('flipSessionGroupRef.current !== groupId')
    expect(source).toContain('setTimer: (cb, ms) => setTimeout(cb, ms)')
    expect(source).toContain('squadUnboxingAnalytics.track')
  })

  it('subscribes to the session snapshot and destroys it on unmount', () => {
    expect(source).toContain('session.subscribe(')
    expect(source).toContain('flipSessionRef.current?.destroy()')
  })

  it('exposes flipOne / flipAll / isFlipInFlight / notifyDealSettled wrappers', () => {
    expect(source).toContain('flipSessionRef.current!.flipOne(id, method')
    expect(source).toContain('flipSessionRef.current!.flipAll(')
    expect(source).toContain('flipSessionRef.current!.isFlipInFlight()')
    expect(source).toContain('flipSessionRef.current!.notifyDealSettled({')
  })

  it('attaches roster index + best-partner meta to every flip for analytics', () => {
    expect(source).toContain('members.findIndex((member) => member.userId === id)')
    expect(source).toContain('isBestPartner: id === bestPartnerUserId')
  })

  it('computes the best partner in the controller (viewer pair chemistry, roster tie-break)', () => {
    expect(source).toContain('computeBestPartnerUserId(members, currentUserId, viewerPairByMemberId)')
  })

  it('does NOT persist flip state — mid-game cold re-entry renders all-up (REL-02)', () => {
    // Flip sets live entirely in the pure session module: no Taro storage
    // anywhere in squadFlipState.ts. Only the group reveal flag hits storage.
    const flipModule = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'squadFlipState.ts'),
      'utf8',
    )
    expect(flipModule).not.toContain('StorageSync')
    expect(flipModule).not.toContain("from '@tarojs/taro'")
    // Persisted keys are an exact allow-list of group-level flags — never
    // per-card flip state (REL-02). Pocket-the-deck (2026-07-15) added the
    // collapse flag + first-collapse hint flag alongside the reveal flag.
    const storageHits = source.match(/Taro\.setStorageSync\([^)]*\)/g) ?? []
    expect(storageHits).toHaveLength(3)
    expect(storageHits.some((hit) => hit.includes('getRevealFlagKey'))).toBe(true)
    expect(storageHits.some((hit) => hit.includes('getDeckCollapseKey'))).toBe(true)
    expect(storageHits.some((hit) => hit.includes('getDeckCollapseHintKey'))).toBe(true)
    expect(source).toContain('jj_revealed_${groupId}')
    // The deck key templates live in the pure module (locked here and in
    // squadDeckCollapseState.test.ts).
    const collapseModule = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'squadDeckCollapseState.ts'),
      'utf8',
    )
    expect(collapseModule).toContain('jj_deck_collapsed_${groupId}')
    expect(collapseModule).toContain('jj_deck_collapse_hint_${groupId}')
  })

  it('seeds story-mode face-up sets without analytics or timers', () => {
    expect(source).toContain("storyName === 'revealed-partial'")
    expect(source).toContain("storyName === 'revealed-allup'")
    expect(source).toContain("storyName === 'focused'")
    // Audit CONCERN-3: pocketed-phase story for H5 screenshot coverage.
    expect(source).toContain("storyName === 'revealed-pocketed'")
    expect(source).toContain('flipSessionRef.current?.seedFlipped(')
    const storyBlock = source.split('Story-mode seeding')[1]?.split('const groupThemeHighlights')[0] ?? ''
    expect(storyBlock).not.toContain('track(')
  })

  it('defers a collapse tap that lands inside the flip guard window (audit NIT-1)', () => {
    // The in-flight guard stays, but the tap is deferred one guard window
    // and re-entered through the latest-callback ref — never silently dropped.
    expect(source).toContain('flipSessionRef.current!.isFlipInFlight()')
    expect(source).toContain('FLIP_IN_FLIGHT_GUARD_MS')
    expect(source).toContain('collapseDeckRef.current()')
    expect(source).toContain('clearCollapseDeferTimer')
  })
})

// Auto-pocket handoff (2026-08-19, UX Strategy A): after the LIVE all-cards-up
// transition in an interactive session, the deck folds itself into the pill
// via the exact manual-collapse path so the revealed column regains the
// viewport. The scheduler semantics are runtime-tested in
// squadAutoPocket.test.ts; these assertions pin the controller wiring.
describe('useSquadUnboxingController auto-pocket handoff (2026-08-19)', () => {
  const source = readFileSync(hookPath, 'utf8')

  it('creates one auto-pocket session per groupId with injectable timers', () => {
    expect(source).toContain('createSquadAutoPocketSession')
    expect(source).toContain("from './squadAutoPocket'")
    expect(source).toContain('autoPocketGroupRef')
    expect(source).toContain('autoPocketRef.current?.destroy()')
  })

  it('arms ONLY on the live 1+ → 0 unflipped transition (never on re-entry, never twice)', () => {
    expect(source).toContain('prevAutoPocketUnflippedRef')
    expect(source).toContain('if (prev <= 0 || unflippedCount !== 0) return')
    expect(source).toContain('interactive: isInteractiveSession')
    expect(source).toContain('storyMode')
  })

  it('invokes the EXACT manual-collapse path and tracks squad_unboxing_auto_pocket once', () => {
    // The fold goes through collapseDeckRef so cascade / heartbeat glow /
    // spacer collapse / SR announcement / persisted flag are all identical
    // to a manual 收起卡组 collapse.
    expect(source).toContain('collapseDeckRef.current()')
    expect(source).toContain("squad_unboxing_auto_pocket")
  })

  it('re-probes fan phase, focus, and in-flight flips at fire time', () => {
    expect(source).toContain("deckPhaseRef.current === 'fan'")
    expect(source).toContain('focusedIndexRef.current < 0')
    expect(source).toContain('!flipSessionRef.current!.isFlipInFlight()')
  })

  it('cancels permanently on card focus and on the swipe-back reset signal', () => {
    expect(source).toContain('cancelPermanently()')
    expect(source).toContain('if (focusedIndex >= 0) autoPocketRef.current?.cancelPermanently()')
    expect(source).toContain('prevAutoPocketResetRef')
  })

  it('receives the page-owned focused index + reset signal as hook args', () => {
    expect(source).toContain('focusedIndex: number')
    expect(source).toContain('resetSignal: number')
    expect(source).toContain('{ groupId, routerParams, focusedIndex, resetSignal }')
  })
})
