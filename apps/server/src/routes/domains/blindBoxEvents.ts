import type { Express } from "express";
import { z } from "zod";
import { requireAuth } from "../../phoneAuth";
import { aiEndpointLimiter } from "../../rateLimiter";
import { storage } from "../../storage";
import { db } from "../../db";
import { eventPoolRegistrations, eventPools, users, userInterests, blindBoxEvents } from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, and, sql, gt } from "drizzle-orm";
import { broadcastAttendanceStatusUpdated, broadcastPoolRegistrationAdded } from "../../eventBroadcast";
import { logger } from "../../lib/logger";

const patchPreferencesSchema = z.object({
  budget: z.array(z.string()).optional(),
  acceptNearby: z.boolean().optional(),
  selectedLanguages: z.array(z.string()).optional(),
});

const attendanceStatusSchema = z.object({
  status: z.enum(["confirmed", "late", "absent"]),
  estimatedLateMinutes: z.number().optional(),
  absentReason: z.string().optional(),
});

const preAttendanceSchema = z.object({
  status: z.enum(["pending", "confirmed", "late", "absent"]),
  lateMinutes: z.number().optional(),
  absentReason: z.string().optional(),
});

const createBlindBoxSchema = z.object({
  city: z.string().optional(),
  district: z.string().optional(),
  eventType: z.string().optional(),
  budgetTier: z.union([z.string(), z.array(z.string())]).optional(),
  selectedLanguages: z.array(z.string()).optional(),
  eventIntent: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  poolId: z.string(),
  area: z.string().optional(),
  budget: z.array(z.string()).optional(),
  acceptNearby: z.boolean().optional(),
  inviteFriends: z.boolean().optional(),
  friendsCount: z.number().optional(),
});

function getUserDisplayName(user: any): string {
  return user?.displayName || user?.display_name || user?.firstName || 'Unknown';
}

function isParticipantOfBlindBoxEvent(event: any, userId: string): boolean {
  if (event.userId === userId) return true;
  const matchedAttendees = Array.isArray(event.matchedAttendees) ? event.matchedAttendees : [];
  return matchedAttendees.some((a: any) => a.userId === userId);
}

export function registerBlindBoxEventRoutes(app: Express): void {
  app.get('/api/blind-box-events/:eventId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const event = await storage.getBlindBoxEventById(eventId, userId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      res.json(event);
    } catch (error) {
      logger.error("Error fetching blind box event:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch blind box event" });
    }
  });
  app.patch('/api/blind-box-events/:eventId', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const parseResult = patchPreferencesSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parseResult.error.format() });
      }
      const { budget, acceptNearby, selectedLanguages } = parseResult.data;

      const event = await storage.updateBlindBoxEventPreferences(eventId, userId, {
        budget,
        acceptNearby,
        selectedLanguages,
      });
      
      res.json(event);
    } catch (error) {
      logger.error("Error updating blind box event:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to update blind box event" });
    }
  });
  app.post('/api/blind-box-events/:eventId/cancel', requireAuth, async (req: any, res) => {
    try {
      logger.info("[BlindBoxCancel] route hit, raw request:", {
        method: req.method,
        originalUrl: req.originalUrl,
        params: req.params,
        body: req.body,
        sessionUserId: req.session?.userId,
      });

      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { eventId } = req.params;

      logger.info("[BlindBoxCancel] incoming cancel request:", {
        userId,
        eventId,
      });

      // 1) 先尝试旧逻辑：如果你之前有真正的 blindBoxEvent 记录
      try {
        const legacyResult = await storage.cancelBlindBoxEvent(eventId, userId);
        if (legacyResult) {
          logger.info("[BlindBoxCancel] legacy cancelBlindBoxEvent succeeded:", {
            eventId,
            userId,
          });
          return res.json(legacyResult);
        }
      } catch (legacyErr) {
        logger.warn("[BlindBoxCancel] legacy cancelBlindBoxEvent failed or not applicable:", { error: legacyErr instanceof Error ? legacyErr.message : String(legacyErr) });
      }

      // 2) 新逻辑优先：把 eventId 当作报名记录 id（event_pool_registrations.id）来删除
      // 这样 Activities 页如果传 registrationId 也可以正常取消
      let deletedRegistrations = await db
        .delete(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.id, eventId),
            eq(eventPoolRegistrations.userId, userId)
          )
        )
        .returning();

      if (deletedRegistrations.length > 0) {
        logger.info("[BlindBoxCancel] cancelled by registrationId:", {
          userId,
          registrationId: eventId,
          count: deletedRegistrations.length,
        });
        logger.info("[BlindBoxCancel] response (by registrationId):", {
          userId,
          cancelledIds: (deletedRegistrations as any[]).map((r: any) => r.id),
        });

        // 对每个被删除的报名，把对应池子的 totalRegistrations - 1
        for (const reg of deletedRegistrations) {
          if (reg.poolId) {
            await db
              .update(eventPools)
              .set({
                totalRegistrations: sql`${eventPools.totalRegistrations} - 1`,
                updatedAt: new Date(),
              })
              .where(eq(eventPools.id, reg.poolId));
          }
        }

        return res.json({
          ok: true,
          cancelledRegistrationIds: deletedRegistrations.map((r: any) => r.id),
        });
      }

      // 3) 兼容旧调用方式：把 eventId 当作 poolId，用于删除当前用户在该池子的报名记录
      deletedRegistrations = await db
        .delete(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, eventId),
            eq(eventPoolRegistrations.userId, userId)
          )
        )
        .returning();

      if (deletedRegistrations.length === 0) {
        logger.warn("[BlindBoxCancel] no registration found to cancel:", {
          userId,
          eventId,
        });
        return res.status(404).json({
          message: "没有找到可取消的报名记录，可能已经取消过了",
        });
      }

      logger.info("[BlindBoxCancel] cancelled by poolId:", {
        userId,
        poolId: eventId,
        count: deletedRegistrations.length,
      });
      logger.info("[BlindBoxCancel] response (by poolId):", {
        userId,
        cancelledIds: (deletedRegistrations as any[]).map((r: any) => r.id),
      });

      // 同样更新对应池子的 totalRegistrations
      for (const reg of deletedRegistrations) {
        if (reg.poolId) {
          await db
            .update(eventPools)
            .set({
              totalRegistrations: sql`${eventPools.totalRegistrations} - 1`,
              updatedAt: new Date(),
            })
            .where(eq(eventPools.id, reg.poolId));
        }
      }

      return res.json({
        ok: true,
        cancelledRegistrationIds: (deletedRegistrations as any[]).map((r: any) => r.id),
      });
    } catch (error) {
      logger.error("[BlindBoxCancel] Error canceling blind box event / pool registration:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to cancel blind box event" });
    }
  });
  app.get('/api/blind-box-events/:eventId/my-attendance-status', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const status = await storage.getAttendanceStatus(eventId, userId);
      if (!status) {
        return res.json({ status: 'pending', estimatedLateMinutes: null, absentReason: null });
      }
      res.json(status);
    } catch (error) {
      logger.error("[AttendanceStatus] Error fetching status:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch attendance status" });
    }
  });
  app.post('/api/blind-box-events/:eventId/attendance-status', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const parseResult = attendanceStatusSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parseResult.error.format() });
      }
      const { status, estimatedLateMinutes, absentReason } = parseResult.data;

      // Only allow user-settable statuses (not 'pending')
      const validStatuses = ['confirmed', 'late', 'absent'] as const;
      type AttendanceStatus = (typeof validStatuses)[number];
      const isValidStatus = (s: unknown): s is AttendanceStatus =>
        typeof s === 'string' && (validStatuses as readonly string[]).includes(s);
      if (!isValidStatus(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      const normalizedStatus: AttendanceStatus = status;

      // Verify the caller is a participant in this event
      const event = await storage.getBlindBoxEventAdmin(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (!isParticipantOfBlindBoxEvent(event, userId)) {
        return res.status(403).json({ message: "Not a participant in this event" });
      }

      // Enforce time-window constraints
      const eventStart = new Date(event.date_time);
      const now = new Date();
      const diffMinutes = (now.getTime() - eventStart.getTime()) / 60000;

      let normalizedEstimatedLateMinutes: number | null = null;
      let normalizedAbsentReason: string | null = null;

      if (normalizedStatus === 'absent') {
        if (diffMinutes >= 0) {
          return res.status(400).json({ message: "Cannot mark absent after the event has started" });
        }
        if (typeof absentReason !== 'string' || absentReason.trim().length === 0) {
          return res.status(400).json({ message: "absentReason is required when marking absent" });
        }
        normalizedAbsentReason = absentReason.trim();
      } else if (normalizedStatus === 'late') {
        if (diffMinutes < -120 || diffMinutes > 45) {
          return res.status(400).json({ message: "Late status can only be set within 2 hours before to 45 minutes after the event" });
        }
        if (typeof estimatedLateMinutes !== 'number' || !Number.isFinite(estimatedLateMinutes) || estimatedLateMinutes <= 0) {
          return res.status(400).json({ message: "estimatedLateMinutes must be a positive number when marking late" });
        }
        normalizedEstimatedLateMinutes = estimatedLateMinutes;
      }
      // 'confirmed' uses no auxiliary fields

      await storage.updateAttendanceStatus(eventId, userId, normalizedStatus, normalizedEstimatedLateMinutes, normalizedAbsentReason);

      // Fetch user displayName for broadcast
      const user = await storage.getUser(userId);
      const displayName = getUserDisplayName(user);

      broadcastAttendanceStatusUpdated(eventId, userId, displayName, normalizedStatus, normalizedEstimatedLateMinutes ?? undefined, normalizedAbsentReason ?? undefined);

      res.json({ success: true });
    } catch (error) {
      logger.error("[AttendanceStatus] Error updating status:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to update attendance status" });
    }
  });
  app.get('/api/blind-box-events/:eventId/attendance-summary', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;

      // Verify the caller is a participant in this event
      const event = await storage.getBlindBoxEventAdmin(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (!isParticipantOfBlindBoxEvent(event, userId)) {
        return res.status(403).json({ message: "Not a participant in this event" });
      }

      const summary = await storage.getEventAttendanceSummary(eventId);
      res.json(summary);
    } catch (error) {
      logger.error("[AttendanceStatus] Error fetching attendance summary:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch attendance summary" });
    }
  });
  app.post('/api/blind-box-events/:eventId/set-demo-match', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      
      // Demo matched attendees data with rich hidden attributes for interesting connections
      const demoMatchedAttendees = [
        {
          userId: "demo1",
          displayName: "Alex",
          archetype: "fox",
          topInterests: ["film_entertainment", "travel_exploration", "photography"],
          age: 29,
          birthdate: "1996-03-15",
          gender: "Man",
          industry: "科技",
          educationLevel: "Master's",
          fieldOfStudy: "计算机科学",
          hometownRegionCity: "北京",
          studyLocale: "Overseas",
          seniority: "Mid",
          relationshipStatus: "Single",
          languagesComfort: ["普通话 (Mandarin)", "English"],
          ageVisible: true,
          industryVisible: true,
          educationVisible: true
        },
        {
          userId: "demo2",
          displayName: "小明",
          archetype: "koala",
          topInterests: ["food_dining", "music_concerts", "travel_exploration"],
          age: 27,
          birthdate: "1998-07-20",
          gender: "Man",
          industry: "艺术",
          educationLevel: "Bachelor's",
          fieldOfStudy: "视觉艺术",
          hometownRegionCity: "上海",
          studyLocale: "Domestic",
          seniority: "Junior",
          relationshipStatus: "Single",
          languagesComfort: ["普通话 (Mandarin)"],
          ageVisible: true,
          industryVisible: true,
          educationVisible: true
        },
        {
          userId: "demo3",
          displayName: "Sarah",
          archetype: "智者",
          topInterests: ["reading_books", "film_entertainment", "coffee_tea"],
          age: 32,
          birthdate: "1993-05-10",
          gender: "Woman",
          industry: "金融",
          educationLevel: "Master's",
          fieldOfStudy: "金融工程",
          hometownRegionCity: "香港",
          studyLocale: "Overseas",
          seniority: "Senior",
          relationshipStatus: "Married/Partnered",
          languagesComfort: ["English", "粤语 (Cantonese)", "普通话 (Mandarin)"],
          ageVisible: true,
          industryVisible: true,
          educationVisible: true
        },
        {
          userId: "demo4",
          displayName: "李华",
          archetype: "rooster",
          topInterests: ["fitness_health", "travel_exploration", "outdoor_activities"],
          age: 28,
          birthdate: "1997-09-25",
          gender: "Woman",
          industry: "医疗",
          educationLevel: "Doctorate",
          fieldOfStudy: "临床医学",
          hometownRegionCity: "深圳",
          studyLocale: "Both",
          seniority: "Mid",
          relationshipStatus: "Single",
          languagesComfort: ["普通话 (Mandarin)", "English"],
          ageVisible: true,
          industryVisible: true,
          educationVisible: true
        }
      ];
      
      const demoExplanation = "这桌聚集了对电影、旅行充满热情的朋友。我们平衡了fox的探索新鲜与koala的深度倾听，确保对话既热烈又有深度。";
      
      const event = await storage.setBlindBoxEventMatchData(eventId, userId, {
        matchedAttendees: demoMatchedAttendees,
        matchExplanation: demoExplanation
      });
      
      res.json(event);
    } catch (error) {
      logger.error("Error setting demo match data:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to set demo match data" });
    }
  });
  app.get('/api/blind-box-events/:eventId/match-explanations', requireAuth, aiEndpointLimiter, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get the blind box event
      const event = await db.query.blindBoxEvents.findFirst({
        where: eq(blindBoxEvents.id, eventId),
      });

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Check if user is the creator or in matched attendees
      const matchedAttendees = event.matchedAttendees as any[];
      const isParticipant = event.userId === userId || 
        matchedAttendees?.some((a: any) => a.userId === userId);

      if (!isParticipant) {
        return res.status(403).json({ message: 'Not a participant in this event' });
      }

      if (!matchedAttendees || matchedAttendees.length === 0) {
        return res.status(404).json({ message: 'Match not ready yet' });
      }

      // Get full user info for matched attendees
      const memberIds = matchedAttendees.map((a: any) => a.userId);
      const members = await db.query.users.findMany({
        where: sql`${users.id} = ANY(${memberIds})`,
        limit: 50,
      });

      const { matchExplanationService } = await import('../../matchExplanationService');

      // Load user interests (with heat levels) for deep interest overlap detection
      const memberInterestsRows = await db.query.userInterests.findMany({
        where: sql`${userInterests.userId} = ANY(${memberIds})`,
        limit: 50,
      }) as Array<{
        userId: string;
        selections: Array<{ topicId: string; level?: number | null }> | null;
      }>;
      const interestsByUserId = new Map(
        memberInterestsRows.map((row) => [row.userId, row] as const)
      );

      const matchMembers = members.map((m: any) => {
        const interestRow = interestsByUserId.get(m.id);
        const interestsWithHeat = interestRow?.selections
          ? (interestRow.selections as Array<{ topicId: string; level: number }>).map(
              (s) => ({ topicId: s.topicId, heatLevel: s.level ?? 1 })
            )
          : null;
        return {
          userId: m.id,
          displayName: m.displayName || '神秘嘉宾',
          archetype: m.archetype,
          secondaryArchetype: m.secondaryArchetype,
          interestsTop: m.interestsTop,
          industry: m.industryNicheLabel || m.industryCategoryLabel,
          hometown: m.hometownRegionCity,
          socialStyle: m.socialStyle,
          educationLevel: m.educationLevel,
          relationshipStatus: m.relationshipStatus,
          workMode: m.workMode,
          industryCategory: m.industryCategory,
          industryCategoryLabel: m.industryCategoryLabel,
          interestsWithHeat,
        };
      });

      const groupAnalysis = await matchExplanationService.generateGroupAnalysis(
        eventId,
        matchMembers,
        event.eventType || '饭局'
      );

      res.json({
        eventId,
        overallChemistry: groupAnalysis.overallChemistry,
        groupDynamics: groupAnalysis.groupDynamics,
        explanations: groupAnalysis.pairExplanations,
        iceBreakers: groupAnalysis.iceBreakers,
        existingExplanation: event.matchExplanation,
        meta: {
          generatedAt: groupAnalysis.generatedAt,
          fromCache: groupAnalysis.fromCache,
          provider: groupAnalysis.provider,
          fallbackUsed: groupAnalysis.fallbackUsed,
          promptVersion: groupAnalysis.promptVersion,
        },
      });
    } catch (error: any) {
      logger.error('[Match Explanations] Error', { error: String(error) });
      res.status(500).json({ message: 'Failed to generate match explanations', error: error.message });
    }
  });
  app.post('/api/blind-box-events/:eventId/pre-attendance', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const parseResult = preAttendanceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parseResult.error.format() });
      }
      const { status, lateMinutes, absentReason } = parseResult.data;

      // Upsert (insert or update) the pre-attendance record
      await db
        .insert(schema.blindBoxPreAttendance)
        .values({ eventId, userId, status, lateMinutes: lateMinutes ?? null, absentReason: absentReason ?? null, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [schema.blindBoxPreAttendance.eventId, schema.blindBoxPreAttendance.userId],
          set: { status, lateMinutes: lateMinutes ?? null, absentReason: absentReason ?? null, updatedAt: new Date() },
        });

      res.json({ success: true, status });
    } catch (error) {
      logger.error("Error updating pre-attendance:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to update attendance status" });
    }
  });

  app.post('/api/blind-box-events', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        logger.error("[BlindBoxPayment] No userId in session");
        return res.status(401).json({ message: "Unauthorized" });
      }

      // 尽量把当前用户查出来，方便 debug（可选）
      try {
        const usersResult = await db
          .select()
          .from(users)
          .where(eq(users.id, userId));
        logger.info("[BlindBoxPayment] current user from DB", { data: { value: usersResult } });
      } catch (userErr) {
        logger.warn("[BlindBoxPayment] failed to load user for debug:", { error: userErr instanceof Error ? userErr.message : String(userErr) });
      }

      const parseResult = createBlindBoxSchema.safeParse(req.body || {});
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parseResult.error.format() });
      }
      const {
        city,
        district,
        eventType,
        budgetTier,
        selectedLanguages,
        eventIntent,
        dietaryRestrictions,
        poolId,
        area,
        budget,
        acceptNearby,
        inviteFriends,
        friendsCount,
      } = parseResult.data;

      logger.info("[BlindBoxPayment] incoming payload:", {
        userId,
        city,
        district,
        area,
        eventType,
        budgetTier,
        budget,
        selectedLanguages,
        eventIntent,
        dietaryRestrictions,
        poolId,
        acceptNearby,
        inviteFriends,
        friendsCount,
      });

      // ✅ 必须显式指定 poolId（这个池子是 admin 在后台创好的）
      if (!poolId) {
        logger.warn("[BlindBoxPayment] missing poolId in request");
        return res.status(400).json({
          message: "缺少必填字段：poolId",
        });
      }

      // ✅ 统一处理预算：优先用 budgetTier，其次用 budget 数组
      let budgetRange: string[] = [];
      if (budgetTier !== undefined && budgetTier !== null) {
        if (Array.isArray(budgetTier)) {
          budgetRange = budgetTier.map((b) => String(b));
        } else {
          budgetRange = [String(budgetTier)];
        }
      } else if (Array.isArray(budget)) {
        budgetRange = budget.map((b: any) => String(b));
      }

      if (budgetRange.length === 0) {
        logger.warn("[BlindBoxPayment] missing budget info");
        return res.status(400).json({
          message: "参数不完整：需要 budgetTier 或 budget",
        });
      }

      // ✅ 只允许报名已经存在且开放报名的池子（status = active 且 registrationDeadline 未来）
      const now = new Date();
      const poolsById = await db
        .select()
        .from(eventPools)
        .where(
          and(
            eq(eventPools.id, poolId),
            eq(eventPools.status, "active"),
            gt(eventPools.registrationDeadline, now)
          )
        );

      if (!poolsById || poolsById.length === 0) {
        logger.warn("Pool not found or not active / expired", { feature: 'BlindBoxPayment', poolId });
        return res.status(404).json({
          message: "指定的活动池不存在或已关闭报名",
        });
      }

      const pool = poolsById[0];

      logger.info("[BlindBoxPayment] final chosen pool for registration:", {
        id: pool.id,
        title: pool.title,
        city: pool.city,
        district: pool.district,
      });

      // ✅ 防止重复报名：同一用户 + 同一池子只允许一条报名记录
      const existingRegistrations = await db
        .select({ id: eventPoolRegistrations.id })
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, pool.id),
            eq(eventPoolRegistrations.userId, userId)
          )
        );

      if (existingRegistrations.length > 0) {
        logger.warn("[BlindBoxPayment] user already registered for this pool:", {
          userId,
          poolId: pool.id,
        });
        return res.status(400).json({
          message: "你已经报名过这个活动盲盒啦，无法重复报名",
        });
      }

      // ✅ 在 event_pool_registrations 中插入报名记录（用户付完钱就直接进池子）
      const registrationData = {
        poolId: pool.id,
        userId,
        budgetRange,
        preferredLanguages: Array.isArray(selectedLanguages) ? selectedLanguages : [],
        eventIntent: Array.isArray(eventIntent) ? eventIntent : [],
        dietaryRestrictions: Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [],
      };

      logger.info("[BlindBoxPayment] creating eventPoolRegistration with data", { data: { value: registrationData } });

      const [registration] = await db
        .insert(eventPoolRegistrations)
        .values(registrationData)
        .returning();

      logger.info("[BlindBoxPayment] created eventPoolRegistration", { data: { value: registration } });

      // ✅ 更新活动池的 totalRegistrations 计数
      const [updatedPool] = await db
        .update(eventPools)
        .set({
          totalRegistrations: sql`${eventPools.totalRegistrations} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(eventPools.id, pool.id))
        .returning();

      logger.info("[BlindBoxPayment] updated eventPool after registration", { data: { value: updatedPool } });

      broadcastPoolRegistrationAdded(
        pool.id,
        undefined,
        userId,
        updatedPool?.totalRegistrations ?? pool.totalRegistrations + 1,
      );

      // ✅ 返回报名信息（前端目前只需要知道成功了 & 池子信息）
      return res.json({
        ok: true,
        registration,
        pool: updatedPool || pool,
      });
    } catch (error: any) {
      logger.error("[BlindBoxPayment] Failed to create pool registration:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        message: "Failed to create blind box registration",
        error: error?.message || String(error),
      });
    }
  });

}
