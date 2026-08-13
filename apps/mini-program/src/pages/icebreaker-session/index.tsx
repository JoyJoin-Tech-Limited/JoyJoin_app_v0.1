import { useMemo, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import type { AtmosphereMood, SocialIcebreakerPhase, SocialSessionState, SocialTopic } from '@shared/socialIcebreaker'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import type { WSMessage } from '@shared/wsEvents'
import type {
  MiniScriptGenre,
  MiniScriptStyle,
  MiniScriptVoteInput,
} from '@shared/miniscriptStoryFramework'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { apiRequest } from '../../lib/api/api'
import { POLL_SOCIAL_SESSION_MS, TOAST_MEDIUM_MS, TOAST_DEFAULT_MS } from '../../lib/utils/uiConstants'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useAuth } from '../../hooks/useAuth'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { usePageVisibility } from '../../hooks/usePageVisibility'
import { useWebSocket } from '../../hooks/useWebSocket'
import { logInfo, logWarn, logError } from '../../lib/utils/logger'
import { haptics, socialHaptics } from '../../lib/utils/haptics'
import { useSessionAudio } from '../../hooks/useSessionAudio'
import { socialIcebreakerAnalytics } from '../../lib/analytics/socialIcebreakerAnalytics'
import {
  usePreloadCdnIcons,
  SPRITE_SHEET_ASSETS,
  ICEBREAKER_PHASE_EMBLEM_ASSETS,
} from '../../hooks/usePreloadCdnIcons'
import { getMascotDisplayName } from '../../lib/mascot/mascotDisplay'
import OnboardingLoadingShell from '../../components/loading/OnboardingLoadingShell'
import XiaoyueSessionShell from '../../components/mascot/XiaoyueSessionShell'
import Button from '../../components/ui/Button'
import { type SessionPhase } from './phaseViews'
import { apiVibeToClient, VIBE_TO_API, type VibeId } from '../../lib/vibeMapping'
import IcebreakerTierSheet, { type TierSheetSelection } from './components/IcebreakerTierSheet'
import { getPhaseToastText } from './phaseToastText'
import { useIcebreakerSessionAnalytics } from './useIcebreakerSessionAnalytics'
import { PhaseIntroOverlay } from './overlays/PhaseIntroOverlay'
import BonusGateOverlay from './overlays/BonusGateOverlay'
import { useMiniScriptGeneration } from './hooks/useMiniScriptGeneration'
import {
  SENSORY_EVENT_HAPTIC_PATTERNS,
  useSessionSensoryEvents,
  type SessionSensoryEvent,
} from './hooks/useSessionSensoryEvents'
import { useKeepScreenOn } from './hooks/useKeepScreenOn'
import { MOOD_FIELD_BLOOM_MS, deriveMoodField } from './viewModels/ambientFieldModel'
import { GroupBeatTracker, parseSocialGroupBeat } from './viewModels/groupBeatModel'
import { SessionPhaseViews, type SessionPhaseViewsProps } from './SessionPhaseViews'
import {
  buildSocialPath,
  deriveParticipants,
  getIcebreakerPageErrorText,
  getErrorText,
  getUserArchetype,
  getUserDisplayName,
  getUserInterests,
  normaliseSession,
  type EventSessionDiscovery,
  type SocialRecapResponse,
  type SocialStartResponse,
} from './icebreakerSessionModel'
import {
  HOST_MENU_COACHMARK_STORAGE_KEY,
  resolveHostMenuItems,
  resolveSyncLossVisible,
  shouldNudgeHostForSuggestion,
} from './sessionShellLogic'
import {
  shouldRetryWarmupTopics,
  classifyTopicsFailure,
  getTopicsServerRetryDelayMs,
} from './viewModels/warmupViewModels'
import type { TopicsFailureKind, TopicsRecoveryState } from './viewModels/warmupViewModels'
import {
  getGenerationRetryDelayMs,
  type GenerationPendingResponse,
} from './viewModels/phaseProgressionModels'
import { syncSocialActionResponse } from './socialActionSync'
import './index.scss'

// ─── Component ────────────────────────────────────────────────────

// F1: hoisted — a stable reference keeps usePreloadCdnIcons' effect from
// re-firing 31 parallel getImageInfo bridge calls on every render.
const ICEBREAKER_PRELOAD_ASSETS = [...SPRITE_SHEET_ASSETS, ...ICEBREAKER_PHASE_EMBLEM_ASSETS]

// Warmup topic generation is LLM-backed (6s server LLM race + curated-topic
// fallback + DB writes). Anything past ~8s means the request never reached a
// healthy route (gateway 502 / dev-server restart) — fail fast and let the
// patient backoff retry ride through the flap instead of staring at a dead
// shimmer (2026-07-28 502 incident).
const TOPICS_REQUEST_TIMEOUT_MS = 8000
const SKIPPED_ACTION_TOAST_INTERVAL_MS = 1500
const TOPICS_SKIP_RETRY_MAX = 5
const TOPICS_SKIP_RETRY_DELAY_MS = 700
const TOPICS_RECOVERY_RETRY_DELAY_MS = 1200
// Transient 5xx/network failures get this many patient auto-retries (backoff
// ladder lives in warmupViewModels.TOPICS_SERVER_RETRY_BACKOFF_MS) before the
// terminal error card appears.
const TOPICS_SERVER_RETRY_MAX = 3

type WarmupTopicsResponse = {
  topics?: SocialTopic[]
  state?: SocialSessionState
}

type WarmupReadyResponse = {
  readyUserIds: string[]
  readyCount: number
  allReady: boolean
  currentTopicIndex: number
  commonGroundCount: number
  state: SocialSessionState
}

export default function IcebreakerSessionPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const routeSessionId = router.params.sessionId ?? ''
  const routeEventId = router.params.eventId ?? ''
  const { isLoading: authLoading } = useAuthGuard()
  const { user } = useAuth()
  const currentUser = (user ?? undefined) as Record<string, unknown> | undefined
  const currentUserId = typeof user?.id === 'string' ? user.id : ''
  const currentUserDisplayName = getUserDisplayName(currentUser)
  const currentUserArchetype = getUserArchetype(currentUser)
  const currentUserInterests = getUserInterests(currentUser)
  const features = user?.features
  // S1 haptic grammar: server-owned flag (default off) gates every
  // social-pattern firing on this page — detector events AND action Confirm.
  const hapticGrammarEnabled = features?.icebreakerHapticGrammarEnabled ?? false
  // S2 mood field: server-owned flag (default off) gates the ambient field,
  // its reveal bloom, and the keep-screen-on POCKET posture.
  const moodFieldEnabled = features?.icebreakerMoodFieldEnabled ?? false
  // S3 glance-stack pilot (warmup + micro_challenge): L1/L2/L3 stack, S8
  // handshake ritual, S4 pilot motion. Default off.
  const glanceStackEnabled = features?.icebreakerGlanceStackEnabled ?? false
  // S6 group beats: gates the WS room join + beat→haptic dispatch. Default
  // off; WS-down degrades automatically to the S1 poll detector (ruling 6).
  const groupBeatsEnabled = features?.icebreakerGroupBeatsEnabled ?? false
  // S9 audio seasoning: delicate sub-1s ticks mirroring the S1 grammar,
  // fired alongside the haptic only (never substituting for it).
  const audioEnabled = features?.icebreakerAudioEnabled ?? false
  const [socialSessionId, setSocialSessionId] = useState<string | null>(null)
  const [bootstrapState, setBootstrapState] = useState<SocialSessionState | null>(null)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [miniScriptModalOpen, setMiniScriptModalOpen] = useState(false)
  const [dismissedSuggestionAt, setDismissedSuggestionAt] = useState<string | null>(null)
  const [showPhaseIntro, setShowPhaseIntro] = useState(false)
  const [phaseToast, setPhaseToast] = useState<{ visible: boolean; text: ReactNode }>({ visible: false, text: '' })
  const [isTierSheetOpen, setIsTierSheetOpen] = useState(false)
  const [pendingTierSwitch, setPendingTierSwitch] = useState<TierSheetSelection | null>(null)
  // PR1 壳层 transient flags — covered by useResetOnShow for swipe-back safety.
  const [coachmarkShown, setCoachmarkShown] = useState(false)
  const [suggestionOverlayOpen, setSuggestionOverlayOpen] = useState(false)
  const startAttemptRef = useRef<string | null>(null)
  const prevPhaseRef = useRef<SessionPhase>('waiting')
  const coachmarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncLostRef = useRef(false)

  useResetOnShow(setCoachmarkShown, setSuggestionOverlayOpen)

  // Preload CDN-only assets in parallel with session bootstrap.
  // Phase emblems, reactions, reveals, and achievements are CDN tiers.
  usePreloadCdnIcons(ICEBREAKER_PRELOAD_ASSETS)

  const {
    data: eventSession,
    isLoading: eventSessionLoading,
    error: eventSessionError,
  } = useQuery<EventSessionDiscovery | null>({
    queryKey: ['mini-program', 'event-session', routeEventId],
    queryFn: async () => {
      const existing = await apiRequest<EventSessionDiscovery | null>({
        path: `/api/events/${encodeURIComponent(routeEventId)}/session`,
      })

      if (existing?.sessionId) {
        return existing
      }

      return apiRequest<EventSessionDiscovery>({
        path: `/api/events/${encodeURIComponent(routeEventId)}/session`,
        method: 'POST',
      })
    },
    enabled: false,
  })

  const resolvedSessionId = routeSessionId || eventSession?.sessionId || routeEventId || ''

  useEffect(() => {
    setSocialSessionId(null)
    setBootstrapState(null)
    setBootstrapError(null)
    setPendingAction(null)
    startAttemptRef.current = null
  }, [resolvedSessionId])

  // Legacy icebreaker session details API removed; use defaults
  const sessionLoading = false
  const sessionError = null

  useEffect(() => {
    if (!resolvedSessionId || authLoading || !currentUserId) {
      return
    }

    if (socialSessionId || startAttemptRef.current === resolvedSessionId) {
      return
    }

    let cancelled = false
    startAttemptRef.current = resolvedSessionId
    setBootstrapError(null)
    setPendingAction('start')

    void apiRequest<SocialStartResponse>({
      path: '/api/social-icebreaker/start',
      method: 'POST',
      data: {
        sessionId: resolvedSessionId,
        displayName: currentUserDisplayName,
        eventType: '活动',
      },
    })
      .then((response) => {
        if (cancelled) {
          return
        }

        logInfo('[IcebreakerSession] Joined social session', {
          icebreakerSessionId: resolvedSessionId,
          socialSessionId: response.socialSessionId,
        })

        setSocialSessionId(response.socialSessionId)
        setBootstrapState(response.state)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        const message = getIcebreakerPageErrorText(error)
        logError('[IcebreakerSession] Failed to join social session', {
          icebreakerSessionId: resolvedSessionId,
          message,
        })

        startAttemptRef.current = null
        setBootstrapError(message)
      })
      .finally(() => {
        if (!cancelled) {
          setPendingAction((current) => (current === 'start' ? null : current))
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    resolvedSessionId,
    authLoading,
    currentUserId,
    sessionLoading,
    sessionError,
    socialSessionId,
    currentUserDisplayName,
  ])

  const { isPageVisible } = usePageVisibility()

  // S2 / playbook §10 ruling 4: POCKET is screen-on, face-down, app
  // foreground — hold the screen awake while the field is live on this page;
  // released on hide/unmount so the rest of the app is unaffected.
  useKeepScreenOn(moodFieldEnabled && isPageVisible)

  // S6: join the session's beats room. Room key = resolvedSessionId — the id
  // this device POSTed to /start; the server emits with
  // state.icebreakerSessionId, the same string (no id mapping on either
  // side). Reconnect-on-show lives inside the hook (gathering-room
  // precedent). Beats are best-effort sensory triggers, never correctness.
  const groupBeatTrackerRef = useRef<GroupBeatTracker | null>(null)
  if (groupBeatTrackerRef.current === null) {
    groupBeatTrackerRef.current = new GroupBeatTracker()
  }
  // N4: re-bind a fresh tracker when the session changes so a previous
  // session's nonces/suppression window never leak into the new room.
  useEffect(() => {
    groupBeatTrackerRef.current?.reset()
  }, [resolvedSessionId])
  const handleGroupBeat = useCallback(
    (message: WSMessage) => {
      const beat = parseSocialGroupBeat(message, resolvedSessionId)
      if (!beat) return
      const pattern = groupBeatTrackerRef.current?.registerBeat(beat)
      if (pattern) {
        if (socialHaptics(pattern)) playPattern(pattern)
      }
    },
    [resolvedSessionId, playPattern],
  )
  useWebSocket({
    autoConnect: groupBeatsEnabled && !!resolvedSessionId,
    eventTypes: ['SOCIAL_GROUP_BEAT'],
    eventId: resolvedSessionId || undefined,
    joinEventId: resolvedSessionId || undefined,
    onMessage: handleGroupBeat,
  })

  // S9: audio mirror — plays ONLY when the haptic actually fired (the
  // busy-guard verdict from socialHaptics), so the two channels can never
  // diverge and audio never becomes more informative than the buzz.
  const { playPattern } = useSessionAudio(audioEnabled)

  const socialSessionQuery = useQuery<SocialSessionState>({
    queryKey: ['mini-program', 'social-icebreaker-session', socialSessionId],
    queryFn: () => apiRequest<SocialSessionState>({ path: buildSocialPath(socialSessionId ?? '') }),
    enabled: !!socialSessionId && !authLoading,
    refetchInterval: !isPageVisible || pendingAction ? false : POLL_SOCIAL_SESSION_MS,
    staleTime: 0,
    // F3: nothing reads isFetching — don't re-render the full tree on every
    // fetch start/settle (2 wasted reconciliations per 3s poll).
    notifyOnChangeProps: ['data', 'isError', 'error'],
  })

  // Re-show contract: while hidden the 3s poll is paused; on return, one
  // silent invalidate refetches immediately so the session state is fresh
  // (cached state paints synchronously in the meantime). Skip the first
  // show (mount) to avoid duplicating the initial fetch.
  const hasShownOnceRef = useRef(false)
  useDidShow(() => {
    if (!hasShownOnceRef.current) {
      hasShownOnceRef.current = true
      return
    }
    if (!socialSessionId) return
    void queryClient.invalidateQueries({
      queryKey: ['mini-program', 'social-icebreaker-session', socialSessionId],
    })
  })

  const session = useMemo(() => {
    const sourceState = socialSessionQuery.data ?? bootstrapState
    return sourceState ? normaliseSession(sourceState) : null
  }, [socialSessionQuery.data, bootstrapState])

  const applySocialSessionState = useCallback((nextState: SocialSessionState) => {
    if (!socialSessionId || nextState.socialSessionId !== socialSessionId) {
      logWarn('[IcebreakerSession] Ignored mismatched action state', {
        socialSessionId,
        responseSocialSessionId: nextState.socialSessionId,
      })
      return
    }

    setBootstrapState(nextState)
    queryClient.setQueryData(['mini-program', 'social-icebreaker-session', socialSessionId], nextState)
  }, [queryClient, socialSessionId])

  const applyWarmupTopicsToLocalState = useCallback((mood: AtmosphereMood, topics: SocialTopic[], nextState?: SocialSessionState) => {
    if (!socialSessionId || topics.length === 0) {
      return
    }

    const baseState = nextState ?? socialSessionQuery.data ?? bootstrapState
    if (!baseState) {
      return
    }

    const patchedState: SocialSessionState = {
      ...baseState,
      selectedMood: mood,
      warmupTopics: topics,
      warmupTopicsStatus: 'ready',
      currentTopicIndex: 0,
      // The server is the single writer of the ready set — never hard-reset
      // it locally (2026-07-26: wiping this wiped bot-ready seeding and
      // produced the 5/6 → 0/6 "lying counter" frame).
    }

    setBootstrapState(patchedState)
    queryClient.setQueryData(['mini-program', 'social-icebreaker-session', socialSessionId], patchedState)
    setTopicsError(false)
  }, [bootstrapState, queryClient, socialSessionId, socialSessionQuery.data])

  const phase: SessionPhase = session?.phase ?? 'waiting'
  // Latest-phase ref for timer callbacks (the topics backoff retry must not
  // regenerate topics after the host already advanced the session).
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // PR1 壳层: suggestion visibility = data-derived suggestion AND an explicit
  // overlay flag (useResetOnShow-covered) so swipe-back never resurrects a stuck card.
  const adaptiveSuggestion =
    session?.xiaoyueAdaptiveSuggestion &&
    dismissedSuggestionAt !== session.xiaoyueAdaptiveSuggestion.generatedAt
      ? session.xiaoyueAdaptiveSuggestion
      : undefined

  useEffect(() => {
    setSuggestionOverlayOpen(!!adaptiveSuggestion)
  }, [adaptiveSuggestion])

  // PR1 壳层: calm-by-default sync-loss. A failed poll with a live session lights
  // the grey dot + fires one reconnect toast per failure edge; recovery auto-clears.
  // (Pre-bootstrap failures still route to the full-page error state via pageError.)
  const syncLost = resolveSyncLossVisible({
    hasSession: !!session,
    isPollError: socialSessionQuery.isError,
  })
  useEffect(() => {
    if (syncLost && !syncLostRef.current) {
      void Taro.showToast({
        title: '连接断了，正在重连…',
        icon: 'none',
        duration: TOAST_MEDIUM_MS,
      })
    }
    syncLostRef.current = syncLost
  }, [syncLost])

  // Xiaoyue phase-transition toast
  useEffect(() => {
    if (phase && phase !== 'warmup' && phase !== 'phase_selection' && prevPhaseRef.current !== 'waiting') {
      const toastText = getPhaseToastText(phase)
      setPhaseToast({ visible: true, text: toastText })
      const timer = setTimeout(() => setPhaseToast({ visible: false, text: '' }), 3000)
      return () => clearTimeout(timer)
    }
  }, [phase])
  const hostUserId = session?.hostUserId ?? ''
  const isHost = !!currentUserId && currentUserId === hostUserId
  const participants = useMemo(
    () => (session ? deriveParticipants(session, [], hostUserId) : []),
    [session, hostUserId]
  )
  const playerCount = session?.playerCount ?? participants.length

  useIcebreakerSessionAnalytics({ session, phase, socialSessionId, playerCount, isHost })

  // S7 静默救援: the suggestion's arrival is rerouted to the S1 grammar's
  // host-private Nudge — two light taps, never mistakable for the group
  // Nudge (single mid tap, S6 beats). One shot per suggestion generation;
  // the group never hears a thing. Fires on the haptic-grammar flag only.
  const lastNudgedSuggestionAtRef = useRef<string | null>(null)
  useEffect(() => {
    const suggestionGeneratedAt = session?.xiaoyueAdaptiveSuggestion?.generatedAt
    if (
      !shouldNudgeHostForSuggestion({
        isHost,
        lastNudgedGeneratedAt: lastNudgedSuggestionAtRef.current,
        suggestionGeneratedAt,
      })
    ) {
      return
    }
    lastNudgedSuggestionAtRef.current = suggestionGeneratedAt ?? null
    if (hapticGrammarEnabled) {
      if (socialHaptics('socialHostNudge')) playPattern('socialHostNudge')
    }
  }, [session?.xiaoyueAdaptiveSuggestion?.generatedAt, isHost, hapticGrammarEnabled, playPattern])

  // S1 + S2 share the sensory-event stream: state transitions from the
  // existing 3s poll become typed events. Haptic patterns stay gated on the
  // S1 flag alone; S2's reveal bloom keys off the same detector (its
  // reveal_appeared event) instead of re-deriving transitions. No new
  // subscriptions; the event → pattern mapping is config (§10 ruling 3).
  const [fieldRevealActive, setFieldRevealActive] = useState(false)
  const fieldBloomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerFieldBloom = useCallback(() => {
    if (fieldBloomTimerRef.current) {
      clearTimeout(fieldBloomTimerRef.current)
    }
    setFieldRevealActive(true)
    fieldBloomTimerRef.current = setTimeout(() => {
      setFieldRevealActive(false)
      fieldBloomTimerRef.current = null
    }, MOOD_FIELD_BLOOM_MS)
  }, [])
  useEffect(
    () => () => {
      if (fieldBloomTimerRef.current) {
        clearTimeout(fieldBloomTimerRef.current)
      }
    },
    [],
  )
  const handleSensoryEvent = useCallback(
    (event: SessionSensoryEvent) => {
      if (hapticGrammarEnabled) {
        const pattern = SENSORY_EVENT_HAPTIC_PATTERNS[event.kind]
        // S6 double-fire contract: a group beat that already buzzed this
        // moment suppresses the poll-detector's haptic for the same pattern
        // (the S2 bloom below is not a haptic and is never suppressed).
        if (!groupBeatTrackerRef.current?.shouldSuppressDetectorFire(pattern)) {
          if (socialHaptics(pattern)) playPattern(pattern)
        }
      }
      if (moodFieldEnabled && event.kind === 'reveal_appeared') {
        triggerFieldBloom()
      }
    },
    [hapticGrammarEnabled, moodFieldEnabled, triggerFieldBloom, playPattern],
  )
  useSessionSensoryEvents({
    session,
    currentUserId,
    enabled: hapticGrammarEnabled || moodFieldEnabled,
    onEvent: handleSensoryEvent,
  })

  // S2 field model: one memoized derivation per poll snapshot. Null when the
  // flag is off — the page renders exactly today's flat warm background.
  const moodField = useMemo(
    () =>
      moodFieldEnabled && session
        ? deriveMoodField(session, { revealActive: fieldRevealActive })
        : null,
    [moodFieldEnabled, session, fieldRevealActive],
  )

  // S8: the host's ritual tap fires the session's first Nudge (S1 grammar)
  // when its flag is on — pacing reads as ritual, not admin work.
  const handleRitualStart = useCallback(() => {
    if (hapticGrammarEnabled) {
      socialHaptics('socialNudge')
    }
  }, [hapticGrammarEnabled])

  // Phase intro overlay: trigger when entering a playable phase (not initial load).
  // Future refactor: extract into useSessionPhase() hook to reduce God-component size.
  useEffect(() => {
    const prev = prevPhaseRef.current
    const skipPhases: SessionPhase[] = ['waiting', 'ended', 'phase_selection']
    const isRealTransition = prev !== phase && !skipPhases.includes(phase) && prev !== 'waiting'
    if (isRealTransition) {
      setShowPhaseIntro(true)
    }
    prevPhaseRef.current = phase
  }, [phase, socialSessionId, session, playerCount])


  const recapQuery = useQuery<SocialRecapResponse>({
    queryKey: ['mini-program', 'social-icebreaker-recap', socialSessionId],
    queryFn: () => apiRequest<SocialRecapResponse>({ path: buildSocialPath(socialSessionId ?? '', '/recap') }),
    enabled: (phase === 'recap' || phase === 'ended') && !!socialSessionId && !authLoading,
    staleTime: 0,
  })

  const myVoteIndex = useMemo(() => {
    const currentPlayer = session?.lieDetectivePlayers?.[session.currentLieDetectivePlayerIndex ?? 0]
    if (!currentPlayer || !currentUserId) {
      return null
    }

    return (
      session.votes?.find(
        (vote) => vote.voterId === currentUserId && vote.targetUserId === currentPlayer.userId,
      )?.guessedStatementIndex ?? null
    )
  }, [session, currentUserId])

  const performSocialAction = useCallback(
    async <T,>(
      actionKey: string,
      suffix: string,
      data?: unknown,
      options?: { timeoutMs?: number; suppressErrorToast?: boolean; onError?: (error: unknown) => void },
    ): Promise<T | null | undefined> => {
      if (!socialSessionId) {
        return null
      }

      if (pendingAction !== null) {
        // Skipped (another action — or a duplicate of this same one — already
        // in flight). Distinct from a real failure so callers don't surface a
        // false error state. Blocking same-key duplicates also closes the
        // parallel-POST vector that could fire two LLM generations at once.
        // Never silent (2026-07-26 死屏 incident): throttled acknowledgement.
        const now = Date.now()
        if (now - skippedActionToastAtRef.current > SKIPPED_ACTION_TOAST_INTERVAL_MS) {
          skippedActionToastAtRef.current = now
          void Taro.showToast({ title: '正在同步，请稍候', icon: 'none', duration: 1500 })
        }
        return undefined
      }

      setPendingAction(actionKey)

      try {
        const response = await apiRequest<T>({
          // Full `/api/...` paths (mini-script family) bypass the session-scoped
          // buildSocialPath alias — those routes live at the top level.
          path: suffix.startsWith('/api/') ? suffix : buildSocialPath(socialSessionId, suffix),
          method: 'POST',
          data,
          timeout: options?.timeoutMs,
        })

        await syncSocialActionResponse(response, {
          applyState: applySocialSessionState,
          refetch: socialSessionQuery.refetch,
          onSyncError: (syncError) => {
            logWarn('[IcebreakerSession] Action succeeded but session reconciliation failed', {
              socialSessionId,
              actionKey,
              message: syncError instanceof Error ? syncError.message : String(syncError),
            })
          },
        })
        // S1: Confirm fires on the success path of every mutating action, so
        // a felt "land" replaces visual verification. Flag-gated; failure and
        // skipped-action paths stay silent.
        if (hapticGrammarEnabled) {
          socialHaptics('socialConfirm')
        }
        return response
      } catch (error) {
        const message = getErrorText(error, '操作没成功，再试试')
        logError('[IcebreakerSession] Social action failed', {
          socialSessionId,
          actionKey,
          message,
        })
        // Let the owning flow classify the failure (e.g. topics treats 5xx /
        // network flaps as transient and auto-retries with backoff).
        options?.onError?.(error)
        // Some flows own a persistent error surface (e.g. the topics error
        // card with 重试) — a transient toast on top is double-signalling.
        if (!options?.suppressErrorToast) {
          Taro.showToast({
            title: message.length > 12 ? '操作没成功' : message,
            icon: 'none',
            duration: TOAST_MEDIUM_MS,
          })
        }
        return null
      } finally {
        setPendingAction((current) => (current === actionKey ? null : current))
      }
    },
    [applySocialSessionState, hapticGrammarEnabled, socialSessionId, pendingAction, socialSessionQuery.refetch],
  )

  const topicsSkipRetryRef = useRef(0)
  const topicsRetryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const topicsRecoveryRetryCountRef = useRef(0)
  const topicsRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const skippedActionToastAtRef = useRef(0)
  const generateTopicsRef = useRef<(mood: AtmosphereMood) => void>(() => {})
  // Last mood the host actually requested — retry path survives even when the
  // server never persisted selectedMood (e.g. request died before the write).
  const lastTopicsMoodRef = useRef<AtmosphereMood | undefined>(undefined)
  // 2026-07-28 502 incident — transient 5xx/network failures get a patient
  // backoff auto-retry ladder with visible recovery copy; 4xx goes straight
  // to the terminal error card.
  const [topicsRecovery, setTopicsRecovery] = useState<TopicsRecoveryState | null>(null)
  const topicsFailureKindRef = useRef<TopicsFailureKind>('generic')
  const topicsServerRetryCountRef = useRef(0)
  const generateTopics = useCallback((mood: AtmosphereMood) => {
    setTopicsError(false)
    lastTopicsMoodRef.current = mood
    void performSocialAction<WarmupTopicsResponse>('topics', '/topics', {
      mood,
      eventType: '活动',
      participantCount: Math.max(playerCount, 2),
      avoidTopics: [],
    }, {
      timeoutMs: TOPICS_REQUEST_TIMEOUT_MS,
      suppressErrorToast: true,
      onError: (error) => {
        topicsFailureKindRef.current = classifyTopicsFailure(error)
      },
    }).then((result) => {
      if (result === null) {
        // Transient server/gateway failure (5xx or bare network/timeout — the
        // route itself never 5xxs, it degrades to curated topics): ride
        // through the restart with a patient backoff ladder + visible
        // recovery state instead of an instant dead-end error card.
        if (
          topicsFailureKindRef.current === 'server'
          && topicsServerRetryCountRef.current < TOPICS_SERVER_RETRY_MAX
        ) {
          topicsServerRetryCountRef.current += 1
          const attempt = topicsServerRetryCountRef.current
          setTopicsRecovery({ attempt, maxAttempts: TOPICS_SERVER_RETRY_MAX })
          logInfo('[IcebreakerSession] Topics request hit a transient failure; auto-retrying with backoff', {
            socialSessionId,
            attempt,
            maxAttempts: TOPICS_SERVER_RETRY_MAX,
          })
          topicsRetryTimerRef.current = setTimeout(
            () => {
              // The host may have moved the session out of warmup
              // during the backoff window — never regenerate topics for a
              // phase that no longer displays them.
              if (phaseRef.current !== 'warmup' && phaseRef.current !== 'waiting') return
              generateTopicsRef.current(mood)
            },
            getTopicsServerRetryDelayMs(attempt),
          )
          return
        }
        // Terminal failure — surface the designed error card (重试 +
        // auto-retry) instead of the old phantom local-fallback deck — the
        // fallback dealt a card the next poll then swapped out, producing an
        // error-toast-plus-card flash and a visible ready-count wipe.
        setTopicsRecovery(null)
        setTopicsError(true)
        topicsSkipRetryRef.current = 0
      } else if (result === undefined) {
        // Skipped because another social action was in flight — the tap would
        // otherwise be lost. Retry briefly until the in-flight action settles.
        if (topicsSkipRetryRef.current < TOPICS_SKIP_RETRY_MAX) {
          topicsSkipRetryRef.current += 1
          topicsRetryTimerRef.current = setTimeout(() => generateTopicsRef.current(mood), TOPICS_SKIP_RETRY_DELAY_MS)
        }
      } else {
        if (Array.isArray(result.topics) && result.topics.length > 0) {
          applyWarmupTopicsToLocalState(mood, result.topics, result.state)
        }
        topicsSkipRetryRef.current = 0
        topicsRecoveryRetryCountRef.current = 0
        topicsServerRetryCountRef.current = 0
        setTopicsRecovery(null)
      }
    })
  }, [applyWarmupTopicsToLocalState, performSocialAction, playerCount, socialSessionId])
  generateTopicsRef.current = generateTopics
  const handleGenerateTopics = useCallback((mood: AtmosphereMood) => {
    topicsSkipRetryRef.current = 0
    topicsRecoveryRetryCountRef.current = 0
    topicsServerRetryCountRef.current = 0
    setTopicsRecovery(null)
    if (topicsRetryTimerRef.current) {
      clearTimeout(topicsRetryTimerRef.current)
      topicsRetryTimerRef.current = undefined
    }
    generateTopicsRef.current(mood)
  }, [])
  useEffect(() => () => {
    if (topicsRetryTimerRef.current) {
      clearTimeout(topicsRetryTimerRef.current)
    }
    if (topicsRecoveryTimerRef.current) {
      clearTimeout(topicsRecoveryTimerRef.current)
    }
  }, [])

  const handleToggleWarmupReady = useCallback(() => {
    const isReady = session?.warmupReadyUserIds?.includes(currentUserId) ?? false
    void performSocialAction<WarmupReadyResponse>('warmup-ready', '/warmup/ready', { ready: !isReady }, { suppressErrorToast: true })
      .then((result) => {
        if (result === null) {
          // Rollback path (the optimistic morph in WarmupPhaseView reverts via
          // the isUpdatingReady effect) — acknowledge warmly and keep the CTA.
          void Taro.showToast({ title: '刚才那一下没传到，再点一次试试', icon: 'none', duration: 2000 })
        }
      })
  }, [performSocialAction, session?.warmupReadyUserIds, currentUserId])

  const handleNextWarmupTopic = useCallback(() => {
    void performSocialAction('warmup-next-topic', '/warmup/next-topic', {})
  }, [performSocialAction])

  const handleAssignRoles = useCallback(() => {
    void performSocialAction('miniscript-assign-roles', '/api/miniscript/assign-roles', {
      socialSessionId,
    })
  }, [performSocialAction, socialSessionId])

  const handleRevealAct = useCallback((targetAct: number) => {
    void performSocialAction('miniscript-reveal-act', '/api/miniscript/reveal-act', {
      socialSessionId,
      targetAct,
    })
  }, [performSocialAction, socialSessionId])

  const handleVote = useCallback((vote: MiniScriptVoteInput) => {
    void performSocialAction('miniscript-vote', '/api/miniscript/vote', {
      socialSessionId,
      vote,
    })
  }, [performSocialAction, socialSessionId])

  const handleRevealSolution = useCallback(() => {
    void performSocialAction('miniscript-reveal-solution', '/api/miniscript/reveal-solution', {
      socialSessionId,
    })
  }, [performSocialAction, socialSessionId])

  const handleMiniScriptReady = useCallback((ready: boolean) => {
    void performSocialAction('miniscript-ready', '/api/miniscript/ready', {
      socialSessionId,
      ready,
    })
  }, [performSocialAction, socialSessionId])

  const handleAdvancePhase = useCallback(() => {
    if (!session) {
      return
    }

    logInfo('[IcebreakerSession] Advancing phase', {
      socialSessionId,
      phase: session.currentPhase,
    })

    void performSocialAction('advance', '/advance', {
      currentPhase: session.currentPhase,
    })
  }, [performSocialAction, session, socialSessionId])

  // PR1 flow revamp — stall nudge: host explicitly skips stragglers (force)
  // or suppresses stall automation for the rest of the phase.
  const handleSelectCustomPhase = useCallback(
    (selectedPhase: SocialIcebreakerPhase) => {
      if (!socialSessionId || !session?.phaseSelectionId) {
        return
      }

      if (pendingAction !== null) {
        return
      }

      void performSocialAction<{ state?: SocialSessionState }>(
        'select-phase',
        '/select-phase',
        { phase: selectedPhase, phaseSelectionId: session.phaseSelectionId },
        {
          suppressErrorToast: true,
          onError: (err) => {
            logError('[IcebreakerSession] Select custom phase failed', { socialSessionId, selectedPhase, err })
            socialIcebreakerAnalytics.track(
              'select_phase_failed',
              socialSessionId,
              session?.icebreakerSessionId,
              selectedPhase,
              {
                phaseSelectionId: session?.phaseSelectionId,
                playerCount,
                error: err instanceof Error ? err.message : 'unknown',
              },
            )
          },
        },
      ).then((result) => {
        if (result === null) {
          void Taro.showToast({
            title: '选择没成功，再试试',
            icon: 'none',
            duration: 2000,
          })
        }
      })
    },
    [performSocialAction, socialSessionId, session, pendingAction, playerCount],
  )

  const handleEndCustomSession = useCallback(
    () => {
      if (!socialSessionId || !session?.phaseSelectionId) {
        return
      }

      if (pendingAction !== null) {
        return
      }

      socialIcebreakerAnalytics.track(
        'end_party_tapped',
        socialSessionId,
        session.icebreakerSessionId,
        undefined,
        {
          phaseSelectionId: session.phaseSelectionId,
          playerCount,
          completedCount: session.completedPhases?.length ?? 0,
        },
      )

      void performSocialAction<{ state?: SocialSessionState }>(
        'end-session',
        '/end-session',
        { phaseSelectionId: session.phaseSelectionId },
        {
          suppressErrorToast: true,
          onError: (err) => {
            logError('[IcebreakerSession] End custom session failed', { socialSessionId, err })
            socialIcebreakerAnalytics.track(
              'end_party_failed',
              socialSessionId,
              session?.icebreakerSessionId,
              undefined,
              {
                phaseSelectionId: session?.phaseSelectionId,
                playerCount,
                completedCount: session?.completedPhases?.length ?? 0,
                error: err instanceof Error ? err.message : 'unknown',
              },
            )
          },
        },
      ).then((result) => {
        if (result === null) {
          void Taro.showToast({
            title: '结束派对没成功，再试试',
            icon: 'none',
            duration: 2000,
          })
          return
        }
        if (result) {
          socialIcebreakerAnalytics.track(
            'custom_session_completed',
            socialSessionId,
            session.icebreakerSessionId,
            undefined,
            {
              playerCount,
              completedPhases: session.completedPhases,
            },
          )
        }
      })
    },
    [performSocialAction, socialSessionId, session, pendingAction, playerCount],
  )

  const [topicsError, setTopicsError] = useState(false)

  useEffect(() => {
    const topicCount = session?.warmupTopics?.length ?? 0
    if (topicCount > 0) {
      setTopicsError(false)
      setTopicsRecovery(null)
      topicsRecoveryRetryCountRef.current = 0
      topicsServerRetryCountRef.current = 0
      // Topics arrived through polling while a backoff retry was still
      // pending — cancel it so the loaded card never flips back to generating.
      if (topicsRetryTimerRef.current) {
        clearTimeout(topicsRetryTimerRef.current)
        topicsRetryTimerRef.current = undefined
      }
      return
    }

    if (!shouldRetryWarmupTopics({
      isHost,
      topicsError,
      syncLost,
      topicCount,
      selectedMood: session?.selectedMood ?? lastTopicsMoodRef.current,
      pendingAction,
      retryCount: topicsRecoveryRetryCountRef.current,
    })) return

    topicsRecoveryRetryCountRef.current += 1
    topicsRecoveryTimerRef.current = setTimeout(() => {
      topicsRecoveryTimerRef.current = undefined
      const mood = (session?.selectedMood ?? lastTopicsMoodRef.current) as AtmosphereMood | undefined
      if (mood) {
        generateTopicsRef.current(mood)
      }
    }, TOPICS_RECOVERY_RETRY_DELAY_MS)

    return () => {
      if (topicsRecoveryTimerRef.current) {
        clearTimeout(topicsRecoveryTimerRef.current)
        topicsRecoveryTimerRef.current = undefined
      }
    }
  }, [isHost, pendingAction, session?.selectedMood, session?.warmupTopics?.length, syncLost, topicsError])

  const canChangeTier = (phase === 'waiting' || phase === 'warmup') && isHost

  const executeTierSwitch = useCallback(
    async (tier: TierMachineId, vibe: VibeId) => {
      if (!socialSessionId || !session || pendingAction !== null) {
        return
      }

      logInfo('[IcebreakerSession] Setting tier', {
        socialSessionId,
        tier,
        vibe,
      })

      const result = await performSocialAction<{ state?: SocialSessionState }>(
        'set-tier',
        '/set-tier',
        {
          tier,
          vibe: tier === 'custom' ? undefined : VIBE_TO_API[vibe],
        },
        {
          suppressErrorToast: true,
          onError: (err) => {
            logError('[IcebreakerSession] Set tier failed', { error: err })
          },
        },
      )

      if (result) {
        socialIcebreakerAnalytics.track(
          'icebreaker_session_tier_changed',
          socialSessionId,
          session.icebreakerSessionId,
          phase,
          {
            fromTier: session.eventTier,
            toTier: tier,
            fromMode: session.eventTier === 'custom' ? 'custom' : 'preset',
            toMode: tier === 'custom' ? 'custom' : 'preset',
            playerCount,
          },
        )
        void Taro.showToast({
          title: `已切换为${tier === 'custom' ? '自由局' : '新模式'}`,
          icon: 'success',
          duration: TOAST_DEFAULT_MS,
        })
        return
      }

      if (result === null) {
        void Taro.showToast({
          title: '切换没成功，再试试',
          icon: 'none',
          duration: 2000,
        })
      }
    },
    [performSocialAction, socialSessionId, session, pendingAction, phase, playerCount],
  )

  const handleConfirmTierSwitch = useCallback(
    (selection: TierSheetSelection) => {
      const currentMode = session?.eventTier === 'custom' ? 'custom' : 'preset'
      const nextMode = selection.tier === 'custom' ? 'custom' : 'preset'
      const needsCustomConfirm = currentMode !== nextMode

      if (needsCustomConfirm) {
        setPendingTierSwitch(selection)
        setIsTierSheetOpen(false)
        return
      }

      setIsTierSheetOpen(false)
      void executeTierSwitch(selection.tier, selection.vibe)
    },
    [session?.eventTier, executeTierSwitch],
  )

  const handleDismissCustomConfirm = useCallback(() => {
    setPendingTierSwitch(null)
  }, [])

  const handleAcceptCustomConfirm = useCallback(() => {
    if (!pendingTierSwitch) return
    const selection = pendingTierSwitch
    setPendingTierSwitch(null)
    void executeTierSwitch(selection.tier, selection.vibe)
  }, [pendingTierSwitch, executeTierSwitch])

  useEffect(() => {
    if (!pendingTierSwitch) return

    const isSwitchingToCustom = pendingTierSwitch.tier === 'custom'
    void Taro.showModal({
      title: isSwitchingToCustom ? '切换为自由局？' : '切换为预设模式？',
      content: isSwitchingToCustom
        ? '切换后将由你手动选择每个环节，当前已生成的环节顺序不会保留。'
        : '切换后系统会自动生成完整环节，自由局下已选择的环节不会保留。',
      confirmText: '确认切换',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          handleAcceptCustomConfirm()
        } else {
          handleDismissCustomConfirm()
        }
      },
    })
  }, [pendingTierSwitch, handleAcceptCustomConfirm, handleDismissCustomConfirm])

  const handleCompleteChallenge = useCallback(() => {
    socialIcebreakerAnalytics.track(
      'micro_challenge_completed',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      'micro_challenge',
      { playerCount },
    )
    void performSocialAction('micro-complete', '/micro-challenge/complete', {})
  }, [performSocialAction, socialSessionId, session?.icebreakerSessionId, playerCount])

  const handleNextSpeedFriendingRound = useCallback(() => {
    void performSocialAction('speed-next', '/speed-friending/next-round', {})
  }, [performSocialAction])

  const handleCompleteSpeedFriending = useCallback(() => {
    void performSocialAction('speed-complete', '/speed-friending/complete', {})
  }, [performSocialAction])

  const handleGenerateStatements = useCallback((statements?: string[], lieIndex?: number) => {
    void performSocialAction('lie-generate', '/lie-detective/generate', {
      displayName: currentUserDisplayName,
      archetype: currentUserArchetype,
      interests: currentUserInterests,
      ...(statements && lieIndex ? { statements, lieIndex } : {}),
    })
  }, [performSocialAction, currentUserDisplayName, currentUserArchetype, currentUserInterests])

  const handleGenerateLieStatementFromTag = useCallback(async (tag: string) => {
    const result = await performSocialAction<{ text: string }>(
      'lie-tag-generate',
      '/lie-detective/generate-from-tag',
      { tag, displayName: currentUserDisplayName },
    )
    return result?.text ?? null
  }, [performSocialAction, currentUserDisplayName])

  const handleCastVote = useCallback(
    (statementIndex: number) => {
      const targetPlayer = session?.lieDetectivePlayers?.[session.currentLieDetectivePlayerIndex ?? 0]
      if (!targetPlayer) {
        return
      }

      socialIcebreakerAnalytics.track(
        'lie_vote_cast',
        socialSessionId ?? undefined,
        session?.icebreakerSessionId,
        'lie_detective',
        { playerCount },
      )
      void performSocialAction('lie-vote', '/lie-detective/vote', {
        targetUserId: targetPlayer.userId,
        guessedStatementIndex: statementIndex,
      })
    },
    [performSocialAction, session, socialSessionId, playerCount],
  )

  const handleNextLieDetectivePlayer = useCallback(() => {
    void performSocialAction('lie-next-player', '/lie-detective/next-player', {})
  }, [performSocialAction])

  const diceGenerationRetryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const diceGenerationRetryCountRef = useRef(0)
  const generateDiceChallengesRef = useRef<() => void>(() => {})

  const handleGenerateDiceChallenges = useCallback(() => {
    void performSocialAction<GenerationPendingResponse>('dice-generate', '/personality-dice/generate', {
      participants: participants.map((participant) => ({
        userId: participant.userId,
        displayName: participant.displayName ?? '匿名',
        archetype: participant.archetype,
      })),
    }).then((response) => {
      const retryDelay = getGenerationRetryDelayMs(response)
      if (retryDelay === null) {
        diceGenerationRetryCountRef.current = 0
        return
      }
      if (diceGenerationRetryCountRef.current >= 8) {
        diceGenerationRetryCountRef.current = 0
        void Taro.showToast({ title: '生成仍在进行，请稍后再试', icon: 'none', duration: 2000 })
        return
      }
      diceGenerationRetryCountRef.current += 1
      if (diceGenerationRetryTimerRef.current) clearTimeout(diceGenerationRetryTimerRef.current)
      diceGenerationRetryTimerRef.current = setTimeout(() => {
        diceGenerationRetryTimerRef.current = undefined
        if (phaseRef.current !== 'personality_dice') {
          diceGenerationRetryCountRef.current = 0
          return
        }
        generateDiceChallengesRef.current()
      }, retryDelay)
    })
  }, [performSocialAction, participants])
  generateDiceChallengesRef.current = handleGenerateDiceChallenges

  useEffect(() => () => {
    if (diceGenerationRetryTimerRef.current) {
      clearTimeout(diceGenerationRetryTimerRef.current)
      diceGenerationRetryTimerRef.current = undefined
    }
  }, [])

  useEffect(() => {
    if (phase === 'personality_dice') return
    diceGenerationRetryCountRef.current = 0
    if (diceGenerationRetryTimerRef.current) {
      clearTimeout(diceGenerationRetryTimerRef.current)
      diceGenerationRetryTimerRef.current = undefined
    }
  }, [phase])

  const handleCompleteDiceChallenge = useCallback((pass?: boolean) => {
    void performSocialAction('dice-complete', '/personality-dice/complete', { pass: pass === true })
  }, [performSocialAction])

  const handleDiceReady = useCallback((ready: boolean) => {
    void performSocialAction('dice-ready', '/personality-dice/complete', { ready })
  }, [performSocialAction])

  const handleDiceRevealReady = useCallback((ready: boolean) => {
    void performSocialAction('dice-reveal-ready', '/personality-dice/reveal-ready', { ready })
  }, [performSocialAction])

  const handleChooseDiceOption = useCallback((optionIndex: number) => {
    socialIcebreakerAnalytics.track(
      'dice_option_chosen',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      'personality_dice',
      { optionIndex, playerCount },
    )
    void performSocialAction('dice-choose', '/personality-dice/choose', {
      userId: currentUserId,
      optionIndex,
      operationId: `${currentUserId}-choose-${Date.now()}`,
    })
  }, [performSocialAction, currentUserId, socialSessionId, session?.icebreakerSessionId, playerCount])

  const handleGenerateAuctionLots = useCallback(() => {
    void performSocialAction('auction-gen', '/auction/generate-lots', {})
  }, [performSocialAction])

  const handleAuctionBid = useCallback(
    (amount: number) => {
      socialIcebreakerAnalytics.track(
        'auction_bid_placed',
        socialSessionId ?? undefined,
        session?.icebreakerSessionId,
        'auction',
        { amount, playerCount },
      )
      void performSocialAction('auction-bid', '/auction/bid', { amount })
    },
    [performSocialAction, socialSessionId, session?.icebreakerSessionId, playerCount],
  )

  const handleCloseAuctionLot = useCallback(() => {
    void performSocialAction('auction-close', '/auction/close-lot', {})
  }, [performSocialAction])

  const handleGenerateSessionPack = useCallback(() => {
    void performSocialAction('xiaoyue-pack', '/xiaoyue/session-pack', {})
  }, [performSocialAction])

  const handleRequestAdaptiveSuggestion = useCallback(() => {
    void performSocialAction('xiaoyue-suggest', '/xiaoyue/adaptive-suggestion', {})
  }, [performSocialAction])

  const handleDismissAdaptiveSuggestion = useCallback(
    (source: 'tap' | 'auto') => {
      // Funnel semantics: only a MANUAL 知道了 counts as a nudge dismissal;
      // the 8s auto-dismiss just hides the card (the host may still act).
      if (source === 'tap') {
        socialIcebreakerAnalytics.track(
          'stall_nudge_dismiss',
          socialSessionId ?? undefined,
          session?.icebreakerSessionId,
          phase,
          { playerCount },
        )
      }
      setDismissedSuggestionAt(session?.xiaoyueAdaptiveSuggestion?.generatedAt ?? 'dismissed')
    },
    [session?.xiaoyueAdaptiveSuggestion?.generatedAt, session?.icebreakerSessionId, socialSessionId, phase, playerCount],
  )

  // ─── PR1 壳层: host ⋯ menu (all phases) ──────────────────────────────────
  // Items come from the pure resolver (unit-tested in sessionShellLogic.test.ts):
  // waiting/warmup → tier item; all phases except waiting/recap/ended → suggestion.
  const hostMenuItems = useMemo(
    () =>
      resolveHostMenuItems({
        phase,
        isHost,
        tier: session?.eventTier ?? 'glow',
        vibe: apiVibeToClient(session?.vibe),
      }),
    [phase, isHost, session?.eventTier, session?.vibe],
  )

  const handleHostMenuTap = useCallback(async () => {
    if (!isHost || hostMenuItems.length === 0) {
      return
    }
    haptics('light')
    // Host discovered the menu on their own — the one-time coachmark has served its purpose.
    setCoachmarkShown(false)
    socialIcebreakerAnalytics.track(
      'warmup_host_menu_open',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      phase,
      {
        itemCount: hostMenuItems.length,
        items: hostMenuItems.map((item) => item.id).join(','),
      },
    )
    try {
      const { tapIndex } = await Taro.showActionSheet({
        itemList: hostMenuItems.map((item) => item.label),
      })
      const selected = hostMenuItems[tapIndex]
      if (selected?.id === 'change-tier') {
        socialIcebreakerAnalytics.track(
          'warmup_tier_sheet_open',
          socialSessionId ?? undefined,
          session?.icebreakerSessionId,
          phase,
          { source: 'host_menu' },
        )
        setIsTierSheetOpen(true)
      } else if (selected?.id === 'suggestion') {
        handleRequestAdaptiveSuggestion()
      } else if (selected?.id === 'early-end') {
        // PM-locked copy (2026-07-17): next-chapter framing, neutral tone,
        // consequence stated plainly. Analytics: shown/confirm/cancel funnel.
        socialIcebreakerAnalytics.track(
          'early_end_shown',
          socialSessionId ?? undefined,
          session?.icebreakerSessionId,
          phase,
          { playerCount },
        )
        const modalRes = await Taro.showModal({
          title: '确定要结束破冰环节吗？',
          content: '确认后全桌会直接进入回顾，并标记为中途结束；已经发生的互动仍会照常整理。',
          confirmText: '确认',
          cancelText: '手滑了',
        })
        if (modalRes.confirm) {
          haptics('medium')
          socialIcebreakerAnalytics.track(
            'early_end_confirm',
            socialSessionId ?? undefined,
            session?.icebreakerSessionId,
            phase,
            { playerCount },
          )
          await performSocialAction('early-end', '/early-end', {})
        } else {
          socialIcebreakerAnalytics.track(
            'early_end_cancel',
            socialSessionId ?? undefined,
            session?.icebreakerSessionId,
            phase,
            { playerCount },
          )
        }
      }
    } catch {
      // User cancelled the action sheet
    }
  }, [isHost, hostMenuItems, socialSessionId, session?.icebreakerSessionId, phase, handleRequestAdaptiveSuggestion, performSocialAction, playerCount])

  const handleAigcFeedbackTap = useCallback(
    (location: 'footer' | 'suggestion' | 'card') => {
      socialIcebreakerAnalytics.track(
        'warmup_aigc_feedback_tap',
        socialSessionId ?? undefined,
        session?.icebreakerSessionId,
        phase,
        { location },
      )
    },
    [socialSessionId, session?.icebreakerSessionId, phase],
  )

  // ─── PR1 壳层: one-time host ⋯ coachmark on first warmup entry ────────────
  // Persisted via storage at first show (truly once-ever), dismissible by tap,
  // auto-dismissed after 6s, and covered by useResetOnShow for swipe-back safety.
  useEffect(() => {
    if (phase !== 'warmup' || !isHost || coachmarkShown) {
      return
    }
    let seen = false
    try {
      seen = Taro.getStorageSync(HOST_MENU_COACHMARK_STORAGE_KEY) === '1'
    } catch {
      seen = false
    }
    if (seen) {
      return
    }
    try {
      Taro.setStorageSync(HOST_MENU_COACHMARK_STORAGE_KEY, '1')
    } catch {
      // Storage full / unavailable — coachmark still shows, persistence is best-effort.
    }
    setCoachmarkShown(true)
  }, [phase, isHost, coachmarkShown])

  useEffect(() => {
    if (!coachmarkShown) {
      return
    }
    coachmarkTimerRef.current = setTimeout(() => setCoachmarkShown(false), 6000)
    return () => {
      if (coachmarkTimerRef.current) {
        clearTimeout(coachmarkTimerRef.current)
        coachmarkTimerRef.current = null
      }
    }
  }, [coachmarkShown])

  const handleDismissCoachmark = useCallback(() => {
    haptics('light')
    setCoachmarkShown(false)
  }, [])

  const handleGoBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/events/index' }),
    })
  }, [])

  // Post-session hook: connections tab at peak warmth (audit C10).
  const handleConnectTap = useCallback(() => {
    haptics('light')
    socialIcebreakerAnalytics.track(
      'recap_connections_tap',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      phase,
      { playerCount },
    )
    Taro.switchTab({ url: '/pages/connections/index' })
  }, [socialSessionId, session?.icebreakerSessionId, phase, playerCount])

  const {
    isSubmitting: miniScriptSubmitting,
    generationStatus: miniScriptGenerationStatus,
    submitGenerate: submitMiniScriptGenerate,
    resetGeneration: resetMiniScriptGeneration,
  } = useMiniScriptGeneration({
    socialSessionId,
    playerCount,
    refetchSession: socialSessionQuery.refetch,
  })

  const handleMiniScriptSubmit = useCallback(
    async (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[]; lite?: boolean }) => {
      const success = await submitMiniScriptGenerate(payload)
      if (success) {
        setMiniScriptModalOpen(false)
        resetMiniScriptGeneration()
      }
    },
    [submitMiniScriptGenerate, resetMiniScriptGeneration],
  )

  const handleMiniScriptModalClose = useCallback(() => {
    setMiniScriptModalOpen(false)
    resetMiniScriptGeneration()
  }, [resetMiniScriptGeneration])

  // PR1 壳层 (calm-by-default): once a session is live, a failed 3s poll no longer
  // routes to the full-page error — the sync-loss dot + reconnect toast own that state.
  // Poll errors only become pageError when there is no session to render yet.
  const pageError =
    bootstrapError ??
    (eventSessionError ? getIcebreakerPageErrorText(eventSessionError, '无法创建破冰会话') : null) ??
    (sessionError ? getIcebreakerPageErrorText(sessionError, getErrorMessage('load-failed')) : null) ??
    (socialSessionQuery.error && !session ? getIcebreakerPageErrorText(socialSessionQuery.error, getErrorMessage('sync-failed')) : null)

  const isBootstrapping = !!resolvedSessionId && !socialSessionId && pendingAction === 'start' && !session

  // Mid-session expiry: a 410 on the live poll is NOT a sync blip — show the
  // terminal surface instead of the infinite reconnect toast.
  const sessionExpired =
    !!session &&
    !!socialSessionQuery.error &&
    (socialSessionQuery.error as { statusCode?: number }).statusCode === 410

  if (sessionExpired) {
    return (
      <View className='icebreaker icebreaker--error'>
        <View className='icebreaker__error' role='alert'>
          <Image
            className='icebreaker__error-hero'
            src={cdnAsset('/assets/lovart/lovart-generic-empty.webp')}
            mode='widthFix'
            lazyLoad
          />
          <Text className='icebreaker__error-text'>
            这场破冰已经结束了，回忆都帮你留好啦
          </Text>
          <Button variant='primary' className='icebreaker__error-btn' onClick={handleGoBack}>
            回到活动详情
          </Button>
        </View>
      </View>
    )
  }

  if (authLoading || eventSessionLoading || sessionLoading || isBootstrapping) {
    return (
      <OnboardingLoadingShell
        stepLabel='同桌游戏'
        title='正在加入破冰会话'
        subtitle={`${getMascotDisplayName(user)}正在对齐活动与同桌状态，马上就能开始。`}
        hint='若网络稍慢，多等几秒不会错过开场。'
        xiaoyueExpression='loadingSystem'
      />
    )
  }

  if (!resolvedSessionId || pageError || !session) {
    return (
      <View className='icebreaker icebreaker--error'>
        <View className='icebreaker__error' role='alert'>
          <Image
            className='icebreaker__error-hero'
            src={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
            mode='widthFix'
            lazyLoad
          />
          <Text className='icebreaker__error-text'>
            {pageError ?? '无法加入破冰会话'}
          </Text>
          <Button variant='secondary' className='icebreaker__error-btn' onClick={handleGoBack}>
            返回
          </Button>
        </View>
      </View>
    )
  }

  const phaseHeader = (
    <XiaoyueSessionShell
      phase={phase}
      sessionPack={session?.xiaoyueSessionPack}
      adaptiveSuggestion={suggestionOverlayOpen ? adaptiveSuggestion : undefined}
      isHost={isHost}
      syncLost={syncLost}
      showHostMenu={hostMenuItems.length > 0}
      onOpenHostMenu={handleHostMenuTap}
      onDismissSuggestion={handleDismissAdaptiveSuggestion}
      onAigcFeedbackTap={handleAigcFeedbackTap}
    />
  )


  const supportedPhases: SessionPhase[] = [
    'waiting',
    'warmup',
    'phase_selection',
    'micro_challenge',
    'lie_detective',
    'auction',
    'personality_dice',
    'quip_battle',
    'undercover_word',
    'group_mirror',
    'mini_script',
    'recap',
    'ended',
    'speed_friending',
  ]

  const currentPlayer = session.lieDetectivePlayers?.[session.currentLieDetectivePlayerIndex ?? 0]
  const hasGeneratedStatements =
    session.lieDetectivePlayers?.some((player) => player.userId === currentUserId && player.statements.length > 0) ??
    false
  const canMoveToNextPlayer =
    !!currentPlayer &&
    !!session.currentLieDetectiveReveal &&
    (session.currentLieDetectivePlayerIndex ?? 0) < (session.lieDetectivePlayers?.length ?? 0) - 1
  const flowSyncCopy = (() => {
    switch (pendingAction) {
      case 'start':
        return '正在进入破冰局…'
      case 'advance':
        return '正在进入下一环节…'
      case 'select-phase':
        return '正在同步玩法…'
      case 'set-tier':
        return '正在切换模式…'
      case 'end-session':
        return '正在整理本局…'
      default:
        return null
    }
  })()
  const phaseShellClass = `icebreaker__phase-shell${flowSyncCopy ? ' icebreaker__phase-shell--syncing' : ''}`

  // Phase dispatch moved to SessionPhaseViews (2026-08-12) — this object
  // carries every value/callback the presentational tree needs.
  const phaseViewsProps: SessionPhaseViewsProps = {
    phase,
    session,
    participants,
    currentUserId,
    isHost,
    playerCount,
    pendingAction,
    canChangeTier,
    glanceStackEnabled,
    supportedPhases,
    mascotDisplayName: getMascotDisplayName(user),
    personalityDiceChooseMode: features?.personalityDiceChooseMode,
    lastTopicsMood: lastTopicsMoodRef.current,
    topicsError,
    topicsRecovery,
    myVoteIndex,
    hasGeneratedStatements,
    canMoveToNextPlayer,
    socialSessionId,
    miniScriptModalOpen,
    miniScriptSubmitting,
    miniScriptGenerationStatus,
    recapData: recapQuery.data?.state?.recapData ?? session.recapData ?? null,
    recapSummary: recapQuery.data?.summary ?? null,
    recapMedals: recapQuery.data?.medals ?? [],
    recapMeta: recapQuery.data?.meta ?? null,
    onOpenTierSheet: () => setIsTierSheetOpen(true),
    onOpenMiniScript: () => {
      resetMiniScriptGeneration()
      setMiniScriptModalOpen(true)
    },
    onMiniScriptClose: handleMiniScriptModalClose,
    onMiniScriptSubmit: handleMiniScriptSubmit,
    onRefreshSession: () => socialSessionQuery.refetch(),
    onAdvance: handleAdvancePhase,
    onGenerateSessionPack: handleGenerateSessionPack,
    onAigcFeedbackTap: handleAigcFeedbackTap,
    onGenerateTopics: handleGenerateTopics,
    onToggleWarmupReady: handleToggleWarmupReady,
    onNextWarmupTopic: handleNextWarmupTopic,
    onRitualStart: handleRitualStart,
    onSelectPhase: handleSelectCustomPhase,
    onEndSession: handleEndCustomSession,
    onCompleteChallenge: handleCompleteChallenge,
    onCastVote: handleCastVote,
    onGenerateStatements: handleGenerateStatements,
    onNextLieDetectivePlayer: handleNextLieDetectivePlayer,
    onGenerateLieStatementFromTag: handleGenerateLieStatementFromTag,
    onGenerateAuctionLots: handleGenerateAuctionLots,
    onAuctionBid: handleAuctionBid,
    onCloseAuctionLot: handleCloseAuctionLot,
    onAssignRoles: handleAssignRoles,
    onRevealAct: handleRevealAct,
    onMiniScriptVote: handleVote,
    onRevealSolution: handleRevealSolution,
    onMiniScriptReady: handleMiniScriptReady,
    onGenerateDiceChallenges: handleGenerateDiceChallenges,
    onCompleteDiceChallenge: handleCompleteDiceChallenge,
    onChooseDiceOption: handleChooseDiceOption,
    onDiceReady: handleDiceReady,
    onDiceRevealReady: handleDiceRevealReady,
    onNextSpeedFriendingRound: handleNextSpeedFriendingRound,
    onCompleteSpeedFriending: handleCompleteSpeedFriending,
    onGoBack: handleGoBack,
    onConnectTap: handleConnectTap,
  }

  return (
    <ScrollView
      className={`icebreaker${phase === 'warmup' ? ' icebreaker--warmup' : ''}${moodField ? ` icebreaker--mood-field icebreaker--field-${moodField.state}` : ''}`}
      scrollY={phase !== 'warmup'}
      enhanced
      showScrollbar={false}
      enableFlex={phase === 'warmup'}
    >
      {/* S2 ambient mood field: static gradient layers cross-faded by the
          derived model (opacity/scale inline — WeChat drops hsla(); computed
          rgba/opacities ride inline per the phaseAccents pattern). Rendered
          only when icebreakerMoodFieldEnabled is on. */}
      {moodField && (
        <View className='icebreaker__field' aria-hidden='true'>
          <View className='icebreaker__field-layer icebreaker__field-layer--base' />
          <View
            className='icebreaker__field-layer icebreaker__field-layer--cool'
            style={{ opacity: moodField.coolOpacity }}
          />
          <View
            className='icebreaker__field-layer icebreaker__field-layer--warm'
            style={{ opacity: moodField.warmOpacity, transform: `scale(${moodField.warmScale})` }}
          />
          {moodField.fragment && (
            <Text className='icebreaker__field-fragment'>{moodField.fragment}</Text>
          )}
        </View>
      )}
      {/* scroll-view padding is unsupported in WeChat — pad the inner wrapper. */}
      <View className='icebreaker__inner'>
      <View className='icebreaker__header-wrap'>
        {phaseHeader}

        {/* PR1 壳层: one-time host ⋯ coachmark — floats below the band's right
            edge, points up at the trigger, never covers the CTA area. */}
        {coachmarkShown && (
          <View
            className='icebreaker__coachmark'
            onClick={handleDismissCoachmark}
            role='button'
            aria-label='知道了'
          >
            <Text className='icebreaker__coachmark-text'>
              {`点 ⋯ 更换模式，或找${getMascotDisplayName(user)}支招`}
            </Text>
            <View className='icebreaker__coachmark-arrow' aria-hidden='true' />
          </View>
        )}
      </View>

      <PhaseIntroOverlay
        phase={phase}
        visible={showPhaseIntro}
        mode={glanceStackEnabled && (phase === 'warmup' || phase === 'micro_challenge') ? 'field' : 'overlay'}
      />

      {phaseToast.visible && (
        <View className='icebreaker__phase-toast'>
          <Image
            className='icebreaker__phase-toast-mascot'
            src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
            mode='aspectFit'
          />
          <View className='icebreaker__phase-toast-text'>{phaseToast.text}</View>
        </View>
      )}

      {flowSyncCopy && (
        <View className='icebreaker__flow-sync'>
          <View className='icebreaker__flow-sync-dot' />
          <Text className='icebreaker__flow-sync-text'>{flowSyncCopy}</Text>
        </View>
      )}

      {session?.bonusGateOffered && !session?.bonusGateAccepted && !session?.bonusGateDeclined && socialSessionId && (
        <BonusGateOverlay
          socialSessionId={socialSessionId}
          isHost={isHost}
          playerCount={playerCount}
          sentimentSummary={session.bonusGateSentimentSummary}
          ownSentiment={session.bonusGateOwnSentiment}
          onResponded={() => socialSessionQuery.refetch()}
        />
      )}

      <View className={phaseShellClass} key={phase}>
        <SessionPhaseViews {...phaseViewsProps} />
      </View>

      <IcebreakerTierSheet
        isOpen={isTierSheetOpen}
        currentTier={session?.eventTier ?? 'glow'}
        currentVibe={apiVibeToClient(session?.vibe)}
        customEnabled={features?.socialIcebreakerCustomModeEnabled !== false}
        isBusy={pendingAction === 'set-tier'}
        onClose={() => setIsTierSheetOpen(false)}
        onConfirm={handleConfirmTierSwitch}
      />
      </View>
    </ScrollView>
  )
}

