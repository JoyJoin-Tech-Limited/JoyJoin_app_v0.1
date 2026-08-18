import { describe, expect, it } from 'vitest'

import { createAbandonGuard } from './abandonGuard'

describe('createAbandonGuard', () => {
  it('tracks exactly one abandonment per visit', () => {
    const guard = createAbandonGuard()
    expect(guard.shouldTrackAbandon()).toBe(true)
    // A second lifecycle signal for the same exit (hide + unload) is swallowed.
    expect(guard.shouldTrackAbandon()).toBe(false)
    expect(guard.shouldTrackAbandon()).toBe(false)
  })

  it('never tracks after the step completed', () => {
    const guard = createAbandonGuard()
    guard.markCompleted()
    expect(guard.shouldTrackAbandon()).toBe(false)
  })

  it('stays silent when completion happens before a duplicate lifecycle fire', () => {
    const guard = createAbandonGuard()
    guard.markCompleted()
    guard.reset()
    expect(guard.shouldTrackAbandon()).toBe(false)
  })

  it('re-arms on reset (user swipes back into the step, then leaves again)', () => {
    const guard = createAbandonGuard()
    expect(guard.shouldTrackAbandon()).toBe(true)
    guard.reset()
    expect(guard.shouldTrackAbandon()).toBe(true)
  })
})
