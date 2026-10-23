import type { DuoRole, DuoStatusState } from '../api/duo'

/**
 * Visual states of PoolRegistrationDuoCard (附录 H · A'-1 progressive disclosure):
 *   loading   — skeleton while the first duo-status fetch is in flight
 *   error     — local non-blocking error row; segmented renders as 1人 and stays usable
 *   collapsed — default single row (title + glyph + segmented)
 *   expanded  — 2人 selected (or an unshared invite exists), share CTA visible
 *   waiting   — invite shared (share-panel trigger timestamp exists), friend pending
 *   bound     — friend registered; duo is a hard matching unit
 *   guest     — S2: pre-registration invitee; two-line note card, zero buttons
 */
export type DuoCardState = 'loading' | 'error' | 'collapsed' | 'expanded' | 'waiting' | 'bound' | 'guest'

/**
 * S2 (AC-1): which side of a duo pair the viewer is on; 'none' = no pair
 * involvement (a pre-registration invitee resolves to 'invitee' via the
 * public lookup — see resolveDuoViewerRole).
 */
export type DuoViewerRole = DuoRole | 'none'

export interface DuoCardStateInput {
  /** True only while the very first duo-status fetch is in flight (no data yet). */
  isLoading: boolean
  /** Local (non-blocking) fetch failure. */
  isError: boolean
  /** Server-reported duo state; undefined when the fetch failed or has not landed. */
  serverState?: DuoStatusState
  /** Local segmented selection. Synced to 'duo' when the server reports waiting/bound. */
  mode: 'solo' | 'duo'
  /** True when a share-panel trigger timestamp exists for this pool (storage restore). */
  hasShared: boolean
  /**
   * S2 (AC-8): resolved viewer role (duo-status.viewerRole is the sole
   * authority; the public lookup only fills the gaps it cannot speak to).
   * Undefined behaves as 'none'.
   */
  role?: DuoViewerRole
  /**
   * S2 (D-1): guest arrival — the current showDuoBanner condition
   * (isDuoInvite && lookup active && poolId match && !invalid), plus the
   * lookup-in-flight window (D-8 skeleton). A session-level duoDeclinedSolo
   * flag suppresses this entirely (D-6).
   */
  isGuest?: boolean
}

/**
 * Resolve the card's visual state.
 *
 * Priority (S2, AC-1 — locked by unit tests):
 *   loading → error → bound → guest → expanded → collapsed
 * (`waiting` is the mode='duo' + hasShared branch of the expanded tier.)
 *
 * - The bound state is always server-derived.
 * - `guest` requires a positive guest arrival AND no server-side inviter
 *   veto: an inviter opening their own share link (duo=1 + own code) keeps
 *   their normal inviter card because duo-status.viewerRole='inviter' wins
 *   over the lookup signal (AC-8, single role authority).
 * - `waiting` requires a share-panel trigger timestamp (WeChat has no share
 *   completion callback, so the trigger time in storage is the only signal).
 *   A server `waiting` without a local share (e.g. invite created on another
 *   device) shows `expanded` so the share CTA stays reachable.
 * - Picking 1人 back before sharing returns to `collapsed` (spec §A.5); the
 *   server-side code is retained but harmless without a binding.
 */
export function resolveDuoCardState(input: DuoCardStateInput): DuoCardState {
  if (input.isLoading) return 'loading'
  if (input.isError) return 'error'
  if (input.serverState === 'bound') return 'bound'
  if (input.isGuest && input.role !== 'inviter') return 'guest'
  if (input.mode === 'duo') return input.hasShared ? 'waiting' : 'expanded'
  return 'collapsed'
}

/**
 * S2 (AC-8): resolve the viewer's duo role.
 *
 * duo-status.viewerRole is the SOLE authority whenever it is present — the
 * client never overrides a server-provided role with URL parameters (client
 * and server must not each derive their own role). The public code
 * lookup only fills the two gaps duo-status structurally cannot speak to
 * (S3 AC-0):
 *   1. Pre-registration invitee — invitation_uses rows are written at
 *      registration time, so duo-status stays `none` (no viewerRole) until
 *      then; the lookup is their only role signal BY DESIGN.
 *   2. duo-status network failure — the lookup is the fallback.
 * Both paths are locked by tests; a missing/invalid lookup yields 'none'
 * (non-invitee behavior: code creation stays allowed, Reliability pillar).
 */
export function resolveDuoViewerRole(input: {
  /** duo-status.viewerRole — the sole authority when present. */
  viewerRole?: DuoRole | null
  /** Guest arrival from the public lookup (see DuoCardStateInput.isGuest). */
  isGuest: boolean
}): DuoViewerRole {
  if (input.viewerRole === 'inviter' || input.viewerRole === 'invitee') {
    return input.viewerRole
  }
  return input.isGuest ? 'invitee' : 'none'
}

/**
 * S2 (AC-2): display state is decoupled from code-creation intent. An
 * invitee's segmented DISPLAYS 2人 (mode='duo') but must never POST
 * /duo-invites — creating a code would fork them into a second pair.
 */
export function shouldCreateDuoCode(input: { role: DuoViewerRole; mode: 'solo' | 'duo' }): boolean {
  return input.mode === 'duo' && input.role !== 'invitee'
}

/**
 * Audit C3 (2026-10-11): invite/referral arrival auto-expand.
 *
 * A user landing on pool-registration with a resolved invitation code (duo
 * share link, pool-scoped referral link, or a session-carried pending code)
 * arrived BECAUSE of someone in this pool — the duo row should open expanded
 * (2人 selected, share CTA visible) instead of staying a collapsed footnote.
 *
 * This is a LOCAL initial selection only: it never creates a duo invite on
 * the server (that stays behind the explicit 2人 tap in `selectDuoMode`),
 * never touches MAX-1-duo matching rules, and picking 1人 collapses back per
 * spec §A.5. Pure + exported for unit coverage; the hook applies it
 * ref-guarded (initializer for the sync URL-param case, one-shot effect for
 * the async session-fallback case).
 */
export function resolveInitialDuoMode(input: {
  inviteArrival: boolean
  hasShareTimestamp: boolean
}): 'solo' | 'duo' {
  return input.inviteArrival || input.hasShareTimestamp ? 'duo' : 'solo'
}

/**
 * One-shot guard for the async auto-expand (e.g. `user.pendingReferralCode`
 * resolves after mount). Never overrides a user's own tap, never re-fires,
 * never flips a card that is already in duo mode or has shared.
 */
export function shouldAutoExpandDuoRow(input: {
  inviteArrival: boolean
  currentMode: 'solo' | 'duo'
  hasShared: boolean
  hasUserInteracted: boolean
  alreadyApplied: boolean
}): boolean {
  if (!input.inviteArrival) return false
  if (input.alreadyApplied || input.hasUserInteracted) return false
  if (input.currentMode !== 'solo' || input.hasShared) return false
  return true
}
