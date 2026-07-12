// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), 'XiaoyueHostImage.tsx')
const source = readFileSync(componentPath, 'utf8')

describe('XiaoyueHostImage ready hero asset fallback', () => {
  it('resolves CDN first, then a distinct local fallback, then a skeleton', () => {
    expect(source).toContain("cdnAsset(CDN_PATH)")
    expect(source).toContain("localAsset(FALLBACK_PATH)")
    expect(source).toContain("type SrcStage = 'cdn' | 'local' | 'skeleton'")
    expect(source).toContain("setStage('local')")
    expect(source).toContain("setStage('skeleton')")
  })

  it('tracks CDN fallback so hero reliability is observable', () => {
    expect(source).toContain("squad_unboxing_ready_hero_fallback")
    expect(source).toContain("reason: 'cdn_error'")
  })

  it('keeps the hero decorative so the stage tap layer owns interaction', () => {
    expect(source).not.toContain("role='button'")
    expect(source).not.toContain('onClick')
    expect(source).toContain("mode='aspectFit'")
    expect(source).toContain("aria-hidden='true'")
  })

  it('loads the above-the-fold hero eagerly (WeChat lazy-load is unreliable)', () => {
    expect(source).toContain('lazyLoad={false}')
    expect(source).not.toContain("lazyLoad={stage === 'cdn'}")
  })
})
