import { describe, expect, it } from 'vitest'
import {
  isStreetBlindBoxLive,
  resolveStreetBlindBoxMode,
  shouldShowAlangDebugTools,
  shouldShowAlangEntry,
  shouldShowStreetBlindBoxEntry,
} from './alangAccess'

describe('Alang access gates', () => {
  it('shows the Street Blind Box entry only when the entry switch is on', () => {
    expect(shouldShowStreetBlindBoxEntry({ features: { alangEntryEnabled: true } })).toBe(true)
    expect(
      shouldShowStreetBlindBoxEntry({ features: { alangEntryEnabled: false, alangEnabled: true } }),
    ).toBe(false)
    expect(shouldShowStreetBlindBoxEntry(null)).toBe(false)
    expect(shouldShowStreetBlindBoxEntry(undefined)).toBe(false)
    expect(shouldShowStreetBlindBoxEntry({})).toBe(false)
    expect(shouldShowStreetBlindBoxEntry({ features: {} })).toBe(false)
  })

  // The entry switch is the outer shelf gate; the master switch still decides
  // live vs teaser once the entry is visible.
  it('is live only when the entry switch and alangEnabled are both true', () => {
    expect(
      isStreetBlindBoxLive({ features: { alangEntryEnabled: true, alangEnabled: true } }),
    ).toBe(true)
    expect(
      isStreetBlindBoxLive({ features: { alangEntryEnabled: true, alangEnabled: false } }),
    ).toBe(false)
    expect(
      isStreetBlindBoxLive({ features: { alangEntryEnabled: false, alangEnabled: true } }),
    ).toBe(false)
  })

  it('fails closed when the features map or either flag is missing', () => {
    expect(isStreetBlindBoxLive(null)).toBe(false)
    expect(isStreetBlindBoxLive(undefined)).toBe(false)
    expect(isStreetBlindBoxLive({})).toBe(false)
    expect(isStreetBlindBoxLive({ features: {} })).toBe(false)
    expect(isStreetBlindBoxLive({ features: { alangEntryEnabled: true } })).toBe(false)
    expect(isStreetBlindBoxLive({ features: { alangEnabled: true } })).toBe(false)
  })

  it('shows product entry points in staging only when both switches are true', () => {
    // appMode is a single-test marker, so staging without single-test mode is
    // represented as "production" in the client-safe auth response.
    expect(shouldShowAlangEntry({
      appMode: 'production',
      features: { alangEntryEnabled: true, alangEnabled: true },
    })).toBe(true)
  })

  it('hides product entry points in staging when the master switch is false', () => {
    expect(shouldShowAlangEntry({
      appMode: 'test',
      features: { alangEntryEnabled: true, alangEnabled: false },
    })).toBe(false)
  })

  it('hides product entry points in production when alangEnabled is false', () => {
    expect(shouldShowAlangEntry({
      appMode: 'production',
      features: { alangEntryEnabled: true, alangEnabled: false },
    })).toBe(false)
  })

  it('hides product entry points even when the master switch is on if the entry is shelved', () => {
    expect(shouldShowAlangEntry({
      appMode: 'production',
      features: { alangEntryEnabled: false, alangEnabled: true },
    })).toBe(false)
  })

  it('shows product entry points in production only when both flags are enabled', () => {
    expect(shouldShowAlangEntry({
      appMode: 'production',
      features: { alangEntryEnabled: true, alangEnabled: true },
    })).toBe(true)
  })

  it('does not expose debug tools without single-test mode', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'production',
      singleTestMode: false,
      features: { alangEntryEnabled: true, alangEnabled: true },
    })).toBe(false)
  })

  it('exposes debug tools in staging when the server enables single-test mode', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'test',
      singleTestMode: true,
      features: { alangEntryEnabled: true, alangEnabled: true },
    })).toBe(true)
  })

  it('exposes debug tools in local test mode', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'test',
      singleTestMode: true,
      features: { alangEntryEnabled: true, alangEnabled: true },
    })).toBe(true)
  })

  it('fails closed in production even if a stale single-test marker is present', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'production',
      singleTestMode: true,
      features: { alangEntryEnabled: true, alangEnabled: true },
    })).toBe(false)
  })

  it('requires the explicit server marker instead of inferring from appMode alone', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'test',
      features: { alangEntryEnabled: true, alangEnabled: true },
    })).toBe(false)
  })

  it('does not expose debug tools while the entry is shelved', () => {
    expect(shouldShowAlangDebugTools({
      appMode: 'test',
      singleTestMode: true,
      features: { alangEntryEnabled: false, alangEnabled: true },
    })).toBe(false)
  })
})

describe('resolveStreetBlindBoxMode', () => {
  it('resolves live only when both switches are on', () => {
    expect(resolveStreetBlindBoxMode({
      features: { alangEntryEnabled: true, alangEnabled: true },
    })).toBe('live')
  })

  it('resolves teaser whenever the entry switch is off, even if the master switch is on', () => {
    expect(resolveStreetBlindBoxMode({
      features: { alangEntryEnabled: false, alangEnabled: true },
    })).toBe('teaser')
    expect(resolveStreetBlindBoxMode({
      features: { alangEntryEnabled: false, alangEnabled: false },
    })).toBe('teaser')
    expect(resolveStreetBlindBoxMode({
      features: { alangEntryEnabled: true, alangEnabled: false },
    })).toBe('teaser')
  })

  it('is unresolved while auth has not settled', () => {
    expect(resolveStreetBlindBoxMode(undefined, { authPending: true })).toBe('unresolved')
    expect(
      resolveStreetBlindBoxMode(
        { features: { alangEntryEnabled: true, alangEnabled: false } },
        { authPending: true },
      ),
    ).toBe('unresolved')
    expect(
      resolveStreetBlindBoxMode(
        { features: { alangEntryEnabled: true, alangEnabled: true } },
        { authPending: true },
      ),
    ).toBe('unresolved')
  })

  it('does not read an authenticated payload without entry/master flags as "feature off"', () => {
    expect(resolveStreetBlindBoxMode({})).toBe('unresolved')
    expect(resolveStreetBlindBoxMode({ features: {} })).toBe('unresolved')
    expect(
      resolveStreetBlindBoxMode({ features: { alangEntryEnabled: true } }),
    ).toBe('unresolved')
  })

  it('keeps a settled guest fail-closed to the teaser', () => {
    expect(resolveStreetBlindBoxMode(null)).toBe('teaser')
    expect(resolveStreetBlindBoxMode(undefined)).toBe('teaser')
  })
})
