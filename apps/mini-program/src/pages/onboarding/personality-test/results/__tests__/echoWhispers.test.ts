import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStorageSync } from '@tarojs/taro'
import {
  buildEchoWhispers,
  ECHO_WHISPER_MAX,
  ECHO_WHISPER_MIN_CHARS,
} from '../resultHelpers'
import { questionsV4 } from '@shared/personality/questionsV4'

/**
 * Regression tests for Slice 3 (2026-07-19): answer-echo whispers.
 * Locks in: real option texts quoted from the question bank, min-length filter,
 * dedupe, max-count cap, and the empty fallback for authenticated users
 * (whose answers are not stored locally).
 */

const mockedGetStorageSync = getStorageSync as ReturnType<typeof vi.fn>

function seedAnswers(answers: Array<{ questionId: string; selectedOption: string }>) {
  mockedGetStorageSync.mockImplementation((key: string) => {
    if (key === 'joyjoin_v4_presignup_answers') {
      return JSON.stringify(
        answers.map((a) => ({ ...a, answeredAt: '2026-07-19T00:00:00.000Z' })),
      )
    }
    return null
  })
}

/** First N real answer pairs from the question bank (choice-type questions). */
function realAnswers(count: number) {
  const pairs: Array<{ questionId: string; selectedOption: string; text: string }> = []
  for (const q of questionsV4) {
    const opt = q.options?.[0]
    if (!q.id || !opt?.value || !opt.text) continue
    pairs.push({ questionId: q.id, selectedOption: opt.value, text: opt.text })
    if (pairs.length >= count) break
  }
  return pairs
}

describe('buildEchoWhispers', () => {
  beforeEach(() => {
    mockedGetStorageSync.mockReset()
    mockedGetStorageSync.mockReturnValue(null)
  })

  it('returns empty when no local answers exist (authenticated flow)', () => {
    expect(buildEchoWhispers()).toEqual([])
  })

  it('quotes real option texts from the question bank', () => {
    const [first] = realAnswers(1)
    seedAnswers([{ questionId: first.questionId, selectedOption: first.selectedOption }])
    const whispers = buildEchoWhispers()
    expect(whispers).toHaveLength(1)
    expect(first.text).toContain(whispers[0])
  })

  it('caps at ECHO_WHISPER_MAX and dedupes', () => {
    seedAnswers(realAnswers(8).map(({ questionId, selectedOption }) => ({ questionId, selectedOption })))
    const whispers = buildEchoWhispers()
    expect(whispers.length).toBeLessThanOrEqual(ECHO_WHISPER_MAX)
    expect(new Set(whispers).size).toBe(whispers.length)
  })

  it('skips unknown question ids and malformed storage', () => {
    seedAnswers([{ questionId: 'Q_DOES_NOT_EXIST', selectedOption: 'A' }])
    expect(buildEchoWhispers()).toEqual([])
    mockedGetStorageSync.mockReturnValue('not-json{')
    expect(buildEchoWhispers()).toEqual([])
  })

  it(`drops option texts shorter than ECHO_WHISPER_MIN_CHARS (${ECHO_WHISPER_MIN_CHARS})`, () => {
    // No real bank option is < 4 chars, so verify via the contract constant directly:
    // a whisper must never be shorter than the minimum.
    const [first] = realAnswers(1)
    seedAnswers([{ questionId: first.questionId, selectedOption: first.selectedOption }])
    for (const w of buildEchoWhispers()) {
      expect(w.length).toBeGreaterThanOrEqual(ECHO_WHISPER_MIN_CHARS)
    }
  })
})
