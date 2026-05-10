import type { Express } from "express";
import { z } from "zod";
import { db } from "../../db";
import {
  eventPools,
  eventPoolRegistrations,
  users,
  insertEventPoolSchema,
  type User,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
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
  predictiveRerankEnabledOverride: z.boolean().optional(),
});

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

      const poolsWithStats = await Promise.all(
        pools.map(async (pool: any) => {
          const registrations = await db.query.eventPoolRegistrations.findMany({
            where: (regs: any, { eq }: any) => eq(regs.poolId, pool.id),
          });

          return {
            ...pool,
            registrationCount: registrations.length,
            matchedCount: registrations.filter((r: any) => r.matchStatus === "matched").length,
            pendingCount: registrations.filter((r: any) => r.matchStatus === "pending").length,
          };
        })
      );

      res.json(poolsWithStats);
    } catch (error) {
      logger.error("Error fetching event pools", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch event pools" });
    }
  });

  // Event Pools - Create new event pool
  app.post("/api/admin/event-pools", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const anyReq = req as any;
      const user = anyReq.user as User | undefined;
      const userIdFromReq = anyReq.userId || anyReq.adminId;
      const sessionUserId = anyReq.session?.userId;

      const createdBy =
        (user && user.id) ||
        userIdFromReq ||
        sessionUserId ||
        null;

      if (!createdBy) {
        logger.error(
          "[EventPools] Missing admin user when creating event pool. Headers:",
          req.headers,
        );
        return res.status(401).json({
          message: "Unauthorized: admin user not found on request",
        });
      }

      const validatedData = insertEventPoolSchema.parse({
        ...req.body,
        createdBy,
        dateTime: new Date(req.body.dateTime),
        registrationDeadline: new Date(req.body.registrationDeadline),
      });

      const [pool] = await db
        .insert(eventPools)
        .values(validatedData)
        .returning();

      logger.info("[EventPools] created pool", { data: { poolId: pool.id } });

      const { generateAndSavePoolCardCopy } = await import("../../ai/workers/poolCardCopyWorker");
      generateAndSavePoolCardCopy(pool.id).catch((err: any) => {
        logger.error(`[poolCardCopyWorker] Failed to generate copy for new pool ${pool.id}:`, err);
      });

      res.json(pool);
    } catch (error: any) {
      logger.error("Error creating event pool", { error: String(error) });
      res.status(400).json({
        message: "Failed to create event pool",
        error: error?.message,
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

      await broadcastAdminAction(
        poolId,
        "pool_matched",
        (req.user as User).id,
        { groupCount: groups.length, totalMatched: groups.reduce((sum, g) => sum + g.members.length, 0) }
      );

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
