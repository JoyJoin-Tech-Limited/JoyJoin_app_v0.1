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

  it('rests on the tease line while face-down cards remain (C1) — the soul line is earned', () => {
    expect(pageSource).toContain('SQUAD_TEASE_BUBBLE_TEXT')
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
