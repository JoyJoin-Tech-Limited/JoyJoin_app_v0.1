import type { OnboardingStep } from '../api/api'

export const ONBOARDING_MASCOT_SIZE = '200rpx'

export const MINI_PROGRAM_PAGE_PATHS = {
  discover: 'pages/discover/index',
  centerHub: 'pages/center-hub/index',
  onboarding: 'pages/onboarding/onboarding/index',
  personalityTest: 'pages/onboarding/personality-test/index',
  personalityTestResults: 'pages/onboarding/personality-test/results/index',

  essentialData: 'pages/onboarding/essential-data/index',
  extendedData: 'pages/onboarding/extended-data/index',
  profileReview: 'pages/onboarding/profile-review/index',
  welcomeBack: 'pages/onboarding/welcome-back/index',
  blindBoxPayment: 'pages/blind-box-payment/index',
  eventTicketPayment: 'pages/event-ticket-payment/index',
  paymentVerification: 'pages/payment-verification/index',
  events: 'pages/events/index',
  connections: 'pages/connections/index',
  profile: 'pages/profile/index',
  login: 'pages/login/index',
  index: 'pages/index/index',
  terms: 'pages/profile-linked/terms/index',
  eventDetail: 'pages/event-detail/index',
  eventFeedback: 'pages/event-feedback/index',
  poolRegistration: 'pages/pool-registration/index',
  eventCoordination: 'pages/event-coordination/index',
  matchingStatus: 'pages/matching-status/index',
  squadUnboxing: 'pages/squad-unboxing/index',
  poolGroupDetail: 'pages/pool-group-detail/index',
  centerTabEmpty: 'pages/center-tab-empty/index',
  icebreakerSession: 'pages/icebreaker-session/index',
  tierSelector: 'pages/icebreaker-session/tier-selector/index',
  editProfile: 'pages/profile-linked/edit-profile/index',
  profileSettings: 'pages/profile-linked/settings/index',
  rewards: 'pages/profile-linked/rewards/index',
  invite: 'pages/profile-linked/invite/index',
  myImage: 'pages/profile-linked/my-image/index',
  myImageQa3d: 'pages/profile-linked/my-image/qa3d/index',
  personalStory: 'pages/profile-linked/personal-story/index',
  cityUnlock: 'pages/city-unlock/index',
  alangEvent: 'pages/alang/event/index',
  alangEventDetail: 'pages/alang/event-detail/index',
  alangConfig: 'pages/alang/config/index',
  alangSearch: 'pages/alang/search/index',
  alangDialogue: 'pages/alang/dialogue/index',
  alangCompanion: 'pages/alang/companion/index',
  alangResult: 'pages/alang/result/index',
  alangStoryDetail: 'pages/alang/story-detail/index',
  alangDebug: 'pages/alang/debug/index',
} as const

export const MINI_PROGRAM_ROUTES = {
  discover: `/${MINI_PROGRAM_PAGE_PATHS.discover}`,
  centerHub: `/${MINI_PROGRAM_PAGE_PATHS.centerHub}`,
  onboarding: `/${MINI_PROGRAM_PAGE_PATHS.onboarding}`,
  personalityTest: `/${MINI_PROGRAM_PAGE_PATHS.personalityTest}`,
  personalityTestResults: `/${MINI_PROGRAM_PAGE_PATHS.personalityTestResults}`,

  essentialData: `/${MINI_PROGRAM_PAGE_PATHS.essentialData}`,
  extendedData: `/${MINI_PROGRAM_PAGE_PATHS.extendedData}`,
  profileReview: `/${MINI_PROGRAM_PAGE_PATHS.profileReview}`,
  welcomeBack: `/${MINI_PROGRAM_PAGE_PATHS.welcomeBack}`,
  blindBoxPayment: `/${MINI_PROGRAM_PAGE_PATHS.blindBoxPayment}`,
  eventTicketPayment: `/${MINI_PROGRAM_PAGE_PATHS.eventTicketPayment}`,
  paymentVerification: `/${MINI_PROGRAM_PAGE_PATHS.paymentVerification}`,
  events: `/${MINI_PROGRAM_PAGE_PATHS.events}`,
  connections: `/${MINI_PROGRAM_PAGE_PATHS.connections}`,
  profile: `/${MINI_PROGRAM_PAGE_PATHS.profile}`,
  login: `/${MINI_PROGRAM_PAGE_PATHS.login}`,
  eventDetail: `/${MINI_PROGRAM_PAGE_PATHS.eventDetail}`,
  eventCoordination: `/${MINI_PROGRAM_PAGE_PATHS.eventCoordination}`,
  matchingStatus: `/${MINI_PROGRAM_PAGE_PATHS.matchingStatus}`,
  squadUnboxing: `/${MINI_PROGRAM_PAGE_PATHS.squadUnboxing}`,
  poolGroupDetail: `/${MINI_PROGRAM_PAGE_PATHS.poolGroupDetail}`,
  centerTabEmpty: `/${MINI_PROGRAM_PAGE_PATHS.centerTabEmpty}`,
  icebreakerSession: `/${MINI_PROGRAM_PAGE_PATHS.icebreakerSession}`,
  tierSelector: `/${MINI_PROGRAM_PAGE_PATHS.tierSelector}`,
  editProfile: `/${MINI_PROGRAM_PAGE_PATHS.editProfile}`,
  profileSettings: `/${MINI_PROGRAM_PAGE_PATHS.profileSettings}`,
  rewards: `/${MINI_PROGRAM_PAGE_PATHS.rewards}`,
  invite: `/${MINI_PROGRAM_PAGE_PATHS.invite}`,
  myImage: `/${MINI_PROGRAM_PAGE_PATHS.myImage}`,
  myImageQa3d: `/${MINI_PROGRAM_PAGE_PATHS.myImageQa3d}`,
  personalStory: `/${MINI_PROGRAM_PAGE_PATHS.personalStory}`,
  terms: `/${MINI_PROGRAM_PAGE_PATHS.terms}`,
  cityUnlock: `/${MINI_PROGRAM_PAGE_PATHS.cityUnlock}`,
  alangEvent: `/${MINI_PROGRAM_PAGE_PATHS.alangEvent}`,
  alangEventDetail: `/${MINI_PROGRAM_PAGE_PATHS.alangEventDetail}`,
  alangConfig: `/${MINI_PROGRAM_PAGE_PATHS.alangConfig}`,
  alangSearch: `/${MINI_PROGRAM_PAGE_PATHS.alangSearch}`,
  alangDialogue: `/${MINI_PROGRAM_PAGE_PATHS.alangDialogue}`,
  alangCompanion: `/${MINI_PROGRAM_PAGE_PATHS.alangCompanion}`,
  alangResult: `/${MINI_PROGRAM_PAGE_PATHS.alangResult}`,
  alangStoryDetail: `/${MINI_PROGRAM_PAGE_PATHS.alangStoryDetail}`,
  alangDebug: `/${MINI_PROGRAM_PAGE_PATHS.alangDebug}`,
  index: `/${MINI_PROGRAM_PAGE_PATHS.index}`,
} as const

export const MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT = 'pages/onboarding' as const

export const MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_ROOT = 'pages/profile-linked' as const

export const MINI_PROGRAM_ONBOARDING_SUBPACKAGE_PAGES = [
  'onboarding/index',
  'personality-test/index',
  'personality-test/results/index',

  'essential-data/index',
  'extended-data/index',
  'profile-review/index',
  'welcome-back/index',
] as const

export const MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_PAGES = [
  'edit-profile/index',
  'settings/index',
  'rewards/index',
  'invite/index',
  'my-image/index',
  'my-image/qa3d/index',
  'personal-story/index',
  'terms/index',
] as const

export const MINI_PROGRAM_ONBOARDING_PACKAGE_PAGE_PATHS = [
  MINI_PROGRAM_PAGE_PATHS.onboarding,
  MINI_PROGRAM_PAGE_PATHS.personalityTest,
  MINI_PROGRAM_PAGE_PATHS.personalityTestResults,

  MINI_PROGRAM_PAGE_PATHS.essentialData,
  MINI_PROGRAM_PAGE_PATHS.extendedData,
  MINI_PROGRAM_PAGE_PATHS.profileReview,
  MINI_PROGRAM_PAGE_PATHS.welcomeBack,
] as const

export const MINI_PROGRAM_MAIN_PACKAGE_PAGES = [
  MINI_PROGRAM_PAGE_PATHS.index,
  MINI_PROGRAM_PAGE_PATHS.discover,
  MINI_PROGRAM_PAGE_PATHS.centerHub,
  MINI_PROGRAM_PAGE_PATHS.paymentVerification,
  MINI_PROGRAM_PAGE_PATHS.blindBoxPayment,
  MINI_PROGRAM_PAGE_PATHS.eventTicketPayment,
  MINI_PROGRAM_PAGE_PATHS.events,
  MINI_PROGRAM_PAGE_PATHS.connections,
  MINI_PROGRAM_PAGE_PATHS.profile,
  MINI_PROGRAM_PAGE_PATHS.login,
  MINI_PROGRAM_PAGE_PATHS.eventDetail,
  MINI_PROGRAM_PAGE_PATHS.eventFeedback,
  MINI_PROGRAM_PAGE_PATHS.eventCoordination,
  MINI_PROGRAM_PAGE_PATHS.poolGroupDetail,
  MINI_PROGRAM_PAGE_PATHS.centerTabEmpty,
  MINI_PROGRAM_PAGE_PATHS.cityUnlock,
] as const

export const MINI_PROGRAM_PROFILE_LINKED_PACKAGE_PAGE_PATHS = [
  MINI_PROGRAM_PAGE_PATHS.editProfile,
  MINI_PROGRAM_PAGE_PATHS.profileSettings,
  MINI_PROGRAM_PAGE_PATHS.rewards,
  MINI_PROGRAM_PAGE_PATHS.invite,
  MINI_PROGRAM_PAGE_PATHS.myImage,
  MINI_PROGRAM_PAGE_PATHS.myImageQa3d,
  MINI_PROGRAM_PAGE_PATHS.personalStory,
  MINI_PROGRAM_PAGE_PATHS.terms,
] as const

export const MINI_PROGRAM_PAGES = [
  ...MINI_PROGRAM_MAIN_PACKAGE_PAGES,
  ...MINI_PROGRAM_ONBOARDING_PACKAGE_PAGE_PATHS,
  ...MINI_PROGRAM_PROFILE_LINKED_PACKAGE_PAGE_PATHS,
  MINI_PROGRAM_PAGE_PATHS.icebreakerSession,
  MINI_PROGRAM_PAGE_PATHS.tierSelector,
  MINI_PROGRAM_PAGE_PATHS.matchingStatus,
  MINI_PROGRAM_PAGE_PATHS.poolRegistration,
  MINI_PROGRAM_PAGE_PATHS.squadUnboxing,
] as const

export const MINI_PROGRAM_FEATURES_SUBPACKAGE_ROOT = 'pages/icebreaker-session' as const

export const MINI_PROGRAM_MATCHING_SUBPACKAGE_ROOT = 'pages/matching-status' as const

export const MINI_PROGRAM_ALANG_SUBPACKAGE_ROOT = 'pages/alang' as const

export const MINI_PROGRAM_ALANG_SUBPACKAGE_PAGES = [
  'event/index',
  'event-detail/index',
  'config/index',
  'search/index',
  'dialogue/index',
  'companion/index',
  'result/index',
  'story-detail/index',
  'debug/index',
] as const

export const MINI_PROGRAM_MATCHING_SUBPACKAGE_PAGES = [
  'index',
] as const

export const MINI_PROGRAM_FEATURES_SUBPACKAGE_PAGES = [
  'index',
  'tier-selector/index',
] as const

export const MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT = 'pages/pool-registration' as const

export const MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_PAGES = [
  'index',
] as const

export const MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT = 'pages/squad-unboxing' as const

export const MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_PAGES = [
  'index',
] as const

export const MINI_PROGRAM_SUBPACKAGES = [
  {
    root: MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT,
    pages: MINI_PROGRAM_ONBOARDING_SUBPACKAGE_PAGES,
  },
  {
    root: MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_ROOT,
    pages: MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_PAGES,
  },
  {
    root: MINI_PROGRAM_FEATURES_SUBPACKAGE_ROOT,
    pages: MINI_PROGRAM_FEATURES_SUBPACKAGE_PAGES,
  },
  {
    root: MINI_PROGRAM_MATCHING_SUBPACKAGE_ROOT,
    pages: MINI_PROGRAM_MATCHING_SUBPACKAGE_PAGES,
  },
  {
    root: MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT,
    pages: MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_PAGES,
  },
  {
    root: MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT,
    pages: MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_PAGES,
  },
  {
    root: MINI_PROGRAM_ALANG_SUBPACKAGE_ROOT,
    pages: MINI_PROGRAM_ALANG_SUBPACKAGE_PAGES,
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
  [MINI_PROGRAM_PAGE_PATHS.squadUnboxing]: {
    network: 'all',
    packages: [MINI_PROGRAM_FEATURES_SUBPACKAGE_ROOT],
  },
  [MINI_PROGRAM_PAGE_PATHS.eventDetail]: {
    network: 'all',
    packages: [MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT, MINI_PROGRAM_FEATURES_SUBPACKAGE_ROOT],
  },
  [MINI_PROGRAM_PAGE_PATHS.events]: {
    network: 'all',
    packages: [
      MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT,
      MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT,
    ],
  },
  [MINI_PROGRAM_PAGE_PATHS.centerHub]: {
    network: 'all',
    packages: [MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT],
  },
  [MINI_PROGRAM_PAGE_PATHS.matchingStatus]: {
    network: 'all',
    packages: [MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT],
  },
  [MINI_PROGRAM_PAGE_PATHS.discover]: {
    network: 'all',
    packages: [MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT, MINI_PROGRAM_ALANG_SUBPACKAGE_ROOT],
  },
  [MINI_PROGRAM_PAGE_PATHS.profile]: {
    network: 'all',
    packages: [MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_ROOT],
  },
} as const

export function nextStepToMiniProgramRoute(step: OnboardingStep | string | undefined): string {
  switch (step) {
    // 'onboarding' is a redirect hub (pages/onboarding/onboarding/index) whose
    // sole purpose is to map 'onboarding' → 'personality-test'. Route directly
    // to the first real step to prevent an infinite bounce loop: any page that
    // sees nextStep='onboarding' would redirect to the entry page, which would
    // redirect back to that same page.
    case 'onboarding':
      return MINI_PROGRAM_ROUTES.personalityTest
    case 'personality-test':
      return MINI_PROGRAM_ROUTES.personalityTest
    case 'essential-data':
      return MINI_PROGRAM_ROUTES.essentialData
    case 'extended-data':
      return MINI_PROGRAM_ROUTES.extendedData
    case 'profile-review':
      return MINI_PROGRAM_ROUTES.profileReview
    case 'discover':
    default:
      return MINI_PROGRAM_ROUTES.discover
  }
}
