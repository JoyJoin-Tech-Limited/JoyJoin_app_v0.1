import { randomUUID } from "node:crypto";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  lt,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm";

import {
  alangMissionProgress,
  alangStoryArchives,
  eventFeedback,
  eventGroupOutcomes,
  eventPoolGroups,
  eventPoolRegistrations,
  eventPools,
  flashTaskAssignments,
  users,
} from "@shared/schema";
import type { FlashTaskSnapshot } from "@shared/schema/flash";
import {
  personalStoryChapters,
  personalStoryExperienceSnapshotSchema,
  personalStoryNovels,
  personalStoryUpdateJobs,
  type PersonalStoryChapter,
  type PersonalStoryChapterView,
  type PersonalStoryExperienceSnapshot,
  type PersonalStoryFactKeywords,
  type PersonalStoryNovel,
  type PersonalStoryUpdateJob,
  type PersonalStoryUpdateJobView,
} from "@shared/schema/personalStory";

import { db } from "../db";

const ACTIVE_JOB_KEY = "active";
const DEFAULT_JOB_LEASE_MS = 120_000;

export function createPersonalStoryLeaseToken(): string {
  return randomUUID();
}

const ARCHETYPE_PARTNER_LABELS: Record<string, string> = {
  corgi: "柯基伙伴",
  rooster: "小鸡伙伴",
  hamster_praise: "仓鼠伙伴",
  fox: "狐狸伙伴",
  dolphin_calm: "海豚伙伴",
  spider: "蜘蛛伙伴",
  koala: "考拉伙伴",
  octopus: "章鱼伙伴",
  owl: "猫头鹰伙伴",
  elephant: "大象伙伴",
  turtle: "乌龟伙伴",
  cat: "猫咪伙伴",
};

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDateOnly(value: Date | string): string {
  return toIso(value).slice(0, 10);
}

function cleanKeyword(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, maxLength);
  return cleaned || undefined;
}

export function getPartnerAnimalLabel(archetype: string | null | undefined): string | null {
  if (!archetype) return null;
  return ARCHETYPE_PARTNER_LABELS[archetype] ?? null;
}

export function sortAndDedupeExperienceSnapshots(
  snapshots: PersonalStoryExperienceSnapshot[],
): PersonalStoryExperienceSnapshot[] {
  const seen = new Set<string>();
  return [...snapshots]
    .sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) ||
        a.sourceType.localeCompare(b.sourceType) ||
        a.sourceId.localeCompare(b.sourceId),
    )
    .filter((snapshot) => {
      const key = `${snapshot.sourceType}:${snapshot.sourceId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function ensurePersonalStoryNovel(userId: string): Promise<PersonalStoryNovel> {
  const [created] = await db
    .insert(personalStoryNovels)
    .values({ userId })
    .onConflictDoNothing({ target: personalStoryNovels.userId })
    .returning();

  if (created) return created;

  const [existing] = await db
    .select()
    .from(personalStoryNovels)
    .where(eq(personalStoryNovels.userId, userId))
    .limit(1);
  if (!existing) throw new Error("PERSONAL_STORY_NOVEL_CONFLICT_WITHOUT_ROW");
  return existing;
}

export async function listPersonalStoryChapters(
  userId: string,
  novelId: string,
): Promise<PersonalStoryChapter[]> {
  return db
    .select()
    .from(personalStoryChapters)
    .where(
      and(
        eq(personalStoryChapters.userId, userId),
        eq(personalStoryChapters.novelId, novelId),
      ),
    )
    .orderBy(asc(personalStoryChapters.chapterNumber));
}

export async function getLatestPersonalStoryUpdateJob(
  userId: string,
): Promise<PersonalStoryUpdateJob | null> {
  const [job] = await db
    .select()
    .from(personalStoryUpdateJobs)
    .where(eq(personalStoryUpdateJobs.userId, userId))
    .orderBy(desc(personalStoryUpdateJobs.createdAt))
    .limit(1);
  return job ?? null;
}

export async function getActivePersonalStoryUpdateJob(
  userId: string,
): Promise<PersonalStoryUpdateJob | null> {
  const [job] = await db
    .select()
    .from(personalStoryUpdateJobs)
    .where(
      and(
        eq(personalStoryUpdateJobs.userId, userId),
        eq(personalStoryUpdateJobs.activeKey, ACTIVE_JOB_KEY),
      ),
    )
    .orderBy(desc(personalStoryUpdateJobs.createdAt))
    .limit(1);
  return job ?? null;
}

async function listAlangExperienceSnapshots(
  userId: string,
): Promise<PersonalStoryExperienceSnapshot[]> {
  type AlangExperienceRow = {
    archiveId: string;
    completedAt: Date;
    finalMood: string | null;
    choicesMade: Array<{ nodeId: string; choiceIndex: number; label: string }> | null;
  };
  const rows = (await db
    .select({
      archiveId: alangStoryArchives.id,
      completedAt: alangStoryArchives.completedAt,
      finalMood: alangStoryArchives.finalMood,
      choicesMade: alangStoryArchives.choicesMade,
    })
    .from(alangStoryArchives)
    .innerJoin(
      alangMissionProgress,
      eq(alangMissionProgress.id, alangStoryArchives.progressId),
    )
    .where(
      and(
        eq(alangStoryArchives.userId, userId),
        eq(alangStoryArchives.isDebugSession, false),
        eq(alangMissionProgress.userId, userId),
        eq(alangMissionProgress.status, "completed"),
        eq(alangMissionProgress.isDebugSession, false),
      ),
    )) as AlangExperienceRow[];

  return rows.map((row) => {
    const choices = (row.choicesMade ?? [])
      .map((choice) => cleanKeyword(choice.label, 40))
      .filter((value): value is string => Boolean(value))
      .slice(0, 12);
    const keywords: PersonalStoryFactKeywords = {
      occurredOn: toDateOnly(row.completedAt),
      activityType: "闪现",
      location: "深圳湾公园",
      npc: "阿浪",
      ...(cleanKeyword(row.finalMood, 30)
        ? { finalMood: cleanKeyword(row.finalMood, 30) }
        : {}),
      ...(choices.length > 0 ? { choices } : {}),
    };

    return personalStoryExperienceSnapshotSchema.parse({
      sourceType: "alang",
      sourceId: row.archiveId,
      occurredAt: toIso(row.completedAt),
      keywords,
    });
  });
}

export interface FlashStorySourceRow {
  assignmentId: string;
  deliveredAt: Date;
  contentSnapshot: FlashTaskSnapshot;
  feedbackAnswers: Array<{ promptId: string; optionId: string }> | null;
}

/**
 * Converts only server-owned, reviewed Flash data into story facts. The query
 * intentionally never selects privateReply, coordinates, addresses or raw
 * client prose, so those values cannot reach the LLM by accident.
 */
export function buildFlashStorySnapshot(
  row: FlashStorySourceRow,
): PersonalStoryExperienceSnapshot {
  const feedbackOptionByKey = new Map<string, string>();
  for (const prompt of row.contentSnapshot.feedbackPrompts ?? []) {
    for (const option of prompt.options) {
      feedbackOptionByKey.set(
        `${prompt.id}:${option.id}`,
        option.label,
      );
    }
  }
  const choices = (row.feedbackAnswers ?? [])
    .map((answer) =>
      cleanKeyword(
        feedbackOptionByKey.get(`${answer.promptId}:${answer.optionId}`),
        40,
      ),
    )
    .filter((value): value is string => Boolean(value))
    .slice(0, 12);
  const storyBeat = cleanKeyword(row.contentSnapshot.title, 120);
  const npcResponse = cleanKeyword(row.contentSnapshot.deliveryCopy, 160);
  const publicLocation =
    cleanKeyword(row.contentSnapshot.destination?.name, 80)
    ?? cleanKeyword(row.contentSnapshot.destination?.district, 40);

  return personalStoryExperienceSnapshotSchema.parse({
    sourceType: "flash",
    sourceId: row.assignmentId,
    occurredAt: toIso(row.deliveredAt),
    keywords: {
      occurredOn: toDateOnly(row.deliveredAt),
      activityType: "街头盲盒",
      ...(publicLocation ? { location: publicLocation } : {}),
      ...(cleanKeyword(row.contentSnapshot.npcName, 20)
        ? { npc: cleanKeyword(row.contentSnapshot.npcName, 20) }
        : {}),
      ...(choices.length > 0 ? { choices } : {}),
      ...(storyBeat ? { storyBeats: [storyBeat] } : {}),
      ...(npcResponse ? { npcResponses: [npcResponse] } : {}),
    },
  });
}

async function listFlashExperienceSnapshots(
  userId: string,
): Promise<PersonalStoryExperienceSnapshot[]> {
  const rows = (await db
    .select({
      assignmentId: flashTaskAssignments.id,
      deliveredAt: flashTaskAssignments.deliveredAt,
      contentSnapshot: flashTaskAssignments.contentSnapshot,
      feedbackAnswers: flashTaskAssignments.feedbackAnswers,
    })
    .from(flashTaskAssignments)
    .where(
      and(
        eq(flashTaskAssignments.userId, userId),
        eq(flashTaskAssignments.status, "delivered"),
        isNotNull(flashTaskAssignments.deliveredAt),
        isNotNull(flashTaskAssignments.feedbackSubmittedAt),
      ),
    )) as Array<Omit<FlashStorySourceRow, "deliveredAt"> & { deliveredAt: Date }>;

  return rows.map(buildFlashStorySnapshot);
}

async function listBlindBoxExperienceSnapshots(
  userId: string,
): Promise<PersonalStoryExperienceSnapshot[]> {
  // A matched registration alone proves only that the user was assigned. Story
  // eligibility additionally requires both the user's group outcome and their
  // completed event feedback for this exact event. Their free text and scores
  // are used only as participation proof and never enter the story prompt.
  type BlindBoxExperienceRow = {
    registrationId: string;
    groupId: string;
    eventType: string;
    city: string;
    district: string | null;
    poolDateTime: Date;
    groupDateTime: Date | null;
    venueName: string | null;
    atmosphereScore: number | null;
  };
  const rows = (await db
    .select({
      registrationId: eventPoolRegistrations.id,
      groupId: eventPoolGroups.id,
      eventType: eventPools.eventType,
      city: eventPools.city,
      district: eventPools.district,
      poolDateTime: eventPools.dateTime,
      groupDateTime: eventPoolGroups.finalDateTime,
      venueName: eventPoolGroups.venueName,
      atmosphereScore: eventFeedback.atmosphereScore,
    })
    .from(eventGroupOutcomes)
    .innerJoin(
      eventPoolRegistrations,
      and(
        eq(eventPoolRegistrations.userId, eventGroupOutcomes.submittedBy),
        eq(eventPoolRegistrations.poolId, eventGroupOutcomes.poolId),
        eq(eventPoolRegistrations.assignedGroupId, eventGroupOutcomes.groupId),
      ),
    )
    .innerJoin(eventPools, eq(eventPools.id, eventGroupOutcomes.poolId))
    .innerJoin(eventPoolGroups, eq(eventPoolGroups.id, eventGroupOutcomes.groupId))
    .innerJoin(
      eventFeedback,
      and(
        eq(eventFeedback.eventId, eventPoolGroups.eventId),
        eq(eventFeedback.userId, userId),
      ),
    )
    .where(
      and(
        eq(eventGroupOutcomes.submittedBy, userId),
        eq(eventPoolRegistrations.userId, userId),
        eq(eventPoolRegistrations.matchStatus, "matched"),
        isNotNull(eventPoolRegistrations.assignedGroupId),
        isNotNull(eventPoolGroups.eventId),
        isNotNull(eventFeedback.completedAt),
        eq(eventPools.isTestPool, false),
        sql`coalesce(${eventPools.status}, '') <> 'cancelled'`,
        sql`coalesce(${eventPoolGroups.status}, '') <> 'cancelled'`,
        sql`coalesce(${eventPoolGroups.finalDateTime}, ${eventPools.dateTime}) <= now()`,
      ),
    )) as BlindBoxExperienceRow[];

  if (rows.length === 0) return [];

  const groupIds = [...new Set(rows.map((row) => row.groupId))];
  type PartnerRow = {
    groupId: string | null;
    primaryArchetype: string | null;
    archetype: string | null;
  };
  const partnerRows = (await db
    .select({
      groupId: eventPoolRegistrations.assignedGroupId,
      primaryArchetype: users.primaryArchetype,
      archetype: users.archetype,
    })
    .from(eventPoolRegistrations)
    .innerJoin(users, eq(users.id, eventPoolRegistrations.userId))
    .where(
      and(
        inArray(eventPoolRegistrations.assignedGroupId, groupIds),
        ne(eventPoolRegistrations.userId, userId),
        eq(eventPoolRegistrations.matchStatus, "matched"),
        sql`coalesce(${users.isTestBot}, false) = false`,
      ),
    )) as PartnerRow[];

  const partnersByGroup = new Map<string, Set<string>>();
  for (const partner of partnerRows) {
    if (!partner.groupId) continue;
    const label = getPartnerAnimalLabel(partner.primaryArchetype ?? partner.archetype);
    if (!label) continue;
    const labels = partnersByGroup.get(partner.groupId) ?? new Set<string>();
    labels.add(label);
    partnersByGroup.set(partner.groupId, labels);
  }

  return rows.map((row) => {
    const occurredAt = row.groupDateTime ?? row.poolDateTime;
    const location =
      cleanKeyword(row.venueName, 80) ??
      cleanKeyword(row.district, 40) ??
      cleanKeyword(row.city, 40);
    const partnerAnimals = [...(partnersByGroup.get(row.groupId) ?? [])].slice(0, 12);
    const atmosphere = row.atmosphereScore
      ? ["安静", "平淡", "舒服", "热烈", "难忘"][row.atmosphereScore - 1]
      : undefined;
    const keywords: PersonalStoryFactKeywords = {
      occurredOn: toDateOnly(occurredAt),
      activityType: cleanKeyword(row.eventType, 40) ?? "盲盒活动",
      ...(location ? { location } : {}),
      ...(partnerAnimals.length > 0 ? { partnerAnimals } : {}),
      ...(atmosphere ? { atmosphere } : {}),
    };

    return personalStoryExperienceSnapshotSchema.parse({
      sourceType: "blind_box",
      sourceId: row.registrationId,
      occurredAt: toIso(occurredAt),
      keywords,
    });
  });
}

export async function listEligiblePersonalStoryExperiences(
  userId: string,
): Promise<PersonalStoryExperienceSnapshot[]> {
  const [alang, flash, blindBox] = await Promise.all([
    listAlangExperienceSnapshots(userId),
    listFlashExperienceSnapshots(userId),
    listBlindBoxExperienceSnapshots(userId),
  ]);
  return sortAndDedupeExperienceSnapshots([...alang, ...flash, ...blindBox]);
}

export async function listMissingPersonalStoryExperiences(
  userId: string,
  novelId: string,
): Promise<PersonalStoryExperienceSnapshot[]> {
  const [eligible, existingSources] = await Promise.all([
    listEligiblePersonalStoryExperiences(userId),
    db
      .select({
        sourceType: personalStoryChapters.sourceType,
        sourceId: personalStoryChapters.sourceId,
      })
      .from(personalStoryChapters)
      .where(
        and(
          eq(personalStoryChapters.userId, userId),
          eq(personalStoryChapters.novelId, novelId),
        ),
      ),
  ]) as [
    PersonalStoryExperienceSnapshot[],
    Array<{ sourceType: string; sourceId: string }>,
  ];
  const existing = new Set(
    existingSources.map((source) => `${source.sourceType}:${source.sourceId}`),
  );
  return eligible.filter(
    (source) => !existing.has(`${source.sourceType}:${source.sourceId}`),
  );
}

export async function createOrGetPersonalStoryUpdateJob(
  userId: string,
  novelId: string,
  sources: PersonalStoryExperienceSnapshot[],
): Promise<PersonalStoryUpdateJob> {
  const parsedSources = sources.map((source) =>
    personalStoryExperienceSnapshotSchema.parse(source),
  );
  if (parsedSources.length === 0) {
    throw new Error("PERSONAL_STORY_JOB_REQUIRES_SOURCE");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [created] = await db
      .insert(personalStoryUpdateJobs)
      .values({
        novelId,
        userId,
        activeKey: ACTIVE_JOB_KEY,
        status: "pending",
        sourceSnapshot: parsedSources,
      })
      .onConflictDoNothing({
        target: [personalStoryUpdateJobs.userId, personalStoryUpdateJobs.activeKey],
      })
      .returning();
    if (created) return created;

    const active = await getActivePersonalStoryUpdateJob(userId);
    if (active) return active;
    // The conflicting job may have become terminal between INSERT and SELECT.
    // Retry once now that its activeKey has been cleared.
  }
  throw new Error("PERSONAL_STORY_ACTIVE_JOB_CONFLICT_WITHOUT_ROW");
}

export async function claimNextPersonalStoryUpdateJob(
  leaseMs = DEFAULT_JOB_LEASE_MS,
): Promise<PersonalStoryUpdateJob | null> {
  return db.transaction(async (tx: any) => {
    const now = new Date();
    const [candidate] = await tx
      .select()
      .from(personalStoryUpdateJobs)
      .where(
        and(
          eq(personalStoryUpdateJobs.activeKey, ACTIVE_JOB_KEY),
          or(
            eq(personalStoryUpdateJobs.status, "pending"),
            and(
              eq(personalStoryUpdateJobs.status, "running"),
              lt(personalStoryUpdateJobs.leaseExpiresAt, now),
            ),
          ),
        ),
      )
      .orderBy(asc(personalStoryUpdateJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!candidate) return null;

    const leaseToken = createPersonalStoryLeaseToken();
    const [claimed] = await tx
      .update(personalStoryUpdateJobs)
      .set({
        status: "running",
        attemptCount: sql`${personalStoryUpdateJobs.attemptCount} + 1`,
        lockedAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
        leaseToken,
        errorCode: null,
        updatedAt: now,
      })
      .where(eq(personalStoryUpdateJobs.id, candidate.id))
      .returning();
    return claimed ?? null;
  });
}

export interface InsertGeneratedPersonalStoryChapter {
  jobId: string;
  leaseToken: string;
  novelId: string;
  userId: string;
  source: PersonalStoryExperienceSnapshot;
  title: string;
  body: string;
  keywordHash: string;
  provider: "minimax" | "deepseek" | null;
  model: string | null;
  promptVersion: string;
  fallbackUsed: boolean;
}

export async function insertPersonalStoryChapterIfAbsent(
  input: InsertGeneratedPersonalStoryChapter,
): Promise<{ chapter: PersonalStoryChapter; created: boolean }> {
  return db.transaction(async (tx: any) => {
    // This is intentionally the first lock in the transaction. A reclaimed
    // job receives a fresh fencing token, so the previous worker cannot append
    // a chapter even if its model request finishes after ownership changed.
    const [ownedJob] = await tx
      .select({ id: personalStoryUpdateJobs.id })
      .from(personalStoryUpdateJobs)
      .where(
        and(
          eq(personalStoryUpdateJobs.id, input.jobId),
          eq(personalStoryUpdateJobs.novelId, input.novelId),
          eq(personalStoryUpdateJobs.userId, input.userId),
          eq(personalStoryUpdateJobs.status, "running"),
          eq(personalStoryUpdateJobs.activeKey, ACTIVE_JOB_KEY),
          eq(personalStoryUpdateJobs.leaseToken, input.leaseToken),
        ),
      )
      .limit(1)
      .for("update");
    if (!ownedJob) throw new Error("PERSONAL_STORY_JOB_LEASE_LOST");

    const [novel] = await tx
      .select({ id: personalStoryNovels.id })
      .from(personalStoryNovels)
      .where(
        and(
          eq(personalStoryNovels.id, input.novelId),
          eq(personalStoryNovels.userId, input.userId),
        ),
      )
      .limit(1)
      .for("update");
    if (!novel) throw new Error("PERSONAL_STORY_NOVEL_NOT_FOUND");

    const [existing] = await tx
      .select()
      .from(personalStoryChapters)
      .where(
        and(
          eq(personalStoryChapters.novelId, input.novelId),
          eq(personalStoryChapters.userId, input.userId),
          eq(personalStoryChapters.sourceType, input.source.sourceType),
          eq(personalStoryChapters.sourceId, input.source.sourceId),
        ),
      )
      .limit(1);
    if (existing) return { chapter: existing, created: false };

    const [last] = await tx
      .select({ chapterNumber: max(personalStoryChapters.chapterNumber) })
      .from(personalStoryChapters)
      .where(eq(personalStoryChapters.novelId, input.novelId));
    const chapterNumber = Number(last?.chapterNumber ?? 0) + 1;
    const now = new Date();
    const [chapter] = await tx
      .insert(personalStoryChapters)
      .values({
        novelId: input.novelId,
        userId: input.userId,
        chapterNumber,
        sourceType: input.source.sourceType,
        sourceId: input.source.sourceId,
        sourceOccurredAt: new Date(input.source.occurredAt),
        title: input.title,
        body: input.body,
        factKeywords: input.source.keywords,
        keywordHash: input.keywordHash,
        provider: input.provider,
        model: input.model,
        promptVersion: input.promptVersion,
        fallbackUsed: input.fallbackUsed,
        generatedAt: now,
      })
      .returning();
    if (!chapter) throw new Error("PERSONAL_STORY_CHAPTER_INSERT_FAILED");

    await tx
      .update(personalStoryNovels)
      .set({ lastSuccessfulUpdateAt: now, updatedAt: now })
      .where(
        and(
          eq(personalStoryNovels.id, input.novelId),
          eq(personalStoryNovels.userId, input.userId),
        ),
      );
    return { chapter, created: true };
  });
}

export async function recordPersonalStoryJobProgress(
  jobId: string,
  userId: string,
  leaseToken: string,
  nextSourceIndex: number,
  generatedCount: number,
  leaseMs = DEFAULT_JOB_LEASE_MS,
): Promise<boolean> {
  const now = new Date();
  const updated = await db
    .update(personalStoryUpdateJobs)
    .set({
      nextSourceIndex,
      generatedCount,
      leaseExpiresAt: new Date(now.getTime() + leaseMs),
      updatedAt: now,
    })
    .where(
      and(
        eq(personalStoryUpdateJobs.id, jobId),
        eq(personalStoryUpdateJobs.userId, userId),
        eq(personalStoryUpdateJobs.status, "running"),
        eq(personalStoryUpdateJobs.activeKey, ACTIVE_JOB_KEY),
        eq(personalStoryUpdateJobs.leaseToken, leaseToken),
      ),
    )
    .returning({ id: personalStoryUpdateJobs.id });
  return updated.length === 1;
}

export async function completePersonalStoryUpdateJob(
  jobId: string,
  userId: string,
  leaseToken: string,
  generatedCount: number,
): Promise<boolean> {
  const now = new Date();
  const updated = await db
    .update(personalStoryUpdateJobs)
    .set({
      status: "completed",
      activeKey: null,
      generatedCount,
      nextSourceIndex: sql`jsonb_array_length(${personalStoryUpdateJobs.sourceSnapshot})`,
      lockedAt: null,
      leaseExpiresAt: null,
      leaseToken: null,
      errorCode: null,
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(personalStoryUpdateJobs.id, jobId),
        eq(personalStoryUpdateJobs.userId, userId),
        eq(personalStoryUpdateJobs.status, "running"),
        eq(personalStoryUpdateJobs.activeKey, ACTIVE_JOB_KEY),
        eq(personalStoryUpdateJobs.leaseToken, leaseToken),
      ),
    )
    .returning({ id: personalStoryUpdateJobs.id });
  return updated.length === 1;
}

export async function failPersonalStoryUpdateJob(
  jobId: string,
  userId: string,
  leaseToken: string,
  generatedCount: number,
  errorCode: string,
): Promise<boolean> {
  const now = new Date();
  const updated = await db
    .update(personalStoryUpdateJobs)
    .set({
      status: generatedCount > 0 ? "partial_failed" : "failed",
      activeKey: null,
      generatedCount,
      lockedAt: null,
      leaseExpiresAt: null,
      leaseToken: null,
      errorCode: errorCode.slice(0, 100),
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(personalStoryUpdateJobs.id, jobId),
        eq(personalStoryUpdateJobs.userId, userId),
        eq(personalStoryUpdateJobs.status, "running"),
        eq(personalStoryUpdateJobs.activeKey, ACTIVE_JOB_KEY),
        eq(personalStoryUpdateJobs.leaseToken, leaseToken),
      ),
    )
    .returning({ id: personalStoryUpdateJobs.id });
  return updated.length === 1;
}

export function toPersonalStoryChapterView(
  chapter: PersonalStoryChapter,
): PersonalStoryChapterView {
  return {
    id: chapter.id,
    title: chapter.title,
    body: chapter.body,
    activityType: chapter.factKeywords.activityType,
    occurredAt: toIso(chapter.sourceOccurredAt),
    aigc: { aiGenerated: true, labelType: "ai-generated" },
  };
}

export function toPersonalStoryUpdateJobView(
  job: PersonalStoryUpdateJob,
): PersonalStoryUpdateJobView {
  const status: PersonalStoryUpdateJobView["status"] =
    job.status === "pending"
      ? "queued"
      : job.status === "running"
        ? "running"
        : job.status === "completed"
          ? "succeeded"
          : "failed";
  return {
    id: job.id,
    status,
    updatedAt: toIso(job.updatedAt),
  };
}
