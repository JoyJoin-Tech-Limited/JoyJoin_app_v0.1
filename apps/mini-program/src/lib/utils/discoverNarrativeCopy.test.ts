import { describe, it, expect } from 'vitest'
import {
  getPresenceStripCountLabel,
  getPresenceStripAriaLabel,
} from './discoverNarrativeCopy'

describe('ParticipantPresenceStrip copy helpers', () => {
  describe('getPresenceStripCountLabel', () => {
    it('renders empty state with invitation copy', () => {
      expect(getPresenceStripCountLabel({ state: 'empty', count: 0, max: 6 })).toBe('首座留给你')
    })

    it('renders empty state without max', () => {
      expect(getPresenceStripCountLabel({ state: 'empty', count: 0, max: undefined })).toBe('首座留给你')
    })

    it('renders partial state with denominator', () => {
      expect(getPresenceStripCountLabel({ state: 'partial', count: 3, max: 6 })).toBe('3/6')
    })

    it('renders partial state without max', () => {
      expect(getPresenceStripCountLabel({ state: 'partial', count: 5, max: undefined })).toBe('5 位已入座')
    })

    it('renders almost-full state with denominator', () => {
      expect(getPresenceStripCountLabel({ state: 'almost_full', count: 5, max: 6 })).toBe('即将满员 · 5/6')
    })

    it('renders almost-full state without max', () => {
      expect(getPresenceStripCountLabel({ state: 'almost_full', count: 5, max: undefined })).toBe('5 位已入座')
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
      expect(getPresenceStripAriaLabel({ state: 'partial', count: 5, max: 6, hasUserArchetype: true })).toBe('5/6 已入池，包含你的类型')
    })

    it('renders partial aggregate label without user archetype', () => {
      expect(getPresenceStripAriaLabel({ state: 'partial', count: 5, max: 6, hasUserArchetype: false })).toBe('5/6 已入池')
    })

    it('renders almost-full aggregate label', () => {
      expect(getPresenceStripAriaLabel({ state: 'almost_full', count: 5, max: 6, hasUserArchetype: false })).toBe('即将满员，5/6')
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
