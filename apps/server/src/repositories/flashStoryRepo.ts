import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import {
  flashEncounters,
  flashNpcs,
  flashStoryEpisodes,
  flashStoryFragments,
  flashStorySeasons,
  flashUserStoryEpisodes,
  flashUserStoryFragments,
  flashUserStoryProgress,
} from "@shared/schema";

import { db } from "../db";

type DbExecutor = typeof db | any;

export async function getPublishedFlashStorySeason(executor: DbExecutor = db) {
  const [season] = await executor.select().from(flashStorySeasons)
    .where(eq(flashStorySeasons.status, "published"))
    .orderBy(desc(flashStorySeasons.publishedAt))
    .limit(1);
  return season ?? null;
}

export async function getFlashStoryReadiness(executor: DbExecutor = db) {
  const season = await getPublishedFlashStorySeason(executor);
  if (!season) return { publishedSeasons: 0, reviewedEpisodes: 0, coveredNpcs: 0 };
  const [[episodes], [npcs]] = await Promise.all([
    executor.select({ value: count() }).from(flashStoryEpisodes).where(and(
      eq(flashStoryEpisodes.seasonId, season.id),
      eq(flashStoryEpisodes.reviewStatus, "reviewed"),
      eq(flashStoryEpisodes.isActive, true),
    )),
    executor.select({ value: sql<number>`count(distinct ${flashStoryEpisodes.npcId})::int` }).from(flashStoryEpisodes).where(and(
      eq(flashStoryEpisodes.seasonId, season.id),
      eq(flashStoryEpisodes.reviewStatus, "reviewed"),
      eq(flashStoryEpisodes.isActive, true),
    )),
  ]);
  return { publishedSeasons: 1, reviewedEpisodes: Number(episodes?.value ?? 0), coveredNpcs: Number(npcs?.value ?? 0) };
}

export async function ensureFlashStoryEpisodeForEncounter(input: {
  encounterId: string;
  userId: string;
  npcId: string;
  now: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    const season = await getPublishedFlashStorySeason(tx);
    if (!season) return null;

    await tx.insert(flashUserStoryProgress).values({
      userId: input.userId,
      seasonId: season.id,
      currentPhase: 1,
      status: "active",
    }).onConflictDoNothing({ target: [flashUserStoryProgress.userId, flashUserStoryProgress.seasonId] });

    const [progress] = await tx.select().from(flashUserStoryProgress)
      .where(and(
        eq(flashUserStoryProgress.userId, input.userId),
        eq(flashUserStoryProgress.seasonId, season.id),
      )).limit(1);
    if (!progress || progress.status === "completed") return { season, progress, episode: null, alreadyCompleted: true };

    const [episode] = await tx.select().from(flashStoryEpisodes)
      .where(and(
        eq(flashStoryEpisodes.seasonId, season.id),
        eq(flashStoryEpisodes.npcId, input.npcId),
        eq(flashStoryEpisodes.phase, progress.currentPhase),
        eq(flashStoryEpisodes.reviewStatus, "reviewed"),
        eq(flashStoryEpisodes.isActive, true),
      )).limit(1);
    if (!episode) return { season, progress, episode: null, alreadyCompleted: false };

    const [completed] = await tx.select({ id: flashUserStoryEpisodes.id })
      .from(flashUserStoryEpisodes)
      .where(and(
        eq(flashUserStoryEpisodes.userId, input.userId),
        eq(flashUserStoryEpisodes.episodeId, episode.id),
      )).limit(1);

    await tx.update(flashEncounters).set({
      storyEpisodeId: episode.id,
      updatedAt: input.now,
    }).where(and(
      eq(flashEncounters.id, input.encounterId),
      eq(flashEncounters.userId, input.userId),
    ));
    return { season, progress, episode, alreadyCompleted: Boolean(completed) };
  });
}

export async function getFlashStoryEncounterState(encounterId: string, userId: string, executor: DbExecutor = db) {
  const [row] = await executor.select({
    episode: flashStoryEpisodes,
    seasonTitle: flashStorySeasons.title,
  }).from(flashEncounters)
    .innerJoin(flashStoryEpisodes, eq(flashEncounters.storyEpisodeId, flashStoryEpisodes.id))
    .innerJoin(flashStorySeasons, eq(flashStoryEpisodes.seasonId, flashStorySeasons.id))
    .where(and(eq(flashEncounters.id, encounterId), eq(flashEncounters.userId, userId)))
    .limit(1);
  if (!row) return null;

  const [[fragment], [completed], [phaseCount], [totalCount]] = await Promise.all([
    executor.select().from(flashStoryFragments)
      .where(eq(flashStoryFragments.episodeId, row.episode.id))
      .orderBy(asc(flashStoryFragments.sortOrder)).limit(1),
    executor.select().from(flashUserStoryEpisodes)
      .where(and(eq(flashUserStoryEpisodes.userId, userId), eq(flashUserStoryEpisodes.episodeId, row.episode.id))).limit(1),
    executor.select({ value: count() }).from(flashUserStoryEpisodes)
      .innerJoin(flashStoryEpisodes, eq(flashUserStoryEpisodes.episodeId, flashStoryEpisodes.id))
      .where(and(eq(flashUserStoryEpisodes.userId, userId), eq(flashStoryEpisodes.seasonId, row.episode.seasonId), eq(flashStoryEpisodes.phase, row.episode.phase))),
    executor.select({ value: count() }).from(flashUserStoryEpisodes)
      .innerJoin(flashStoryEpisodes, eq(flashUserStoryEpisodes.episodeId, flashStoryEpisodes.id))
      .where(and(eq(flashUserStoryEpisodes.userId, userId), eq(flashStoryEpisodes.seasonId, row.episode.seasonId))),
  ]);
  return {
    ...row,
    fragment: fragment ?? null,
    completion: completed ?? null,
    completedInPhase: Number(phaseCount?.value ?? 0),
    completedTotal: Number(totalCount?.value ?? 0),
  };
}

export async function getCompletedFlashStorySeason(userId: string, executor: DbExecutor = db) {
  const [row] = await executor.select({ season: flashStorySeasons, progress: flashUserStoryProgress })
    .from(flashUserStoryProgress)
    .innerJoin(flashStorySeasons, eq(flashUserStoryProgress.seasonId, flashStorySeasons.id))
    .where(and(
      eq(flashUserStoryProgress.userId, userId),
      eq(flashUserStoryProgress.status, "completed"),
      eq(flashStorySeasons.status, "published"),
    )).limit(1);
  return row ?? null;
}

export async function completeFlashStoryEpisode(input: {
  encounterId: string;
  userId: string;
  episodeId: string;
  optionId: string;
  now: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    // Serialize all story completions for one user so two different NPC
    // encounters cannot both miss the fifth-completion phase transition.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.userId}:flash-story`}))`);
    const [created] = await tx.insert(flashUserStoryEpisodes).values({
      userId: input.userId,
      episodeId: input.episodeId,
      encounterId: input.encounterId,
      selectedOptionId: input.optionId,
      completedAt: input.now,
    }).onConflictDoNothing({ target: [flashUserStoryEpisodes.userId, flashUserStoryEpisodes.episodeId] }).returning();

    const [episode] = await tx.select().from(flashStoryEpisodes)
      .where(eq(flashStoryEpisodes.id, input.episodeId)).limit(1);
    if (!episode) return null;

    if (created) {
      const fragments = await tx.select({ id: flashStoryFragments.id }).from(flashStoryFragments)
        .where(eq(flashStoryFragments.episodeId, episode.id));
      if (fragments.length) {
        await tx.insert(flashUserStoryFragments).values(fragments.map((fragment: { id: string }) => ({
          userId: input.userId,
          fragmentId: fragment.id,
          episodeId: episode.id,
          unlockedAt: input.now,
        }))).onConflictDoNothing();
      }
    }

    const [phaseCount] = await tx.select({ value: count() }).from(flashUserStoryEpisodes)
      .innerJoin(flashStoryEpisodes, eq(flashUserStoryEpisodes.episodeId, flashStoryEpisodes.id))
      .where(and(
        eq(flashUserStoryEpisodes.userId, input.userId),
        eq(flashStoryEpisodes.seasonId, episode.seasonId),
        eq(flashStoryEpisodes.phase, episode.phase),
      ));
    if (Number(phaseCount?.value ?? 0) >= 5) {
      await tx.update(flashUserStoryProgress).set({
        currentPhase: episode.phase === 3 ? 3 : episode.phase + 1,
        status: episode.phase === 3 ? "completed" : "active",
        completedAt: episode.phase === 3 ? input.now : null,
        updatedAt: input.now,
      }).where(and(
        eq(flashUserStoryProgress.userId, input.userId),
        eq(flashUserStoryProgress.seasonId, episode.seasonId),
        eq(flashUserStoryProgress.currentPhase, episode.phase),
      ));
    }
    await tx.update(flashEncounters).set({ status: "completed", completedAt: input.now, updatedAt: input.now })
      .where(and(eq(flashEncounters.id, input.encounterId), eq(flashEncounters.userId, input.userId)));
    return { created: Boolean(created) };
  });
}

export async function listFlashUserStoryFragments(userId: string, executor: DbExecutor = db) {
  return executor.select({
    id: flashStoryFragments.id,
    code: flashStoryFragments.code,
    category: flashStoryFragments.category,
    title: flashStoryFragments.title,
    fact: flashStoryFragments.fact,
    assetUrl: flashStoryFragments.assetUrl,
    unlockedAt: flashUserStoryFragments.unlockedAt,
    episodeTitle: flashStoryEpisodes.title,
    npcName: flashNpcs.name,
  }).from(flashUserStoryFragments)
    .innerJoin(flashStoryFragments, eq(flashUserStoryFragments.fragmentId, flashStoryFragments.id))
    .innerJoin(flashStoryEpisodes, eq(flashUserStoryFragments.episodeId, flashStoryEpisodes.id))
    .innerJoin(flashNpcs, eq(flashStoryEpisodes.npcId, flashNpcs.id))
    .where(eq(flashUserStoryFragments.userId, userId))
    .orderBy(asc(flashUserStoryFragments.unlockedAt));
}

export async function listFlashStoryAdmin(executor: DbExecutor = db) {
  const seasons = await executor.select().from(flashStorySeasons).orderBy(desc(flashStorySeasons.createdAt));
  const episodes = await executor.select({ episode: flashStoryEpisodes, npcName: flashNpcs.name, npcSlug: flashNpcs.slug })
    .from(flashStoryEpisodes).innerJoin(flashNpcs, eq(flashStoryEpisodes.npcId, flashNpcs.id))
    .orderBy(asc(flashStoryEpisodes.sortOrder));
  const fragments = await executor.select().from(flashStoryFragments).orderBy(asc(flashStoryFragments.sortOrder));
  return { seasons, episodes, fragments };
}

export async function updateFlashStoryEpisode(
  id: string,
  expectedVersion: number,
  values: Partial<typeof flashStoryEpisodes.$inferInsert>,
  fragment?: { category: string; title: string; fact: string; assetUrl?: string | null },
) {
  return db.transaction(async (tx: DbExecutor) => {
    const [row] = await tx.update(flashStoryEpisodes).set({
      ...values,
      contentVersion: expectedVersion + 1,
      reviewStatus: "draft",
      updatedAt: new Date(),
    }).where(and(eq(flashStoryEpisodes.id, id), eq(flashStoryEpisodes.contentVersion, expectedVersion))).returning();
    if (!row) return null;
    if (fragment) {
      await tx.update(flashStoryFragments).set({ ...fragment, updatedAt: new Date() })
        .where(eq(flashStoryFragments.episodeId, id));
    }
    return row;
  });
}

export async function reviewFlashStoryEpisode(id: string, expectedVersion: number) {
  const [row] = await db.update(flashStoryEpisodes).set({ reviewStatus: "reviewed", updatedAt: new Date() })
    .where(and(eq(flashStoryEpisodes.id, id), eq(flashStoryEpisodes.contentVersion, expectedVersion))).returning();
  return row ?? null;
}

export async function publishFlashStorySeason(id: string, actor: string, now = new Date()) {
  return db.transaction(async (tx: DbExecutor) => {
    const [counts] = await tx.select({ total: count(), reviewed: sql<number>`count(*) filter (where ${flashStoryEpisodes.reviewStatus} = 'reviewed' and ${flashStoryEpisodes.isActive} = true)::int` })
      .from(flashStoryEpisodes).where(eq(flashStoryEpisodes.seasonId, id));
    if (Number(counts?.total ?? 0) !== 15 || Number(counts?.reviewed ?? 0) !== 15) return null;
    await tx.update(flashStorySeasons).set({ status: "archived", updatedAt: now })
      .where(and(eq(flashStorySeasons.status, "published"), sql`${flashStorySeasons.id} <> ${id}`));
    const [season] = await tx.update(flashStorySeasons).set({ status: "published", publishedAt: now, publishedBy: actor, updatedAt: now })
      .where(eq(flashStorySeasons.id, id)).returning();
    return season ?? null;
  });
}
