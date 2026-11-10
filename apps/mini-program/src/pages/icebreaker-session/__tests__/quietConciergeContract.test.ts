import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../../../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('Quiet Concierge — guidance and host brief wiring', () => {
  it('uses one guidance line and removes duplicate teaching', () => {
    const pageSource = read('apps/mini-program/src/pages/icebreaker-session/index.tsx')
    expect(pageSource).toContain('suppressGuidance={!!sessionGuidanceLine}')
    expect(pageSource).toContain('suppressWarmupPermissionLine: !!sessionGuidanceLine')
    expect(pageSource).toContain('if (sessionGuidanceLine) {')
    expect(pageSource).toContain("setPhaseToast({ visible: false, text: '' })")
    expect(pageSource).toContain('{coachmarkVisible && (')
    expect(pageSource).toContain('!sessionGuidanceLine')
  })

  it('shares one high-priority gate across Agent Ask, adaptive suggestion, and HostBrief', () => {
    const pageSource = read('apps/mini-program/src/pages/icebreaker-session/index.tsx')
    const shellLogicSource = read('apps/mini-program/src/pages/icebreaker-session/sessionShellLogic.ts')
    const highPriorityGate = pageSource.match(
      /const highPriorityOverlayVisible =([\s\S]*?)\n\s*const agentAskOverlayVisible =/,
    )?.[1] ?? ''

    for (const state of [
      'showPhaseIntro',
      'warmupRitualActive',
      'isTierSheetOpen',
      'hostMenuOpen',
      '!!pendingTierSwitch',
    ]) {
      expect(highPriorityGate).toContain(state)
    }
    expect(pageSource).toMatch(
      /const agentAskOverlayVisible =\s*xiaoyueAgentAsk\.visible &&\s*!!xiaoyueAgentAsk\.view &&\s*!highPriorityOverlayVisible/,
    )
    expect(pageSource).toMatch(
      /const adaptiveOverlayVisible =\s*suggestionOverlayOpen &&\s*!!adaptiveSuggestion &&\s*!highPriorityOverlayVisible &&\s*!agentAskOverlayVisible/,
    )
    expect(pageSource).toContain('agentAskOverlayVisible && xiaoyueAgentAsk.view')
    expect(pageSource).toContain('adaptiveSuggestion={adaptiveOverlayVisible ? adaptiveSuggestion : undefined}')
    expect(pageSource).toContain('agentAskVisible: agentAskOverlayVisible')
    expect(pageSource).toContain('adaptiveSuggestionVisible: adaptiveOverlayVisible')
    expect(pageSource).toContain('highPriorityOverlayVisible,')
    expect(shellLogicSource).toContain('highPriorityOverlayVisible: boolean')
    expect(shellLogicSource).toContain('!input.highPriorityOverlayVisible')
  })

  it('uses one lifecycle-safe coachmark predicate for every higher-priority layer', () => {
    const pageSource = read('apps/mini-program/src/pages/icebreaker-session/index.tsx')
    const coachmarkPredicate = pageSource.match(
      /const coachmarkVisible =([\s\S]*?)\n\s*const hostBriefNode/,
    )?.[1] ?? ''

    for (const condition of [
      "phase === 'warmup'",
      'isHost',
      'coachmarkShown',
      '!highPriorityOverlayVisible',
      '!agentAskOverlayVisible',
      '!adaptiveOverlayVisible',
      '!hostBriefVisible',
      '!sessionGuidanceLine',
    ]) {
      expect(coachmarkPredicate).toContain(condition)
    }
    expect(pageSource).toContain('|| sessionGuidanceLine')
    expect(pageSource).toContain('[phase, isHost, coachmarkShown, sessionGuidanceLine]')
  })

  it('uses real warmup overlay state and stable callback for HostBrief', () => {
    const pageSource = read('apps/mini-program/src/pages/icebreaker-session/index.tsx')
    const warmupSource = read('apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx')
    const phaseViewsSource = read('apps/mini-program/src/pages/icebreaker-session/SessionPhaseViews.tsx')

    expect(pageSource).toContain('setHostMenuOpen(true)')
    expect(pageSource).toContain('setHostMenuOpen(false)')
    expect(pageSource).toContain('highPriorityOverlayVisible,')
    expect(pageSource).toContain('onWarmupOverlayVisibilityChange: handleWarmupOverlayVisibilityChange')
    expect(pageSource).toContain('handleWarmupOverlayVisibilityChange = useCallback')
    expect(warmupSource).toContain('overlayCallbackRef.current?.(ritualGateOpen || showCelebration)')
    expect(warmupSource).toContain('return () => overlayCallbackRef.current?.(false)')
    expect(phaseViewsSource).toContain('onOverlayVisibilityChange={props.onWarmupOverlayVisibilityChange}')
  })

  it('keeps every React hook above session loading/error early returns', () => {
    const pageSource = read('apps/mini-program/src/pages/icebreaker-session/index.tsx')
    const firstEarlyReturn = pageSource.indexOf('  if (sessionExpired) {')

    expect(firstEarlyReturn).toBeGreaterThan(0)
    expect(pageSource.slice(firstEarlyReturn)).not.toMatch(/const\s+\w+\s*=\s*use[A-Z]\w*\(/)
  })

  it('keeps the DTO phaseKey, not the removed revision', () => {
    const pageSource = read('apps/mini-program/src/pages/icebreaker-session/index.tsx')
    expect(pageSource).toContain('hostTableBrief?.phaseKey')
    expect(pageSource).not.toContain('hostTableBrief?.revision')
  })
})
