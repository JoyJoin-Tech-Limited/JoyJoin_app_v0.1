import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FLASH_STORY_EXPERIENCE_SKELETON_STEPS,
  FLASH_STORY_EXPERIENCE_SKELETON_VERSION,
  FLASH_STORY_SHARED_SETTLEMENT_KIND,
  resolveAtuanFirstActSkeletonStep,
  resolveAtuanLaterActSkeletonStep,
  resolveFirstActTemplateSkeletonStep,
  resolveLaterActSkeletonStep,
} from './FlashStoryExperienceSkeleton'

const componentRoot = resolve(process.cwd(), 'src/components/alang/story-unit')

describe('FlashStoryExperienceSkeleton', () => {
  it('keeps the Atuan-first-act parity skeleton explicit and ordered', () => {
    expect(FLASH_STORY_EXPERIENCE_SKELETON_VERSION).toBe('atuan-first-act-parity-v1')
    expect(FLASH_STORY_SHARED_SETTLEMENT_KIND).toBe('shared-fragment-settlement')
    expect(FLASH_STORY_EXPERIENCE_SKELETON_STEPS).toEqual([
      'opening',
      'scene_highlights',
      'inner_object',
      'followup',
      'game',
      'ready_to_settle',
    ])
  })

  it('maps Atuan first-act progress onto the shared skeleton', () => {
    expect(resolveAtuanFirstActSkeletonStep({ arrivalReplyId: null, highlightOrder: [], followupId: null, benchReached: false })).toBe('opening')
    expect(resolveAtuanFirstActSkeletonStep({ arrivalReplyId: 'ask_order', highlightOrder: [], followupId: null, benchReached: false })).toBe('scene_highlights')
    expect(resolveAtuanFirstActSkeletonStep({ arrivalReplyId: 'ask_order', highlightOrder: ['blank_name'], followupId: null, benchReached: false })).toBe('scene_highlights')
    expect(resolveAtuanFirstActSkeletonStep({ arrivalReplyId: 'ask_order', highlightOrder: ['blank_name'], followupId: 'offer_help', benchReached: false })).toBe('game')
    expect(resolveAtuanFirstActSkeletonStep({ arrivalReplyId: 'ask_order', highlightOrder: ['blank_name'], followupId: 'offer_help', benchReached: true })).toBe('ready_to_settle')
  })

  it('maps four-NPC first acts and all later acts onto the same skeleton names', () => {
    expect(['scene', 'reveal', 'event'].map((stage) => resolveFirstActTemplateSkeletonStep(stage as never))).toEqual(['scene_highlights', 'scene_highlights', 'scene_highlights'])
    expect(resolveFirstActTemplateSkeletonStep('choice')).toBe('opening')
    expect(resolveFirstActTemplateSkeletonStep('object')).toBe('inner_object')
    expect(resolveFirstActTemplateSkeletonStep('followup')).toBe('followup')
    expect(resolveFirstActTemplateSkeletonStep('conversation')).toBe('game')
    expect(resolveFirstActTemplateSkeletonStep('success')).toBe('ready_to_settle')

    expect(resolveLaterActSkeletonStep('approach')).toBe('opening')
    expect(resolveLaterActSkeletonStep('explore')).toBe('scene_highlights')
    expect(resolveLaterActSkeletonStep('object')).toBe('inner_object')
    expect(resolveLaterActSkeletonStep('followup')).toBe('followup')
    expect(resolveLaterActSkeletonStep('game')).toBe('game')
    expect(resolveLaterActSkeletonStep('ending')).toBe('ready_to_settle')
  })

  it('maps Atuan later acts onto the same skeleton names', () => {
    expect(resolveAtuanLaterActSkeletonStep({ arrivalReplyId: null, highlightsComplete: false, followupId: null, gameStarted: false, gameComplete: false })).toBe('opening')
    expect(resolveAtuanLaterActSkeletonStep({ arrivalReplyId: 'notice-distance', highlightsComplete: false, followupId: null, gameStarted: false, gameComplete: false })).toBe('scene_highlights')
    expect(resolveAtuanLaterActSkeletonStep({ arrivalReplyId: 'notice-distance', highlightsComplete: true, followupId: null, gameStarted: false, gameComplete: false })).toBe('followup')
    expect(resolveAtuanLaterActSkeletonStep({ arrivalReplyId: 'notice-distance', highlightsComplete: true, followupId: 'why-not-send', gameStarted: false, gameComplete: false })).toBe('game')
    expect(resolveAtuanLaterActSkeletonStep({ arrivalReplyId: 'notice-distance', highlightsComplete: true, followupId: 'why-not-send', gameStarted: true, gameComplete: false })).toBe('game')
    expect(resolveAtuanLaterActSkeletonStep({ arrivalReplyId: 'notice-distance', highlightsComplete: true, followupId: 'why-not-send', gameStarted: true, gameComplete: true })).toBe('ready_to_settle')
  })

  it('exposes the shared skeleton and shared settlement contract on every custom experience family', () => {
    const files = [
      'AtuanFirstEncounterDialogue.tsx',
      'FirstActAtuanTemplateExperience.tsx',
      'AtuanLaterActExperience.tsx',
      'LaterActStoryExperience.tsx',
    ]

    for (const file of files) {
      const source = readFileSync(resolve(componentRoot, file), 'utf8')
      expect(source, file).toContain('FLASH_STORY_EXPERIENCE_SKELETON_VERSION')
      expect(source, file).toContain('data-experience-step')
      expect(source, file).toContain('FLASH_STORY_SHARED_SETTLEMENT_KIND')
    }
  })
})
