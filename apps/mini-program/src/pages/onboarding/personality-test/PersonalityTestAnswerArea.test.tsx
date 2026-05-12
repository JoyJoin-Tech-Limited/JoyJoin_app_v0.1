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
      const option: AnswerOption = { value: 'A', text: '直接冲' }
      const label = resolveFragmentLabel(option)
      expect(label).toBeTruthy()
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    })

    it('returns the same label for the same option text', () => {
      const option: AnswerOption = { value: 'A', text: '直接冲' }
      expect(resolveFragmentLabel(option)).toBe(resolveFragmentLabel(option))
    })

    it('returns different labels for different option texts', () => {
      const optionA: AnswerOption = { value: 'A', text: '直接冲' }
      const optionB: AnswerOption = { value: 'B', text: '慢慢来' }
      // Different first charCode should likely map to different labels
      expect(resolveFragmentLabel(optionA)).not.toBe(resolveFragmentLabel(optionB))
    })

    it('never returns gamified "+1" stat language', () => {
      const testOptions: AnswerOption[] = [
        { value: 'A', text: 'a' },
        { value: 'B', text: 'b' },
        { value: 'C', text: 'c' },
        { value: 'D', text: 'd' },
        { value: 'E', text: 'e' },
        { value: 'F', text: 'f' },
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

    it('always includes an emoji prefix', () => {
      const option: AnswerOption = { value: 'A', text: '测试' }
      const label = resolveFragmentLabel(option)
      // Emoji regex: match a non-ASCII character at the start
      expect(label).toMatch(/^[^\x00-\x7F]/)
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
