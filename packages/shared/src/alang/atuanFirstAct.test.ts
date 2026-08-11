import { describe, expect, it } from 'vitest'

import {
  ATUAN_FIRST_ACT_ANOMALIES,
  ATUAN_FIRST_ACT_ENDINGS,
  createAtuanFirstActProgress,
  resolveAtuanFirstActOutcome,
  selectAtuanFirstActAnomaly,
  toAtuanFirstActSubmission,
} from './atuanFirstAct'

describe('Atuan first-act story engine', () => {
  it('keeps one encounter on a stable reviewed anomaly', () => {
    const first = selectAtuanFirstActAnomaly('encounter-stable-42')
    expect(selectAtuanFirstActAnomaly('encounter-stable-42')).toEqual(first)
    expect(ATUAN_FIRST_ACT_ANOMALIES.some((item) => item.id === first.id)).toBe(true)
  })

  it('makes all four reviewed anomalies reachable without runtime randomness', () => {
    const reached = new Set(
      Array.from({ length: 256 }, (_, index) => selectAtuanFirstActAnomaly(`encounter-${index}`).id),
    )
    expect(reached).toEqual(new Set(ATUAN_FIRST_ACT_ANOMALIES.map((item) => item.id)))
  })

  it('derives only reviewed endings and makes all six endings reachable', () => {
    const endings = new Set<string>()
    for (let index = 0; index < 256; index += 1) {
      const encounterId = `encounter-${index}`
      for (const hypothesisId of ['returned', 'miscounted', 'self_hidden'] as const) {
        for (const decisionId of ['return_unread', 'ask_first', 'restore_words'] as const) {
          const progress = createAtuanFirstActProgress(encounterId, 'trace_order')
          const outcome = resolveAtuanFirstActOutcome(encounterId, {
            ...progress,
            hypothesisId,
            reversalRevealed: true,
            decisionId,
          })
          endings.add(outcome.ending.id)
          expect(outcome.responseCopy).toContain(`《${outcome.ending.title}》`)
          expect(toAtuanFirstActSubmission(outcome.progress)).toEqual(expect.objectContaining({
            version: 'atuan-first-act-v1',
            endingId: outcome.ending.id,
          }))
        }
      }
    }
    expect(endings).toEqual(new Set(ATUAN_FIRST_ACT_ENDINGS.map((item) => item.id)))
  })
})
