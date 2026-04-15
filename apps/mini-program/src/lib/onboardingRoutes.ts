import type { OnboardingStep } from './api'

export const MINI_PROGRAM_PAGE_PATHS = {
  discover: 'pages/discover/index',
  onboarding: 'pages/onboarding/onboarding/index',
  personalityTest: 'pages/onboarding/personality-test/index',
  personalityTestResults: 'pages/onboarding/personality-test/results/index',
  personalityTestAuthGate: 'pages/onboarding/personality-test/auth-gate/index',
  essentialData: 'pages/onboarding/essential-data/index',
  extendedData: 'pages/onboarding/extended-data/index',
  profileReview: 'pages/onboarding/profile-review/index',
  blindBoxPayment: 'pages/blind-box-payment/index',
  paymentVerification: 'pages/payment-verification/index',
  events: 'pages/events/index',
  connections: 'pages/connections/index',
  profile: 'pages/profile/index',
  login: 'pages/login/index',
  index: 'pages/index/index',
  terms: 'pages/terms/index',
  eventDetail: 'pages/event-detail/index',
  eventFeedback: 'pages/event-feedback/index',
  poolRegistration: 'pages/pool-registration/index',
  myEvents: 'pages/my-events/index',
  journey: 'pages/journey/index',
  eventCoordination: 'pages/event-coordination/index',
  matchingStatus: 'pages/matching-status/index',
  squadUnboxing: 'pages/squad-unboxing/index',
  poolGroupDetail: 'pages/pool-group-detail/index',
  centerTabEmpty: 'pages/center-tab-empty/index',
  icebreakerSession: 'pages/icebreaker-session/index',
  editProfile: 'pages/edit-profile/index',
  rewards: 'pages/rewards/index',
  invite: 'pages/invite/index',
} as const

export const MINI_PROGRAM_ROUTES = {
  discover: `/${MINI_PROGRAM_PAGE_PATHS.discover}`,
  onboarding: `/${MINI_PROGRAM_PAGE_PATHS.onboarding}`,
  personalityTest: `/${MINI_PROGRAM_PAGE_PATHS.personalityTest}`,
  personalityTestResults: `/${MINI_PROGRAM_PAGE_PATHS.personalityTestResults}`,
  personalityTestAuthGate: `/${MINI_PROGRAM_PAGE_PATHS.personalityTestAuthGate}`,
  essentialData: `/${MINI_PROGRAM_PAGE_PATHS.essentialData}`,
  extendedData: `/${MINI_PROGRAM_PAGE_PATHS.extendedData}`,
  profileReview: `/${MINI_PROGRAM_PAGE_PATHS.profileReview}`,
  blindBoxPayment: `/${MINI_PROGRAM_PAGE_PATHS.blindBoxPayment}`,
  paymentVerification: `/${MINI_PROGRAM_PAGE_PATHS.paymentVerification}`,
  events: `/${MINI_PROGRAM_PAGE_PATHS.events}`,
  connections: `/${MINI_PROGRAM_PAGE_PATHS.connections}`,
  profile: `/${MINI_PROGRAM_PAGE_PATHS.profile}`,
  login: `/${MINI_PROGRAM_PAGE_PATHS.login}`,
  eventCoordination: `/${MINI_PROGRAM_PAGE_PATHS.eventCoordination}`,
  matchingStatus: `/${MINI_PROGRAM_PAGE_PATHS.matchingStatus}`,
  squadUnboxing: `/${MINI_PROGRAM_PAGE_PATHS.squadUnboxing}`,
  poolGroupDetail: `/${MINI_PROGRAM_PAGE_PATHS.poolGroupDetail}`,
  centerTabEmpty: `/${MINI_PROGRAM_PAGE_PATHS.centerTabEmpty}`,
  icebreakerSession: `/${MINI_PROGRAM_PAGE_PATHS.icebreakerSession}`,
  editProfile: `/${MINI_PROGRAM_PAGE_PATHS.editProfile}`,
  rewards: `/${MINI_PROGRAM_PAGE_PATHS.rewards}`,
  invite: `/${MINI_PROGRAM_PAGE_PATHS.invite}`,
} as const

export const MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT = 'pages/onboarding' as const

export const MINI_PROGRAM_ONBOARDING_SUBPACKAGE_PAGES = [
  'onboarding/index',
  'personality-test/index',
  'personality-test/results/index',
  'personality-test/auth-gate/index',
  'essential-data/index',
  'extended-data/index',
  'profile-review/index',
] as const

export const MINI_PROGRAM_ONBOARDING_PACKAGE_PAGE_PATHS = [
  MINI_PROGRAM_PAGE_PATHS.onboarding,
  MINI_PROGRAM_PAGE_PATHS.personalityTest,
  MINI_PROGRAM_PAGE_PATHS.personalityTestResults,
  MINI_PROGRAM_PAGE_PATHS.personalityTestAuthGate,
  MINI_PROGRAM_PAGE_PATHS.essentialData,
  MINI_PROGRAM_PAGE_PATHS.extendedData,
  MINI_PROGRAM_PAGE_PATHS.profileReview,
] as const

export const MINI_PROGRAM_MAIN_PACKAGE_PAGES = [
  MINI_PROGRAM_PAGE_PATHS.index,
  MINI_PROGRAM_PAGE_PATHS.discover,
  MINI_PROGRAM_PAGE_PATHS.blindBoxPayment,
  MINI_PROGRAM_PAGE_PATHS.paymentVerification,
  MINI_PROGRAM_PAGE_PATHS.events,
  MINI_PROGRAM_PAGE_PATHS.connections,
  MINI_PROGRAM_PAGE_PATHS.profile,
  MINI_PROGRAM_PAGE_PATHS.login,
  MINI_PROGRAM_PAGE_PATHS.terms,
  MINI_PROGRAM_PAGE_PATHS.eventDetail,
  MINI_PROGRAM_PAGE_PATHS.eventFeedback,
  MINI_PROGRAM_PAGE_PATHS.poolRegistration,
  MINI_PROGRAM_PAGE_PATHS.myEvents,
  MINI_PROGRAM_PAGE_PATHS.journey,
  MINI_PROGRAM_PAGE_PATHS.eventCoordination,
  MINI_PROGRAM_PAGE_PATHS.matchingStatus,
  MINI_PROGRAM_PAGE_PATHS.squadUnboxing,
  MINI_PROGRAM_PAGE_PATHS.poolGroupDetail,
  MINI_PROGRAM_PAGE_PATHS.centerTabEmpty,
  MINI_PROGRAM_PAGE_PATHS.icebreakerSession,
  MINI_PROGRAM_PAGE_PATHS.editProfile,
  MINI_PROGRAM_PAGE_PATHS.rewards,
  MINI_PROGRAM_PAGE_PATHS.invite,
] as const

export const MINI_PROGRAM_PAGES = [
  ...MINI_PROGRAM_MAIN_PACKAGE_PAGES,
  ...MINI_PROGRAM_ONBOARDING_PACKAGE_PAGE_PATHS,
] as const

export const MINI_PROGRAM_SUBPACKAGES = [
  {
    root: MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT,
    pages: MINI_PROGRAM_ONBOARDING_SUBPACKAGE_PAGES,
  },
] as const

export const MINI_PROGRAM_PRELOAD_RULES = {
  [MINI_PROGRAM_PAGE_PATHS.index]: {
    network: 'all',
    packages: [MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT],
  },
  [MINI_PROGRAM_PAGE_PATHS.login]: {
    network: 'all',
    packages: [MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT],
  },
} as const

export function nextStepToMiniProgramRoute(step: OnboardingStep | string | undefined): string {
  switch (step) {
    case 'onboarding':
      return MINI_PROGRAM_ROUTES.onboarding
    case 'personality-test':
      return MINI_PROGRAM_ROUTES.personalityTest
    case 'essential-data':
      return MINI_PROGRAM_ROUTES.essentialData
    case 'extended-data':
      return MINI_PROGRAM_ROUTES.extendedData
    case 'profile-review':
      return MINI_PROGRAM_ROUTES.profileReview
    case 'discover':
    case 'guide':
    default:
      return MINI_PROGRAM_ROUTES.discover
  }
}
