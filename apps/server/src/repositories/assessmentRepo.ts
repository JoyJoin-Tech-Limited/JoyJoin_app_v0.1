import {
  type InsertRoleResult,
  type RoleResult,
  type UserSocialTagGeneration,
  roleResults,
  userSocialTagGenerations,
  users,
} from "@shared/schema";
import { db } from "../db";
import { desc, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

export interface AssessmentRepository {
  saveTestResponses(userId: string, responses: Record<number, any>): Promise<void>;
  saveRoleResult(userId: string, result: InsertRoleResult): Promise<RoleResult>;
  getRoleResult(userId: string): Promise<RoleResult | undefined>;
  getPersonalityDistribution(): Promise<Record<string, number>>;
  getUserGeneratedTags(userId: string): Promise<UserSocialTagGeneration | undefined>;
  saveGeneratedTags(userId: string, data: { tags: any[]; generatedAt: Date; version: string; context: any }): Promise<void>;
  recordTagSelection(userId: string, data: { selectedIndex: number; selectedTag: string; selectedAt: Date }): Promise<void>;
}

// ─── Batch table-level ACOEXP lookup (M1.2b) ────────────────────────────────

/**
 * Roster-visible slice of `role_results`. Extraversion/affinity/emotional
 * stability only — openness/conscientiousness/positivity deliberately stay out
 * of the icebreaker persona boundary.
 */
export interface LatestRoleTraitScores {
  extraversion: number;
  affinity: number;
  emotionalStability: number;
}

/**
 * Hard cap on how many users one batch lookup may touch. Icebreaker tables are
 * small (≤ ~8); the cap exists so a pathological roster can never turn a prompt
 * enrichment into a wide scan.
 */
export const MAX_BATCH_ROLE_RESULT_USERS = 12;

/**
 * `role_results` carries two score scales: **only testVersion 1** is 0–10
 * (`roleTraits`); V2 (`matchResult.userTraits`) and V4 (`traitScores`) both
 * write 0–100. Normalize here once so every consumer averages comparable
 * numbers without inflating a V2 score of 8 into 80.
 */
export function normalizeRoleTraitScores(row: {
  extraversionScore?: number | null;
  affinityScore?: number | null;
  emotionalStabilityScore?: number | null;
  testVersion?: number | null;
}): LatestRoleTraitScores {
  const isV1 = row.testVersion === 1;
  const scale = (value: number | null | undefined): number => {
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : 50;
    // Only the legacy V1 0–10 rows are upscaled; V2 and V4 already write 0–100.
    const scaled = isV1 && numeric <= 10 ? numeric * 10 : numeric;
    return Math.min(100, Math.max(0, scaled));
  };
  return {
    extraversion: scale(row.extraversionScore),
    affinity: scale(row.affinityScore),
    emotionalStability: scale(row.emotionalStabilityScore),
  };
}

/**
 * Collapse rows already ordered newest-first into "latest result per user".
 * Pure so the ordering/dedupe rule is testable without a database.
 */
export function collapseLatestRoleResults(
  rows: ReadonlyArray<{
    userId: string;
    extraversionScore?: number | null;
    affinityScore?: number | null;
    emotionalStabilityScore?: number | null;
    testVersion?: number | null;
  }>,
): Map<string, LatestRoleTraitScores> {
  const latest = new Map<string, LatestRoleTraitScores>();
  for (const row of rows) {
    if (!row.userId || latest.has(row.userId)) continue;
    latest.set(row.userId, normalizeRoleTraitScores(row));
  }
  return latest;
}

/**
 * Dedupe + cap the batch input. Exported so the bound is testable without a
 * database and cannot drift from the query below.
 */
export function prepareBatchRoleResultUserIds(
  userIds: ReadonlyArray<string> | null | undefined,
): string[] {
  const uniqueIds: string[] = [];
  for (const raw of userIds ?? []) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!id || uniqueIds.includes(id)) continue;
    uniqueIds.push(id);
    if (uniqueIds.length >= MAX_BATCH_ROLE_RESULT_USERS) break;
  }
  return uniqueIds;
}

/**
 * Batch "latest role result per user" lookup — one query, newest `createdAt`
 * wins. Used by table-level persona derivation only; never called from the 3s
 * session poll.
 *
 * Callers must fail open: an empty map means "no ACOEXP signal", which the
 * persona treats as the archetype-composition fallback.
 */
export async function getLatestRoleResultsForUsers(
  userIds: ReadonlyArray<string>,
): Promise<Map<string, LatestRoleTraitScores>> {
  const uniqueIds = prepareBatchRoleResultUserIds(userIds);
  if (uniqueIds.length === 0) return new Map();

  const rows = await db
    .select({
      userId: roleResults.userId,
      extraversionScore: roleResults.extraversionScore,
      affinityScore: roleResults.affinityScore,
      emotionalStabilityScore: roleResults.emotionalStabilityScore,
      testVersion: roleResults.testVersion,
    })
    .from(roleResults)
    .where(inArray(roleResults.userId, uniqueIds))
    .orderBy(desc(roleResults.createdAt), desc(roleResults.id));

  return collapseLatestRoleResults(rows);
}

export const assessmentRepo: AssessmentRepository = {
  async saveTestResponses(_userId: string, _responses: Record<number, any>): Promise<void> {
    // Store test responses
    // Note: For simplicity, we're not implementing full question tracking
    // In production, you would map questionIds properly
    // This is a simplified implementation
  },

  async saveRoleResult(userId: string, result: InsertRoleResult): Promise<RoleResult> {
    return db.transaction(async (tx: NodePgDatabase<typeof schema>) => {
      await tx
        .update(users)
        .set({
          primaryArchetype: result.primaryArchetype,
          secondaryArchetype: result.secondaryArchetype,
          roleSubtype: result.roleSubtype,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      const [roleResult] = await tx
        .insert(roleResults)
        .values({
          ...result,
          userId,
        })
        .returning();

      return roleResult;
    });
  },

  async getRoleResult(userId: string): Promise<RoleResult | undefined> {
    const [result] = await db
      .select()
      .from(roleResults)
      .where(eq(roleResults.userId, userId))
      .orderBy(desc(roleResults.createdAt))
      .limit(1);

    return result;
  },

  async getPersonalityDistribution(): Promise<Record<string, number>> {
    const results = await db
      .select({
        primaryArchetype: users.primaryArchetype,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .where(sql`${users.primaryArchetype} IS NOT NULL`)
      .groupBy(users.primaryArchetype);

    const distribution: Record<string, number> = {};
    let total = 0;

    for (const row of results) {
      if (row.primaryArchetype) {
        distribution[row.primaryArchetype] = Number(row.count);
        total += Number(row.count);
      }
    }

    const percentages: Record<string, number> = {};
    for (const [role, count] of Object.entries(distribution)) {
      percentages[role] = total > 0 ? Math.round((count / total) * 100) : 0;
    }

    return percentages;
  },

  async getUserGeneratedTags(userId: string): Promise<UserSocialTagGeneration | undefined> {
    const [result] = await db
      .select()
      .from(userSocialTagGenerations)
      .where(eq(userSocialTagGenerations.userId, userId))
      .limit(1);

    return result;
  },

  async saveGeneratedTags(userId: string, data: { tags: any[]; generatedAt: Date; version: string; context: any }): Promise<void> {
    await db
      .insert(userSocialTagGenerations)
      .values({
        userId,
        tags: data.tags,
        generatedAt: data.generatedAt,
        generationVersion: data.version,
        generationContext: data.context,
      })
      .onConflictDoUpdate({
        target: [userSocialTagGenerations.userId],
        set: {
          tags: data.tags,
          generatedAt: data.generatedAt,
          generationVersion: data.version,
          generationContext: data.context,
          selectedIndex: null,
          selectedTag: null,
          selectedAt: null,
        },
      });
  },

  async recordTagSelection(userId: string, data: { selectedIndex: number; selectedTag: string; selectedAt: Date }): Promise<void> {
    await db.transaction(async (tx: NodePgDatabase<typeof schema>) => {
      await tx
        .update(users)
        .set({
          socialTag: data.selectedTag,
          socialTagSelectedAt: data.selectedAt,
        })
        .where(eq(users.id, userId));

      await tx
        .update(userSocialTagGenerations)
        .set({
          selectedIndex: data.selectedIndex,
          selectedTag: data.selectedTag,
          selectedAt: data.selectedAt,
        })
        .where(eq(userSocialTagGenerations.userId, userId));
    });
  },
};
