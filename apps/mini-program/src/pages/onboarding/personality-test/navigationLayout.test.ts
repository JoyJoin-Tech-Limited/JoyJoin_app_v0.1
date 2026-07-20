// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const questionSource = readFileSync(new URL('./PersonalityTestQuestion.tsx', import.meta.url), 'utf8')
const styleSource = readFileSync(new URL('./index.scss', import.meta.url), 'utf8')

describe('personality test navigation layout', () => {
  it('keeps the previous button visible and disabled instead of using a hidden placeholder', () => {
    expect(questionSource).toContain('!canGoPrevious || isNavLocked')
    expect(questionSource).toContain('disabled={isNavLocked || !canGoPrevious}')
    expect(questionSource).not.toContain('personality-test__nav-btn--placeholder')
    expect(styleSource).not.toContain('&--placeholder')
  })

  it('uses equal-width primary navigation buttons and separates the change-question row', () => {
    expect(styleSource).toContain('flex: 1 1 0;')
    expect(styleSource).toContain('gap: 20rpx;')
    expect(styleSource).toContain('padding: 0 $container-padding 20rpx;')
    expect(styleSource).toContain('padding: 16rpx $container-padding 28rpx;')
  })
})
