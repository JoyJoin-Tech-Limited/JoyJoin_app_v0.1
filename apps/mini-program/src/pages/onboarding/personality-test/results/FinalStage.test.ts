import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getArchetypeSkills, type ArchetypeSkillSet } from '@shared/personality/archetypeSkills'
import {
  getPosterCtaState,
  getRenderableSkillSet,
  shouldShowXiaoyueUnavailableNotice,
} from './FinalStage'

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
          headline: '这个气场为什么像你',
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

describe('FinalStage poster CTA', () => {
  it('labels an uncached tap as generation', () => {
    expect(getPosterCtaState({
      isGeneratingPoster: false,
      generationPhase: '',
      hasCachedPoster: false,
    })).toEqual({
      label: '生成我的氛围卡',
      disabled: false,
      loading: false,
    })
  })

  it('labels a cached-poster tap as opening the existing share options', () => {
    expect(getPosterCtaState({
      isGeneratingPoster: false,
      generationPhase: '',
      hasCachedPoster: true,
    })).toEqual({
      label: '打开分享选项',
      disabled: false,
      loading: false,
    })
  })

  it('exposes the real generation phase and blocks duplicate taps while rendering', () => {
    expect(getPosterCtaState({
      isGeneratingPoster: true,
      generationPhase: '准备素材中…',
      hasCachedPoster: false,
    })).toEqual({
      label: '准备素材中…',
      disabled: true,
      loading: true,
    })
    expect(getPosterCtaState({
      isGeneratingPoster: true,
      generationPhase: '',
      hasCachedPoster: true,
    }).label).toBe('正在渲染卡面…')
  })
})

describe('FinalStage skill truthfulness', () => {
  it('omits absent and structurally empty skill sets', () => {
    const emptySkills = {
      activeSkill: { name: ' ', shortEffect: '' },
      passiveSkill: { name: '', shortEffect: ' ' },
    } as unknown as ArchetypeSkillSet

    expect(getRenderableSkillSet(undefined)).toBeUndefined()
    expect(getRenderableSkillSet(null)).toBeUndefined()
    expect(getRenderableSkillSet({} as ArchetypeSkillSet)).toBeUndefined()
    expect(getRenderableSkillSet(emptySkills)).toBeUndefined()
  })

  it('returns genuine canonical skills unchanged', () => {
    const genuineSkills = getArchetypeSkills('koala')

    expect(genuineSkills).toBeDefined()
    expect(getRenderableSkillSet(genuineSkills)).toBe(genuineSkills)
  })

  it('contains no generic result-like skill substitutions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/onboarding/personality-test/results/FinalStage.tsx'), 'utf8')

    expect(source).not.toMatch(/瞬间点亮全场|三句话内让冷场变暖场|气场持续发光|不用刻意表现，自然让人想靠近/)
  })
})

describe('FinalStage referral copy boundary', () => {
  it('contains no personality-test coupon or reward promise prop or UI', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/onboarding/personality-test/results/FinalStage.tsx'), 'utf8')

    expect(source).not.toMatch(/shareRewardHint|getResultShareRewardHint|RESULT_SHARE_REWARD_HINT|多一张券/)
  })
})
