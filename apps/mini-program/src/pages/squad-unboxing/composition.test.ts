// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')
const bubbleSource = readFileSync(new URL('./SquadUnboxingAnalysisBubble.tsx', import.meta.url), 'utf8')
const panelSource = readFileSync(new URL('./SquadUnboxingTonightsPanel.tsx', import.meta.url), 'utf8')

describe('squad-unboxing page composition', () => {
  it('delegates orchestration to useSquadUnboxingController', () => {
    expect(pageSource).toContain("from './useSquadUnboxingController'")
    expect(pageSource).toContain('useSquadUnboxingController(')
    expect(pageSource).not.toContain('useQuery<PoolGroupDetailsResponse>')
  })

  it('keeps the reveal gesture and box click as two parallel entry points', () => {
    expect(pageSource).toContain('squad-unboxing__stage-body--ready')
    expect(pageSource).toContain("onClick={flowState === 'ready' && !isStageTap ? () => handleOpenBox('box') : undefined}")
    expect(pageSource).toContain('squad-unboxing__ribbon-wrap')
    expect(pageSource).toContain('DragRevealRibbon')
    expect(pageSource).toContain("onReveal={() => handleOpenBox('ribbon')}")
  })

  it('does not hide the interactive stage from assistive tech while the box is clickable', () => {
    expect(pageSource).toContain("aria-hidden={flowState === 'shaking' ? 'true' : undefined}")
    expect(pageSource).not.toContain("aria-hidden={flowState === 'ready' || flowState === 'shaking' ? 'true' : undefined}")
    expect(pageSource).toContain("role={flowState === 'ready' && !isStageTap ? 'button' : undefined}")
    expect(pageSource).toContain("aria-label={flowState === 'ready' && !isStageTap ? openBoxAriaLabel : undefined}")
  })

  it('distinguishes box taps from ribbon reveals by calling handleOpenBox with explicit source', () => {
    expect(pageSource).toContain("onClick={flowState === 'ready' && !isStageTap ? () => handleOpenBox('box') : undefined}")
    expect(pageSource).toContain("onReveal={() => handleOpenBox('ribbon')}")
  })

  it('makes the whole stage (host + box) one tap target in composed mode', () => {
    expect(pageSource).toContain("const isStageTap = composedHeroEnabled && flowState === 'ready'")
    expect(pageSource).toContain('squad-unboxing__stage-tap-layer')
    expect(pageSource).toContain("hoverClass='squad-unboxing__stage-tap-layer--pressed'")
    expect(pageSource).toContain("role='button'")
    expect(pageSource).toContain('aria-label={openBoxAriaLabel}')
    // The stage body drops its own handlers in composed mode to avoid double-firing.
    expect(pageSource).toContain("isStageTap ? 'squad-unboxing__stage-body--tap-target' : ''")
  })

  it('gates the composed hero redesign behind socialSquadComposedHeroEnabled', () => {
    expect(pageSource).toContain('socialSquadComposedHeroEnabled')
    expect(pageSource).toContain('isComposedHeroActive')
    expect(pageSource).toContain('XiaoyueHostImage')
    expect(pageSource).toContain('squad-unboxing__hero-gesture')
    expect(pageSource).toContain('盒子里的，是今晚的同桌')
    expect(pageSource).toContain('轻点打开')
  })

  it('keeps the legacy ready ribbon available only when the composed hero flag is off', () => {
    expect(pageSource).toContain("flowState === 'ready' && !composedHeroEnabled")
  })

  it('ships the Batch A ready state: no copy cards, ready-only header, count tease', () => {
    // 「拼图已经聚齐」/「盒子正在打开…」 copy cards deleted (2026-07-24) —
    // the gift box is the sole focal point; shaking stays purely visual.
    expect(pageSource).not.toContain('拼图已经聚齐')
    expect(pageSource).not.toContain('squad-unboxing__blind-box-card')
    expect(pageSource).not.toContain('盒子正在打开')
    expect(pageSource).toContain("const header = flowState === 'ready'")
    // Eyebrow count tease + count-bearing aria label for screen readers.
    expect(pageSource).toContain('位同桌')
    expect(pageSource).toContain('squad-unboxing__header-eyebrow')
  })

  it('ships the Batch B motion layer: ribbon stagger class + box-exit overlay', () => {
    expect(pageSource).toContain('squad-unboxing__ribbon-wrap--ready')
    expect(pageSource).toContain('squad-unboxing__box-exit')
    expect(pageSource).toContain("BlindBoxVisual state='open'")
    expect(pageSource).toContain('boxExiting')
  })

  it('holds the bubble + chapter entrance until the deal settles (post-review fix)', () => {
    // No empty white slab during the handoff; logistics never render before
    // people. The composed hero gets the taller box-exit geometry.
    // Bubble + chapter extracted into sub-components; the gating logic lives there.
    expect(bubbleSource).toContain("headerReady && dealSettled ? 'squad-unboxing__analysis-bubble-inner--ready' : ''")
    expect(panelSource).toContain("headerReady && dealSettled ? 'squad-unboxing__chapter--ready' : ''")
    expect(bubbleSource).toContain("key={dealSettled ? 'settled' : 'pending'}")
    expect(pageSource).toContain('squad-unboxing__box-exit--composed')
    expect(pageSource).toContain("if (flowState !== 'revealed' || !dealSettled) return")
  })

  it('gates the reveal-all chip until the deal settles (PM polish — no dead control mid-deal)', () => {
    expect(pageSource).toContain("isInteractiveSession && unflippedCount > 0 && deckPhase === 'fan' && dealSettled")
  })

  it('debuts the transition line + 桌卡 only after the deck leaves the fan phase (2026-08-19 auto-pocket)', () => {
    // Inside the locked fan-phase column they rendered clipped (~830-900rpx
    // of content vs a ~563rpx budget). They now mount once the deck folds
    // (auto-pocket handoff or manual collapse) — a revisit starts pocketed
    // so the gate passes there too.
    expect(pageSource).toContain("allCardsUp && deckPhase !== 'fan' ? (")
    expect(pageSource).toContain("allCardsUp && deckPhase !== 'fan' && members.length > 0 ? (")
  })

  it('routes focused member explanations into the Xiaoyue dock without mounting a blank detail frame', () => {
    expect(pageSource).toContain('buildFocusedMemberBubbleText(')
    expect(pageSource).toContain('buildSquadSoulBubbleText(')
    expect(pageSource).not.toContain('squad-unboxing__detail-panel')
    expect(pageSource).not.toContain("import TeammateCardDetail from './TeammateCardDetail'")
  })

  it('types each member narration once and lets a second tap fast-forward it', () => {
    expect(pageSource).toContain('seenMemberNarrationsRef')
    expect(pageSource).toContain('resolveCardFocusInteraction(')
    // Member narration types fully (tap fast-forwards); burst/tease/soul are
    // capped at 3s. Gated on the bubble KIND, not focusedMember — a pending
    // flip keeps a focused card while the tease line shows.
    expect(bubbleSource).toContain("maxDuration={bubbleNarration?.kind === 'member' ? undefined : 3000}")
    expect(pageSource).toContain("trackCardFocus(index, current, 'narration_fast_forward')")
  })

  it('restores reveal-all directly above the attendance action', () => {
    expect(pageSource).toContain('squad-unboxing__reveal-chip')
    expect(pageSource).toContain('buildRevealChipLabel(unflippedCount)')
    expect(pageSource).toContain('onClick={handleRevealAll}')
    expect(pageSource.indexOf('squad-unboxing__reveal-chip')).toBeLessThan(pageSource.indexOf('squad-unboxing__confirm-btn'))
    expect(pageSource).toContain('squad-unboxing__confirm-btn')
  })

  it('makes the bubble the voice of the reveal (status + aria-live + sr-only full text, AC-18)', () => {
    expect(bubbleSource).toContain("role='status'")
    expect(bubbleSource).toContain("aria-live='polite'")
    expect(bubbleSource).toContain("aria-atomic='true'")
    expect(bubbleSource).toContain("squad-unboxing__sr-only")
    // The animated TypewriterText visual is aria-hidden so screen readers
    // announce the complete narration once, not per-character typing.
    expect(bubbleSource).toContain("<View aria-hidden='true'>")
    expect(bubbleSource).toContain('<Text className=\'squad-unboxing__sr-only\'>{bubbleText}</Text>')
  })

  it('selects narration by session state: burst completion → self card → member → soul fallback', () => {
    expect(pageSource).toContain('SQUAD_BURST_COMPLETION_BUBBLE_TEXT')
    expect(pageSource).toContain('SQUAD_SELF_CARD_BUBBLE_TEXT')
    expect(pageSource).toContain("bubbleNarration?.kind === 'burst'")
    expect(pageSource).toContain("bubbleNarration?.kind === 'member'")
  })

  it('rests on the tease pool while face-down cards remain (C1 + C11–C13) — the soul line is earned', () => {
    // 2026-10-14 (tease V2): the resting voice is the controller-owned tease
    // pool (gold claim → progress beats → 配置悬念 → base), not the static
    // instruction constant — the pool's fallback tier still ships that line
    // (locked in squadUnboxingViewModels.test.ts).
    expect(pageSource).toContain('tease.text')
    expect(pageSource).toContain('SQUAD_TEASE_POCKETED_BUBBLE_TEXT')
    // The tease branch sits strictly after narration and strictly before the
    // soul fallback: burst/member narration always wins, the soul line only
    // shows when every card is face-up (or the session is a re-entry).
    const narrationIdx = pageSource.indexOf("bubbleNarration?.kind === 'burst'")
    const teaseIdx = pageSource.indexOf('isInteractiveSession && unflippedCount > 0')
    const soulIdx = pageSource.indexOf('buildSquadSoulBubbleText(')
    expect(narrationIdx).toBeGreaterThanOrEqual(0)
    expect(teaseIdx).toBeGreaterThan(narrationIdx)
    expect(soulIdx).toBeGreaterThan(teaseIdx)
  })

  it('emits card_detail_dismiss only via the resolver dismiss action (upstream-reinstated, AC-19 superseded)', () => {
    // The dismiss event fires exactly once in source — inside the resolver's
    // 'dismiss' branch — never from the flip path or the burst path.
    expect(pageSource).toContain("resolution.action === 'dismiss'")
    expect(pageSource.indexOf('squad_unboxing_card_detail_dismiss')).toBeGreaterThanOrEqual(0)
    expect(pageSource.indexOf('squad_unboxing_card_detail_dismiss')).toBe(pageSource.lastIndexOf('squad_unboxing_card_detail_dismiss'))
  })
})

// ─── Landing beat (2026-11-11) ───────────────────────────────────────
// The sealed card's press is the transition. Two invariants follow, and both
// are structural (state-init + stylesheet order), so they are locked here
// rather than left to a render nobody takes a screenshot of:
//   1. `from=card` paints composed — no staged entrance may play after mount.
//   2. The arrival beat is a one-shot that hands off to the idle float at the
//      float's own 0% frame, and it can never outrank the open animation.
const scssSource = readFileSync(new URL('./index.scss', import.meta.url), 'utf8')
const visualSource = readFileSync(new URL('./BlindBoxVisual.tsx', import.meta.url), 'utf8')
const lidSource = readFileSync(new URL('./BlindBoxLid.tsx', import.meta.url), 'utf8')
const constantsSource = readFileSync(new URL('./squadUnboxingConstants.ts', import.meta.url), 'utf8')

describe('squad-unboxing card-entry landing beat', () => {
  it('initialises the header as ready when the page was opened from the card', () => {
    // `useState(false)` (the pre-2026-11-11 init) replays the 280ms staged
    // entrance on card entry, which re-announces "new page" and breaks the act.
    expect(pageSource).toContain('const [headerReady, setHeaderReady] = useState(entryFromCard)')
    expect(pageSource).not.toContain('const [headerReady, setHeaderReady] = useState(false)')
    // The first-show branch of useDidShow must not reset it back to hidden.
    expect(pageSource).toContain('setHeaderReady(entryFromCard)')
  })

  it('times the beat from the shared constants and clears it in the same effect', () => {
    expect(pageSource).toContain('const [entryLanding, setEntryLanding] = useState(entryFromCard)')
    expect(pageSource).toContain('setEntryLanding(false)')
    expect(pageSource).toContain('LANDING_BEAT_MS')
    expect(pageSource).toContain('LANDING_HAPTIC_MS')
    expect(constantsSource).toContain('export const LANDING_BEAT_MS = 520')
    expect(constantsSource).toContain('export const LANDING_HAPTIC_MS = 380')
    // Reduced motion, low-end devices and a fast open all drop the beat instead
    // of shortening it — the guard must name every one of them.
    expect(pageSource).toMatch(
      /if \(flowState !== 'ready' \|\| shouldReduceMotion \|\| isDegradation\) \{\s*setEntryLanding\(false\)\s*return\s*\}/,
    )
    // flowState has to be a dependency, otherwise the effect never re-runs when
    // the user opens the box before the beat finishes.
    expect(pageSource).toMatch(/\}, \[entryFromCard, flowState, shouldReduceMotion, isDegradation\]\)/)
  })

  it('hands the beat to both box layers, and only on the ready stage', () => {
    expect(visualSource).toContain('entryLanding?: boolean')
    expect(visualSource).toContain("'squad-unboxing__blind-box-visual--landing'")
    expect(lidSource).toContain('entryLanding?: boolean')
    expect(lidSource).toContain("'squad-unboxing__blind-box-lid--landing'")
    expect(pageSource).toContain('entryLanding={entryLanding}')
    expect(pageSource.indexOf('entryLanding={entryLanding}')).not.toBe(pageSource.lastIndexOf('entryLanding={entryLanding}'))
  })

  it('keeps the landing rules after --ready but before the open rules', () => {
    // Specificity ties are broken by source order. `--landing` must beat the
    // `--ready` float and lose to `--opening`, or a fast tap freezes the box.
    const visualStart = scssSource.indexOf('&__blind-box-visual {')
    const lidStart = scssSource.indexOf('&__blind-box-lid {')
    expect(visualStart).toBeGreaterThanOrEqual(0)
    expect(lidStart).toBeGreaterThan(visualStart)

    const visualBlock = scssSource.slice(visualStart, lidStart)
    const visualReady = visualBlock.indexOf('&--ready')
    const visualLanding = visualBlock.indexOf('&--landing')
    expect(visualReady).toBeGreaterThanOrEqual(0)
    expect(visualLanding).toBeGreaterThan(visualReady)
    // The open rules for the visual live further down the file, so they win
    // the tie against the nested --landing block above them.
    expect(scssSource.indexOf('&__blind-box-visual--opening')).toBeGreaterThan(visualLanding)

    const lidBlock = scssSource.slice(lidStart)
    const lidLanding = lidBlock.indexOf('&--landing')
    const lidOpening = lidBlock.indexOf('&--opening,')
    expect(lidLanding).toBeGreaterThanOrEqual(0)
    expect(lidOpening).toBeGreaterThan(lidLanding)
  })

  it('resumes the idle float at exactly the moment the class is stripped', () => {
    // The float delay is the handoff point: strip the class at 520ms and the
    // float restarts at its own 0% keyframe, so nothing snaps sideways or up.
    const delays = Array.from(
      scssSource.matchAll(/squad-unboxing-float 3\.2s ease-in-out (\d+)ms infinite/g),
      (match) => Number(match[1]),
    )
    expect(delays.length).toBeGreaterThanOrEqual(2)
    expect(new Set(delays)).toEqual(new Set([520]))
    expect(scssSource).toContain('@keyframes squad-unboxing-box-land')
    expect(scssSource).toContain('@keyframes squad-unboxing-lid-settle')
    // The arrival moves only — a fade would read as "the page loaded".
    const boxLand = scssSource.slice(scssSource.indexOf('@keyframes squad-unboxing-box-land'))
    expect(boxLand.slice(0, 400)).not.toContain('opacity')
  })
})
