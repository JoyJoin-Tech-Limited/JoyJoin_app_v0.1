import { eventGroupOutcomes, eventPoolGroups, eventPoolRegistrations } from "@shared/schema";
import type { EventGroupOutcome } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { db } from "../db";

export interface EventGroupMembershipContext {
  group: typeof eventPoolGroups.$inferSelect;
  memberUserIds: string[];
  isMember: boolean;
}

export interface UpsertEventGroupOutcomeInput {
  poolId: string;
  groupId: string;
  submittedBy: string;
  atmosphereScore: number;
  wouldMeetAgain: boolean;
  connectionRadar: Record<string, number>;
  icebreakerRatings: Record<string, "helpful" | "neutral" | "awkward">;
  freeTextSignal?: string | null;
}

export interface UpsertEventGroupOutcomeResult {
  outcome: EventGroupOutcome;
}

export const eventGroupOutcomesRepo = {
  async getGroupMembershipContext(
    poolId: string,
    groupId: string,
    userId: string,
  ): Promise<EventGroupMembershipContext | null> {
    const [group] = await db
      .select()
      .from(eventPoolGroups)
      .where(and(eq(eventPoolGroups.id, groupId), eq(eventPoolGroups.poolId, poolId)))
      .limit(1);

    if (!group) {
      return null;
    }

    const registrations = await db
      .select({ userId: eventPoolRegistrations.userId })
      .from(eventPoolRegistrations)
      .where(eq(eventPoolRegistrations.assignedGroupId, groupId));

    const memberUserIds = registrations.map((registration: { userId: string }) => registration.userId);

    return {
      group,
      memberUserIds,
      isMember: memberUserIds.includes(userId),
    };
  },

  async upsertEventGroupOutcome(
    input: UpsertEventGroupOutcomeInput,
  ): Promise<UpsertEventGroupOutcomeResult> {
    const [group] = await db
      .select({ poolId: eventPoolGroups.poolId })
      .from(eventPoolGroups)
      .where(eq(eventPoolGroups.id, input.groupId))
      .limit(1);

    if (!group) {
      throw new Error(`Event group not found for upsert: ${input.groupId}`);
    }

    if (group.poolId !== input.poolId) {
      throw new Error(
        `Event group pool mismatch for upsert: expected ${group.poolId}, received ${input.poolId}`,
      );
    }

    const now = new Date();
    const [outcome] = await db
      .insert(eventGroupOutcomes)
      .values({
        poolId: group.poolId,
        groupId: input.groupId,
        submittedBy: input.submittedBy,
        atmosphereScore: input.atmosphereScore,
        wouldMeetAgain: input.wouldMeetAgain,
        connectionRadar: input.connectionRadar,
        icebreakerRatings: input.icebreakerRatings,
        freeTextSignal: input.freeTextSignal ?? null,
        submittedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [eventGroupOutcomes.groupId, eventGroupOutcomes.submittedBy],
        set: {
          atmosphereScore: input.atmosphereScore,
          wouldMeetAgain: input.wouldMeetAgain,
          connectionRadar: input.connectionRadar,
          icebreakerRatings: input.icebreakerRatings,
          freeTextSignal: input.freeTextSignal ?? null,
          updatedAt: now,
        },
      })
      .returning();

    return {
      outcome,
    };
  },
};
