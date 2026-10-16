import { View, Text, Button, Input, Image, ScrollView, Canvas } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import {
  validateWechatContactId,
  WECHAT_CONTACT_ID_MAX_LENGTH,
  WECHAT_ID_FORMAT_HINT,
  WECHAT_ID_WCID_PREFIX_HINT,
  WECHAT_ID_SET_ONCE_HINT,
} from '@shared/wechatContactId'
import { getEventFeedbackState, getEventParticipants, getMyPoolRegistrations, type AuthUserResponse, type EventParticipantSummary } from '@shared/api'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import { apiRequest } from '../../lib/api/api'
import { queryClient } from '../../lib/api/queryClient'
import { AUTH_QUERY_KEY } from '../../lib/api/authSession'
import { CONNECTIONS_SHELL_QUERY_KEY, EVENTS_SHELL_QUERY_KEY, JOINED_EVENTS_QUERY_KEY, REGISTRATIONS_QUERY_KEY } from '../../lib/prefetchEngine'
import { evictPersistedQuery } from '../../lib/api/persistentCache'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { trackFeedbackEvent } from '../../lib/analytics/feedbackAnalytics'
import { getMascotDisplayName } from '../../lib/mascot/mascotDisplay'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { haptics } from '../../lib/utils/haptics'
import { logInfo, logError } from '../../lib/utils/logger'
import { TOAST_DEFAULT_MS } from '../../lib/utils/uiConstants'
import RatingFace from '../../components/ui/RatingFace'
import JoyJoinLoadingScreen from '../../components/loading/JoyJoinLoadingScreen'
import StatusCard from '../../components/ui/StatusCard'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import { ParticleBurst } from '../../components/reveal'
import { getSystemReducedMotionCompat } from '../../lib/utils/systemInfo'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import Card from '../../components/ui/Card'
import {
  ATMOSPHERE_LABELS,
  CONNECTION_STATUS_OPTIONS,
  MAX_IMPROVEMENT_AREAS,
  MAX_TAGS_PER_ATTENDEE,
  RADAR_DIMENSIONS,
  VENUE_STYLE_OPTIONS,
  type ConnectionRadarState,
  type ConnectionStatusLiteral,
  type RadarKey,
  type VenueStyleLiteral,
} from './feedbackOptions'
import { buildEventFeedbackPayload, type AttendeeTraitInput } from './feedbackPayload'
import { buildGroupOutcomePayload } from './groupOutcomePayload'
import { formatEventDayLabel } from './feedbackSummary'
import ParticipantAvatar from './steps/ParticipantAvatar'
import ConnectionsStep from './steps/ConnectionsStep'
import WrapupStep from './steps/WrapupStep'
import { KEEPSAKE_CARD_CANVAS_ID } from './keepsakeCard'
import { useKeepsakeCard } from './hooks/useKeepsakeCard'
import './index.scss'

interface MutualMatch {
  userId: string
  displayName: string
  archetype: string | null
  wechatContactId: string | null
}

// 2026-08-15 merge: the old 6-screen flow (rating → connections → comment →
// invite → deep-atmosphere → deep-people) folded into 3 screens. The rating
// faces and the 均衡反馈 deep fields all describe the same event experience, so
// they now share one screen; the invite interstitial is gone.
// 2026-10-16: 'wechat' is a CONDITIONAL step between connections and wrapup —
// it renders only when the user picked ≥1 person, has no 微信号 on file, and
// the wechatIdCollectionEnabled feature flag is on (spec §3).
type FeedbackStep =
  | 'experience'
  | 'connections'
  | 'wechat'
  | 'wrapup'
  | 'revealed'

/** Base ordered interactive steps (revealed is the terminal celebration, not
 *  a step). When the wechat collection step applies, the flow runs
 *  WECHAT_STEP_ORDER instead. */
const FEEDBACK_STEP_ORDER: Array<Exclude<FeedbackStep, 'revealed'>> = ['experience', 'connections', 'wrapup']

/** 4-step order with the conditional 微信号 collection step in play. */
const WECHAT_STEP_ORDER: Array<Exclude<FeedbackStep, 'revealed'>> = ['experience', 'connections', 'wechat', 'wrapup']

/** Progress dots — the flow had no sense of place before (2026-07-28).
 *  2026-10-16 Batch A (item 2): the denominator is VISIT-STABLE — the page
 *  passes `dotSteps`, keyed off collection eligibility (flag + no ID on
 *  file), never off the live selection count, so the dots no longer flip
 *  3→4 mid-flow when the user picks someone. Past steps render a solid
 *  --done dot; the current step keeps the elongated --active capsule, so
 *  the final step still reads "you are here". */
function renderStepProgress(
  current: Exclude<FeedbackStep, 'revealed'>,
  order: ReadonlyArray<Exclude<FeedbackStep, 'revealed'>> = FEEDBACK_STEP_ORDER,
) {
  const activeIndex = order.indexOf(current)
  return (
    <View className='event-feedback__progress' aria-hidden='true'>
      {order.map((stepId, index) => (
        <View
          key={stepId}
          className={`event-feedback__progress-dot ${index < activeIndex ? 'event-feedback__progress-dot--done' : ''} ${index === activeIndex ? 'event-feedback__progress-dot--active' : ''}`}
        />
      ))}
    </View>
  )
}

// Pre-ship (2026-10-16 USA audit): at the moment of failure the format rule
// must not vanish — the hint slot is taken by the error (item 11, one voice),
// so the error itself restates the rule.
const WECHAT_ID_FORMAT_ERROR = `微信号格式不太对：${WECHAT_ID_FORMAT_HINT}`

// ─── Balanced layer primitives (均衡反馈) ──────────────────────────────────
// The thermometer and the connection radar share ONE 1-5 dot language (灯格):
// the same ScaleDots primitive, only the dot size differs.

interface ScaleDotsProps {
  value: number
  onChange: (value: number) => void
  labels?: readonly string[]
  ariaGroupLabel: string
  compact?: boolean
  /**
   * Batch C item 4 (2026-10-16): radar rows show scale copy ONLY once a value
   * is selected — the row mounts on first selection and non-active anchors
   * stay invisible (opacity only) so the active word keeps its dot position.
   * The thermometer leaves this off: its anchors are always visible.
   */
  selectedOnlyLabels?: boolean
}

function ScaleDots({ value, onChange, labels, ariaGroupLabel, compact = false, selectedOnlyLabels = false }: ScaleDotsProps) {
  return (
    <View
      className={`event-feedback__scale ${compact ? 'event-feedback__scale--compact' : ''}`}
      role='radiogroup'
      aria-label={ariaGroupLabel}
    >
      <View className='event-feedback__scale-dots'>
        {Array.from({ length: 5 }, (_, index) => {
          const dotValue = index + 1
          const isLit = value >= dotValue
          return (
            <View
              key={index}
              className={`event-feedback__scale-dot ${isLit ? 'event-feedback__scale-dot--lit' : ''}`}
              hoverClass='event-feedback__scale-dot--pressed'
              role='radio'
              aria-checked={value === dotValue}
              aria-label={`${labels?.[index] ?? `${dotValue} 分`}`}
              onClick={() => {
                haptics('light')
                onChange(dotValue)
              }}
            />
          )
        })}
      </View>
      {labels && (!selectedOnlyLabels || value > 0) ? (
        <View className='event-feedback__scale-labels'>
          {labels.map((label, index) => (
            <Text
              key={label}
              className={`event-feedback__scale-label ${value === index + 1 ? 'event-feedback__scale-label--active' : ''} ${selectedOnlyLabels && value !== index + 1 ? 'event-feedback__scale-label--hidden' : ''}`}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** 氛围温度计 — horizontal 1-5 scale with an animated fill track. */
function Thermometer({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View className='event-feedback__thermo'>
      <ScaleDots
        value={value}
        onChange={onChange}
        labels={ATMOSPHERE_LABELS}
        ariaGroupLabel='氛围温度计，1 到 5 分'
      />
      <View className='event-feedback__thermo-track' aria-hidden='true'>
        <View
          className='event-feedback__thermo-fill'
          // G13 (2026-08-07 audit): fill ends at the CENTER of the selected dot
          // (dot centers sit at 10/30/50/70/90% of the row), not at the column edge.
          style={{ transform: `scaleX(${value > 0 ? (value - 0.5) / 5 : 0})` }}
        />
      </View>
    </View>
  )
}

/** One radar dimension — label + hint above a compact 5-dot scale. */
function RadarScale({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <View className='event-feedback__radar-row'>
      <View className='event-feedback__radar-head'>
        <Text className='event-feedback__radar-label'>{label}</Text>
        <Text className='event-feedback__radar-hint'>{hint}</Text>
      </View>
      <ScaleDots
        value={value}
        onChange={onChange}
        ariaGroupLabel={`${label}，1 到 5 分`}
        compact
        // Batch C item 4: same shared 灯格 anchors as the thermometer, shown
        // only once a value is selected (quiet confirmation, no label noise).
        labels={ATMOSPHERE_LABELS}
        selectedOnlyLabels
      />
    </View>
  )
}

/** Selectable pill — venue style + connection status share this surface. */
function SelectPill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <View
      className={`event-feedback__select-pill ${selected ? 'event-feedback__select-pill--selected' : ''}`}
      hoverClass='event-feedback__select-pill--pressed'
      role='radio'
      aria-checked={selected}
      onClick={onClick}
    >
      <Text className='event-feedback__select-pill-label'>{label}</Text>
      {selected && <Text className='event-feedback__select-pill-check'>✓</Text>}
    </View>
  )
}

export default function EventFeedbackPage() {
  const router = useRouter()
  const eventId = router.params.id ?? ''
  const { user: currentUser, isLoading: authLoading } = useAuthGuard()
  const currentUserId = currentUser?.id

  // Source attribution (PM plan §7): recap push / events tab / event detail /
  // in-app notification deep links carry `from`; unknown or absent values omit
  // the metadata key rather than polluting the enum.
  const fromParam = router.params.from ?? ''
  const feedbackSource = ['recap_push', 'events_tab', 'event_detail', 'notification'].includes(fromParam)
    ? fromParam
    : undefined

  const [step, setStep] = useState<FeedbackStep>('experience')
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedConnections, setSelectedConnections] = useState<string[]>([])
  const [mutualMatches, setMutualMatches] = useState<MutualMatch[]>([])
  // ─── Balanced layer state (均衡反馈) — every field is optional ───
  const [atmosphereScore, setAtmosphereScore] = useState(0)
  const [radar, setRadar] = useState<ConnectionRadarState>({
    topicResonance: 0,
    personalityMatch: 0,
    backgroundDiversity: 0,
    overallFit: 0,
  })
  const [venueStyleRating, setVenueStyleRating] = useState<VenueStyleLiteral | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusLiteral | null>(null)
  const [attendeeTraits, setAttendeeTraits] = useState<Record<string, { tags: string[]; note: string }>>({})
  const [improvementAreas, setImprovementAreas] = useState<string[]>([])
  // Batch C item 5 (2026-10-16): progressive disclosure on the experience
  // step — radar + venue/status collapse behind a 「再多评几项（可选）」
  // expander (default collapsed). Values live in page state, so collapsing
  // after interacting never loses input; the payload path is unchanged.
  const [deepExpanded, setDeepExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Tier-S wait (M1): optimistic 已提交 flip shown the instant the user taps —
  // the POST runs in the background; on error the button reverts.
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  // C5 — Fires success haptic only once per revealed-entry (ref guard prevents re-fire on re-render)
  const revealedHapticFiredRef = useRef(false)
  // G6 (2026-08-07 audit): CDN failure fallback for the mascot badge.
  // 2026-10-16 Batch A (item 1): the ceremony hero scene was retired — the
  // mascot badge is the single mascot moment on the revealed screen.
  const [mascotFailed, setMascotFailed] = useState(false)

  // ─── 微信号采集（2026-10-16, spec wechat-id-collection-spec-20261016）─────
  // A: conditional step between connections and wrapup. `wechatSaved` is the
  // payload gate — typing alone never sends the ID; only an explicit valid
  // 保存并继续 (or the remedy card) does.
  const [wechatIdInput, setWechatIdInput] = useState('')
  const [wechatSaved, setWechatSaved] = useState(false)
  const [wechatError, setWechatError] = useState('')
  // C: remedy card on the revealed page for users who skipped A but landed a
  // mutual match. remedySaving is a submit-transient flag (reset on re-show);
  // the input value deliberately survives swipe-back.
  const [remedyInput, setRemedyInput] = useState('')
  const [remedySaving, setRemedySaving] = useState(false)
  const [remedySaved, setRemedySaved] = useState(false)
  const [remedyError, setRemedyError] = useState('')

  // G12 (2026-08-07 audit): a swipe-back mid-submit would otherwise leave the
  // CTA stuck in 提交中… — reset the transient flag when the page is re-shown.
  // 2026-08-15: also reset the optimistic submitted flip so the button does not
  // show 已提交 while clickable after returning from swipe-back.
  // 2026-10-16: remedySaving joins the reset set (remedy card mid-save swipe).
  useResetOnShow(setIsSubmitting, setSubmitted, setRemedySaving)

  // ─── Entry gate (2026-10-16 feedback activation, PM plan §3) ─────────────
  // The lifecycle state is server-computed (opens at dateTime+3h, eligibility
  // checked there); recap-push deep links and bookmarked URLs must not bypass
  // it. Fail-closed: a failed lookup never opens the form.
  const {
    data: feedbackStateData,
    isLoading: feedbackStateLoading,
    isError: feedbackStateError,
    refetch: refetchFeedbackState,
  } = useQuery({
    queryKey: ['mini-program', 'event-feedback-state', eventId],
    queryFn: () => getEventFeedbackState(apiRequest, eventId),
    enabled: !!eventId && !authLoading && !!currentUserId,
    staleTime: 30_000,
    retry: 1,
  })
  const feedbackState = feedbackStateData?.state

  // feedback_page_open (PM plan §7): once per mount, with source attribution
  // when the deep link carried a known `from`.
  const pageOpenTrackedRef = useRef(false)
  useEffect(() => {
    if (pageOpenTrackedRef.current || !eventId) return
    pageOpenTrackedRef.current = true
    trackFeedbackEvent('feedback_page_open', {
      eventId,
      ...(feedbackSource ? { source: feedbackSource } : {}),
    })
  }, [eventId, feedbackSource])

  // Already submitted → land directly on the thank-you state (direct URL
  // visits / re-entries). Derived at render (not via an effect) so the form
  // never flashes for one frame; in-session submits setStep('revealed')
  // themselves, which this mirrors.
  const effectiveStep: FeedbackStep = feedbackState === 'submitted' ? 'revealed' : step

  // C5 — Fire success haptic when entering the revealed step (effect, not render)
  useEffect(() => {
    if (effectiveStep === 'revealed' && !revealedHapticFiredRef.current) {
      revealedHapticFiredRef.current = true
      haptics('success')
    }
  }, [effectiveStep])

  // ─── 微信号采集 step gating (spec §3) ───────────────────────────────────
  // Flag-gated, intent-gated, set-once: only users who picked ≥1 person AND
  // have no 微信号 on file AND have the feature enabled ever see the step.
  // Stable within a visit — neither selections nor the auth user can change
  // while sitting on the wechat/wrapup steps (no selection UI there).
  const wechatCollectionEnabled = !!currentUser?.features?.wechatIdCollectionEnabled
  const needWechatStep =
    wechatCollectionEnabled &&
    selectedConnections.length > 0 &&
    !currentUser?.wechatContactId
  // Batch A item 2 (2026-10-16): dot denominator is VISIT-STABLE — keyed off
  // collection eligibility (flag + no ID on file), NOT the live selection
  // count, so picking someone no longer flips the dots 3→4 mid-flow. Only
  // the dot contract rides this list; the wechat step's render gating stays
  // selection-dependent via needWechatStep.
  const dotSteps: Array<Exclude<FeedbackStep, 'revealed'>> =
    wechatCollectionEnabled && !currentUser?.wechatContactId
      ? WECHAT_STEP_ORDER
      : FEEDBACK_STEP_ORDER

  // feedback_wechat_step_shown: once per visit, the anchor of the
  // shown → saved/skipped collection funnel.
  const wechatStepTrackedRef = useRef(false)
  useEffect(() => {
    if (effectiveStep !== 'wechat' || wechatStepTrackedRef.current || !eventId) return
    wechatStepTrackedRef.current = true
    trackFeedbackEvent('feedback_wechat_step_shown', { eventId })
  }, [effectiveStep, eventId])

  /** Optimistically mirror a freshly-saved 微信号 into the auth cache so the
   *  revealed remedy gate (and any other surface keying off
   *  currentUser.wechatContactId) settles without a round-trip. */
  const syncWechatIdToAuthCache = useCallback((id: string) => {
    queryClient.setQueryData(AUTH_QUERY_KEY, (old: AuthUserResponse | undefined) =>
      old ? { ...old, wechatContactId: id } : old,
    )
  }, [])

  const { data: participants = [], isLoading: participantsLoading, isError: participantsError } = useQuery<EventParticipantSummary[]>({
    queryKey: ['mini-program', 'event-participants', eventId],
    queryFn: async () => {
      // The server already excludes the viewer; keep the client filter as a
      // defensive no-op against stale cached shapes.
      const res = await getEventParticipants(apiRequest, eventId)
      return res.filter((p) => p.id !== currentUserId)
    },
    // The roster is only needed once the gate says open — locked / ineligible /
    // submitted visits never render the form.
    enabled: !!eventId && !authLoading && !!currentUserId && feedbackState === 'open',
  })

  // W4 (AC-W4.2a): resolve the caller's matched group for this event so the
  // feedback submission can also feed the canonical outcome pipeline
  // (event_group_outcomes → match_history). Pool events use the pool id as the
  // routed event id (see joinedEventsRepo), so a registration whose poolId
  // matches the route param identifies the matched group. Reuses the shared
  // registrations cache key — no extra round-trip on the common path.
  const { data: poolRegistrations } = useQuery({
    queryKey: REGISTRATIONS_QUERY_KEY,
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled: !!eventId && !authLoading && !!currentUserId,
  })

  // 「10.15 那局」title anchor — reuses the shared registrations cache, no
  // extra request; falls back to 「这局」 when the date is unavailable.
  const eventDayLabel = formatEventDayLabel(
    poolRegistrations?.find((registration) => registration.poolId === eventId)?.poolDateTime,
  )

  // Step-view funnel (2026-10-16 polish batch): once per step per visit, gated
  // to the states that actually render the form/celebration.
  const stepViewTrackedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!eventId) return
    if (feedbackState !== 'open' && feedbackState !== 'submitted') return
    if (stepViewTrackedRef.current.has(effectiveStep)) return
    stepViewTrackedRef.current.add(effectiveStep)
    trackFeedbackEvent('feedback_step_view', { eventId, step: effectiveStep })
  }, [eventId, feedbackState, effectiveStep])

  // Archetype identity telemetry (2026-10-16): null-archetype fallback rate +
  // same-table archetype collisions, fired once per roster load. Enum/count
  // metadata only — never names.
  const archetypeTelemetryFiredRef = useRef(false)
  useEffect(() => {
    if (archetypeTelemetryFiredRef.current || !eventId || participants.length === 0) return
    archetypeTelemetryFiredRef.current = true
    const resolvedIds = participants.map((p) =>
      p.archetype ? resolveArchetype(p.archetype)?.id ?? null : null,
    )
    const nullCount = resolvedIds.filter((id) => id === null).length
    if (nullCount > 0) {
      trackFeedbackEvent('feedback_archetype_fallback', {
        eventId,
        reason: 'null_archetype',
        count: nullCount,
      })
    }
    const known = resolvedIds.filter((id): id is string => id !== null)
    if (new Set(known).size < known.length) {
      trackFeedbackEvent('feedback_archetype_collision', { eventId })
    }
  }, [eventId, participants])

  // Archetype asset double-fail telemetry (2026-10-16): the head asset 404s on
  // BOTH the bundled-local and CDN tiers — on the wrapup's fallback='none'
  // surface that otherwise renders as an empty ring with no signal. Emitted at
  // most once per participant per visit (ref Set), count=1 so the server-side
  // SUM(count) stays valid across both fallback reasons.
  const archetypeAssetFailRef = useRef<Set<string>>(new Set())
  const handleArchetypeAssetError = useCallback(
    (participantId: string) => {
      if (archetypeAssetFailRef.current.has(participantId)) return
      archetypeAssetFailRef.current.add(participantId)
      trackFeedbackEvent('feedback_archetype_fallback', {
        eventId,
        reason: 'asset_double_fail',
        count: 1,
      })
    },
    [eventId],
  )

  /**
   * Best-effort canonical outcome submission. Runs AFTER the primary feedback
   * POST succeeded and never blocks or fails the user's submission — the
   * learning pipeline must not degrade the feedback UX.
   *
   * Distinguishes "registrations not resolved yet" from "resolved, but no
   * matched group": the shared registrations cache can still be in flight on a
   * cold start, and silently returning there would drop the outcome (the exact
   * fuel-line gap W4 set out to close). When unresolved we block the
   * fire-and-forget promise on `ensureQueryData` instead of losing the write.
   */
  const submitGroupOutcome = useCallback(async () => {
    let matchedRegistration = poolRegistrations?.find(
      (registration) => registration.poolId === eventId && !!registration.assignedGroupId,
    )
    if (!poolRegistrations) {
      try {
        const registrations = await queryClient.ensureQueryData({
          queryKey: REGISTRATIONS_QUERY_KEY,
          queryFn: () => getMyPoolRegistrations(apiRequest),
        })
        matchedRegistration = registrations.find(
          (registration) => registration.poolId === eventId && !!registration.assignedGroupId,
        )
      } catch (err) {
        logError('[EventFeedback] Group outcome skipped: registrations unavailable', {
          eventId,
          message: err instanceof Error ? err.message : String(err),
        })
        return
      }
    }
    if (!matchedRegistration?.assignedGroupId) {
      logInfo('[EventFeedback] Group outcome skipped: no matched group for this event', { eventId })
      return
    }
    const payload = buildGroupOutcomePayload({
      groupId: matchedRegistration.assignedGroupId,
      rating,
      atmosphereScore,
      connectionStatus,
      selectedConnections,
      memberUserIds: participants.map((participant) => participant.id),
    })
    if (!payload) {
      logInfo('[EventFeedback] Group outcome skipped: no usable feedback signal', { eventId })
      return
    }
    try {
      void apiRequest({
        path: `/api/event-pools/${encodeURIComponent(matchedRegistration.poolId)}/group-outcome`,
        method: 'POST',
        data: payload,
      }).catch((err) => {
        logError('[EventFeedback] Group outcome submission failed', {
          message: err instanceof Error ? err.message : String(err),
        })
      })
    } catch (err) {
      // Defensive: a synchronous throw while dispatching must never bubble into
      // the feedback submit flow (the caller fires this callback-and-forgets).
      logError('[EventFeedback] Group outcome dispatch threw', {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }, [
    poolRegistrations,
    eventId,
    rating,
    atmosphereScore,
    connectionStatus,
    selectedConnections,
    participants,
  ])

  // Balanced-layer funnel (2026-08-15 merge): the invite interstitial is gone
  // and the deep fields are inline, so "engaged" = the FIRST deep field the
  // user touches (thermometer / radar / venue / status / trait tag / improve
  // chip). Fired exactly once per page visit.
  const deepEngagedRef = useRef(false)
  const markDeepEngaged = useCallback(() => {
    if (deepEngagedRef.current) return
    deepEngagedRef.current = true
    trackFeedbackEvent('feedback_deep_engaged', { eventId })
  }, [eventId])

  const toggleConnection = useCallback((userId: string) => {
    setSelectedConnections((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }, [])

  // Up to MAX_TAGS_PER_ATTENDEE tags per person; a 4th tap is ignored.
  const toggleAttendeeTag = useCallback((userId: string, tag: string) => {
    const entry = attendeeTraits[userId] ?? { tags: [], note: '' }
    const has = entry.tags.includes(tag)
    if (!has && entry.tags.length >= MAX_TAGS_PER_ATTENDEE) return
    markDeepEngaged()
    if (!has) trackFeedbackEvent('feedback_attendee_tag_selected', { eventId, tag })
    setAttendeeTraits((prev) => {
      const current = prev[userId] ?? { tags: [], note: '' }
      const currentHas = current.tags.includes(tag)
      if (!currentHas && current.tags.length >= MAX_TAGS_PER_ATTENDEE) return prev
      return {
        ...prev,
        [userId]: {
          ...current,
          tags: currentHas ? current.tags.filter((t) => t !== tag) : [...current.tags, tag],
        },
      }
    })
  }, [attendeeTraits, markDeepEngaged, eventId])

  const setAttendeeNote = useCallback((userId: string, note: string) => {
    setAttendeeTraits((prev) => ({
      ...prev,
      [userId]: { tags: prev[userId]?.tags ?? [], note },
    }))
  }, [])

  // 印象补充 focus telemetry — once per person per visit.
  const noteFocusTrackedRef = useRef<Set<string>>(new Set())
  const trackNoteFocus = useCallback((userId: string) => {
    if (noteFocusTrackedRef.current.has(userId)) return
    noteFocusTrackedRef.current.add(userId)
    trackFeedbackEvent('feedback_attendee_note_focus', { eventId })
  }, [eventId])

  const setRadarDimension = useCallback((key: RadarKey, value: number) => {
    markDeepEngaged()
    setRadar((prev) => ({ ...prev, [key]: value }))
  }, [markDeepEngaged])

  // Up to MAX_IMPROVEMENT_AREAS areas; further taps are ignored.
  const toggleImprovementArea = useCallback((area: string) => {
    setImprovementAreas((prev) => {
      if (prev.includes(area)) {
        markDeepEngaged()
        return prev.filter((a) => a !== area)
      }
      if (prev.length >= MAX_IMPROVEMENT_AREAS) return prev
      markDeepEngaged()
      return [...prev, area]
    })
  }, [markDeepEngaged])

  const handleSubmit = useCallback(async () => {
    if (!eventId || isSubmitting) return

    setIsSubmitting(true)
    setSubmitted(true)
    setError('')
    try {
      logInfo('[EventFeedback] Submitting', { eventId, rating, connections: selectedConnections.length })
      const attendeeTraitsPayload: Record<string, AttendeeTraitInput> = {}
      for (const [userId, entry] of Object.entries(attendeeTraits)) {
        // Only keep impressions for people still selected on the connections
        // step — if a user unchecks someone, their tags/notes must not be
        // submitted (completeness-audit P1, 2026-08-15).
        if (!selectedConnections.includes(userId)) continue
        const participant = participants.find((p) => p.id === userId)
        attendeeTraitsPayload[userId] = {
          displayName: participant?.displayName || participant?.firstName || '参与者',
          tags: entry.tags,
          improvementNote: entry.note,
        }
      }
      // 2026-08-15 merge: deep fields are inline, so the balanced payload is
      // always sent — buildEventFeedbackPayload drops untouched fields, and the
      // server's hasDeepFeedback / XP tier keys off CONTENT, not the client path.
      // The same content check drives the feedback_deep_submitted funnel event.
      const hasDeepFields =
        atmosphereScore > 0 ||
        venueStyleRating !== null ||
        connectionStatus !== null ||
        improvementAreas.length > 0 ||
        Object.values(radar).some((value) => value > 0) ||
        Object.values(attendeeTraits).some(
          (entry) => entry.tags.length > 0 || entry.note.trim() !== '',
        )
      const res = await apiRequest<{ mutualMatches?: MutualMatch[] }>({
        path: `/api/events/${encodeURIComponent(eventId)}/feedback`,
        method: 'POST',
        data: buildEventFeedbackPayload({
          rating,
          comment,
          connections: selectedConnections,
          // Only an explicit valid 保存并继续 sends the ID (spec §4.1) — the
          // builder re-validates, so a typed-but-skipped value never leaks.
          wechatContactId: wechatSaved ? wechatIdInput : undefined,
          balanced: {
            atmosphereScore,
            attendeeTraits: attendeeTraitsPayload,
            connectionRadar: radar,
            connectionStatus,
            hasNewConnections: selectedConnections.length > 0,
            improvementAreas,
            venueStyleRating,
          },
        }),
      })
      setMutualMatches(res.mutualMatches || [])
      setStep('revealed')
      // The server backfilled the 微信号 inside the same POST (social.ts
      // runs the backfill before the connection snapshot flip) — mirror it
      // into the auth cache so the remedy gate settles immediately.
      if (wechatSaved) {
        const verdict = validateWechatContactId(wechatIdInput)
        if (verdict.ok) syncWechatIdToAuthCache(verdict.value)
      }
      if (hasDeepFields) {
        trackFeedbackEvent('feedback_deep_submitted', { eventId })
      }
      // W4 (AC-W4.2a): the primary feedback POST above only writes the legacy
      // event_feedback table, which the matching learning pipeline never reads.
      // Feed the same submission into the canonical outcome pipeline
      // (event_group_outcomes → match_history → calibration). Fire-and-forget:
      // a failure here must never fail the user's submission, which already
      // succeeded and is reflected in the revealed state above.
      void submitGroupOutcome()
      // Invalidate the Connections Predictive Shell so the 连接 tab reflects the
      // new feedback-complete / connections state instead of stale feedback-pending.
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_SHELL_QUERY_KEY })
      // 2026-10-16 feedback activation: bust joined-events + events shell so the
      // 足迹「去评价」pill disappears immediately (the joined query carries a 30s
      // staleTime), and drop this event's feedback-state cache so event-detail
      // re-derives 已评价 on return. Mirrors bustRegistrationCaches discipline.
      queryClient.invalidateQueries({ queryKey: JOINED_EVENTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: EVENTS_SHELL_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-feedback-state', eventId] })
      evictPersistedQuery(JOINED_EVENTS_QUERY_KEY)
    } catch (err) {
      // 2026-10-16 race: a second device (or a stale re-opened page) can submit
      // first, and this POST settles as 409 FEEDBACK_ALREADY_SUBMITTED. That is
      // a success from the user's point of view — land on the thank-you state
      // instead of re-showing the form with a re-tappable submit button.
      const errorCode = (err as { data?: { code?: string } } | null)?.data?.code
      if (errorCode === 'FEEDBACK_ALREADY_SUBMITTED') {
        queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-feedback-state', eventId] })
        setSubmitted(true)
        setStep('revealed')
        setIsSubmitting(false)
        return
      }
      const message = err instanceof Error ? err.message : getErrorMessage('submit-failed')
      setError(message)
      logError('[EventFeedback] Submit failed', { message })
      setSubmitted(false)
      setIsSubmitting(false)
    }
  }, [
    eventId,
    rating,
    comment,
    selectedConnections,
    isSubmitting,
    atmosphereScore,
    attendeeTraits,
    participants,
    radar,
    connectionStatus,
    improvementAreas,
    venueStyleRating,
    submitGroupOutcome,
    wechatSaved,
    wechatIdInput,
    syncWechatIdToAuthCache,
  ])

  const handleCopyWechat = useCallback((wechatId: string) => {
    Taro.setClipboardData({
      data: wechatId,
      success: () => {
        Taro.showToast({ title: '微信号已复制', icon: 'success', duration: TOAST_DEFAULT_MS })
      },
      fail: () => {
        Taro.showToast({ title: getErrorMessage('copy-failed'), icon: 'none', duration: TOAST_DEFAULT_MS })
      },
    })
  }, [])

  // ─── 微信号采集 handlers (spec §4) ───────────────────────────────────────
  // onInput only clears the error (never validates mid-typing); blur quietly
  // validates a non-empty draft; save treats EMPTY input as skip-advance — an
  // optional field never punishes a blank.
  const handleWechatInput = useCallback((value: string) => {
    setWechatIdInput(value)
    setWechatError('')
  }, [])

  // Batch B item 10: feedback_wechat_input_focus — once per visit, the
  // engagement anchor of the collection funnel (shown → focused → saved).
  const wechatFocusTrackedRef = useRef(false)
  const handleWechatFocus = useCallback(() => {
    if (wechatFocusTrackedRef.current || !eventId) return
    wechatFocusTrackedRef.current = true
    trackFeedbackEvent('feedback_wechat_input_focus', { eventId })
  }, [eventId])

  const handleWechatBlur = useCallback(() => {
    const trimmed = wechatIdInput.trim()
    if (trimmed === '') {
      setWechatError('')
      return
    }
    const verdict = validateWechatContactId(trimmed)
    setWechatError(
      verdict.ok
        ? ''
        : verdict.reason === 'wxid-prefix'
          ? WECHAT_ID_WCID_PREFIX_HINT
          : WECHAT_ID_FORMAT_ERROR,
    )
  }, [wechatIdInput])

  const handleWechatSkip = useCallback(() => {
    setWechatError('')
    setWechatSaved(false)
    haptics('light')
    trackFeedbackEvent('feedback_wechat_skipped', { eventId, hadInput: wechatIdInput.trim() !== '' })
    setStep('wrapup')
  }, [eventId, wechatIdInput])

  const handleWechatSave = useCallback(() => {
    const trimmed = wechatIdInput.trim()
    // Empty + 保存并继续 converges with skip (spec §4.3).
    if (trimmed === '') {
      handleWechatSkip()
      return
    }
    const verdict = validateWechatContactId(trimmed)
    if (!verdict.ok) {
      setWechatError(
        verdict.reason === 'wxid-prefix'
          ? WECHAT_ID_WCID_PREFIX_HINT
          : WECHAT_ID_FORMAT_ERROR,
      )
      trackFeedbackEvent('feedback_wechat_invalid', { eventId, reason: verdict.reason, surface: 'step' })
      return
    }
    setWechatError('')
    setWechatSaved(true)
    haptics('light')
    trackFeedbackEvent('feedback_wechat_saved', { eventId })
    setStep('wrapup')
  }, [eventId, wechatIdInput, handleWechatSkip])

  // C — remedy card (revealed page): the only path that writes the ID outside
  // the feedback POST. Client validation is UX; the endpoint re-validates and
  // answers with coded errors (INVALID_WECHAT_CONTACT_ID).
  const handleRemedySave = useCallback(async () => {
    if (remedySaving || remedySaved) return
    const trimmed = remedyInput.trim()
    if (trimmed === '') return
    const verdict = validateWechatContactId(trimmed)
    if (!verdict.ok) {
      setRemedyError(
        verdict.reason === 'wxid-prefix'
          ? WECHAT_ID_WCID_PREFIX_HINT
          : WECHAT_ID_FORMAT_ERROR,
      )
      trackFeedbackEvent('feedback_wechat_invalid', { eventId, reason: verdict.reason, surface: 'remedy' })
      return
    }
    setRemedySaving(true)
    setRemedyError('')
    try {
      await apiRequest({
        path: '/api/user/wechat-contact',
        method: 'POST',
        data: { wechatContactId: verdict.value },
      })
      setRemedySaved(true)
      // Batch A item 15: light confirmation on save — the revealed-entry
      // 'success' peak already fired; the remedy is a quiet fix, not a peak.
      haptics('light')
      syncWechatIdToAuthCache(verdict.value)
      trackFeedbackEvent('feedback_wechat_remedy_saved', { eventId })
    } catch (err) {
      const errorData = (err as Record<string, unknown>)?.data as Record<string, unknown> | undefined
      const message = errorData?.code === 'INVALID_WECHAT_CONTACT_ID'
        ? WECHAT_ID_FORMAT_ERROR
        : getErrorMessage('save-failed')
      setRemedyError(message)
      logError('[EventFeedback] Remedy save failed', { message })
      trackFeedbackEvent('feedback_wechat_remedy_failed', { eventId })
    } finally {
      setRemedySaving(false)
    }
  }, [remedySaving, remedySaved, remedyInput, eventId, syncWechatIdToAuthCache])

  // ─── 互选纪念卡 (item 19, 2026-10-16) ────────────────────────────────────
  // The mutual-match moment gets a passive keepsake entry on the revealed
  // screen. PII structural exclusion: MutualMatch.wechatContactId is dropped
  // at this mapping boundary — the card input type cannot carry contact info.
  const keepsakeViewer = useMemo(
    () => ({
      displayName: currentUser?.displayName ?? null,
      archetype: currentUser?.archetype ?? null,
    }),
    [currentUser?.displayName, currentUser?.archetype],
  )
  const keepsakeMatches = useMemo(
    () => mutualMatches.map((match) => ({ displayName: match.displayName, archetype: match.archetype })),
    [mutualMatches],
  )
  const { isKeepsakeGenerating, handleKeepsakeSave } = useKeepsakeCard({
    enabled: effectiveStep === 'revealed' && mutualMatches.length > 0,
    eventId,
    viewer: keepsakeViewer,
    matches: keepsakeMatches,
    eventDayLabel: eventDayLabel || undefined,
  })

  if (authLoading || feedbackStateLoading) {
    return (
      // Batch A item 1: mascot stays scarce — the revealed screen owns the
      // single mascot moment, so the gate renders the brand mark instead.
      // Skeleton rows wait 800ms so fast loads never flash placeholders.
      <JoyJoinLoadingScreen
        title='准备反馈页面…'
        subtitle={`${getMascotDisplayName(currentUser)}在确认你的活动参与记录`}
        hideMascot
        showSkeleton
        skeletonDelayMs={800}
      />
    )
  }

  // ─── Gate states (fail-closed): only 'open' reaches the form ─────────────
  if (feedbackStateError || !feedbackState) {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__gate'>
          <StatusCard
            tone='error'
            title='加载失败'
            description='网络有点调皮，再试一次吧'
            action={{ label: '重试', onClick: () => refetchFeedbackState(), variant: 'primary' }}
          />
        </View>
      </View>
    )
  }

  if (feedbackState === 'locked') {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__gate'>
          <StatusCard
            tone='info'
            title='活动还没结束'
            description='结束后，来聊聊你的感受吧'
            action={{ label: '返回', onClick: () => Taro.navigateBack(), variant: 'primary' }}
          />
        </View>
      </View>
    )
  }

  // ineligible (未成行/已退订/塌组/已取消) + reserved closed share one honest card.
  if (feedbackState === 'ineligible' || feedbackState === 'closed') {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__gate'>
          <StatusCard
            tone='info'
            title='这场活动未成行，无法评价'
            action={{ label: '返回', onClick: () => Taro.navigateBack(), variant: 'primary' }}
          />
        </View>
      </View>
    )
  }

  if (participantsLoading) {
    return (
      <JoyJoinLoadingScreen
        title='准备反馈页面…'
        subtitle={`${getMascotDisplayName(currentUser)}在确认你的活动参与记录`}
        hideMascot
        showSkeleton
        skeletonDelayMs={800}
      />
    )
  }

  // ─── Revealed step ─────────────────────────────────────────────────────────
  if (effectiveStep === 'revealed') {
    const hasMatches = mutualMatches.length > 0
    const reducedMotion = getSystemReducedMotionCompat()
    return (
      <View className='event-feedback event-feedback--revealed'>
        {/* Ceremony peak (#19): confetti burst on mutual matches — transform/
            opacity only, statically downgraded under reduced-motion. */}
        {hasMatches && <ParticleBurst trigger type='confetti' count={40} reducedMotion={reducedMotion} />}
        <ScrollView
          className='event-feedback__success-scroll'
          scrollY
          enhanced
          showScrollbar={false}
        >
        <View className='event-feedback__success'>
          {/* Batch A item 1 (2026-10-16): the 360rpx ceremony hero scene was
              retired — the mascot badge is the SINGLE mascot moment on this
              screen (mascot stays scarce = emotional premium). The hero's
              entrance animation moved onto the badge in SCSS. */}
          {!mascotFailed && (
            <Image
              className='event-feedback__success-mascot'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset(hasMatches ? 'matchSuccess' : 'thanksFeedback')}
              onError={() => setMascotFailed(true)}
            />
          )}
          {hasMatches ? (
            <View className='event-feedback__success-title-row'>
              <JoyJoinIcon emoji='🎉' tier='reaction' size={32} />
              <Text className='event-feedback__success-title'>互选成功！</Text>
            </View>
          ) : (
            <Text className='event-feedback__success-title'>感谢你的反馈！</Text>
          )}
          <Text className='event-feedback__success-text'>
            {hasMatches
              ? `你和 ${mutualMatches.length} 位参与者互相选择了对方`
              : '你的评价帮助我们变得更好'}
          </Text>
          {/* Batch A item 17 — honest three-branch state: the forward-looking
              line only renders when the user actually picked people (telling
              「如果 TA 也选了你」 to someone who picked nobody is a lie).
              selectedConnections survives the in-session submit; a re-entered
              (already-submitted) visit honestly falls back to the thanks-only
              branch. Particles + success haptic stay match-only. */}
          {!hasMatches && selectedConnections.length > 0 && (
            <Text className='event-feedback__success-subtext'>你选的人，如果也选了你，连接里第一时间见</Text>
          )}

          {/* 微信号补救卡 (spec §5): the last-chance capture for users who
              skipped the collection step but landed a mutual match. remedySaved
              stays in the gate so the success swap survives the auth-cache
              sync (currentUser.wechatContactId flipping would otherwise
              unmount the card mid-confirmation). */}
          {hasMatches && wechatCollectionEnabled && (remedySaved || (!currentUser?.wechatContactId && !wechatSaved)) ? (
            <Card className='event-feedback__remedy-card'>
              {remedySaved ? (
                <View className='event-feedback__remedy-success-row'>
                  <JoyJoinIcon emoji='✅' size={24} />
                  <Text className='event-feedback__remedy-success'>已保存，对方现在就能看到你的微信号</Text>
                </View>
              ) : (
                <View>
                  <Text className='event-feedback__remedy-title'>你还没留微信号</Text>
                  {/* Batch A item 15: single-line causal sentence (19 chars) —
                      no orphan glyph at the wrap point. */}
                  <Text className='event-feedback__remedy-text'>补上后，互选成功的伙伴就能看到你的微信号</Text>
                  <View className='event-feedback__remedy-row'>
                    <Input
                      className={`event-feedback__remedy-input ${remedyError ? 'event-feedback__remedy-input--error' : ''}`}
                      placeholder='输入微信号'
                      value={remedyInput}
                      onInput={(e) => {
                        setRemedyInput(e.detail.value)
                        setRemedyError('')
                      }}
                      maxlength={WECHAT_CONTACT_ID_MAX_LENGTH}
                      confirmType='done'
                      aria-label='补充微信号'
                    />
                    <Button
                      className='event-feedback__remedy-save'
                      disabled={remedySaving || remedyInput.trim() === ''}
                      onClick={() => {
                        haptics('light')
                        void handleRemedySave()
                      }}
                      ariaLabel='保存微信号'
                    >
                      {remedySaving ? '保存中…' : '保存'}
                    </Button>
                  </View>
                  <Text className='event-feedback__wechat-format-hint'>{WECHAT_ID_FORMAT_HINT}</Text>
                  {remedyError ? (
                    <View className='event-feedback__wechat-field-error' role='alert' aria-live='polite'>
                      <Text>{remedyError}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </Card>
          ) : null}

          {hasMatches ? (
            <View className='event-feedback__matches'>
              {mutualMatches.map((match, index) => (
                <Card
                  key={match.userId}
                  className='event-feedback__match-card'
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <View className='event-feedback__match-row'>
                    <ArchetypeHead archetype={match.archetype || undefined} size={64} fallbackText={match.displayName} />
                    <View className='event-feedback__match-info'>
                      <Text className='event-feedback__match-name'>{match.displayName}</Text>
                      {match.wechatContactId ? (
                        <View
                          className='event-feedback__match-wechat'
                          hoverClass='event-feedback__match-wechat--pressed'
                          // Type narrowing does not cross the closure boundary;
                          // the non-null assertion is safe because we are inside
                          // the `match.wechatContactId ?` truthy branch.
                          onClick={() => handleCopyWechat(match.wechatContactId!)}
                        >
                          <Text className='event-feedback__match-wechat-label'>微信号</Text>
                          <Text className='event-feedback__match-wechat-id'>{match.wechatContactId}</Text>
                          <Text className='event-feedback__match-wechat-hint'>点击复制</Text>
                        </View>
                      ) : (
                        // Batch A item 17: anticipation, not a dead end — the
                        // 连接 tab is where the ID appears once set.
                        <Text className='event-feedback__match-no-wechat'>TA 设置后，连接里就能看到</Text>
                      )}
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          ) : null}

          {/* Exit ramp (#19): the primary CTA carries the connection intent
              forward to the 连接 tab instead of dead-ending on 返回.
              Pre-ship (2026-10-16 USA audit, Angle 6): the 互选纪念卡 was
              promoted from a whisper below the CTAs to a first-class second
              action — at the emotional peak the share artifact must be
              discoverable. Hierarchy: 去连接看看 (primary) → 存下这一刻
              (secondary) → 返回 (quiet text). */}
          <View className='event-feedback__success-actions'>
            <Button
              className='event-feedback__success-primary'
              onClick={() => {
                haptics('light')
                Taro.switchTab({ url: '/pages/connections/index' })
              }}
              ariaLabel='去连接看看'
            >
              去连接看看
            </Button>
            {/* 互选纪念卡 (item 19): passive save-to-album, zero inducement
                wording (WeChat bans incentivized sharing). No native disabled
                attribute — the platform disabled colour would repaint the
                button (2026-10-16 render-caught rule), the busy guard is JS. */}
            {hasMatches && (
              <Button
                className={`event-feedback__success-secondary ${isKeepsakeGenerating ? 'event-feedback__success-secondary--busy' : ''}`}
                aria-disabled={isKeepsakeGenerating}
                ariaLabel={isKeepsakeGenerating ? '正在生成纪念卡' : '存下这一刻'}
                onClick={() => {
                  if (isKeepsakeGenerating) return
                  void handleKeepsakeSave()
                }}
              >
                {isKeepsakeGenerating ? '正在生成…' : '存下这一刻'}
              </Button>
            )}
            <View
              className='event-feedback__success-back'
              hoverClass='event-feedback__success-back--pressed'
              role='button'
              aria-label='返回'
              onClick={() => Taro.navigateBack()}
            >
              <Text>返回</Text>
            </View>
          </View>
        </View>
        </ScrollView>

        {/* Hidden keepsake canvas (insight-poster precedent): the inline px
            DOM size must equal the 1080×1560 export bitmap; offscreen via SCSS. */}
        {hasMatches && (
          <Canvas
            canvasId={KEEPSAKE_CARD_CANVAS_ID}
            className='event-feedback__keepsake-canvas'
            style={{ width: '1080px', height: '1560px' }}
            aria-hidden='true'
          />
        )}
      </View>
    )
  }

  // ─── Experience step (merged 2026-08-15): faces + thermometer + radar + ───
  // venue/status all describe the same night, so they share ONE screen. Every
  // field is optional — the CTA is always 下一步, never a skip-or-answer fork.
  if (effectiveStep === 'experience') {
    return (
      <View className='event-feedback'>
        <View className='event-feedback__header'>
          <Text className='event-feedback__title'>
            {eventDayLabel ? `${eventDayLabel} 那局，怎么样？` : '这局怎么样？'}
          </Text>
          {renderStepProgress('experience', dotSteps)}
          {/* Why-we-ask line: no points pitch (there's no coupon-linked 积分
              system to redeem them against) — just the honest reason. */}
          <Text className='event-feedback__purpose-hint'>你的观察，会让下一场更对味</Text>
        </View>

        <ScrollView className='event-feedback__deep-scroll' scrollY enhanced showScrollbar={false}>
          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>整体体验如何？</Text>
            <View className='event-feedback__rating'>
              <RatingFace value={rating} onSelect={setRating} />
            </View>
          </View>

          <View className='event-feedback__card'>
            <Text className='event-feedback__card-title'>氛围温度计</Text>
            <Text className='event-feedback__card-hint'>整场下来，气氛停在哪个刻度？</Text>
            <Thermometer
              value={atmosphereScore}
              onChange={(value) => {
                markDeepEngaged()
                setAtmosphereScore(value)
              }}
            />
          </View>

          {/* Batch C item 5 (2026-10-16): progressive disclosure — the deep
              fields (radar + venue/status) collapse behind a quiet expander.
              Expanding fires the existing deep_engaged funnel event (once,
              via markDeepEngaged's own guard); values persist on collapse. */}
          <View
            className='event-feedback__expander'
            hoverClass='event-feedback__expander--pressed'
            role='button'
            aria-expanded={deepExpanded}
            aria-label={deepExpanded ? '收起补充反馈' : '再多评几项，展开补充反馈'}
            onClick={() => {
              haptics('light')
              if (!deepExpanded) markDeepEngaged()
              setDeepExpanded(!deepExpanded)
            }}
          >
            <Text className='event-feedback__expander-label'>再多评几项（可选）</Text>
            {/* CSS chevron (transform-only rotate, RM-gated): no chevron asset
                exists in emojiToIconMap, and copy law bars a raw glyph here. */}
            <View
              className={`event-feedback__expander-chevron ${deepExpanded ? 'event-feedback__expander-chevron--open' : ''}`}
              aria-hidden='true'
            />
          </View>

          {deepExpanded ? (
            <>
              <View className='event-feedback__card'>
                <Text className='event-feedback__card-title'>连接雷达</Text>
                <Text className='event-feedback__card-hint'>从「不太合」到「很合」，凭感觉点一点就好</Text>
                <View className='event-feedback__radar'>
                  {RADAR_DIMENSIONS.map((dim) => (
                    <RadarScale
                      key={dim.key}
                      label={dim.label}
                      hint={dim.hint}
                      value={radar[dim.key]}
                      onChange={(value) => setRadarDimension(dim.key, value)}
                    />
                  ))}
                </View>
              </View>

              <View className='event-feedback__card'>
                <Text className='event-feedback__card-title'>场地印象</Text>
                <View
                  className='event-feedback__venue-row'
                  role='radiogroup'
                  aria-label='场地风格满意度'
                >
                  {VENUE_STYLE_OPTIONS.map((option) => (
                    <SelectPill
                      key={option.value}
                      label={option.label}
                      selected={venueStyleRating === option.value}
                      onClick={() => {
                        haptics('light')
                        markDeepEngaged()
                        setVenueStyleRating(option.value)
                      }}
                    />
                  ))}
                </View>

                <Text className='event-feedback__card-title event-feedback__card-title--spaced'>散场之后</Text>
                <Text className='event-feedback__card-hint'>和这些人现在是什么状态？</Text>
                <View
                  className='event-feedback__status-grid'
                  role='radiogroup'
                  aria-label='散场后与参与者的联系状态'
                >
                  {CONNECTION_STATUS_OPTIONS.map((status) => (
                    <SelectPill
                      key={status}
                      label={status}
                      selected={connectionStatus === status}
                      onClick={() => {
                        haptics('light')
                        markDeepEngaged()
                        setConnectionStatus(status)
                      }}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>

        <View className='event-feedback__footer'>
          <Button
            className='event-feedback__submit'
            onClick={() => {
              haptics('light')
              setStep('connections')
            }}
            ariaLabel='进入下一步'
          >
            下一步
          </Button>
        </View>
      </View>
    )
  }

  // ─── Connections step ──────────────────────────────────────────────────────
  // Render extracted to steps/ConnectionsStep.tsx (2026-10-16 Batch C) — the
  // page keeps state + navigation, the step gets everything via props.
  if (effectiveStep === 'connections') {
    return (
      <ConnectionsStep
        progressDots={renderStepProgress('connections', dotSteps)}
        participants={participants}
        participantsError={participantsError}
        selectedConnections={selectedConnections}
        onToggleConnection={toggleConnection}
        onRetryParticipants={() => {
          haptics('light')
          void queryClient.refetchQueries({ queryKey: ['mini-program', 'event-participants', eventId] })
        }}
        onNext={() => {
          haptics('light')
          // Conditional 微信号 step (spec §3): picked ≥1 person + no ID on
          // file + flag on → collect before the wrap-up screen.
          setStep(needWechatStep ? 'wechat' : 'wrapup')
        }}
      />
    )
  }

  // ─── WeChat contact step (conditional, 2026-10-16 spec §4) ──────────────
  // Single-field, single-action screen: max relevance (right after picking
  // people), zero cost to everyone else. Empty-save converges with skip;
  // invalid input blocks with an inline error, never the flow.
  if (effectiveStep === 'wechat') {
    // Batch B item 13: selection recap — the people picked on the connections
    // step are the reason this field exists, so the form tax continues the
    // emotional arc. Same roster data + avatar identity chain as the grid.
    const recapParticipants = participants.filter((p) => selectedConnections.includes(p.id))
    const recapVisible = recapParticipants.slice(0, 4)
    return (
      <View className='event-feedback'>
        {/* Batch B item 11: header is title + dots only (like connections/
            wrapup) — the privacy meaning lives in the contract block below,
            no more header/card reassurance duet. */}
        <View className='event-feedback__header'>
          <Text className='event-feedback__title'>留个微信号</Text>
          {renderStepProgress('wechat', dotSteps)}
        </View>

        <ScrollView className='event-feedback__deep-scroll' scrollY enhanced showScrollbar={false}>
          {/* Batch B item 6: scroll-inner + auto margins — the recap+card
              group centers vertically when short (no 37% dead zone) and the
              auto margins collapse to plain top-aligned scroll when the
              keyboard/content overflows. Generic class; Batch C reuses it
              for the connections step. */}
          <View className='event-feedback__scroll-inner'>
            {/* Batch B item 13: selection recap bar, visually attached above
                the card. Static (no hover/haptics); first face on top via
                inline z-index, >4 selections fold into a +N chip. */}
            <View className='event-feedback__recap'>
              <View className='event-feedback__recap-avatars'>
                {recapVisible.map((p, index) => {
                  const participantName = p.displayName || p.firstName || '匿名'
                  return (
                    <View
                      key={p.id}
                      className='event-feedback__recap-avatar'
                      style={{ zIndex: recapVisible.length - index }}
                    >
                      <ParticipantAvatar participant={p} name={participantName} size={56} mini />
                    </View>
                  )
                })}
                {recapParticipants.length > recapVisible.length && (
                  <View className='event-feedback__recap-overflow' style={{ zIndex: 0 }}>
                    <Text className='event-feedback__recap-overflow-text'>
                      +{recapParticipants.length - recapVisible.length}
                    </Text>
                  </View>
                )}
              </View>
              <Text className='event-feedback__recap-text'>
                你选了 {recapParticipants.length} 位伙伴，互选成功后 TA 们能看到
              </Text>
            </View>

            <View className='event-feedback__card'>
              <View className='event-feedback__wechat-lead'>
                {/* Batch B item 11: the chemistry chat-bubble asset is
                    brown-tinted (#C0A17B, off the brand family here) — swapped
                    for the brand-purple link icon: this step is about staying
                    reachable. Global chem-chat mapping untouched. */}
                <JoyJoinIcon emoji='🔗' tier='ui' size={32} />
                <Text className='event-feedback__card-title'>你的微信号</Text>
              </View>
              <Input
                className={`event-feedback__wechat-input ${wechatError ? 'event-feedback__wechat-input--error' : ''}`}
                placeholder='输入微信号'
                value={wechatIdInput}
                onInput={(e) => handleWechatInput(e.detail.value)}
                onFocus={handleWechatFocus}
                onBlur={handleWechatBlur}
                maxlength={WECHAT_CONTACT_ID_MAX_LENGTH}
                confirmType='done'
                aria-label='微信号（选填）'
              />
              {/* Batch B item 11: hint and error share ONE slot — the format
                  hint yields to the error in place, never stacking (no layout
                  jump). Both occupy the same margin-top: $spacing-xs slot. */}
              {wechatError ? (
                <View className='event-feedback__wechat-field-error' role='alert' aria-live='polite'>
                  <Text>{wechatError}</Text>
                </View>
              ) : (
                <Text className='event-feedback__wechat-format-hint'>{WECHAT_ID_FORMAT_HINT}</Text>
              )}
              {/* Batch B item 10: privacy contract block — lock icon + two-line
                  promise (visibility rule + set-once reassurance), the main
                  line one font step up and toward the primary color range. */}
              <View className='event-feedback__wechat-privacy'>
                <JoyJoinIcon
                  emoji='🛡️'
                  tier='ui'
                  size={28}
                  className='event-feedback__wechat-privacy-icon'
                />
                <View className='event-feedback__wechat-privacy-lines'>
                  <Text className='event-feedback__wechat-privacy-text'>仅互选成功的伙伴可见，不会公开</Text>
                  <Text className='event-feedback__wechat-privacy-sub'>{WECHAT_ID_SET_ONCE_HINT}</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        <View className='event-feedback__footer'>
          <View className='event-feedback__footer-row'>
            <Button
              className='event-feedback__submit-ghost'
              onClick={() => {
                haptics('light')
                setStep('connections')
              }}
              ariaLabel='返回选择联系人'
            >
              上一步
            </Button>
            <Button
              className='event-feedback__submit'
              onClick={handleWechatSave}
              ariaLabel='保存微信号并继续'
            >
              保存并继续
            </Button>
          </View>
          {/* Batch B item 12: skip hint merged into the skip bar — one
              tertiary line, still a ≥88rpx touch target. */}
          <View
            className='event-feedback__wechat-skip'
            hoverClass='event-feedback__wechat-skip--pressed'
            role='button'
            aria-label='暂不填写微信号，结果页还能补'
            onClick={handleWechatSkip}
          >
            <Text>暂不填写，结果页还能补</Text>
          </View>
        </View>
      </View>
    )
  }

  // ─── Wrap-up step (merged 2026-08-15): attendee impressions + improvement ──
  // areas + free comment. Impressions only render for people picked on the
  // connections step (轻量原则).
  // ─── Wrap-up step (merged 2026-08-15): attendee impressions + improvement ──
  // areas + free comment. Render extracted to steps/WrapupStep.tsx
  // (2026-10-16 Batch C) — the page keeps state + submit, the step gets
  // everything via props.
  if (effectiveStep === 'wrapup') {
    return (
      <WrapupStep
        progressDots={renderStepProgress('wrapup', dotSteps)}
        participants={participants}
        selectedConnections={selectedConnections}
        attendeeTraits={attendeeTraits}
        onToggleAttendeeTag={toggleAttendeeTag}
        onSetAttendeeNote={setAttendeeNote}
        onNoteFocus={trackNoteFocus}
        onArchetypeAssetError={handleArchetypeAssetError}
        improvementAreas={improvementAreas}
        onToggleImprovementArea={toggleImprovementArea}
        comment={comment}
        onCommentChange={setComment}
        error={error}
        isSubmitting={isSubmitting}
        submitted={submitted}
        onBack={() => {
          haptics('light')
          // Mirror of the forward jump: when the wechat step is in the
          // visible chain, back from wrap-up lands on it (spec §3).
          setStep(needWechatStep ? 'wechat' : 'connections')
        }}
        onSubmit={() => {
          haptics('medium')
          handleSubmit()
        }}
      />
    )
  }

  // Defensive: unknown step state
  return (
    <JoyJoinLoadingScreen
      title='页面加载中…'
      subtitle={`${getMascotDisplayName(currentUser)}正在准备`}
      hideMascot
      showSkeleton
      skeletonDelayMs={800}
    />
  )
}
