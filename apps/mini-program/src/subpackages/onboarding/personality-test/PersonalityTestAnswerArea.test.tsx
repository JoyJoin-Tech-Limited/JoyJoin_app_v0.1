import { describe, expect, it } from 'vitest'
import {
  resolveFragmentLabel,
  getNearestSliderOption,
  type AnswerOption,
  resolveOptionPreviewSpriteState,
  isMilestoneQuestion,
} from './personalityTestLogic'

describe('PersonalityTest wow element logic', () => {
  describe('resolveFragmentLabel', () => {
    it('returns a deterministic label for a given option', () => {
      const option: AnswerOption = {
        value: 'A',
        text: '直接冲',
        traitScores: { A: 0.7, O: 0.2, C: 0.3, E: 0.1, X: 0.5, P: 0.4 },
      }
      const label = resolveFragmentLabel(option)
      expect(label).toBeTruthy()
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    })

    it('returns the same label for the same traitScores', () => {
      const option: AnswerOption = {
        value: 'A',
        text: '直接冲',
        traitScores: { A: 0.7, O: 0.2 },
      }
      expect(resolveFragmentLabel(option)).toBe(resolveFragmentLabel(option))
    })

    it('selects the trait with the highest score', () => {
      const option: AnswerOption = {
        value: 'A',
        text: '直接冲',
        traitScores: { A: 0.3, O: 0.9, C: 0.1, E: 0.1, X: 0.2, P: 0.1 },
      }
      expect(resolveFragmentLabel(option)).toBe('清风徐来')
    })

    it('falls back to warm default when no traitScores are present', () => {
      const option: AnswerOption = { value: 'A', text: '直接冲' }
      expect(resolveFragmentLabel(option)).toBe('你的光')
    })

    it('falls back to warm default when traitScores is empty', () => {
      const option: AnswerOption = { value: 'A', text: '直接冲', traitScores: {} }
      expect(resolveFragmentLabel(option)).toBe('你的光')
    })

    it('never returns gamified "+1" stat language', () => {
      const testOptions: AnswerOption[] = [
        { value: 'A', text: 'a', traitScores: { A: 0.5, O: 0.5, C: 0.5, E: 0.5, X: 0.5, P: 0.5 } },
        { value: 'B', text: 'b', traitScores: { A: 0.2, O: 0.8, C: 0.1, E: 0.1, X: 0.1, P: 0.1 } },
        { value: 'C', text: 'c', traitScores: { A: 0.1, O: 0.1, C: 0.9, E: 0.1, X: 0.1, P: 0.1 } },
        { value: 'D', text: 'd', traitScores: { A: 0.1, O: 0.1, C: 0.1, E: 0.9, X: 0.1, P: 0.1 } },
        { value: 'E', text: 'e', traitScores: { A: 0.1, O: 0.1, C: 0.1, E: 0.1, X: 0.9, P: 0.1 } },
        { value: 'F', text: 'f', traitScores: { A: 0.1, O: 0.1, C: 0.1, E: 0.1, X: 0.1, P: 0.9 } },
      ]
      for (const opt of testOptions) {
        const label = resolveFragmentLabel(opt)
        expect(label).not.toMatch(/\+1/)
        expect(label).not.toMatch(/加1/)
        expect(label).not.toMatch(/升级/)
        expect(label).not.toMatch(/经验/)
        expect(label).not.toMatch(/点数/)
      }
    })

    it('never returns an emoji-prefixed label', () => {
      const traitOptions: AnswerOption[] = [
        { value: 'A', text: 'a', traitScores: { A: 0.9 } },
        { value: 'O', text: 'o', traitScores: { O: 0.9 } },
        { value: 'C', text: 'c', traitScores: { C: 0.9 } },
        { value: 'E', text: 'e', traitScores: { E: 0.9 } },
        { value: 'X', text: 'x', traitScores: { X: 0.9 } },
        { value: 'P', text: 'p', traitScores: { P: 0.9 } },
      ]
      for (const opt of traitOptions) {
        const label = resolveFragmentLabel(opt)
        // Brand guideline: no emoji in primary copy. Plain ASCII or CJK only.
        expect(label).not.toMatch(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u)
      }
      // Also no fallback emoji
      const fallback = resolveFragmentLabel({ value: 'X', text: 'no scores' })
      expect(fallback).not.toMatch(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/u)
    })
  })

  describe('resolveOptionPreviewSpriteState', () => {
    it('returns a valid sprite state for any option text', () => {
      const validStates = ['listening', 'curious', 'thinking', 'surprised']
      const option = { text: '直接冲' }
      const state = resolveOptionPreviewSpriteState(option)
      expect(validStates).toContain(state)
    })

    it('returns the same state for the same option text', () => {
      const option = { text: '直接冲' }
      expect(resolveOptionPreviewSpriteState(option)).toBe(
        resolveOptionPreviewSpriteState(option),
      )
    })

    it('returns different states for different option texts', () => {
      const states = new Set<string>()
      const texts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      for (const text of texts) {
        states.add(resolveOptionPreviewSpriteState({ text }))
      }
      // With 4 states and 8 different inputs, we should cover all states
      expect(states.size).toBeGreaterThanOrEqual(2)
    })
  })

  describe('isMilestoneQuestion', () => {
    it('returns true for answered counts 3 and 7', () => {
      expect(isMilestoneQuestion(3)).toBe(true)
      expect(isMilestoneQuestion(7)).toBe(true)
    })

    it('returns false for non-milestone counts', () => {
      expect(isMilestoneQuestion(0)).toBe(false)
      expect(isMilestoneQuestion(1)).toBe(false)
      expect(isMilestoneQuestion(2)).toBe(false)
      expect(isMilestoneQuestion(4)).toBe(false)
      expect(isMilestoneQuestion(5)).toBe(false)
      expect(isMilestoneQuestion(6)).toBe(false)
      expect(isMilestoneQuestion(8)).toBe(false)
      expect(isMilestoneQuestion(10)).toBe(false)
    })
  })

  describe('getNearestSliderOption', () => {
    const options: AnswerOption[] = [
      { value: '-50', text: '非常内向' },
      { value: '-25', text: '比较内向' },
      { value: '0', text: '中立' },
      { value: '25', text: '比较外向' },
      { value: '50', text: '非常外向' },
    ]

    it('returns the closest option for a given slider value', () => {
      expect(getNearestSliderOption(options, 0)?.value).toBe('0')
      expect(getNearestSliderOption(options, 30)?.value).toBe('25')
      expect(getNearestSliderOption(options, 40)?.value).toBe('50')
      expect(getNearestSliderOption(options, 60)?.value).toBe('50')
      expect(getNearestSliderOption(options, -40)?.value).toBe('-50')
    })

    it('returns null for empty options', () => {
      expect(getNearestSliderOption([], 50)).toBeNull()
    })

    it('handles options without numeric values gracefully', () => {
      const nonNumericOptions: AnswerOption[] = [
        { value: 'A', text: '选项A' },
        { value: 'B', text: '选项B' },
      ]
      // When no numeric value is found, defaults to 50
      expect(getNearestSliderOption(nonNumericOptions, 50)?.value).toBe('A')
    })
  })
})
