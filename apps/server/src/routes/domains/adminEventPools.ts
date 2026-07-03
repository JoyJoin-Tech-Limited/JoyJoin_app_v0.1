import type { Express, Request } from "express";
import { z } from "zod";
import { db } from "../../db";
import {
  eventPools,
  eventPoolRegistrations,
  users,
  adminAccounts,
  insertEventPoolSchema,
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import {
  assertValidTransition as assertValidEventPoolTransition,
  InvalidTransitionError as InvalidPoolTransitionError,
} from "../../lib/stateTransitions";
import { matchEventPool, saveMatchResults } from "../../poolMatchingService";
import { broadcastAdminAction } from "../../eventBroadcast";
import { notifyPoolCancelled } from "../../lib/wecomNotifications";
import { shellCache } from "../../lib/shellCache";

const updateEventPoolSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  eventType: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  dateTime: z.string().datetime().optional(),
  registrationDeadline: z.string().datetime().optional(),
  genderRestriction: z.string().optional(),
  industryRestrictions: z.array(z.string()).optional(),
  seniorityRestrictions: z.array(z.string()).optional(),
  educationLevelRestrictions: z.array(z.string()).optional(),
  ageRangeMin: z.number().int().optional(),
  ageRangeMax: z.number().int().optional(),
  minGroupSize: z.number().int().optional(),
  maxGroupSize: z.number().int().optional(),
  targetGroups: z.number().int().optional(),
  status: z.string().optional(),
  isTestPool: z.boolean().optional(),
  predictiveRerankEnabledOverride: z.boolean().optional(),
});

async function findExistingUserId(candidateId: string | null | undefined): Promise<string | null> {
  if (!candidateId) return null;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, candidateId))
    .limit(1);

  return user?.id ?? null;
}

async function resolveEventPoolCreatedBy(req: Request): Promise<string | null> {
  const sessionUserId = await findExistingUserId(req.session?.userId);
  if (sessionUserId) return sessionUserId;

  const adminAccountUserId = await findExistingUserId(req.adminAccount?.id);
  if (adminAccountUserId) return adminAccountUserId;

  const [legacyAdminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true))
    .limit(1);

  if (legacyAdminUser?.id) return legacyAdminUser.id;

  const [fallbackUser] = await db
    .select({ id: users.id })
    .from(users)
    .limit(1);

  return fallbackUser?.id ?? null;
}

export function registerAdminEventPoolRoutes(app: Express): void {
  // Event Pools - Get all event pools (admin view)
  app.get("/api/admin/event-pools", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      const pools = await db
        .select({
          id: eventPools.id,
          title: eventPools.title,
          description: eventPools.description,
          eventType: eventPools.eventType,
          city: eventPools.city,
          district: eventPools.district,
          dateTime: eventPools.dateTime,
          registrationDeadline: eventPools.registrationDeadline,
          genderRestriction: eventPools.genderRestriction,
          industryRestrictions: eventPools.industryRestrictions,
          seniorityRestrictions: eventPools.seniorityRestrictions,
          educationLevelRestrictions: eventPools.educationLevelRestrictions,
          ageRangeMin: eventPools.ageRangeMin,
          ageRangeMax: eventPools.ageRangeMax,
          minGroupSize: eventPools.minGroupSize,
          maxGroupSize: eventPools.maxGroupSize,
          targetGroups: eventPools.targetGroups,
          status: eventPools.status,
          isTestPool: eventPools.isTestPool,
          totalRegistrations: eventPools.totalRegistrations,
          successfulMatches: eventPools.successfulMatches,
          predictiveRerankEnabledOverride: eventPools.predictiveRerankEnabledOverride,
          createdBy: eventPools.createdBy,
          createdAt: eventPools.createdAt,
          updatedAt: eventPools.updatedAt,
          matchedAt: eventPools.matchedAt,
        })
        .from(eventPools)
        .orderBy(desc(eventPools.createdAt))
        .limit(limit)
        .offset(offset);

      logger.info("[Admin] fetched raw eventPools", { data: { count: pools.length } });

      // Batch-fetch registration stats for all pools in one query
      const poolIds = pools.map((p: typeof eventPools.$inferSelect) => p.id);
      let registrationStats: Record<string, { registrationCount: number; matchedCount: number; pendingCount: number }> = {};

      if (poolIds.length > 0) {
        const registrations = await db
          .select({ poolId: eventPoolRegistrations.poolId, matchStatus: eventPoolRegistrations.matchStatus })
          .from(eventPoolRegistrations)
          .where(inArray(eventPoolRegistrations.poolId, poolIds));

        registrationStats = registrations.reduce((acc: typeof registrationStats, reg: typeof registrations[number]) => {
          const poolId = reg.poolId;
          if (!acc[poolId]) {
            acc[poolId] = { registrationCount: 0, matchedCount: 0, pendingCount: 0 };
          }
          acc[poolId].registrationCount += 1;
          if (reg.matchStatus === "matched") acc[poolId].matchedCount += 1;
          if (reg.matchStatus === "pending") acc[poolId].pendingCount += 1;
          return acc;
        }, {} as typeof registrationStats);
      }

      const poolsWithStats = pools.map((pool: typeof eventPools.$inferSelect) => ({
        ...pool,
        registrationCount: registrationStats[pool.id]?.registrationCount ?? 0,
        matchedCount: registrationStats[pool.id]?.matchedCount ?? 0,
        pendingCount: registrationStats[pool.id]?.pendingCount ?? 0,
      }));

      res.json(poolsWithStats);
    } catch (error) {
      logger.error("Error fetching event pools", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch event pools" });
    }
  });

  // Event Pools - Create new event pool
  app.post("/api/admin/event-pools", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const createdBy = await resolveEventPoolCreatedBy(req);

      if (!createdBy) {
        logger.error(
          "[EventPools] Missing users.id creator fallback when creating event pool. Headers:",
          req.headers,
        );
        return res.status(401).json({
          message: "Unauthorized: no valid user record is available as event pool creator",
        });
      }

      const validatedData = insertEventPoolSchema.parse({
        ...req.body,
        createdBy,
        dateTime: new Date(req.body.dateTime),
        registrationDeadline: new Date(req.body.registrationDeadline),
      });

      if (validatedData.dateTime <= validatedData.registrationDeadline) {
        return res.status(400).json({
          message: "活动时间必须晚于报名截止时间",
        });
      }

      const [pool] = await db
        .insert(eventPools)
        .values(validatedData)
        .returning();

      logger.info("[EventPools] created pool", {
        data: {
          poolId: pool.id,
          createdBy,
          actingAdminId: getActingAdminId(req),
        },
      });
      shellCache.invalidateDiscover();

      logAdminAudit({
        action: "EVENT_POOL_CREATED",
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: "event_pool",
        targetEntityId: pool.id,
        after: { title: pool.title, city: pool.city, dateTime: pool.dateTime?.toISOString?.() ?? pool.dateTime, isTestPool: pool.isTestPool },
      });

      const { generateAndSavePoolCardCopy } = await import("../../ai/workers/poolCardCopyWorker");
      generateAndSavePoolCardCopy(pool.id).catch((err: any) => {
        logger.error(`[poolCardCopyWorker] Failed to generate copy for new pool ${pool.id}:`, err);
      });

      res.json(pool);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error("Error creating event pool", {
        error: errorMessage,
        stack: errorStack,
        body: req.body,
        createdBy: req.adminAccount?.id ?? req.session?.userId ?? null,
      });

      // Distinguish validation errors from DB/runtime errors
      if (error?.name === "ZodError") {
        return res.status(400).json({
          message: "活动池信息格式不正确",
          error: error.issues?.map((i: any) => `${i.path.join('.')}: ${i.message}`).join("; ") || errorMessage,
        });
      }

      // Postgres FK / constraint / type errors
      if (errorMessage?.includes("violates foreign key constraint")) {
        return res.status(500).json({
          message: "数据库外键约束冲突：创建者ID无效。请联系技术团队。",
          error: errorMessage,
        });
      }

      res.status(500).json({
        message: "创建活动池失败，请稍后重试",
        error: errorMessage,
      });
    }
  });

  // Event Pools - Update event pool
  app.patch("/api/admin/event-pools/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const parsed = updateEventPoolSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid update payload",
          errors: parsed.error.issues,
        });
      }

      const updates: any = { ...parsed.data };

      if (updates.dateTime) {
        updates.dateTime = new Date(updates.dateTime);
      }
      if (updates.registrationDeadline) {
        updates.registrationDeadline = new Date(updates.registrationDeadline);
      }

      updates.updatedAt = new Date();

      let oldStatus: string | undefined;
      if (updates.status) {
        const [currentPool] = await db
          .select({ status: eventPools.status })
          .from(eventPools)
          .where(eq(eventPools.id, req.params.id));

        if (!currentPool) {
          return res.status(404).json({ message: "Event pool not found" });
        }

        oldStatus = currentPool.status ?? undefined;

        try {
          assertValidEventPoolTransition("event_pool", oldStatus, updates.status);
        } catch (transitionErr) {
          if (transitionErr instanceof InvalidPoolTransitionError) {
            return res.status(409).json({
              message: transitionErr.message,
              code: "INVALID_TRANSITION",
              from: oldStatus,
              to: updates.status,
            });
          }
          throw transitionErr;
        }
      }

      const whereClause = updates.status && oldStatus
        ? and(
            eq(eventPools.id, req.params.id),
            eq(eventPools.status, oldStatus),
          )
        : eq(eventPools.id, req.params.id);

      const [pool] = await db
        .update(eventPools)
        .set(updates)
        .where(whereClause)
        .returning();

      if (!pool) {
        if (updates.status && oldStatus) {
          const [latestPool] = await db
            .select({ id: eventPools.id, status: eventPools.status })
            .from(eventPools)
            .where(eq(eventPools.id, req.params.id));

          if (!latestPool) {
            return res.status(404).json({ message: "Event pool not found" });
          }

          return res.status(409).json({
            message: "Event pool status changed during update. Please retry.",
            code: "STALE_STATUS",
            from: oldStatus,
            current: latestPool.status,
            to: updates.status,
          });
        }

        return res.status(404).json({ message: "Event pool not found" });
      }

      shellCache.invalidateDiscover();

      if (updates.status && updates.status !== oldStatus) {
        logAdminAudit({
          action: "EVENT_POOL_STATUS_CHANGED",
          adminId: getActingAdminId(req),
          adminRole: (req as any).adminRole,
          targetEntityType: "event_pool",
          targetEntityId: pool.id,
          before: { status: oldStatus },
          after: { status: pool.status },
        });

        // WeCom notification when pool is cancelled
        if (pool.status === "cancelled") {
          void (async () => {
            try {
              const adminId = getActingAdminId(req);
              const [adminUserRecord] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, adminId));
              const [adminAccountRecord] = await db.select({ displayName: adminAccounts.displayName }).from(adminAccounts).where(eq(adminAccounts.id, adminId));
              const adminName = adminUserRecord?.displayName || adminAccountRecord?.displayName || adminId;
              const totalReg = pool.totalRegistrations || 0;
              await notifyPoolCancelled({
                poolTitle: pool.title,
                poolDate: pool.dateTime ? new Date(pool.dateTime).toLocaleString("zh-CN") : "待定",
                poolCity: pool.city,
                poolDistrict: pool.district || undefined,
                poolId: pool.id,
                registeredUserCount: totalReg,
                matchedGroupCount: pool.successfulMatches || 0,
                revenueImpact: (pool.price || 0) * totalReg * 100,
                cancellationReason: "管理后台操作",
                adminName: adminName,
                autoRefund: false,
                usersNotified: false,
              });
            } catch (notifyErr) {
              logger.warn("Failed to send pool cancellation WeCom notification", { error: String(notifyErr) });
            }
          })();
        }
      }

      res.json(pool);
    } catch (error) {
      logger.error("Error updating event pool", { poolId: req.params.id, error: String(error) });
      res.status(500).json({ message: "Failed to update event pool" });
    }
  });

  // Event Pools - Get registrations for a pool
  app.get("/api/admin/event-pools/:id/registrations", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
      const offset = parseInt(req.query.offset as string) || 0;

      const registrations = await db
        .select({
          id: eventPoolRegistrations.id,
          poolId: eventPoolRegistrations.poolId,
          userId: eventPoolRegistrations.userId,
          budgetRange: eventPoolRegistrations.budgetRange,
          preferredLanguages: eventPoolRegistrations.preferredLanguages,
          eventIntent: eventPoolRegistrations.eventIntent,
          cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
          dietaryRestrictions: eventPoolRegistrations.dietaryRestrictions,
          tasteIntensity: eventPoolRegistrations.tasteIntensity,
          matchStatus: eventPoolRegistrations.matchStatus,
          assignedGroupId: eventPoolRegistrations.assignedGroupId,
          matchScore: eventPoolRegistrations.matchScore,
          registeredAt: eventPoolRegistrations.registeredAt,
          userName: users.displayName,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
          userGender: users.gender,
          userBirthdate: users.birthdate,
          userIndustryNiche: users.industryNicheLabel,
          userIndustryCategory: users.industryCategoryLabel,
          userArchetype: users.archetype,
        })
        .from(eventPoolRegistrations)
        .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
        .where(eq(eventPoolRegistrations.poolId, req.params.id))
        .limit(limit)
        .offset(offset);

      res.json(registrations);
    } catch (error) {
      logger.error("Error fetching registrations", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch registrations" });
    }
  });

  // Event Pools - Get groups for a pool
  app.get("/api/admin/event-pools/:id/groups", requireAdmin, async (req, res) => {
    try {
      const groups = await db.query.eventPoolGroups.findMany({
        where: (groups: any, { eq }: any) => eq(groups.poolId, req.params.id),
        orderBy: (groups: any, { asc }: any) => [asc(groups.groupNumber)],
      });

      const groupsWithMembers = await Promise.all(groups.map(async (group: any) => {
        const members = await db
          .select({
            registrationId: eventPoolRegistrations.id,
            userId: eventPoolRegistrations.userId,
            userName: users.displayName,
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userGender: users.gender,
            userArchetype: users.archetype,
            userIndustryNiche: users.industryNicheLabel,
            userIndustryCategory: users.industryCategoryLabel,
            matchScore: eventPoolRegistrations.matchScore,
          })
          .from(eventPoolRegistrations)
          .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
          .where(eq(eventPoolRegistrations.assignedGroupId, group.id));

        return {
          ...group,
          members,
        };
      }));

      res.json(groupsWithMembers);
    } catch (error) {
      logger.error("Error fetching groups", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  // Event Pools - Trigger matching algorithm
  app.post("/api/admin/event-pools/:id/match", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const poolId = req.params.id;

      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, poolId),
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      if (pool.status !== "active") {
        return res.status(400).json({ message: "Pool is not in active status" });
      }

      const groups = await matchEventPool(poolId);
      await saveMatchResults(poolId, groups);

      const matchAdminId = getActingAdminId(req);
      await broadcastAdminAction(
        poolId,
        "pool_matched",
        matchAdminId,
        { groupCount: groups.length, totalMatched: groups.reduce((sum, g) => sum + g.members.length, 0) }
      );

      logAdminAudit({
        action: "EVENT_POOL_MATCHED",
        adminId: matchAdminId,
        adminRole: (req as any).adminRole,
        targetEntityType: "event_pool",
        targetEntityId: poolId,
        after: { groupCount: groups.length, totalMatched: groups.reduce((sum, g) => sum + g.members.length, 0) },
      });

      res.json({
        message: "Matching completed successfully",
        groupCount: groups.length,
        totalMatched: groups.reduce((sum, g) => sum + g.members.length, 0),
        groups: groups.map(g => ({
          memberCount: g.members.length,
          avgChemistryScore: g.avgChemistryScore,
          diversityScore: g.diversityScore,
          overallScore: g.overallScore,
        })),
      });
    } catch (error: any) {
      logger.error("Error matching event pool", { error: String(error) });
      res.status(500).json({
        message: "Failed to match event pool",
        error: error.message,
      });
    }
  });

  // Event Pools - Get pair-scores matrix for a pool
  app.get("/api/admin/event-pools/:id/pair-scores", requireAdmin, async (req, res) => {
    try {
      const groups = await db.query.eventPoolGroups.findMany({
        where: (groups: any, { eq }: any) => eq(groups.poolId, req.params.id),
        orderBy: (groups: any, { asc }: any) => [asc(groups.groupNumber)],
      });

      const pairScores = groups.map((group: any) => ({
        groupId: group.id,
        groupNumber: group.groupNumber,
        memberCount: group.memberCount,
        avgChemistryScore: group.avgChemistryScore,
        diversityScore: group.diversityScore,
        communicationBalance: group.communicationBalance,
        genderBalanceScore: group.genderBalanceScore,
        overallScore: group.overallScore,
        temperatureLevel: group.temperatureLevel,
      }));

      res.json(pairScores);
    } catch (error) {
      logger.error("Error fetching pair scores", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch pair scores" });
    }
  });
}
