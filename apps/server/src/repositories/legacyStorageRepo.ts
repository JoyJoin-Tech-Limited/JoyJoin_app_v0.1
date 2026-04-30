import { 
  type User, type UpsertUser, type UpdateProfile, type UpdateFullProfile, type UpdatePersonality,
  type Event, type EventAttendance, type ChatMessage, type EventFeedback, type BlindBoxEvent,
  type InsertEventAttendance, type InsertChatMessage, type InsertEventFeedback,
  type RegisterUser, type InsertTestResponse, type InsertRoleResult, type RoleResult, type InterestsTopics,
  type Notification, type InsertNotification, type NotificationCounts,
  type Content, type InsertContent,
  type ChatReport, type InsertChatReport, type ChatLog, type InsertChatLog,
  type PricingSetting, type PromotionBanner,
  type VenueTimeSlot, type InsertVenueTimeSlot, type VenueTimeSlotBooking, type InsertVenueTimeSlotBooking,
  type IcebreakerSession, type IcebreakerCheckin, type IcebreakerReadyVote, type IcebreakerActivityLog,
  type InsertIcebreakerSession, type InsertIcebreakerCheckin, type InsertIcebreakerReadyVote, type InsertIcebreakerActivityLog,
  type RegistrationSession,
  type PreSignupData,
  type UserSocialTagGeneration,
  type AdminAccount,
  type UserInterestSignal,
  users, events, eventAttendance, chatMessages, eventFeedback, blindBoxEvents, testResponses, roleResults, notifications,
  payments, coupons, couponUsage, subscriptions, contents, chatReports, chatLogs,
  pricingSettings, promotionBanners, eventPools, eventPoolGroups, venueTimeSlots, venueTimeSlotBookings, venues, venueDeals, eventTemplates,
  icebreakerSessions, icebreakerCheckins, icebreakerReadyVotes, icebreakerActivityLogs, registrationSessions, preSignupData,
  assessmentSessions, assessmentAnswers, userSocialTagGenerations, connections,
  adminAccounts,
  userInterestSignals,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, sql, or, gte, lte } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";
import { logAdminAudit } from "../lib/adminAuditLogger";

/**
 * @deprecated Compatibility facade — do not add new query logic here.
 *
 * `LegacyStorage` is a transitional compatibility layer that predates the focused
 * repository pattern. New code should use domain-specific repositories under
 * `apps/server/src/repositories/` instead:
 *
 * - `usersRepo.ts`          — user queries
 * - `paymentsRepo.ts`       — payment records
 * - `assessmentRepo.ts`     — assessment sessions
 * - `eventPoolsRepo.ts`     — event pools
 * - `icebreakerRepo.ts`     — icebreaker sessions
 * - `notificationsRepo.ts`  — notifications
 * - `eventGroupOutcomesRepo.ts` — group outcomes
 * - `onboardingRepo.ts`     — onboarding state
 * - `eventCreditsRepo.ts`   — event credits
 * - `paymentFulfillmentRepo.ts` — payment fulfillment
 * - `adminOutcomeAnalyticsRepo.ts` — admin analytics
 * - `matchingShadowExperimentsRepo.ts` — shadow experiments
 * - `socialIcebreakerAiFeedbackRepo.ts` — AI feedback
 * - `archetypePairFeedbackStatsRepo.ts` — archetype feedback
 * - `userSemanticProfilesRepo.ts` — semantic profiles
 *
 * Migration is in progress. When adding new persistence logic, prefer creating
 * a new focused repository over extending this interface.
 */
export interface LegacyStorage {
  
  
  
  
  // Event operations
  getUserJoinedEvents(userId: string): Promise<Array<Event & { attendanceStatus: string; attendeeCount: number; participants: Array<{ id: string; displayName: string | null; archetype: string | null }> }>>;
  getEventParticipants(eventId: string): Promise<Array<User>>;
  
  // Chat operations
  getEventMessages(eventId: string): Promise<Array<ChatMessage & { user: User }>>;
  createChatMessage(userId: string, message: InsertChatMessage): Promise<ChatMessage>;
  
  // Feedback operations
  getUserAllFeedbacks(userId: string): Promise<Array<EventFeedback>>;
  getUserFeedback(userId: string, eventId: string): Promise<EventFeedback | undefined>;
  createEventFeedback(userId: string, feedback: InsertEventFeedback): Promise<EventFeedback>;
  updateEventFeedbackDeep(userId: string, eventId: string, deepData: Record<string, any>): Promise<EventFeedback>;

  // Connection operations (WeChat ID exchange)
  upsertConnection(eventId: string, currentUserId: string, targetUserId: string): Promise<any>;
  getMutualConnections(eventId: string, userId: string): Promise<any[]>;
  updateUserWechatId(userId: string, wechatContactId: string): Promise<void>;

  



  


  


  // Admin Event Template operations
  getAllEventTemplates(): Promise<any[]>;
  createEventTemplate(data: any): Promise<any>;
  updateEventTemplate(id: string, updates: any): Promise<any>;

  // Admin Finance operations
  getFinanceStats(): Promise<any>;
  getVenueCommissions(): Promise<any[]>;


  // Admin Insights operations
  getInsightsData(): Promise<any>;

  // Admin Feedback operations
  getAllFeedbacks(filters?: {
    eventId?: string;
    minRating?: number;
    maxRating?: number;
    startDate?: Date;
    endDate?: Date;
    hasDeepFeedback?: boolean;
  }): Promise<Array<EventFeedback & { user: { displayName: string | null; phoneNumber: string | null }; event: { title: string; dateTime: Date; status: string | null } }>>;
  getFeedbackById(id: string): Promise<(EventFeedback & { user: User; event: Event }) | undefined>;
  getFeedbackStats(): Promise<{
    totalFeedbacks: number;
    avgAtmosphereScore: number;
    lowRatedCount: number;
    deepFeedbackRate: number;
    topImprovementAreas: Array<{ area: string; count: number }>;
    connectionStatusBreakdown: Record<string, number>;
  }>;


  // Interaction Log operations
  createInteractionLog(data: InsertChatLog): Promise<ChatLog>;
  getInteractionLogs(filters?: { eventId?: string; userId?: string; severity?: string; startDate?: Date; endDate?: Date }): Promise<ChatLog[]>;
  getInteractionLogStats(): Promise<{ total: number; errors: number; warnings: number; info: number }>;

  // Admin Content Management operations
  getAllContents(type?: string): Promise<any[]>;
  getContent(id: string): Promise<any | undefined>;
  createContent(data: any): Promise<any>;
  updateContent(id: string, updates: any): Promise<any>;
  deleteContent(id: string): Promise<void>;
  getPublishedContents(type: string): Promise<any[]>;




  
  
  
  


  // V4 Adaptive Assessment operations
  createAssessmentSession(data: { 
    userId?: string; 
    phase?: string;
    preSignupAnswers?: any;
  }): Promise<any>;
  getAssessmentSession(id: string): Promise<any | undefined>;
  getAssessmentSessionByUser(userId: string): Promise<any | undefined>;
  getLatestCompletedAssessmentSessionByUser(userId: string): Promise<any | undefined>;
  updateAssessmentSession(id: string, updates: Partial<{
    userId: string;
    phase: string;
    currentQuestionIndex: number;
    traitScores: any;
    traitConfidences: any;
    topArchetypes: any;
    preSignupAnswers: any;
    finalResult: any;
    primaryArchetype: string;
    isDecisive: boolean;
    completedAt: Date;
    skipCount: number;
    skippedQuestionIds: string[];
    answeredQuestionIds: string[];
  }>): Promise<any>;
  createAssessmentAnswer(data: {
    sessionId: string;
    questionId: string;
    questionLevel: number;
    selectedOption: string;
    traitScores: any;
  }): Promise<any>;
  getAssessmentAnswers(sessionId: string): Promise<any[]>;
  



  // Interest Signal Boost
  upsertInterestSignal(userId: string, data: {
    interestKey: string;
    interestLabel: string;
    enthusiasmLevel: number;
    discussionStyle: string;
    conversationDepth: number;
  }): Promise<UserInterestSignal>;
  getUserInterestSignals(userId: string): Promise<UserInterestSignal[]>;
}

export class LegacyStorageRepo implements LegacyStorage {
  // Pre-signup cache

  // User operations

  // Social tag operations

  // Event operations
  async getUserJoinedEvents(userId: string): Promise<Array<Event & { attendanceStatus: string; attendeeCount: number; participants: Array<{ id: string; displayName: string | null; archetype: string | null }> }>> {
    const result = await db
      .select({
        event: events,
        attendanceStatus: eventAttendance.status,
        attendeeCount: sql<number>`(SELECT COUNT(*) FROM ${eventAttendance} WHERE ${eventAttendance.eventId} = ${events.id} AND ${eventAttendance.status} = 'confirmed')`,
      })
      .from(eventAttendance)
      .innerJoin(events, eq(eventAttendance.eventId, events.id))
      .where(eq(eventAttendance.userId, userId))
      .orderBy(desc(events.dateTime));

    // Get participants for each event
    const eventsWithParticipants = await Promise.all(
      result.map(async (r: { event: Event; attendanceStatus: string | null; attendeeCount: number }) => {
        const participants = await db
          .select({
            id: users.id,
            displayName: users.displayName,
            archetype: users.archetype,
          })
          .from(eventAttendance)
          .innerJoin(users, eq(eventAttendance.userId, users.id))
          .where(
            and(
              eq(eventAttendance.eventId, r.event.id),
              eq(eventAttendance.status, 'confirmed')
            )
          )

        return {
          ...r.event,
          attendanceStatus: r.attendanceStatus || 'confirmed',
          attendeeCount: Number(r.attendeeCount) || 0,
          participants: participants,
        };
      })
    );

    return eventsWithParticipants;
  }

  async getEventParticipants(eventId: string): Promise<Array<User>> {
    const result = await db
      .select({ user: users })
      .from(eventAttendance)
      .innerJoin(users, eq(eventAttendance.userId, users.id))
      .where(
        and(
          eq(eventAttendance.eventId, eventId),
          eq(eventAttendance.status, 'confirmed')
        )
      );

    return result.map((r: { user: User }) => r.user);
  }

  // Chat operations
  async getEventMessages(eventId: string): Promise<Array<ChatMessage & { user: User }>> {
    const result = await db
      .select({
        message: chatMessages,
        user: users,
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.userId, users.id))
      .where(eq(chatMessages.eventId, eventId))
      .orderBy(chatMessages.createdAt);

    return result.map((r: { message: ChatMessage; user: User }) => ({
      ...r.message,
      user: r.user,
    }));
  }

  async createChatMessage(userId: string, message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db
      .insert(chatMessages)
      .values({
        ...message,
        userId,
      })
      .returning();
    return newMessage;
  }

  // Feedback operations
  async getUserAllFeedbacks(userId: string): Promise<Array<EventFeedback>> {
    const feedbacks = await db
      .select()
      .from(eventFeedback)
      .where(eq(eventFeedback.userId, userId))
      .orderBy(desc(eventFeedback.createdAt));
    return feedbacks;
  }

  async getUserFeedback(userId: string, eventId: string): Promise<EventFeedback | undefined> {
    const [feedback] = await db
      .select()
      .from(eventFeedback)
      .where(
        and(
          eq(eventFeedback.userId, userId),
          eq(eventFeedback.eventId, eventId)
        )
      );
    return feedback;
  }

  async createEventFeedback(userId: string, feedback: InsertEventFeedback): Promise<EventFeedback> {
    const [newFeedback] = await db
      .insert(eventFeedback)
      .values({
        ...feedback,
        userId,
        completedAt: new Date(),
      })
      .returning();
    return newFeedback;
  }

  async updateEventFeedbackDeep(userId: string, eventId: string, deepData: Record<string, any>): Promise<EventFeedback> {
    const [updatedFeedback] = await db
      .update(eventFeedback)
      .set(deepData)
      .where(
        and(
          eq(eventFeedback.userId, userId),
          eq(eventFeedback.eventId, eventId)
        )
      )
      .returning();
    return updatedFeedback;
  }

  // Connection operations (WeChat ID exchange)
  async upsertConnection(eventId: string, currentUserId: string, targetUserId: string): Promise<any> {
    // Determine canonical ordering: userAId < userBId alphabetically for dedup
    const [canonA, canonB] = currentUserId < targetUserId
      ? [currentUserId, targetUserId]
      : [targetUserId, currentUserId];

    // Atomic insert — if a concurrent request beat us, ON CONFLICT DO NOTHING keeps the original row intact.
    await db
      .insert(connections)
      .values({
        eventId,
        userAId: canonA,
        userBId: canonB,
        status: "pending",
        initiatorId: currentUserId,
      })
      .onConflictDoNothing();

    // Re-fetch the authoritative row (whether we just inserted or it already existed)
    const [row] = await db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.eventId, eventId),
          eq(connections.userAId, canonA),
          eq(connections.userBId, canonB)
        )
      );

    if (!row) {
      // This should never happen after the atomic insert above, but fail fast if it does
      throw new Error(`[Connections] Row not found after insert for event=${eventId} userA=${canonA} userB=${canonB}`);
    }

    // If the row is already mutual, nothing more to do
    if (row.status === "mutual") return row;

    // Flip to mutual only when the OTHER user is calling (i.e. the initiator is NOT currentUserId).
    // If the initiator IS currentUserId it means the same user re-submitted — keep it pending.
    if (row.initiatorId !== currentUserId) {
      // Fetch both users' wechat IDs in parallel for snapshot
      const [userARows, userBRows] = await Promise.all([
        db.select({ wechatContactId: users.wechatContactId }).from(users).where(eq(users.id, canonA)),
        db.select({ wechatContactId: users.wechatContactId }).from(users).where(eq(users.id, canonB)),
      ]);
      const [userARecord] = userARows;
      const [userBRecord] = userBRows;

      // Drizzle .returning() returns an array; destructuring gives the first row or undefined
      const [updated] = await db
        .update(connections)
        .set({
          status: "mutual",
          userAWechatId: userARecord?.wechatContactId ?? null,
          userBWechatId: userBRecord?.wechatContactId ?? null,
          revealedAt: new Date(),
        })
        .where(
          and(
            eq(connections.id, row.id),
            eq(connections.status, "pending") // guard against a concurrent mutual update
          )
        )
        .returning();
      // If the WHERE condition didn't match (concurrent update already set mutual), re-return the row we fetched
      return updated ?? row;
    }

    return row;
  }

  async getMutualConnections(eventId: string, userId: string): Promise<any[]> {
    return db
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.eventId, eventId),
          eq(connections.status, "mutual"),
          sql`(${connections.userAId} = ${userId} OR ${connections.userBId} = ${userId})`
        )
      );
  }

  async updateUserWechatId(userId: string, wechatContactId: string): Promise<void> {
    await db
      .update(users)
      .set({
        wechatContactId,
        wechatContactIdSetAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Blind Box Event operations

  // Notification operations

  // Admin Notification operations

  // Admin Subscription operations

  // Admin Coupon operations

  // ============ USER COUPONS ============

  // ============ PAYMENTS ============

  // ============ VENUES ============

  // ============ VENUE DEALS (场地优惠) ============

  // ============ VENUE BOOKINGS ============

  // ============ EVENT TEMPLATES ============
  async getAllEventTemplates(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT * FROM event_templates
      ORDER BY day_of_week, time_of_day
    `);
    return result.rows;
  }

  async createEventTemplate(data: any): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO event_templates (name, event_type, day_of_week, time_of_day, theme, gender_restriction, min_age, max_age, min_participants, max_participants, custom_price, is_active)
      VALUES (${data.name}, ${data.eventType}, ${data.dayOfWeek}, ${data.timeOfDay}, ${data.theme || null}, ${data.genderRestriction || null}, ${data.minAge || null}, ${data.maxAge || null}, ${data.minParticipants || 5}, ${data.maxParticipants || 10}, ${data.customPrice || null}, ${data.isActive !== false})
      RETURNING *
    `);
    return result.rows[0];
  }

  async updateEventTemplate(id: string, updates: any): Promise<any> {
    const setData: any = {};
    if (updates.name !== undefined) setData.name = updates.name;
    if (updates.eventType !== undefined) setData.eventType = updates.eventType;
    if (updates.dayOfWeek !== undefined) setData.dayOfWeek = updates.dayOfWeek;
    if (updates.timeOfDay !== undefined) setData.timeOfDay = updates.timeOfDay;
    if (updates.theme !== undefined) setData.theme = updates.theme;
    if (updates.genderRestriction !== undefined) setData.genderRestriction = updates.genderRestriction;
    if (updates.minAge !== undefined) setData.minAge = updates.minAge;
    if (updates.maxAge !== undefined) setData.maxAge = updates.maxAge;
    if (updates.minParticipants !== undefined) setData.minParticipants = updates.minParticipants;
    if (updates.maxParticipants !== undefined) setData.maxParticipants = updates.maxParticipants;
    if (updates.customPrice !== undefined) setData.customPrice = updates.customPrice;
    if (updates.isActive !== undefined) setData.isActive = updates.isActive;

    if (Object.keys(setData).length === 0) {
      const [template] = await db.select().from(eventTemplates).where(eq(eventTemplates.id, id));
    return template;
    }

    const [result] = await db.update(eventTemplates)
      .set(setData)
      .where(eq(eventTemplates.id, id))
      .returning();
    return result;
  }

  async deleteEventTemplate(id: string): Promise<void> {
    await db.execute(sql`DELETE FROM event_templates WHERE id = ${id}`);
  }

  // ============ EVENT MANAGEMENT (Admin view of user events) ============

  // ============ FINANCE MANAGEMENT ============
  async getFinanceStats(): Promise<any> {
    // Total revenue from all payments
    const totalRevenue = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0)::int as total FROM payments WHERE status = 'completed'
    `);
    
    // Subscription revenue
    const subscriptionRevenue = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0)::int as total FROM payments 
      WHERE payment_type = 'subscription' AND status = 'completed'
    `);
    
    // Event revenue
    const eventRevenue = await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0)::int as total FROM payments 
      WHERE payment_type = 'event' AND status = 'completed'
    `);
    
    // Total payments count
    const totalPayments = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM payments
    `);

    return {
      totalRevenue: totalRevenue.rows[0].total,
      subscriptionRevenue: subscriptionRevenue.rows[0].total,
      eventRevenue: eventRevenue.rows[0].total,
      totalPayments: totalPayments.rows[0].count,
    };
  }

  async getVenueCommissions(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        v.id,
        v.name as venue_name,
        v.commission_rate,
        COUNT(vb.id)::int as booking_count,
        COALESCE(SUM(vb.final_amount), 0)::int as total_revenue,
        COALESCE(SUM(vb.commission_amount), 0)::int as total_commission
      FROM venues v
      LEFT JOIN venue_bookings vb ON v.id = vb.venue_id
      GROUP BY v.id, v.name, v.commission_rate
      ORDER BY total_commission DESC
    `);
    return result.rows;
  }

  // ============ MODERATION ============

  // ============ DATA INSIGHTS ============
  async getInsightsData(): Promise<any> {
    // Basic engagement metrics
    const totalUsers = await db.execute(sql`SELECT COUNT(*)::int as count FROM users`);
    const activeUsers = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as count FROM blind_box_events 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    const totalEvents = await db.execute(sql`SELECT COUNT(*)::int as count FROM blind_box_events`);
    
    // New users last 7 days
    const newUsers7Days = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM users 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    
    // New users previous 7 days (for growth calculation)
    const newUsersPrevious7Days = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM users 
      WHERE created_at >= NOW() - INTERVAL '14 days' 
      AND created_at < NOW() - INTERVAL '7 days'
    `);
    
    // User growth (last 30 days)
    const userGrowth = await db.execute(sql`
      SELECT DATE(created_at) as date, COUNT(*)::int as count 
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Event trends (last 30 days)
    const eventTrends = await db.execute(sql`
      SELECT DATE(created_at) as date, COUNT(*)::int as count 
      FROM blind_box_events 
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Personality distribution
    const personalityDistribution = await db.execute(sql`
      SELECT archetype, COUNT(*)::int as count 
      FROM users 
      WHERE archetype IS NOT NULL
      GROUP BY archetype
      ORDER BY count DESC
    `);

    const avgEventsPerUser = (totalUsers.rows[0] as any).count > 0 
      ? (totalEvents.rows[0] as any).count / (totalUsers.rows[0] as any).count 
      : 0;

    // ============ 1. MATCHING EFFICIENCY ANALYSIS ============
    const matchedEvents = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM blind_box_events 
      WHERE status IN ('matched', 'completed')
    `);
    
    const matchingSuccessRate = (totalEvents.rows[0] as any).count > 0
      ? ((matchedEvents.rows[0] as any).count / (totalEvents.rows[0] as any).count) * 100
      : 0;
    
    // Average match time (in hours)
    const avgMatchTimeResult = await db.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)::float as avg_hours
      FROM blind_box_events
      WHERE status IN ('matched', 'completed') AND updated_at IS NOT NULL
    `);
    const avgMatchTime = avgMatchTimeResult.rows[0]?.avg_hours || 0;
    
    // Attempts per user (total events / total users)
    const attemptsPerUser = (totalUsers.rows[0] as any).count > 0
      ? (totalEvents.rows[0] as any).count / (totalUsers.rows[0] as any).count
      : 0;

    // ============ 2. USER RETENTION ANALYSIS ============
    
    // Weekly retention (weeks 1-8) — single batched query
    const retentionResult = await db.execute(sql`
      WITH cohort AS (
        SELECT DISTINCT user_id, DATE_TRUNC('week', created_at) as cohort_week
        FROM users
        WHERE created_at >= NOW() - INTERVAL '8 weeks'
      ),
      activity AS (
        SELECT DISTINCT user_id, DATE_TRUNC('week', created_at) as activity_week
        FROM blind_box_events
      ),
      weeks AS (SELECT generate_series(1, 8) as week_num)
      SELECT 
        w.week_num as week,
        COALESCE(
          COUNT(DISTINCT CASE WHEN a.activity_week = c.cohort_week + (w.week_num || ' weeks')::interval THEN c.user_id END)::float /
          NULLIF(COUNT(DISTINCT c.user_id), 0) * 100,
          0
        ) as retention_rate
      FROM weeks w
      CROSS JOIN cohort c
      LEFT JOIN activity a ON c.user_id = a.user_id
      WHERE c.cohort_week <= NOW() - (w.week_num || ' weeks')::interval
      GROUP BY w.week_num
      ORDER BY w.week_num
    `);
    const weeklyRetention = (retentionResult.rows as any[]).map(row => ({
      week: row.week,
      retentionRate: row.retention_rate || 0
    }));
    
    // User segments
    const newUsersSegment = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM users 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);
    
    const activeUsersSegment = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as count FROM blind_box_events 
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);
    
    const dormantUsers = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as count FROM blind_box_events 
      WHERE created_at >= NOW() - INTERVAL '90 days'
      AND created_at < NOW() - INTERVAL '30 days'
      AND user_id NOT IN (
        SELECT DISTINCT user_id FROM blind_box_events 
        WHERE created_at >= NOW() - INTERVAL '30 days'
      )
    `);
    
    const churnedUsers = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM users 
      WHERE id NOT IN (
        SELECT DISTINCT user_id FROM blind_box_events 
        WHERE created_at >= NOW() - INTERVAL '90 days'
      )
      AND created_at < NOW() - INTERVAL '90 days'
    `);
    
    // Super users (participated in 3+ events in last 30 days)
    const superUsersResult = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as count FROM (
        SELECT user_id, COUNT(*) as event_count
        FROM blind_box_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY user_id
        HAVING COUNT(*) >= 3
      ) super_user_counts
    `);
    
    const superUsersArchetypes = await db.execute(sql`
      SELECT u.archetype, COUNT(*)::int as count
      FROM (
        SELECT user_id, COUNT(*) as event_count
        FROM blind_box_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY user_id
        HAVING COUNT(*) >= 3
      ) su
      JOIN users u ON su.user_id = u.id
      WHERE u.archetype IS NOT NULL
      GROUP BY u.archetype
      ORDER BY count DESC
      LIMIT 3
    `);

    // ============ 3. EVENT QUALITY INDICATORS ============
    
    const completedEvents = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM blind_box_events 
      WHERE status = 'completed'
    `);
    
    const matchedOrCompletedEvents = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM blind_box_events 
      WHERE status IN ('matched', 'completed')
    `);
    
    const completionRate = (matchedOrCompletedEvents.rows[0] as any).count > 0
      ? ((completedEvents.rows[0] as any).count / (matchedOrCompletedEvents.rows[0] as any).count) * 100
      : 0;
    
    // Average rating from feedback
    const avgRatingResult = await db.execute(sql`
      SELECT AVG(rating)::float as avg_rating 
      FROM event_feedback 
      WHERE rating IS NOT NULL
    `);
    const avgRating = avgRatingResult.rows[0]?.avg_rating || 0;
    
    // Complaint rate (events with reports)
    const eventsWithReports = await db.execute(sql`
      SELECT COUNT(DISTINCT event_id)::int as count FROM chat_reports 
      WHERE event_id IS NOT NULL
    `);
    
    const complaintRate = (totalEvents.rows[0] as any).count > 0
      ? ((eventsWithReports.rows[0] as any).count / (totalEvents.rows[0] as any).count) * 100
      : 0;
    
    // Low-rated events (rating < 3.0)
    const lowRatedEvents = await db.execute(sql`
      SELECT 
        e.id as event_id,
        e.title,
        AVG(f.rating)::float as avg_rating,
        e.date_time as date
      FROM blind_box_events e
      JOIN event_feedback f ON e.id = f.event_id
      WHERE f.rating IS NOT NULL
      GROUP BY e.id, e.title, e.date_time
      HAVING AVG(f.rating) < 3.0
      ORDER BY avg_rating ASC
      LIMIT 10
    `);

    // ============ 4. MONETIZATION FUNNEL ============
    
    const paidUsers = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as count FROM payments 
      WHERE status = 'completed'
    `);
    
    const conversionRate = (totalUsers.rows[0] as any).count > 0
      ? ((paidUsers.rows[0] as any).count / (totalUsers.rows[0] as any).count) * 100
      : 0;
    
    // Revenue breakdown
    const subscriptionRevenue = await db.execute(sql`
      SELECT COALESCE(SUM(final_amount), 0)::int as total 
      FROM payments 
      WHERE payment_type = 'subscription' AND status = 'completed'
    `);
    
    const eventRevenue = await db.execute(sql`
      SELECT COALESCE(SUM(final_amount), 0)::int as total 
      FROM payments 
      WHERE payment_type = 'event' AND status = 'completed'
    `);
    
    const totalRevenue = (subscriptionRevenue.rows[0] as any).total + (eventRevenue.rows[0] as any).total;
    
    const arpu = (totalUsers.rows[0] as any).count > 0
      ? totalRevenue / (totalUsers.rows[0] as any).count
      : 0;
    
    // Conversion funnel
    const browsedEvents = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as count FROM blind_box_events
    `);
    
    const signedUpUsers = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int as count FROM blind_box_events
    `);
    
    // Monthly revenue (current month)
    const monthlyRevenue = await db.execute(sql`
      SELECT COALESCE(SUM(final_amount), 0)::int as total 
      FROM payments 
      WHERE status = 'completed' 
      AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
    `);

    return {
      engagementMetrics: {
        totalUsers: totalUsers.rows[0].count,
        activeUsers: activeUsers.rows[0].count,
        totalEvents: totalEvents.rows[0].count,
        avgEventsPerUser,
        newUsers7Days: newUsers7Days.rows[0].count,
        newUsersPrevious7Days: newUsersPrevious7Days.rows[0].count,
      },
      userGrowth: userGrowth.rows,
      eventTrends: eventTrends.rows,
      personalityDistribution: personalityDistribution.rows,
      
      // New analytics
      matchingEfficiency: {
        successRate: matchingSuccessRate,
        avgMatchTime: avgMatchTime,
        attemptsPerUser: attemptsPerUser,
      },
      
      retention: {
        weeklyRetention: weeklyRetention,
        userSegments: {
          new: newUsersSegment.rows[0].count,
          active: activeUsersSegment.rows[0].count,
          dormant: dormantUsers.rows[0].count,
          churned: churnedUsers.rows[0].count,
        },
        superUsers: {
          count: superUsersResult.rows[0].count,
          topArchetypes: superUsersArchetypes.rows,
        },
      },
      
      eventQuality: {
        completionRate: completionRate,
        avgRating: avgRating,
        complaintRate: complaintRate,
        lowRatedEvents: lowRatedEvents.rows,
      },
      
      monetization: {
        conversionRate: conversionRate,
        revenueBreakdown: {
          subscription: subscriptionRevenue.rows[0].total,
          singleEvent: eventRevenue.rows[0].total,
        },
        arpu: arpu,
        conversionFunnel: {
          registered: totalUsers.rows[0].count,
          browsedEvents: browsedEvents.rows[0].count,
          signedUp: signedUpUsers.rows[0].count,
          paid: paidUsers.rows[0].count,
        },
        monthlyRevenue: monthlyRevenue.rows[0].total,
      },
    };
  }

  // ============ CONTENT MANAGEMENT OPERATIONS ============

  async getAllContents(type?: string): Promise<any[]> {
    if (type) {
      return await db.select().from(contents).where(eq(contents.type, type)).orderBy(desc(contents.priority), desc(contents.createdAt));
    }
    return await db.select().from(contents).orderBy(desc(contents.createdAt));
  }

  async getContent(id: string): Promise<any | undefined> {
    const [content] = await db.select().from(contents).where(eq(contents.id, id));
    return content;
  }

  async createContent(data: InsertContent): Promise<Content> {
    const [content] = await db.insert(contents).values(data).returning();
    return content;
  }

  async updateContent(id: string, updates: Partial<Content>): Promise<Content> {
    const [content] = await db
      .update(contents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contents.id, id))
      .returning();
    return content;
  }

  async deleteContent(id: string): Promise<void> {
    await db.delete(contents).where(eq(contents.id, id));
  }

  async getPublishedContents(type: string): Promise<any[]> {
    return await db
      .select()
      .from(contents)
      .where(and(
        eq(contents.type, type),
        eq(contents.status, 'published')
      ))
      .orderBy(desc(contents.priority), desc(contents.publishedAt));
  }

  // ============ MATCHING ALGORITHM OPERATIONS ============

  // ============ ADMIN FEEDBACK OPERATIONS ============
  async getAllFeedbacks(filters?: {
    eventId?: string;
    minRating?: number;
    maxRating?: number;
    startDate?: Date;
    endDate?: Date;
    hasDeepFeedback?: boolean;
  }): Promise<Array<EventFeedback & { user: { displayName: string | null; phoneNumber: string | null }; event: { title: string; dateTime: Date; status: string | null } }>> {
    const conditions = [];
    
    if (filters?.eventId) {
      conditions.push(eq(eventFeedback.eventId, filters.eventId));
    }
    
    if (filters?.minRating !== undefined) {
      conditions.push(gte(eventFeedback.atmosphereScore, filters.minRating));
    }
    
    if (filters?.maxRating !== undefined) {
      conditions.push(lte(eventFeedback.atmosphereScore, filters.maxRating));
    }
    
    if (filters?.startDate) {
      conditions.push(gte(eventFeedback.createdAt, filters.startDate));
    }
    
    if (filters?.endDate) {
      conditions.push(lte(eventFeedback.createdAt, filters.endDate));
    }
    
    if (filters?.hasDeepFeedback !== undefined) {
      conditions.push(eq(eventFeedback.hasDeepFeedback, filters.hasDeepFeedback));
    }

    const baseQuery = db
      .select({
        id: eventFeedback.id,
        eventId: eventFeedback.eventId,
        userId: eventFeedback.userId,
        rating: eventFeedback.rating,
        vibeMatch: eventFeedback.vibeMatch,
        energyMatch: eventFeedback.energyMatch,
        wouldAttendAgain: eventFeedback.wouldAttendAgain,
        feedback: eventFeedback.feedback,
        connections: eventFeedback.connections,
        atmosphereScore: eventFeedback.atmosphereScore,
        atmosphereNote: eventFeedback.atmosphereNote,
        attendeeTraits: eventFeedback.attendeeTraits,
        connectionRadar: eventFeedback.connectionRadar,
        hasNewConnections: eventFeedback.hasNewConnections,
        connectionStatus: eventFeedback.connectionStatus,
        improvementAreas: eventFeedback.improvementAreas,
        improvementOther: eventFeedback.improvementOther,
        completedAt: eventFeedback.completedAt,
        rewardsClaimed: eventFeedback.rewardsClaimed,
        rewardPoints: eventFeedback.rewardPoints,
        hasDeepFeedback: eventFeedback.hasDeepFeedback,
        matchPointValidation: eventFeedback.matchPointValidation,
        additionalMatchPoints: eventFeedback.additionalMatchPoints,
        conversationBalance: eventFeedback.conversationBalance,
        conversationComfort: eventFeedback.conversationComfort,
        conversationNotes: eventFeedback.conversationNotes,
        futurePreferences: eventFeedback.futurePreferences,
        futurePreferencesOther: eventFeedback.futurePreferencesOther,
        deepFeedbackCompletedAt: eventFeedback.deepFeedbackCompletedAt,
        createdAt: eventFeedback.createdAt,
        user: {
          displayName: users.displayName,
          phoneNumber: users.phoneNumber,
        },
        event: {
          title: events.title,
          dateTime: events.dateTime,
          status: events.status,
        },
      })
      .from(eventFeedback)
      .leftJoin(users, eq(eventFeedback.userId, users.id))
      .leftJoin(events, eq(eventFeedback.eventId, events.id));

    const results = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(desc(eventFeedback.createdAt))
      : await baseQuery.orderBy(desc(eventFeedback.createdAt));

    return results as any;
  }

  async getFeedbackById(id: string): Promise<(EventFeedback & { user: User; event: Event }) | undefined> {
    const [result] = await db
      .select({
        id: eventFeedback.id,
        eventId: eventFeedback.eventId,
        userId: eventFeedback.userId,
        rating: eventFeedback.rating,
        vibeMatch: eventFeedback.vibeMatch,
        energyMatch: eventFeedback.energyMatch,
        wouldAttendAgain: eventFeedback.wouldAttendAgain,
        feedback: eventFeedback.feedback,
        connections: eventFeedback.connections,
        atmosphereScore: eventFeedback.atmosphereScore,
        atmosphereNote: eventFeedback.atmosphereNote,
        attendeeTraits: eventFeedback.attendeeTraits,
        connectionRadar: eventFeedback.connectionRadar,
        hasNewConnections: eventFeedback.hasNewConnections,
        connectionStatus: eventFeedback.connectionStatus,
        improvementAreas: eventFeedback.improvementAreas,
        improvementOther: eventFeedback.improvementOther,
        completedAt: eventFeedback.completedAt,
        rewardsClaimed: eventFeedback.rewardsClaimed,
        rewardPoints: eventFeedback.rewardPoints,
        hasDeepFeedback: eventFeedback.hasDeepFeedback,
        matchPointValidation: eventFeedback.matchPointValidation,
        additionalMatchPoints: eventFeedback.additionalMatchPoints,
        conversationBalance: eventFeedback.conversationBalance,
        conversationComfort: eventFeedback.conversationComfort,
        conversationNotes: eventFeedback.conversationNotes,
        futurePreferences: eventFeedback.futurePreferences,
        futurePreferencesOther: eventFeedback.futurePreferencesOther,
        deepFeedbackCompletedAt: eventFeedback.deepFeedbackCompletedAt,
        createdAt: eventFeedback.createdAt,
        user: users,
        event: events,
      })
      .from(eventFeedback)
      .leftJoin(users, eq(eventFeedback.userId, users.id))
      .leftJoin(events, eq(eventFeedback.eventId, events.id))
      .where(eq(eventFeedback.id, id));

    return result as any;
  }

  async getFeedbackStats(): Promise<{
    totalFeedbacks: number;
    avgAtmosphereScore: number;
    lowRatedCount: number;
    deepFeedbackRate: number;
    topImprovementAreas: Array<{ area: string; count: number }>;
    connectionStatusBreakdown: Record<string, number>;
  }> {
    // Get total count and average atmosphere score
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*)::int as total_feedbacks,
        AVG(atmosphere_score)::float as avg_atmosphere_score,
        COUNT(CASE WHEN atmosphere_score < 3 THEN 1 END)::int as low_rated_count,
        COUNT(CASE WHEN has_deep_feedback = true THEN 1 END)::int as deep_feedback_count
      FROM event_feedback
    `);
    
    const stats = statsResult.rows[0] as any;
    const totalFeedbacks = stats.total_feedbacks || 0;
    const avgAtmosphereScore = stats.avg_atmosphere_score || 0;
    const lowRatedCount = stats.low_rated_count || 0;
    const deepFeedbackCount = stats.deep_feedback_count || 0;
    const deepFeedbackRate = totalFeedbacks > 0 ? (deepFeedbackCount / totalFeedbacks) * 100 : 0;

    // Get top improvement areas
    const improvementAreasResult = await db.execute(sql`
      SELECT area, COUNT(*)::int as count
      FROM event_feedback, unnest(improvement_areas) as area
      WHERE improvement_areas IS NOT NULL
      GROUP BY area
      ORDER BY count DESC
      LIMIT 5
    `);
    
    const topImprovementAreas = improvementAreasResult.rows.map((row: any) => ({
      area: row.area,
      count: row.count,
    }));

    // Get connection status breakdown
    const connectionStatusResult = await db.execute(sql`
      SELECT 
        connection_status,
        COUNT(*)::int as count
      FROM event_feedback
      WHERE connection_status IS NOT NULL
      GROUP BY connection_status
    `);

    const connectionStatusBreakdown: Record<string, number> = {};
    connectionStatusResult.rows.forEach((row: any) => {
      connectionStatusBreakdown[row.connection_status] = row.count;
    });

    return {
      totalFeedbacks,
      avgAtmosphereScore: Math.round(avgAtmosphereScore * 10) / 10,
      lowRatedCount,
      deepFeedbackRate: Math.round(deepFeedbackRate * 10) / 10,
      topImprovementAreas,
      connectionStatusBreakdown,
    };
  }

  // ============ CHAT REPORT OPERATIONS ============

  // ============ INTERACTION LOG OPERATIONS ============

  async createInteractionLog(data: InsertChatLog): Promise<ChatLog> {
    const [log] = await db.insert(chatLogs).values(data).returning();
    return log;
  }

  async getInteractionLogs(filters?: { eventId?: string; userId?: string; severity?: string; startDate?: Date; endDate?: Date }): Promise<ChatLog[]> {
    const conditions = [];

    if (filters?.eventId) {
      conditions.push(eq(chatLogs.eventId, filters.eventId));
    }
    if (filters?.userId) {
      conditions.push(eq(chatLogs.userId, filters.userId));
    }
    if (filters?.severity) {
      conditions.push(eq(chatLogs.severity, filters.severity));
    }
    if (filters?.startDate) {
      conditions.push(gte(chatLogs.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(chatLogs.createdAt, filters.endDate));
    }

    return await db
      .select()
      .from(chatLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(chatLogs.createdAt));
  }

  async getInteractionLogStats(): Promise<{ total: number; errors: number; warnings: number; info: number }> {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN severity = 'error' THEN 1 ELSE 0 END) as errors,
        SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warnings,
        SUM(CASE WHEN severity = 'info' THEN 1 ELSE 0 END) as info
      FROM chat_logs
    `);

    const row: any = result.rows[0];
    return {
      total: parseInt(row.total) || 0,
      errors: parseInt(row.errors) || 0,
      warnings: parseInt(row.warnings) || 0,
      info: parseInt(row.info) || 0,
    };
  }

  // ============ PRICING SETTINGS OPERATIONS ============

  // ============ PROMOTION BANNERS ============

  // ============ PUBLIC STATS ============

  // ============ VENUE TIME SLOTS ============

  // ============ Icebreaker Session operations ============

  // ============ Icebreaker Checkin operations ============

  // ============ Icebreaker Ready Vote operations ============

  // ============ Icebreaker Activity Log operations ============

  // ============ Registration Session Telemetry operations ============

  // V4 Adaptive Assessment operations
  async createAssessmentSession(data: { 
    userId?: string; 
    phase?: string;
    preSignupAnswers?: any;
  }): Promise<any> {
    const [session] = await db
      .insert(assessmentSessions)
      .values({
        userId: data.userId || null,
        phase: data.phase || 'pre_signup',
        preSignupData: data.preSignupAnswers || null,
        currentQuestionIndex: 0,
      })
      .returning();
    return session;
  }

  async getAssessmentSession(id: string): Promise<any | undefined> {
    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(eq(assessmentSessions.id, id));
    return session;
  }

  async getAssessmentSessionByUser(userId: string): Promise<any | undefined> {
    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(and(
        eq(assessmentSessions.userId, userId),
        sql`${assessmentSessions.completedAt} IS NULL`
      ))
      .orderBy(desc(assessmentSessions.createdAt))
      .limit(1);
    return session;
  }

  async getLatestCompletedAssessmentSessionByUser(userId: string): Promise<any | undefined> {
    const [session] = await db
      .select()
      .from(assessmentSessions)
      .where(and(
        eq(assessmentSessions.userId, userId),
        sql`${assessmentSessions.completedAt} IS NOT NULL`
      ))
      .orderBy(desc(assessmentSessions.createdAt))
      .limit(1);
    return session;
  }

  async updateAssessmentSession(id: string, updates: Partial<{
    userId: string;
    phase: string;
    currentQuestionIndex: number;
    traitScores: any;
    traitConfidences: any;
    topArchetypes: any;
    preSignupAnswers: any;
    finalResult: any;
    primaryArchetype: string;
    isDecisive: boolean;
    completedAt: Date;
    skipCount: number;
    skippedQuestionIds: string[];
    answeredQuestionIds: string[];
  }>): Promise<any> {
    const { preSignupAnswers, ...rest } = updates;
    const setData: any = { ...rest, updatedAt: new Date() };
    if (preSignupAnswers !== undefined) {
      setData.preSignupData = preSignupAnswers;
    }
    const [session] = await db
      .update(assessmentSessions)
      .set(setData)
      .where(eq(assessmentSessions.id, id))
      .returning();
    return session;
  }

  async createAssessmentAnswer(data: {
    sessionId: string;
    questionId: string;
    questionLevel: number;
    selectedOption: string;
    traitScores: any;
  }): Promise<any> {
    const [answer] = await db
      .insert(assessmentAnswers)
      .values(data)
      .onConflictDoUpdate({
        target: [assessmentAnswers.sessionId, assessmentAnswers.questionId],
        set: {
          selectedOption: data.selectedOption,
          traitScores: data.traitScores,
          answeredAt: new Date(),
        },
      })
      .returning();
    return answer;
  }

  async getAssessmentAnswers(sessionId: string): Promise<any[]> {
    return db
      .select()
      .from(assessmentAnswers)
      .where(eq(assessmentAnswers.sessionId, sessionId))
      .orderBy(assessmentAnswers.answeredAt);
  }

  // Share Card Rankings

  // ============ ATTENDANCE STATUS ============

  // ---- Admin Account operations (RBAC) ----

  // ============ Interest Signal Boost ============

  async upsertInterestSignal(userId: string, data: {
    interestKey: string;
    interestLabel: string;
    enthusiasmLevel: number;
    discussionStyle: string;
    conversationDepth: number;
  }): Promise<UserInterestSignal> {
    const [record] = await db
      .insert(userInterestSignals)
      .values({
        userId,
        interestKey: data.interestKey,
        interestLabel: data.interestLabel,
        enthusiasmLevel: data.enthusiasmLevel,
        discussionStyle: data.discussionStyle,
        conversationDepth: data.conversationDepth,
      })
      .onConflictDoUpdate({
        target: [userInterestSignals.userId, userInterestSignals.interestKey],
        set: {
          interestLabel: data.interestLabel,
          enthusiasmLevel: data.enthusiasmLevel,
          discussionStyle: data.discussionStyle,
          conversationDepth: data.conversationDepth,
          updatedAt: new Date(),
        },
      })
      .returning();
    return record;
  }

  async getUserInterestSignals(userId: string): Promise<UserInterestSignal[]> {
    return db
      .select()
      .from(userInterestSignals)
      .where(eq(userInterestSignals.userId, userId))
      .orderBy(desc(userInterestSignals.updatedAt));
  }
}

export const legacyStorageRepo = new LegacyStorageRepo();
