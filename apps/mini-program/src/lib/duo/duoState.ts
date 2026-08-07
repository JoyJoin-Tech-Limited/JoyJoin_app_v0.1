import type { DuoStatusState } from '../api/duo'

/**
 * Visual states of PoolRegistrationDuoCard (附录 H · A'-1 progressive disclosure):
 *   loading   — skeleton while the first duo-status fetch is in flight
 *   error     — local non-blocking error row; segmented renders as 1人 and stays usable
 *   collapsed — default single row (title + glyph + segmented)
 *   expanded  — 2人 selected (or an unshared invite exists), share CTA visible
 *   waiting   — invite shared (share-panel trigger timestamp exists), friend pending
 *   bound     — friend registered; duo is a hard matching unit
 */
export type DuoCardState = 'loading' | 'error' | 'collapsed' | 'expanded' | 'waiting' | 'bound'

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
}

/**
 * Resolve the card's visual state.
 *
 * - The bound state is always server-derived.
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
  if (input.mode === 'duo') return input.hasShared ? 'waiting' : 'expanded'
  return 'collapsed'
}
