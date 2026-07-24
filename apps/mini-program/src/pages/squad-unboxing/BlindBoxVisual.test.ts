// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const visualSource = readFileSync(new URL('./BlindBoxVisual.tsx', import.meta.url), 'utf8')
const styleSource = readFileSync(new URL('./index.scss', import.meta.url), 'utf8')

describe('squad-unboxing blind-box opening sequence', () => {
  it('keeps member cards hidden until the real deck fan is rendered', () => {
    expect(visualSource).not.toContain('blind-box-stack')
    expect(visualSource).not.toContain('BrandLogo')
    expect(styleSource).not.toContain('squad-unboxing-stack-rise')
  })

  it('keeps the lid optically raised through closed and opening poses', () => {
    expect(styleSource).toContain('transform: translate3d(-50%, -16rpx, 0);')
    expect(styleSource).toContain('transform: translate3d(-50%, -120rpx, 0) rotate(-12deg);')
    expect(styleSource).toContain('transform: translate3d(-50%, -106rpx, 0) rotate(-10deg);')
  })
})
