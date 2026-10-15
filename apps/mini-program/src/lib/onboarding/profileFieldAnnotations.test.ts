import { describe, it, expect } from 'vitest'
import {
  buildInterestHeatConclusion,
  getProfileFieldAnnotation,
} from './profileFieldAnnotations'

// AC-12: visible copy must carry zero emoji and zero 匹配/社交/灵魂/AI wording.
const FORBIDDEN_VOCAB = /匹配|社交|灵魂|AI/
// Broad emoji / pictograph coverage (matches repo guardrail-style checks).
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

// AC-17: annotations are pure-memory narrative. They must NOT promise
// behaviour the matching engine does not deliver.
const BANNED_PROMISE_WORDS = ['优先', '替你把握', '帮你匹配', '帮你留意', '帮你照顾', '替你']

const SAMPLE_VALUES: Record<string, string[]> = {
  家乡: ['香港', '广东深圳', '黑龙江哈尔滨'],
  关系状态: ['单身', '恋爱中', '保密'],
  学历: ['本科', '硕士', '博士'],
  职业: ['产品经理', '自由职业', '在读学生'],
  行业: ['互联网', '金融', '教育'],
}

describe('profileFieldAnnotations — AC-09 deterministic 悦仔记住的 annotations', () => {
  it('builds a value-citing annotation for the mapped 小档案 fields', () => {
    expect(getProfileFieldAnnotation('家乡', '香港')).toContain('香港')
    expect(getProfileFieldAnnotation('学历', '硕士')).toContain('硕士')
    expect(getProfileFieldAnnotation('职业', '产品经理')).toContain('产品经理')
    expect(getProfileFieldAnnotation('行业', '互联网')).toContain('互联网')
  })

  it('AC-17: hometown annotation is pure-memory narrative', () => {
    const annotation = getProfileFieldAnnotation('家乡', '香港')
    expect(annotation).toBe('香港，老乡见老乡，话总会多几句')
  })

  it('AC-21④: no builder repeats the 悦仔 subject — the prefix lives at section level once', () => {
    for (const [label, values] of Object.entries(SAMPLE_VALUES)) {
      for (const value of values) {
        const annotation = getProfileFieldAnnotation(label, value)
        expect(annotation).not.toContain('悦仔')
      }
    }
    expect(getProfileFieldAnnotation('未知字段', 'x')).not.toContain('悦仔')
  })

  it('AC-17: relationship status does not echo the sensitive value', () => {
    const annotation = getProfileFieldAnnotation('关系状态', '单身')
    expect(annotation).not.toContain('单身')
    expect(annotation).toBe('这一栏先记着，之后会用得上')
  })

  it('AC-14: industry annotation uses 「有得聊」 (typo fix from 「会有的聊」)', () => {
    const annotation = getProfileFieldAnnotation('行业', '互联网')
    expect(annotation).toContain('有得聊')
    expect(annotation).not.toContain('会有的聊')
  })

  it('AC-17: no annotation promises matching-engine behaviour', () => {
    for (const [label, values] of Object.entries(SAMPLE_VALUES)) {
      for (const value of values) {
        const annotation = getProfileFieldAnnotation(label, value)
        for (const banned of BANNED_PROMISE_WORDS) {
          expect(annotation).not.toContain(banned)
        }
      }
    }
    const fallback = getProfileFieldAnnotation('未知字段', 'x')
    for (const banned of BANNED_PROMISE_WORDS) {
      expect(fallback).not.toContain(banned)
    }
  })

  it('falls back gracefully for unmapped labels and empty values', () => {
    const fallback = getProfileFieldAnnotation('未知字段', '任意值')
    expect(fallback).toBe('这一条也收好了，之后会用得上')
    expect(getProfileFieldAnnotation('家乡', '   ')).toBe(fallback)
  })

  it('keeps every template output free of forbidden vocab and emoji (AC-12)', () => {
    for (const [label, values] of Object.entries(SAMPLE_VALUES)) {
      for (const value of values) {
        const annotation = getProfileFieldAnnotation(label, value)
        expect(FORBIDDEN_VOCAB.test(annotation)).toBe(false)
        expect(EMOJI_PATTERN.test(annotation)).toBe(false)
      }
    }
    const fallback = getProfileFieldAnnotation('未知字段', 'x')
    expect(FORBIDDEN_VOCAB.test(fallback)).toBe(false)
    expect(EMOJI_PATTERN.test(fallback)).toBe(false)
  })
})

describe('buildInterestHeatConclusion — AC-09 兴趣热量地图 conclusion sentence', () => {
  it('cites the top two interest labels', () => {
    expect(buildInterestHeatConclusion(['探店', '私厨', '露营'])).toBe('你把最多的热量给了探店和私厨')
  })

  it('handles a single label without the connector', () => {
    expect(buildInterestHeatConclusion(['探店'])).toBe('你把最多的热量给了探店')
  })

  it('returns null when there is nothing to cite', () => {
    expect(buildInterestHeatConclusion([])).toBeNull()
    expect(buildInterestHeatConclusion(['', '   '])).toBeNull()
  })

  it('keeps the conclusion free of forbidden vocab and emoji (AC-12)', () => {
    for (const labels of [['探店', '私厨'], ['露营'], ['citywalk', '飞盘']]) {
      const conclusion = buildInterestHeatConclusion(labels)
      expect(conclusion).not.toBeNull()
      expect(FORBIDDEN_VOCAB.test(conclusion as string)).toBe(false)
      expect(EMOJI_PATTERN.test(conclusion as string)).toBe(false)
    }
  })
})
