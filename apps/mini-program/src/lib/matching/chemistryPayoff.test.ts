import { describe, expect, it } from 'vitest'
import {
  findCommonInterests,
  buildArchetypeChemistryLabel,
  generateChemistryPayoff,
  pickHeadline,
} from './chemistryPayoff'

describe('chemistryPayoff', () => {
  describe('pickHeadline', () => {
    it('returns a stable headline for a given group size', () => {
      const h1 = pickHeadline(4)
      const h2 = pickHeadline(4)
      expect(h1).toBe(h2)
      expect(typeof h1).toBe('string')
      expect(h1.length).toBeGreaterThan(0)
    })

    it('cycles through headlines for different group sizes', () => {
      const headlines = Array.from({ length: 10 }, (_, i) => pickHeadline(i))
      const unique = new Set(headlines)
      expect(unique.size).toBeGreaterThan(1)
    })
  })

  describe('findCommonInterests', () => {
    it('finds interests shared by at least 2 members', () => {
      const members = [
        { topInterests: ['film_entertainment', 'travel_exploration'] },
        { topInterests: ['film_entertainment', 'music_concerts'] },
        { topInterests: ['gaming'] },
      ]
      const result = findCommonInterests(members)
      expect(result).toContain('电影')
      expect(result).not.toContain('游戏')
    })

    it('includes current user interests in the count', () => {
      const members = [
        { topInterests: ['film_entertainment'] },
      ]
      const result = findCommonInterests(members, ['film_entertainment', 'travel_exploration'])
      expect(result).toContain('电影')
    })

    it('returns up to 3 interests', () => {
      const members = [
        { topInterests: ['a', 'b', 'c', 'd'] },
        { topInterests: ['a', 'b', 'c', 'd'] },
      ]
      const result = findCommonInterests(members)
      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('handles null/undefined interests gracefully', () => {
      const members = [
        { topInterests: null },
        { topInterests: ['film_entertainment'] },
        {},
      ]
      const result = findCommonInterests(members as Array<{ topInterests?: string[] | null }>)
      expect(result).toEqual([])
    })
  })

  describe('buildArchetypeChemistryLabel', () => {
    it('builds energy label from archetypes', () => {
      const label = buildArchetypeChemistryLabel(['corgi', 'fox', 'owl'])
      expect(label).toBe('活力 × 创意 × 深度')
    })

    it('deduplicates energies', () => {
      const label = buildArchetypeChemistryLabel(['corgi', 'corgi', 'fox'])
      expect(label).toBe('活力 × 创意')
    })

    it('returns null for empty input', () => {
      expect(buildArchetypeChemistryLabel([])).toBeNull()
    })

    it('returns null for unknown archetypes', () => {
      expect(buildArchetypeChemistryLabel(['unknown'])).toBeNull()
    })
  })

  describe('generateChemistryPayoff', () => {
    it('generates interest-based line when >= 2 shared interests', () => {
      const members = [
        { topInterests: ['film_entertainment', 'travel_exploration'], archetype: 'corgi' },
        { topInterests: ['film_entertainment', 'travel_exploration'], archetype: 'fox' },
      ]
      const result = generateChemistryPayoff(members)
      expect(result.chemistryLine).toContain('电影')
      expect(result.tags.length).toBeGreaterThanOrEqual(2)
    })

    it('generates interest-based line for 1 shared interest', () => {
      const members = [
        { topInterests: ['film_entertainment'], archetype: 'corgi' },
        { topInterests: ['film_entertainment'], archetype: 'fox' },
      ]
      const result = generateChemistryPayoff(members)
      expect(result.chemistryLine).toContain('电影')
      expect(result.tags).toContain('电影')
    })

    it('falls back to archetype energy when no shared interests', () => {
      const members = [
        { topInterests: ['gaming'], archetype: 'corgi' },
        { topInterests: ['cooking'], archetype: 'fox' },
      ]
      const result = generateChemistryPayoff(members)
      expect(result.chemistryLine).toContain('能量组合')
      expect(result.tags.length).toBeGreaterThan(0)
    })

    it('uses editorial fallback when no data', () => {
      const members = [
        { topInterests: [], archetype: null },
        { topInterests: [], archetype: null },
      ]
      const result = generateChemistryPayoff(members)
      expect(result.chemistryLine.length).toBeGreaterThan(0)
      expect(result.tags).toEqual([])
    })

    it('includes current user in interest calculation', () => {
      const members = [
        { topInterests: ['film_entertainment'], archetype: 'corgi' },
      ]
      const currentUser = { topInterests: ['film_entertainment'], archetype: 'fox' }
      const result = generateChemistryPayoff(members, currentUser)
      expect(result.chemistryLine).toContain('电影')
    })

    it('returns a headline for all cases', () => {
      const result = generateChemistryPayoff([])
      expect(result.headline.length).toBeGreaterThan(0)
    })
  })
})
