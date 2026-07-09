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
    expect(pageSource).toContain("onClick={flowState === 'ready' ? () => handleOpenBox('box') : undefined}")
    expect(pageSource).toContain('squad-unboxing__ribbon-wrap')
    expect(pageSource).toContain('DragRevealRibbon')
    expect(pageSource).toContain("onReveal={() => handleOpenBox('ribbon')}")
  })

  it('does not hide the interactive stage from assistive tech while the box is clickable', () => {
    expect(pageSource).toContain("aria-hidden={flowState === 'shaking' ? 'true' : undefined}")
    expect(pageSource).not.toContain("aria-hidden={flowState === 'ready' || flowState === 'shaking' ? 'true' : undefined}")
    expect(pageSource).toContain("role={flowState === 'ready' ? 'button' : undefined}")
    expect(pageSource).toContain("aria-label={flowState === 'ready' ? '点击拆开礼盒' : undefined}")
  })

  it('distinguishes box taps from ribbon reveals by calling handleOpenBox with explicit source', () => {
    expect(pageSource).toContain("onClick={flowState === 'ready' ? () => handleOpenBox('box') : undefined}")
    expect(pageSource).toContain("onReveal={() => handleOpenBox('ribbon')}")
  })
})
