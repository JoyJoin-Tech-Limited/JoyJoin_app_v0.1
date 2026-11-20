import { View, Text } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { AIGCMeta, AIResponseMeta } from '@shared/types/aiMeta'
import { GENERIC_PROFILE_TAGLINE_FALLBACK } from '@shared/ai/onboarding'
import type {
  ProfileTaglineLine,
  ProfileTaglineLineRole,
  ProfileTaglineEvidence,
  ProfileTaglineResponse,
} from '@shared/ai/onboarding'
import AIGCLabel from '../ai-content/AIGCLabel'
import AIContentReportButton from '../ai-content/AIContentReportButton'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import { haptics } from '../../lib/utils/haptics'

export type InsightRevealLineRole = ProfileTaglineLineRole

export type InsightRevealLine = ProfileTaglineLine

export type InsightEvidenceItem = ProfileTaglineEvidence

/**
 * Tolerant view of the shared v2 DTO: old servers omit `lines`/`evidence`
 * entirely, so they stay optional here even though the shared contract
 * marks them required (sprint entry-card-insight-v2, AC-01 / REL-02).
 */
export type ProfileTaglineV2Response = Omit<ProfileTaglineResponse, 'lines' | 'evidence' | 'insightLine' | 'meta'> & {
  lines?: InsightRevealLine[]
  evidence?: InsightEvidenceItem[]
  meta?: AIResponseMeta
  /** Legacy v1 field (= inference line text). Old servers send only this. */
  insightLine?: string
}

/** Contract AC-08: 350–500ms between LLM row landings. */
export const INSIGHT_ROW_STAGGER_MS = 420

/** AIGC compliance meta for the aggregated footer label (Amendment A1 / AC-16). */
const AIGC_FOOTER_META: AIGCMeta = { aiGenerated: true, labelType: 'ai-generated' }

/**
 * P1 feedback control copy. One card-level ask, two answered states — the
 * question is replaced by the acknowledgment so the footer never grows.
 */
const FEEDBACK_QUESTION_COPY = '这几句像你吗？'
const FEEDBACK_THANKS_COPY = '谢谢，悦仔会记住'
const FEEDBACK_OPTIONS: ReadonlyArray<{
  vote: InsightLineFeedbackMeta['vote']
  label: string
}> = [
  { vote: 'accurate', label: '挺像的' },
  { vote: 'inaccurate', label: '不太像' },
]

/**
 * AC-19 telemetry payload for `insight_reveal_complete`, fired once per page
 * visit when every row has landed (or the legacy/generic shape renders).
 */
export interface InsightRevealCompleteMeta {
  /** Rendered shape: v2 rows, legacy v1 single line, or the generic fallback. */
  shape: 'v2' | 'v1' | 'generic'
  lineCount: number
  hasReveal: boolean
  fallbackUsed: boolean
  /** Milliseconds from the tagline query start to all-rows-landed. */
  latencyMs: number
}

/**
 * AC-23 E-1: per-line light feedback payload for `insight_line_feedback`.
 * Anonymous by construction — no identity fields ride this event.
 */
export interface InsightLineFeedbackMeta {
  role: InsightRevealLineRole
  vote: 'accurate' | 'inaccurate'
  /** Index within the full v2 `lines` array (not the LLM-only subset). */
  lineIndex: number
  shape: 'v2'
}

export interface InsightRevealCardProps {
  /** v2 (or legacy v1) tagline response; undefined while loading or on error. */
  tagline?: ProfileTaglineV2Response
  isLoading: boolean
  isError: boolean
  /** Page reveal gate — the staged sequence may only begin once visible. */
  active: boolean
  shouldReduceMotion: boolean
  aigcLabelsEnabled: boolean
  /**
   * AC-18 kill-switch (`features.entryCardInsightV2Enabled`). When explicitly
   * false, renders the legacy single-line UI regardless of the response shape.
   */
  v2Enabled?: boolean
  /** Query start timestamp (ms) for the AC-19 latencyMs measurement. */
  queryStartedAt?: number | null
  /**
   * Per-visit replay nonce: bumped by the page's useDidShow so the reveal
   * sequence (and the AC-19 emission) re-runs on swipe-back revisits.
   */
  replayNonce?: number
  /**
   * AC-21③: themed poster accent (e.g. `visual.accentText`). The reveal row
   * text inherits it when provided; falls back to the brand purple token.
   */
  accentColor?: string
  onRetry: () => void
  /** Fires once when the full row sequence has landed (immediately for legacy/error/reduced-motion). */
  onAllRowsLanded?: () => void
  /** AC-19: fires once per visit alongside onAllRowsLanded, carrying telemetry metadata. */
  onRevealComplete?: (meta: InsightRevealCompleteMeta) => void
  /** AC-23: fires ONCE per visit when the card-level 挺像的/不太像 control is
   *  answered. The payload keeps the pre-P1 shape and is keyed to the primary
   *  (last / most meaningful) LLM row, so existing page telemetry is unchanged. */
  onLineFeedback?: (meta: InsightLineFeedbackMeta) => void
}

function sanitizeLines(lines: InsightRevealLine[] | undefined): InsightRevealLine[] {
  if (!Array.isArray(lines)) {
    return []
  }
  return lines.filter(
    (line): line is InsightRevealLine =>
      Boolean(line) && typeof line.text === 'string' && line.text.trim() !== '',
  )
}

function sanitizeEvidence(evidence: InsightEvidenceItem[] | undefined): InsightEvidenceItem[] {
  if (!Array.isArray(evidence)) {
    return []
  }
  return evidence.filter(
    (item): item is InsightEvidenceItem =>
      Boolean(item) && typeof item.text === 'string' && item.text.trim() !== '',
  )
}

/**
 * InsightRevealCard — 「悦仔的观察」 three-row staged reveal (entry-card-insight-v2,
 * Amendment A1 polish).
 *
 * v2 shape: the deterministic observation row lands first; the evidence group
 * follows on its own micro-beat (~120ms later, pills staggered 60ms via CSS
 * nth-child delays); LLM rows show a dual-bar skeleton, then land one by one
 * with a single `haptics('success')` on the FINAL row only (AC-14).
 *
 * AIGC disclosure is aggregated into ONE quiet card footer (AC-16): a single
 * AIGCLabel + a chrome-less text report button, rendered only when ≥1 landed
 * row has aigc=true (fail-closed — deterministic/legacy shapes render none).
 *
 * Feedback is ONE card-level control (P1 redesign): 「这几句像你吗？」 on its own
 * full-width line, with a two-segment control on the row below it, rendered
 * only after every row has landed. It replaces the per-row 准/不太准 text links,
 * which repeated under every line, read as stray metadata and clashed with the
 * insight typography. The stacked footer is deliberate: side-by-side, the ask
 * and the segments collided at 320pt and under large system fonts. The answer
 * still emits the anonymous `insight_line_feedback` payload once, keyed to the
 * primary (last / most meaningful) LLM row.
 *
 * Backward compat: when `lines` is absent/empty (old server or v1 fallback) or
 * `v2Enabled` is explicitly false (AC-18), renders the current single-line UI
 * from `insightLine` unchanged, with the legacy section-level AIGC label.
 *
 * Styling note (subpackage trap): this component deliberately carries NO
 * `import './InsightRevealCard.scss'` side effect — the consuming page SCSS
 * `@use`s it so the rules compile into the page WXSS.
 */
export default function InsightRevealCard({
  tagline,
  isLoading,
  isError,
  active,
  shouldReduceMotion,
  aigcLabelsEnabled,
  v2Enabled = true,
  queryStartedAt = null,
  replayNonce = 0,
  accentColor,
  onRetry,
  onAllRowsLanded,
  onRevealComplete,
  onLineFeedback,
}: InsightRevealCardProps) {
  const lines = useMemo(() => sanitizeLines(tagline?.lines), [tagline])
  const evidence = useMemo(() => sanitizeEvidence(tagline?.evidence), [tagline])
  // AC-18: flag-off forces the legacy rendering path even when v2 data arrives.
  const isV2 = v2Enabled && lines.length > 0

  // Landing order = DOM order: deterministic rows → evidence pills → LLM rows.
  const deterministicLines = useMemo(() => lines.filter((line) => !line.aigc), [lines])
  // AC-23: LLM rows keep their ORIGINAL lines index for the feedback payload.
  const llmRows = useMemo(
    () =>
      lines
        .map((line, lineIndex) => ({ line, lineIndex }))
        .filter((row) => row.line.aigc),
    [lines],
  )
  // P1: the card-level answer speaks for the whole reveal, so the telemetry
  // payload rides the primary row — the LAST aigc line (the reveal row when
  // the server sends one, the inference line otherwise).
  const primaryFeedbackRow = llmRows.length > 0 ? llmRows[llmRows.length - 1] : null

  const [landedLlmRowCount, setLandedLlmRowCount] = useState(0)
  // P1: ONE card-level verdict for the whole reveal — not a per-row vote.
  const [cardVote, setCardVote] = useState<InsightLineFeedbackMeta['vote'] | null>(null)
  const notifiedForRef = useRef<unknown>(null)
  const prevReplayNonceRef = useRef(replayNonce)
  // Once-per-visit guard: a double-tap inside one tick can never double-fire
  // the event before the disabled re-render lands.
  const cardVoteRef = useRef<InsightLineFeedbackMeta['vote'] | null>(null)

  // Per-visit replay, as a render-phase adjustment (the React-sanctioned
  // "adjust state when a prop changes" pattern — NOT an effect): the page
  // bumps replayNonce from useDidShow, and the sequence + emission dedupe
  // reset synchronously so a swipe-back revisit re-runs the reveal instead of
  // firing telemetry on stale landed state. P1: the answer resets too.
  if (prevReplayNonceRef.current !== replayNonce) {
    prevReplayNonceRef.current = replayNonce
    notifiedForRef.current = null
    cardVoteRef.current = null
    if (cardVote !== null) {
      setCardVote(null)
    }
    if (landedLlmRowCount !== 0) {
      setLandedLlmRowCount(0)
    }
  }

  // Staged LLM-row sequence: dual-bar skeleton → land, one row per
  // INSIGHT_ROW_STAGGER_MS tick. AC-14 haptics grammar: intermediate rows are
  // silent; only the FINAL landed row triggers haptics('success').
  // Reduced-motion and inactive gates skip the sequence entirely (AC-11).
  useEffect(() => {
    if (!isV2 || !active || shouldReduceMotion) return
    if (landedLlmRowCount >= llmRows.length) return

    const timer = setTimeout(() => {
      const landingCount = landedLlmRowCount + 1
      setLandedLlmRowCount(landingCount)
      if (landingCount >= llmRows.length) {
        haptics('success')
      }
    }, INSIGHT_ROW_STAGGER_MS)
    return () => clearTimeout(timer)
  }, [isV2, active, shouldReduceMotion, llmRows.length, landedLlmRowCount])

  // Never fire settle/telemetry while the query is in flight (no data yet).
  const allRowsLanded =
    !isLoading && (!isV2 || shouldReduceMotion || landedLlmRowCount >= llmRows.length)

  const insightText = tagline?.insightLine?.trim() || ''
  const isGenericShape =
    !isV2 && (insightText === '' || insightText === GENERIC_PROFILE_TAGLINE_FALLBACK)
  const shape: InsightRevealCompleteMeta['shape'] = isV2 ? 'v2' : isGenericShape ? 'generic' : 'v1'

  useEffect(() => {
    if (!allRowsLanded) return
    if (notifiedForRef.current === tagline) return
    notifiedForRef.current = tagline
    onAllRowsLanded?.()
    onRevealComplete?.({
      shape,
      lineCount: isV2 ? lines.length : shape === 'v1' ? 1 : 0,
      hasReveal: isV2 && lines.some((line) => line.role === 'reveal'),
      fallbackUsed: tagline?.meta?.fallbackUsed ?? shape !== 'v1',
      latencyMs:
        typeof queryStartedAt === 'number' && Number.isFinite(queryStartedAt)
          ? Math.max(0, Date.now() - queryStartedAt)
          : 0,
    })
    // replayNonce is a deliberate dep: the render-phase reset above nulled
    // notifiedForRef on the bump, so a new visit re-fires even when the
    // tagline object and landed state are otherwise unchanged (legacy shape).
  }, [replayNonce, allRowsLanded, tagline, shape, isV2, lines, queryStartedAt, onAllRowsLanded, onRevealComplete])

  // Entrance gating: the entrance animation must start when the page reveal
  // flips active, not on mount (the section sits inside a hidden stage until
  // then). Static class = no animation; landed class = transform/opacity ease.
  const rowMotionClass =
    shouldReduceMotion || !active ? 'insight-reveal__row--static' : 'insight-reveal__row--landed'
  const evidenceMotionClass =
    shouldReduceMotion || !active
      ? 'insight-reveal__evidence--static'
      : 'insight-reveal__evidence--landed'

  // AC-16 fail-closed footer: render only when ≥1 LANDED row is aigc=true.
  const landedLlmCount = shouldReduceMotion
    ? llmRows.length
    : Math.min(landedLlmRowCount, llmRows.length)
  const showAigcFooter = isV2 && landedLlmCount > 0 && aigcLabelsEnabled

  // P1: the ask waits for the whole reveal — never over skeletons, the legacy
  // single line, or before the page stage is actually visible.
  const showFeedbackFooter = isV2 && active && allRowsLanded && primaryFeedbackRow !== null

  // AC-21③: the reveal row inherits the themed poster accent when provided;
  // the SCSS token ($color-primary) stays the fallback when absent.
  const getRowTextStyle = (line: InsightRevealLine) =>
    line.role === 'reveal' && accentColor ? { color: accentColor } : undefined

  // P1: one card-level answer → haptic + the unchanged anonymous telemetry
  // payload, keyed to the primary row so `insight_line_feedback` consumers
  // need no change. Ref-guarded for double-taps inside a single tick.
  const handleCardFeedback = (vote: InsightLineFeedbackMeta['vote']) => {
    if (!primaryFeedbackRow || cardVoteRef.current) return
    cardVoteRef.current = vote
    haptics('light')
    onLineFeedback?.({
      role: primaryFeedbackRow.line.role,
      vote,
      lineIndex: primaryFeedbackRow.lineIndex,
      shape: 'v2',
    })
    setCardVote(vote)
  }

  const renderLlmRow = (row: { line: InsightRevealLine; lineIndex: number }, index: number) => {
    const { line } = row
    const landed = shouldReduceMotion || index < landedLlmRowCount
    if (!landed) {
      // AC-15: dual-bar skeleton (82% + 60%, each 32rpx, 8rpx apart)
      // approximates two-line text height — no landing height jump.
      return (
        <View
          key={`llm-skeleton-${index}`}
          className={`insight-reveal__row-skeleton insight-reveal__row-skeleton--${line.role}`}
          aria-busy='true'
        >
          <View className='insight-reveal__row-skeleton-bar insight-reveal__row-skeleton-bar--long' />
          <View className='insight-reveal__row-skeleton-bar insight-reveal__row-skeleton-bar--short' />
        </View>
      )
    }
    return (
      <View
        key={`llm-${index}`}
        className={`insight-reveal__row insight-reveal__row--${line.role} ${
          shouldReduceMotion ? 'insight-reveal__row--static' : 'insight-reveal__row--landed'
        }`}
      >
        <View className='insight-reveal__row-body'>
          <Text className='insight-reveal__row-text' style={getRowTextStyle(line)}>
            {line.text}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className='insight-reveal'>
      <View className='profile-review__section-label'>
        <JoyJoinIcon emoji='✨' tier='mood' size={24} className='profile-review__section-label-icon' />
        <Text className='profile-review__section-label-text'>悦仔的观察</Text>
        {/* Section-level label is the legacy v1 behaviour only; the v2 shape
            carries one aggregated footer label instead (Amendment A1 AC-16). */}
        {!isV2 ? <AIGCLabel meta={tagline?.meta?.aigc} /> : null}
      </View>

      {isLoading ? (
        <View
          className='profile-review__ai-tag profile-review__ai-tag--loading'
          aria-busy='true'
        >
          <View className='profile-review__ai-tag-shimmer' />
        </View>
      ) : !isV2 ? (
        // Legacy single-line shape — unchanged pre-v2 UI.
        <View
          className={`profile-review__ai-tag${isError ? ' profile-review__ai-tag--error' : ''}`}
        >
          <Text className='profile-review__ai-tag-quote profile-review__ai-tag-quote--top'>“</Text>
          <View className='profile-review__ai-tag-text-wrap'>
            <Text className='profile-review__ai-tag-text'>
              {insightText || GENERIC_PROFILE_TAGLINE_FALLBACK}
            </Text>
          </View>
          <Text className='profile-review__ai-tag-quote profile-review__ai-tag-quote--bottom'>”</Text>
          {isError ? (
            <Text
              className='profile-review__ai-tag-retry'
              onClick={() => {
                haptics('light')
                onRetry()
              }}
            >
              重试
            </Text>
          ) : null}
          {aigcLabelsEnabled && !isError ? (
            <AIContentReportButton
              variant='text'
              className='profile-review__ai-tag-report'
              options={{
                reason: '举报“悦仔的观察”AI 生成内容',
              }}
            />
          ) : null}
        </View>
      ) : (
        <View className='insight-reveal__card'>
          {deterministicLines.map((line, index) => (
            <View
              key={`det-${index}`}
              className={`insight-reveal__row insight-reveal__row--${line.role} ${rowMotionClass}`}
            >
              <View className='insight-reveal__row-body'>
                <Text className='insight-reveal__row-text' style={getRowTextStyle(line)}>
                  {line.text}
                </Text>
              </View>
            </View>
          ))}

          {evidence.length > 0 ? (
            <View className={`insight-reveal__evidence ${evidenceMotionClass}`}>
              {/* AC-15: 20rpx microcopy above the de-tagged pill row */}
              <Text className='insight-reveal__evidence-caption'>来自你的选择</Text>
              <View className='insight-reveal__evidence-pills'>
                {evidence.map((item, index) => (
                  <View key={`evidence-${index}`} className='insight-reveal__evidence-pill'>
                    <View className='insight-reveal__evidence-dot' />
                    <Text className='insight-reveal__evidence-text'>{item.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {llmRows.map((row, index) => renderLlmRow(row, index))}

          {/* P1: ONE card-level feedback ask, after the whole reveal has
              landed. Replaces the per-row 准/不太准 text links. The ask owns a
              line; both halves of the shared segmented control sit below it. */}
          {showFeedbackFooter ? (
            <View
              className={`insight-reveal__feedback ${
                shouldReduceMotion
                  ? 'insight-reveal__feedback--static'
                  : 'insight-reveal__feedback--landed'
              }`}
              role='group'
              aria-label={FEEDBACK_QUESTION_COPY}
            >
              <Text className='insight-reveal__feedback-question'>
                {cardVote ? FEEDBACK_THANKS_COPY : FEEDBACK_QUESTION_COPY}
              </Text>
              <View className='insight-reveal__feedback-segments'>
                {FEEDBACK_OPTIONS.map((option) => {
                  const isSelected = cardVote === option.vote
                  // After the answer, the segment the user did NOT pick is
                  // muted and inert; the picked one keeps its fill + check.
                  const isMuted = cardVote !== null && !isSelected
                  return (
                    <View
                      key={option.vote}
                      className={[
                        'insight-reveal__segment',
                        isSelected ? 'insight-reveal__segment--selected' : '',
                        isMuted ? 'insight-reveal__segment--muted' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      hoverClass={cardVote ? 'none' : 'insight-reveal__segment--hover'}
                      hoverStayTime={120}
                      role='button'
                      aria-label={option.label}
                      aria-pressed={isSelected}
                      aria-disabled={cardVote !== null}
                      onClick={() => handleCardFeedback(option.vote)}
                    >
                      {isSelected ? <View className='insight-reveal__segment-check' /> : null}
                      <Text>{option.label}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          ) : null}

          {/* AC-16: one aggregated AIGC label + de-chromed text report button,
              rendered only when a landed LLM row exists (fail-closed). */}
          {showAigcFooter ? (
            <View className='insight-reveal__footer'>
              <AIGCLabel
                meta={AIGC_FOOTER_META}
                enabled={aigcLabelsEnabled}
                className='insight-reveal__footer-aigc'
              />
              <AIContentReportButton
                variant='text'
                className='insight-reveal__footer-report'
                options={{
                  reason: '举报“悦仔的观察”AI 生成内容',
                }}
              />
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}
