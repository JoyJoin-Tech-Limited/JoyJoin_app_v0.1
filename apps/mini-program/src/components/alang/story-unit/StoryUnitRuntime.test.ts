import { describe, expect, it } from 'vitest'
import {
  createStoryUnitState,
  reconcileStoryUnitState,
  restoreStoryUnitState,
  storyUnitReducer,
} from './StoryUnitRuntime'

const STORY_UNIT_ID = 's1-p1-shiqi' as const

const choice = {
  questionId: 's1-p1-shiqi-choice',
  optionId: 'notice-action',
  label: '好，我和你一起把它对齐。',
}

describe('StoryUnitRuntime', () => {
  it('moves through the SHIQI_OUTBOOK stages in one direction', () => {
    let state = createStoryUnitState(STORY_UNIT_ID)
    expect(state.stage).toBe('INIT')

    state = storyUnitReducer(state, { type: 'ENTER' })
    expect(state.stage).toBe('NPC_INTRO')
    state = storyUnitReducer(state, { type: 'START_INTERACTION', choice })
    expect(state.stage).toBe('OBJECT_INTERACTION')
    state = storyUnitReducer(state, { type: 'OBJECT_ALIGNED' })
    expect(state.stage).toBe('OBJECT_SUCCESS')
    state = storyUnitReducer(state, { type: 'RESPONSE_RECEIVED' })
    expect(state.stage).toBe('NPC_RESPONSE')
    state = storyUnitReducer(state, { type: 'COMPLETE' })
    expect(state.stage).toBe('COMPLETED')
    expect(state.unitId).toBe(STORY_UNIT_ID)
  })

  it('rejects skips, backtracking, and repeated completion', () => {
    const initial = createStoryUnitState(STORY_UNIT_ID)
    expect(storyUnitReducer(initial, { type: 'OBJECT_ALIGNED' })).toEqual(initial)

    const completed = ['ENTER', 'START_INTERACTION', 'OBJECT_ALIGNED', 'RESPONSE_RECEIVED', 'COMPLETE']
      .reduce((state, type) => storyUnitReducer(
        state,
        type === 'START_INTERACTION'
          ? { type, choice }
          : { type } as any,
      ), initial)

    expect(storyUnitReducer(completed, { type: 'ENTER' })).toEqual(completed)
    expect(storyUnitReducer(completed, { type: 'COMPLETE' })).toEqual(completed)
  })

  it('keeps the first-mistake response one-shot without changing the stage', () => {
    let state = storyUnitReducer(createStoryUnitState(STORY_UNIT_ID), { type: 'ENTER' })
    state = storyUnitReducer(state, { type: 'START_INTERACTION', choice })
    state = storyUnitReducer(state, { type: 'FIRST_MISTAKE' })
    const repeated = storyUnitReducer(state, { type: 'FIRST_MISTAKE' })

    expect(state.stage).toBe('OBJECT_INTERACTION')
    expect(state.companionEvent).toBe('FIRST_MISTAKE')
    expect(repeated).toEqual(state)
  })

  it('restores an aligned object and immutable answer payload', () => {
    const restored = restoreStoryUnitState(STORY_UNIT_ID, {
      unitId: STORY_UNIT_ID,
      version: 2,
      stage: 'OBJECT_SUCCESS',
      choice,
      companionEvent: 'SUCCESS',
      analyticsSent: ['story_start', 'object_interaction_start', 'object_complete'],
    })

    expect(restored.stage).toBe('OBJECT_SUCCESS')
    expect(restored.choice).toEqual(choice)
    expect(restored.analyticsSent).toContain('object_complete')
  })

  it('fails closed to INIT when a stored snapshot is malformed', () => {
    expect(restoreStoryUnitState(STORY_UNIT_ID, { stage: 'OBJECT_SUCCESS' })).toEqual(createStoryUnitState(STORY_UNIT_ID))
    expect(restoreStoryUnitState(STORY_UNIT_ID, null)).toEqual(createStoryUnitState(STORY_UNIT_ID))
  })

  it('drops a recovered payload whose reviewed question or option changed', () => {
    const restored = restoreStoryUnitState(STORY_UNIT_ID, {
      unitId: STORY_UNIT_ID,
      version: 2,
      stage: 'OBJECT_SUCCESS',
      choice,
      companionEvent: 'SUCCESS',
      analyticsSent: ['object_complete'],
    })

    expect(reconcileStoryUnitState(STORY_UNIT_ID, restored, {
      id: 'replacement-question',
      options: [{ id: choice.optionId, label: choice.label }],
    })).toEqual(createStoryUnitState(STORY_UNIT_ID))
    expect(reconcileStoryUnitState(STORY_UNIT_ID, restored, {
      id: choice.questionId,
      options: [{ id: 'replacement-option', label: choice.label }],
    })).toEqual(createStoryUnitState(STORY_UNIT_ID))
  })

  it('keeps a valid recovered payload and refreshes its reviewed label', () => {
    const restored = restoreStoryUnitState(STORY_UNIT_ID, {
      unitId: STORY_UNIT_ID,
      version: 2,
      stage: 'OBJECT_SUCCESS',
      choice,
      companionEvent: 'SUCCESS',
      analyticsSent: ['object_complete'],
    })
    const reconciled = reconcileStoryUnitState(STORY_UNIT_ID, restored, {
      id: choice.questionId,
      options: [{ id: choice.optionId, label: '更新后的审核文案' }],
    })

    expect(reconciled.stage).toBe('OBJECT_SUCCESS')
    expect(reconciled.choice).toEqual({ ...choice, label: '更新后的审核文案' })
  })
})
