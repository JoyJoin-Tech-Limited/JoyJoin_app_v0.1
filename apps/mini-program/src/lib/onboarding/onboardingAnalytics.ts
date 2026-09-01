import Taro from '@tarojs/taro'
import { apiRequest } from '../api/api'
import type { ExperimentMarker } from '../experiments'
import { logWarn } from '../utils/logger'
import { getSystemInfoCompat } from '../../lib/utils/systemInfo'

export type MiniProgramOnboardingAnalyticsStep =
  | 'login'
  | 'onboarding'
  | 'personality-test'
  | 'personality-test-results'
  | 'essential-data'
  | 'extended-data'
  | 'profile-review'
  | 'welcome-back'

  | 'essential-data'
  | 'extended-data'
  | 'profile-review'
  | 'welcome-back'
  | 'discover'

export type OnboardingAnalyticsEventType =
  | 'step_started'
  | 'step_enter'
  | 'step_completed'
  | 'step_abandoned'
  | 'validation_failed'
  | 'error_occurred'
  | 'interaction'

export interface MiniProgramOnboardingSystemInfo {
  brand?: string
  model?: string
  system?: string
  platform?: string
  version?: string
  language?: string
  screenWidth?: number
  screenHeight?: number
}

export interface MiniProgramOnboardingAnalyticsEvent {
  step: MiniProgramOnboardingAnalyticsStep
  eventType: OnboardingAnalyticsEventType
  metadata?: Record<string, unknown>
  timestamp: number
  sessionDuration: number
  stepDuration?: number
  userAgent: string
  screenSize: string
  /**
   * Client-persisted anonymous id (R1-3 funnel stitching). Generated once per
   * install, survives the anonymous→login handoff, and is mirrored into
   * `metadata.anonymousId` so the current server-side metadata blob retains it.
   */
  anonymousId?: string
  /** R3-10 experiment marker — present on every event while an experiment is active. */
  experiment?: ExperimentMarker
}

const ONBOARDING_SESSION_START_KEY = 'joyjoin_onboarding_session_start'
const ONBOARDING_ANONYMOUS_ID_KEY = 'joyjoin_onboarding_anonymous_id'

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readStoredSessionStartTime(): number | null {
  try {
    const storedValue = Taro.getStorageSync(ONBOARDING_SESSION_START_KEY)
    const parsedValue = typeof storedValue === 'number' ? storedValue : Number(storedValue)
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null
  } catch {
    return null
  }
}

function writeStoredSessionStartTime(value: number): void {
  try {
    Taro.setStorageSync(ONBOARDING_SESSION_START_KEY, String(value))
  } catch {
    // Non-blocking by design.
  }
}

function initializeSessionStartTime(): number {
  const storedValue = readStoredSessionStartTime()
  if (storedValue) {
    return storedValue
  }

  const now = Date.now()
  writeStoredSessionStartTime(now)
  return now
}

function generateAnonymousId(): string {
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Read-or-create the client-side anonymous id. Persisted in Taro storage so
 * pre-login (userId=null) and post-login events share one stitch key. Never
 * cleared by login, restart, or session reset — that continuity is the point.
 */
function initializeAnonymousId(): string {
  try {
    const storedValue = Taro.getStorageSync(ONBOARDING_ANONYMOUS_ID_KEY)
    if (typeof storedValue === 'string' && storedValue.trim() !== '') {
      return storedValue
    }
    const generated = generateAnonymousId()
    Taro.setStorageSync(ONBOARDING_ANONYMOUS_ID_KEY, generated)
    return generated
  } catch {
    // Storage unavailable: fall back to an in-memory id so events still carry
    // a stable key for this run.
    return generateAnonymousId()
  }
}

function getCurrentRoute(): string {
  try {
    const pages = Taro.getCurrentPages()
    return pages[pages.length - 1]?.route ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

function getSystemInfoSnapshot(): MiniProgramOnboardingSystemInfo {
  try {
    const systemInfo = getSystemInfoCompat()
    return {
      brand: normalizeString(systemInfo.brand),
      model: normalizeString(systemInfo.model),
      system: normalizeString(systemInfo.system),
      platform: normalizeString(systemInfo.platform),
      version: normalizeString(systemInfo.version),
      language: normalizeString(systemInfo.language),
      screenWidth: normalizeNumber(systemInfo.screenWidth),
      screenHeight: normalizeNumber(systemInfo.screenHeight),
    }
  } catch {
    return {}
  }
}

export function buildMiniProgramOnboardingAnalyticsEvent(input: {
  step: MiniProgramOnboardingAnalyticsStep
  eventType: OnboardingAnalyticsEventType
  now: number
  sessionStartTime: number
  stepStartTime?: number
  metadata?: Record<string, unknown>
  route?: string
  systemInfo?: MiniProgramOnboardingSystemInfo
  anonymousId?: string
  experiment?: ExperimentMarker
}): MiniProgramOnboardingAnalyticsEvent {
  const route = normalizeString(input.route) ?? 'unknown'
  const systemInfo = input.systemInfo ?? {}
  const sessionDuration = Math.max(0, input.now - input.sessionStartTime)
  const stepDuration =
    typeof input.stepStartTime === 'number'
      ? Math.max(0, input.now - input.stepStartTime)
      : undefined

  const userAgent = [
    'joyjoin-mini-program',
    normalizeString(systemInfo.platform) ?? 'unknown-platform',
    normalizeString(systemInfo.system) ?? 'unknown-system',
    normalizeString(systemInfo.brand) ?? 'unknown-brand',
    normalizeString(systemInfo.model) ?? 'unknown-model',
    normalizeString(systemInfo.version) ?? 'unknown-version',
  ].join(' | ')

  const screenWidth = normalizeNumber(systemInfo.screenWidth)
  const screenHeight = normalizeNumber(systemInfo.screenHeight)
  const screenSize =
    typeof screenWidth === 'number' && typeof screenHeight === 'number'
      ? `${screenWidth}x${screenHeight}`
      : 'unknown'

  const metadata = {
    ...(input.metadata ?? {}),
    appSurface: 'mini-program',
    runtime: 'taro',
    route,
    platform: normalizeString(systemInfo.platform) ?? 'unknown',
    system: normalizeString(systemInfo.system) ?? 'unknown',
    brand: normalizeString(systemInfo.brand) ?? 'unknown',
    model: normalizeString(systemInfo.model) ?? 'unknown',
    version: normalizeString(systemInfo.version) ?? 'unknown',
    language: normalizeString(systemInfo.language) ?? 'unknown',
    taroEnv: process.env.TARO_ENV ?? 'unknown',
    // Mirrored into metadata so today's server-side metadata blob retains the
    // stitch key / experiment marker even before dedicated columns exist.
    ...(input.anonymousId ? { anonymousId: input.anonymousId } : {}),
    ...(input.experiment ? { experiment: input.experiment } : {}),
  }

  return {
    step: input.step,
    eventType: input.eventType,
    metadata,
    timestamp: input.now,
    sessionDuration,
    ...(typeof stepDuration === 'number' ? { stepDuration } : {}),
    userAgent,
    screenSize,
    ...(input.anonymousId ? { anonymousId: input.anonymousId } : {}),
    ...(input.experiment ? { experiment: input.experiment } : {}),
  }
}

class MiniProgramOnboardingAnalytics {
  private sessionStartTime = initializeSessionStartTime()

  private anonymousId = initializeAnonymousId()

  private activeExperiment: ExperimentMarker | null = null

  /**
   * Duration timers keyed by step, or `${step}#${stepId}` when the caller
   * passes a sub-step id (essential-data wizard) — page-level and sub-step
   * durations never clobber each other.
   */
  private stepStartTimes = new Map<string, number>()

  private resolveStartKey(
    step: MiniProgramOnboardingAnalyticsStep,
    metadata?: Record<string, unknown>,
  ): string {
    const stepId = typeof metadata?.stepId === 'string' && metadata.stepId !== '' ? metadata.stepId : null
    return stepId ? `${step}#${stepId}` : step
  }

  resetSession(): void {
    this.sessionStartTime = Date.now()
    this.stepStartTimes.clear()
    writeStoredSessionStartTime(this.sessionStartTime)
    // Deliberately NOT reset: anonymousId (funnel stitch key) and the active
    // experiment marker must survive session resets and the login handoff.
  }

  /** The stable anonymous id carried on every event (funnel stitching). */
  getAnonymousId(): string {
    return this.anonymousId
  }

  /**
   * R3-10: set (or clear) the active experiment marker. While set, EVERY
   * onboarding analytics event carries `{ flagKey, bucket }` — pass null when
   * no experiment is active.
   */
  setActiveExperiment(marker: ExperimentMarker | null): void {
    this.activeExperiment = marker
  }

  stepStarted(step: MiniProgramOnboardingAnalyticsStep, metadata?: Record<string, unknown>): void {
    this.stepStartTimes.set(this.resolveStartKey(step, metadata), Date.now())
    this.track('step_started', step, metadata)
  }

  /**
   * Sub-step / single-screen enter signal. essential-data fires this per
   * wizard sub-step (`stepId` + `stepIndex` in metadata); single-screen steps
   * fire it once so funnel queries have a uniform enter event.
   */
  stepEnter(step: MiniProgramOnboardingAnalyticsStep, metadata?: Record<string, unknown>): void {
    this.stepStartTimes.set(this.resolveStartKey(step, metadata), Date.now())
    this.track('step_enter', step, metadata)
  }

  stepCompleted(step: MiniProgramOnboardingAnalyticsStep, metadata?: Record<string, unknown>): void {
    const key = this.resolveStartKey(step, metadata)
    this.track('step_completed', step, metadata, this.stepStartTimes.get(key))
    this.stepStartTimes.delete(key)
  }

  stepAbandoned(
    step: MiniProgramOnboardingAnalyticsStep,
    reason?: string,
    metadata?: Record<string, unknown>,
  ): void {
    const mergedMetadata = {
      ...(reason ? { reason } : {}),
      ...(metadata ?? {}),
    }
    const key = this.resolveStartKey(step, mergedMetadata)
    this.track(
      'step_abandoned',
      step,
      Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
      this.stepStartTimes.get(key),
    )
    this.stepStartTimes.delete(key)
  }

  validationFailed(
    step: MiniProgramOnboardingAnalyticsStep,
    field: string,
    reason: string,
  ): void {
    this.track(
      'validation_failed',
      step,
      { field, reason },
      this.stepStartTimes.get(step),
    )
  }

  errorOccurred(
    step: MiniProgramOnboardingAnalyticsStep,
    errorType: string,
    errorMessage: string,
  ): void {
    this.track(
      'error_occurred',
      step,
      { errorType, errorMessage },
      this.stepStartTimes.get(step),
    )
  }

  interaction(
    step: MiniProgramOnboardingAnalyticsStep,
    action: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.track(
      'interaction',
      step,
      { action, ...(metadata ?? {}) },
      this.stepStartTimes.get(step),
    )
  }

  private track(
    eventType: OnboardingAnalyticsEventType,
    step: MiniProgramOnboardingAnalyticsStep,
    metadata?: Record<string, unknown>,
    stepStartTime?: number,
  ): void {
    const event = buildMiniProgramOnboardingAnalyticsEvent({
      step,
      eventType,
      metadata,
      now: Date.now(),
      sessionStartTime: this.sessionStartTime,
      stepStartTime,
      route: getCurrentRoute(),
      systemInfo: getSystemInfoSnapshot(),
      anonymousId: this.anonymousId,
      experiment: this.activeExperiment ?? undefined,
    })

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/onboarding',
      method: 'POST',
      data: event,
      // Populates the server `sessionId` column for anonymous (session-less)
      // requests; authenticated requests keep their server-side session id.
      headers: { 'x-session-id': this.anonymousId },
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[OnboardingAnalytics] Failed to send onboarding event', {
        step,
        eventType,
        message,
      })
    })
  }
}

export const onboardingAnalytics = new MiniProgramOnboardingAnalytics()