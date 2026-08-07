import type { Express, Request } from "express";
import { z } from "zod";
import { type AdminUserDto, type AdminProfileCompleteness, getCanonicalDisplayName } from "@shared/api/adminUser";
import { db } from "../../db";
import { eq, and, or, desc, gt, sql } from "drizzle-orm";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { storage } from "../../storage";
import { getMatchingMetricsSnapshot } from "../../matchingMetrics";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { notifyAdminAction } from "../../lib/wecomNotifications";
import { cascadeDeleteByIds } from "../../lib/fkCascadeDelete";
import { assessmentSessions, eventPoolRegistrations, eventPoolGroups, connections, matchHistory, userInterests, poolMatchingLogs, users, events, payments, subscriptions } from "@shared/schema";

type AdminUserInterestSummary = {
  userId: string;
  totalSelections: number | null;
  selections: any[] | null;
  topPriorities: any[] | null;
};

function isProfileFieldFilled(value: any, isArray?: boolean): boolean {
  if (isArray) return Array.isArray(value) && value.length > 0;
  return value !== null && value !== undefined && value !== "";
}

/**
 * Canonical, deterministic profile-completeness score for admin surfaces.
 * Uses only fields actively collected in onboarding/profile and the
 * user_interests join for interest data.
 */
export function calculateAdminProfileCompleteness(input: {
  user: any;
  interests?: { totalSelections?: number | null; selections?: any[] | null; topPriorities?: any[] | null } | null;
}): AdminProfileCompleteness {
  const { user, interests } = input;

  const hasIndustry = !!(
    user.industryRawInput ||
    user.industryCategoryLabel ||
    user.industrySegmentLabel ||
    user.industryNicheLabel
  );

  const hasInterests = !!(
    interests &&
    ((Array.isArray(interests.selections) && interests.selections.length > 0) ||
      (typeof interests.totalSelections === "number" && interests.totalSelections > 0))
  );

  const fields: Array<{
    key?: string;
    label: string;
    weight: number;
    isArray?: boolean;
    check?: () => boolean;
  }> = [
    { key: "displayName", label: "昵称", weight: 1 },
    { key: "gender", label: "性别", weight: 1 },
    { key: "birthdate", label: "生日", weight: 1 },
    { key: "currentCity", label: "城市", weight: 1 },
    { key: "intent", label: "活动意向", weight: 1, isArray: true },
    { label: "社交原型", weight: 1, check: () => !!(user.archetype || user.primaryArchetype) },
    { key: "relationshipStatus", label: "感情状态", weight: 0.5 },
    { key: "educationLevel", label: "学历", weight: 0.5 },
    { key: "lifeStage", label: "人生阶段", weight: 0.5 },
    { label: "职业", weight: 1, check: () => hasIndustry },
    { key: "bio", label: "个人签名", weight: 0.5 },
    { key: "wechatContactId", label: "微信号", weight: 0.5 },
    { key: "dietaryRestrictions", label: "忌口偏好", weight: 0.5, isArray: true },
    { key: "preferredLanguages", label: "语言偏好", weight: 0.5, isArray: true },
    { label: "兴趣", weight: 1, check: () => hasInterests },
  ];

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  let filledWeight = 0;
  const missingFields: string[] = [];

  for (const field of fields) {
    const isFilled = field.check
      ? field.check()
      : isProfileFieldFilled(user[field.key!], field.isArray);
    if (isFilled) {
      filledWeight += field.weight;
    } else {
      missingFields.push(field.label);
    }
  }

  const score = totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 0;
  const starRating =
    score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;

  return { score, starRating, missingFields };
}

function deriveInterestsTop(interests: any): string[] | undefined {
  if (!interests) return undefined;
  if (Array.isArray(interests.topPriorities) && interests.topPriorities.length > 0) {
    return interests.topPriorities.map((p: any) => p.label).filter(Boolean);
  }
  if (Array.isArray(interests.selections) && interests.selections.length > 0) {
    return interests.selections.map((s: any) => s.label).filter(Boolean);
  }
  return undefined;
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
export function toAdminUserDto(
  user: any,
  options: {
    profileCompleteness: AdminProfileCompleteness;
    interests?: { totalSelections?: number | null; selections?: any[] | null; topPriorities?: any[] | null } | null;
  },
): AdminUserDto {
  const { profileCompleteness, interests } = options;
  return {
    id: user.id,
    email: user.email ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    displayName: user.displayName ?? null,
    wechatNickname: user.wechatNickname ?? null,
    phoneNumber: user.phoneNumber ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
    birthdate: user.birthdate ?? null,
    ageVisibility: user.ageVisibility ?? null,
    gender: user.gender ?? null,
    pronouns: user.pronouns ?? null,
    relationshipStatus: user.relationshipStatus ?? null,
    lifeStage: user.lifeStage ?? null,
    ageMatchPreference: user.ageMatchPreference ?? null,
    educationLevel: user.educationLevel ?? null,
    educationVisibility: user.educationVisibility ?? null,
    occupationId: user.occupationId ?? null,
    standardizedOccupationId: user.standardizedOccupationId ?? null,
    workMode: user.workMode ?? null,
    workVisibility: user.workVisibility ?? null,
    hometownRegionCity: user.hometownRegionCity ?? null,
    hometownAffinityOptin: user.hometownAffinityOptin ?? null,
    currentCity: user.currentCity ?? null,
    accessibilityNeeds: user.accessibilityNeeds ?? null,
    safetyNoteHost: user.safetyNoteHost ?? null,
    intent: user.intent ?? null,
    hasCompletedRegistration: user.hasCompletedRegistration ?? null,
    hasCompletedInterestsTopics: user.hasCompletedInterestsTopics ?? null,
    hasCompletedPersonalityTest: user.hasCompletedPersonalityTest ?? null,
    hasSeenProfileReview: user.hasSeenProfileReview ?? null,
    hasCompletedInterestsCarousel: user.hasCompletedInterestsCarousel ?? null,
    onboardingCheckpoint: user.onboardingCheckpoint ?? null,
    onboardingCheckpointTimestamp: user.onboardingCheckpointTimestamp ?? null,
    interestsDeep: user.interestsDeep ?? null,
    interestsRankedTop3: user.interestsRankedTop3 ?? null,
    interestFavorite: user.interestFavorite ?? null,
    bio: user.bio ?? null,
    preferredLanguages: user.preferredLanguages ?? null,
    dietaryRestrictions: user.dietaryRestrictions ?? null,
    tableVibePreference: user.tableVibePreference ?? null,
    defaultPreferenceStrictness: user.defaultPreferenceStrictness ?? null,
    defaultPreferredDistricts: user.defaultPreferredDistricts ?? null,
    defaultGenderComposition: user.defaultGenderComposition ?? null,
    defaultAcceptPairs: user.defaultAcceptPairs ?? null,
    defaultKolComfort: user.defaultKolComfort ?? null,
    socialStyle: user.socialStyle ?? null,
    icebreakerRole: user.icebreakerRole ?? null,
    venueStylePreference: user.venueStylePreference ?? null,
    cuisinePreference: user.cuisinePreference ?? null,
    favoriteRestaurant: user.favoriteRestaurant ?? null,
    favoriteRestaurantReason: user.favoriteRestaurantReason ?? null,
    archetype: user.archetype ?? null,
    primaryArchetype: user.primaryArchetype ?? null,
    secondaryArchetype: user.secondaryArchetype ?? null,
    roleSubtype: user.roleSubtype ?? null,
    debateComfort: user.debateComfort ?? null,
    needsPersonalityRetake: user.needsPersonalityRetake ?? null,
    eventsAttended: user.eventsAttended ?? null,
    matchesMade: user.matchesMade ?? null,
    experiencePoints: user.experiencePoints ?? null,
    joyCoins: user.joyCoins ?? null,
    currentLevel: user.currentLevel ?? null,
    activityStreak: user.activityStreak ?? null,
    lastActivityDate: user.lastActivityDate ?? null,
    streakFreezeAvailable: user.streakFreezeAvailable ?? null,
    eventCredits: user.eventCredits ?? null,
    eventCreditsExpiry: user.eventCreditsExpiry ?? null,
    isAdmin: user.isAdmin ?? null,
    isBanned: user.isBanned ?? null,
    isTestBot: user.isTestBot ?? null,
    violationCount: user.violationCount ?? null,
    lastViolationReason: user.lastViolationReason ?? null,
    viewedEventAnimations: user.viewedEventAnimations ?? null,
    registrationMethod: user.registrationMethod ?? null,
    registrationCompletedAt: user.registrationCompletedAt ?? null,
    onboardingRestartCount: user.onboardingRestartCount ?? null,
    industryCategory: user.industryCategory ?? null,
    industryCategoryLabel: user.industryCategoryLabel ?? null,
    industrySegmentNew: user.industrySegmentNew ?? null,
    industrySegmentLabel: user.industrySegmentLabel ?? null,
    industryNiche: user.industryNiche ?? null,
    industryNicheLabel: user.industryNicheLabel ?? null,
    industryRawInput: user.industryRawInput ?? null,
    industryNormalized: user.industryNormalized ?? null,
    industrySource: user.industrySource ?? null,
    industryConfidence: user.industryConfidence ?? null,
    industryClassifiedAt: user.industryClassifiedAt ?? null,
    industryLastVerifiedAt: user.industryLastVerifiedAt ?? null,
    socialTag: user.socialTag ?? null,
    socialTagSelectedAt: user.socialTagSelectedAt ?? null,
    wechatContactId: user.wechatContactId ?? null,
    wechatContactIdSetAt: user.wechatContactIdSetAt ?? null,
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
    interestsTop: deriveInterestsTop(interests),
    profileCompleteness,
  };
}

export function registerAdminUserRoutes(app: Express): void {

  // ============ AUTH MIDDLEWARE ============
  
  async function requireAuth(req: Request, res: any, next: any) {
    if (!getAuthenticatedUserId(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }

  // Dashboard Statistics
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allUserInterests = await db
        .select({
          userId: userInterests.userId,
          totalSelections: userInterests.totalSelections,
          selections: userInterests.selections,
          topPriorities: userInterests.topPriorities,
        })
        .from(userInterests) as Array<AdminUserInterestSummary>;
      const interestsByUser = new Map(allUserInterests.map((row) => [row.userId, row]));

      const totalUsers = allUsers.length;
      const [subscribedUsersResult, newUsersThisWeekResult, monthlyRevenueResult] = await Promise.all([
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${subscriptions} WHERE status = 'active'`),
        db.execute(sql`SELECT COUNT(*)::int as count FROM ${users} WHERE created_at >= NOW() - INTERVAL '7 days'`),
        db.execute(sql`SELECT COALESCE(SUM(final_amount), 0)::int as total FROM ${payments} WHERE status = 'completed' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW()) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`),
      ]);
      const subscribedUsers = Number((subscribedUsersResult.rows[0] as any).count) || 0;
      const newUsersThisWeek = Number((newUsersThisWeekResult.rows[0] as any).count) || 0;
      const monthlyRevenue = Number((monthlyRevenueResult.rows[0] as any).total) || 0;
      const userGrowth = totalUsers > 0 ? Math.round((newUsersThisWeek / totalUsers) * 100) : 0;
      
      // Count events (for now using blindBoxEvents)
      const allBlindBoxEvents = await storage.getAllBlindBoxEvents();
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const eventsThisMonth = allBlindBoxEvents.filter((event: any) => {
        const eventDate = new Date(event.createdAt || '');
        return eventDate >= thisMonth;
      }).length;
      
      // Personality distribution (archetypes)
      const personalityDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.primaryArchetype) {
          acc[user.primaryArchetype] = (acc[user.primaryArchetype] || 0) + 1;
        }
        return acc;
      }, {});
      
      // Archetype distribution (12-archetype system)
      const archetypeDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.archetype) {
          acc[user.archetype] = (acc[user.archetype] || 0) + 1;
        }
        return acc;
      }, {});
      
      // Profile completeness distribution
      const completenessStats = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0, weakUsers: [] as any[] };
      for (const user of allUsers) {
        const completeness = calculateAdminProfileCompleteness({
          user,
          interests: interestsByUser.get(user.id),
        });
        if (completeness.starRating === 1) completenessStats.star1++;
        else if (completeness.starRating === 2) completenessStats.star2++;
        else if (completeness.starRating === 3) completenessStats.star3++;
        else if (completeness.starRating === 4) completenessStats.star4++;
        else if (completeness.starRating === 5) completenessStats.star5++;

        // Track weak users (< 50% completeness)
        if (completeness.score < 50 && completenessStats.weakUsers.length < 10) {
          completenessStats.weakUsers.push({
            id: user.id,
            displayName: getCanonicalDisplayName(user),
            score: completeness.score,
            starRating: completeness.starRating,
            missingFields: completeness.missingFields.slice(0, 5),
          });
        }
      }
      
      // City distribution
      const cityDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.currentCity) {
          acc[user.currentCity] = (acc[user.currentCity] || 0) + 1;
        }
        return acc;
      }, {});

      // Calculate gamification stats
      const levelDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        const level = user.currentLevel || 1;
        acc[`Lv.${level}`] = (acc[`Lv.${level}`] || 0) + 1;
        return acc;
      }, {});
      
      const totalXP = allUsers.reduce((sum: number, user: any) => sum + (user.experiencePoints || 0), 0);
      const totalJoyCoins = allUsers.reduce((sum: number, user: any) => sum + (user.joyCoins || 0), 0);
      const activeStreakUsers = allUsers.filter((user: any) => (user.activityStreak || 0) > 0).length;
      
      const gamificationStats = {
        levelDistribution,
        totalXP,
        totalJoyCoins,
        activeStreakUsers,
        avgLevel: allUsers.length > 0 
          ? Math.round((allUsers.reduce((sum: number, u: any) => sum + (u.currentLevel || 1), 0) / allUsers.length) * 10) / 10
          : 1,
      };

      // Calculate weekly matching satisfaction and low-scoring matches
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      let weeklyMatchingSatisfaction = 70; // Default value
      let lowScoringMatches = 0;
      
      try {
        // Get recent pool matching logs from past 7 days
        const recentLogs = await db
          .select()
          .from(poolMatchingLogs)
          .where(gt(poolMatchingLogs.createdAt, sevenDaysAgo));
        
        if (recentLogs.length > 0) {
          // Calculate average satisfaction from matchScores (assuming > 70 is satisfied)
          const totalScore = recentLogs.reduce((sum: number, log: any) => {
            const score = typeof log.matchScore === 'number' ? log.matchScore : 0;
            return sum + score;
          }, 0);
          weeklyMatchingSatisfaction = Math.round(totalScore / recentLogs.length);
          
          // Count low-scoring matches (< 50)
          lowScoringMatches = recentLogs.filter((log: any) => {
            const score = typeof log.matchScore === 'number' ? log.matchScore : 0;
            return score < 50;
          }).length;
        }
      } catch (err) {
        logger.warn("Error calculating matching metrics", { data: err });
        // Use defaults if calculation fails
      }

      res.json({
        totalUsers,
        subscribedUsers,
        eventsThisMonth,
        monthlyRevenue,
        newUsersThisWeek,
        userGrowth,
        personalityDistribution,
        archetypeDistribution,
        completenessStats,
        cityDistribution,
        weeklyMatchingSatisfaction,
        lowScoringMatches,
        gamificationStats,
        matchingMetrics: getMatchingMetricsSnapshot(),
      });
    } catch (error) {
      logger.error("Error fetching admin stats", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Operational Dashboard — Today's Events + Alerts
  app.get("/api/admin/ops-dashboard", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Today's events
      const todayEventsResult = await db.execute(sql`
        SELECT
          e.id,
          e.title,
          e.date_time as "dateTime",
          e.location,
          e.status,
          e.max_attendees as "maxAttendees",
          COUNT(CASE WHEN ea.status != 'cancelled' THEN 1 END) as "registeredCount",
          COUNT(CASE WHEN ea.status = 'attended' THEN 1 END) as "checkedInCount"
        FROM events e
        LEFT JOIN event_attendance ea ON e.id = ea.event_id
        WHERE e.date_time >= ${todayStart} AND e.date_time <= ${todayEnd}
        GROUP BY e.id, e.title, e.date_time, e.location, e.status, e.max_attendees
        ORDER BY e.date_time ASC
      `);

      const todayEvents = (todayEventsResult.rows as any[]).map((row) => ({
        id: row.id,
        title: row.title,
        dateTime: row.dateTime,
        location: row.location,
        status: row.status,
        maxAttendees: row.maxAttendees,
        registeredCount: Number(row.registeredCount) || 0,
        checkedInCount: Number(row.checkedInCount) || 0,
        noShowCount: Math.max(0, (Number(row.registeredCount) || 0) - (Number(row.checkedInCount) || 0)),
      }));

      // Alerts
      const pendingReportsResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM reports WHERE status = 'pending'
      `);
      const pendingReports = Number((pendingReportsResult.rows[0] as any).count) || 0;

      const underfilledPoolsResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM event_pools
        WHERE registration_deadline > NOW()
          AND registration_deadline <= NOW() + INTERVAL '24 hours'
      `);
      const underfilledPoolsClosingSoon = Number((underfilledPoolsResult.rows[0] as any).count) || 0;

      const refundsPendingResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM payments WHERE status = 'refund_pending'
      `);
      const refundsPending = Number((refundsPendingResult.rows[0] as any).count) || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const stuckUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE (
          onboarding_checkpoint IS NULL
          OR onboarding_checkpoint NOT IN ('profile-review')
        )
        AND COALESCE(onboarding_checkpoint_timestamp, created_at) < ${sevenDaysAgo}
        AND created_at < ${sevenDaysAgo}
      `);
      const usersStuckInOnboarding = Number((stuckUsersResult.rows[0] as any).count) || 0;

      res.json({
        todayEvents,
        alerts: {
          pendingReports,
          underfilledPoolsClosingSoon,
          refundsPending,
          usersStuckInOnboarding,
        },
      });
    } catch (error) {
      logger.error("Error fetching ops dashboard", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch ops dashboard" });
    }
  });

  // User Management - Get all users with filters and pagination
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { search, filter, city, archetype, intent, interest, minCompleteness, maxCompleteness } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      const rawUsers = await storage.getAllUsers();
      const allUserInterests = await db
        .select({
          userId: userInterests.userId,
          totalSelections: userInterests.totalSelections,
          selections: userInterests.selections,
          topPriorities: userInterests.topPriorities,
        })
        .from(userInterests) as Array<AdminUserInterestSummary>;
      const interestsByUser = new Map(allUserInterests.map((row) => [row.userId, row]));

      let users = rawUsers;

      // Apply search filter
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        users = users.filter((user: any) =>
          user.firstName?.toLowerCase().includes(searchLower) ||
          user.lastName?.toLowerCase().includes(searchLower) ||
          user.displayName?.toLowerCase().includes(searchLower) ||
          user.wechatNickname?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.phoneNumber?.includes(search)
        );
      }

      // Apply status filter
      if (filter === "banned") {
        users = users.filter((user: any) => user.isBanned);
      } else if (filter === "subscribed") {
        users = [];
      } else if (filter === "non-subscribed") {
        users = users;
      } else if (filter === "stuck") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        users = users.filter((user: any) => {
          const checkpoint = user.onboardingCheckpoint;
          const checkpointTime = user.onboardingCheckpointTimestamp ? new Date(user.onboardingCheckpointTimestamp) : null;
          const createdAt = user.createdAt ? new Date(user.createdAt) : null;
          const isComplete = checkpoint === 'profile-review';
          if (isComplete) return false;
          const isStale = (checkpointTime && checkpointTime < sevenDaysAgo) || (createdAt && createdAt < sevenDaysAgo);
          return isStale;
        });
      }

      // Apply city filter
      if (city && typeof city === "string") {
        users = users.filter((user: any) => user.currentCity === city);
      }

      // Apply archetype filter
      if (archetype && typeof archetype === "string") {
        users = users.filter((user: any) => user.archetype === archetype);
      }

      // Apply intent filter
      if (intent && typeof intent === "string") {
        users = users.filter((user: any) =>
          Array.isArray(user.intent) && user.intent.includes(intent)
        );
      }

      // Build deterministic admin DTOs with canonical completeness
      let userDtos = users.map((user: any) => {
        const interests = interestsByUser.get(user.id);
        const profileCompleteness = calculateAdminProfileCompleteness({ user, interests });
        return toAdminUserDto(user, { profileCompleteness, interests });
      });

      // Apply interest filter (deprecated interestsTop is derived from user_interests)
      if (interest && typeof interest === "string") {
        const interestLower = interest.toLowerCase();
        userDtos = userDtos.filter((user) =>
          Array.isArray(user.interestsTop) && user.interestsTop.some((i: string) =>
            i.toLowerCase().includes(interestLower)
          )
        );
      }

      // Apply completeness filters
      if (minCompleteness) {
        const minVal = parseInt(minCompleteness as string);
        userDtos = userDtos.filter((u) => u.profileCompleteness.score >= minVal);
      }
      if (maxCompleteness) {
        const maxVal = parseInt(maxCompleteness as string);
        userDtos = userDtos.filter((u) => u.profileCompleteness.score <= maxVal);
      }

      const totalUsers = userDtos.length;
      const paginatedUsers = userDtos.slice(offset, offset + limit);

      res.json({
        users: paginatedUsers,
        pagination: {
          page,
          limit,
          total: totalUsers,
          totalPages: Math.ceil(totalUsers / limit),
        },
      });
    } catch (error) {
      logger.error("Error fetching users", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // User Management - Get user details with profile completeness
  app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's events
      const events = await storage.getUserBlindBoxEvents(req.params.id);

      // Fetch interests and build deterministic DTO
      const [interests] = await db
        .select({
          totalSelections: userInterests.totalSelections,
          selections: userInterests.selections,
          topPriorities: userInterests.topPriorities,
        })
        .from(userInterests)
        .where(eq(userInterests.userId, req.params.id))
        .limit(1) as AdminUserInterestSummary[];

      const profileCompleteness = calculateAdminProfileCompleteness({ user, interests });
      const userDto = toAdminUserDto(user, { profileCompleteness, interests });

      res.json({
        ...userDto,
        events,
      });
    } catch (error) {
      logger.error("Error fetching user details", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch user details" });
    }
  });

  // User Management - Get comprehensive user detail for admin portal
  app.get("/api/admin/users/:id/detail", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Onboarding lifecycle — mirrors /api/auth/user logic including onboardingCheckpoint override
      type OnboardingStep = 'onboarding' | 'personality-test' | 'essential-data' | 'extended-data' | 'profile-review' | 'discover';
      const profileEssentialComplete = !!(user.displayName && user.gender && user.currentCity);
      let nextStep: OnboardingStep;
      // Keep consistent with /api/auth/user: gate on hasCompletedPersonalityTest rather than
      // hasCompletedRegistration so post-WeChat-auth users advance correctly.
      if (!user.hasCompletedPersonalityTest && !user.hasCompletedRegistration) nextStep = 'onboarding';
      else if (!user.hasCompletedPersonalityTest) nextStep = 'personality-test';
      else if (!profileEssentialComplete) nextStep = 'essential-data';
      else if (!user.hasCompletedInterestsCarousel) nextStep = 'extended-data';
      else if (!user.hasSeenProfileReview) nextStep = 'profile-review';
      else nextStep = 'discover';

      const stepOrder: OnboardingStep[] = ['onboarding', 'personality-test', 'essential-data', 'extended-data', 'profile-review', 'discover'];
      const baseIndex = stepOrder.indexOf(nextStep);
      const checkpointValue = user.onboardingCheckpoint as OnboardingStep | null;
      const checkpointIndex = checkpointValue ? stepOrder.indexOf(checkpointValue) : -1;
      if (checkpointValue && checkpointIndex !== -1 && baseIndex !== -1 && checkpointIndex > baseIndex && checkpointIndex < stepOrder.indexOf('discover')) {
        const nextStepIndex = Math.min(checkpointIndex + 1, stepOrder.indexOf('discover'));
        nextStep = stepOrder[nextStepIndex];
      }

      // Fetch all independent data in parallel
      const [
        assessmentSessionResult,
        joinedEvents,
        poolRegistrations,
        userConnections,
        userMatchHistory,
        interestsResult,
      ] = await Promise.all([
        db
          .select()
          .from(assessmentSessions)
          .where(and(eq(assessmentSessions.userId, userId), eq(assessmentSessions.phase, 'completed')))
          .orderBy(desc(assessmentSessions.completedAt))
          .limit(1),
        storage.getUserJoinedEvents(userId),
        db
          .select()
          .from(eventPoolRegistrations)
          .where(eq(eventPoolRegistrations.userId, userId))
          .orderBy(desc(eventPoolRegistrations.registeredAt))
          .limit(20),
        db
          .select()
          .from(connections)
          .where(and(
            or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
            eq(connections.status, 'mutual')
          ))
          .orderBy(desc(connections.createdAt))
          .limit(20),
        db
          .select({
            id: matchHistory.id,
            user1Id: matchHistory.user1Id,
            user2Id: matchHistory.user2Id,
            eventId: matchHistory.eventId,
            matchedAt: matchHistory.matchedAt,
            connectionQuality: matchHistory.connectionQuality,
            wouldMeetAgain: matchHistory.wouldMeetAgain,
            connectionPointTypes: matchHistory.connectionPointTypes,
            partnerName: users.displayName,
            partnerArchetype: users.archetype,
            eventTitle: events.title,
          })
          .from(matchHistory)
          .leftJoin(users, or(
            and(eq(matchHistory.user1Id, userId), eq(matchHistory.user2Id, users.id)),
            and(eq(matchHistory.user2Id, userId), eq(matchHistory.user1Id, users.id))
          ))
          .leftJoin(events, eq(matchHistory.eventId, events.id))
          .where(or(eq(matchHistory.user1Id, userId), eq(matchHistory.user2Id, userId)))
          .orderBy(desc(matchHistory.matchedAt))
          .limit(20),
        db
          .select()
          .from(userInterests)
          .where(eq(userInterests.userId, userId))
          .limit(1) as AdminUserInterestSummary[],
      ]);

      const assessmentSession = assessmentSessionResult[0] || null;
      const interests = interestsResult[0] || null;

      const profileCompleteness = calculateAdminProfileCompleteness({ user, interests });

      // Deterministic allow-list DTO; sensitive columns are stripped by the mapper
      const userDto = toAdminUserDto(user, { profileCompleteness, interests });

      logAdminAudit({
        action: 'USER_DETAIL_VIEWED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'user',
        targetEntityId: userId,
        context: {
          viewedFields: ['fullProfile', 'contact'],
          profileCompletenessScore: profileCompleteness.score,
        },
      });

      // Matching readiness
      const blockers: string[] = [];
      if (!user.hasCompletedPersonalityTest) blockers.push('人格测试未完成');
      if (!(user.archetype || user.primaryArchetype)) blockers.push('原型未确定');
      if (!profileEssentialComplete) blockers.push('基本资料不完整');
      if (!user.hasCompletedInterestsCarousel) blockers.push('兴趣数据未完成');
      if (user.isBanned) blockers.push('用户已被封禁');
      const matchingReadiness = { isReady: blockers.length === 0, blockers };

      res.json({
        user: userDto,
        onboarding: {
          nextStep,
          profileEssentialComplete,
          hasCompletedRegistration: user.hasCompletedRegistration,
          hasCompletedPersonalityTest: user.hasCompletedPersonalityTest,
          hasCompletedInterestsCarousel: user.hasCompletedInterestsCarousel,
          hasSeenProfileReview: user.hasSeenProfileReview,
        },
        assessmentSession: assessmentSession || null,
        joinedEvents,
        poolRegistrations,
        connections: userConnections,
        matchHistory: userMatchHistory,
        interests: interests || null,
        matchingReadiness,
      });
    } catch (error) {
      logger.error("Error fetching user detail", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch user detail" });
    }
  });

  // Icebreaker Session Monitor — Read-only view of active sessions
  app.get("/api/admin/icebreaker-sessions", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const sessionsResult = await db.execute(sql`
        SELECT
          s.id,
          s.current_phase as "currentPhase",
          s.phase_started_at as "phaseStartedAt",
          s.expected_attendees as "expectedAttendees",
          s.checked_in_count as "checkedInCount",
          s.host_user_id as "hostUserId",
          s.started_at as "startedAt",
          s.created_at as "createdAt",
          e.title as "eventTitle",
          u.first_name as "hostFirstName",
          u.last_name as "hostLastName"
        FROM icebreaker_sessions s
        LEFT JOIN events e ON s.event_id = e.id
        LEFT JOIN users u ON s.host_user_id = u.id
        WHERE s.ended_at IS NULL
        ORDER BY s.created_at DESC
      `);

      const sessions = (sessionsResult.rows as any[]).map((row) => {
        const phaseStarted = row.phaseStartedAt ? new Date(row.phaseStartedAt) : null;
        const now = new Date();
        const phaseDurationMinutes = phaseStarted
          ? Math.floor((now.getTime() - phaseStarted.getTime()) / 60000)
          : null;

        return {
          id: row.id,
          currentPhase: row.currentPhase || "waiting",
          phaseStartedAt: row.phaseStartedAt,
          phaseDurationMinutes,
          expectedAttendees: Number(row.expectedAttendees) || 0,
          checkedInCount: Number(row.checkedInCount) || 0,
          hostUserId: row.hostUserId,
          hostName: row.hostFirstName || row.hostLastName
            ? `${row.hostFirstName || ""} ${row.hostLastName || ""}`.trim()
            : null,
          eventTitle: row.eventTitle || "未关联活动",
          startedAt: row.startedAt,
        };
      });

      res.json({ sessions });
    } catch (error) {
      logger.error("Error fetching icebreaker sessions", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch icebreaker sessions" });
    }
  });

  // User Management - Ban user
  app.patch("/api/admin/users/:id/ban", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { reason } = req.body;
      if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        return res.status(400).json({ message: "封禁原因必填，至少5个字符" });
      }

      const updatedUser = await storage.updateUser(req.params.id, { isBanned: true });

      logAdminAudit({
        action: 'USER_BANNED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'user',
        targetEntityId: req.params.id,
        before: { isBanned: user.isBanned },
        after: { isBanned: true, reason: reason.trim() },
        context: { reason: reason.trim() },
      });

      // WeCom notification for ban
      void (async () => {
        try {
          const adminId = getActingAdminId(req);
          const [adminRecord] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, adminId));
          await notifyAdminAction({
            adminName: adminRecord?.displayName || adminId,
            adminRole: (req as any).adminRole || "operator",
            actionType: "ban",
            actionTypeLabel: "用户封禁",
            targetUserDisplayName: user.displayName || "未知用户",
            targetUserId: user.id,
            reason: reason.trim(),
            changeSummary: `用户状态: ${user.isBanned ? "已封禁" : "正常"} → 封禁`,
            auditLogId: req.params.id,
          });
        } catch (notifyErr) {
          logger.warn("Failed to send ban WeCom notification", { error: String(notifyErr) });
        }
      })();

      res.json(updatedUser);
    } catch (error) {
      logger.error("Error banning user", { error: String(error) });
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  // User Management - Unban user
  app.patch("/api/admin/users/:id/unban", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(req.params.id, { isBanned: false });

      logAdminAudit({
        action: 'USER_UNBANNED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'user',
        targetEntityId: req.params.id,
        before: { isBanned: user.isBanned },
        after: { isBanned: false },
      });

      res.json(updatedUser);
    } catch (error) {
      logger.error("Error unbanning user", { error: String(error) });
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  // User Management - Delete all user data
  app.delete("/api/admin/users/:id/data", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Admin accounts own audit and operational records. Deleting those rows
      // through the generic cascade would destroy the audit trail, so account
      // administration must continue to use its dedicated super-admin flow.
      if (user.isAdmin) {
        return res.status(400).json({ message: "Admin accounts cannot be deleted from user management" });
      }

      await db.transaction(async (tx: any) => {
        // These identifiers intentionally have no FK in the current schema, so
        // pg_constraint discovery cannot see them. Keep this list limited to
        // non-FK privacy records; FK-backed tables belong to the cascade below.
        await tx.execute(sql`DELETE FROM social_icebreaker_participants WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM social_icebreaker_lie_truths WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM social_icebreaker_sessions WHERE host_user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM industry_ai_logs WHERE user_id = ${userId}`);

        // Discover the live FK graph from PostgreSQL and delete transitive
        // dependents deepest-first. This keeps the endpoint aligned as new
        // user-owned tables are added and leaves ON DELETE CASCADE relations to
        // the database itself.
        await cascadeDeleteByIds(tx, "users", "id", [userId]);
      });

      logAdminAudit({
        action: 'USER_DATA_DELETED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'user',
        targetEntityId: userId,
        before: { displayName: user.displayName, phoneNumber: user.phoneNumber },
        after: null as any,
        context: { action: 'delete_all_user_data' as string },
      });

      res.json({ message: "User data deleted successfully" });
    } catch (error) {
      logger.error("Error deleting user data", { error: String(error) });
      res.status(500).json({ message: "Failed to delete user data. See server logs for details." });
    }
  });
}
