import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  eventGroupOutcomes,
  eventPoolGroups,
  eventPoolRegistrations,
  matchHistory,
} from "@shared/schema";

import { db } from "../db";

/**
 * Match history repository (Magnetism Engine Phase 0 / W1).
 *
 * `match_history` tracks which user pairs have been matched together before
 * (anti-repetition) and carries post-event pair feedback (`wouldMeetAgain`,
 * `connectionQuality`) derived from `event_group_outcomes`. The scoring path
 * preloads it once per matching run in `poolMatchingService.ts`.
 *
 * The table has NO unique constraint on (user1Id, user2Id, eventId), so
 * idempotent derivation cannot rely on ON CONFLICT. `syncMatchHistoryPairsForGroup`
 * instead serializes concurrent derivations for the same group with a
 * `FOR UPDATE` lock on the `event_pool_groups` row, then does a
 * select-then-insert/update merge inside the same transaction.
 */

export interface GroupDerivationSource {
  group: {
    id: string;
    poolId: string;
    eventId: string | null;
    createdAt: Date | null;
  };
  memberUserIds: string[];
  outcomes: Array<{
    submittedBy: string;
    wouldMeetAgain: boolean;
    atmosphereScore: number;
  }>;
}

export interface MatchHistoryPairSyncRow {
  user1Id: string;
  user2Id: string;
  eventId: string;
  matchedAt: Date;
  connectionQuality: number | null;
  wouldMeetAgain: boolean | null;
}

export interface MatchHistorySyncResult {
  insertedCount: number;
  updatedCount: number;
}

function pairKey(userA: string, userB: string): string {
  return [userA, userB].sort().join("|");
}

/**
 * Read everything the derivation needs for one group: the group row (event
 * linkage + match time), its members (registrations assigned to the group),
 * and all submitted outcomes.
 */
export async function getGroupDerivationSource(
  groupId: string,
): Promise<GroupDerivationSource | null> {
  const [group] = await db
    .select({
      id: eventPoolGroups.id,
      poolId: eventPoolGroups.poolId,
      eventId: eventPoolGroups.eventId,
      createdAt: eventPoolGroups.createdAt,
    })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.id, groupId))
    .limit(1);

  if (!group) {
    return null;
  }

  // Deterministic ordering (W4 AC-W4.6): pair derivation must read the same
  // member and outcome sequence on every run, independent of physical row
  // order. `buildPairRowsForGroup` sorts the member ids, but the outcome
  // lookup map and any future order-sensitive consumers rely on stable reads.
  const registrations = await db
    .select({ userId: eventPoolRegistrations.userId })
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.assignedGroupId, groupId))
    .orderBy(eventPoolRegistrations.userId);

  const outcomes = await db
    .select({
      submittedBy: eventGroupOutcomes.submittedBy,
      wouldMeetAgain: eventGroupOutcomes.wouldMeetAgain,
      atmosphereScore: eventGroupOutcomes.atmosphereScore,
    })
    .from(eventGroupOutcomes)
    .where(eq(eventGroupOutcomes.groupId, groupId))
    .orderBy(eventGroupOutcomes.submittedBy);

  return {
    group,
    memberUserIds: registrations.map(
      (registration: { userId: string }) => registration.userId,
    ),
    outcomes,
  };
}

/**
 * Idempotently merge derived pair rows into `match_history`.
 *
 * - Serialized per group via `SELECT ... FOR UPDATE` on the group row, so two
 *   members submitting outcomes at the same time cannot double-insert a pair.
 * - Existing pair rows (same event + unordered pair) are updated in place;
 *   `matchedAt` is preserved from the original insert (no drift on re-run).
 * - `connectionPointTypes` is intentionally left untouched: outcomes carry no
 *   connection-point-type signal, so the column stays null until one exists.
 */
export async function syncMatchHistoryPairsForGroup(input: {
  groupId: string;
  eventId: string;
  rows: MatchHistoryPairSyncRow[];
}): Promise<MatchHistorySyncResult> {
  if (input.rows.length === 0) {
    return { insertedCount: 0, updatedCount: 0 };
  }

  return db.transaction(async (tx: any) => {
    const [groupLock] = await tx
      .select({ id: eventPoolGroups.id })
      .from(eventPoolGroups)
      .where(eq(eventPoolGroups.id, input.groupId))
      .limit(1)
      .for("update");

    if (!groupLock) {
      throw new Error(
        `Cannot sync match history: group not found: ${input.groupId}`,
      );
    }

    const memberUserIds = [
      ...new Set(input.rows.flatMap((row) => [row.user1Id, row.user2Id])),
    ];
    const existingRows = await tx
      .select()
      .from(matchHistory)
      .where(
        and(
          eq(matchHistory.eventId, input.eventId),
          inArray(matchHistory.user1Id, memberUserIds),
          inArray(matchHistory.user2Id, memberUserIds),
        ),
      );

    const existingByPairKey = new Map<string, typeof matchHistory.$inferSelect>(
      (existingRows as Array<typeof matchHistory.$inferSelect>).map((row) => [
        pairKey(row.user1Id, row.user2Id),
        row,
      ]),
    );

    let insertedCount = 0;
    let updatedCount = 0;

    const rowsToInsert: Array<typeof matchHistory.$inferInsert> = [];
    const rowsToUpdate: Array<{
      id: string;
      connectionQuality: number | null;
      wouldMeetAgain: boolean | null;
    }> = [];

    for (const row of input.rows) {
      const existing = existingByPairKey.get(pairKey(row.user1Id, row.user2Id));

      if (existing) {
        rowsToUpdate.push({
          id: existing.id,
          connectionQuality: row.connectionQuality,
          wouldMeetAgain: row.wouldMeetAgain,
        });
      } else {
        rowsToInsert.push({
          user1Id: row.user1Id,
          user2Id: row.user2Id,
          eventId: row.eventId,
          matchedAt: row.matchedAt,
          connectionQuality: row.connectionQuality,
          wouldMeetAgain: row.wouldMeetAgain,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const result = await tx.insert(matchHistory).values(rowsToInsert);
      insertedCount = result?.rowCount ?? rowsToInsert.length;
    }

    if (rowsToUpdate.length > 0) {
      await tx.execute(sql`
        UPDATE match_history AS m
        SET connection_quality = v.connection_quality,
            would_meet_again = v.would_meet_again
        FROM (VALUES
          ${sql.join(
            rowsToUpdate.map(
              (r) => sql`(${r.id}, ${r.connectionQuality}, ${r.wouldMeetAgain})`,
            ),
            sql`, `,
          )}
        ) AS v(id, connection_quality, would_meet_again)
        WHERE m.id = v.id
      `);
      updatedCount = rowsToUpdate.length;
    }

    return { insertedCount, updatedCount };
  });
}

/**
 * All groups that have at least one submitted outcome — the backfill candidate set.
 */
export async function listGroupIdsWithSubmittedOutcomes(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ groupId: eventGroupOutcomes.groupId })
    .from(eventGroupOutcomes)
    .orderBy(eventGroupOutcomes.groupId);

  return rows.map((row: { groupId: string }) => row.groupId);
}

/**
 * W6 AC-W6.6b — self-scoped reset/appeal. Clears only the NEGATIVE signal
 * (`would_meet_again = false`) on every pair the caller belongs to. Positive
 * feedback (`would_meet_again = true`) and `connection_quality` are preserved,
 * so the +5 re-match bonus survives while the -1 hard skip is lifted.
 *
 * Idempotent: a repeated call matches zero rows and returns 0. Returns the
 * number of cleared rows for observability.
 */
export async function clearNegativeMatchHistoryForUser(userId: string): Promise<number> {
  const result = await db
    .update(matchHistory)
    .set({ wouldMeetAgain: null })
    .where(
      and(
        or(eq(matchHistory.user1Id, userId), eq(matchHistory.user2Id, userId)),
        eq(matchHistory.wouldMeetAgain, false),
      ),
    );
  return result?.rowCount ?? 0;
}
