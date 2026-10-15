import { describe, expect, it } from 'vitest'
import { archetypeRegistry } from '@shared/personality/archetypeRegistry'
import {
  deriveProfessionTraitTagGroups,
  MAX_ARCHETYPE_TRAIT_TAGS,
  MAX_IMPRESSION_TAGS,
  resolveArchetypeTraitTags,
  resolveImpressionTags,
} from '../professionTraitTags'

describe('professionTraitTags · 特质 chips (deterministic, AIGC-exempt)', () => {
  it('prefers server archetype traits, deduped and capped', () => {
    const tags = resolveArchetypeTraitTags([' 能量充沛 ', '能量充沛', '幽默感强', '善于调动气氛', '多出的第四条'], 'corgi')
    expect(tags).toEqual(['能量充沛', '幽默感强', '善于调动气氛'])
    expect(tags.length).toBeLessThanOrEqual(MAX_ARCHETYPE_TRAIT_TAGS)
  })

  it('falls back to the client registry when the server carries no traits', () => {
    const registryTraits = archetypeRegistry.corgi.narrative.traits
    expect(registryTraits.length).toBeGreaterThan(0)

    const tags = resolveArchetypeTraitTags([], 'corgi')
    expect(tags).toEqual(registryTraits.slice(0, MAX_ARCHETYPE_TRAIT_TAGS))
  })

  it('returns empty for unknown or missing archetypes (never fabricates)', () => {
    expect(resolveArchetypeTraitTags(null, 'not_a_real_archetype')).toEqual([])
    expect(resolveArchetypeTraitTags(undefined, null)).toEqual([])
    expect(resolveArchetypeTraitTags(undefined, undefined)).toEqual([])
  })

  it('does not need aiGenerated — registry content is label-exempt', () => {
    const groups = deriveProfessionTraitTagGroups({
      serverArchetypeTraits: ['能量充沛'],
      aiGenerated: false,
    })
    expect(groups.archetypeTraits).toEqual(['能量充沛'])
  })
})

describe('professionTraitTags · 印象 chips (AI, fail-closed)', () => {
  it('renders nothing unless meta.aigc.aiGenerated === true', () => {
    expect(resolveImpressionTags(['敏锐'], false, [])).toEqual([])
    expect(resolveImpressionTags(['敏锐'], undefined, [])).toEqual([])
    expect(resolveImpressionTags(null, true, [])).toEqual([])
  })

  it('drops tags that restate a visible ladder row label after normalization', () => {
    // 角色 row shows 「并购顾问」(niche fallback); the impression tag must not repeat it
    expect(resolveImpressionTags(['并购顾问', '逻辑清晰'], true, ['并购顾问'])).toEqual(['逻辑清晰'])
    // 细分 row 「前端开发」 ≈ tag 「前端工程师」 (AC-22 role-suffix normalization)
    expect(
      resolveImpressionTags(['前端工程师', '细节控'], true, ['科技互联网', '前端开发', '前端工程师']),
    ).toEqual(['细节控'])
  })

  it('returns empty when every tag duplicates a ladder row', () => {
    expect(resolveImpressionTags(['后端工程师', '软件开发'], true, ['软件开发', '后端工程师'])).toEqual([])
  })

  it('dedupes, trims and caps the list', () => {
    const tags = resolveImpressionTags([' 敏锐 ', '敏锐', '靠谱', '细心', '多出的第四条'], true, ['科技互联网'])
    expect(tags).toEqual(['敏锐', '靠谱', '细心'])
    expect(tags.length).toBeLessThanOrEqual(MAX_IMPRESSION_TAGS)
  })

  it('never crashes on empty ladder labels or tags that normalize to nothing', () => {
    expect(resolveImpressionTags(['工程师'], true, [])).toEqual([])
    expect(resolveImpressionTags(['敏锐'], true, [null as unknown as string])).toEqual(['敏锐'])
  })
})

describe('professionTraitTags · deriveProfessionTraitTagGroups', () => {
  it('derives both groups in one pass', () => {
    const groups = deriveProfessionTraitTagGroups({
      displayTags: ['并购顾问', '逻辑清晰'],
      serverArchetypeTraits: ['能量充沛'],
      userArchetype: 'corgi',
      aiGenerated: true,
      ladderRowLabels: ['金融服务', '并购顾问'],
    })

    expect(groups.archetypeTraits).toEqual(['能量充沛'])
    expect(groups.impressions).toEqual(['逻辑清晰'])
  })

  it('yields two empty groups when nothing is available (section hides itself)', () => {
    const groups = deriveProfessionTraitTagGroups({})
    expect(groups.archetypeTraits).toEqual([])
    expect(groups.impressions).toEqual([])
  })
})
