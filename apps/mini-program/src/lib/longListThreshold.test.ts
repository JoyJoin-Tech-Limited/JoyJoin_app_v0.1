import { describe, expect, it } from 'vitest'
import { isLongListRowCount, MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD } from './longListThreshold'

describe('longListThreshold', () => {
  it('does not flag at or below threshold', () => {
    expect(isLongListRowCount(0)).toBe(false)
    expect(isLongListRowCount(MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD)).toBe(false)
  })

  it('flags above threshold', () => {
    expect(isLongListRowCount(MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD + 1)).toBe(true)
  })
})
