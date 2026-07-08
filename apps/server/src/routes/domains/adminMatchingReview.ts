import type { Express } from "express";
import { z } from "zod";
import { db } from "../../db";
import { eventPools, eventPoolGroups, eventPoolRegistrations, users, events, eventAttendance, blindBoxEvents, adminAccounts } from "@shared/schema";
import { eq, and, inArray, desc, sql, type SQL } from "drizzle-orm";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { logger } from "../../lib/logger";
import { executePostMatchCommitSideEffects } from "../../lib/matchingPostMatchEffects";
import type { MatchGroup } from "../../poolMatchingService";

const reviewStatusEnum = z.enum(["pending", "approved", "rejected", "all"]);

/**
 * Reconstruct a lightweight MatchGroup[] from persisted records so that the
 * shared post-match side-effect runner can run after operator approval. Only
 * fields actually used by notifications / venue assignment / theme generation
 * are populated; everything else is defaulted to null/empty.
 */
async function buildMatchGroupsForApproval(poolId: string): Promise<{ groups: MatchGroup[]; groupIds: string[] }> {
  const pool = await db.query.eventPools.findFirst({ where: eq(eventPools.id, poolId) });
  const groups: Array<typeof eventPoolGroups.$inferSelect> = await db
    .select()
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.poolId, poolId))
    .orderBy(eventPoolGroups.groupNumber);

  if (!pool) {
    throw new Error(`Pool not found: ${poolId}`);
  }

  const rows = await db
    .select({
      registrationId: eventPoolRegistrations.id,
      userId: eventPoolRegistrations.userId,
      assignedGroupId: eventPoolRegistrations.assignedGroupId,
      budgetRange: eventPoolRegistrations.budgetRange,
      barBudgetRange: eventPoolRegistrations.barBudgetRange,
      preferredLanguages: eventPoolRegistrations.preferredLanguages,
      eventIntent: eventPoolRegistrations.eventIntent,
      userIntent: users.intent,
      cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
      dietaryRestrictions: eventPoolRegistrations.dietaryRestrictions,
      tasteIntensity: eventPoolRegistrations.tasteIntensity,
      barThemes: eventPoolRegistrations.barThemes,
      alcoholComfort: eventPoolRegistrations.alcoholComfort,
      preferenceStrictness: eventPoolRegistrations.preferenceStrictness,
      preferredDistricts: eventPoolRegistrations.preferredDistricts,
      genderCompositionPreference: eventPoolRegistrations.genderCompositionPreference,
      acceptPairs: eventPoolRegistrations.acceptPairs,
      kolComfortLevel: eventPoolRegistrations.kolComfortLevel,
      gender: users.gender,
      birthdate: users.birthdate,
      industryNiche: users.industryNiche,
      industryNicheLabel: users.industryNicheLabel,
      industryCategoryLabel: users.industryCategoryLabel,
      educationLevel: users.educationLevel,
      archetype: sql<string>`coalesce(${users.primaryArchetype}, ${users.archetype}, 'koala')`,
      secondaryArchetype: users.secondaryArchetype,
      lifeStage: users.lifeStage,
      workMode: users.workMode,
      hometown: users.hometownRegionCity,
      hometownAffinityOptin: users.hometownAffinityOptin,
      ageMatchPreference: users.ageMatchPreference,
      tableVibePreference: users.tableVibePreference,
      vibeVector: users.vibeVector,
    })
    .from(eventPoolRegistrations)
    .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
    .where(eq(eventPoolRegistrations.poolId, poolId));

  const rowsByGroup = new Map<string, (typeof rows)[number][]>();
  for (const row of rows) {
    if (!row.assignedGroupId) continue;
    const list = rowsByGroup.get(row.assignedGroupId) ?? [];
    list.push(row);
    rowsByGroup.set(row.assignedGroupId, list);
  }

  const result: MatchGroup[] = [];
  for (const group of groups) {
    const groupRows = rowsByGroup.get(group.id) ?? [];
    const members = groupRows.map((row) => ({
      userId: row.userId,
      registrationId: row.registrationId,
      gender: row.gender,
      birthdate: row.birthdate ? String(row.birthdate) : null,
      industryNiche: row.industryNiche,
      industryNicheLabel: row.industryNicheLabel,
      industryCategoryLabel: row.industryCategoryLabel,
      educationLevel: row.educationLevel,
      archetype: row.archetype,
      secondaryArchetype: row.secondaryArchetype,
      lifeStage: row.lifeStage,
      workMode: row.workMode,
      hometown: row.hometown,
      hometownAffinityOptin: row.hometownAffinityOptin,
      budgetRange: row.budgetRange,
      barBudgetRange: row.barBudgetRange,
      preferredLanguages: row.preferredLanguages,
      eventIntent: row.eventIntent,
      userIntent: row.userIntent,
      cuisinePreferences: row.cuisinePreferences,
      dietaryRestrictions: row.dietaryRestrictions,
      tasteIntensity: row.tasteIntensity,
      barThemes: row.barThemes,
      alcoholComfort: row.alcoholComfort,
      eventType: pool.eventType,
      ageMatchPreference: row.ageMatchPreference,
      tableVibePreference: row.tableVibePreference,
      vibeVector: (row.vibeVector as Record<string, number>) ?? null,
      preferenceStrictness: row.preferenceStrictness,
      preferredDistricts: row.preferredDistricts,
      genderCompositionPreference: row.genderCompositionPreference,
      acceptPairs: row.acceptPairs,
      kolComfortLevel: row.kolComfortLevel,
    }));

    result.push({
      members,
      avgPairScore: group.overallScore ?? 0,
      avgChemistryScore: group.avgChemistryScore ?? 0,
      diversityScore: group.diversityScore ?? 0,
      communicationBalance: group.communicationBalance ?? 0,
      overallScore: group.overallScore ?? 0,
      temperatureLevel: group.temperatureLevel ?? "warm",
      explanation: group.matchExplanation ?? "",
    });
  }

  return { groups: result, groupIds: groups.map((g) => g.id) };
}

export function registerAdminMatchingReviewRoutes(app: Express): void {
  // List pools awaiting operator review (or filtered by status)
  app.get("/api/admin/matching-reviews/pools", requireAdmin, async (req, res) => {
    try {
      const status = reviewStatusEnum.safeParse(req.query.status).data ?? "pending";
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const offset = Math.max(0, Number(req.query.offset) || 0);

      const conditions: SQL<unknown>[] = [
        sql`${eventPools.operatorReviewStatus} <> 'none'`,
      ];
      if (status !== "all") {
        conditions.push(eq(eventPools.operatorReviewStatus, status));
      }

      const pools: Array<typeof eventPools.$inferSelect> = await db
        .select()
        .from(eventPools)
        .where(and(...conditions))
        .orderBy(desc(eventPools.matchedAt), desc(eventPools.createdAt))
        .limit(limit)
        .offset(offset);

      // Include group counts per pool
      const poolIds = pools.map((p) => p.id);
      const groupCounts: Array<{ poolId: string; count: number }> = poolIds.length > 0
        ? await db
            .select({
              poolId: eventPoolGroups.poolId,
              count: sql<number>`count(*)::int`,
            })
            .from(eventPoolGroups)
            .where(inArray(eventPoolGroups.poolId, poolIds))
            .groupBy(eventPoolGroups.poolId)
        : [];

      const countByPool = new Map(groupCounts.map((g) => [g.poolId, g.count]));

      // Resolve reviewer display names for completed reviews
      const reviewerIds = pools.map((p) => p.operatorReviewedBy).filter((id): id is string => Boolean(id));
      const reviewerNameById = new Map<string, string>();
      if (reviewerIds.length > 0) {
        const reviewerRows = await db
          .select({ id: adminAccounts.id, displayName: adminAccounts.displayName })
          .from(adminAccounts)
          .where(inArray(adminAccounts.id, reviewerIds));
        for (const row of reviewerRows) {
          reviewerNameById.set(row.id, row.displayName || row.id);
        }
      }

      res.json({
        pools: pools.map((p) => ({
          ...p,
          groupCount: countByPool.get(p.id) ?? 0,
          reviewedByName: p.operatorReviewedBy ? reviewerNameById.get(p.operatorReviewedBy) || p.operatorReviewedBy : null,
        })),
        pagination: { limit, offset },
      });
    } catch (error: any) {
      logger.error("[AdminMatchingReview] Failed to list review pools", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch review pools" });
    }
  });

  // List groups for a specific pool under review
  app.get("/api/admin/matching-reviews/pools/:id/groups", requireAdmin, async (req, res) => {
    try {
      const poolId = req.params.id;
      const pool = await db.query.eventPools.findFirst({ where: eq(eventPools.id, poolId) });
      const groups: Array<typeof eventPoolGroups.$inferSelect> = await db
        .select()
        .from(eventPoolGroups)
        .where(eq(eventPoolGroups.poolId, poolId))
        .orderBy(eventPoolGroups.groupNumber);

      if (!pool) {
        return res.status(404).json({ message: "Pool not found" });
      }

      const groupIds = groups.map((g) => g.id);
      const groupRegistrations: Array<{
        assignedGroupId: string | null;
        userId: string;
        displayName: string | null;
        archetype: string | null;
        gender: string | null;
      }> = groupIds.length > 0
        ? await db
            .select({
              assignedGroupId: eventPoolRegistrations.assignedGroupId,
              userId: eventPoolRegistrations.userId,
              displayName: users.displayName,
              archetype: users.archetype,
              gender: users.gender,
            })
            .from(eventPoolRegistrations)
            .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
            .where(inArray(eventPoolRegistrations.assignedGroupId, groupIds))
        : [];

      const registrationsByGroup = new Map<string, (typeof groupRegistrations)[number][]>();
      for (const row of groupRegistrations) {
        if (!row.assignedGroupId) continue;
        const list = registrationsByGroup.get(row.assignedGroupId) ?? [];
        list.push(row);
        registrationsByGroup.set(row.assignedGroupId, list);
      }

      res.json({
        poolId,
        poolTitle: pool.title,
        operatorReviewStatus: pool.operatorReviewStatus,
        groups: groups.map((g) => ({
          ...g,
          members: (registrationsByGroup.get(g.id) ?? []).map((row) => ({
            userId: row.userId,
            displayName: row.displayName,
            archetype: row.archetype,
            gender: row.gender,
          })),
        })),
      });
    } catch (error: any) {
      logger.error("[AdminMatchingReview] Failed to list review groups", { error: String(error), poolId: req.params.id });
      res.status(500).json({ message: "Failed to fetch review groups" });
    }
  });

  // Approve a pool's pending groups
  app.post("/api/admin/matching-reviews/pools/:id/approve", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const poolId = req.params.id;
      const adminAccount = (req as any).adminAccount;
      const adminId = adminAccount?.id ?? (req.session as any)?.userId ?? "unknown";
      const adminRole = adminAccount?.role ?? "admin";

      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, poolId))
        .limit(1);

      if (!pool) {
        return res.status(404).json({ message: "Pool not found" });
      }

      if (pool.operatorReviewStatus === "approved") {
        return res.json({ success: true, message: "Already approved", poolId });
      }

      if (pool.operatorReviewStatus !== "pending") {
        return res.status(400).json({ message: "Pool is not pending review" });
      }

      await db.transaction(async (tx: typeof db) => {
        await tx
          .update(eventPoolGroups)
          .set({
            operatorReviewStatus: "approved",
            operatorReviewedBy: adminId,
            operatorReviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(
            eq(eventPoolGroups.poolId, poolId),
            eq(eventPoolGroups.operatorReviewStatus, "pending")
          ));

      const [updatedPool] = await tx
        .update(eventPools)
        .set({
          operatorReviewStatus: "approved",
          operatorReviewedBy: adminId,
          operatorReviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(
          eq(eventPools.id, poolId),
          eq(eventPools.operatorReviewStatus, "pending")
        ))
        .returning();

      if (!updatedPool) {
        // Another request already approved or rejected the pool; abort the transaction
        throw new Error("POOL_NOT_PENDING");
      }


        // Reveal the matched state to users now that the operator has approved
        await tx
          .update(eventPoolRegistrations)
          .set({
            matchStatus: "matched",
            updatedAt: new Date(),
          })
          .where(and(
            eq(eventPoolRegistrations.poolId, poolId),
            eq(eventPoolRegistrations.matchStatus, "pending"),
            sql`${eventPoolRegistrations.assignedGroupId} is not null`
          ));
      });

      logAdminAudit({
        action: "MATCHING_REVIEW_APPROVED",
        adminId,
        adminRole,
        targetEntityType: "event_pool",
        targetEntityId: poolId,
        context: { groupCount: await db.$count(eventPoolGroups, eq(eventPoolGroups.poolId, poolId)) },
      });

      // Run side effects after successful commit
      const { groups, groupIds } = await buildMatchGroupsForApproval(poolId);
      await executePostMatchCommitSideEffects(poolId, groups, groupIds, pool);

      res.json({ success: true, poolId, approvedGroups: groups.length });
    } catch (error: any) {
      if (error?.message === "POOL_NOT_PENDING") {
        return res.json({ success: true, message: "Already approved", poolId: req.params.id });
      }
      logger.error("[AdminMatchingReview] Failed to approve review", { error: String(error), poolId: req.params.id });
      res.status(500).json({ message: "Failed to approve review" });
    }
  });

  // Reject a pool's pending groups
  const rejectSchema = z.object({
    reason: z.string().min(1).max(2000),
  });

  app.post("/api/admin/matching-reviews/pools/:id/reject", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const poolId = req.params.id;
      const adminAccount = (req as any).adminAccount;
      const adminId = adminAccount?.id ?? (req.session as any)?.userId ?? "unknown";
      const adminRole = adminAccount?.role ?? "admin";

      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Rejection reason is required (1-2000 chars)" });
      }
      const { reason } = parsed.data;

      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, poolId))
        .limit(1);

      if (!pool) {
        return res.status(404).json({ message: "Pool not found" });
      }

      if (pool.operatorReviewStatus === "rejected") {
        return res.json({ success: true, message: "Already rejected", poolId });
      }

      if (pool.operatorReviewStatus !== "pending") {
        return res.status(400).json({ message: "Pool is not pending review" });
      }

      await db.transaction(async (tx: typeof db) => {
        // Collect generated event records before we mark groups rejected so we can
        // clean them up and leave the pool in a re-matchable state.
        const groupsToClean: Array<{ eventId: string | null; blindBoxEventId: string | null }> = await tx
          .select({
            id: eventPoolGroups.id,
            eventId: eventPoolGroups.eventId,
            blindBoxEventId: eventPoolGroups.blindBoxEventId,
          })
          .from(eventPoolGroups)
          .where(and(
            eq(eventPoolGroups.poolId, poolId),
            eq(eventPoolGroups.operatorReviewStatus, "pending")
          ));

        const eventIds = groupsToClean.map((g) => g.eventId).filter((id): id is string => Boolean(id));
        const blindBoxEventIds = groupsToClean.map((g) => g.blindBoxEventId).filter((id): id is string => Boolean(id));

        if (eventIds.length > 0) {
          await tx.delete(eventAttendance).where(inArray(eventAttendance.eventId, eventIds));
          await tx.delete(events).where(inArray(events.id, eventIds));
        }
        if (blindBoxEventIds.length > 0) {
          await tx.delete(blindBoxEvents).where(inArray(blindBoxEvents.id, blindBoxEventIds));
        }

        const [updatedPool] = await tx
          .update(eventPools)
          .set({
            operatorReviewStatus: "rejected",
            operatorReviewReason: reason,
            operatorReviewedBy: adminId,
            operatorReviewedAt: new Date(),
            status: "active",
            updatedAt: new Date(),
          })
          .where(and(
            eq(eventPools.id, poolId),
            eq(eventPools.operatorReviewStatus, "pending")
          ))
          .returning();

        if (!updatedPool) {
          // The pool was approved or rejected by another request while we were
          // reading the groups; abort so we don't leave stale data behind.
          throw new Error("POOL_NOT_PENDING");
        }

        await tx
          .update(eventPoolGroups)
          .set({
            operatorReviewStatus: "rejected",
            operatorReviewReason: reason,
            operatorReviewedBy: adminId,
            operatorReviewedAt: new Date(),
            status: "cancelled",
            updatedAt: new Date(),
          })
          .where(and(
            eq(eventPoolGroups.poolId, poolId),
            eq(eventPoolGroups.operatorReviewStatus, "pending")
          ));

        // Reset matched registrations so the pool can be re-matched later
        await tx
          .update(eventPoolRegistrations)
          .set({
            matchStatus: "pending",
            assignedGroupId: null,
            matchScore: null,
            updatedAt: new Date(),
          })
          .where(and(
            eq(eventPoolRegistrations.poolId, poolId),
            eq(eventPoolRegistrations.matchStatus, "matched")
          ));
      });

      logAdminAudit({
        action: "MATCHING_REVIEW_REJECTED",
        adminId,
        adminRole,
        targetEntityType: "event_pool",
        targetEntityId: poolId,
        context: { reason },
      });

      res.json({ success: true, poolId });
    } catch (error: any) {
      if (error?.message === "POOL_NOT_PENDING") {
        return res.status(409).json({ message: "Pool review state changed by another request", poolId: req.params.id });
      }
      logger.error("[AdminMatchingReview] Failed to reject review", { error: String(error), poolId: req.params.id });
      res.status(500).json({ message: "Failed to reject review" });
    }
  });
}
