import { describe, it, expect } from 'vitest'
import type { EventPoolSummary } from '@shared/api'
import {
  getPresenceStripCountLabel,
  getPresenceStripAriaLabel,
  getTypeDensityTeaser,
} from './discoverNarrativeCopy'

function makePool(overrides: Partial<EventPoolSummary> = {}): EventPoolSummary {
  return {
    id: 'pool-1',
    title: '周末松弛感饭局',
    dateTime: '2026-11-14T18:00:00+08:00',
    eventType: '饭局',
    city: '深圳',
    ...overrides,
  } as unknown as EventPoolSummary
}

describe('ParticipantPresenceStrip copy helpers', () => {
  describe('getPresenceStripCountLabel', () => {
    it('renders empty state with invitation copy', () => {
      expect(getPresenceStripCountLabel({ state: 'empty', count: 0, max: 6 })).toBe('首座留给你')
    })

    it('renders empty state without max', () => {
      expect(getPresenceStripCountLabel({ state: 'empty', count: 0, max: undefined })).toBe('首座留给你')
    })

    it('renders partial state with denominator', () => {
      expect(getPresenceStripCountLabel({ state: 'partial', count: 3, max: 6 })).toBe('3 人已报名')
    })

    it('renders partial state without max', () => {
      expect(getPresenceStripCountLabel({ state: 'partial', count: 5, max: undefined })).toBe('5 人已报名')
    })

    it('renders almost-full state with remaining pool slots', () => {
      expect(getPresenceStripCountLabel({ state: 'almost_full', count: 5, max: 6 })).toBe('5 人已报名 · 剩 1 个名额')
    })

    it('renders almost-full state without max', () => {
      expect(getPresenceStripCountLabel({ state: 'almost_full', count: 5, max: undefined })).toBe('5 人已报名')
    })

    it('renders full state with denominator', () => {
      expect(getPresenceStripCountLabel({ state: 'full', count: 6, max: 6 })).toBe('6/6')
    })

    it('renders full state without max', () => {
      expect(getPresenceStripCountLabel({ state: 'full', count: 6, max: undefined })).toBe('已满员')
    })
  })

  describe('getPresenceStripAriaLabel', () => {
    it('renders empty aggregate label', () => {
      expect(getPresenceStripAriaLabel({ state: 'empty', count: 0, max: 6, hasUserArchetype: false })).toBe('虚位以待，首座留给你')
    })

    it('renders partial aggregate label with user archetype', () => {
      expect(getPresenceStripAriaLabel({ state: 'partial', count: 5, max: 6, hasUserArchetype: true })).toBe('5 人已报名，包含你的类型')
    })

    it('renders partial aggregate label without user archetype', () => {
      expect(getPresenceStripAriaLabel({ state: 'partial', count: 5, max: 6, hasUserArchetype: false })).toBe('5 人已报名')
    })

    it('renders almost-full aggregate label', () => {
      expect(getPresenceStripAriaLabel({ state: 'almost_full', count: 5, max: 6, hasUserArchetype: false })).toBe('5 人已报名，还剩 1 个名额')
    })

    it('renders full aggregate label', () => {
      expect(getPresenceStripAriaLabel({ state: 'full', count: 6, max: 6, hasUserArchetype: false })).toBe('已满员')
    })
  })

  describe('banned-word guard', () => {
    it('never emits banned words in any state', () => {
      const states = [
        getPresenceStripCountLabel({ state: 'empty', count: 0, max: 6 }),
        getPresenceStripCountLabel({ state: 'partial', count: 3, max: 6 }),
        getPresenceStripCountLabel({ state: 'almost_full', count: 5, max: 6 }),
        getPresenceStripCountLabel({ state: 'full', count: 6, max: 6 }),
        getPresenceStripAriaLabel({ state: 'empty', count: 0, max: 6, hasUserArchetype: false }),
        getPresenceStripAriaLabel({ state: 'partial', count: 5, max: 6, hasUserArchetype: true }),
        getPresenceStripAriaLabel({ state: 'almost_full', count: 5, max: 6, hasUserArchetype: false }),
        getPresenceStripAriaLabel({ state: 'full', count: 6, max: 6, hasUserArchetype: false }),
      ]
      for (const text of states) {
        expect(text).not.toContain('AI')
        expect(text).not.toContain('匹配')
      }
    })
  })
})

describe('getTypeDensityTeaser — group portrait, not selfie', () => {
  it('summarises the dominant archetype family present in the pool', () => {
    const text = getTypeDensityTeaser(
      makePool({ narrativePivot: 'present', sampleArchetypes: ['corgi', 'rooster', 'fox'] }),
      'corgi',
    )

    expect(text).toBe('这桌自带热场体质')
  })

  it('falls back to a group statement when no archetype data is available', () => {
    const text = getTypeDensityTeaser(
      makePool({ narrativePivot: 'present', sampleArchetypes: [] }),
      'corgi',
    )

    expect(text).toBe('这局的气质还在长，等你来定个调')
  })

  it('does not let unknown archetype ids invent a vibe', () => {
    const text = getTypeDensityTeaser(
      makePool({ narrativePivot: 'present', sampleArchetypes: ['unknown_type'] }),
      'corgi',
    )

    expect(text).toBe('这局的气质还在长，等你来定个调')
  })

  it('weights topArchetypes when the server provides counts', () => {
    const text = getTypeDensityTeaser(
      makePool({
        narrativePivot: 'dominant',
        topArchetypes: [
          { archetype: 'koala', count: 4 },
          { archetype: 'corgi', count: 1 },
        ],
      }),
      'corgi',
    )

    expect(text).toBe('这桌多半和你一个频道 · 有火花')
  })

  it('keeps the chemistry suffix when high-chemistry members exist', () => {
    const text = getTypeDensityTeaser(
      makePool({
        narrativePivot: 'present',
        sampleArchetypes: ['corgi', 'rooster'],
        highChemistryCount: 2,
      }),
      'fox',
    )

    expect(text).toBe('这桌自带热场体质 · 其中几个跟你特别对得上')
  })

  it('never claims the whole pool resembles the viewer', () => {
    const states = [
      getTypeDensityTeaser(makePool({ narrativePivot: 'present', sampleArchetypes: ['corgi'] }), 'corgi'),
      getTypeDensityTeaser(makePool({ narrativePivot: 'dominant', sampleArchetypes: ['corgi'] }), 'corgi'),
      getTypeDensityTeaser(makePool({ narrativePivot: 'present' }), 'corgi'),
    ]

    for (const text of states) {
      expect(text).not.toContain('像你')
      expect(text).not.toContain('就是你')
    }
  })
})
