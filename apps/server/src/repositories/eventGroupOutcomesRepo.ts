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
  replacedExisting: boolean;
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
    const [existing] = await db
      .select({ id: eventGroupOutcomes.id })
      .from(eventGroupOutcomes)
      .where(
        and(
          eq(eventGroupOutcomes.groupId, input.groupId),
          eq(eventGroupOutcomes.submittedBy, input.submittedBy),
        ),
      )
      .limit(1);

    const now = new Date();
    const [outcome] = await db
      .insert(eventGroupOutcomes)
      .values({
        poolId: input.poolId,
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
          poolId: input.poolId,
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
      replacedExisting: Boolean(existing),
    };
  },
};
