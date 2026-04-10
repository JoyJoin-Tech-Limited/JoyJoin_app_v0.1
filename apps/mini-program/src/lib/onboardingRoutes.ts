import type { OnboardingStep } from './api'

export const MINI_PROGRAM_PAGE_PATHS = {
  discover: 'pages/discover/index',
  onboarding: 'pages/onboarding/onboarding/index',
  personalityTest: 'pages/onboarding/personality-test/index',
  essentialData: 'pages/onboarding/essential-data/index',
  extendedData: 'pages/onboarding/extended-data/index',
  profileReview: 'pages/onboarding/profile-review/index',
  blindBoxPayment: 'pages/blind-box-payment/index',
  paymentVerification: 'pages/payment-verification/index',
  events: 'pages/events/index',
  connections: 'pages/connections/index',
  profile: 'pages/profile/index',
  login: 'pages/login/index',
} as const

export const MINI_PROGRAM_ROUTES = {
  discover: `/${MINI_PROGRAM_PAGE_PATHS.discover}`,
  onboarding: `/${MINI_PROGRAM_PAGE_PATHS.onboarding}`,
  personalityTest: `/${MINI_PROGRAM_PAGE_PATHS.personalityTest}`,
  essentialData: `/${MINI_PROGRAM_PAGE_PATHS.essentialData}`,
  extendedData: `/${MINI_PROGRAM_PAGE_PATHS.extendedData}`,
  profileReview: `/${MINI_PROGRAM_PAGE_PATHS.profileReview}`,
  blindBoxPayment: `/${MINI_PROGRAM_PAGE_PATHS.blindBoxPayment}`,
  paymentVerification: `/${MINI_PROGRAM_PAGE_PATHS.paymentVerification}`,
  events: `/${MINI_PROGRAM_PAGE_PATHS.events}`,
  connections: `/${MINI_PROGRAM_PAGE_PATHS.connections}`,
  profile: `/${MINI_PROGRAM_PAGE_PATHS.profile}`,
  login: `/${MINI_PROGRAM_PAGE_PATHS.login}`,
} as const

export const MINI_PROGRAM_PAGES = [
  MINI_PROGRAM_PAGE_PATHS.discover,
  MINI_PROGRAM_PAGE_PATHS.onboarding,
  MINI_PROGRAM_PAGE_PATHS.personalityTest,
  MINI_PROGRAM_PAGE_PATHS.essentialData,
  MINI_PROGRAM_PAGE_PATHS.extendedData,
  MINI_PROGRAM_PAGE_PATHS.profileReview,
  MINI_PROGRAM_PAGE_PATHS.blindBoxPayment,
  MINI_PROGRAM_PAGE_PATHS.paymentVerification,
  MINI_PROGRAM_PAGE_PATHS.events,
  MINI_PROGRAM_PAGE_PATHS.connections,
  MINI_PROGRAM_PAGE_PATHS.profile,
  MINI_PROGRAM_PAGE_PATHS.login,
] as const

export function nextStepToMiniProgramRoute(step: OnboardingStep | undefined): string {
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
