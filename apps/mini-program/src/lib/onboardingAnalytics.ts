import Taro from '@tarojs/taro'
import { apiRequest } from './api'
import { logWarn } from './logger'

export type MiniProgramOnboardingAnalyticsStep =
  | 'login'
  | 'onboarding'
  | 'personality-test'
  | 'personality-test-results'
  | 'personality-test-auth-gate'
  | 'essential-data'
  | 'extended-data'
  | 'profile-review'
  | 'guide'
  | 'discover'

export type OnboardingAnalyticsEventType =
  | 'step_started'
  | 'step_completed'
  | 'step_abandoned'
  | 'validation_failed'
  | 'error_occurred'

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
}

const ONBOARDING_SESSION_START_KEY = 'joyjoin_onboarding_session_start'

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
    const systemInfo = Taro.getSystemInfoSync()
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
  }
}

class MiniProgramOnboardingAnalytics {
  private sessionStartTime = initializeSessionStartTime()

  private stepStartTimes = new Map<MiniProgramOnboardingAnalyticsStep, number>()

  resetSession(): void {
    this.sessionStartTime = Date.now()
    this.stepStartTimes.clear()
    writeStoredSessionStartTime(this.sessionStartTime)
  }

  stepStarted(step: MiniProgramOnboardingAnalyticsStep, metadata?: Record<string, unknown>): void {
    this.stepStartTimes.set(step, Date.now())
    this.track('step_started', step, metadata)
  }

  stepCompleted(step: MiniProgramOnboardingAnalyticsStep, metadata?: Record<string, unknown>): void {
    this.track('step_completed', step, metadata, this.stepStartTimes.get(step))
    this.stepStartTimes.delete(step)
  }

  stepAbandoned(step: MiniProgramOnboardingAnalyticsStep, reason?: string): void {
    this.track(
      'step_abandoned',
      step,
      reason ? { reason } : undefined,
      this.stepStartTimes.get(step),
    )
    this.stepStartTimes.delete(step)
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
    })

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/onboarding',
      method: 'POST',
      data: event,
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