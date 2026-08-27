/**
 * useGuidanceQueue — C4 guidance queue arbitration hook
 * (sprint-contract.c4-guidance-queue, 2026-08-27, C1–C3).
 *
 * Evaluation order (C2, locked by guidanceQueueContract.test.ts):
 *   flag check → isCeremonyActive() → tab-page route check → seenGuidance → fire
 *
 * Session semantics (C1): "session" = WeChat JS runtime lifetime (cold start
 * → process kill). Background→foreground does NOT reset the shown-set, and
 * swipe-back `useDidShow` re-fires do not either — the module-level
 * `sessionShownTipIds` is the sole session boundary and is AUTHORITATIVE
 * over the TanStack-cached `seenGuidance` payload (which is stale after a
 * dismiss until the next auth refetch). ≤1 tip mounts app-wide per session.
 *
 * Dismiss ordering (C3): the `POST /api/guidance/seen` write is COMMITTED
 * before the exit animation starts; a failed write keeps the tip eligible
 * next session (fail-safe + logged, never fail-silent).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import type { GuidanceTipId } from '@shared/api'
import {
  GUIDANCE_TIP_REGISTRY,
  isTabPageRoute,
  isTabPageSurface,
  type GuidanceSurface,
  type GuidanceTipDefinition,
} from '../lib/guidance/registry'
import { isCeremonyActive } from '../lib/guidance/ceremonyState'
import {
  consumeInheritedArrivalPending,
  isArrivalTipPending,
  runArrivalMigration,
} from '../lib/guidance/arrivalMigration'
import { markGuidanceSeen } from '../lib/guidance/guidanceApi'
import { discoverAnalytics } from '../lib/analytics/discoverAnalytics'
import { haptics } from '../lib/utils/haptics'
import { logWarn } from '../lib/utils/logger'
import type { AuthUser } from './useAuth'

export const GUIDANCE_TIP_DWELL_MS = 6000
export const GUIDANCE_TIP_EXIT_MS = 200

// ─── Session state (module-level — the ONLY session boundary, C1) ───
// Never reset outside tests: not on backgrounding, not on useDidShow.
const sessionShownTipIds = new Set<GuidanceTipId>()
let mountedTipId: GuidanceTipId | null = null

export function getMountedGuidanceTipId(): GuidanceTipId | null {
  return mountedTipId
}

export function getSessionShownTipIds(): ReadonlySet<GuidanceTipId> {
  return sessionShownTipIds
}

export interface GuidanceQueueEvalContext {
  flagEnabled: boolean
  surface: GuidanceSurface
  seenGuidance?: Record<string, string> | null
  arrivalPending: boolean
}

/**
 * Pure arbitration — exported for the contract test. Returns the tip to
 * fire, or null when any gate refuses.
 */
export function evaluateGuidanceQueue(ctx: GuidanceQueueEvalContext): GuidanceTipDefinition | null {
  // 1. Flag gate — the whole orchestrator ships dark.
  if (!ctx.flagEnabled) return null
  // 2. Ceremony suppression — hard refuse while any ceremony is active.
  if (isCeremonyActive()) return null
  // 3. Tab-page route gate — tips fire only on tab-page surfaces.
  if (!isTabPageSurface(ctx.surface)) return null
  // 4. ≤1 tip per session — the module-level shown-set is AUTHORITATIVE over
  //    the (possibly stale) cached seenGuidance payload.
  if (sessionShownTipIds.size > 0) return null
  if (mountedTipId) return null
  // 5. First eligible tip by priority: not seen server-side, trigger passes.
  const seen = ctx.seenGuidance ?? {}
  const eligible = GUIDANCE_TIP_REGISTRY
    .filter((tip) => tip.surface === ctx.surface)
    .filter((tip) => !sessionShownTipIds.has(tip.id))
    .filter((tip) => !seen[tip.id])
    .filter((tip) =>
      tip.trigger({
        surface: ctx.surface,
        seenGuidance: ctx.seenGuidance,
        arrivalPending: ctx.arrivalPending,
      }),
    )
    .sort((a, b) => a.priority - b.priority)
  return eligible[0] ?? null
}

export function markTipShown(tipId: GuidanceTipId): void {
  sessionShownTipIds.add(tipId)
  mountedTipId = tipId
}

export function unmountTip(tipId: GuidanceTipId): void {
  if (mountedTipId === tipId) mountedTipId = null
}

/** Test-only reset. Never call from product code. */
export function __resetGuidanceQueueForTests(): void {
  sessionShownTipIds.clear()
  mountedTipId = null
}

export type GuidanceDismissReason = 'button' | 'tap_through' | 'auto'

interface UseGuidanceQueueOptions {
  surface: GuidanceSurface
  user: AuthUser | undefined
}

export interface UseGuidanceQueueResult {
  activeTip: GuidanceTipDefinition | null
  exiting: boolean
  dismiss: (reason: GuidanceDismissReason) => void
}

export function useGuidanceQueue({ surface, user }: UseGuidanceQueueOptions): UseGuidanceQueueResult {
  const flagEnabled = user?.features?.guidanceQueueEnabled === true
  const userId = typeof user?.id === 'string' ? user.id : undefined
  const seenGuidance = (user?.seenGuidance ?? null) as Record<string, string> | null

  const [activeTip, setActiveTip] = useState<GuidanceTipDefinition | null>(null)
  const [exiting, setExiting] = useState(false)
  const activeTipRef = useRef<GuidanceTipDefinition | null>(null)
  activeTipRef.current = activeTip
  const exitingRef = useRef(false)
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // B1: one-time legacy arrival-coachmark backfill on first queue init with
  // the flag on (idempotent; see lib/guidance/arrivalMigration.ts).
  useEffect(() => {
    if (!flagEnabled || !userId) return
    void runArrivalMigration(userId)
  }, [flagEnabled, userId])

  const dismiss = useCallback(
    (reason: GuidanceDismissReason) => {
      const tip = activeTipRef.current
      if (!tip || exitingRef.current) return
      exitingRef.current = true
      if (reason !== 'auto') haptics('light')
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current)
        dwellTimerRef.current = null
      }
      // C3: the seen-write is COMMITTED BEFORE the exit animation starts.
      const persistPromise = markGuidanceSeen(tip.id)
      discoverAnalytics.track('guidance_dismissed', undefined, { tipId: tip.id, reason })
      // Exit animation starts only after the commit above is dispatched.
      setExiting(true)
      persistPromise
        .then(() => {
          // B1: the inherited `_pending` key is removed only now — after the
          // inherited tip's dismiss persisted server-side.
          if (tip.id === 'discover_arrival') consumeInheritedArrivalPending(userId)
        })
        .catch((error) => {
          // Fail-safe (never fail-silent): the server keeps no record, so the
          // tip stays eligible next session. Log + annotate analytics.
          logWarn('[GuidanceQueue] seen-write failed; tip remains eligible next session', {
            tipId: tip.id,
            error: error instanceof Error ? error.message : String(error),
          })
          discoverAnalytics.track('guidance_dismissed', undefined, {
            tipId: tip.id,
            reason,
            persistError: true,
          })
        })
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null
        unmountTip(tip.id)
        activeTipRef.current = null
        setActiveTip(null)
        setExiting(false)
        exitingRef.current = false
      }, GUIDANCE_TIP_EXIT_MS)
    },
    [userId],
  )
  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss

  const evaluate = useCallback(() => {
    if (activeTipRef.current || exitingRef.current) return
    if (!userId) return
    // Defense-in-depth on top of the surface allow-list inside
    // evaluateGuidanceQueue: refuse when the live route is known and is not
    // a tab page. When the router is unavailable, the surface gate stands.
    try {
      const routePath = (Taro.getCurrentInstance() as { router?: { path?: string } } | undefined)?.router?.path
      if (routePath && !isTabPageRoute(routePath)) return
    } catch {
      // Router unreadable — the surface allow-list gate still applies.
    }
    const tip = evaluateGuidanceQueue({
      flagEnabled,
      surface,
      seenGuidance,
      arrivalPending: isArrivalTipPending(userId),
    })
    if (!tip) return
    // Mark BEFORE mounting so a concurrent evaluation can never double-fire.
    markTipShown(tip.id)
    activeTipRef.current = tip
    setActiveTip(tip)
    discoverAnalytics.track('guidance_shown', undefined, { tipId: tip.id })
    dwellTimerRef.current = setTimeout(() => {
      dwellTimerRef.current = null
      dismissRef.current('auto')
    }, GUIDANCE_TIP_DWELL_MS)
  }, [flagEnabled, surface, seenGuidance, userId])

  // C2: evaluated on useDidShow + trigger events (auth payload / flag /
  // surface changes re-run the effect below; the shown-set blocks refires).
  useDidShow(() => {
    evaluate()
  })
  useEffect(() => {
    evaluate()
  }, [evaluate])

  // Unmount safety: release timers and the mount slot. Tab pages normally
  // stay alive in the WeChat nav stack; this covers reLaunch/process kill.
  useEffect(() => {
    return () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current)
        dwellTimerRef.current = null
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
      if (activeTipRef.current) unmountTip(activeTipRef.current.id)
    }
  }, [])

  return { activeTip, exiting, dismiss }
}
