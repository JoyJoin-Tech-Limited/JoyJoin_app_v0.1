
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { ARCHETYPE_CANONICAL_ORDER } from '@shared/personality/archetypeNames'
import { questionsV4 } from '@shared/personality/questionsV4'
import {
  hasAnonymousAssessmentResult,
  readAnonymousAssessmentAnswers,
  type AnonymousAssessmentResult,
  type AnonymousAssessmentSessionSnapshot,
  type AnonymousAssessmentTopMatch,
} from '../../../../lib/auth/anonymousOnboarding'

export type FlowStage = 'loading' | 'slot' | 'reveal' | 'bridge' | 'result' | 'error' | 'empty'
export type SlotPhase = 'anticipation' | 'spinning' | 'holding' | 'slowing' | 'nearMiss' | 'landed'
export type RevealPhase = 'silhouette' | 'fill' | 'sparkle'

export interface ResolvedResultState {
  sessionId: string
  completedAt?: string
  result: AnonymousAssessmentResult
  topMatches: AnonymousAssessmentTopMatch[]
}

export const ARCHETYPE_SEQUENCE = [...ARCHETYPE_CANONICAL_ORDER]

export interface CanvasImageCacheEntry {
  asset: string
  path: string
  width?: number
  height?: number
}

/**
 * Resolve the image used by poster canvases without allowing a path from a
 * previously displayed archetype to leak into the current result.
 */
export async function resolveCurrentCanvasImage(
  asset: string,
  candidates: string[],
  cached: CanvasImageCacheEntry | null,
  resolveImage: (options: { src: string }) => Promise<{ path?: string; width?: number; height?: number }>,
  timeoutMs = 5000,
): Promise<CanvasImageCacheEntry> {
  if (cached?.asset === asset && cached.path) return cached

  for (const candidate of candidates.filter(Boolean)) {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    try {
      const info = await Promise.race([
        resolveImage({ src: candidate }),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`Canvas image resolution timed out: ${candidate}`)), timeoutMs)
        }),
      ])
      if (info.path) {
        return {
          asset,
          path: info.path,
          ...(info.width && info.height ? { width: info.width, height: info.height } : {}),
        }
      }
    } catch {
      // Try the next same-archetype format/source.
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
  }

  throw new Error(`Unable to resolve canvas image for archetype: ${asset}`)
}

export const TRAIT_LABELS: Array<{ key: string; label: string }> = [
  { key: 'A', label: '亲和力' },
  { key: 'O', label: '开放性' },
  { key: 'C', label: '责任心' },
  { key: 'E', label: '稳定感' },
  { key: 'X', label: '外向度' },
  { key: 'P', label: '快乐值' },
]

/**
 * Centralized animation timing profile.
 * All timing constants are consolidated here for easy tuning and A/B testing.
 * Override via env or query param: `?animationProfile=fast`
 */
export interface AnimationProfile {
  slotAnticipationMs: number
  slotSpinMs: number
  slotSpinIntervalMs: number
  slotHoldIntervalMs: number
  slotSlowStepDelays: number[]
  slotNearMissMs: number
  slotNearMissProbability: number
  /**
   * F1 blend reframe (2026-07-19 satisfaction audit): 'blend' overshoots onto the
   * user's secondary archetype — "almost you" instead of a random neighbour.
   * 'random' retains the legacy neighbour-overshoot for rollback.
   */
  slotNearMissMode: 'blend' | 'random'
  slotRevealPauseMs: number
  revealSilhouetteMs: number
  revealFillMs: number
  revealGlowMs: number
  bridgeMs: number
  slowNetworkMs: number
  flowSafetyTimeoutMs: number
}

const DEFAULT_PROFILE: AnimationProfile = {
  slotAnticipationMs: 900,
  slotSpinMs: 2500,
  slotSpinIntervalMs: 120,
  slotHoldIntervalMs: 180,
  slotSlowStepDelays: [80, 130, 180, 230, 280, 330, 380, 430, 480, 530],
  slotNearMissMs: 360,
  slotNearMissProbability: 0.3,
  slotNearMissMode: 'blend',
  slotRevealPauseMs: 280,
  revealSilhouetteMs: 520,
  revealFillMs: 760,
  revealGlowMs: 500,
  bridgeMs: 300,
  slowNetworkMs: 3200,
  flowSafetyTimeoutMs: 16000,
}

const FAST_PROFILE: AnimationProfile = {
  ...DEFAULT_PROFILE,
  slotSpinMs: 1800,
  revealSilhouetteMs: 350,
  revealFillMs: 450,
  revealGlowMs: 300,
  bridgeMs: 150,
}

const DRAMATIC_PROFILE: AnimationProfile = {
  ...DEFAULT_PROFILE,
  slotAnticipationMs: 1400,
  slotSpinMs: 3600,
  slotSpinIntervalMs: 150,
  slotHoldIntervalMs: 240,
  slotSlowStepDelays: [120, 180, 240, 300, 360, 420, 480, 540, 600, 660],
  slotNearMissMs: 520,
  slotRevealPauseMs: 400,
  revealSilhouetteMs: 700,
  revealFillMs: 1000,
  revealGlowMs: 680,
  bridgeMs: 450,
  flowSafetyTimeoutMs: 18000,
}

export type AnimationProfileName = 'baseline' | 'fast' | 'dramatic'

const PROFILE_BY_NAME: Record<AnimationProfileName, AnimationProfile> = {
  baseline: DEFAULT_PROFILE,
  fast: FAST_PROFILE,
  dramatic: DRAMATIC_PROFILE,
}

/**
 * Resolve the slot animation timing profile.
 *
 * Precedence (K3 Phase 1+, 2026-08-01):
 *  1. Web-sandbox query param `?animationProfile=` (design-audit:intentional —
 *     mini-program has no `window`, so this branch never runs in production).
 *  2. `profileName` — server-selected via the `personalitySlotProfileFast` /
 *     `personalitySlotProfileDramatic` feature flags (dramatic wins, both
 *     false = baseline).
 *  3. Baseline default.
 */
export function getAnimationProfile(profileName: AnimationProfileName = 'baseline'): AnimationProfile {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href) // design-audit:intentional — web sandbox only; mini-program skips this branch
    const sandboxName = url.searchParams.get('animationProfile')
    if (sandboxName === 'fast' || sandboxName === 'dramatic') {
      return PROFILE_BY_NAME[sandboxName]
    }
  }
  return PROFILE_BY_NAME[profileName]
}

/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_ANTICIPATION_MS = DEFAULT_PROFILE.slotAnticipationMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_SPIN_MS = DEFAULT_PROFILE.slotSpinMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_NEAR_MISS_MS = DEFAULT_PROFILE.slotNearMissMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_REVEAL_PAUSE_MS = DEFAULT_PROFILE.slotRevealPauseMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_SPIN_INTERVAL_MS = DEFAULT_PROFILE.slotSpinIntervalMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_HOLD_INTERVAL_MS = DEFAULT_PROFILE.slotHoldIntervalMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const SLOT_SLOW_STEP_DELAYS = DEFAULT_PROFILE.slotSlowStepDelays
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const RESULT_SLOW_NETWORK_MS = DEFAULT_PROFILE.slowNetworkMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const FLOW_SAFETY_TIMEOUT_MS = DEFAULT_PROFILE.flowSafetyTimeoutMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const REVEAL_SILHOUETTE_MS = DEFAULT_PROFILE.revealSilhouetteMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const REVEAL_FILL_MS = DEFAULT_PROFILE.revealFillMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const REVEAL_SPARKLE_MS = DEFAULT_PROFILE.revealGlowMs
/** @deprecated Use AnimationProfile via getAnimationProfile() */
export const RESULT_BRIDGE_MS = DEFAULT_PROFILE.bridgeMs
export const GENERIC_API_ERROR_PREFIX = 'Request failed with status'

export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** Max echo whispers rotated during the spin (2026-07-19 PM spec). */
export const ECHO_WHISPER_MAX = 3
/** Answers shorter than this are skipped as whispers (too trivial to quote). */
export const ECHO_WHISPER_MIN_CHARS = 4
/** Spin steps between whisper rotations (7 × 120ms ≈ 840ms). */
export const ECHO_WHISPER_ROTATE_STEPS = 7

/**
 * Slice 3 (2026-07-19): answer-echo whispers for the spin phase.
 * Maps locally stored anonymous answers back to their option texts so the slot
 * can quote the user ("你说过「…」") — proof of analysis, not chance.
 * Returns up to ECHO_WHISPER_MAX unique texts; empty for authenticated users
 * (their answers are not stored locally).
 */
export function buildEchoWhispers(): string[] {
  const answers = readAnonymousAssessmentAnswers()
  if (!Array.isArray(answers) || answers.length === 0) return []
  const whispers: string[] = []
  for (const answer of answers.slice(-8)) {
    const question = questionsV4.find((q) => q.id === answer.questionId)
    const optionText = trimSentence(
      question?.options?.find((o) => o.value === answer.selectedOption)?.text ?? '',
    )
    if (optionText.length >= ECHO_WHISPER_MIN_CHARS && !whispers.includes(optionText)) {
      whispers.push(optionText)
      if (whispers.length >= ECHO_WHISPER_MAX) break
    }
  }
  return whispers
}

export function trimSentence(text: string | undefined): string {
  return (text ?? '').replace(/[。！!？?]+$/g, '').trim()
}

export function buildShareLine(archetype: string, tagline: string, summary: string): string {
  const detail = trimSentence(tagline) || trimSentence(summary)
  if (!detail) {
    return `在 JoyJoin 解锁了 ${archetype} 氛围命格，来看看你的。`
  }

  return `${archetype}：${detail}。`
}

export function buildShareTitle(archetype: string, tagline: string): string {
  const detail = trimSentence(tagline)
  if (!detail) {
    return `我在 JoyJoin 解锁了 ${archetype}`
  }

  return `${archetype}已解锁：${detail}`
}

export function resolveResultErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message && !error.message.startsWith(GENERIC_API_ERROR_PREFIX)) {
    return error.message
  }

  return getErrorMessage('sync-failed')
}

export function getTraitEntries(
  result: AnonymousAssessmentResult | null | undefined,
): Array<{ key: string; label: string; value: number }> {
  const traitScores = result?.traitScores ?? {}

  return TRAIT_LABELS.map(({ key, label }) => {
    const rawValue = Number(traitScores[key] ?? 50)
    return {
      key,
      label,
      value: Math.max(0, Math.min(Math.round(rawValue), 100)),
    }
  })
}

export function getTopMatches(
  result: AnonymousAssessmentResult | null | undefined,
  storedMatches: AnonymousAssessmentTopMatch[] | null | undefined,
): AnonymousAssessmentTopMatch[] {
  if (Array.isArray(storedMatches) && storedMatches.length > 0) {
    return storedMatches
  }

  return Array.isArray(result?.topMatches) ? result.topMatches : []
}

export function getVisibleReelItems(currentIndex: number): string[] {
  const length = ARCHETYPE_SEQUENCE.length
  const previousIndex = (currentIndex - 1 + length) % length
  const nextIndex = (currentIndex + 1) % length
  return [
    ARCHETYPE_SEQUENCE[previousIndex] ?? ARCHETYPE_SEQUENCE[0],
    ARCHETYPE_SEQUENCE[currentIndex] ?? ARCHETYPE_SEQUENCE[0],
    ARCHETYPE_SEQUENCE[nextIndex] ?? ARCHETYPE_SEQUENCE[0],
  ]
}

/**
 * Re-map raw matcher scores (often 0-100, but can cluster low) to a
 * user-facing 18-100 scale so the metric never reads insultingly low.
 * Preserves rank order and makes the number feel meaningful rather than
 * algorithmically raw.
 */
export function normalizeMatchScore(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  const pct = raw > 1 ? raw : raw * 100
  return Math.max(18, Math.min(100, Math.round(pct * 0.72 + 28)))
}

export interface TypicalityLabel {
  /** Semantic prefix (典型 / 非典型 / 混合型). */
  prefix: string
  /** Archetype display name rendered in brand/accent colour. */
  name: string
  /** Contrast-safe archetype accent colour for text on light backgrounds. */
  accent: string
}

/**
 * Build a user-facing typicality label that avoids misleading raw scores.
 * - Decisive match  → "典型[archetype]"
 * - Non-decisive    → "非典型[archetype]"
 * - Missing data    → undefined
 *
 * The archetype name is returned separately so callers can render it in the
 * archetype's branded accent colour with no separator space. Use
 * `accentText` (contrast-safe) rather than the raw `accent` so the label
 * remains readable on light card backgrounds.
 */
export function buildTypicalityLabel(
  isDecisive: boolean | undefined,
  archetypeName: string,
  accentText: string,
): TypicalityLabel | undefined {
  if (!archetypeName) return undefined
  const prefix = isDecisive === false ? '非典型' : '典型'
  return { prefix, name: archetypeName, accent: accentText }
}

/**
 * Deterministic near-miss based on sessionId hash.
 * Replaces Math.random() for reproducibility and analytics.
 * Probability capped at 30% to reduce casino-feel manipulation.
 */
export function shouldNearMiss(sessionId: string | undefined, probability = 0.3): boolean {
  if (!sessionId) return false
  let hash = 0
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 100) < Math.round(probability * 100)
}

export function buildResolvedResultState(
  snapshot: AnonymousAssessmentSessionSnapshot | null,
): ResolvedResultState | null {
  if (!snapshot?.sessionId || !snapshot.result || !hasAnonymousAssessmentResult(snapshot)) {
    return null
  }

  return {
    sessionId: snapshot.sessionId,
    completedAt: snapshot.completedAt,
    result: snapshot.result,
    topMatches: getTopMatches(snapshot.result, snapshot.topArchetypes),
  }
}
