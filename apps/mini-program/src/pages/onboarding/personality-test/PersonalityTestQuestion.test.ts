import { describe, expect, it } from 'vitest'
import { getQuestionMascotPose } from './PersonalityTestQuestion'
import { PERSONALITY_TEST_QUESTION_EXPRESSION } from './visuals'

describe('getQuestionMascotPose', () => {
  it('keeps the original compact curious pose for every question', () => {
    const poses = Array.from({ length: 20 }, (_, index) => getQuestionMascotPose(`question-${index}`))

    expect(poses).toEqual(Array(20).fill(PERSONALITY_TEST_QUESTION_EXPRESSION.choice))
  })
})
