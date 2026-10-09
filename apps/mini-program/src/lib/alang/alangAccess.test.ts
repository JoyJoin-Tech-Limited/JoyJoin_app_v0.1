import { describe, expect, it } from 'vitest'
import {
  isStreetBlindBoxLive,
  shouldShowAlangDebugTools,
  shouldShowAlangEntry,
  shouldShowStreetBlindBoxEntry,
} from './alangAccess'

describe('Alang access gates', () => {
  it('keeps the formal Street Blind Box entry enabled independently of legacy Alang', () => {
    expect(shouldShowStreetBlindBoxEntry()).toBe(true)
  })

  // isStreetBlindBoxLive (sprint_20261009_flash_teaser_mode): the Discover
  // entry stays visible in both modes; this gate decides live vs teaser.
  it('is live only when alangEnabled is explicitly true', () => {
    expect(isStreetBlindBoxLive({ features: { alangEnabled: true } })).toBe(true)
    expect(isStreetBlindBoxLive({ features: { alangEnabled: false } })).toBe(false)
  })

  it('fails closed to teaser mode when the features map or flag is missing', () => {
    expect(isStreetBlindBoxLive(null)).toBe(false)
    expect(isStreetBlindBoxLive(undefined)).toBe(false)
    expect(isStreetBlindBoxLive({})).toBe(false)
    expect(isStreetBlindBoxLive({ features: {} })).toBe(false)
  })

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
      singleTestMode: false,
      features: { alangEnabled: true },
    })).toBe(false)
  })

  it('exposes debug tools in staging when the server enables single-test mode', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'test',
      singleTestMode: true,
      features: { alangEnabled: true },
    })).toBe(true)
  })

  it('exposes debug tools in local test mode', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'test',
      singleTestMode: true,
      features: { alangEnabled: true },
    })).toBe(true)
  })

  it('fails closed in production even if a stale single-test marker is present', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'production',
      singleTestMode: true,
      features: { alangEnabled: true },
    })).toBe(false)
  })

  it('requires the explicit server marker instead of inferring from appMode alone', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'test',
      features: { alangEnabled: true },
    })).toBe(false)
  })
})
