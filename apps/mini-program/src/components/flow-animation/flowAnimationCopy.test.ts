import { describe, expect, it } from 'vitest'
import {
  FLOW1_ENTRY_COPY,
  FLOW2_FALLBACKS,
  FLOW2_NODE_COPY,
  FLOW_SHELL_COPY,
  getFlow2HeroMeta,
  getFlow2HeroStatus,
  getIdentityChipLabel,
  resolveFlow2NodeDescription,
} from '@shared/copy/flowAnimationCopy'
import { buildLifecycleSteps } from './flowAnimation.config'

describe('flow-animation copy binding', () => {
  it('keeps the street banner invitation-framed (no availability promises)', () => {
    const streetLine = FLOW1_ENTRY_COPY.street.bannerLine
    expect(streetLine).toBe('一条线索引路，把城市走成故事')
    expect(streetLine).not.toContain('此刻')
    expect(streetLine).not.toContain('今天')
    expect(streetLine).not.toContain('马上')
  })

  it('resolves Flow 2 hero templates with real facts and designed fallbacks', () => {
    // 2026-08-03 revamp: the vague process word 「一步步」 was dropped.
    expect(getFlow2HeroStatus({ title: '周五火锅局' })).toBe('你的周五火锅局，正在成形')
    expect(getFlow2HeroStatus(null)).toBe(`你的${FLOW2_FALLBACKS.heroTitle}，正在成形`)
    expect(getFlow2HeroStatus({ title: '  ' })).toBe(`你的${FLOW2_FALLBACKS.heroTitle}，正在成形`)

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
    expect(withFacts[1].title).toBe('等待同频桌友')
    expect(withFacts[2].title).toBe('桌友到齐')
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

  it('locks the play-mode entry copy consumed by the Discover arrival coachmark', () => {
    // Eyebrows disambiguate the two 盲盒 modes.
    expect(FLOW1_ENTRY_COPY.event.eyebrow).toBe('和新朋友同桌')
    expect(FLOW1_ENTRY_COPY.event.title).toBe('盲盒活动')
    expect(FLOW1_ENTRY_COPY.event.bannerLine).toBe('挑一场活动，凑成一桌，线下见')
    expect(FLOW1_ENTRY_COPY.street.eyebrow).toBe('一个人也能玩')
    expect(FLOW1_ENTRY_COPY.street.title).toBe('街头盲盒')
    // Shell chrome keys consumed by FlowShell (Flow 2).
    expect(FLOW_SHELL_COPY.skip).toBe('跳过')
    expect(FLOW_SHELL_COPY.ctaViewActivity).toBe('查看我的活动')
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
