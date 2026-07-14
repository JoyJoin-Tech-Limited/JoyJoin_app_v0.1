import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  alangMissions,
  alangMissionProgress,
  alangStoryArchives,
} from "@shared/schema";
import type {
  AlangMission,
  AlangMissionProgress,
  AlangStoryArchive,
  InsertAlangMission,
  InsertAlangMissionProgress,
  InsertAlangStoryArchive,
} from "@shared/schema";
import { missionContentSchema } from "@shared/alang/contentSchema";
import { logger } from "../lib/logger";

export async function getActiveMissions(): Promise<AlangMission[]> {
  return db
    .select()
    .from(alangMissions)
    .where(
      and(
        eq(alangMissions.status, "active"),
        eq(alangMissions.isInternalOnly, true)
      )
    )
    .orderBy(desc(alangMissions.createdAt))
    .limit(100);
}

export async function getMissionBySlug(slug: string): Promise<AlangMission | null> {
  const [row] = await db
    .select()
    .from(alangMissions)
    .where(eq(alangMissions.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function getActiveInternalMissionBySlug(
  slug: string
): Promise<AlangMission | null> {
  const [row] = await db
    .select()
    .from(alangMissions)
    .where(
      and(
        eq(alangMissions.slug, slug),
        eq(alangMissions.status, "active"),
        eq(alangMissions.isInternalOnly, true)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getMissionProgress(
  userId: string,
  missionId: string
): Promise<AlangMissionProgress | null> {
  const [row] = await db
    .select()
    .from(alangMissionProgress)
    .where(
      and(
        eq(alangMissionProgress.userId, userId),
        eq(alangMissionProgress.missionId, missionId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function getMissionProgresses(
  userId: string,
  missionIds: string[]
): Promise<AlangMissionProgress[]> {
  if (missionIds.length === 0) return [];
  return db
    .select()
    .from(alangMissionProgress)
    .where(
      and(
        eq(alangMissionProgress.userId, userId),
        inArray(alangMissionProgress.missionId, missionIds)
      )
    );
}

export async function createMissionProgress(
  data: InsertAlangMissionProgress
): Promise<AlangMissionProgress> {
  const [row] = await db
    .insert(alangMissionProgress)
    .values(data)
    .onConflictDoNothing({
      target: [alangMissionProgress.userId, alangMissionProgress.missionId],
    })
    .returning();
  if (!row) {
    const existing = await getMissionProgress(data.userId, data.missionId);
    if (!existing) throw new Error("ALANG_PROGRESS_CONFLICT_WITHOUT_ROW");
    return existing;
  }
  logger.info("[AlangRepo] Created mission progress", { userId: data.userId, missionId: data.missionId });
  return row;
}

export async function updateMissionProgress(
  progressId: string,
  updates: Partial<AlangMissionProgress>
): Promise<AlangMissionProgress | null> {
  const [row] = await db
    .update(alangMissionProgress)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(alangMissionProgress.id, progressId))
    .returning();
  return row ?? null;
}

/**
 * Compare-and-set transition for dialogue choices. Only the first request
 * observing the expected node may advance it; concurrent stale choices fail.
 */
export async function updateMissionProgressIfCurrent(
  progressId: string,
  expectedNodeId: string,
  updates: Partial<AlangMissionProgress>,
): Promise<AlangMissionProgress | null> {
  const [row] = await db
    .update(alangMissionProgress)
    .set({ ...updates, updatedAt: new Date() })
    .where(
      and(
        eq(alangMissionProgress.id, progressId),
        eq(alangMissionProgress.currentNodeId, expectedNodeId),
        eq(alangMissionProgress.status, "in_progress"),
      ),
    )
    .returning();
  return row ?? null;
}

export async function archiveStory(
  data: InsertAlangStoryArchive
): Promise<{ archive: AlangStoryArchive; created: boolean }> {
  const [row] = await db
    .insert(alangStoryArchives)
    .values(data)
    .onConflictDoNothing({ target: alangStoryArchives.progressId })
    .returning();
  if (!row) {
    const existing = await getStoryArchiveByProgressId(data.progressId);
    if (!existing) throw new Error("ALANG_ARCHIVE_CONFLICT_WITHOUT_ROW");
    return { archive: existing, created: false };
  }
  logger.info("[AlangRepo] Archived story", {
    userId: data.userId,
    missionId: data.missionId,
    progressId: data.progressId,
    archiveId: row.id,
  });
  return { archive: row, created: true };
}

export async function getStoryArchivesByUser(userId: string): Promise<AlangStoryArchive[]> {
  return db
    .select()
    .from(alangStoryArchives)
    .where(eq(alangStoryArchives.userId, userId))
    .orderBy(desc(alangStoryArchives.completedAt))
    .limit(100);
}

export async function getStoryArchiveByProgressId(
  progressId: string
): Promise<AlangStoryArchive | null> {
  const [row] = await db
    .select()
    .from(alangStoryArchives)
    .where(eq(alangStoryArchives.progressId, progressId))
    .limit(1);
  return row ?? null;
}

export async function getStoryArchiveById(
  archiveId: string
): Promise<AlangStoryArchive | null> {
  const [row] = await db
    .select()
    .from(alangStoryArchives)
    .where(eq(alangStoryArchives.id, archiveId))
    .limit(1);
  return row ?? null;
}

export async function deleteMissionProgress(
  userId: string,
  missionId: string
): Promise<{ deletedProgressCount: number; deletedArchiveCount: number }> {
  const result = await db.transaction(async (tx: typeof db) => {
    // Lock and confirm both record sets inside the same transaction before
    // deleting anything. Every predicate is derived from the authenticated
    // acting user; callers cannot supply a progress/archive id to broaden it.
    const [progress] = await tx
      .select({ id: alangMissionProgress.id })
      .from(alangMissionProgress)
      .where(
        and(
          eq(alangMissionProgress.userId, userId),
          eq(alangMissionProgress.missionId, missionId)
        )
      )
      .limit(1)
      .for("update");
    if (!progress) {
      return { deletedProgressCount: 0, deletedArchiveCount: 0 };
    }

    await tx
      .select({ id: alangStoryArchives.id })
      .from(alangStoryArchives)
      .where(
        and(
          eq(alangStoryArchives.userId, userId),
          eq(alangStoryArchives.missionId, missionId),
          eq(alangStoryArchives.progressId, progress.id)
        )
      )
      .for("update");

    const deletedArchives = await tx
      .delete(alangStoryArchives)
      .where(
        and(
          eq(alangStoryArchives.userId, userId),
          eq(alangStoryArchives.missionId, missionId),
          eq(alangStoryArchives.progressId, progress.id)
        )
      )
      .returning({ id: alangStoryArchives.id });
    const deletedProgresses = await tx
      .delete(alangMissionProgress)
      .where(
        and(
          eq(alangMissionProgress.id, progress.id),
          eq(alangMissionProgress.userId, userId),
          eq(alangMissionProgress.missionId, missionId)
        )
      )
      .returning({ id: alangMissionProgress.id });

    return {
      deletedProgressCount: deletedProgresses.length,
      deletedArchiveCount: deletedArchives.length,
    };
  });
  logger.info("[AlangRepo] Reset mission progress and archives", {
    userId,
    missionId,
    ...result,
  });
  return result;
}

export async function seedDemoMissionIfNeeded(): Promise<void> {
  const existing = await getMissionBySlug("alang-demo");
  if (existing) return;

  const rawContent = await import("../../content/alang/stories/demo-story.json", {
    assert: { type: "json" },
  }).then((m) => m.default);
  const content = missionContentSchema.parse(rawContent);

  await db
    .insert(alangMissions)
    .values({
      slug: "alang-demo",
      title: content.title,
      description: content.description,
      contentJson: content,
      targetLocation: content.meta?.defaultTargetLocation ?? null,
      companionEndLocation: content.meta?.defaultCompanionEndLocation ?? null,
      status: "active",
      isInternalOnly: true,
    })
    .onConflictDoNothing({ target: alangMissions.slug });

  logger.info("[AlangRepo] Ensured demo mission exists");
}
