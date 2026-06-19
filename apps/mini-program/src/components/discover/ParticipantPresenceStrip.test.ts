import { describe, it, expect } from 'vitest'
import { resolveStripState } from './ParticipantPresenceStrip'

describe('ParticipantPresenceStrip.resolveStripState', () => {
  it('returns empty when count is 0', () => {
    expect(resolveStripState(0, 6)).toBe('empty')
    expect(resolveStripState(0, undefined)).toBe('empty')
  })

  it('returns full when count reaches max', () => {
    expect(resolveStripState(6, 6)).toBe('full')
    expect(resolveStripState(8, 6)).toBe('full')
  })

  it('returns almost_full at or above 75% fill', () => {
    expect(resolveStripState(3, 4)).toBe('almost_full') // 75%
    expect(resolveStripState(4, 5)).toBe('almost_full') // 80%
  })

  it('returns almost_full when 2 or fewer spots remain', () => {
    expect(resolveStripState(4, 6)).toBe('almost_full') // 2 spots left
    expect(resolveStripState(5, 6)).toBe('almost_full') // 1 spot left
  })

  it('returns partial for low fill with many spots remaining', () => {
    expect(resolveStripState(1, 6)).toBe('partial')
    expect(resolveStripState(3, 6)).toBe('partial')
  })

  it('treats zero or invalid max as unbounded', () => {
    expect(resolveStripState(5, 0)).toBe('partial')
    expect(resolveStripState(5, -1)).toBe('partial')
  })
})
