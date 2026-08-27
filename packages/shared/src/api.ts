// Thin barrel for shared API DTOs and transport helpers.
// Domain-specific definitions live in `packages/shared/src/api/*.ts`.

export * from './api/core.js'
export * from './api/auth.js'
export * from './api/aigc.js'
export * from './api/pricing.js'
export * from './api/payments.js'
export * from './api/user.js'
export * from './api/profile.js'
export * from './api/assessment.js'
export * from './api/eventPools.js'
export * from './api/gatheringRoom.js'
export * from './api/matchCompass.js'
export * from './api/geo.js'
export * from './api/occupation.js'
export * from './api/alang.js'
export * from './api/social.js'
export * from './api/guidance.js'

// Re-exports from topical schema modules
export {
  socialIcebreakerSelectPhaseSchema,
  type SocialIcebreakerSelectPhaseRequest,
  socialIcebreakerEndSessionSchema,
  type SocialIcebreakerEndSessionRequest,
  socialIcebreakerAnalyticsEventSchema,
  type SocialIcebreakerAnalyticsEventRequest,
} from './apiSocialIcebreaker.js'

export {
  DiscoverShellPoolItemSchema,
  type DiscoverShellPoolItem,
  DiscoverShellQuerySchema,
  DiscoverShellResponseSchema,
  type DiscoverShellResponse,
  ProfileShellResponseSchema,
  type ProfileShellResponse,
  EventsShellResponseSchema,
  type EventsShellResponse,
  ConnectionsShellContextSchema,
  type ConnectionsShellContext,
  ConnectionsShellResponseSchema,
  type ConnectionsShellResponse,
} from './apiShell.js'

export { type AdminUserDto, type AdminProfileCompleteness, getCanonicalDisplayName } from './api/adminUser.js'
export {
  type OnboardingFunnelStepStats,
  type OnboardingFunnelStitchStats,
  type OnboardingFunnelExperimentBucket,
  type OnboardingCeremonyAdvanceStats,
  type OnboardingSlotSkipStats,
  type OnboardingResultStageDwellStats,
  type OnboardingCommentaryReadStats,
  type OnboardingEmotionMetrics,
  type AdminOnboardingFunnelResponse,
} from './api/onboardingFunnel.js'
export {
  ContentFilterReviewStatuses,
  type ContentFilterReviewStatus,
  contentFilterLogReviewSchema,
  type ContentFilterLogReviewBody,
  type AdminContentFilterLogRow,
  type AdminContentFilterLogsQuery,
  type AdminContentFilterLogReviewResponse,
} from './api/adminContentFilter.js'
