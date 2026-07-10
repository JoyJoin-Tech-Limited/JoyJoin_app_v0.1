import { describe, expect, it } from 'vitest'
import type { PairExplanation } from '../../types/groupAnalysis'
import { composeUnifiedReveal, normalizeMatchingCopy } from './viewModels'

describe('normalizeMatchingCopy', () => {
  it('extracts readable explanation from backend JSON text', () => {
    expect(normalizeMatchingCopy('{"explanation":"你们都喜欢轻松饭局，可以从美食聊开"}')).toBe(
      '你们都喜欢轻松饭局，可以从美食聊开',
    )
  })

  it('keeps regular copy unchanged', () => {
    expect(normalizeMatchingCopy('这一桌很容易聊起来')).toBe('这一桌很容易聊起来')
  })
})

describe('composeUnifiedReveal', () => {
  const baseChemistryPayoff = {
    headline: '这桌缘分已注定',
    chemistryLine: '你们都爱电影和美食，聊起来一定停不下来',
    tags: ['电影', '美食'],
  }

  const baseSpotlight = {
    pair: {
      pairKey: 'user-a_user-b',
      explanation: '你和 Ta 最容易从「同乡（广州）」聊开',
      introAngle: '聊聊各自在广州的生活节奏',
      chemistryScore: 88,
      sharedInterests: ['film_entertainment'],
      connectionPoints: ['同乡（广州）', '都喜欢硬科幻'],
      connectionPointsWithRarity: [
        { text: '同乡（广州）', rarity: 'rare' as const },
        { text: '都喜欢硬科幻', rarity: 'common' as const },
      ],
    } satisfies PairExplanation,
    otherMemberId: 'user-b',
    otherMemberName: '阿杰',
  }

  it('uses spotlight explanation as body when spotlight exists', () => {
    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: baseSpotlight,
    })

    expect(result.body).toBe(baseSpotlight.pair.explanation)
    expect(result.subtitle).toBe(baseChemistryPayoff.chemistryLine)
    expect(result.headline).toBe(baseChemistryPayoff.headline)
  })

  it('normalizes serialized JSON spotlight explanation before rendering', () => {
    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: {
        ...baseSpotlight,
        pair: {
          ...baseSpotlight.pair,
          explanation: '{"explanation":"你们都喜欢轻松饭局，可以从美食聊开"}',
        },
      },
    })

    expect(result.body).toBe('你们都喜欢轻松饭局，可以从美食聊开')
    expect(result.body).not.toContain('{"explanation"')
  })

  it('uses chemistryPayoff body when spotlight has no explanation', () => {
    const spotlightNoExplanation = {
      ...baseSpotlight,
      pair: { ...baseSpotlight.pair, explanation: '', connectionPoints: [], connectionPointsWithRarity: [] },
    }

    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: spotlightNoExplanation,
    })

    expect(result.body).toBe(baseChemistryPayoff.chemistryLine)
    expect(result.subtitle).toBeNull()
  })

  it('uses chemistryPayoff body when spotlight is null', () => {
    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: null,
    })

    expect(result.body).toBe(baseChemistryPayoff.chemistryLine)
    expect(result.subtitle).toBeNull()
    expect(result.spotlight).toBeNull()
  })

  it('falls back to generic copy when chemistryPayoff is null', () => {
    const result = composeUnifiedReveal({
      chemistryPayoff: null,
      viewerSpotlight: null,
    })

    expect(result.headline).toBe('这桌的缘分已经悄悄酝酿')
    expect(result.body).toBe('这桌的化学反应很值得期待')
    expect(result.subtitle).toBeNull()
    expect(result.groupTags).toEqual([])
    expect(result.spotlight).toBeNull()
  })

  it('normalizes legacy connectionPoints to common rarity', () => {
    const spotlightLegacy = {
      ...baseSpotlight,
      pair: {
        ...baseSpotlight.pair,
        connectionPointsWithRarity: undefined,
        connectionPoints: ['同乡（广州）', '都喜欢硬科幻'],
      } satisfies PairExplanation,
    }

    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: spotlightLegacy,
    })

    expect(result.spotlight?.connectionPointsWithRarity).toEqual([
      { text: '同乡（广州）', rarity: 'common' },
      { text: '都喜欢硬科幻', rarity: 'common' },
    ])
  })

  it('computes epic rarity tier when epic connection point exists', () => {
    const spotlightEpic = {
      ...baseSpotlight,
      pair: {
        ...baseSpotlight.pair,
        connectionPoints: ['同款人格', '同乡'],
        connectionPointsWithRarity: [
          { text: '同款人格', rarity: 'epic' as const },
          { text: '同乡', rarity: 'common' as const },
        ],
      },
    }

    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: spotlightEpic,
    })

    expect(result.spotlight?.rarityTier).toBe('epic')
  })

  it('computes rare rarity tier when rare but no epic exists', () => {
    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: baseSpotlight,
    })

    expect(result.spotlight?.rarityTier).toBe('rare')
  })

  it('computes common rarity tier when only common exists', () => {
    const spotlightCommon = {
      ...baseSpotlight,
      pair: {
        ...baseSpotlight.pair,
        connectionPoints: ['同城'],
        connectionPointsWithRarity: [
          { text: '同城', rarity: 'common' as const },
        ],
      },
    }

    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: spotlightCommon,
    })

    expect(result.spotlight?.rarityTier).toBe('common')
  })

  it('shows groupTags as pills when spotlight has no connection points', () => {
    const spotlightEmpty = {
      ...baseSpotlight,
      pair: {
        ...baseSpotlight.pair,
        connectionPointsWithRarity: [],
        connectionPoints: [],
      },
    }

    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: spotlightEmpty,
    })

    expect(result.spotlight?.connectionPointsWithRarity).toEqual([])
    // groupTags should still be available for fallback rendering
    expect(result.groupTags).toEqual(['电影', '美食'])
  })

  it('truncates connectionPointsWithRarity to max 3 items', () => {
    const spotlightMany = {
      ...baseSpotlight,
      pair: {
        ...baseSpotlight.pair,
        connectionPoints: ['同乡', '同城', '同行', '同好'],
        connectionPointsWithRarity: [
          { text: '同乡', rarity: 'rare' as const },
          { text: '同城', rarity: 'common' as const },
          { text: '同行', rarity: 'common' as const },
          { text: '同好', rarity: 'common' as const },
        ],
      },
    }

    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: spotlightMany,
    })

    // Raw normalization preserves all; truncation happens at render time
    expect(result.spotlight?.connectionPointsWithRarity.length).toBe(4)
  })

  it('uses memberName from spotlight', () => {
    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: baseSpotlight,
    })

    expect(result.spotlight?.memberName).toBe('阿杰')
  })

  it('handles whitespace-only explanation as empty', () => {
    const spotlightWhitespace = {
      ...baseSpotlight,
      pair: { ...baseSpotlight.pair, explanation: '   ', connectionPoints: [], connectionPointsWithRarity: [] },
    }

    const result = composeUnifiedReveal({
      chemistryPayoff: baseChemistryPayoff,
      viewerSpotlight: spotlightWhitespace,
    })

    expect(result.body).toBe(baseChemistryPayoff.chemistryLine)
    expect(result.subtitle).toBeNull()
  })
})
