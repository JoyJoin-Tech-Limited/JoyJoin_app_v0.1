import { describe, expect, it } from 'vitest'
import {
  resolveDuoCardState,
  resolveDuoViewerRole,
  resolveInitialDuoMode,
  shouldAutoExpandDuoRow,
  shouldCreateDuoCode,
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

/**
 * S2 (contract duo-s2-invitee-role-separation, AC-1): the card state machine
 * gains a `role` dimension and a `guest` state for the pre-registration
 * invitee. The priority chain is locked entry by entry:
 *   loading → error → bound → guest → expanded → collapsed
 */
describe('resolveDuoCardState — S2 role/guest dimension (AC-1)', () => {
  it('inbound invite (isGuest, no inviter veto) returns guest — even in duo mode', () => {
    expect(resolveDuoCardState(input({ isGuest: true, role: 'invitee' }))).toBe('guest')
    expect(resolveDuoCardState(input({ isGuest: true, role: 'invitee', mode: 'duo' }))).toBe('guest')
    // A guest never has a share timestamp; defensively guest still wins.
    expect(
      resolveDuoCardState(input({ isGuest: true, role: 'invitee', mode: 'duo', hasShared: true })),
    ).toBe('guest')
  })

  it('priority: loading → error → bound each still beat guest', () => {
    expect(resolveDuoCardState(input({ isLoading: true, isGuest: true, role: 'invitee' }))).toBe('loading')
    expect(resolveDuoCardState(input({ isError: true, isGuest: true, role: 'invitee' }))).toBe('error')
    expect(
      resolveDuoCardState(input({ serverState: 'bound', isGuest: true, role: 'invitee' })),
    ).toBe('bound')
  })

  it('priority: guest → expanded → collapsed (guest beats duo mode; solo non-guest collapses)', () => {
    expect(resolveDuoCardState(input({ isGuest: true, role: 'invitee', mode: 'duo' }))).toBe('guest')
    expect(resolveDuoCardState(input({ mode: 'duo' }))).toBe('expanded')
    expect(resolveDuoCardState(input({ isGuest: true, role: 'invitee', mode: 'solo' }))).toBe('guest')
    expect(resolveDuoCardState(input({ mode: 'solo' }))).toBe('collapsed')
  })

  it('server inviter role vetoes the guest surface (inviter opening own share link)', () => {
    expect(resolveDuoCardState(input({ isGuest: true, role: 'inviter', mode: 'duo' }))).toBe('expanded')
    expect(
      resolveDuoCardState(input({ isGuest: true, role: 'inviter', mode: 'duo', hasShared: true })),
    ).toBe('waiting')
    expect(resolveDuoCardState(input({ isGuest: true, role: 'inviter' }))).toBe('collapsed')
  })

  it('no guest arrival → role alone never produces the guest state', () => {
    expect(resolveDuoCardState(input({ role: 'invitee', mode: 'duo' }))).toBe('expanded')
    expect(resolveDuoCardState(input({ role: 'invitee' }))).toBe('collapsed')
  })

  it('AC-6 regression: inviter-perspective legacy states are byte-identical without S2 inputs', () => {
    expect(resolveDuoCardState(input())).toBe('collapsed')
    expect(resolveDuoCardState(input({ serverState: 'none' }))).toBe('collapsed')
    expect(resolveDuoCardState(input({ serverState: 'bound', mode: 'solo' }))).toBe('bound')
    expect(resolveDuoCardState(input({ mode: 'duo' }))).toBe('expanded')
    expect(resolveDuoCardState(input({ mode: 'duo', hasShared: true }))).toBe('waiting')
    expect(resolveDuoCardState(input({ serverState: 'waiting', mode: 'solo' }))).toBe('collapsed')
  })
})

/**
 * S2 (AC-8): duo-status.viewerRole is the SOLE role authority; the public
 * lookup only fills the gaps it cannot speak to (pre-registration invitee by
 * S3 AC-0 design, duo-status network failure). Both fallback paths are
 * locked here — the client never derives a competing role from URL params.
 */
describe('resolveDuoViewerRole (AC-8 priority lock)', () => {
  it('server viewerRole wins over a positive lookup signal (inviter own-link case)', () => {
    expect(resolveDuoViewerRole({ viewerRole: 'inviter', isGuest: true })).toBe('inviter')
  })

  it('server viewerRole stands alone without any lookup signal', () => {
    expect(resolveDuoViewerRole({ viewerRole: 'invitee', isGuest: false })).toBe('invitee')
    expect(resolveDuoViewerRole({ viewerRole: 'inviter', isGuest: false })).toBe('inviter')
  })

  it('lookup fills the pre-registration gap (duo-status none → no viewerRole)', () => {
    expect(resolveDuoViewerRole({ viewerRole: undefined, isGuest: true })).toBe('invitee')
    expect(resolveDuoViewerRole({ viewerRole: null, isGuest: true })).toBe('invitee')
  })

  it('lookup is the network-failure fallback (same code path: viewerRole absent)', () => {
    // duo-status failed ⇒ viewerRole undefined ⇒ lookup decides — the two
    // AC-7 fallback cases (404/410 handled upstream ⇒ isGuest false).
    expect(resolveDuoViewerRole({ viewerRole: undefined, isGuest: true })).toBe('invitee')
  })

  it('no server role + no lookup signal → none (non-invitee, code creation allowed)', () => {
    expect(resolveDuoViewerRole({ viewerRole: undefined, isGuest: false })).toBe('none')
    expect(resolveDuoViewerRole({ viewerRole: null, isGuest: false })).toBe('none')
    expect(resolveDuoViewerRole({ isGuest: false })).toBe('none')
  })

  it('an unknown server value is not a role (defensive)', () => {
    expect(resolveDuoViewerRole({ viewerRole: 'stranger' as never, isGuest: true })).toBe('invitee')
    expect(resolveDuoViewerRole({ viewerRole: 'stranger' as never, isGuest: false })).toBe('none')
  })
})

/** S2 (AC-2): display state is decoupled from code-creation intent. */
describe('shouldCreateDuoCode (AC-2)', () => {
  it('an invitee NEVER creates a code — even with the segmented displaying 2人', () => {
    expect(shouldCreateDuoCode({ role: 'invitee', mode: 'duo' })).toBe(false)
    expect(shouldCreateDuoCode({ role: 'invitee', mode: 'solo' })).toBe(false)
  })

  it('inviter / none create only in duo mode', () => {
    expect(shouldCreateDuoCode({ role: 'inviter', mode: 'duo' })).toBe(true)
    expect(shouldCreateDuoCode({ role: 'none', mode: 'duo' })).toBe(true)
    expect(shouldCreateDuoCode({ role: 'inviter', mode: 'solo' })).toBe(false)
    expect(shouldCreateDuoCode({ role: 'none', mode: 'solo' })).toBe(false)
  })
})
