/**
 * Centralized admin types for JoyJoin admin portal.
 *
 * Import convention:
 *   import type { AdminUser, AdminEventPool, CityFilter } from "./types";
 *
 * Design rules:
 *   - Admin view models go here (shapes returned by /api/admin/*)
 *   - Shared schema types are imported from @shared/schema, not redefined
 *   - Page-specific types (e.g., ShadowRecommendation) stay local to their page
 *   - Filter unions and status maps that repeat across pages go here
 */

import type { BadgeProps } from "@/components/ui/badge";

// ═══════════════════════════════════════════════════════════
//  Re-export venue types (canonical source is venueConstants.ts)
// ═══════════════════════════════════════════════════════════
export type {
  Venue,
  VenueTimeSlot,
  AllTimeSlot,
  ActiveBooking,
  VenueAlternative,
  VenueDeal,
  VenueFormData,
} from "./venueConstants";

// ═══════════════════════════════════════════════════════════
//  Core entity view models
// ═══════════════════════════════════════════════════════════

/** User as returned by admin APIs (with flattened/computed fields) */
export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  email: string;
  phoneNumber: string;
  gender?: string;
  birthdate?: string;
  primaryArchetype?: string;
  archetype?: string;
  currentCity?: string;
  educationLevel?: string;
  industryCategory?: string;
  industryCategoryLabel?: string;
  industryNicheLabel?: string;
  hometownRegionCity?: string;
  interestsTop?: string[];
  intent?: string[];
  isAdmin: boolean;
  isBanned: boolean;
  hasCompletedRegistration: boolean;
  hasCompletedPersonalityTest?: boolean;
  hasCompletedInterestsCarousel?: boolean;
  hasSeenProfileReview?: boolean;
  onboardingCheckpoint?: string | null;
  onboardingCheckpointTimestamp?: string | null;
  createdAt: string;
  profileCompleteness?: ProfileCompleteness;
}

/** Lightweight user reference (for dropdowns / selections) */
export interface AdminUserRef {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber?: string | null;
  archetype?: string | null;
}

/** Event pool as returned by admin APIs (with computed counts) */
export interface AdminEventPool {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  city: string;
  district: string | null;
  dateTime: string;
  registrationDeadline: string;
  status: string;
  totalRegistrations: number;
  successfulMatches: number;
  minGroupSize: number;
  maxGroupSize: number;
  targetGroups: number;
  createdAt: string;
  registrationCount?: number;
  matchedCount?: number;
  pendingCount?: number;
}

/** Pool registration with flattened user info (EventPoolsPage detail view) */
export interface AdminPoolRegistration {
  id: string;
  poolId: string;
  userId: string;
  budgetRange: string | null;
  preferredLanguages: string[] | null;
  eventIntent: string[] | null;
  dietaryRestrictions: string[] | null;
  matchStatus: string;
  assignedGroupId: string | null;
  matchScore: number | null;
  registeredAt: string;
  userName: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userGender: string | null;
  userAge: number | null;
  userIndustry: string | null;
  userSeniority: string | null;
  userArchetype: string | null;
}

/** Pool registration as seen from the user detail page (leaner) */
export interface UserPoolRegistration {
  id: string;
  poolId: string;
  assignedGroupId?: string | null;
  matchStatus?: string;
  matchScore?: number | null;
  registeredAt?: string;
  eventIntent?: string[];
  budgetRange?: string[];
}

// ═══════════════════════════════════════════════════════════
//  Group / matching types
// ═══════════════════════════════════════════════════════════

export interface PoolGroupMember {
  registrationId: string;
  userId: string;
  userName: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userGender: string | null;
  userArchetype: string | null;
  userIndustry: string | null;
  matchScore: number | null;
}

export interface PoolGroup {
  id: string;
  poolId: string;
  groupNumber: number;
  status: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  venueId?: string | null;
  venueAssignmentStatus?: string | null;
  venueAssignmentReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  members: PoolGroupMember[];
  avgChemistryScore?: number | null;
  diversityScore?: number | null;
  communicationBalance?: number | null;
  genderBalanceScore?: number | null;
  overallScore?: number | null;
  temperatureLevel?: string | null;
}

export interface PairScoreEntry {
  groupId: string;
  groupNumber: number;
  memberCount: number | null;
  avgChemistryScore: number | null;
  diversityScore: number | null;
  communicationBalance: number | null;
  genderBalanceScore: number | null;
  overallScore: number | null;
  temperatureLevel: string | null;
}

export interface MatchHistoryEntry {
  id: string;
  user1Id: string;
  user2Id: string;
  eventId: string;
  matchedAt?: string | null;
  connectionQuality?: number | null;
  wouldMeetAgain?: boolean | null;
  connectionPointTypes?: string[] | null;
  partnerName?: string | null;
  partnerArchetype?: string | null;
  eventTitle?: string | null;
}

// ═══════════════════════════════════════════════════════════
//  User detail / onboarding sub-types
// ═══════════════════════════════════════════════════════════

export interface ProfileCompleteness {
  score: number;
  starRating: number;
  missingFields: string[];
}

export interface OnboardingState {
  nextStep: string;
  profileEssentialComplete: boolean;
  hasCompletedRegistration: boolean;
  hasCompletedPersonalityTest: boolean;
  hasCompletedInterestsCarousel: boolean;
  hasSeenProfileReview: boolean;
}

export interface AssessmentSession {
  id: string;
  primaryArchetype?: string;
  phase: string;
  traitScores?: Record<string, number>;
  topArchetypes?: Array<{ archetype: string; score: number }>;
  completedAt?: string;
  isDecisive?: boolean;
  matchDetailsJson?: {
    primaryArchetype?: string;
    secondaryArchetype?: string;
    decisiveReason?: string;
    score?: number;
  };
}

export interface UserInterests {
  totalHeat?: number;
  totalSelections?: number;
  categoryHeat?: Record<string, number>;
  selections?: Array<{
    topicId: string;
    emoji?: string;
    label: string;
    category: string;
    heat: number;
    level: number;
  }>;
  topPriorities?: Array<{ topicId: string; label: string; heat: number }>;
}

export interface JoinedEvent {
  id: string;
  title?: string;
  eventType?: string;
  dateTime?: string;
  attendanceStatus?: string;
}

export interface Connection {
  id: string;
  eventId: string;
  userAId: string;
  userBId: string;
  status: string;
  revealedAt?: string | null;
  createdAt?: string;
}

/** Full user detail payload returned by /api/admin/users/:id */
export interface UserDetail {
  user: AdminUser & { profileCompleteness: ProfileCompleteness };
  onboarding: OnboardingState;
  assessmentSession: AssessmentSession | null;
  joinedEvents: JoinedEvent[];
  poolRegistrations: UserPoolRegistration[];
  connections: Connection[];
  matchHistory: MatchHistoryEntry[];
  interests: UserInterests | null;
  matchingReadiness: { isReady: boolean; blockers: string[] };
}

// ═══════════════════════════════════════════════════════════
//  Stats aggregates
// ═══════════════════════════════════════════════════════════

export interface AdminStats {
  totalUsers: number;
  subscribedUsers: number;
  eventsThisMonth: number;
  monthlyRevenue: number;
  newUsersThisWeek: number;
  userGrowth: number;
  personalityDistribution: Record<string, number>;
  archetypeDistribution?: Record<string, number>;
  completenessStats?: {
    star1: number;
    star2: number;
    star3: number;
    star4: number;
    star5: number;
    weakUsers: WeakUser[];
  };
  cityDistribution?: Record<string, number>;
  weeklyMatchingSatisfaction?: number;
  lowScoringMatches?: number;
  gamificationStats?: {
    levelDistribution: Record<string, number>;
    totalXP: number;
    totalJoyCoins: number;
    activeStreakUsers: number;
    avgLevel: number;
  };
  matchingMetrics?: {
    semanticFeatureEnabled: boolean;
    semanticSimilarity: {
      sampleCount: number;
      average: number | null;
      min: number | null;
      max: number | null;
    };
    semanticPairDelta: {
      sampleCount: number;
      average: number | null;
      min: number | null;
      max: number | null;
    };
  };
}

export interface WeakUser {
  id: string;
  displayName: string;
  score: number;
  starRating: number;
  missingFields: string[];
}

export interface ModerationStats {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  bannedUsers: number;
}

export interface FinanceStats {
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  transactionCount: number;
  subscriptionRevenue: number;
  eventRevenue: number;
  venueCommissionTotal: number;
}

// ═══════════════════════════════════════════════════════════
//  Moderation / safety
// ═══════════════════════════════════════════════════════════

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  report_type: ReportType;
  description: string;
  evidence: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  reporter_first_name: string | null;
  reporter_last_name: string | null;
  reporter_email: string | null;
  reported_first_name: string | null;
  reported_last_name: string | null;
  reported_email: string | null;
}

export interface ModerationLog {
  id: string;
  admin_id: string;
  action: ModerationAction;
  target_user_id: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  admin_first_name: string | null;
  admin_last_name: string | null;
  target_first_name: string | null;
  target_last_name: string | null;
  target_email: string | null;
}

// ═══════════════════════════════════════════════════════════
//  Filter / form union types
// ═══════════════════════════════════════════════════════════

export type CityFilter = "all" | "深圳" | "香港";
export type WaitingFilter = "all" | "hasWaiting" | "noWaiting";
export type EventsFilter = "all" | "hasEvents" | "noEvents";
export type SortOption =
  | "newest"
  | "oldest"
  | "title"
  | "mostRegistrations"
  | "mostMatched";

export type EventStatusFilter = "all" | "upcoming" | "ongoing" | "past" | "cancelled";
export type PoolStatusFilter = "all" | "pending_match" | "matched" | "cancelled" | "archived";

export type ReportType = "harassment" | "inappropriate_content" | "spam" | "other";
export type ReportStatus = "pending" | "resolved" | "dismissed";
export type ModerationAction = "ban" | "warn" | "unban";

export type PaymentStatus = "completed" | "pending" | "failed" | "refunded";
export type PaymentType = "subscription" | "event" | "event_bundle";

// ═══════════════════════════════════════════════════════════
//  Status map helpers
// ═══════════════════════════════════════════════════════════

/** Common badge map shape used across admin pages */
export interface StatusBadgeConfig {
  label: string;
  variant: BadgeProps["variant"];
  icon?: React.ComponentType<{ className?: string }>;
}

/** Generic status-to-badge mapping used for tables and cards */
export type StatusMap = Record<string, StatusBadgeConfig>;
