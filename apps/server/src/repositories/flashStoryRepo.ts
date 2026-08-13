import { createHash, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  flashEncounters,
  flashNpcs,
  flashStoryEpisodes,
  flashStoryChoiceIntents,
  flashStoryFragments,
  flashStoryReleaseSnapshots,
  flashStorySeasons,
  flashStoryUniverseRuns,
  flashUserStoryEpisodes,
  flashUserStoryFragments,
  flashUserStoryProgress,
} from "@shared/schema";
import { FLASH_STORY_PERSONALIZATION_CONSENT_VERSION } from "@shared/alang/flashTypes";
import {
  applyFlashChoiceEffects,
  effectsForFlashChoice,
  EMPTY_FLASH_UNIVERSE_VECTOR,
  FLASH_STORY_ENDING_COPY,
  resolveFlashStoryEnding,
  type FlashStoryMode,
  classifyFlashChoiceIntent,
} from "@joyjoin/shared/alang/parallelUniverse";

import { db } from "../db";
import {
  hasCompletedPriorNpcPhases,
  isFlashStorySeasonComplete,
  selectNextNpcStoryEpisode,
} from "../lib/flashStoryProgression";
import {
  advanceStoryNode as advanceV2StoryNode,
  answerStoryChoice as answerV2StoryChoice,
  enterStoryEpisode as enterV2StoryEpisode,
  getStoryNodeView as getV2StoryNodeView,
  resolveV2Ending,
} from "../services/flashStoryEngine";

type DbExecutor = typeof db | any;

const FLASH_STORY_GENERATION_LEASE_MS = 6_000;

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function prepareFlashStoryChoiceIntent(input: {
  userId: string;
  encounterId: string;
  episodeId: string;
  questionId: string;
  optionId: string;
  storyAnswers?: Array<{ questionId: string; optionId: string; tags: string[] }>;
  now: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.encounterId}:flash-story-choice`}))`);
    const [encounter] = await tx.select({ answers: flashEncounters.answers }).from(flashEncounters).where(and(
      eq(flashEncounters.id, input.encounterId),
      eq(flashEncounters.userId, input.userId),
      eq(flashEncounters.storyEpisodeId, input.episodeId),
    )).limit(1);
    if (!encounter) return { state: "conflict" as const, intent: null };
    await tx.insert(flashStoryChoiceIntents).values({
      userId: input.userId,
      encounterId: input.encounterId,
      episodeId: input.episodeId,
      questionId: input.questionId,
      optionId: input.optionId,
      createdAt: input.now,
      updatedAt: input.now,
    }).onConflictDoNothing({ target: [flashStoryChoiceIntents.userId, flashStoryChoiceIntents.episodeId] });
    const [intent] = await tx.select().from(flashStoryChoiceIntents).where(and(
      eq(flashStoryChoiceIntents.userId, input.userId),
      eq(flashStoryChoiceIntents.episodeId, input.episodeId),
    )).limit(1);
    if (intent && intent.encounterId !== input.encounterId) return { state: "conflict" as const, intent };
    const action = classifyFlashChoiceIntent({ stored: intent ?? null, ...input });
    if (action === "conflict") {
      return { state: "conflict" as const, intent: intent ?? null };
    }
    if (input.storyAnswers?.length) {
      const existingAnswers = encounter.answers ?? [];
      const existingStoryAnswers = existingAnswers.filter(
        (answer: { questionId: string; optionId: string; tags: string[] }) => answer.tags.includes("story_path"),
      );
      if (existingStoryAnswers.length && stableHash(existingStoryAnswers) !== stableHash(input.storyAnswers)) {
        return { state: "conflict" as const, intent: intent ?? null };
      }
      if (!existingStoryAnswers.length) {
        await tx.update(flashEncounters).set({
          answers: [...existingAnswers, ...input.storyAnswers],
          updatedAt: input.now,
        }).where(and(eq(flashEncounters.id, input.encounterId), eq(flashEncounters.userId, input.userId)));
      }
    }
    if (!intent) throw new Error("FLASH_STORY_CHOICE_INTENT_INSERT_FAILED");
    if (action === "ready") {
      return { state: "ready" as const, intent };
    }
    if (action === "pending") {
      return { state: "pending" as const, intent };
    }
    const leaseToken = randomUUID();
    const observedGuard = intent.status === "generating"
      ? and(
          eq(flashStoryChoiceIntents.status, "generating"),
          eq(flashStoryChoiceIntents.leaseToken, intent.leaseToken!),
          eq(flashStoryChoiceIntents.leaseExpiresAt, intent.leaseExpiresAt!),
        )
      : eq(flashStoryChoiceIntents.status, "pending");
    const [claimed] = await tx.update(flashStoryChoiceIntents).set({
      status: "generating",
      leaseToken,
      leaseExpiresAt: new Date(input.now.getTime() + FLASH_STORY_GENERATION_LEASE_MS),
      attemptCount: intent.attemptCount + 1,
      updatedAt: input.now,
    }).where(and(eq(flashStoryChoiceIntents.id, intent.id), observedGuard)).returning();
    if (claimed) return { state: "claimed" as const, intent: claimed, leaseToken };
    const [latest] = await tx.select().from(flashStoryChoiceIntents).where(eq(flashStoryChoiceIntents.id, intent.id)).limit(1);
    const latestAction = classifyFlashChoiceIntent({ stored: latest ?? null, ...input });
    if (latestAction === "ready") return { state: "ready" as const, intent: latest };
    return { state: latestAction === "conflict" ? "conflict" as const : "pending" as const, intent: latest ?? intent };
  });
}

export async function advanceFlashV2Node(input: {
  userId: string;
  encounterId: string;
  episodeId: string;
  now: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.encounterId}:flash-story-v2`}))`);
    const [episode] = await tx.select().from(flashStoryEpisodes)
      .where(eq(flashStoryEpisodes.id, input.episodeId)).limit(1);
    if (!episode) return { state: "conflict" as const, finished: false };
    const content = episode.content as { v?: number; start?: string; nodes?: Record<string, unknown> };
    if (content.v !== 2) return { state: "conflict" as const, finished: false };
    const [encounter] = await tx.select({ id: flashEncounters.id }).from(flashEncounters).where(and(
      eq(flashEncounters.id, input.encounterId),
      eq(flashEncounters.userId, input.userId),
      eq(flashEncounters.storyEpisodeId, input.episodeId),
    )).limit(1);
    if (!encounter) return { state: "conflict" as const, finished: false };
    const [progress] = await tx.select().from(flashUserStoryProgress).where(and(
      eq(flashUserStoryProgress.userId, input.userId),
      eq(flashUserStoryProgress.seasonId, episode.seasonId),
    )).limit(1);
    if (!progress || progress.status !== "active") return { state: "conflict" as const, finished: false };
    const [run] = progress.universeRunId
      ? await tx.select().from(flashStoryUniverseRuns).where(eq(flashStoryUniverseRuns.id, progress.universeRunId)).limit(1)
      : [];
    if (!run) return { state: "conflict" as const, finished: false };

    const currentState: Parameters<typeof enterV2StoryEpisode>[1] = {
      echo: run.v2State?.echo ?? 0,
      flags: run.flags ?? [],
      variables: run.v2State?.variables ?? {},
      currentNode: run.currentNode ?? null,
      nodePath: run.nodePath ?? [],
    };
    const entered = enterV2StoryEpisode(content as any, currentState);
    let result: ReturnType<typeof advanceV2StoryNode>;
    try {
      result = advanceV2StoryNode({ content: content as any, state: entered });
    } catch {
      return { state: "conflict" as const, finished: false };
    }
    await tx.update(flashStoryUniverseRuns).set({
      currentNode: result.state.currentNode,
      nodePath: result.state.nodePath,
      stateVersion: run.stateVersion + 1,
      updatedAt: input.now,
    }).where(and(eq(flashStoryUniverseRuns.id, run.id), eq(flashStoryUniverseRuns.stateVersion, run.stateVersion)));
    if (!result.finished) return { state: "advanced" as const, finished: false };
    await tx.update(flashEncounters).set({ status: "completed", completedAt: input.now, updatedAt: input.now })
      .where(and(eq(flashEncounters.id, input.encounterId), eq(flashEncounters.userId, input.userId)));
    return { state: "finished" as const, finished: true };
  });
}

export async function getReadyFlashStoryChoiceIntent(userId: string, episodeId: string, executor: DbExecutor = db) {
  const [row] = await executor.select().from(flashStoryChoiceIntents).where(and(
    eq(flashStoryChoiceIntents.userId, userId),
    eq(flashStoryChoiceIntents.episodeId, episodeId),
    eq(flashStoryChoiceIntents.status, "completed"),
  )).limit(1);
  return row ?? null;
}

export async function advanceFlashV2Run(input: {
  userId: string;
  encounterId: string;
  episodeId: string;
  nodeId: string;
  choiceId: string;
  now: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.encounterId}:flash-story-v2`}))`);
    const [episode] = await tx.select().from(flashStoryEpisodes)
      .where(eq(flashStoryEpisodes.id, input.episodeId)).limit(1);
    if (!episode) return { state: "conflict" as const, finished: false };
    const content = episode.content as { v?: number; start?: string; nodes?: Record<string, unknown> };
    if (content.v !== 2) return { state: "conflict" as const, finished: false };
    const [encounter] = await tx.select({ id: flashEncounters.id }).from(flashEncounters).where(and(
      eq(flashEncounters.id, input.encounterId),
      eq(flashEncounters.userId, input.userId),
      eq(flashEncounters.storyEpisodeId, input.episodeId),
    )).limit(1);
    if (!encounter) return { state: "conflict" as const, finished: false };
    const [progress] = await tx.select().from(flashUserStoryProgress).where(and(
      eq(flashUserStoryProgress.userId, input.userId),
      eq(flashUserStoryProgress.seasonId, episode.seasonId),
    )).limit(1);
    if (!progress || progress.status !== "active") return { state: "conflict" as const, finished: false };
    const [run] = progress.universeRunId
      ? await tx.select().from(flashStoryUniverseRuns).where(eq(flashStoryUniverseRuns.id, progress.universeRunId)).limit(1)
      : [];
    if (!run) return { state: "conflict" as const, finished: false };

    const currentState: Parameters<typeof enterV2StoryEpisode>[1] = {
      echo: run.v2State?.echo ?? 0,
      flags: run.flags ?? [],
      variables: run.v2State?.variables ?? {},
      currentNode: run.currentNode ?? null,
      nodePath: run.nodePath ?? [],
    };
    const entered = enterV2StoryEpisode(content as any, currentState);
    const view = getV2StoryNodeView(content as any, entered);
    if (!view || view.type !== "choice" || view.nodeId !== input.nodeId) {
      return { state: "conflict" as const, finished: false };
    }
    let result: ReturnType<typeof answerV2StoryChoice>;
    try {
      result = answerV2StoryChoice({ content: content as any, state: entered, nodeId: input.nodeId, choiceId: input.choiceId });
    } catch {
      return { state: "conflict" as const, finished: false };
    }
    await tx.update(flashStoryUniverseRuns).set({
      currentNode: result.state.currentNode,
      nodePath: result.state.nodePath,
      flags: result.state.flags,
      v2State: { echo: result.state.echo, variables: result.state.variables },
      stateVersion: run.stateVersion + 1,
      updatedAt: input.now,
    }).where(and(eq(flashStoryUniverseRuns.id, run.id), eq(flashStoryUniverseRuns.stateVersion, run.stateVersion)));
    if (!result.finished) return { state: "advanced" as const, finished: false };
    await tx.update(flashEncounters).set({ status: "completed", completedAt: input.now, updatedAt: input.now })
      .where(and(eq(flashEncounters.id, input.encounterId), eq(flashEncounters.userId, input.userId)));
    return { state: "finished" as const, finished: true };
  });
}

export async function finalizeFlashStoryChoiceIntent(input: {
  intentId: string;
  leaseToken: string;
  responseSnapshot: string;
  renderKind: "template" | "ai" | "fallback";
  promptVersion: string | null;
  lastErrorCode?: string | null;
  now: Date;
}) {
  const [row] = await db.update(flashStoryChoiceIntents).set({
    status: "completed",
    responseSnapshot: input.responseSnapshot,
    renderKind: input.renderKind,
    promptVersion: input.promptVersion,
    lastErrorCode: input.lastErrorCode ?? null,
    leaseToken: null,
    leaseExpiresAt: null,
    completedAt: input.now,
    updatedAt: input.now,
  }).where(and(
    eq(flashStoryChoiceIntents.id, input.intentId),
    eq(flashStoryChoiceIntents.leaseToken, input.leaseToken),
    eq(flashStoryChoiceIntents.status, "generating"),
  )).returning();
  return row ?? null;
}

export async function getCurrentFlashStoryRelease(executor: DbExecutor = db) {
  const [release] = await executor.select().from(flashStoryReleaseSnapshots)
    .where(eq(flashStoryReleaseSnapshots.status, "published"))
    .orderBy(desc(flashStoryReleaseSnapshots.publishedAt))
    .limit(1);
  return release ?? null;
}

export async function getActiveFlashUniverseRun(userId: string, releaseSnapshotId?: string, executor: DbExecutor = db) {
  const [run] = await executor.select().from(flashStoryUniverseRuns)
    .where(and(
      eq(flashStoryUniverseRuns.userId, userId),
      eq(flashStoryUniverseRuns.status, "active"),
      releaseSnapshotId ? eq(flashStoryUniverseRuns.releaseSnapshotId, releaseSnapshotId) : undefined,
    ))
    .orderBy(desc(flashStoryUniverseRuns.updatedAt))
    .limit(1);
  return run ?? null;
}

async function ensureFlashUniverseRun(input: {
  userId: string;
  mode: FlashStoryMode;
  consentVersion?: string | null;
  now: Date;
  executor: DbExecutor;
}) {
  await input.executor.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.userId}:flash-story`}))`);
  if (input.mode === "personalized" && input.consentVersion !== FLASH_STORY_PERSONALIZATION_CONSENT_VERSION) {
    return null;
  }
  const release = await getCurrentFlashStoryRelease(input.executor);
  if (!release) return null;
  const existing = await getActiveFlashUniverseRun(input.userId, release.id, input.executor);
  if (existing) {
    if (existing.mode === input.mode) return existing;
    const [updated] = await input.executor.update(flashStoryUniverseRuns).set({
      mode: input.mode,
      consentVersion: input.mode === "personalized" ? input.consentVersion : null,
      consentedAt: input.mode === "personalized" ? input.now : null,
      stateVersion: existing.stateVersion + 1,
      updatedAt: input.now,
    }).where(and(
      eq(flashStoryUniverseRuns.id, existing.id),
      eq(flashStoryUniverseRuns.stateVersion, existing.stateVersion),
    )).returning();
    return updated ?? await getActiveFlashUniverseRun(input.userId, release.id, input.executor);
  }
  const [created] = await input.executor.insert(flashStoryUniverseRuns).values({
    userId: input.userId,
    releaseSnapshotId: release.id,
    mode: input.mode,
    universeVector: EMPTY_FLASH_UNIVERSE_VECTOR,
    flags: [],
    echoQueue: [],
    consentVersion: input.mode === "personalized" ? input.consentVersion : null,
    consentedAt: input.mode === "personalized" ? input.now : null,
    createdAt: input.now,
    updatedAt: input.now,
  }).onConflictDoNothing({ target: [flashStoryUniverseRuns.userId, flashStoryUniverseRuns.releaseSnapshotId] }).returning();
  if (created) return created;
  const [concurrent] = await input.executor.select().from(flashStoryUniverseRuns).where(and(
    eq(flashStoryUniverseRuns.userId, input.userId),
    eq(flashStoryUniverseRuns.releaseSnapshotId, release.id),
  )).limit(1);
  return concurrent ?? null;
}

export async function getPublishedFlashStorySeason(executor: DbExecutor = db) {
  const [season] = await executor.select().from(flashStorySeasons)
    .where(eq(flashStorySeasons.status, "published"))
    .orderBy(desc(flashStorySeasons.publishedAt))
    .limit(1);
  return season ?? null;
}

export async function getFlashStoryReadiness(executor: DbExecutor = db) {
  const season = await getPublishedFlashStorySeason(executor);
  if (!season) return { publishedSeasons: 0, currentReleases: 0, reviewedEpisodes: 0, coveredNpcs: 0 };
  const [[releases], [episodes], [npcs]] = await Promise.all([
    executor.select({ value: count() }).from(flashStoryReleaseSnapshots).where(eq(flashStoryReleaseSnapshots.status, "published")),
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
  return { publishedSeasons: 1, currentReleases: Number(releases?.value ?? 0), reviewedEpisodes: Number(episodes?.value ?? 0), coveredNpcs: Number(npcs?.value ?? 0) };
}

export async function ensureFlashStoryEpisodeForEncounter(input: {
  encounterId: string;
  userId: string;
  npcId: string;
  now: Date;
  mode?: FlashStoryMode;
  consentVersion?: string | null;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    const season = await getPublishedFlashStorySeason(tx);
    if (!season) return null;

    const run = await ensureFlashUniverseRun({
      userId: input.userId,
      mode: input.mode ?? "standard",
      consentVersion: input.consentVersion,
      now: input.now,
      executor: tx,
    });
    if (!run) return null;

    await tx.insert(flashUserStoryProgress).values({
      userId: input.userId,
      seasonId: season.id,
      universeRunId: run.id,
      currentPhase: 1,
      status: "active",
    }).onConflictDoNothing({ target: [flashUserStoryProgress.userId, flashUserStoryProgress.seasonId] });
    await tx.update(flashUserStoryProgress).set({ universeRunId: run.id, updatedAt: input.now }).where(and(
      eq(flashUserStoryProgress.userId, input.userId),
      eq(flashUserStoryProgress.seasonId, season.id),
      sql`${flashUserStoryProgress.universeRunId} is null`,
    ));

    const [progress] = await tx.select().from(flashUserStoryProgress)
      .where(and(
        eq(flashUserStoryProgress.userId, input.userId),
        eq(flashUserStoryProgress.seasonId, season.id),
      )).limit(1);
    if (!progress || progress.status === "completed") {
      await tx.update(flashEncounters).set({
        status: "completed",
        completedAt: input.now,
        updatedAt: input.now,
      }).where(and(
        eq(flashEncounters.id, input.encounterId),
        eq(flashEncounters.userId, input.userId),
      ));
      return { season, progress, episode: null, alreadyCompleted: true };
    }

    const episodes = await tx.select().from(flashStoryEpisodes)
      .where(and(
        eq(flashStoryEpisodes.seasonId, season.id),
        eq(flashStoryEpisodes.npcId, input.npcId),
        eq(flashStoryEpisodes.reviewStatus, "reviewed"),
        eq(flashStoryEpisodes.isActive, true),
      )).orderBy(asc(flashStoryEpisodes.phase));
    if (!episodes.length) return { season, run, progress, episode: null, alreadyCompleted: false };
    const completedEpisodes = await tx.select({ episodeId: flashUserStoryEpisodes.episodeId })
      .from(flashUserStoryEpisodes)
      .where(and(
        eq(flashUserStoryEpisodes.userId, input.userId),
        inArray(flashUserStoryEpisodes.episodeId, episodes.map((episode: any) => episode.id)),
      ));
    const episode = selectNextNpcStoryEpisode(
      episodes,
      new Set(completedEpisodes.map((completed: any) => completed.episodeId)),
    );
    if (!episode) {
      await tx.update(flashEncounters).set({
        status: "completed",
        completedAt: input.now,
        updatedAt: input.now,
      }).where(and(
        eq(flashEncounters.id, input.encounterId),
        eq(flashEncounters.userId, input.userId),
      ));
      return { season, run, progress, episode: null, alreadyCompleted: true };
    }

    await tx.update(flashEncounters).set({
      storyEpisodeId: episode.id,
      status: "dialogue",
      completedAt: null,
      updatedAt: input.now,
    }).where(and(
      eq(flashEncounters.id, input.encounterId),
      eq(flashEncounters.userId, input.userId),
    ));
    return { season, run, progress, episode, alreadyCompleted: false };
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

  const [progress] = await executor.select().from(flashUserStoryProgress).where(and(
    eq(flashUserStoryProgress.userId, userId),
    eq(flashUserStoryProgress.seasonId, row.episode.seasonId),
  )).limit(1);
  const [runWithRelease] = progress?.universeRunId
    ? await executor.select({ run: flashStoryUniverseRuns, release: flashStoryReleaseSnapshots })
      .from(flashStoryUniverseRuns)
      .innerJoin(flashStoryReleaseSnapshots, eq(flashStoryUniverseRuns.releaseSnapshotId, flashStoryReleaseSnapshots.id))
      .where(eq(flashStoryUniverseRuns.id, progress.universeRunId)).limit(1)
    : [];
  const pinnedEpisode = runWithRelease?.release.manifest.episodes.find((episode: any) => episode.code === row.episode.code);
  const resolvedEpisode = pinnedEpisode ? {
    ...row.episode,
    title: pinnedEpisode.title,
    objectCode: pinnedEpisode.objectCode,
    contentVersion: pinnedEpisode.contentVersion,
    content: pinnedEpisode.content,
  } : row.episode;

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
    episode: resolvedEpisode,
    universeRun: runWithRelease?.run ?? null,
    fragment: pinnedEpisode?.fragment ?? fragment ?? null,
    completion: completed ?? null,
    completedInPhase: Number(phaseCount?.value ?? 0),
    completedTotal: Number(totalCount?.value ?? 0),
  };
}

export async function getCompletedFlashStorySeason(userId: string, seasonId?: string, executor: DbExecutor = db) {
  const [row] = await executor.select({ season: flashStorySeasons, progress: flashUserStoryProgress, run: flashStoryUniverseRuns })
    .from(flashUserStoryProgress)
    .innerJoin(flashStorySeasons, eq(flashUserStoryProgress.seasonId, flashStorySeasons.id))
    .leftJoin(flashStoryUniverseRuns, eq(flashUserStoryProgress.universeRunId, flashStoryUniverseRuns.id))
    .where(and(
      eq(flashUserStoryProgress.userId, userId),
      eq(flashUserStoryProgress.status, "completed"),
      seasonId ? eq(flashUserStoryProgress.seasonId, seasonId) : undefined,
    )).limit(1);
  return row ?? null;
}

export async function getFlashStoryEndingRecap(userId: string, runId: string, executor: DbExecutor = db) {
  const [runWithRelease] = await executor.select({ run: flashStoryUniverseRuns, release: flashStoryReleaseSnapshots })
    .from(flashStoryUniverseRuns)
    .innerJoin(flashStoryReleaseSnapshots, eq(flashStoryUniverseRuns.releaseSnapshotId, flashStoryReleaseSnapshots.id))
    .where(and(eq(flashStoryUniverseRuns.id, runId), eq(flashStoryUniverseRuns.userId, userId)))
    .limit(1);
  if (!runWithRelease) return null;
  const rows = await executor.select({
    episodeCode: flashStoryEpisodes.code,
    selectedOptionId: flashUserStoryEpisodes.selectedOptionId,
    effects: flashUserStoryEpisodes.effectSnapshot,
    completedAt: flashUserStoryEpisodes.completedAt,
  }).from(flashUserStoryEpisodes)
    .innerJoin(flashStoryEpisodes, eq(flashUserStoryEpisodes.episodeId, flashStoryEpisodes.id))
    .where(and(eq(flashUserStoryEpisodes.userId, userId), eq(flashUserStoryEpisodes.universeRunId, runId)))
    .orderBy(asc(flashUserStoryEpisodes.completedAt));
  const highlights = rows.map((row: any) => {
    const episode = runWithRelease.release.manifest.episodes.find((item: any) => item.code === row.episodeCode);
    const option = episode?.content.question.options.find((item: any) => item.id === row.selectedOptionId);
    const weight = (row.effects ?? []).reduce((sum: number, effect: any) => sum + Math.abs(effect.delta), 0);
    return { episodeTitle: episode?.title ?? row.episodeCode, optionLabel: option?.label ?? "你当时的选择", weight };
  }).sort((a: any, b: any) => b.weight - a.weight).slice(0, 3).map(({ episodeTitle, optionLabel }: any) => ({ episodeTitle, optionLabel }));
  const ending = runWithRelease.release.manifest.endings.find((item: any) => item.code === runWithRelease.run.endingCode) ?? null;
  return { vector: runWithRelease.run.universeVector, highlights, ending };
}

export async function completeFlashStoryEpisode(input: {
  encounterId: string;
  userId: string;
  episodeId: string;
  optionId: string;
  configuredEffects?: Parameters<typeof effectsForFlashChoice>[1];
  responseSnapshot?: string | null;
  renderKind?: "template" | "ai" | "fallback";
  promptVersion?: string | null;
  now: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    // Serialize all story completions for one user so two different NPC
    // encounters cannot both miss the fifth-completion phase transition.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${input.userId}:flash-story`}))`);
    const [episode] = await tx.select().from(flashStoryEpisodes)
      .where(eq(flashStoryEpisodes.id, input.episodeId)).limit(1);
    if (!episode) return null;
    const [encounter] = await tx.select({ id: flashEncounters.id }).from(flashEncounters).where(and(
      eq(flashEncounters.id, input.encounterId),
      eq(flashEncounters.userId, input.userId),
      eq(flashEncounters.storyEpisodeId, input.episodeId),
    )).limit(1);
    if (!encounter) return null;
    const [existing] = await tx.select().from(flashUserStoryEpisodes).where(and(
      eq(flashUserStoryEpisodes.userId, input.userId),
      eq(flashUserStoryEpisodes.episodeId, input.episodeId),
    )).limit(1);
    if (existing) {
      await tx.update(flashEncounters).set({ status: "completed", updatedAt: input.now })
        .where(and(eq(flashEncounters.id, input.encounterId), eq(flashEncounters.userId, input.userId)));
      return { created: false };
    }
    const [progress] = await tx.select().from(flashUserStoryProgress).where(and(
      eq(flashUserStoryProgress.userId, input.userId),
      eq(flashUserStoryProgress.seasonId, episode.seasonId),
    )).limit(1);
    if (!progress || progress.status !== "active") return null;
    const completedNpcPhases = await tx.select({ phase: flashStoryEpisodes.phase })
      .from(flashUserStoryEpisodes)
      .innerJoin(flashStoryEpisodes, eq(flashUserStoryEpisodes.episodeId, flashStoryEpisodes.id))
      .where(and(
        eq(flashUserStoryEpisodes.userId, input.userId),
        eq(flashStoryEpisodes.seasonId, episode.seasonId),
        eq(flashStoryEpisodes.npcId, episode.npcId),
      ));
    if (!hasCompletedPriorNpcPhases(episode.phase, completedNpcPhases.map((row: any) => row.phase))) return null;
    const [run] = progress?.universeRunId
      ? await tx.select().from(flashStoryUniverseRuns).where(eq(flashStoryUniverseRuns.id, progress.universeRunId)).limit(1)
      : [];
    const effects = effectsForFlashChoice(input.optionId, input.configuredEffects);
    const echo = run?.echoQueue?.[0]?.copy ?? null;
    const [created] = await tx.insert(flashUserStoryEpisodes).values({
      userId: input.userId,
      episodeId: input.episodeId,
      encounterId: input.encounterId,
      universeRunId: run?.id ?? null,
      selectedOptionId: input.optionId,
      effectSnapshot: effects,
      echoSnapshot: echo,
      responseSnapshot: input.responseSnapshot ?? null,
      renderKind: input.renderKind ?? "template",
      promptVersion: input.promptVersion ?? null,
      completedAt: input.now,
    }).onConflictDoNothing({ target: [flashUserStoryEpisodes.userId, flashUserStoryEpisodes.episodeId] }).returning();

    if (created) {
      if (run) {
        const nextVector = applyFlashChoiceEffects(run.universeVector, effects);
        const nextFlags = [...new Set([...run.flags, ...effects.flatMap((effect) => effect.flag ? [effect.flag] : [])])];
        const nextEchoes = effects.flatMap((effect) => effect.flag ? [{
          flag: effect.flag,
          copy: `你之前留意到的${effect.flag === "noticed_action" ? "行动" : effect.flag === "noticed_evidence" ? "痕迹" : "关系"}，在这里有了新的回声。`,
          sourceEpisodeCode: episode?.code ?? input.episodeId,
        }] : []).slice(-3);
        await tx.update(flashStoryUniverseRuns).set({
          universeVector: nextVector,
          flags: nextFlags,
          echoQueue: nextEchoes,
          stateVersion: run.stateVersion + 1,
          updatedAt: input.now,
        }).where(and(eq(flashStoryUniverseRuns.id, run.id), eq(flashStoryUniverseRuns.stateVersion, run.stateVersion)));
      }
      const fragments = await tx.select({ id: flashStoryFragments.id }).from(flashStoryFragments)
        .where(eq(flashStoryFragments.episodeId, episode.id)).orderBy(asc(flashStoryFragments.sortOrder)).limit(1);
      if (fragments[0]) {
        const [release] = run
          ? await tx.select().from(flashStoryReleaseSnapshots).where(eq(flashStoryReleaseSnapshots.id, run.releaseSnapshotId)).limit(1)
          : [];
        const fragmentSnapshot = release?.manifest.episodes.find((item: any) => item.code === episode.code)?.fragment ?? null;
        await tx.insert(flashUserStoryFragments).values([{
          userId: input.userId,
          fragmentId: fragments[0].id,
          episodeId: episode.id,
          fragmentSnapshot,
          unlockedAt: input.now,
        }]).onConflictDoNothing();
      }
    }

    const [[phaseCount], [totalCount]] = await Promise.all([
      tx.select({ value: count() }).from(flashUserStoryEpisodes)
      .innerJoin(flashStoryEpisodes, eq(flashUserStoryEpisodes.episodeId, flashStoryEpisodes.id))
      .where(and(
        eq(flashUserStoryEpisodes.userId, input.userId),
        eq(flashStoryEpisodes.seasonId, episode.seasonId),
        eq(flashStoryEpisodes.phase, episode.phase),
      )),
      tx.select({ value: count() }).from(flashUserStoryEpisodes)
        .innerJoin(flashStoryEpisodes, eq(flashUserStoryEpisodes.episodeId, flashStoryEpisodes.id))
        .where(and(
          eq(flashUserStoryEpisodes.userId, input.userId),
          eq(flashStoryEpisodes.seasonId, episode.seasonId),
        )),
    ]);
    if (Number(phaseCount?.value ?? 0) === 5) {
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
      if (isFlashStorySeasonComplete(Number(totalCount?.value ?? 0)) && run) {
        const [latestRun] = await tx.select().from(flashStoryUniverseRuns).where(eq(flashStoryUniverseRuns.id, run.id)).limit(1);
        const v2State = latestRun?.v2State ?? run.v2State;
        const endingCode = v2State
          ? resolveV2Ending({
              echo: v2State.echo,
              flags: latestRun?.flags ?? run.flags ?? [],
              variables: v2State.variables ?? {},
              currentNode: latestRun?.currentNode ?? null,
              nodePath: latestRun?.nodePath ?? [],
            })
          : resolveFlashStoryEnding(latestRun?.universeVector ?? run.universeVector);
        await tx.update(flashStoryUniverseRuns).set({
          status: "completed",
          endingCode,
          completedAt: input.now,
          updatedAt: input.now,
        }).where(eq(flashStoryUniverseRuns.id, run.id));
      }
    }
    await tx.update(flashEncounters).set({ status: "completed", completedAt: input.now, updatedAt: input.now })
      .where(and(eq(flashEncounters.id, input.encounterId), eq(flashEncounters.userId, input.userId)));
    return { created: Boolean(created) };
  });
}

export async function listFlashUserStoryFragments(userId: string, executor: DbExecutor = db) {
  return executor.select({
    id: flashStoryFragments.id,
    code: sql<string>`coalesce(${flashUserStoryFragments.fragmentSnapshot}->>'code', ${flashStoryFragments.code})`,
    category: sql<string>`coalesce(${flashUserStoryFragments.fragmentSnapshot}->>'category', ${flashStoryFragments.category})`,
    title: sql<string>`coalesce(${flashUserStoryFragments.fragmentSnapshot}->>'title', ${flashStoryFragments.title})`,
    fact: sql<string>`coalesce(${flashUserStoryFragments.fragmentSnapshot}->>'fact', ${flashStoryFragments.fact})`,
    assetUrl: sql<string | null>`coalesce(${flashUserStoryFragments.fragmentSnapshot}->>'assetUrl', ${flashStoryFragments.assetUrl})`,
    unlockedAt: flashUserStoryFragments.unlockedAt,
    encounterId: flashUserStoryEpisodes.encounterId,
    episodeTitle: flashStoryEpisodes.title,
    npcName: flashNpcs.name,
  }).from(flashUserStoryFragments)
    .innerJoin(flashStoryFragments, eq(flashUserStoryFragments.fragmentId, flashStoryFragments.id))
    .innerJoin(flashStoryEpisodes, eq(flashUserStoryFragments.episodeId, flashStoryEpisodes.id))
    .innerJoin(flashUserStoryEpisodes, and(
      eq(flashUserStoryEpisodes.userId, flashUserStoryFragments.userId),
      eq(flashUserStoryEpisodes.episodeId, flashUserStoryFragments.episodeId),
    ))
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
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('flash-story-publish'))`);
    const [counts] = await tx.select({ total: count(), reviewed: sql<number>`count(*) filter (where ${flashStoryEpisodes.reviewStatus} = 'reviewed' and ${flashStoryEpisodes.isActive} = true)::int` })
      .from(flashStoryEpisodes).where(eq(flashStoryEpisodes.seasonId, id));
    if (Number(counts?.total ?? 0) !== 15 || Number(counts?.reviewed ?? 0) !== 15) return null;
    await tx.update(flashStorySeasons).set({ status: "archived", updatedAt: now })
      .where(and(eq(flashStorySeasons.status, "published"), sql`${flashStorySeasons.id} <> ${id}`));
    const [season] = await tx.update(flashStorySeasons).set({ status: "published", publishedAt: now, publishedBy: actor, updatedAt: now })
      .where(eq(flashStorySeasons.id, id)).returning();
    const episodeRows = await tx.select({ episode: flashStoryEpisodes, fragment: flashStoryFragments })
      .from(flashStoryEpisodes)
      .innerJoin(flashStoryFragments, eq(flashStoryFragments.episodeId, flashStoryEpisodes.id))
      .where(and(eq(flashStoryEpisodes.seasonId, id), eq(flashStoryEpisodes.reviewStatus, "reviewed"), eq(flashStoryEpisodes.isActive, true)))
      .orderBy(asc(flashStoryEpisodes.sortOrder), asc(flashStoryFragments.sortOrder));
    const byEpisode = new Map<string, any>();
    for (const row of episodeRows) if (!byEpisode.has(row.episode.id)) byEpisode.set(row.episode.id, row);
    if (!season || byEpisode.size !== 15 || episodeRows.length !== 15) return null;
    const manifest = {
      season: { id: season.id, code: season.code, title: season.title, version: season.version },
      episodes: [...byEpisode.values()].map(({ episode, fragment }) => ({
        id: episode.id, code: episode.code, npcId: episode.npcId, phase: episode.phase,
        title: episode.title, objectCode: episode.objectCode, contentVersion: episode.contentVersion,
        content: episode.content,
        fragment: { id: fragment.id, code: fragment.code, category: fragment.category, title: fragment.title, fact: fragment.fact, assetUrl: fragment.assetUrl },
      })),
      endings: Object.entries(FLASH_STORY_ENDING_COPY).map(([code, copy]) => ({ code, ...copy })),
      endingRulesVersion: "flash-ending-v1",
    };
    const [latest] = await tx.select({ revision: flashStoryReleaseSnapshots.revision }).from(flashStoryReleaseSnapshots)
      .where(eq(flashStoryReleaseSnapshots.seasonId, id)).orderBy(desc(flashStoryReleaseSnapshots.revision)).limit(1);
    await tx.update(flashStoryReleaseSnapshots).set({ status: "superseded" })
      .where(eq(flashStoryReleaseSnapshots.status, "published"));
    await tx.insert(flashStoryReleaseSnapshots).values({
      seasonId: id,
      revision: Number(latest?.revision ?? 0) + 1,
      manifestHash: stableHash(manifest),
      manifest,
      status: "published",
      publishedBy: actor,
      publishedAt: now,
    });
    return season ?? null;
  });
}

export async function listCompletedFlashStoryEpisodeCodes(userId: string, seasonId: string, executor: DbExecutor = db): Promise<string[]> {
  const rows = await executor.select({ code: flashStoryEpisodes.code })
    .from(flashUserStoryEpisodes)
    .innerJoin(flashStoryEpisodes, eq(flashUserStoryEpisodes.episodeId, flashStoryEpisodes.id))
    .where(and(
      eq(flashUserStoryEpisodes.userId, userId),
      eq(flashStoryEpisodes.seasonId, seasonId),
    ));
  return rows.map((row: { code: string }) => row.code);
}
