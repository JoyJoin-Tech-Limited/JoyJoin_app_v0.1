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
  })

  it('uses real warmup overlay state and stable callback for HostBrief', () => {
    const pageSource = read('apps/mini-program/src/pages/icebreaker-session/index.tsx')
    const warmupSource = read('apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx')
    const phaseViewsSource = read('apps/mini-program/src/pages/icebreaker-session/SessionPhaseViews.tsx')

    expect(pageSource).toContain('setHostMenuOpen(true)')
    expect(pageSource).toContain('setHostMenuOpen(false)')
    expect(pageSource).toContain('ritualOverlayVisible: showPhaseIntro || warmupRitualActive')
    expect(pageSource).toContain('onWarmupOverlayVisibilityChange: handleWarmupOverlayVisibilityChange')
    expect(pageSource).toContain('handleWarmupOverlayVisibilityChange = useCallback')
    expect(warmupSource).toContain('overlayCallbackRef.current?.(ritualGateOpen || showCelebration)')
    expect(warmupSource).toContain('return () => overlayCallbackRef.current?.(false)')
    expect(phaseViewsSource).toContain('onOverlayVisibilityChange={props.onWarmupOverlayVisibilityChange}')
  })

  it('keeps the DTO phaseKey, not the removed revision', () => {
    const pageSource = read('apps/mini-program/src/pages/icebreaker-session/index.tsx')
    expect(pageSource).toContain('hostTableBrief?.phaseKey')
    expect(pageSource).not.toContain('hostTableBrief?.revision')
  })
})
