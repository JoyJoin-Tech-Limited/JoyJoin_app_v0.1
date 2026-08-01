import { describe, expect, it } from 'vitest'
import { shouldShowXiaoyueUnavailableNotice } from './FinalStage'

describe('FinalStage Xiaoyue fallback notice', () => {
  it('does not show unavailable notice when static interpretation copy is available', () => {
    expect(
      shouldShowXiaoyueUnavailableNotice({
        xiaoyueAnalysis: null,
        summary: '你带来的稳定感很强，很多人会因为你在而更安心。',
        hiddenStrength: '你的存在本身就给人安全感，这是领导力的核心要素。',
      }),
    ).toBe(false)
  })

  it('does not show unavailable notice when remote Xiaoyue analysis is available', () => {
    expect(
      shouldShowXiaoyueUnavailableNotice({
        xiaoyueAnalysis: {
          headline: '这个命格为什么像你',
          analysis: '你带来的稳定感很强。',
          socialRole: '',
          bestScene: '',
          microAction: '',
          expressionTags: [],
          whyThisFits: '',
          blendLine: '',
        },
        summary: '',
        hiddenStrength: '',
      }),
    ).toBe(false)
  })

  it('keeps the unavailable notice only when no interpretation copy exists', () => {
    expect(
      shouldShowXiaoyueUnavailableNotice({
        xiaoyueAnalysis: null,
        summary: ' ',
        hiddenStrength: '',
      }),
    ).toBe(true)
  })
})
