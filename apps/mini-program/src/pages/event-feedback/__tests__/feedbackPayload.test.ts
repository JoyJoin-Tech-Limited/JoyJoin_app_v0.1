import { describe, expect, it } from 'vitest'
import { buildEventFeedbackPayload } from '../feedbackPayload'

describe('buildEventFeedbackPayload', () => {
  it('omits the optional rating when the user skips the rating step', () => {
    expect(buildEventFeedbackPayload({
      rating: 0,
      comment: '',
      connections: [],
    })).toEqual({
      comment: undefined,
      connections: [],
    })
  })

  it('preserves a selected rating and trims an optional comment', () => {
    expect(buildEventFeedbackPayload({
      rating: 4,
      comment: '  很开心  ',
      connections: ['user-2'],
    })).toEqual({
      rating: 4,
      comment: '很开心',
      connections: ['user-2'],
    })
  })
})
