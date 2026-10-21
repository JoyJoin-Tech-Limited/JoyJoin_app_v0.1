import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getGuestEventPreview, type GuestEventPreviewItem } from '@shared/api'
import { apiRequest } from '../../lib/api/api'
import { haptics } from '../../lib/utils/haptics'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { markGuestPreviewLoginPending } from '../../lib/analytics/guestPreviewLoginPending'
import GuestEventPreviewCard, {
  getGuestPreviewCardVariant,
  type GuestEventPreviewMotionPhase,
} from './GuestEventPreviewCard'

/**
 * GuestEventPreviewSection — 转化 P1c (2026-10-20).
 *
 * Owns data fetch, wow orchestration, and guest-funnel analytics for the
 * 2–3 read-only guest event cards on the personality-results page.
 *
 * Fail-closed contract (AC-09):
 *   - guest-only: authenticated users / auth still loading → byte-level null;
 *   - endpoint empty / errored / timed out → byte-level null (server already
 *     fail-closes flag OFF and supply <3 to `200 + []`);
 *   - IntersectionObserver unavailable or throws → static direct render
 *     (content fully readable, zero motion, never invisible);
 *   - reduced-motion → static direct render (animation durations collapse to
 *     the end state).
 *
 * Orchestration (design §5.3.5): one-shot only —
 *   trigger = IntersectionObserver threshold 0.3, once, disconnect after;
 *   cards rise translateY(24rpx→0)+opacity 400ms, stagger 90ms, vignette
 *   Ken Burns 1.04→1.0 same frame/curve; hook line 350ms starting +530ms
 *   (total 880ms ≤1000ms) with haptics('light') on settle; start gate
 *   ≥400ms after FinalStage mount (slot celebration completed long before
 *   the 'result' stage mounts this tree — the gate is belt-and-braces).
 */

const GUEST_PREVIEW_QUERY_KEY = ['mini-program', 'guest-event-preview']
const SECTION_OBSERVER_ID = 'guest-event-preview-section'
const OBSERVER_THRESHOLD = 0.3
const MAX_RENDER_COUNT = 3

/** ≥400ms settle isolation from the slot celebration / stage mount. */
const MIN_SETTLE_GAP_MS = 400
/** Hook-line entrance start (ms after choreography start). 530 = card3
 *  (stagger 180ms) + 350ms; the hook settles at 530 + 350 = 880ms, matching
 *  the design doc's stated total (≈880ms, ≤1000ms). */
const HOOK_LINE_DELAY_MS = 530
const HOOK_LINE_ENTRANCE_MS = 350
/** Watchdog: if the observer is created but its callback never arrives
 *  (silent no-fire), the 'pre' phase would keep the cards invisible
 *  forever — fail closed to the static direct render after this window. */
const OBSERVER_WATCHDOG_MS = 2_500

interface GuestEventPreviewSectionProps {
  isAuthenticated: boolean
  authIsLoading: boolean
  /** Existing results-page login path (the continue CTA handler). */
  onLoginRequest: () => void
}

export default function GuestEventPreviewSection({
  isAuthenticated,
  authIsLoading,
  onLoginRequest,
}: GuestEventPreviewSectionProps) {
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])

  // Guest-only fetch: the enabled gate means authenticated users never
  // trigger a request, and data stays undefined while auth resolves.
  const { data } = useQuery<GuestEventPreviewItem[]>({
    queryKey: GUEST_PREVIEW_QUERY_KEY,
    queryFn: () => getGuestEventPreview(apiRequest),
    enabled: !authIsLoading && !isAuthenticated,
    retry: 0,
    staleTime: 60_000,
  })

  const items = useMemo(() => (data ?? []).slice(0, MAX_RENDER_COUNT), [data])

  const [motionPhase, setMotionPhase] = useState<GuestEventPreviewMotionPhase>(
    () => (reduceMotion ? 'static' : 'pre'),
  )

  // Render-assigned ref (results-page precedent: clearSharePosterRef) so the
  // observer/impression closures always read the freshest items without
  // re-creating the observer on every data identity change.
  const itemsRef = useRef(items)
  itemsRef.current = items

  const mountTimeRef = useRef(Date.now())
  const impressionFiredRef = useRef(false)
  const triggeredRef = useRef(false)
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fireImpression = useCallback(() => {
    if (impressionFiredRef.current) return
    impressionFiredRef.current = true
    const current = itemsRef.current
    if (current.length === 0) return
    discoverAnalytics.trackGuestPreviewCardImpression({
      // Render-decision variant of the first (hero) card — vignette asset
      // mapped vs cream fallback. beginGuestAttempt() mints the attempt id
      // inside the emitter (first-in-viewport = this exact instant).
      variant: getGuestPreviewCardVariant(current[0].eventType),
      supplyCount: current.length,
    })
  }, [])

  // Static paths (reduced-motion / observer unavailable): impression fires
  // at render time — the cards are visible, so the funnel denominator holds.
  useEffect(() => {
    if (items.length === 0 || motionPhase !== 'static') return
    fireImpression()
  }, [items.length, motionPhase, fireImpression])

  // Hook-line settle haptic — scheduled from the entered phase itself (its
  // own effect), NOT from the observer effect: the observer effect's cleanup
  // runs exactly when the phase flips and would cancel any timer it owns.
  useEffect(() => {
    if (motionPhase !== 'entered') return
    const hapticTimer = setTimeout(() => {
      haptics('light')
    }, HOOK_LINE_DELAY_MS + HOOK_LINE_ENTRANCE_MS)
    return () => clearTimeout(hapticTimer)
  }, [motionPhase])

  // One-shot observer choreography. Any failure at ANY step fails closed to
  // the static direct render — never to invisibility.
  useEffect(() => {
    if (items.length === 0 || motionPhase !== 'pre' || reduceMotion) return

    let observer: ReturnType<typeof Taro.createIntersectionObserver> | null = null
    let startTimer: ReturnType<typeof setTimeout> | null = null
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      try {
        observer?.disconnect?.()
      } catch {
        // Best-effort; never throw in teardown.
      }
      if (startTimer) clearTimeout(startTimer)
      startTimer = null
      if (watchdogTimer) clearTimeout(watchdogTimer)
      watchdogTimer = null
    }

    const startChoreography = () => {
      if (!mountedRef.current || triggeredRef.current) return
      triggeredRef.current = true
      // Impression = first-in-viewport instant, same moment as the
      // orchestration trigger (spec: 首次进入视口 = 编排触发同一时机).
      fireImpression()
      // ≥400ms settle isolation after FinalStage mount; choreography
      // otherwise starts immediately at the observer trigger.
      const elapsed = Date.now() - mountTimeRef.current
      const waitMs = Math.max(0, MIN_SETTLE_GAP_MS - elapsed)
      startTimer = setTimeout(() => {
        if (!mountedRef.current) return
        setMotionPhase('entered')
      }, waitMs)
    }

    try {
      const page = Taro.getCurrentInstance()?.page as unknown as Record<string, unknown> | undefined
      if (!page) {
        setMotionPhase('static')
        return
      }
      observer = Taro.createIntersectionObserver(page, {
        thresholds: [OBSERVER_THRESHOLD],
        // WeChat-recommended faster path (HeroPromoBanner precedent).
        nativeMode: true,
      } as Taro.createIntersectionObserver.Option)
    } catch {
      setMotionPhase('static')
      return
    }
    if (!observer) {
      setMotionPhase('static')
      return
    }

    try {
      observer
        .relativeToViewport()
        .observe(`#${SECTION_OBSERVER_ID}`, (res: any) => {
          if (res && Number(res.intersectionRatio) >= OBSERVER_THRESHOLD) {
            // Once-only: disconnect immediately, never re-fire.
            cleanup()
            startChoreography()
          }
        })
    } catch {
      setMotionPhase('static')
      return
    }

    // Watchdog (audit CONCERN C3): observer exists but callback never fires
    // → never let the section sit in the invisible 'pre' phase. Only armed
    // after observe() succeeded; a fired choreography (triggeredRef) or any
    // teardown (cleanup) disarms it.
    watchdogTimer = setTimeout(() => {
      watchdogTimer = null
      if (!mountedRef.current || triggeredRef.current) return
      setMotionPhase('static')
    }, OBSERVER_WATCHDOG_MS)

    return cleanup
  }, [items.length, motionPhase, reduceMotion, fireImpression])

  const handleCardTap = useCallback(() => {
    haptics('light')
    // Card tap routes to the existing results-page login wall — the same
    // modal-confirm → WeChat login path as the continue CTA.
    discoverAnalytics.trackGuestPreviewCardTap({ destination: 'login' })
    discoverAnalytics.trackGuestPreviewLoginTap({ surface: 'guest_preview_card' })
    markGuestPreviewLoginPending()
    onLoginRequest()
  }, [onLoginRequest])

  // Fail-closed render: nothing while auth resolves or for authenticated
  // users; nothing for empty/errored/timed-out supply (byte-level null).
  if (authIsLoading || isAuthenticated) return null
  if (items.length === 0) return null

  const hookClass = [
    'guest-event-preview__hook',
    motionPhase === 'pre' ? 'guest-event-preview__hook--pre' : '',
    motionPhase === 'entered' ? 'guest-event-preview__hook--entered' : '',
  ].filter(Boolean).join(' ')

  // C1=A (2026-10-21 user call, rubric report fix): hook = supply-fact bridge
  // sentence; N comes from the live preview query (server gate ≥3 + cap ≤3 →
  // the rendered count is always the true preview count, never fabricated).
  // The retired login-nudge line duplicated the login CTA below;
  // FinalStage's next-horizon keeps the single emotional hook.
  const hookText = `这周有 ${items.length} 场正在排桌`

  return (
    <View className='guest-event-preview' id={SECTION_OBSERVER_ID}>
      <View className='guest-event-preview__cards'>
        {items.map((item, index) => (
          <GuestEventPreviewCard
            key={item.id}
            item={item}
            index={index}
            motionPhase={motionPhase}
            onTap={handleCardTap}
          />
        ))}
      </View>
      <Text className={hookClass}>{hookText}</Text>
    </View>
  )
}
