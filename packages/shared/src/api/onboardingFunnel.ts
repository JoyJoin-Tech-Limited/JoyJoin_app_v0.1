/**
 * Admin onboarding funnel DTO contract (V4 onboarding analytics).
 *
 * Returned by `GET /api/admin/analytics/onboarding-funnel` and consumed by the
 * admin portal onboarding funnel card. All counts are aggregate-only — the
 * endpoint never exposes user-level rows, so no audit logging is required.
 */

/** Per-step event aggregates for the reporting window. */
export interface OnboardingFunnelStepStats {
  /** Step identifier reported by the client (`stepId`, legacy `step`). */
  step: string
  /** Lowest reported `stepIndex` for this step, when the client provides one. */
  stepIndex: number | null
  /** `step_enter` events (legacy `step_started` counted as entered). */
  entered: number
  /** `step_completed` events. */
  completed: number
  /** `step_abandoned` events. */
  abandoned: number
  /** Distinct session ids that entered this step. */
  uniqueSessions: number
  /** completed / entered (0 when entered = 0). */
  completionRate: number
  /** abandoned / entered (0 when entered = 0). */
  abandonmentRate: number
}

/** Anonymous → logged-in session stitching stats for the reporting window. */
export interface OnboardingFunnelStitchStats {
  /** Distinct session ids seen on events with no userId. */
  anonymousSessions: number
  /** Anonymous session ids that later appear on an event with a userId. */
  stitchedSessions: number
  /** stitchedSessions / anonymousSessions (0 when anonymousSessions = 0). */
  stitchRate: number
}

/** Experiment bucket breakdown derived from the `experiment` payload field. */
export interface OnboardingFunnelExperimentBucket {
  flagKey: string
  bucket: string
  /** Distinct sessions that entered any step under this bucket. */
  enteredSessions: number
  /** Distinct sessions that completed any step under this bucket. */
  completedSessions: number
}

export interface AdminOnboardingFunnelResponse {
  /** Reporting window in days (echoes the `days` query param). */
  days: number
  /** ISO timestamp of the window start. */
  since: string
  steps: OnboardingFunnelStepStats[]
  stitch: OnboardingFunnelStitchStats
  experiments: OnboardingFunnelExperimentBucket[]
}
