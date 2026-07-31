import { describe, expect, it } from 'vitest'
import { getQuestionMascotPose } from './PersonalityTestQuestion'

describe('getQuestionMascotPose', () => {
  it('keeps the pose stable for the same question', () => {
    expect(getQuestionMascotPose('question-17')).toBe(getQuestionMascotPose('question-17'))
  })

  it('distributes question ids across multiple source poses', () => {
    const poses = new Set(Array.from({ length: 20 }, (_, index) => getQuestionMascotPose(`question-${index}`)))
    expect(poses.size).toBeGreaterThan(1)
  })
})
