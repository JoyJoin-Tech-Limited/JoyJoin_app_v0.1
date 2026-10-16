import { describe, expect, it } from 'vitest'
import { insertEventFeedbackSchema } from '@joyjoin/shared'
import { buildEventFeedbackPayload } from '../feedbackPayload'

describe('buildEventFeedbackPayload', () => {
  it('omits the optional rating when the user skips the rating step', () => {
    expect(buildEventFeedbackPayload({
      rating: 0,
      comment: '',
      connections: [],
    })).toEqual({
      feedback: undefined,
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
      feedback: '很开心',
      connections: ['user-2'],
    })
  })
})

describe('buildEventFeedbackPayload — balanced layer (均衡反馈)', () => {
  it('stays a pure base payload when the layer was not engaged', () => {
    expect(buildEventFeedbackPayload({
      rating: 4,
      comment: '',
      connections: ['user-2'],
      balanced: undefined,
    })).toEqual({
      rating: 4,
      feedback: undefined,
      connections: ['user-2'],
    })
  })

  it('carries only the atmosphere score the user filled', () => {
    const payload = buildEventFeedbackPayload({
      rating: 3,
      comment: '',
      connections: [],
      balanced: {
        atmosphereScore: 4,
      },
    })
    expect(payload.atmosphereScore).toBe(4)
    expect(payload.connectionRadar).toBeUndefined()
    expect(payload.attendeeTraits).toBeUndefined()
    expect(payload.venueStyleRating).toBeUndefined()
  })

  it('omits zeroed radar dimensions and empty attendee entries', () => {
    const payload = buildEventFeedbackPayload({
      rating: 5,
      comment: '',
      connections: ['user-2'],
      balanced: {
        connectionRadar: {
          topicResonance: 4,
          personalityMatch: 0,
          backgroundDiversity: 0,
          overallFit: 5,
        },
        attendeeTraits: {
          'user-2': { displayName: '小张', tags: ['有趣'], improvementNote: '   ' },
          'user-3': { displayName: '小李', tags: [], improvementNote: '' },
        },
      },
    })
    expect(payload.connectionRadar).toEqual({ topicResonance: 4, overallFit: 5 })
    expect(payload.attendeeTraits).toEqual({
      'user-2': {
        displayName: '小张',
        tags: ['有趣'],
        needsImprovement: false,
        improvementNote: undefined,
      },
    })
  })

  it('caps improvementAreas at 3 and derives needsImprovement from the note', () => {
    const payload = buildEventFeedbackPayload({
      rating: 4,
      comment: '',
      connections: [],
      balanced: {
        improvementAreas: [' 流程安排再多点惊喜 ', '话题引导想聊得更尽兴', '场地体验更对味一点', '时间节奏再长一点点'],
        attendeeTraits: {
          'user-1': { displayName: '小张', tags: [], improvementNote: '可以多听听别人说话' },
        },
        venueStyleRating: 'like',
        connectionStatus: '没有但很愉快',
        hasNewConnections: true,
      },
    })
    expect(payload.improvementAreas).toEqual([
      '流程安排再多点惊喜',
      '话题引导想聊得更尽兴',
      '场地体验更对味一点',
    ])
    expect(payload.attendeeTraits).toEqual({
      'user-1': {
        displayName: '小张',
        tags: [],
        needsImprovement: true,
        improvementNote: '可以多听听别人说话',
      },
    })
    expect(payload.venueStyleRating).toBe('like')
    expect(payload.connectionStatus).toBe('没有但很愉快')
    expect(payload.hasNewConnections).toBe(true)
  })

  it('passes through the four connectionStatus literals untouched', () => {
    for (const status of ['已交换联系方式', '有但还没联系', '没有但很愉快', '没有不太合适']) {
      const payload = buildEventFeedbackPayload({
        rating: 1,
        comment: '',
        connections: [],
        balanced: { connectionStatus: status },
      })
      expect(payload.connectionStatus).toBe(status)
    }
  })
})

describe('wire contract vs insertEventFeedbackSchema (server)', () => {
  // The route injects the canonical eventId before parsing (social.ts), so the
  // drift gate mirrors that: emit → attach eventId → safeParse must succeed.
  const withEventId = (payload: Record<string, unknown>) => ({ eventId: 'event-1', ...payload })

  it('parses every emitted payload — unknown keys are stripped by Zod, so this is the drift gate', () => {
    const base = buildEventFeedbackPayload({
      rating: 4,
      comment: '氛围很好',
      connections: ['user-2'],
    })
    const baseResult = insertEventFeedbackSchema.safeParse(withEventId(base))
    expect(baseResult.success).toBe(true)
    expect(baseResult.success && baseResult.data.feedback).toBe('氛围很好')

    const full = buildEventFeedbackPayload({
      rating: 5,
      comment: '想再来',
      connections: ['user-2'],
      balanced: {
        atmosphereScore: 4,
        attendeeTraits: {
          'user-2': { displayName: '小张', tags: ['有趣'], improvementNote: '多听听' },
        },
        connectionRadar: { topicResonance: 4, personalityMatch: 3, backgroundDiversity: 0, overallFit: 5 },
        connectionStatus: '已交换联系方式',
        hasNewConnections: true,
        improvementAreas: ['流程安排再多点惊喜'],
        venueStyleRating: 'like',
      },
    })
    const fullResult = insertEventFeedbackSchema.safeParse(withEventId(full))
    expect(fullResult.success).toBe(true)
    expect(fullResult.success && fullResult.data.feedback).toBe('想再来')
    expect(fullResult.success && fullResult.data.venueStyleRating).toBe('like')
  })

  it('enumerates venueStyleRating and connectionStatus as the server accepts them', () => {
    for (const status of ['已交换联系方式', '有但还没联系', '没有但很愉快', '没有不太合适']) {
      const r = insertEventFeedbackSchema.safeParse(withEventId({ connectionStatus: status }))
      expect(r.success).toBe(true)
    }
    for (const venue of ['like', 'neutral', 'dislike']) {
      const r = insertEventFeedbackSchema.safeParse(withEventId({ venueStyleRating: venue }))
      expect(r.success).toBe(true)
    }
  })
})

describe('buildEventFeedbackPayload — 微信号采集 (2026-10-16, spec wechat-id-collection-spec-20261016)', () => {
  it('carries a validated wechatContactId (trimmed) when the step saved one', () => {
    const payload = buildEventFeedbackPayload({
      rating: 0,
      comment: '',
      connections: ['user-2'],
      wechatContactId: '  abc_123 ',
    })
    expect(payload.wechatContactId).toBe('abc_123')
  })

  it('omits the field entirely when the step was skipped or left empty', () => {
    const skipped = buildEventFeedbackPayload({
      rating: 0,
      comment: '',
      connections: ['user-2'],
    })
    expect('wechatContactId' in skipped).toBe(false)

    const empty = buildEventFeedbackPayload({
      rating: 0,
      comment: '',
      connections: ['user-2'],
      wechatContactId: '   ',
    })
    expect('wechatContactId' in empty).toBe(false)
  })

  it('drops invalid values and wxid_ system IDs — the server never sees them', () => {
    for (const bad of ['1abcdef', 'abc', 'has space x', 'wxid_abc123', ' WXID_99 ']) {
      const payload = buildEventFeedbackPayload({
        rating: 0,
        comment: '',
        connections: [],
        wechatContactId: bad,
      })
      expect('wechatContactId' in payload).toBe(false)
    }
  })

  it('still parses against insertEventFeedbackSchema when the ID rides along (Zod strips it; the route reads it off the raw body)', () => {
    const payload = buildEventFeedbackPayload({
      rating: 4,
      comment: '',
      connections: ['user-2'],
      wechatContactId: 'abc_123',
    })
    const result = insertEventFeedbackSchema.safeParse({ eventId: 'event-1', ...payload })
    expect(result.success).toBe(true)
  })
})
