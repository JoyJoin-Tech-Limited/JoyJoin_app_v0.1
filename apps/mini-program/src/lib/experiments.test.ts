import { describe, expect, it } from 'vitest'

import {
  bucketForSubject,
  hashExperimentSubject,
  resolveExperimentMarker,
} from './experiments'

describe('hashExperimentSubject', () => {
  it('is deterministic for the same subject', () => {
    expect(hashExperimentSubject('user-123')).toBe(hashExperimentSubject('user-123'))
  })

  it('produces different hashes for different subjects', () => {
    expect(hashExperimentSubject('user-123')).not.toBe(hashExperimentSubject('user-124'))
  })

  it('returns an unsigned 32-bit integer', () => {
    const hash = hashExperimentSubject('anything')
    expect(Number.isInteger(hash)).toBe(true)
    expect(hash).toBeGreaterThanOrEqual(0)
    expect(hash).toBeLessThanOrEqual(0xffffffff)
  })
})

describe('bucketForSubject', () => {
  it('is stable per flag + subject', () => {
    expect(bucketForSubject('flag-x', 'user-1')).toBe(bucketForSubject('flag-x', 'user-1'))
  })

  it('decorrelates the same subject across different flags', () => {
    // Not a strict guarantee per-flag, but across a sample of flags the same
    // user must not land in a single bucket everywhere.
    const buckets = new Set(
      Array.from({ length: 20 }, (_, index) => bucketForSubject(`flag-${index}`, 'user-1')),
    )
    expect(buckets.size).toBe(2)
  })

  it('reaches both buckets across a sample of subjects', () => {
    const buckets = new Set(
      Array.from({ length: 50 }, (_, index) => bucketForSubject('flag-x', `user-${index}`)),
    )
    expect(buckets).toEqual(new Set(['A', 'B']))
  })
})

describe('resolveExperimentMarker', () => {
  it('returns null when the flag is inactive', () => {
    expect(
      resolveExperimentMarker({ flagKey: 'flag-x', flagEnabled: false, userId: 'user-1' }),
    ).toBeNull()
    expect(
      resolveExperimentMarker({ flagKey: 'flag-x', userId: 'user-1' }),
    ).toBeNull()
  })

  it('returns null when no stable subject exists', () => {
    expect(
      resolveExperimentMarker({ flagKey: 'flag-x', flagEnabled: true }),
    ).toBeNull()
    expect(
      resolveExperimentMarker({ flagKey: 'flag-x', flagEnabled: true, userId: '', anonymousId: '  ' }),
    ).toBeNull()
  })

  it('prefers userId over anonymousId as the subject', () => {
    const marker = resolveExperimentMarker({
      flagKey: 'flag-x',
      flagEnabled: true,
      userId: 'user-1',
      anonymousId: 'anon-1',
    })
    expect(marker).toEqual({ flagKey: 'flag-x', bucket: bucketForSubject('flag-x', 'user-1') })
  })

  it('falls back to anonymousId for pre-login events', () => {
    const marker = resolveExperimentMarker({
      flagKey: 'flag-x',
      flagEnabled: true,
      anonymousId: 'anon-1',
    })
    expect(marker).toEqual({ flagKey: 'flag-x', bucket: bucketForSubject('flag-x', 'anon-1') })
  })
})
