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
  /**
   * Median dwell (ms) on this step, over step_completed / step_abandoned rows
   * with a positive step_duration. Null when no duration samples exist.
   */
  p50StepDurationMs: number | null
  /** 90th-percentile dwell (ms); same sample set as p50StepDurationMs. */
  p90StepDurationMs: number | null
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

/** Ceremony advance-mode distribution (`ceremony_advance` interaction rows). */
export interface OnboardingCeremonyAdvanceStats {
  /** Advances where the auto timer elapsed (metadata mode = 'auto'). */
  auto: number
  /** Advances where the user tapped through (metadata mode = 'tap'). */
  tap: number
  /** auto / (auto + tap), 0 when there are no ceremony_advance rows. */
  autoRatio: number
}

/** Slot-animation skip rate (`slot_animation_start` vs `skip_animation`). */
export interface OnboardingSlotSkipStats {
  /** `slot_animation_start` interaction rows. */
  starts: number
  /** `skip_animation` interaction rows. */
  skips: number
  /** skips / starts, 0 when starts = 0. */
  skipRate: number
}

/** Median dwell per results-page stage (`result_stage_dwell` rows). */
export interface OnboardingResultStageDwellStats {
  /** Stage identifier from metadata (loading/slot/reveal/bridge/result). */
  stage: string
  /** Median dwellMs; null when no parseable samples exist for the stage. */
  medianDwellMs: number | null
  /** Number of dwell samples behind the median. */
  samples: number
}

/** Commentary read-completion ratio (`commentary_read_complete` vs `commentary_cut_short`). */
export interface OnboardingCommentaryReadStats {
  readComplete: number
  cutShort: number
  /** readComplete / (readComplete + cutShort), 0 when there are no rows. */
  readCompleteRatio: number
}

/**
 * Emotion/pacing metrics (PR-2) — all derived from `interaction` rows in
 * onboarding_analytics (metadata->>'action' = the interaction name). Aggregate
 * counts only, same reporting window as the funnel steps.
 */
export interface OnboardingEmotionMetrics {
  ceremonyAdvance: OnboardingCeremonyAdvanceStats
  slotSkip: OnboardingSlotSkipStats
  resultStageDwell: OnboardingResultStageDwellStats[]
  commentaryRead: OnboardingCommentaryReadStats
}

export interface AdminOnboardingFunnelResponse {
  /** Reporting window in days (echoes the `days` query param). */
  days: number
  /** ISO timestamp of the window start (explicit `from` when provided). */
  since: string
  /** ISO timestamp of the exclusive window end, when `to` was provided. */
  until: string | null
  steps: OnboardingFunnelStepStats[]
  stitch: OnboardingFunnelStitchStats
  experiments: OnboardingFunnelExperimentBucket[]
  emotion: OnboardingEmotionMetrics
}
