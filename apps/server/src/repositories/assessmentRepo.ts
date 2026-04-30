import {
  type InsertRoleResult,
  type RoleResult,
  type UserSocialTagGeneration,
  roleResults,
  userSocialTagGenerations,
  users,
} from "@shared/schema";
import { db } from "../db";
import { desc, eq, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
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

export const assessmentRepo: AssessmentRepository = {
  async saveTestResponses(_userId: string, _responses: Record<number, any>): Promise<void> {
    // Store test responses
    // Note: For simplicity, we're not implementing full question tracking
    // In production, you would map questionIds properly
    // This is a simplified implementation
  },

  async saveRoleResult(userId: string, result: InsertRoleResult): Promise<RoleResult> {
    return db.transaction(async (tx: NeonDatabase<typeof schema>) => {
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
    await db.transaction(async (tx: NeonDatabase<typeof schema>) => {
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
