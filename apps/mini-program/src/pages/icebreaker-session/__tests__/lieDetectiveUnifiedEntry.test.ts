import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const phaseFile = path.resolve(__dirname, '../phases/LieDetectiveHeroView.tsx')
const phaseStyles = path.resolve(__dirname, '../phases/LieDetectiveHeroView.scss')

describe('Lie Detective unified entry', () => {
  it('uses one three-sentence editor with per-row label generation', () => {
    const source = fs.readFileSync(phaseFile, 'utf8')

    expect(source).toContain("placeholder='可以试试标签生成'")
    expect(source).toContain("placeholder='输入标签（e.g. 旅游）'")
    expect(source).toContain('标签生成')
    expect(source).toContain('请换一个 20 字以内的友好标签')
    expect(source).not.toContain('V1 自填三句话')
    expect(source).not.toContain('V2 标签生成')
    expect(source).not.toContain('onSubmitTags')
  })

  it('keeps the label helper and sentence editor inside a bounded row layout', () => {
    const styles = fs.readFileSync(phaseStyles, 'utf8')

    expect(styles).toContain('&__assist-row')
    expect(styles).toContain('min-width: 0')
    expect(styles).toContain('flex: 1')
    expect(styles).toContain('min-height: 88rpx')
  })
})
