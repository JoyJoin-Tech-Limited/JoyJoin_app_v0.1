import { describe, expect, it } from 'vitest'
import { ARCHETYPE_CANONICAL_ORDER } from '@shared/personality/archetypeNames'
import {
  ARCHETYPE_SUBLINES,
  EXPERIENCE_DETAIL_COPY,
  FLOW1_ENTRY_COPY,
  FLOW2_FALLBACKS,
  FLOW2_NODE_COPY,
  FLOW_SHELL_COPY,
  getArchetypeSubline,
  getFlow1H1Line2,
  getFlow2HeroMeta,
  getFlow2HeroStatus,
  getIdentityChipLabel,
  resolveFlow2NodeDescription,
} from '@shared/copy/flowAnimationCopy'
import { DEFAULT_EVENT_GROUP_SIZE } from '@shared/constants'
import { buildLifecycleSteps } from './flowAnimation.config'

describe('flow-animation copy binding', () => {
  it('binds the 4–6 numeral to the platform group-size defaults (never hardcoded)', () => {
    expect(DEFAULT_EVENT_GROUP_SIZE).toEqual({ min: 4, max: 6 })
    expect(getFlow1H1Line2()).toBe('4–6人的同城小局')
    // The en-dash (U+2013) must sit between the numerals so the unit never breaks.
    expect(getFlow1H1Line2()).toContain('4–6')
  })

  it('covers all 12 canonical archetypes with sub-lines plus a fallback', () => {
    for (const id of ARCHETYPE_CANONICAL_ORDER) {
      expect(ARCHETYPE_SUBLINES[id], `missing sub-line for ${id}`).toBeTruthy()
      expect(ARCHETYPE_SUBLINES[id].length).toBeLessThanOrEqual(20)
    }
    expect(getArchetypeSubline('corgi')).toBe(ARCHETYPE_SUBLINES.corgi)
    expect(getArchetypeSubline('not-an-archetype')).not.toBe(ARCHETYPE_SUBLINES.corgi)
    expect(getArchetypeSubline(null)).toBeTruthy()
    expect(getArchetypeSubline(undefined)).toBeTruthy()
  })

  it('keeps the street banner invitation-framed (no availability promises)', () => {
    const streetLine = '一条线索引路，把城市走成故事'
    expect(streetLine).not.toContain('此刻')
    expect(streetLine).not.toContain('今天')
    expect(streetLine).not.toContain('马上')
  })

  it('resolves Flow 2 hero templates with real facts and designed fallbacks', () => {
    expect(getFlow2HeroStatus({ title: '周五火锅局' })).toBe('你的周五火锅局，正在一步步成形')
    expect(getFlow2HeroStatus(null)).toBe(`你的${FLOW2_FALLBACKS.heroTitle}，正在一步步成形`)
    expect(getFlow2HeroStatus({ title: '  ' })).toBe(`你的${FLOW2_FALLBACKS.heroTitle}，正在一步步成形`)

    expect(getFlow2HeroMeta({ dateLabel: '明天 · 周六 19:00', district: '福田区', typeLabel: '饭局' }))
      .toBe('明天 · 周六 19:00 · 福田区 · 饭局')
    expect(getFlow2HeroMeta({})).toBe(
      `${FLOW2_FALLBACKS.metaDate} · ${FLOW2_FALLBACKS.metaDistrict} · ${FLOW2_FALLBACKS.metaType}`,
    )
  })

  it('interpolates node descriptions with facts and leaves no placeholders', () => {
    const withFacts = buildLifecycleSteps({
      title: '周五火锅局',
      dateLabel: '明天',
      district: '南山区',
      typeLabel: '饭局',
    })
    expect(withFacts).toHaveLength(FLOW2_NODE_COPY.length)
    for (const step of withFacts) {
      expect(step.description).not.toMatch(/\{(TITLE|TYPE|DISTRICT)\}/)
    }
    expect(withFacts[0].description).toContain('周五火锅局')
    expect(withFacts[1].title).toBe('悦仔组局')
    expect(withFacts[2].title).toBe('这桌成形')
    expect(withFacts[4].description).toContain('南山区')

    const generic = buildLifecycleSteps()
    for (const step of generic) {
      expect(step.description).not.toMatch(/\{(TITLE|TYPE|DISTRICT)\}/)
    }
    expect(generic[0].description).toContain(FLOW2_FALLBACKS.nodeTitle)
    expect(generic[4].description).toContain(FLOW2_FALLBACKS.nodeDistrict)
  })

  it('keeps node 6 story-framed and node 4 deliberately unbound', () => {
    const storyNode = FLOW2_NODE_COPY.find((n) => n.id === 'story')
    expect(storyNode?.description).toBe('这一晚，会成为你故事的一章')
    const revealNode = FLOW2_NODE_COPY.find((n) => n.id === 'revealed')
    expect(revealNode?.description).not.toMatch(/\{/)
  })

  it('locks the 2026-08-03 revamp copy (eyebrows, chrome keys, de-echoed detail lines)', () => {
    // Eyebrows disambiguate the two 盲盒 modes.
    expect(FLOW1_ENTRY_COPY.event.eyebrow).toBe('和新朋友同桌')
    expect(FLOW1_ENTRY_COPY.street.eyebrow).toBe('一个人也能玩')
    // Shell chrome keys consumed by FlowShell / ExperienceEntryFlow / ExperienceDetail.
    expect(FLOW_SHELL_COPY.ctaExplore).toBe('去看看有什么局')
    expect(FLOW_SHELL_COPY.bannerEnter).toBe('进入看看')
    expect(FLOW_SHELL_COPY.detailBack).toBe('两种玩法')
    expect(FLOW_SHELL_COPY.skip).toBe('跳过')
    // Detail copy de-echoed (no 认真凑×2, no 发现×2).
    expect(EXPERIENCE_DETAIL_COPY.event.sceneTitle).toBe('报名之后，悦仔就开始为你留座了')
    expect(EXPERIENCE_DETAIL_COPY.street.steps[1].description).toBe('照着提示就能开始，随时出发')
    expect(EXPERIENCE_DETAIL_COPY.street.steps[3].title).toBe('留下这一程')
  })

  it('resolves identity chip labels within the glyph budget', () => {
    expect(getIdentityChipLabel('社牛柯基')).toBe('社牛柯基·地图')
    expect(getIdentityChipLabel('好奇猫头鹰')).toBe('好奇猫头鹰·地图')
    expect(getIdentityChipLabel('好奇猫头鹰').length).toBeLessThanOrEqual(10)
    expect(getIdentityChipLabel(null)).toBe('你的地图')
    expect(getIdentityChipLabel('  ')).toBe('你的地图')
  })

  it('resolves node description templates directly', () => {
    expect(resolveFlow2NodeDescription('{TITLE}的名额已锁定', { title: '攀岩体验' }))
      .toBe('攀岩体验的名额已锁定')
    expect(resolveFlow2NodeDescription('从屏幕走进{DISTRICT}', null))
      .toBe(`从屏幕走进${FLOW2_FALLBACKS.nodeDistrict}`)
  })
})
