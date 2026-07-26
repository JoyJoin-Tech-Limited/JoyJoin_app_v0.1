import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export type LandingEventType =
  | 'landing_cta_tap'
  | 'landing_hero_asset'
  | 'landing_dwell'

export type LandingCtaType = 'new' | 'continue' | 'discover'

export interface TrackCtaTapProps {
  ctaType: LandingCtaType
  userNextStep: string | null
  hasIncompleteSession: boolean
  blockedByLegal: boolean
  dwellMs: number
  heroReady: boolean
}

export type LandingHeroAssetResult = 'success' | 'error' | 'fallback'
export type LandingHeroAssetSrcType = 'local' | 'cdn'

export interface TrackHeroAssetProps {
  asset: string
  result: LandingHeroAssetResult
  srcType: LandingHeroAssetSrcType
  durationMs: number
  networkType: string
}

export type LandingDwellBucket = '<3s' | '3-8s' | '8-15s' | '15-30s' | '>=30s'
export type LandingExitAction = 'cta_tap' | 'login_tap' | 'page_leave' | 'app_hide'

export interface TrackDwellProps {
  dwellMs: number
  dwellBucket: LandingDwellBucket
  exitAction: LandingExitAction
  ctaTypeShown: string
}

export interface LandingAnalyticsEvent {
  eventType: LandingEventType
  metadata?: Record<string, unknown>
  timestamp: number
}

class LandingAnalytics {
  trackCtaTap(props: TrackCtaTapProps): void {
    this.track('landing_cta_tap', {
      cta_type: props.ctaType,
      user_next_step: props.userNextStep,
      has_incomplete_session: props.hasIncompleteSession,
      blocked_by_legal: props.blockedByLegal,
      dwell_ms: props.dwellMs,
      hero_ready: props.heroReady,
    })
  }

  trackHeroAsset(props: TrackHeroAssetProps): void {
    this.track('landing_hero_asset', {
      asset: props.asset,
      result: props.result,
      src_type: props.srcType,
      duration_ms: props.durationMs,
      network_type: props.networkType,
    })
  }

  trackDwell(props: TrackDwellProps): void {
    this.track('landing_dwell', {
      dwell_ms: props.dwellMs,
      dwell_bucket: props.dwellBucket,
      exit_action: props.exitAction,
      cta_type_shown: props.ctaTypeShown,
    })
  }

  private track(
    eventType: LandingEventType,
    metadata?: Record<string, unknown>,
  ): void {
    const event: LandingAnalyticsEvent = {
      eventType,
      metadata: {
        ...metadata,
        appSurface: 'mini-program',
        runtime: 'taro',
      },
      timestamp: Date.now(),
    }

    void apiRequest<{ success?: boolean }>({
      path: '/api/analytics/landing',
      method: 'POST',
      data: event,
      handleUnauthorized: false,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      logWarn('[LandingAnalytics] Failed to send event', {
        eventType,
        message,
      })
    })
  }
}

/** Shared singleton instance — fire-and-forget, never throws into UI code. */
export const landingAnalytics = new LandingAnalytics()
