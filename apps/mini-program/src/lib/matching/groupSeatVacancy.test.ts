// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { MAX_VACATED_SEAT_PLACEHOLDERS, resolveGroupSeatVacancy } from './groupSeatVacancy'

/**
 * Pure vacancy resolution (post-reveal Phase 0 安心补位). Storage I/O lives in
 * read/writeGroupSeatBaseline (not covered here); this locks the derivation:
 * baseline drop + cache-skew gap → neutral placeholder count, matched-only.
 */
describe('resolveGroupSeatVacancy', () => {
  it('renders nothing for a healthy matched group', () => {
    expect(
      resolveGroupSeatVacancy({ baseline: 6, advertisedCount: 6, membersLength: 6, isMatched: true }),
    ).toEqual({ vacatedSeatCount: 0, displayCount: 6 })
  })

  it('detects a vacated seat from the remembered baseline drop', () => {
    // Group revealed at 6, server-advertised count drops to 5 post-cancel.
    expect(
      resolveGroupSeatVacancy({ baseline: 6, advertisedCount: 5, membersLength: 5, isMatched: true }),
    ).toEqual({ vacatedSeatCount: 1, displayCount: 5 })
  })

  it('covers the mid-vacancy cache-skew window without a baseline', () => {
    // memberCount is fresh (5) but the members payload is still catching up (4).
    expect(
      resolveGroupSeatVacancy({ baseline: null, advertisedCount: 5, membersLength: 4, isMatched: true }),
    ).toEqual({ vacatedSeatCount: 1, displayCount: 5 })
  })

  it('never invents vacancies when members outnumber the advertised count', () => {
    // Stale members list still includes the exiter — transient, no placeholder.
    expect(
      resolveGroupSeatVacancy({ baseline: null, advertisedCount: 4, membersLength: 5, isMatched: true }),
    ).toEqual({ vacatedSeatCount: 0, displayCount: 4 })
  })

  it('seeds no vacancy on first observation (no baseline yet)', () => {
    expect(
      resolveGroupSeatVacancy({ baseline: null, advertisedCount: 5, membersLength: 5, isMatched: true }),
    ).toEqual({ vacatedSeatCount: 0, displayCount: 5 })
  })

  it('renders no placeholders once the group is no longer matched', () => {
    expect(
      resolveGroupSeatVacancy({ baseline: 6, advertisedCount: 3, membersLength: 3, isMatched: false }),
    ).toEqual({ vacatedSeatCount: 0, displayCount: 3 })
  })

  it('caps placeholders at the phase-0 maximum', () => {
    expect(
      resolveGroupSeatVacancy({ baseline: 6, advertisedCount: 4, membersLength: 4, isMatched: true })
        .vacatedSeatCount,
    ).toBeLessThanOrEqual(MAX_VACATED_SEAT_PLACEHOLDERS)
  })
})
