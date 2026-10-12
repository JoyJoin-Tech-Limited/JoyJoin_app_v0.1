import { describe, expect, it } from 'vitest'
import {
  resolveDuoCardState,
  resolveInitialDuoMode,
  shouldAutoExpandDuoRow,
  type DuoCardStateInput,
} from './duoState'

function input(overrides: Partial<DuoCardStateInput> = {}): DuoCardStateInput {
  return {
    isLoading: false,
    isError: false,
    serverState: undefined,
    mode: 'solo',
    hasShared: false,
    ...overrides,
  }
}

describe('resolveDuoCardState', () => {
  it('defaults to the collapsed single-row state', () => {
    expect(resolveDuoCardState(input())).toBe('collapsed')
    expect(resolveDuoCardState(input({ serverState: 'none' }))).toBe('collapsed')
  })

  it('loading and local error take precedence over everything else', () => {
    expect(resolveDuoCardState(input({ isLoading: true, serverState: 'bound' }))).toBe('loading')
    expect(resolveDuoCardState(input({ isError: true, serverState: 'waiting', mode: 'duo' }))).toBe('error')
  })

  it('bound is always server-derived, even in solo mode', () => {
    expect(resolveDuoCardState(input({ serverState: 'bound', mode: 'solo' }))).toBe('bound')
    expect(resolveDuoCardState(input({ serverState: 'bound', mode: 'duo', hasShared: true }))).toBe('bound')
  })

  it('duo selection expands pre-share and waits post-share', () => {
    expect(resolveDuoCardState(input({ mode: 'duo' }))).toBe('expanded')
    expect(resolveDuoCardState(input({ mode: 'duo', hasShared: true }))).toBe('waiting')
  })

  it('picking 1人 back pre-share returns to collapsed (spec §A.5)', () => {
    expect(resolveDuoCardState(input({ serverState: 'waiting', mode: 'solo' }))).toBe('collapsed')
  })

  it('restores waiting from a share timestamp even if the server still says none', () => {
    expect(resolveDuoCardState(input({ serverState: 'none', mode: 'duo', hasShared: true }))).toBe('waiting')
  })
})

describe('resolveInitialDuoMode (audit C3 auto-expand)', () => {
  it('defaults to solo when no invite and no share timestamp', () => {
    expect(resolveInitialDuoMode({ inviteArrival: false, hasShareTimestamp: false })).toBe('solo')
  })

  it('pre-selects duo when the user arrived via an invite/referral code', () => {
    expect(resolveInitialDuoMode({ inviteArrival: true, hasShareTimestamp: false })).toBe('duo')
  })

  it('keeps the share-timestamp restore path intact', () => {
    expect(resolveInitialDuoMode({ inviteArrival: false, hasShareTimestamp: true })).toBe('duo')
    expect(resolveInitialDuoMode({ inviteArrival: true, hasShareTimestamp: true })).toBe('duo')
  })

  it('maps invite-arrival duo mode to the expanded card state (collapsed by default otherwise)', () => {
    const inviteMode = resolveInitialDuoMode({ inviteArrival: true, hasShareTimestamp: false })
    const defaultMode = resolveInitialDuoMode({ inviteArrival: false, hasShareTimestamp: false })
    expect(resolveDuoCardState(input({ mode: inviteMode }))).toBe('expanded')
    expect(resolveDuoCardState(input({ mode: defaultMode }))).toBe('collapsed')
  })
})

describe('shouldAutoExpandDuoRow (async invite-arrival guard)', () => {
  const base = {
    inviteArrival: true,
    currentMode: 'solo' as const,
    hasShared: false,
    hasUserInteracted: false,
    alreadyApplied: false,
  }

  it('fires once for a late-resolving invite code on a pristine solo card', () => {
    expect(shouldAutoExpandDuoRow(base)).toBe(true)
  })

  it('never fires without an invite arrival', () => {
    expect(shouldAutoExpandDuoRow({ ...base, inviteArrival: false })).toBe(false)
  })

  it('never overrides a user tap, a duo card, a shared card, or a second application', () => {
    expect(shouldAutoExpandDuoRow({ ...base, hasUserInteracted: true })).toBe(false)
    expect(shouldAutoExpandDuoRow({ ...base, currentMode: 'duo' })).toBe(false)
    expect(shouldAutoExpandDuoRow({ ...base, hasShared: true })).toBe(false)
    expect(shouldAutoExpandDuoRow({ ...base, alreadyApplied: true })).toBe(false)
  })
})
