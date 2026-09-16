import { View, Text, Input, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import type { AIGCMeta, AIResponseMeta } from '@shared/types/aiMeta'
import Chip from './ui/Chip'
import { haptics } from '../lib/utils/haptics'
import { getXiaoyueExpressionAsset } from '../lib/mascot/xiaoyueExpressions'
import { apiRequest } from '../lib/api/api'
import { useOnboardingAnalytics } from '../hooks/onboarding/useOnboardingAnalytics'
import { useDeviceTier } from '../hooks/useDeviceTier'
import { useResetOnShow } from '../hooks/useResetOnShow'
import { useAIGCLabelsEnabled } from '../hooks/useAIGCLabelsEnabled'
import AIGCLabel from './ai-content/AIGCLabel'
import AIContentReportButton from './ai-content/AIContentReportButton'
import ProfessionChatMessage, { ProfessionTypingBubble } from './profession/ProfessionChatMessage'
import ProfessionExpressionPreloader from './profession/ProfessionExpressionPreloader'
import ProfessionOverlayStatusHints from './profession/ProfessionOverlayStatusHints'
import { evaluateProfessionInputQuality } from '../lib/onboarding/professionInputQuality'
import { getLocalProfessionClassification } from '../lib/onboarding/localProfessionClassification'
import {
  INVALID_PROFESSION_MESSAGE,
  OPENING_MESSAGES_ARCHETYPE,
  OPENING_MESSAGES_GENERIC,
  ROTATING_PLACEHOLDERS,
  SKIP_RESPONSE_GENERIC,
  SKIP_RESPONSE_MEMORY,
} from '../lib/onboarding/professionOverlayCopy'
import {
  API_TIMEOUT_MS,
  DEBOUNCE_MS,
  MAX_SENDS_PER_SESSION,
  generateId,
  getAnticipationExpression,
  getReactionForProfession,
  mapFallbackExpression,
  mapSuccessExpression,
  type ChatMessage,
} from '../lib/onboarding/professionOverlayHelpers'
import {
  isDuplicateProfessionSubmission,
  isUsableProfessionResponse,
  isUsableStoredProfessionClassification,
} from '../lib/onboarding/professionSubmissionGuard'
import {
  applyTierCorrection,
  countResolvedTiers,
  createLadderStateFromClassification,
  rescopeCorrectionCandidates,
  resolveVisibleLadderRows,
  toPersistedClassificationFields,
  type LadderTier,
  type LadderValue,
  type ProfessionLadderState,
} from '../lib/onboarding/professionLadderReducer'
import './ProfessionChatOverlay.scss'
import { getSystemReducedMotionCompat } from '../lib/utils/systemInfo'

export interface ProfessionClassificationData {
  occupationId: string
  standardizedOccupationId: string | null
  industryCategoryLabel: string | null
  industrySegmentLabel: string | null
  industryNicheLabel: string | null
  industryCategory: string | null
  industrySegmentNew: string | null
  industryNiche: string | null
  industrySource: string
  industryConfidence: number
  /**
   * AIGC compliance meta extracted from the server response (`meta.aigc`).
   * Reflects reaction-generation fallback (`reactionFallbackUsed`), NOT the
   * classification `source` fallback. Absent on the local/deterministic path
   * → no label (fail-closed, AC-12).
   */
  meta?: AIGCMeta
}

/** ≤3 single-select correction options per tier, carried on the classify response. */
export interface ProfessionCorrectionCandidate {
  id: string
  label: string
}

export interface ProfessionCorrectionCandidates {
  category?: ProfessionCorrectionCandidate[]
  segment?: ProfessionCorrectionCandidate[]
  occupation?: ProfessionCorrectionCandidate[]
}

const MAX_CORRECTION_CANDIDATES = 3

/** Title shared by all three card states (Q1 — unified, never state-branched). */
const LADDER_TITLE = '悦仔记下了你的职业'
const LADDER_PENDING_COPY = '待补充'
const LADDER_CHANGE_COPY = '换一个'
const LADDER_BENEFIT_HINT = '补上职业方向，之后能进更对味的局'
const LADDER_FALLBACK_HINT = '网络有点慢，悦仔先记下了。等信号好了再帮你细细分析～'
/** §6.5 选中确认 — brief inline acknowledgment after a chip select (never a toast). */
const LADDER_ACK_COPY = '好，记下了'
/** Cascade explainer after a parent-tier correction clears the child rows. */
const LADDER_CASCADE_COPY: Record<'category' | 'segment', string> = {
  category: '下面两行也要再确认一下',
  segment: '角色这行也要再确认一下',
}
const CORRECTION_ACK_DURATION_MS = 2400

export interface ProfessionChatOverlayProps {
  visible: boolean
  isClosing?: boolean
  initialValue?: string
  smartProfession?: boolean
  userArchetype?: string
  onSubmit: (value: string, classificationData?: ProfessionClassificationData) => void
  onSkip: () => void
}

interface UnderstandProfessionResponse {
  reaction: string
  reactionHint: string
  displayTags: string[]
  classification: {
    category: { id: string; label: string } | null
    segment: { id: string; label: string } | null
    niche: { id: string; label: string } | null
    standardizedOccupationId: string | null
  }
  source: string
  confidence: number
  /**
   * AI observability envelope. Only the nested `aigc` flag is consumed for the
   * compliance label (server may not ship it yet → absent = no label).
   */
  meta?: AIResponseMeta
  /** Optional while the backend contract lands in parallel — absent → 「待补充」 only. */
  correctionCandidates?: ProfessionCorrectionCandidates
  archetypeContext?: {
    primaryArchetype: string | null
    traits: string[]
  }
}

export default function ProfessionChatOverlay({
  visible,
  isClosing = false,
  initialValue = '',
  smartProfession = false,
  userArchetype,
  onSubmit,
  onSkip,
}: ProfessionChatOverlayProps) {
  const [inputValue, setInputValue] = useState(initialValue)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [scrollTrigger, setScrollTrigger] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSent, setHasSent] = useState(false)
  const [showRevealCard, setShowRevealCard] = useState(false)
  const [classificationData, setClassificationData] = useState<ProfessionClassificationData | null>(null)
  const [thinkingLabel, setThinkingLabel] = useState<string | null>(null)
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null)
  const [showMaxSendHint, setShowMaxSendHint] = useState(false)
  const maxSendDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showShortHint, setShowShortHint] = useState(false)
  const sendCountRef = useRef(0)
  const lastSendTimeRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleStaggerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thinkingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastUserTextRef = useRef<string>('')
  const previousUserTextRef = useRef<string>('') // For retry continuity
  const clearThinkingTimers = useCallback(() => {
    thinkingTimersRef.current.forEach((timer) => clearTimeout(timer))
    thinkingTimersRef.current = []
  }, [])
  const analytics = useOnboardingAnalytics('essential-data', { enabled: true, autoTrackStart: false })
  const deviceTier = useDeviceTier()
  const aigcLabelsEnabled = useAIGCLabelsEnabled()
  const reduceMotion = useMemo(() => {
    try {
      const mq = (Taro.getApp() as any).config?.window?.prefersReducedMotion
      if (mq != null) return !!mq
    } catch { /* ignore */ }
    try {
      return getSystemReducedMotionCompat()
    } catch {
      return false
    }
  }, [])
  const [isOnline, setIsOnline] = useState(true)
  const isSubmittingRef = useRef(isSubmitting)
  useEffect(() => { isSubmittingRef.current = isSubmitting }, [isSubmitting])
  const sendGenerationRef = useRef(0)
  // Rotating placeholder index
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const placeholderTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 职业坐标阶梯 correction state — one row open at a time (§6.3)
  const [ladderState, setLadderState] = useState<ProfessionLadderState | null>(null)
  const [openTier, setOpenTier] = useState<LadderTier | null>(null)
  const [correctionCandidates, setCorrectionCandidates] = useState<ProfessionCorrectionCandidates | null>(null)
  const [aigcMeta, setAigcMeta] = useState<AIGCMeta | undefined>(undefined)
  const [ladderScrollTarget, setLadderScrollTarget] = useState('')
  const [bottomScrollTarget, setBottomScrollTarget] = useState('')
  const [correctionAck, setCorrectionAck] = useState<{
    tier: LadderTier
    cascade: 'category' | 'segment' | null
  } | null>(null)
  const correctionAckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ladderViewedRef = useRef(false)
  const correctedTiersRef = useRef<Set<LadderTier>>(new Set())
  // REL-04 — the overlay lives on a tab-less page kept alive across swipe-back;
  // collapse any open tray when the page is re-shown.
  const resetLadderTrayOnShow = useCallback((_visible: boolean) => {
    setOpenTier(null)
    setLadderScrollTarget('')
    setBottomScrollTarget('')
  }, [])
  useResetOnShow(resetLadderTrayOnShow)
  const rejectLowQualityProfessionInput = useCallback((rawText: string) => {
    const quality = evaluateProfessionInputQuality(rawText)
    if (quality.valid) return false

    const text = quality.normalized
    setShowShortHint(true)
    setShowRevealCard(false)
    setLadderState(null)
    setOpenTier(null)
    setCorrectionCandidates(null)
    setAigcMeta(undefined)
    setClassificationData(null)
    setRetryMessageId(null)
    setThinkingLabel(null)
    clearThinkingTimers()
    if (text) {
      setMessages((prev) => [
        ...prev,
        { id: generateId(), sender: 'user', text },
        { id: generateId(), sender: 'xiaoyue', text: INVALID_PROFESSION_MESSAGE, expressionId: 'testListening' },
      ])
      setScrollTrigger((c) => c + 1)
    }
    analytics.interaction('profession_chat_invalid_input', {
      reason: quality.reason ?? 'unknown',
      inputLength: text.length,
    })
    Taro.showToast({ title: '再具体一点，或点跳过', icon: 'none', duration: 2000 })
    return true
  }, [analytics, clearThinkingTimers])

  useEffect(() => {
    if (visible && !isClosing) {
      setInputValue(initialValue)
      const archetypeName = userArchetype ? (ARCHETYPE_BY_ID[userArchetype]?.nameCn ?? '') : ''
      const openingTexts = archetypeName ? OPENING_MESSAGES_ARCHETYPE(archetypeName) : OPENING_MESSAGES_GENERIC
      setMessages([
        { id: generateId(), sender: 'xiaoyue', text: openingTexts[0], expressionId: 'coachGuide' },
      ])
      // Stagger the clarification bubble so it feels like a real two-message turn.
      if (bubbleStaggerRef.current) clearTimeout(bubbleStaggerRef.current)
      bubbleStaggerRef.current = setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { id: generateId(), sender: 'xiaoyue', text: openingTexts[1], expressionId: 'testCurious' },
        ])
        setScrollTrigger((c) => c + 1)
      }, 450)
      setIsSubmitting(false)
      setHasSent(false)
      setShowRevealCard(false)
      setClassificationData(null)
      setRetryMessageId(null)
      setShowMaxSendHint(false)
      sendCountRef.current = 0
      lastSendTimeRef.current = 0
      lastUserTextRef.current = ''
      previousUserTextRef.current = ''
      setShowShortHint(false)
      // REL-04 — tray/ladder state must not survive a hide/show (swipe-back) cycle
      setLadderState(null)
      setOpenTier(null)
      setCorrectionCandidates(null)
      setAigcMeta(undefined)
      setLadderScrollTarget('')
      setBottomScrollTarget('')
      setCorrectionAck(null)
      if (correctionAckTimerRef.current) clearTimeout(correctionAckTimerRef.current)
      correctedTiersRef.current = new Set()

      // Check network status on open
      Taro.getNetworkType({
        success: (res) => setIsOnline(res.networkType !== 'none'),
        fail: () => setIsOnline(true), // optimistic default
      })
    }
  }, [visible, isClosing, initialValue, userArchetype])

  // Keep network status fresh during the session — separate effect for stable cleanup
  useEffect(() => {
    if (!visible) return
    const networkHandler = (res: { isConnected: boolean; networkType: string }) => {
      setIsOnline(res.isConnected && res.networkType !== 'none')
    }
    Taro.onNetworkStatusChange(networkHandler)
    return () => {
      Taro.offNetworkStatusChange(networkHandler)
    }
  }, [visible])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current)
      if (bubbleStaggerRef.current) clearTimeout(bubbleStaggerRef.current)
      if (maxSendDismissTimerRef.current) clearTimeout(maxSendDismissTimerRef.current)
      if (placeholderTimerRef.current) clearInterval(placeholderTimerRef.current)
      if (correctionAckTimerRef.current) clearTimeout(correctionAckTimerRef.current)
      clearThinkingTimers()
    }
  }, [clearThinkingTimers])

  useEffect(() => {
    const handler = (res: { height: number }) => {
      if (!visible) return
      setKeyboardHeight(res.height)
      if (res.height > 0) {
        analytics.interaction('profession_chat_keyboard_opened', { height: res.height })
      }
    }
    Taro.onKeyboardHeightChange(handler)
    return () => {
      Taro.offKeyboardHeightChange(handler)
    }
  }, [visible, analytics])

  // Rotating placeholders — cycle every 3.5s when input is empty and not submitting
  useEffect(() => {
    if (!visible || isSubmitting || inputValue.trim().length > 0) {
      if (placeholderTimerRef.current) {
        clearInterval(placeholderTimerRef.current)
        placeholderTimerRef.current = null
      }
      return
    }
    placeholderTimerRef.current = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % ROTATING_PLACEHOLDERS.length)
    }, 3500)
    return () => {
      if (placeholderTimerRef.current) {
        clearInterval(placeholderTimerRef.current)
        placeholderTimerRef.current = null
      }
    }
  }, [visible, isSubmitting, inputValue])

  useEffect(() => {
    if (showRevealCard && ladderState && !ladderViewedRef.current) {
      ladderViewedRef.current = true
      // Replaces profession_chat_reveal_card_viewed (spec §11 P7 — one event per card)
      analytics.interaction('profession_chat_ladder_viewed', {
        tierCount: countResolvedTiers(ladderState),
        source: classificationData?.industrySource ?? 'unknown',
        confidence: classificationData?.industryConfidence ?? 0,
      })
      // The card mounts after the reaction bubble — pull it into view once.
      setScrollTrigger((c) => c + 1)
    }
    if (!visible) ladderViewedRef.current = false
  }, [showRevealCard, ladderState, visible, analytics, classificationData])

  // Keep the expanded row in viewport (AC-04). `pageScrollTo` is a no-op inside
  // ScrollView — ScrollView.scrollIntoView (id, no `#`) is the only mechanism.
  useEffect(() => {
    if (!ladderScrollTarget) return
    const timer = setTimeout(() => setLadderScrollTarget(''), 600)
    return () => clearTimeout(timer)
  }, [ladderScrollTarget])

  // The bottom-anchor target is a one-shot too (same 600ms pattern). If it
  // latched on `scrollTrigger > 0`, clearing the ladder target would fall back
  // to `bottom-anchor` and re-trigger the scroll — yanking the just-opened
  // correction tray out of view.
  useEffect(() => {
    if (scrollTrigger === 0) return
    setBottomScrollTarget('bottom-anchor')
    const timer = setTimeout(() => setBottomScrollTarget(''), 600)
    return () => clearTimeout(timer)
  }, [scrollTrigger])

  // Abandoned correction — tray left open when the overlay closes
  useEffect(() => {
    if (!visible && openTier) {
      analytics.interaction('profession_chat_correction_abandoned', {
        tier: openTier,
        reason: 'closed',
      })
    }
  }, [visible, openTier, analytics])

  const handleSendNew = useCallback(async (overrideText?: string) => {
    const rawText = (overrideText ?? inputValue).trim()
    const quality = evaluateProfessionInputQuality(rawText)
    const text = quality.normalized
    if (!text || isSubmittingRef.current) return

    if (rejectLowQualityProfessionInput(text)) {
      return
    }
    setShowShortHint(false)

    if (
      smartProfession &&
      isUsableStoredProfessionClassification(classificationData) &&
      isDuplicateProfessionSubmission(text, classificationData)
    ) {
      setInputValue('')
      if (ladderState) {
        setShowRevealCard(true)
      }
      Taro.showToast({ title: '这个职业已经分析过啦', icon: 'none', duration: 1800 })
      analytics.interaction('profession_chat_duplicate_submission_blocked', {
        inputLength: text.length,
      })
      return
    }

    const now = Date.now()
    if (now - lastSendTimeRef.current < DEBOUNCE_MS) return
    if (sendCountRef.current >= MAX_SENDS_PER_SESSION) {
      setShowMaxSendHint(true)
      analytics.interaction('profession_chat_max_send_reached')
      if (maxSendDismissTimerRef.current) clearTimeout(maxSendDismissTimerRef.current)
      maxSendDismissTimerRef.current = setTimeout(() => setShowMaxSendHint(false), 4000)
      return
    }

    // Offline guard — show graceful message instead of failing silently
    if (!isOnline) {
      analytics.interaction('profession_chat_offline_blocked')
      Taro.showToast({ title: '网络好像断了，请检查连接后再试', icon: 'none', duration: 2000 })
      return
    }

    sendCountRef.current++
    lastSendTimeRef.current = now
    previousUserTextRef.current = lastUserTextRef.current
    lastUserTextRef.current = text
    setInputValue('')

    // Generation counter for race-safe stale response suppression.
    // Each new send increments the generation; responses from stale
    // generations are silently dropped.
    sendGenerationRef.current++
    const thisGeneration = sendGenerationRef.current

    setIsSubmitting(true)
    setHasSent(true)
    setShowRevealCard(false)
    setRetryMessageId(null)
    setShowMaxSendHint(false)
    clearThinkingTimers()
    setThinkingLabel(null)
    // Warm, Xiaoyue-personality thinking labels — rotate to feel alive
    // Retry continuity: acknowledge when text changed from previous attempt
    const isRetry = previousUserTextRef.current.length > 0 && text !== previousUserTextRef.current
    const thinkingLabels = [
      '让我想想…这个职业的小伙伴在局里是什么画风呢',
      isRetry ? '这次说得比上次更清楚，我再品一品～' : '嗯，有点意思，我再品一品～',
      '已经在帮你安排同频的小伙伴了，稍等片刻～',
      '让我再确认一下，不想给你贴错标签～',
    ]
    thinkingTimersRef.current = [
      setTimeout(() => setThinkingLabel(thinkingLabels[0]), 800),
      setTimeout(() => setThinkingLabel(thinkingLabels[1]), 2800),
      setTimeout(() => setThinkingLabel(thinkingLabels[2]), 4800),
      setTimeout(() => setThinkingLabel(thinkingLabels[3]), 6800),
    ]

    const userMsg: ChatMessage = { id: generateId(), sender: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setScrollTrigger((c) => c + 1)

    const localClassification = getLocalProfessionClassification(text)
    if (localClassification) {
      if (bubbleStaggerRef.current) clearTimeout(bubbleStaggerRef.current)
      bubbleStaggerRef.current = setTimeout(() => {
        if (sendGenerationRef.current !== thisGeneration) return

        const fullMsg: ChatMessage = {
          id: generateId(),
          sender: 'xiaoyue',
          text: localClassification.reaction,
          expressionId: 'coachGuide',
        }
        setMessages((prev) => [...prev, fullMsg])
        setScrollTrigger((c) => c + 1)
        setIsSubmitting(false)
        clearThinkingTimers()
        setThinkingLabel(null)

        const localData: ProfessionClassificationData = {
          occupationId: localClassification.occupationId,
          standardizedOccupationId: localClassification.standardizedOccupationId,
          industryCategoryLabel: localClassification.industryCategoryLabel,
          industrySegmentLabel: localClassification.industrySegmentLabel,
          industryNicheLabel: localClassification.industryNicheLabel,
          industryCategory: localClassification.industryCategory,
          industrySegmentNew: localClassification.industrySegmentNew,
          industryNiche: localClassification.industryNiche,
          industrySource: localClassification.industrySource,
          industryConfidence: localClassification.industryConfidence,
        }
        const localLadder = createLadderStateFromClassification(localData)
        setClassificationData(localData)
        setLadderState(localLadder)
        // Deterministic local path carries no server meta → no AIGC label (AC-12)
        setAigcMeta(undefined)
        setCorrectionCandidates(null)
        setShowRevealCard(localLadder !== null)
        haptics('success')
        analytics.interaction('profession_chat_local_classification_success', {
          kind: 'student_identity',
          tierCount: countResolvedTiers(localLadder),
          confidence: localClassification.industryConfidence,
        })
      }, 400)
      return
    }

    try {
      const data = await apiRequest<UnderstandProfessionResponse>({
        path: '/api/inference/understand-profession',
        method: 'POST',
        data: { description: text },
        timeout: API_TIMEOUT_MS,
      })

      // Drop stale response — a newer send superseded this one
      if (sendGenerationRef.current !== thisGeneration) return

      // Skip low-quality echo hints (e.g., "投资银行！投资银行方向？")
      const hintText = (data.reactionHint ?? '').trim()
      if (hintText) {
        const lowerHint = hintText.toLowerCase()
        const lowerText = text.toLowerCase()
        const isEcho = lowerHint.startsWith(lowerText) &&
          (hintText.length <= text.length + 6 ||
           hintText.replace(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim().length < 6)
        if (isEcho) {
          analytics.interaction('profession_chat_echo_suppressed', {
            hintLength: hintText.length,
            inputLength: text.length,
          })
        } else {
          const hintMsg: ChatMessage = {
            id: generateId(),
            sender: 'xiaoyue',
            text: data.reactionHint,
            expressionId: mapSuccessExpression(data.reactionHint),
          }
          setMessages((prev) => [...prev, hintMsg])
        }
      }

      if (bubbleStaggerRef.current) clearTimeout(bubbleStaggerRef.current)
      bubbleStaggerRef.current = setTimeout(() => {
        // Re-check generation inside the stagger timeout too
        if (sendGenerationRef.current !== thisGeneration) return
        if (!isUsableProfessionResponse(data)) {
          setMessages((prev) => [
            ...prev,
            { id: generateId(), sender: 'xiaoyue', text: INVALID_PROFESSION_MESSAGE, expressionId: 'testListening' },
          ])
          setScrollTrigger((c) => c + 1)
          setIsSubmitting(false)
          clearThinkingTimers()
          setThinkingLabel(null)
          setLadderState(null)
          setOpenTier(null)
          setShowRevealCard(false)
          setClassificationData(null)
          setCorrectionCandidates(null)
          setAigcMeta(undefined)
          analytics.interaction('profession_chat_low_confidence_blocked', {
            confidence: data.confidence,
            source: data.source,
          })
          return
        }
        const fullMsg: ChatMessage = {
          id: generateId(),
          sender: 'xiaoyue',
          text: data.reaction,
          expressionId: mapSuccessExpression(data.reaction),
        }
        setMessages((prev) => [...prev, fullMsg])
        setScrollTrigger((c) => c + 1)
        setIsSubmitting(false)
        clearThinkingTimers()
        setThinkingLabel(null)

        // AC-12 — the compliance flag lives at `meta.aigc`; it reflects the
        // reaction-generation fallback, not the classification `source`.
        const aigc = data.meta?.aigc
        const nextClassification: ProfessionClassificationData = {
          occupationId: text,
          standardizedOccupationId: data.classification.standardizedOccupationId,
          industryCategoryLabel: data.classification.category?.label ?? null,
          industrySegmentLabel: data.classification.segment?.label ?? null,
          industryNicheLabel: data.classification.niche?.label ?? null,
          industryCategory: data.classification.category?.id ?? null,
          industrySegmentNew: data.classification.segment?.id ?? null,
          industryNiche: data.classification.niche?.id ?? null,
          industrySource: data.source,
          industryConfidence: data.confidence,
          meta: aigc,
        }
        const nextLadder = createLadderStateFromClassification(nextClassification)
        setClassificationData(nextClassification)
        setLadderState(nextLadder)
        setCorrectionCandidates(data.correctionCandidates ?? null)
        setAigcMeta(aigc)
        // Render on row data, not tag count (§6.7 / AC-14)
        setShowRevealCard(nextLadder !== null)
        if (nextLadder) {
          haptics('success')
          analytics.interaction('profession_chat_classification_success', {
            tierCount: countResolvedTiers(nextLadder),
            confidence: data.confidence,
            source: data.source,
          })
        }
      }, 400)
    } catch (_err) {
      // Drop stale error response — a newer send superseded this one
      if (sendGenerationRef.current !== thisGeneration) return
      clearThinkingTimers()
      const didTimeout = _err instanceof Error && (
        _err.name === 'AbortError' ||
        /timeout|超时/.test(_err.message.toLowerCase())
      )
      analytics.interaction('profession_chat_classification_fallback', {
        errorType: _err instanceof Error ? _err.name : 'unknown',
        inputLength: text.length,
        timedOut: didTimeout,
      })
      const reaction = getReactionForProfession(text)
      // Refund send quota on failure so user can retry
      sendCountRef.current = Math.max(0, sendCountRef.current - 1)
      const fallbackMsgId = generateId()
      setMessages((prev) => [
        ...prev,
        { id: fallbackMsgId, sender: 'xiaoyue', text: reaction, expressionId: mapFallbackExpression(reaction), isFallback: true },
      ])
      setRetryMessageId(fallbackMsgId)
      setScrollTrigger((c) => c + 1)
      setIsSubmitting(false)
      setThinkingLabel(null)
      setClassificationData(null)
      setLadderState(null)
      setOpenTier(null)
      setCorrectionCandidates(null)
      setAigcMeta(undefined)
      setShowRevealCard(false)
    }
  }, [
    inputValue,
    isOnline,
    analytics,
    clearThinkingTimers,
    rejectLowQualityProfessionInput,
    smartProfession,
    classificationData,
    ladderState,
  ])

  const handleSendLegacy = useCallback((overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim()
    if (!text || isSubmittingRef.current) return

    if (rejectLowQualityProfessionInput(text)) {
      return
    }
    setShowShortHint(false)

    const now = Date.now()
    if (now - lastSendTimeRef.current < DEBOUNCE_MS) return
    if (sendCountRef.current >= MAX_SENDS_PER_SESSION) {
      setShowMaxSendHint(true)
      analytics.interaction('profession_chat_max_send_reached')
      if (maxSendDismissTimerRef.current) clearTimeout(maxSendDismissTimerRef.current)
      maxSendDismissTimerRef.current = setTimeout(() => setShowMaxSendHint(false), 4000)
      return
    }

    // Offline guard
    if (!isOnline) {
      analytics.interaction('profession_chat_offline_blocked')
      Taro.showToast({ title: '网络好像断了，请检查连接后再试', icon: 'none', duration: 2000 })
      return
    }

    sendCountRef.current++
    lastSendTimeRef.current = now
    previousUserTextRef.current = lastUserTextRef.current
    lastUserTextRef.current = text
    setInputValue('')

    setIsSubmitting(true)
    setHasSent(true)
    const userMsg: ChatMessage = { id: generateId(), sender: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setScrollTrigger((c) => c + 1)

    timeoutRef.current = setTimeout(() => {
      const reaction = getReactionForProfession(text)
      setMessages((prev) => [...prev, { id: generateId(), sender: 'xiaoyue', text: reaction, expressionId: 'coachGuide' }])
      setIsSubmitting(false)
      setScrollTrigger((c) => c + 1)
    }, 600)
  }, [inputValue, isOnline, analytics, rejectLowQualityProfessionInput])

  const handleSend = useCallback(() => {
    if (smartProfession) {
      handleSendNew()
    } else {
      handleSendLegacy()
    }
  }, [smartProfession, handleSendNew, handleSendLegacy])

  const handleRetry = useCallback(() => {
    const text = lastUserTextRef.current
    if (!text || isSubmittingRef.current) return
    analytics.interaction('profession_chat_retry_tapped', {
      inputLength: text.length,
    })
    setRetryMessageId(null)
    setInputValue(text)
    requestAnimationFrame(() => {
      if (smartProfession) {
        handleSendNew(text)
      } else {
        handleSendLegacy(text)
      }
    })
  }, [smartProfession, handleSendNew, handleSendLegacy, analytics])

  const handleSkip = useCallback(() => {
    haptics('light')
    analytics.interaction('profession_chat_skipped')
    // Warm skip with memory: acknowledge if user already sent something
    const hasUserMessage = messages.some((m) => m.sender === 'user')
    const skipText = hasUserMessage ? SKIP_RESPONSE_MEMORY : SKIP_RESPONSE_GENERIC
    setMessages((prev) => [
      ...prev,
      { id: generateId(), sender: 'xiaoyue', text: skipText, expressionId: 'homeWelcome' },
    ])
    skipTimeoutRef.current = setTimeout(() => {
      onSkip()
    }, 400)
  }, [onSkip, analytics, messages])

  /** Open / collapse the inline correction tray for one row (§6.3 — one row at a time). */
  const handleOpenCorrection = useCallback((tier: LadderTier) => {
    const candidates = correctionCandidates?.[tier] ?? []
    if (candidates.length === 0) return

    if (openTier === tier) {
      setOpenTier(null)
      analytics.interaction('profession_chat_correction_abandoned', { tier, reason: 'collapsed' })
      return
    }
    if (openTier) {
      analytics.interaction('profession_chat_correction_abandoned', {
        tier: openTier,
        reason: 'switched',
      })
    }
    haptics('light')
    setOpenTier(tier)
    // Keep the expanded row in viewport (AC-04)
    setLadderScrollTarget(`ladder-row-${tier}`)
    analytics.interaction('profession_chat_correction_opened', {
      tier,
      candidateCount: candidates.length,
    })
  }, [correctionCandidates, openTier, analytics])

  /** Single-select: update the row, cascade, collapse the tray (AC-03 / AC-05). */
  const handleSelectCorrection = useCallback((tier: LadderTier, choice: LadderValue) => {
    if (!ladderState) return
    const previous = ladderState[tier]
    const next = applyTierCorrection(ladderState, tier, choice)
    if (next === ladderState) return // mixed-parent guard rejected the choice

    correctedTiersRef.current.add(tier)
    setLadderState(next)
    setClassificationData((current) => {
      if (!current) return current
      return { ...current, ...toPersistedClassificationFields(next) }
    })
    // REL-01 — child-tier candidates were scoped to the pre-correction parent;
    // re-scope them so a stale segment/occupation can never be picked.
    setCorrectionCandidates((current) => rescopeCorrectionCandidates(current, tier, choice))
    setOpenTier(null)
    haptics('light')
    // §6.5 选中确认 + cascade explainer — subtle inline feedback, never a toast
    if (correctionAckTimerRef.current) clearTimeout(correctionAckTimerRef.current)
    setCorrectionAck({ tier, cascade: tier === 'occupation' ? null : tier })
    correctionAckTimerRef.current = setTimeout(() => setCorrectionAck(null), CORRECTION_ACK_DURATION_MS)
    analytics.interaction('profession_chat_tier_corrected', {
      tier,
      from: previous?.id ?? 'none',
      to: choice.id,
    })
  }, [ladderState, analytics])

  const handleConfirm = useCallback(() => {
    if (inputValue.trim() && rejectLowQualityProfessionInput(inputValue)) {
      return
    }
    if (smartProfession && !isUsableStoredProfessionClassification(classificationData)) {
      Taro.showToast({ title: '先让悦仔识别成功，或点跳过', icon: 'none', duration: 2000 })
      analytics.interaction('profession_chat_confirm_blocked_without_classification', {
        hasClassification: !!classificationData,
        source: classificationData?.industrySource ?? 'none',
      })
      return
    }
    const correctedTiers = Array.from(correctedTiersRef.current)
    if (correctedTiers.length > 0) {
      analytics.interaction('profession_chat_correction_confirmed', { correctedTiers })
    }
    analytics.interaction('profession_chat_confirmed', {
      hasClassification: !!classificationData,
      source: classificationData?.industrySource ?? 'legacy',
      tierCount: countResolvedTiers(ladderState),
    })
    if (smartProfession && classificationData) {
      onSubmit(classificationData.occupationId.trim(), classificationData)
    } else {
      onSubmit(inputValue.trim() || lastUserTextRef.current.trim())
    }
  }, [smartProfession, classificationData, inputValue, onSubmit, analytics, ladderState, rejectLowQualityProfessionInput])

  const canSubmit = inputValue.trim().length > 0 || hasSent
  const canShowFooterConfirm = !smartProfession && canSubmit

  const ladderRows = useMemo(() => resolveVisibleLadderRows(ladderState), [ladderState])
  const isFallbackSource = !!classificationData?.industrySource?.includes('fallback')
  const hasUnresolvedTier = ladderRows.some((row) => !row.value)
  // A row is fillable only when it is unresolved AND the tray has candidates —
  // otherwise the benefit hint invites an action the UI cannot complete.
  const hasFillableTier = ladderRows.some(
    (row) => !row.value && (correctionCandidates?.[row.tier]?.length ?? 0) > 0,
  )
  // AC-21 — honest, benefit-led hint whenever a row is still 待补充 (partial/fallback)
  const showBenefitHint = (isFallbackSource || hasUnresolvedTier) && hasFillableTier
  // C2 — a cascade hint is only honest when the child tiers it references are
  // fillable; otherwise it invites a fill the trays cannot deliver.
  const cascadeTargetsFillable = (() => {
    if (!correctionAck?.cascade) return false
    if (correctionAck.cascade === 'category') {
      return (correctionCandidates?.segment?.length ?? 0) > 0
        || (correctionCandidates?.occupation?.length ?? 0) > 0
    }
    return (correctionCandidates?.occupation?.length ?? 0) > 0
  })()
  // One soft check only when every visible row resolved — never a false success claim
  const showSoftCheck = !isFallbackSource && !hasUnresolvedTier && ladderRows.length > 0
  const scrollIntoView = ladderScrollTarget || bottomScrollTarget

  const messageList = useMemo(() => messages.map((msg) => (
    <ProfessionChatMessage key={msg.id} message={msg} />
  )), [messages])

  if (!visible && !isClosing) return null

  return (
    <View
      role='dialog'
      aria-modal='true'
      aria-label='职业输入'
      className={[
      'profession-overlay',
      isClosing ? 'profession-overlay--closing' : '',
      deviceTier.isDegradation ? 'profession-overlay--low-end' : '',
      reduceMotion ? 'profession-overlay--reduce-motion' : '',
    ].filter(Boolean).join(' ')}
    >
      <View className='profession-overlay__header'>
        <View className='profession-overlay__step-badge'>
          <Text className='profession-overlay__step-badge-text'>2 / 5</Text>
        </View>
        <View className='profession-overlay__skip' onClick={handleSkip} aria-label='跳过职业输入' hoverClass='profession-overlay__skip--active' hoverStartTime={0} hoverStayTime={100}>
          <Text className='profession-overlay__skip-text'>跳过</Text>
        </View>
      </View>

      <ScrollView
        className='profession-overlay__chat'
        scrollY
        enhanced
        showScrollbar={false}
        scrollIntoView={scrollIntoView}
        aria-live='polite'
        aria-atomic='false'
      >
        <View className='profession-overlay__chat-inner'>
          {messageList}
          {isSubmitting && (
            <ProfessionTypingBubble
              expressionId={getAnticipationExpression(lastUserTextRef.current)}
              thinkingLabel={thinkingLabel}
            />
          )}
          {showRevealCard && ladderState && (
            <View
              className={[
                'profession-overlay__reveal-card',
                isFallbackSource ? 'profession-overlay__reveal-card--fallback' : '',
              ].filter(Boolean).join(' ')}
              role='region'
              aria-label='职业分析结果'
            >
              <View className='profession-overlay__reveal-title-row'>
                <View className='profession-overlay__reveal-mascot' aria-hidden='true'>
                  <Image
                    className='profession-overlay__reveal-mascot-img'
                    src={getXiaoyueExpressionAsset(isFallbackSource ? 'coachGuide' : 'matchSuccess')}
                    mode='aspectFill'
                  />
                </View>
                {showSoftCheck && (
                  <View className='profession-overlay__reveal-check' aria-hidden='true'>
                    <Text className='profession-overlay__reveal-check-icon'>✓</Text>
                  </View>
                )}
                {/* Unified across all 3 states (Q1) — honesty lives in the ladder rows */}
                <Text className='profession-overlay__reveal-title'>{LADDER_TITLE}</Text>
                <AIGCLabel meta={aigcMeta} className='profession-overlay__reveal-aigc' />
              </View>

              {/* 职业坐标阶梯 — 类别 › 细分 › 角色 (§6.1) */}
              <View className='profession-overlay__ladder'>
                {ladderRows.map((row) => {
                  const candidates = correctionCandidates?.[row.tier] ?? []
                  const isOpen = openTier === row.tier
                  const hasCandidates = candidates.length > 0
                  return (
                    <View
                      key={row.tier}
                      id={`ladder-row-${row.tier}`}
                      className={[
                        'profession-overlay__ladder-row',
                        isOpen ? 'profession-overlay__ladder-row--open' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <View className='profession-overlay__ladder-row-main'>
                        <Text className='profession-overlay__ladder-label'>{row.label}</Text>
                        {row.value ? (
                          <View className='profession-overlay__ladder-pill-wrap'>
                            <Chip
                              label={row.value.label}
                              level={1}
                              compact
                              className='profession-overlay__ladder-pill'
                            />
                          </View>
                        ) : (
                          <View className='profession-overlay__ladder-pill-wrap'>
                            <View
                              className={[
                                'profession-overlay__ladder-pending',
                                hasCandidates ? '' : 'profession-overlay__ladder-pending--disabled',
                              ].filter(Boolean).join(' ')}
                              onClick={hasCandidates ? () => handleOpenCorrection(row.tier) : undefined}
                              aria-label={`补充${row.label}`}
                              aria-disabled={!hasCandidates}
                              hoverClass={hasCandidates ? 'profession-overlay__ladder-pending--active' : undefined}
                              hoverStartTime={0}
                              hoverStayTime={100}
                            >
                              <Text className='profession-overlay__ladder-pending-text'>{LADDER_PENDING_COPY}</Text>
                            </View>
                          </View>
                        )}
                        <View
                          className={[
                            'profession-overlay__ladder-change',
                            hasCandidates ? '' : 'profession-overlay__ladder-change--disabled',
                          ].filter(Boolean).join(' ')}
                          onClick={() => handleOpenCorrection(row.tier)}
                          aria-label={`更换${row.label}`}
                          hoverClass='profession-overlay__ladder-change--active'
                          hoverStartTime={0}
                          hoverStayTime={100}
                        >
                          <Text className='profession-overlay__ladder-change-text'>{LADDER_CHANGE_COPY}</Text>
                        </View>
                      </View>
                      {correctionAck?.tier === row.tier && (
                        <View className='profession-overlay__ladder-ack-block' aria-live='polite'>
                          <Text className='profession-overlay__ladder-ack'>{LADDER_ACK_COPY}</Text>
                          {correctionAck.cascade && cascadeTargetsFillable && (
                            <Text className='profession-overlay__ladder-cascade-hint'>
                              {LADDER_CASCADE_COPY[correctionAck.cascade]}
                            </Text>
                          )}
                        </View>
                      )}
                      {isOpen && hasCandidates && (
                        <View className='profession-overlay__ladder-tray'>
                          {candidates.slice(0, MAX_CORRECTION_CANDIDATES).map((candidate) => (
                            <Chip
                              key={candidate.id}
                              label={candidate.label}
                              compact
                              selected={candidate.id === row.value?.id}
                              className='profession-overlay__ladder-tray-chip'
                              onClick={() => handleSelectCorrection(row.tier, candidate)}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  )
                })}
              </View>

              {showBenefitHint && (
                <Text className='profession-overlay__reveal-hint profession-overlay__reveal-hint--benefit'>
                  {LADDER_BENEFIT_HINT}
                </Text>
              )}
              {isFallbackSource && (
                <Text className='profession-overlay__reveal-hint profession-overlay__reveal-hint--secondary'>
                  {LADDER_FALLBACK_HINT}
                </Text>
              )}
              {/* Social proof + chemistry bridge lines (demoted to a secondary tier) */}
              {!isFallbackSource && classificationData?.industryCategoryLabel && (
                <View className='profession-overlay__reveal-bridge'>
                  <Text className='profession-overlay__reveal-bridge-line'>
                    {`JoyJoin 里还有很多${classificationData.industryCategoryLabel}方向的小伙伴，你们应该很有共鸣～`}
                  </Text>
                  {userArchetype && ARCHETYPE_BY_ID[userArchetype]?.nameCn && (
                    <Text className='profession-overlay__reveal-bridge-line profession-overlay__reveal-bridge-line--chemistry'>
                      {`你的「${ARCHETYPE_BY_ID[userArchetype].nameCn}」特质 + ${classificationData.industryCategoryLabel}背景，在局里会很吃香`}
                    </Text>
                  )}
                </View>
              )}
              {/* AC-13 — the card's confirm is the only primary CTA while the ladder shows
                  (the footer CTA below stays gated by `!showRevealCard`). */}
              <View className='profession-overlay__reveal-confirm' onClick={() => { haptics('success'); handleConfirm() }} aria-label='确认并继续' hoverClass='profession-overlay__reveal-confirm--active' hoverStartTime={0} hoverStayTime={100}>
                <Text className='profession-overlay__reveal-confirm-text'>确认并继续</Text>
              </View>
              {aigcLabelsEnabled && (
                <AIContentReportButton
                  className='profession-overlay__reveal-report'
                  options={{
                    reason: '举报“职业解读”AI 辅助生成内容',
                  }}
                />
              )}
            </View>
          )}
          <View id='bottom-anchor' style={{ height: 1, width: '100%' }} />
        </View>
      </ScrollView>

      {/* §6.7 / AC-14 — once the ladder shows the chat input is hidden. Sending
          again would silently discard corrections; 换一个 is the only edit path. */}
      {!showRevealCard && (
      <View
        className='profession-overlay__input-bar'
        style={{ transform: `translateY(-${keyboardHeight}px)` }}
      >
        <Input
          className='profession-overlay__input'
          placeholder={isSubmitting ? '悦仔正在琢磨中…' : ROTATING_PLACEHOLDERS[placeholderIndex]}
          value={inputValue}
          onInput={(e) => setInputValue(e.detail.value)}
          onConfirm={handleSend}
          maxlength={50}
          adjustPosition={false}
          holdKeyboard
          disabled={isSubmitting}
          confirmType='send'
          cursorSpacing={32}
        />
        {canSubmit ? (
          <View
            className={`profession-overlay__send${isSubmitting ? ' profession-overlay__send--disabled' : ''}`}
            onClick={() => { if (!isSubmitting) { haptics('medium'); handleSend() } }}
            aria-label='发送'
            hoverClass='profession-overlay__send--active'
            hoverStartTime={0}
            hoverStayTime={100}
          >
            <View className='profession-overlay__send-arrow' />
          </View>
        ) : null}
      </View>
      )}

      {/* Preload common Xiaoyue expressions to eliminate first-render flicker — only while overlay is open */}
      {visible && !isClosing && !deviceTier.isDegradation && <ProfessionExpressionPreloader />}

      <ProfessionOverlayStatusHints
        isOnline={isOnline}
        showShortHint={showShortHint}
        isSubmitting={isSubmitting}
        showMaxSendHint={showMaxSendHint}
        retryMessageId={retryMessageId}
        showRevealCard={showRevealCard}
        onRetry={handleRetry}
      />

      {canShowFooterConfirm && !isSubmitting && !showRevealCard && (
        <View
          className='profession-overlay__cta'
        >
          <View className='profession-overlay__cta-btn' onClick={() => { haptics('medium'); handleConfirm() }} aria-label='确认并继续' hoverClass='profession-overlay__cta-btn--active' hoverStartTime={0} hoverStayTime={100}>
            <Text className='profession-overlay__cta-text'>确认并继续</Text>
          </View>
        </View>
      )}
    </View>
  )
}
