/**
 * Guidance tip registry (C4 onboarding guidance iteration, 2026-08-27 —
 * sprint-contract.c4-guidance-queue, C5).
 *
 * Ordered tip definitions consumed by `hooks/useGuidanceQueue.ts`. The queue
 * evaluates this registry on tab-page `useDidShow` + trigger events and
 * fires the first eligible tip by ascending `priority`.
 *
 * INVARIANT (locked by guidanceQueueContract.test.ts): every registered tip
 * id MUST be a member of the shared `GUIDANCE_TIP_IDS` enum
 * (`packages/shared/src/api/guidance.ts`) — the server validates
 * `POST /api/guidance/seen` against that enum and a registry id it does not
 * know would 400 on dismiss. The contract test fails CI on any drift, so the
 * invariant can never degrade silently.
 *
 * W1 registers ONLY `discover_arrival` (absorbed from the legacy storage-
 * keyed arrival coachmark in pages/discover). Later waves APPEND tips here
 * (tab tips, spotlight, flash/blind-box entries) — never renumber existing
 * priorities.
 */

import type { GuidanceTipId } from '@shared/api'
import type { GuidanceTipCopyKey } from '@shared/copy/guidanceCopy'

/** Tab-page surfaces where the queue is allowed to fire. */
export type GuidanceSurface = 'discover' | 'events' | 'connections' | 'profile' | 'centerHub'

export const GUIDANCE_TAB_SURFACES: readonly GuidanceSurface[] = [
  'discover',
  'events',
  'connections',
  'profile',
  'centerHub',
] as const

/** Surface → owning tab-page route (C2 tab-page route gate). */
export const GUIDANCE_SURFACE_ROUTES: Record<GuidanceSurface, string> = {
  discover: 'pages/discover/index',
  events: 'pages/events/index',
  connections: 'pages/connections/index',
  profile: 'pages/profile/index',
  centerHub: 'pages/center-hub/index',
} as const

export function isTabPageSurface(surface: string): surface is GuidanceSurface {
  return (GUIDANCE_TAB_SURFACES as readonly string[]).includes(surface)
}

export function isTabPageRoute(routePath: string): boolean {
  const normalised = routePath.replace(/^\//, '')
  return Object.values(GUIDANCE_SURFACE_ROUTES).includes(normalised)
}

export interface GuidanceTriggerContext {
  userId?: string
  surface: GuidanceSurface
  /** Server-persisted seen-state from GET /api/auth/user (may be stale in-session). */
  seenGuidance?: Record<string, string> | null
  /** Legacy onboarding-completion signal (storage key inherited by arrivalMigration). */
  arrivalPending: boolean
}

export interface GuidanceTipDefinition {
  id: GuidanceTipId
  /** Lower fires first. */
  priority: number
  surface: GuidanceSurface
  trigger: (ctx: GuidanceTriggerContext) => boolean
  copyKey: GuidanceTipCopyKey
}

export const GUIDANCE_TIP_REGISTRY: readonly GuidanceTipDefinition[] = [
  {
    // W1: discover first-arrival coachmark. Fires only when the
    // onboarding-completion signal is pending (same gating as the legacy
    // storage-keyed path it absorbs — E1 behavior preservation).
    id: 'discover_arrival',
    priority: 10,
    surface: 'discover',
    trigger: (ctx) => ctx.arrivalPending,
    copyKey: 'discover_arrival',
  },
] as const
