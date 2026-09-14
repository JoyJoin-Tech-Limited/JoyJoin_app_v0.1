import { describe, expect, it } from 'vitest'
import { buildGroupOutcomePayload } from '../groupOutcomePayload'

// W4 (AC-W4.2a): the feedback page's canonical outcome bridge. These locks
// guarantee the legacy feedback submission also produces a payload the server
// accepts on POST /api/event-pools/:poolId/group-outcome — the only route that
// feeds match_history / calibration. No user-facing copy is involved.

const MEMBERS = ['member-a', 'member-b', 'member-c']

function build(overrides: Partial<Parameters<typeof buildGroupOutcomePayload>[0]> = {}) {
  return buildGroupOutcomePayload({
    groupId: 'group-1',
    rating: 0,
    atmosphereScore: 0,
    connectionStatus: null,
    selectedConnections: [],
    memberUserIds: MEMBERS,
    ...overrides,
  })
}

describe('buildGroupOutcomePayload', () => {
  it('emits one radar entry per other member with selected=5 and neutral=3', () => {
    const payload = build({ selectedConnections: ['member-b'] })

    expect(payload).not.toBeNull()
    expect(payload).toEqual({
      groupId: 'group-1',
      atmosphereScore: 3,
      wouldMeetAgain: true,
      connectionRadar: {
        'member-a': 3,
        'member-b': 5,
        'member-c': 3,
      },
      icebreakerRatings: { overall: 'neutral' },
    })
  })

  it('prefers the thermometer over the overall rating for atmosphereScore', () => {
    expect(build({ rating: 2, atmosphereScore: 5 })?.atmosphereScore).toBe(5)
    // Falls back to the rating when the thermometer was skipped.
    expect(build({ rating: 4, atmosphereScore: 0 })?.atmosphereScore).toBe(4)
  })

  it('marks wouldMeetAgain true when a connection was selected, even at low rating', () => {
    const payload = build({ rating: 1, selectedConnections: ['member-a'] })
    expect(payload?.wouldMeetAgain).toBe(true)
  })

  it('marks wouldMeetAgain true for a rating of 4+ with no selection', () => {
    expect(build({ rating: 4 })?.wouldMeetAgain).toBe(true)
    expect(build({ rating: 3 })?.wouldMeetAgain).toBe(false)
  })

  it('marks wouldMeetAgain true when only the atmosphere thermometer is 4+ (no rating/selection)', () => {
    // Regression (W4 review): a user who warmed the thermometer but skipped the
    // rating faces must not be persisted as a hard `false` — derivation ORs the
    // pair signal, so a lone false poisons every member's match_history row.
    expect(build({ atmosphereScore: 5 })?.wouldMeetAgain).toBe(true)
    expect(build({ atmosphereScore: 4 })?.wouldMeetAgain).toBe(true)
    // A lukewarm thermometer with no other signal is still not a positive.
    expect(build({ atmosphereScore: 3 })?.wouldMeetAgain).toBe(false)
  })

  it('treats a positive post-event connection status as wouldMeetAgain', () => {
    expect(build({ connectionStatus: '已交换联系方式' })?.wouldMeetAgain).toBe(true)
    expect(build({ connectionStatus: '有但还没联系' })?.wouldMeetAgain).toBe(true)
    expect(build({ connectionStatus: '没有不太合适' })?.wouldMeetAgain).toBe(false)
  })

  it('drops selections that are not actual group members from the radar', () => {
    const payload = build({ selectedConnections: ['member-a', 'stranger'] })

    expect(Object.keys(payload?.connectionRadar ?? {})).toEqual(MEMBERS)
    expect(payload?.connectionRadar).not.toHaveProperty('stranger')
  })

  it('returns null when the group or the member roster is unavailable', () => {
    expect(build({ groupId: '' })).toBeNull()
    expect(build({ groupId: '   ' })).toBeNull()
    expect(build({ memberUserIds: [] })).toBeNull()
  })

  it('returns null when every optional field was skipped (no false-negative rows)', () => {
    // rating 0, atmosphere 0, no selections, no connection status.
    expect(build()).toBeNull()
  })

  it('deduplicates and filters empty member ids', () => {
    const payload = build({ rating: 4, memberUserIds: ['member-a', 'member-a', '', 'member-b'] })

    expect(Object.keys(payload?.connectionRadar ?? {}).sort()).toEqual(['member-a', 'member-b'])
  })
})
