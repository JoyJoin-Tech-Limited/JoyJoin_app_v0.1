import { describe, expect, it } from 'vitest'
import { resolveDeviceTier } from './useDeviceTier'

describe('resolveDeviceTier', () => {
  // Regression guard: the previous implementation inverted the WeChat
  // benchmarkLevel scale and treated high-end Android devices as degradation.
  // WeChat scale: 1 = low-end, 50 = high-end.
  it('treats benchmarkLevel 1 as degradation (low-end)', () => {
    expect(resolveDeviceTier({ benchmarkLevel: 1 })).toEqual({
      tier: 'degradation',
      benchmarkLevel: 1,
      isPrimary: false,
      isDegradation: true,
    })
  })

  it('treats benchmarkLevel 15 as degradation (low-end threshold)', () => {
    expect(resolveDeviceTier({ benchmarkLevel: 15 })).toEqual({
      tier: 'degradation',
      benchmarkLevel: 15,
      isPrimary: false,
      isDegradation: true,
    })
  })

  it('treats benchmarkLevel 30 as primary (capable Android)', () => {
    expect(resolveDeviceTier({ benchmarkLevel: 30 })).toEqual({
      tier: 'primary',
      benchmarkLevel: 30,
      isPrimary: true,
      isDegradation: false,
    })
  })

  it('treats benchmarkLevel 50 as primary (high-end)', () => {
    expect(resolveDeviceTier({ benchmarkLevel: 50 })).toEqual({
      tier: 'primary',
      benchmarkLevel: 50,
      isPrimary: true,
      isDegradation: false,
    })
  })

  it('treats zero benchmark as unknown and degrades safely', () => {
    // WeChat returns 0 when benchmarkLevel is unsupported. Without any other
    // signal we should not optimistically treat the device as high-end.
    expect(resolveDeviceTier({ benchmarkLevel: 0 })).toEqual({
      tier: 'degradation',
      benchmarkLevel: 0,
      isPrimary: false,
      isDegradation: true,
    })
  })

  it('treats unsupported benchmark on a modern iPhone as primary via model heuristic', () => {
    expect(resolveDeviceTier({ model: 'iPhone 14', system: 'iOS 16.0', benchmarkLevel: 0 })).toEqual({
      tier: 'primary',
      benchmarkLevel: 0,
      isPrimary: true,
      isDegradation: false,
    })
  })

  it('flags old iPhone models as degradation', () => {
    expect(resolveDeviceTier({ model: 'iPhone X', system: 'iOS 16.0' })).toEqual({
      tier: 'degradation',
      benchmarkLevel: null,
      isPrimary: false,
      isDegradation: true,
    })
  })

  it('flags old iOS versions as degradation', () => {
    expect(resolveDeviceTier({ model: 'iPhone 12', system: 'iOS 14.0' })).toEqual({
      tier: 'degradation',
      benchmarkLevel: null,
      isPrimary: false,
      isDegradation: true,
    })
  })

  it('treats recent iPhones on recent iOS as primary', () => {
    expect(resolveDeviceTier({ model: 'iPhone 14', system: 'iOS 16.0' })).toEqual({
      tier: 'primary',
      benchmarkLevel: null,
      isPrimary: true,
      isDegradation: false,
    })
  })

  it('treats iPhone XR as primary (modern A12)', () => {
    expect(resolveDeviceTier({ model: 'iPhone XR', system: 'iOS 16.0' })).toEqual({
      tier: 'primary',
      benchmarkLevel: null,
      isPrimary: true,
      isDegradation: false,
    })
  })

  it('treats iPhone XS as primary (modern A12)', () => {
    expect(resolveDeviceTier({ model: 'iPhone XS', system: 'iOS 16.0' })).toEqual({
      tier: 'primary',
      benchmarkLevel: null,
      isPrimary: true,
      isDegradation: false,
    })
  })

  it('treats iPhone XS Max as primary (modern A12)', () => {
    expect(resolveDeviceTier({ model: 'iPhone XS Max', system: 'iOS 16.0' })).toEqual({
      tier: 'primary',
      benchmarkLevel: null,
      isPrimary: true,
      isDegradation: false,
    })
  })

  it('treats iPhone SE (2nd generation) as primary (A13)', () => {
    expect(resolveDeviceTier({ model: 'iPhone SE (2nd generation)', system: 'iOS 16.0' })).toEqual({
      tier: 'primary',
      benchmarkLevel: null,
      isPrimary: true,
      isDegradation: false,
    })
  })

  it('treats iPhone SE (3rd generation) as primary (A15)', () => {
    expect(resolveDeviceTier({ model: 'iPhone SE (3rd generation)', system: 'iOS 16.0' })).toEqual({
      tier: 'primary',
      benchmarkLevel: null,
      isPrimary: true,
      isDegradation: false,
    })
  })

  it('treats first-gen iPhone SE as degradation', () => {
    expect(resolveDeviceTier({ model: 'iPhone SE', system: 'iOS 15.0' })).toEqual({
      tier: 'degradation',
      benchmarkLevel: null,
      isPrimary: false,
      isDegradation: true,
    })
  })
})
