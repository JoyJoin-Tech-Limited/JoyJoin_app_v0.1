import type { Express, Request } from "express";
import { z } from "zod";
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
import { WORK_MODE_LABELS } from "@shared/constants";
import { assessmentSessions, eventPoolRegistrations, eventPoolGroups, connections, matchHistory, userInterests, poolMatchingLogs, users, events, payments, subscriptions } from "@shared/schema";

/**
 * Effective life-stage label for admin surfaces.
 * Prefers the canonical users.lifeStage; falls back to the legacy workMode
 * label for one release.
 */
function getEffectiveLifeStage(user: any): string | null {
  if (user.lifeStage) return user.lifeStage;
  if (user.workMode && WORK_MODE_LABELS[user.workMode as keyof typeof WORK_MODE_LABELS]) {
    return WORK_MODE_LABELS[user.workMode as keyof typeof WORK_MODE_LABELS];
  }
  return null;
}

function calculateProfileCompletenessSimple(user: any): { score: number; starRating: number; missingFields: string[] } {
  const fields = [
    "firstName", "lastName", "displayName", "gender", "birthdate",
    "currentCity", "profession", "industry", "educationLevel",
    "profileImageUrl", "aboutMe", "archetype",
  ];
  const present = fields.filter((f) => user[f] !== null && user[f] !== undefined && user[f] !== "");
  const score = Math.round((present.length / fields.length) * 100);
  const starRating = Math.ceil(score / 20);
  return { score, starRating, missingFields: fields.filter((f) => !present.includes(f)) };
}

export function registerAdminUserRoutes(app: Express): void {

  // ============ AUTH MIDDLEWARE ============
  
  async function requireAuth(req: Request, res: any, next: any) {
    if (!getAuthenticatedUserId(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }

  // Simple profile completeness calculator for stats (used before main function is defined)
  function calculateProfileCompletenessSimple(user: any): { score: number; starRating: number; missingFields: string[] } {
    const fields = [
      { key: 'displayName', label: '昵称', weight: 1 },
      { key: 'gender', label: '性别', weight: 1 },
      { key: 'birthdate', label: '生日', weight: 1 },
      { key: 'currentCity', label: '城市', weight: 1 },
      { key: 'interestsTop', label: '兴趣', weight: 1, isArray: true },
      { key: 'intent', label: '活动意向', weight: 1, isArray: true },
      { key: 'archetype', label: '社交原型', weight: 1 },
      { key: 'relationshipStatus', label: '感情状态', weight: 0.5 },
      { key: 'educationLevel', label: '学历', weight: 0.5 },
      { key: 'lifeStage', label: '人生阶段', weight: 0.5 },
      { key: 'socialStyle', label: '社交风格', weight: 0.5 },
      { key: 'venueStylePreference', label: '场地偏好', weight: 0.5 },
      { key: 'cuisinePreference', label: '菜系偏好', weight: 0.5, isArray: true },
    ];
    
    const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
    const missingFields: string[] = [];
    let filledWeight = 0;
    
    for (const field of fields) {
      const value = user[field.key];
      const isFilled = (field as any).isArray 
        ? Array.isArray(value) && value.length > 0
        : value !== null && value !== undefined && value !== '';
      
      if (isFilled) filledWeight += field.weight;
      else missingFields.push(field.label);
    }
    
    const score = Math.round((filledWeight / totalWeight) * 100);
    const starRating = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;
    
    return { score, starRating, missingFields };
  }

  // Dashboard Statistics
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
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
        const completeness = calculateProfileCompletenessSimple(user);
        if (completeness.starRating === 1) completenessStats.star1++;
        else if (completeness.starRating === 2) completenessStats.star2++;
        else if (completeness.starRating === 3) completenessStats.star3++;
        else if (completeness.starRating === 4) completenessStats.star4++;
        else if (completeness.starRating === 5) completenessStats.star5++;
        
        // Track weak users (< 50% completeness)
        if (completeness.score < 50 && completenessStats.weakUsers.length < 10) {
          completenessStats.weakUsers.push({
            id: user.id,
            displayName: user.displayName || user.wechatNickname || user.firstName || '未命名',
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

  // Helper function to calculate profile completeness
  function calculateProfileCompleteness(user: any): { score: number; starRating: number; missingFields: string[] } {
    const essentialFields = [
      { key: 'displayName', label: '昵称', weight: 1 },
      { key: 'gender', label: '性别', weight: 1 },
      { key: 'birthdate', label: '生日', weight: 1 },
      { key: 'currentCity', label: '城市', weight: 1 },
    ];
    const coreFields = [
      { key: 'interestsTop', label: '兴趣', weight: 1, isArray: true },
      { key: 'intent', label: '活动意向', weight: 1, isArray: true },
      { key: 'archetype', label: '社交原型', weight: 1 },
    ];
    const enrichmentFields = [
      { key: 'relationshipStatus', label: '感情状态', weight: 0.5 },
      { key: 'educationLevel', label: '学历', weight: 0.5 },
      { key: 'lifeStage', label: '人生阶段', weight: 0.5 },
      { key: 'socialStyle', label: '社交风格', weight: 0.5 },
      { key: 'venueStylePreference', label: '场地偏好', weight: 0.5 },
      { key: 'cuisinePreference', label: '菜系偏好', weight: 0.5, isArray: true },
      { key: 'topicAvoidances', label: '避免话题', weight: 0.3, isArray: true },
      { key: 'hasPets', label: '养宠物', weight: 0.3 },
      { key: 'hometown', label: '家乡', weight: 0.3 },
    ];
    
    const allFields = [...essentialFields, ...coreFields, ...enrichmentFields];
    const totalWeight = allFields.reduce((sum, f) => sum + f.weight, 0);
    const missingFields: string[] = [];
    
    let filledWeight = 0;
    for (const field of allFields) {
      const value = user[field.key];
      const isFilled = (field as any).isArray 
        ? Array.isArray(value) && value.length > 0
        : value !== null && value !== undefined && value !== '';
      
      if (isFilled) {
        filledWeight += field.weight;
      } else {
        missingFields.push(field.label);
      }
    }
    
    const score = Math.round((filledWeight / totalWeight) * 100);
    const starRating = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;
    
    return { score, starRating, missingFields };
  }

  // User Management - Get all users with filters and pagination
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { search, filter, city, archetype, intent, interest, minCompleteness, maxCompleteness } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      let users = await storage.getAllUsers();

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
      
      // Apply interest filter
      if (interest && typeof interest === "string") {
        users = users.filter((user: any) => 
          Array.isArray(user.interestsTop) && user.interestsTop.some((i: string) => 
            i.toLowerCase().includes(interest.toLowerCase())
          )
        );
      }
      
      // Calculate completeness for each user and apply completeness filter
      const usersWithCompleteness = users.map((user: any) => {
        const completeness = calculateProfileCompleteness(user);
        return { ...user, profileCompleteness: completeness };
      });
      
      // Apply completeness filters
      let filteredUsers = usersWithCompleteness;
      if (minCompleteness) {
        const minVal = parseInt(minCompleteness as string);
        filteredUsers = filteredUsers.filter(u => u.profileCompleteness.score >= minVal);
      }
      if (maxCompleteness) {
        const maxVal = parseInt(maxCompleteness as string);
        filteredUsers = filteredUsers.filter(u => u.profileCompleteness.score <= maxVal);
      }

      const totalUsers = filteredUsers.length;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit).map((user: any) => ({
        ...user,
        lifeStageDisplay: getEffectiveLifeStage(user),
      }));

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
      
      // Calculate profile completeness
      const profileCompleteness = calculateProfileCompleteness(user);
      const lifeStageDisplay = getEffectiveLifeStage(user);
      
      res.json({
        ...user,
        lifeStageDisplay,
        profileCompleteness,
        events,
        subscriptions: [],
        payments: [],
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

      const profileCompleteness = calculateProfileCompleteness(user);

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
          .limit(1),
      ]);

      const assessmentSession = assessmentSessionResult[0] || null;
      const interests = interestsResult[0] || null;

      // Matching readiness
      const blockers: string[] = [];
      if (!user.hasCompletedPersonalityTest) blockers.push('人格测试未完成');
      if (!user.archetype) blockers.push('原型未确定');
      if (!profileEssentialComplete) blockers.push('基本资料不完整');
      if (!user.hasCompletedInterestsCarousel) blockers.push('兴趣数据未完成');
      if (user.isBanned) blockers.push('用户已被封禁');
      const matchingReadiness = { isReady: blockers.length === 0, blockers };

      // Strip sensitive credential fields before sending to browser
      const { password, wechatSessionKey, wechatOpenId, ...safeUser } = user as any;
      res.json({
        user: { ...safeUser, profileCompleteness },
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

      await db.transaction(async (tx: any) => {
        // Delete user's own data from all child tables
        await tx.execute(sql`DELETE FROM event_attendance WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM event_pool_registrations WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM chat_messages WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM event_feedback WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM blind_box_events WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM test_responses WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM role_results WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM subscriptions WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM payments WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM coupon_usage WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM user_coupons WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM event_credit_grants WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM event_credit_redemptions WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM notifications WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM xp_transactions WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM user_engagement_metrics WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM assessment_answers WHERE session_id IN (SELECT id FROM assessment_sessions WHERE user_id = ${userId})`);
        await tx.execute(sql`DELETE FROM assessment_sessions WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM blind_box_pre_attendance WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM referral_codes WHERE user_id = ${userId}`);

        // Tables with multi-column user references
        await tx.execute(sql`DELETE FROM match_history WHERE user1_id = ${userId} OR user2_id = ${userId}`);
        await tx.execute(sql`DELETE FROM connections WHERE user_a_id = ${userId} OR user_b_id = ${userId}`);
        await tx.execute(sql`DELETE FROM invitations WHERE inviter_id = ${userId}`);
        await tx.execute(sql`DELETE FROM invitation_uses WHERE invitee_id = ${userId}`);
        await tx.execute(sql`DELETE FROM referral_conversions WHERE invited_user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM reunion_responses WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM reunion_requests WHERE initiator_id = ${userId}`);
        await tx.execute(sql`DELETE FROM reports WHERE reporter_id = ${userId}`);
        await tx.execute(sql`DELETE FROM chat_reports WHERE reported_by = ${userId}`);

        // Social icebreaker tables (no FK but store user_id)
        await tx.execute(sql`DELETE FROM social_icebreaker_participants WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM social_icebreaker_lie_truths WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM social_icebreaker_ai_feedback WHERE submitted_by = ${userId}`);
        await tx.execute(sql`DELETE FROM social_icebreaker_sessions WHERE host_user_id = ${userId}`);

        // Phase-level social tables
        await tx.execute(sql`DELETE FROM social_icebreaker_phase_pulse_checks WHERE user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM moment_card_interactions WHERE user_id = ${userId}`);

        // Dialogue / AI tables
        await tx.execute(sql`DELETE FROM golden_dialogues WHERE source_user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM dialogue_embeddings WHERE source_user_id = ${userId}`);
        await tx.execute(sql`DELETE FROM industry_ai_logs WHERE user_id = ${userId}`);

        // Nullify admin / reviewer / host references where this user was acting in a staff role
        await tx.execute(sql`UPDATE events SET host_id = NULL WHERE host_id = ${userId}`);
        await tx.execute(sql`UPDATE reports SET reviewed_by = NULL WHERE reviewed_by = ${userId}`);
        await tx.execute(sql`UPDATE reports SET reported_user_id = NULL WHERE reported_user_id = ${userId}`);
        await tx.execute(sql`UPDATE moderation_logs SET admin_id = NULL WHERE admin_id = ${userId}`);
        await tx.execute(sql`UPDATE moderation_logs SET target_user_id = NULL WHERE target_user_id = ${userId}`);
        await tx.execute(sql`UPDATE chat_reports SET reviewed_by = NULL WHERE reviewed_by = ${userId}`);
        await tx.execute(sql`UPDATE chat_reports SET reported_user_id = NULL WHERE reported_user_id = ${userId}`);
        await tx.execute(sql`UPDATE notifications SET sent_by = NULL WHERE sent_by = ${userId}`);
        await tx.execute(sql`UPDATE golden_dialogues SET tagged_by_admin_id = NULL WHERE tagged_by_admin_id = ${userId}`);

        // SET NULL tables
        await tx.execute(sql`UPDATE participation_experiment_events SET user_id = NULL WHERE user_id = ${userId}`);
        await tx.execute(sql`UPDATE discover_analytics_events SET user_id = NULL WHERE user_id = ${userId}`);

        // Finally delete the user (CASCADE handles user_interests, user_semantic_profiles, etc.)
        await tx.execute(sql`DELETE FROM users WHERE id = ${userId}`);
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
