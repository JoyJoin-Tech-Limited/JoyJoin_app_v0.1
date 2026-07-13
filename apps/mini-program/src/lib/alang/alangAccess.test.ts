import { describe, expect, it } from 'vitest'
import {
  shouldShowAlangDebugTools,
  shouldShowAlangEntry,
} from './alangAccess'

describe('Alang access gates', () => {
  it('shows product entry points in staging when alangEnabled is true', () => {
    // appMode is a single-test marker, so staging without single-test mode is
    // represented as "production" in the client-safe auth response.
    expect(shouldShowAlangEntry({
      appMode: 'production',
      features: { alangEnabled: true },
    })).toBe(true)
  })

  it('hides product entry points in staging when alangEnabled is false', () => {
    expect(shouldShowAlangEntry({
      appMode: 'test',
      features: { alangEnabled: false },
    })).toBe(false)
  })

  it('hides product entry points in production when alangEnabled is false', () => {
    expect(shouldShowAlangEntry({
      appMode: 'production',
      features: { alangEnabled: false },
    })).toBe(false)
  })

  it('shows product entry points in production only when the flag is enabled', () => {
    expect(shouldShowAlangEntry({
      appMode: 'production',
      features: { alangEnabled: true },
    })).toBe(true)
  })

  it('does not expose debug tools without single-test mode', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'production',
      features: { alangEnabled: true },
    })).toBe(false)
  })

  it('exposes debug tools only when both single-test mode and Alang are enabled', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'test',
      features: { alangEnabled: true },
    })).toBe(true)
  })
})
