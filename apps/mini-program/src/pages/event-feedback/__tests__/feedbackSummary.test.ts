import { describe, expect, it } from 'vitest'
import { buildWrapupSummaryParts, formatEventDayLabel } from '../feedbackSummary'

// 2026-10-16 extraction: both derivations are pure display rules with real
// edge cases. The summary's "all-empty → render nothing" rule is the only
// thing preventing a dangling `·` line above the CTA, and the day label must
// be derived in business time (+08:00) so a traveller in another timezone
// still sees the calendar day the event happened in China.

describe('formatEventDayLabel (2026-10-16 #13)', () => {
  it('returns null for missing or unparseable dateTime', () => {
    expect(formatEventDayLabel(null)).toBeNull()
    expect(formatEventDayLabel(undefined)).toBeNull()
    expect(formatEventDayLabel('')).toBeNull()
    expect(formatEventDayLabel('not-a-date')).toBeNull()
  })

  it('anchors a daytime UTC instant to the business-time calendar day', () => {
    expect(formatEventDayLabel('2026-10-15T11:00:00.000Z')).toBe('10.15')
  })

  it('rolls over to the next day at 16:00Z (00:00 +08:00)', () => {
    expect(formatEventDayLabel('2026-10-15T16:30:00.000Z')).toBe('10.16')
    expect(formatEventDayLabel('2026-10-15T15:59:00.000Z')).toBe('10.15')
  })

  it('does not pad single-digit months or days', () => {
    expect(formatEventDayLabel('2027-01-03T02:00:00.000Z')).toBe('1.3')
  })
})

describe('buildWrapupSummaryParts (2026-10-16 #14)', () => {
  const attendees = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const empty = {
    attendees,
    attendeeTraits: {},
    improvementAreas: [],
    comment: '',
  }

  it('renders nothing when every optional field is empty', () => {
    expect(buildWrapupSummaryParts(empty)).toEqual([])
  })

  it('counts tagged attendees only when the tag list is non-empty', () => {
    expect(
      buildWrapupSummaryParts({
        ...empty,
        attendeeTraits: {
          a: { tags: ['有趣'], note: '' },
          b: { tags: [], note: '' },
        },
      }),
    ).toEqual(['1 位伙伴的印象'])
  })

  it('does not count whitespace-only notes', () => {
    expect(
      buildWrapupSummaryParts({
        ...empty,
        attendeeTraits: { a: { tags: [], note: '   ' } },
      }),
    ).toEqual([])
  })

  it('counts notes independently from tags', () => {
    expect(
      buildWrapupSummaryParts({
        ...empty,
        attendeeTraits: {
          a: { tags: [], note: '想说的话' },
          b: { tags: ['温暖'], note: '' },
        },
      }),
    ).toEqual(['1 位伙伴的印象', '1 条印象补充'])
  })

  it('joins all four parts in the fixed order', () => {
    expect(
      buildWrapupSummaryParts({
        attendees,
        attendeeTraits: {
          a: { tags: ['有趣'], note: '想说' },
          b: { tags: ['温暖'], note: '' },
        },
        improvementAreas: ['场地'],
        comment: '总体不错',
      }),
    ).toEqual(['2 位伙伴的印象', '1 条印象补充', '1 条建议', '留言'])
  })

  it('ignores trait entries for attendees that are not on the wrap-up screen', () => {
    expect(
      buildWrapupSummaryParts({
        ...empty,
        attendeeTraits: { ghost: { tags: ['有趣'], note: '不该出现' } },
      }),
    ).toEqual([])
  })

  it('treats a cleared (whitespace) comment as absent', () => {
    expect(buildWrapupSummaryParts({ ...empty, comment: '   ' })).toEqual([])
  })
})
