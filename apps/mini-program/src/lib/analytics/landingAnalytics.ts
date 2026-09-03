import { apiRequest } from '../api/api'
import { logWarn } from '../utils/logger'

export type LandingEventType =
  | 'landing_cta_tap'
  | 'landing_hero_asset'
  | 'landing_dwell'
  | 'landing_mechanism_replay'
  | 'landing_logged_out_login_tap'

export type LandingCtaType = 'new' | 'continue' | 'discover' | 'loggedOut'

export interface TrackCtaTapProps {
  ctaType: LandingCtaType
  userNextStep: string | null
  hasIncompleteSession: boolean
  blockedByLegal: boolean
  dwellMs: number
  heroReady: boolean
  /** Landing redesign A/B (2026-09-03): 'a' = backdrop only, 'b' = backdrop
   *  + bubble constellation. Server metadata is free-form (sanitized, not
   *  allow-listed) — no allow-list change needed for this key. */
  landingVariant: string
}

export type LandingHeroAssetResult = 'success' | 'error' | 'fallback' | 'timeout'
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
  /** Landing redesign A/B variant (see TrackCtaTapProps.landingVariant). */
  landingVariant: string
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
      landing_variant: props.landingVariant,
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
      landing_variant: props.landingVariant,
    })
  }

  trackMechanismReplay(props: { dwellMs: number }): void {
    this.track('landing_mechanism_replay', {
      dwell_ms: props.dwellMs,
    })
  }

  trackLoggedOutLoginTap(props: { authEntry: 'logout' | 'expired'; dwellMs: number }): void {
    this.track('landing_logged_out_login_tap', {
      auth_entry: props.authEntry,
      dwell_ms: props.dwellMs,
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
