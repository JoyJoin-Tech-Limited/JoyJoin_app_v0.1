import { describe, expect, it } from 'vitest'
import {
  buildQuipBattleVotes,
  buildQuipVotePreview,
  isOwnQuipAnswer,
  resolveQuipAnswerId,
} from '../phases/QuipBattleHeroView'

/**
 * G0 opaque quip answers (2026-11-10). The sanitizer publishes an `answerId`
 * and replaces other authors' `userId` with an opaque `q_…` token, so the client
 * must vote with the server value instead of re-deriving `${userId}::${promptId}`.
 * These locks keep that wire contract and the own-answer safe check intact.
 */

const OPAQUE = 'q_AbCdEfGhIjKlMnOpQrStUv::p1'

describe('resolveQuipAnswerId', () => {
  it('prefers the server-provided answerId', () => {
    expect(
      resolveQuipAnswerId({ answerId: OPAQUE, userId: 'q_AbCdEfGhIjKlMnOpQrStUv', promptId: 'p1' }),
    ).toBe(OPAQUE)
  })

  it('falls back to the legacy composite only when answerId is absent', () => {
    expect(resolveQuipAnswerId({ userId: 'u1', promptId: 'p1' })).toBe('u1::p1')
    expect(resolveQuipAnswerId({ answerId: '   ', userId: 'u1', promptId: 'p1' })).toBe('u1::p1')
  })
})

describe('vote payload', () => {
  it('submits the opaque answerId — never the author id', () => {
    const preview = buildQuipVotePreview(
      [
        {
          prompt: { id: 'p1', promptText: '题目一', category: '脑洞' },
          answer: {
            answerId: OPAQUE,
            userId: 'q_AbCdEfGhIjKlMnOpQrStUv',
            displayName: '匿名同桌',
            answerText: '回答一',
            promptId: 'p1',
          },
        },
      ],
      {},
    )

    expect(preview.items[0].key).toBe(OPAQUE)
    expect(preview.items[0].answerId).toBe(OPAQUE)
    expect(buildQuipBattleVotes({ [preview.items[0].key]: 'p1' })).toEqual([
      { answerId: OPAQUE, promptId: 'p1' },
    ])
    // The opaque token is the only author-shaped value that may leave the device.
    expect(JSON.stringify(buildQuipBattleVotes({ [preview.items[0].key]: 'p1' }))).not.toContain('u1')
  })
})

describe('buildQuipVotePreview', () => {
  it('matches votes recorded against the opaque answerId', () => {
    const preview = buildQuipVotePreview(
      [
        {
          prompt: { id: 'p1', promptText: '题目一', category: '脑洞' },
          answer: {
            answerId: OPAQUE,
            userId: 'q_AbCdEfGhIjKlMnOpQrStUv',
            displayName: '匿名同桌',
            answerText: '回答一',
            promptId: 'p1',
          },
        },
        {
          prompt: { id: 'p1', promptText: '题目一', category: '脑洞' },
          answer: { answerId: 'u2::p1', userId: 'u2', displayName: '阿澈', answerText: '回答二', promptId: 'p1' },
        },
      ],
      { [OPAQUE]: 'p1' },
    )

    expect(preview.votedCount).toBe(1)
    expect(preview.items.map((item) => [item.key, item.voted])).toEqual([
      [OPAQUE, true],
      ['u2::p1', false],
    ])
  })
})

describe('own-answer detection', () => {
  it('matches the viewer’s real id and never an opaque token', () => {
    expect(isOwnQuipAnswer({ userId: 'viewer-1' }, 'viewer-1')).toBe(true)
    expect(isOwnQuipAnswer({ userId: 'q_AbCdEfGhIjKlMnOpQrStUv' }, 'viewer-1')).toBe(false)
    expect(isOwnQuipAnswer({ userId: 'other' }, 'viewer-1')).toBe(false)
    expect(isOwnQuipAnswer({ userId: 'viewer-1' }, undefined)).toBe(false)
    expect(isOwnQuipAnswer(null, 'viewer-1')).toBe(false)
  })

  it('marks the viewer’s own answer in the preview without exposing peers', () => {
    const preview = buildQuipVotePreview(
      [
        {
          prompt: { id: 'p1', promptText: '题目一', category: '脑洞' },
          answer: { answerId: 'viewer-1::p1', userId: 'viewer-1', displayName: '我', answerText: '我的', promptId: 'p1' },
        },
        {
          prompt: { id: 'p1', promptText: '题目一', category: '脑洞' },
          answer: {
            answerId: OPAQUE,
            userId: 'q_AbCdEfGhIjKlMnOpQrStUv',
            displayName: '匿名同桌',
            answerText: '匿名',
            promptId: 'p1',
          },
        },
      ],
      {},
      'viewer-1',
    )

    expect(preview.items.map((item) => item.isOwn)).toEqual([true, false])
  })
})
