// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')

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
    expect(pageSource).toContain("aria-label={flowState === 'ready' && !isStageTap ? '轻点打开礼盒，查看今晚的同桌' : undefined}")
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
    expect(pageSource).toContain("aria-label='轻点打开礼盒，查看今晚的同桌'")
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

  it('keeps the legacy ready ribbon and copy card available only when the composed hero flag is off', () => {
    expect(pageSource).toContain("flowState === 'ready' && !composedHeroEnabled")
  })

  it('routes focused member explanations into the Xiaoyue dock without mounting a blank detail frame', () => {
    expect(pageSource).toContain('buildFocusedMemberBubbleText(')
    expect(pageSource).toContain('text={focusedMemberBubbleText || buildSquadSoulBubbleText(')
    expect(pageSource).not.toContain('squad-unboxing__detail-panel')
    expect(pageSource).not.toContain("import TeammateCardDetail from './TeammateCardDetail'")
  })
})
