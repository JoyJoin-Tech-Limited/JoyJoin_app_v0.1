/**
 * Shared admin user DTO contract.
 *
 * This module lives in `packages/shared` so the server can return a typed
 * allow-list DTO and the admin-client can derive its `AdminUser` view model
 * from the same source of truth.
 */

export interface AdminProfileCompleteness {
  score: number
  starRating: number
  missingFields: string[]
}

/**
 * Deterministic allow-list DTO for admin user GET endpoints.
 *
 * Deny-list of sensitive/internal columns that must never be added:
 * password, wechatSessionKey, wechatOpenId, wechatId (legacy), dailyTokenUsed,
 * lastTokenResetDate, aiFrozenUntil, interestsTelemetry, vibeVector,
 * inferredTraits, inferenceConfidence, conversationMode, primaryLinguisticStyle,
 * conversationEnergy, negationReliability, insightLedger, personalityTraits,
 * personalityChallenges, idealMatch, energyLevel, placeOfOrigin, longTermBase.
 */
export interface AdminUserDto {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  displayName: string | null
  wechatNickname: string | null
  phoneNumber: string | null
  profileImageUrl: string | null
  birthdate: Date | string | null
  ageVisibility: string | null
  gender: string | null
  pronouns: string | null
  relationshipStatus: string | null
  lifeStage: string | null
  ageMatchPreference: string | null
  educationLevel: string | null
  educationVisibility: string | null
  occupationId: string | null
  standardizedOccupationId: string | null
  workMode: string | null
  workVisibility: string | null
  hometownRegionCity: string | null
  hometownAffinityOptin: boolean | null
  currentCity: string | null
  accessibilityNeeds: string | null
  safetyNoteHost: string | null
  intent: string[] | null
  hasCompletedRegistration: boolean | null
  hasCompletedInterestsTopics: boolean | null
  hasCompletedPersonalityTest: boolean | null
  hasSeenProfileReview: boolean | null
  hasCompletedInterestsCarousel: boolean | null
  onboardingCheckpoint: string | null
  onboardingCheckpointTimestamp: Date | string | null
  interestsDeep: string[] | null
  interestsRankedTop3: string[] | null
  interestFavorite: string | null
  bio: string | null
  preferredLanguages: string[] | null
  dietaryRestrictions: string[] | null
  tableVibePreference: string | null
  defaultPreferenceStrictness: number | null
  defaultPreferredDistricts: string[] | null
  defaultGenderComposition: string | null
  defaultAcceptPairs: boolean | null
  defaultKolComfort: string | null
  socialStyle: string | null
  icebreakerRole: string | null
  venueStylePreference: string | null
  cuisinePreference: string[] | null
  favoriteRestaurant: string | null
  favoriteRestaurantReason: string | null
  archetype: string | null
  primaryArchetype: string | null
  secondaryArchetype: string | null
  roleSubtype: string | null
  debateComfort: number | null
  needsPersonalityRetake: boolean | null
  eventsAttended: number | null
  matchesMade: number | null
  experiencePoints: number | null
  joyCoins: number | null
  currentLevel: number | null
  activityStreak: number | null
  lastActivityDate: Date | string | null
  streakFreezeAvailable: boolean | null
  eventCredits: number | null
  eventCreditsExpiry: Date | string | null
  isAdmin: boolean | null
  isBanned: boolean | null
  isTestBot: boolean | null
  violationCount: number | null
  lastViolationReason: string | null
  viewedEventAnimations: string[] | null
  registrationMethod: string | null
  registrationCompletedAt: Date | string | null
  onboardingRestartCount: number | null
  industryCategory: string | null
  industryCategoryLabel: string | null
  industrySegmentNew: string | null
  industrySegmentLabel: string | null
  industryNiche: string | null
  industryNicheLabel: string | null
  industryRawInput: string | null
  industryNormalized: string | null
  industrySource: string | null
  industryConfidence: string | number | null
  industryClassifiedAt: Date | string | null
  industryLastVerifiedAt: Date | string | null
  socialTag: string | null
  socialTagSelectedAt: Date | string | null
  wechatContactId: string | null
  wechatContactIdSetAt: Date | string | null
  createdAt: Date | string | null
  updatedAt: Date | string | null
  /** @deprecated Only preserved for the existing list-page interest filter; do not use for new features. */
  interestsTop?: string[] | undefined
  profileCompleteness: AdminProfileCompleteness
}

/**
 * Canonical display name for admin surfaces.
 * Falls back through displayName, WeChat nickname, full name, phone, then a placeholder.
 */
export function getCanonicalDisplayName(u: {
  displayName?: string | null
  wechatNickname?: string | null
  firstName?: string | null
  lastName?: string | null
  phoneNumber?: string | null
}): string {
  return (
    u.displayName ||
    u.wechatNickname ||
    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
    u.phoneNumber ||
    "未命名"
  )
}
