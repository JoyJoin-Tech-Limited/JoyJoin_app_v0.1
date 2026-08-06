import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import {
  flashEncounterLocations,
  flashEncounters,
  flashLocateBudgets,
  flashNpcLocationLinks,
  flashNpcRelationships,
  flashNpcs,
  flashNpcTaskLinks,
  flashSchedulePlans,
  flashShifts,
  flashTaskAssignments,
  flashTaskDestinationLinks,
  flashTaskDestinations,
  flashTaskTemplates,
  flashUserPreferences,
  flashUserTaskTags,
  userInterests,
  users,
  type FlashTaskSnapshot,
} from "@shared/schema";
import {
  buildFlashNpcTaskRequestCopy,
  FLASH_DELIVERY_COPY_BY_NPC,
  FLASH_LOCATION_SEEDS,
  FLASH_NPC_MESSAGE_SOURCE_DELIVERED_PROMPT,
  FLASH_NPC_MESSAGE_SOURCE_SKIPPED_PROMPT,
  FLASH_NPC_MESSAGE_TARGET_PROMPT,
  FLASH_NPC_SEEDS,
  FLASH_TASK_SEEDS,
} from "@shared/alang/flashCatalog";
import { FLASH_PERSONALIZATION_CONSENT_VERSION } from "@shared/alang/flashTypes";
import { getFlashInvitationDefinition } from "@shared/alang/flashInvitationCatalog";

import { db } from "../db";
import { countCanonicalFlashNpcWeekdayMatches } from "../lib/flashNpcPolicy";

type DbExecutor = typeof db | any;

const ACTIVE_ASSIGNMENT_STATUSES = ["accepted", "arrived", "ready_to_deliver"] as const;
export const FLASH_REPEAT_DECAY_STATUSES = ["delivered"] as const;
const CANONICAL_FLASH_NPC_SLUGS = FLASH_NPC_SEEDS.map((npc) => npc.slug);
const CANONICAL_FLASH_TASK_CATEGORIES = [...new Set(FLASH_TASK_SEEDS.map((task) => task.category))];

export function resolveFlashNpcMessageCheckpoint(input: {
  sourceNpcSlug: string;
  targetNpcSlug?: string;
  currentNpcSlug?: string;
  targetOutcome?: string;
}): "target" | "source" | null {
  if (!input.targetOutcome) {
    return input.currentNpcSlug && input.currentNpcSlug === input.targetNpcSlug ? "target" : null;
  }
  return input.currentNpcSlug === input.sourceNpcSlug ? "source" : null;
}

export async function isFlashSchemaReady(executor: DbExecutor = db): Promise<boolean> {
  try {
    await Promise.all([
      executor.select({ id: flashNpcs.id, eligibleWeekdays: flashNpcs.eligibleWeekdays }).from(flashNpcs).limit(0),
      executor.select({
        id: flashEncounterLocations.id,
        lastReviewedAt: flashEncounterLocations.lastReviewedAt,
        reviewedBy: flashEncounterLocations.reviewedBy,
      }).from(flashEncounterLocations).limit(0),
      executor.select({ id: flashNpcLocationLinks.id, updatedAt: flashNpcLocationLinks.updatedAt }).from(flashNpcLocationLinks).limit(0),
      executor.select({ id: flashSchedulePlans.id }).from(flashSchedulePlans).limit(0),
      executor.select({ id: flashShifts.id }).from(flashShifts).limit(0),
      executor.select({
        id: flashTaskDestinations.id,
        lastReviewedAt: flashTaskDestinations.lastReviewedAt,
        reviewedBy: flashTaskDestinations.reviewedBy,
      }).from(flashTaskDestinations).limit(0),
      executor.select({
        id: flashTaskTemplates.id,
        contentVersion: flashTaskTemplates.contentVersion,
        reviewStatus: flashTaskTemplates.reviewStatus,
        isHumanReviewed: flashTaskTemplates.isHumanReviewed,
      }).from(flashTaskTemplates).limit(0),
      executor.select({ id: flashNpcTaskLinks.id, updatedAt: flashNpcTaskLinks.updatedAt }).from(flashNpcTaskLinks).limit(0),
      executor.select({ id: flashTaskDestinationLinks.id, updatedAt: flashTaskDestinationLinks.updatedAt }).from(flashTaskDestinationLinks).limit(0),
      executor.select({ id: flashEncounters.id }).from(flashEncounters).limit(0),
      executor.select({
        id: flashLocateBudgets.id,
        createdAt: flashLocateBudgets.createdAt,
        windowStartedAt: flashLocateBudgets.windowStartedAt,
        attemptCount: flashLocateBudgets.attemptCount,
      }).from(flashLocateBudgets).limit(0),
      executor.select({
        id: flashTaskAssignments.id,
        deliveryEncounterId: flashTaskAssignments.deliveryEncounterId,
        privateReplyDeleteAfter: flashTaskAssignments.privateReplyDeleteAfter,
        withdrawalReason: flashTaskAssignments.withdrawalReason,
      }).from(flashTaskAssignments).limit(0),
      executor.select({ userId: flashUserPreferences.userId }).from(flashUserPreferences).limit(0),
      executor.select({ id: flashUserTaskTags.id }).from(flashUserTaskTags).limit(0),
      executor.select({ id: flashNpcRelationships.id }).from(flashNpcRelationships).limit(0),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function countRows(executor: DbExecutor, expression: unknown, table: any, where?: unknown): Promise<number> {
  let query = executor.select({ count: expression }).from(table);
  if (where) query = query.where(where);
  const [row] = await query;
  return Number(row?.count ?? 0);
}

export async function getFlashReadiness(executor: DbExecutor = db) {
  const [
    activeNpcs,
    canonicalNpcs,
    reviewedTasks,
    approvedEncounterLocations,
    approvedTaskDestinations,
    canonicalWeekdayRows,
  ] = await Promise.all([
    countRows(executor, sql<number>`count(*)::int`, flashNpcs, eq(flashNpcs.isActive, true)),
    countRows(
      executor,
      sql<number>`count(*)::int`,
      flashNpcs,
      and(eq(flashNpcs.isActive, true), inArray(flashNpcs.slug, CANONICAL_FLASH_NPC_SLUGS)),
    ),
    countRows(
      executor,
      sql<number>`count(*)::int`,
      flashTaskTemplates,
      and(
        eq(flashTaskTemplates.isActive, true),
        eq(flashTaskTemplates.isHumanReviewed, true),
        eq(flashTaskTemplates.reviewStatus, "active"),
      ),
    ),
    countRows(
      executor,
      sql<number>`count(*)::int`,
      flashEncounterLocations,
      and(
        eq(flashEncounterLocations.city, "深圳"),
        eq(flashEncounterLocations.approvalStatus, "approved"),
        eq(flashEncounterLocations.isActive, true),
      ),
    ),
    countRows(
      executor,
      sql<number>`count(*)::int`,
      flashTaskDestinations,
      and(
        eq(flashTaskDestinations.city, "深圳"),
        eq(flashTaskDestinations.approvalStatus, "approved"),
        eq(flashTaskDestinations.isActive, true),
      ),
    ),
    executor.select({
      slug: flashNpcs.slug,
      eligibleWeekdays: flashNpcs.eligibleWeekdays,
      isActive: flashNpcs.isActive,
    }).from(flashNpcs).where(inArray(flashNpcs.slug, CANONICAL_FLASH_NPC_SLUGS)),
  ]);

  const [schedulable] = await executor
    .select({ count: sql<number>`count(distinct ${flashNpcs.id})::int` })
    .from(flashNpcs)
    .innerJoin(
      flashNpcLocationLinks,
      and(
        eq(flashNpcLocationLinks.npcId, flashNpcs.id),
        eq(flashNpcLocationLinks.isActive, true),
      ),
    )
    .innerJoin(
      flashEncounterLocations,
      and(
        eq(flashNpcLocationLinks.locationId, flashEncounterLocations.id),
        eq(flashEncounterLocations.city, "深圳"),
        eq(flashEncounterLocations.approvalStatus, "approved"),
        eq(flashEncounterLocations.isActive, true),
      ),
    )
    .where(eq(flashNpcs.isActive, true));

  const readyCategoryRows = await executor
    .select({
      category: flashTaskTemplates.category,
      count: sql<number>`count(distinct ${flashTaskTemplates.id})::int`,
    })
    .from(flashTaskTemplates)
    .innerJoin(
      flashNpcTaskLinks,
      and(
        eq(flashNpcTaskLinks.taskTemplateId, flashTaskTemplates.id),
        eq(flashNpcTaskLinks.isActive, true),
      ),
    )
    .innerJoin(
      flashNpcs,
      and(
        eq(flashNpcTaskLinks.npcId, flashNpcs.id),
        eq(flashNpcs.isActive, true),
        inArray(flashNpcs.slug, CANONICAL_FLASH_NPC_SLUGS),
      ),
    )
    .where(and(
      eq(flashTaskTemplates.reviewStatus, "active"),
      eq(flashTaskTemplates.isHumanReviewed, true),
      eq(flashTaskTemplates.isActive, true),
      inArray(flashTaskTemplates.category, CANONICAL_FLASH_TASK_CATEGORIES),
    ))
    .groupBy(flashTaskTemplates.category);

  const readyTaskCategoryCounts = Object.fromEntries(
    CANONICAL_FLASH_TASK_CATEGORIES.map((category) => [
      category,
      Number(readyCategoryRows.find((row: any) => row.category === category)?.count ?? 0),
    ]),
  );

  const [linked] = await executor
    .select({ count: sql<number>`count(distinct ${flashTaskTemplates.id})::int` })
    .from(flashTaskTemplates)
    .innerJoin(
      flashNpcTaskLinks,
      and(
        eq(flashNpcTaskLinks.taskTemplateId, flashTaskTemplates.id),
        eq(flashNpcTaskLinks.isActive, true),
      ),
    )
    .innerJoin(
      flashNpcs,
      and(
        eq(flashNpcTaskLinks.npcId, flashNpcs.id),
        eq(flashNpcs.isActive, true),
      ),
    )
    .where(and(
      eq(flashTaskTemplates.reviewStatus, "active"),
      eq(flashTaskTemplates.isHumanReviewed, true),
      eq(flashTaskTemplates.isActive, true),
    ));

  const [taskReady] = await executor
    .select({ count: sql<number>`count(distinct ${flashNpcs.id})::int` })
    .from(flashNpcs)
    .innerJoin(
      flashNpcTaskLinks,
      and(
        eq(flashNpcTaskLinks.npcId, flashNpcs.id),
        eq(flashNpcTaskLinks.isActive, true),
      ),
    )
    .innerJoin(
      flashTaskTemplates,
      and(
        eq(flashNpcTaskLinks.taskTemplateId, flashTaskTemplates.id),
        eq(flashTaskTemplates.reviewStatus, "active"),
        eq(flashTaskTemplates.isHumanReviewed, true),
        eq(flashTaskTemplates.isActive, true),
      ),
    )
    .where(eq(flashNpcs.isActive, true));

  return {
    activeNpcs,
    canonicalNpcs,
    canonicalWeekdayNpcs: countCanonicalFlashNpcWeekdayMatches(canonicalWeekdayRows),
    schedulableNpcs: Number(schedulable?.count ?? 0),
    taskReadyNpcs: Number(taskReady?.count ?? 0),
    reviewedTasks,
    approvedEncounterLocations,
    approvedTaskDestinations,
    linkedTasks: Number(linked?.count ?? 0),
    readyTaskCategoryCounts,
  };
}

export async function seedBuiltinFlashCatalog() {
  return db.transaction(async (tx: DbExecutor) => {
    for (let index = 0; index < FLASH_NPC_SEEDS.length; index += 1) {
      const npc = FLASH_NPC_SEEDS[index];
      await tx.insert(flashNpcs).values({
        slug: npc.slug,
        name: npc.name,
        species: npc.species,
        personalitySummary: npc.personalitySummary,
        inviteLine: npc.inviteLine,
        voiceGuide: npc.voiceGuide,
        dialogueQuestions: npc.dialogueQuestions,
        eligibleWeekdays: npc.eligibleWeekdays,
        oneShiftProbability: npc.oneShiftProbability,
        twoShiftProbability: npc.twoShiftProbability,
        minShiftMinutes: npc.minShiftMinutes,
        maxShiftMinutes: npc.maxShiftMinutes,
        minGapMinutes: npc.minGapMinutes,
        themeColor: npc.themeColor,
        sortOrder: index,
        isActive: true,
      }).onConflictDoNothing({ target: flashNpcs.slug });
    }

    for (const task of FLASH_TASK_SEEDS) {
      await tx.insert(flashTaskTemplates).values({
        code: task.code,
        category: task.category,
        title: task.title,
        brief: task.brief,
        instructions: task.instructions,
        dialogueIntro: task.dialogueIntro,
        feedbackPrompts: task.feedbackPrompts,
        tags: task.tags,
        durationDays: task.durationDays,
        baseWeight: task.baseWeight,
        safetyLevel: task.safetyLevel,
        safetyNotes: task.safetyNotes,
        contentVersion: 1,
        reviewStatus: "pending_review",
        isHumanReviewed: false,
        reviewedBy: null,
        reviewedAt: null,
        isActive: false,
      }).onConflictDoNothing({ target: flashTaskTemplates.code });

      await tx.update(flashTaskTemplates).set({
        category: task.category,
        title: task.title,
        brief: task.brief,
        instructions: task.instructions,
        dialogueIntro: task.dialogueIntro,
        feedbackPrompts: task.feedbackPrompts,
        tags: task.tags,
        safetyNotes: task.safetyNotes,
        contentVersion: sql`${flashTaskTemplates.contentVersion} + 1`,
        updatedAt: new Date(),
      }).where(and(
        eq(flashTaskTemplates.code, task.code),
        eq(flashTaskTemplates.reviewStatus, "pending_review"),
        eq(flashTaskTemplates.isHumanReviewed, false),
      ));
    }

    const npcRows = await tx.select({ id: flashNpcs.id, slug: flashNpcs.slug }).from(flashNpcs);
    const taskRows = await tx.select({ id: flashTaskTemplates.id, code: flashTaskTemplates.code }).from(flashTaskTemplates);
    const npcBySlug = new Map<string, string>(
      npcRows.map((row: any) => [String(row.slug), String(row.id)]),
    );
    const taskByCode = new Map<string, string>(
      taskRows.map((row: any) => [String(row.code), String(row.id)]),
    );
    const builtinTaskIds = [...taskByCode.entries()]
      .filter(([code]) => FLASH_TASK_SEEDS.some((seed) => seed.code === code))
      .map(([, id]) => id);
    if (builtinTaskIds.length > 0) {
      await tx.update(flashTaskDestinationLinks).set({
        isActive: false,
        updatedAt: new Date(),
      }).where(inArray(flashTaskDestinationLinks.taskTemplateId, builtinTaskIds));
    }

    for (const task of FLASH_TASK_SEEDS) {
      const taskTemplateId = taskByCode.get(task.code);
      if (!taskTemplateId) continue;
      const intendedNpcIds = task.npcSlugs
        .map((npcSlug) => npcBySlug.get(npcSlug))
        .filter((npcId): npcId is string => typeof npcId === "string");
      if (intendedNpcIds.length > 0) {
        await tx.update(flashNpcTaskLinks).set({
          isActive: false,
          updatedAt: new Date(),
        }).where(and(
          eq(flashNpcTaskLinks.taskTemplateId, taskTemplateId),
          notInArray(flashNpcTaskLinks.npcId, intendedNpcIds),
        ));
      }
      for (const npcSlug of task.npcSlugs) {
        const npcId = npcBySlug.get(npcSlug);
        if (!npcId) continue;
        await tx.insert(flashNpcTaskLinks).values({
          npcId,
          taskTemplateId,
          requestCopy: buildFlashNpcTaskRequestCopy(npcSlug, task),
          deliveryCopy: FLASH_DELIVERY_COPY_BY_NPC[npcSlug] ?? "我收到了。谢谢你替我去看。",
          weight: 100,
          isActive: true,
        }).onConflictDoUpdate({
          target: [flashNpcTaskLinks.npcId, flashNpcTaskLinks.taskTemplateId],
          set: {
            requestCopy: buildFlashNpcTaskRequestCopy(npcSlug, task),
            deliveryCopy: FLASH_DELIVERY_COPY_BY_NPC[npcSlug] ?? "我收到了。谢谢你替我去看。",
            isActive: true,
            updatedAt: new Date(),
          },
        });
      }
    }

    return {
      npcCount: npcRows.filter((row: any) => FLASH_NPC_SEEDS.some((seed) => seed.slug === row.slug)).length,
      taskCount: taskRows.filter((row: any) => FLASH_TASK_SEEDS.some((seed) => seed.code === row.code)).length,
      note: "Built-in invitations are destination-free; encounter locations and all task/NPC copy still require operator approval.",
    };
  });
}

/**
 * Persist the explicitly reviewed Shenzhen place catalog after the admin route
 * has verified every GCJ-02 coordinate through Tencent Maps. Existing approved
 * rows remain operator-owned; only missing or still-draft built-in rows are
 * synchronized.
 */
export async function seedBuiltinFlashLocations(
  reviewedBy: string,
  verifiedLocationKeys: ReadonlySet<string>,
  options: {
    locationSeeds?: ReadonlyArray<(typeof FLASH_LOCATION_SEEDS)[number]>;
    includeDestinations?: boolean;
  } = {},
) {
  return db.transaction(async (tx: DbExecutor) => {
    const locationSeeds = options.locationSeeds ?? FLASH_LOCATION_SEEDS;
    const includeDestinations = options.includeDestinations ?? true;
    const now = new Date();
    const npcRows = await tx.select({ id: flashNpcs.id }).from(flashNpcs)
      .where(and(eq(flashNpcs.isActive, true), inArray(flashNpcs.slug, CANONICAL_FLASH_NPC_SLUGS)));
    const taskRows = await tx.select({ id: flashTaskTemplates.id, category: flashTaskTemplates.category }).from(flashTaskTemplates)
      .where(notInArray(flashTaskTemplates.code, FLASH_TASK_SEEDS.map((task) => task.code)));
    const existingEncounters = await tx.select().from(flashEncounterLocations);
    const existingDestinations = await tx.select().from(flashTaskDestinations);
    const encounterByKey = new Map<string, any>(existingEncounters.map((row: any) => [`${row.district}:${row.name}`, row]));
    const destinationByKey = new Map<string, any>(existingDestinations.map((row: any) => [`${row.district}:${row.name}`, row]));
    const availabilityWindows = Array.from({ length: 7 }, (_, index) => ({
      weekday: index + 1,
      startTime: "09:00",
      endTime: "20:00",
    }));

    let encounterCount = 0;
    let destinationCount = 0;
    let approvedLocationCount = 0;
    let draftLocationCount = 0;
    for (const seed of locationSeeds) {
      const key = `${seed.district}:${seed.name}`;
      const isVerified = verifiedLocationKeys.has(key);
      if (isVerified) approvedLocationCount += 1;
      else draftLocationCount += 1;
      const encounterValues = {
        name: seed.name,
        city: "深圳",
        district: seed.district,
        address: seed.address,
        latitude: seed.latitude,
        longitude: seed.longitude,
        coordinateSystem: "gcj02",
        availabilityWindows,
        approvalStatus: isVerified ? "approved" : "draft",
        safetyNotes: seed.safetyNotes,
        lastReviewedAt: isVerified ? now : null,
        reviewedBy: isVerified ? reviewedBy : null,
        isActive: isVerified,
      } as const;
      const existingEncounter = encounterByKey.get(key);
      let encounter = existingEncounter;
      if (!existingEncounter) {
        [encounter] = await tx.insert(flashEncounterLocations).values(encounterValues).returning();
      } else if (existingEncounter.approvalStatus !== "approved") {
        [encounter] = await tx.update(flashEncounterLocations).set({ ...encounterValues, updatedAt: now })
          .where(eq(flashEncounterLocations.id, existingEncounter.id)).returning();
      }
      if (encounter) {
        encounterCount += 1;
        for (const npc of npcRows) {
          await tx.insert(flashNpcLocationLinks).values({ npcId: npc.id, locationId: encounter.id, isActive: true })
            .onConflictDoUpdate({
              target: [flashNpcLocationLinks.npcId, flashNpcLocationLinks.locationId],
              set: { isActive: true, updatedAt: now },
            });
        }
      }

      if (!includeDestinations) continue;
      const destinationValues = {
        name: seed.name,
        city: "深圳",
        district: seed.district,
        address: seed.address,
        latitude: seed.latitude,
        longitude: seed.longitude,
        coordinateSystem: "gcj02",
        destinationType: seed.destinationType,
        tags: seed.tags,
        approvalStatus: isVerified ? "approved" : "draft",
        safetyNotes: seed.safetyNotes,
        lastReviewedAt: isVerified ? now : null,
        reviewedBy: isVerified ? reviewedBy : null,
        isActive: isVerified,
      } as const;
      const existingDestination = destinationByKey.get(key);
      let destination = existingDestination;
      if (!existingDestination) {
        [destination] = await tx.insert(flashTaskDestinations).values(destinationValues).returning();
      } else if (existingDestination.approvalStatus !== "approved") {
        [destination] = await tx.update(flashTaskDestinations).set({ ...destinationValues, updatedAt: now })
          .where(eq(flashTaskDestinations.id, existingDestination.id)).returning();
      }
      if (destination) {
        destinationCount += 1;
        for (const task of taskRows.filter((row: any) => seed.taskCategories.includes(row.category))) {
          await tx.insert(flashTaskDestinationLinks).values({
            taskTemplateId: task.id,
            destinationId: destination.id,
            isActive: true,
          }).onConflictDoUpdate({
            target: [flashTaskDestinationLinks.taskTemplateId, flashTaskDestinationLinks.destinationId],
            set: { isActive: true, updatedAt: now },
          });
        }
      }
    }

    return { encounterCount, destinationCount, approvedLocationCount, draftLocationCount };
  });
}

export function listFlashNpcs(executor: DbExecutor = db) {
  return executor.select().from(flashNpcs).orderBy(asc(flashNpcs.sortOrder), asc(flashNpcs.name));
}

export async function createFlashNpc(values: typeof flashNpcs.$inferInsert, executor: DbExecutor = db) {
  const [row] = await executor.insert(flashNpcs).values(values).returning();
  return row;
}

export async function updateFlashNpc(id: string, values: Partial<typeof flashNpcs.$inferInsert>, executor: DbExecutor = db) {
  const [row] = await executor.update(flashNpcs).set({ ...values, updatedAt: new Date() }).where(eq(flashNpcs.id, id)).returning();
  return row ?? null;
}

export function listFlashEncounterLocations(executor: DbExecutor = db) {
  return executor.select().from(flashEncounterLocations).orderBy(asc(flashEncounterLocations.district), asc(flashEncounterLocations.name));
}

export async function createFlashEncounterLocation(values: typeof flashEncounterLocations.$inferInsert, executor: DbExecutor = db) {
  const [row] = await executor.insert(flashEncounterLocations).values(values).returning();
  return row;
}

export async function updateFlashEncounterLocation(id: string, values: Partial<typeof flashEncounterLocations.$inferInsert>, executor: DbExecutor = db) {
  const [row] = await executor.update(flashEncounterLocations).set({ ...values, updatedAt: new Date() }).where(eq(flashEncounterLocations.id, id)).returning();
  return row ?? null;
}

export function listFlashTaskDestinations(executor: DbExecutor = db) {
  return executor.select().from(flashTaskDestinations).orderBy(asc(flashTaskDestinations.district), asc(flashTaskDestinations.name));
}

export async function createFlashTaskDestination(values: typeof flashTaskDestinations.$inferInsert, executor: DbExecutor = db) {
  const [row] = await executor.insert(flashTaskDestinations).values(values).returning();
  return row;
}

export async function updateFlashTaskDestination(id: string, values: Partial<typeof flashTaskDestinations.$inferInsert>, executor: DbExecutor = db) {
  const [row] = await executor.update(flashTaskDestinations).set({ ...values, updatedAt: new Date() }).where(eq(flashTaskDestinations.id, id)).returning();
  return row ?? null;
}

export function listFlashTaskTemplates(executor: DbExecutor = db) {
  return executor.select().from(flashTaskTemplates).orderBy(asc(flashTaskTemplates.code));
}

export async function createFlashTaskTemplate(values: typeof flashTaskTemplates.$inferInsert, executor: DbExecutor = db) {
  const [row] = await executor.insert(flashTaskTemplates).values(values).returning();
  return row;
}

export async function updateFlashTaskTemplate(
  id: string,
  expectedContentVersion: number,
  values: Partial<typeof flashTaskTemplates.$inferInsert>,
  executor: DbExecutor = db,
) {
  const [row] = await executor.update(flashTaskTemplates).set({ ...values, updatedAt: new Date() }).where(and(
    eq(flashTaskTemplates.id, id),
    eq(flashTaskTemplates.contentVersion, expectedContentVersion),
  )).returning();
  return row ?? null;
}

export async function withdrawActiveFlashAssignmentsForDestination(
  destinationId: string,
  withdrawalReason: string,
  now: Date,
  executor: DbExecutor = db,
) {
  const assignments = await executor.update(flashTaskAssignments).set({
    status: "withdrawn",
    withdrawalReason,
    privateReply: null,
    privateReplyDeleteAfter: null,
    updatedAt: now,
  }).where(and(
    eq(flashTaskAssignments.destinationId, destinationId),
    inArray(flashTaskAssignments.status, [...ACTIVE_ASSIGNMENT_STATUSES]),
  )).returning({ id: flashTaskAssignments.id });

  const encounters = await executor.update(flashEncounters).set({
    status: "declined",
    completedAt: now,
    updatedAt: now,
  }).where(and(
    eq(flashEncounters.offeredDestinationId, destinationId),
    eq(flashEncounters.status, "offered"),
  )).returning({ id: flashEncounters.id });

  return { assignmentCount: assignments.length, encounterCount: encounters.length };
}

export async function withdrawOfferedFlashEncountersForTaskTemplate(
  taskTemplateId: string,
  now: Date,
  executor: DbExecutor = db,
): Promise<number> {
  const encounters = await executor.update(flashEncounters).set({
    status: "declined",
    completedAt: now,
    updatedAt: now,
  }).where(and(
    eq(flashEncounters.offeredTaskTemplateId, taskTemplateId),
    eq(flashEncounters.status, "offered"),
  )).returning({ id: flashEncounters.id });
  return encounters.length;
}

export async function declineUnavailableFlashEncounterOffer(input: {
  encounterId: string;
  userId: string;
  taskTemplateId: string | null;
  destinationId: string | null;
  now: Date;
}, executor: DbExecutor = db): Promise<boolean> {
  const [encounter] = await executor.update(flashEncounters).set({
    status: "declined",
    completedAt: input.now,
    updatedAt: input.now,
  }).where(and(
    eq(flashEncounters.id, input.encounterId),
    eq(flashEncounters.userId, input.userId),
    eq(flashEncounters.status, "offered"),
    input.taskTemplateId === null
      ? isNull(flashEncounters.offeredTaskTemplateId)
      : eq(flashEncounters.offeredTaskTemplateId, input.taskTemplateId),
    input.destinationId === null
      ? isNull(flashEncounters.offeredDestinationId)
      : eq(flashEncounters.offeredDestinationId, input.destinationId),
  )).returning({ id: flashEncounters.id });
  return Boolean(encounter);
}

/** Replace the NPC allow-list owned by one encounter location. */
export async function replaceFlashNpcLocationLinks(locationId: string, npcIds: string[], executor: DbExecutor = db) {
  await executor.delete(flashNpcLocationLinks).where(eq(flashNpcLocationLinks.locationId, locationId));
  if (npcIds.length > 0) {
    await executor.insert(flashNpcLocationLinks).values(npcIds.map((npcId) => ({ npcId, locationId, isActive: true })));
  }
}

export function listFlashNpcLocationLinks(executor: DbExecutor = db) {
  return executor.select({
    id: flashNpcLocationLinks.id,
    npcId: flashNpcLocationLinks.npcId,
    locationId: flashNpcLocationLinks.locationId,
    weight: flashNpcLocationLinks.weight,
    isActive: flashNpcLocationLinks.isActive,
  }).from(flashNpcLocationLinks).orderBy(asc(flashNpcLocationLinks.npcId));
}

export async function replaceFlashTaskDestinationLinks(taskTemplateId: string, destinationIds: string[], executor: DbExecutor = db) {
  await executor.delete(flashTaskDestinationLinks).where(eq(flashTaskDestinationLinks.taskTemplateId, taskTemplateId));
  if (destinationIds.length > 0) {
    await executor.insert(flashTaskDestinationLinks).values(destinationIds.map((destinationId) => ({ taskTemplateId, destinationId, isActive: true })));
  }
}

export function listFlashTaskDestinationLinks(executor: DbExecutor = db) {
  return executor.select({
    id: flashTaskDestinationLinks.id,
    taskTemplateId: flashTaskDestinationLinks.taskTemplateId,
    destinationId: flashTaskDestinationLinks.destinationId,
    weight: flashTaskDestinationLinks.weight,
    isActive: flashTaskDestinationLinks.isActive,
  }).from(flashTaskDestinationLinks).orderBy(asc(flashTaskDestinationLinks.taskTemplateId));
}

export async function replaceFlashNpcTaskLinks(
  taskTemplateId: string,
  links: Array<{ npcId: string; requestCopy: string; deliveryCopy: string; weight?: number }>,
  executor: DbExecutor = db,
) {
  await executor.delete(flashNpcTaskLinks).where(eq(flashNpcTaskLinks.taskTemplateId, taskTemplateId));
  if (links.length > 0) {
    await executor.insert(flashNpcTaskLinks).values(links.map((link) => ({
      ...link,
      taskTemplateId,
      weight: link.weight ?? 100,
      isActive: true,
    })));
  }
}

export function listFlashNpcTaskLinks(executor: DbExecutor = db) {
  return executor.select({
    id: flashNpcTaskLinks.id,
    npcId: flashNpcTaskLinks.npcId,
    taskTemplateId: flashNpcTaskLinks.taskTemplateId,
    requestCopy: flashNpcTaskLinks.requestCopy,
    deliveryCopy: flashNpcTaskLinks.deliveryCopy,
    weight: flashNpcTaskLinks.weight,
    isActive: flashNpcTaskLinks.isActive,
  }).from(flashNpcTaskLinks).orderBy(asc(flashNpcTaskLinks.taskTemplateId));
}

export async function listOnlineFlashAppearances(now: Date, executor: DbExecutor = db) {
  return executor
    .select({
      appearanceId: flashShifts.id,
      shiftEndsAt: flashShifts.endsAt,
      npcId: flashNpcs.id,
      npcSlug: flashNpcs.slug,
      npcName: flashNpcs.name,
      species: flashNpcs.species,
      personalitySummary: flashNpcs.personalitySummary,
      inviteLine: flashNpcs.inviteLine,
      themeColor: flashNpcs.themeColor,
      avatarUrl: flashNpcs.avatarUrl,
      district: flashEncounterLocations.district,
      locationAddress: flashEncounterLocations.address,
    })
    .from(flashShifts)
    .innerJoin(flashSchedulePlans, eq(flashShifts.planId, flashSchedulePlans.id))
    .innerJoin(flashNpcs, eq(flashShifts.npcId, flashNpcs.id))
    .innerJoin(flashEncounterLocations, eq(flashShifts.locationId, flashEncounterLocations.id))
    .where(and(
      eq(flashSchedulePlans.city, "深圳"),
      eq(flashSchedulePlans.status, "published"),
      eq(flashShifts.status, "published"),
      eq(flashNpcs.isActive, true),
      eq(flashEncounterLocations.isActive, true),
      eq(flashEncounterLocations.approvalStatus, "approved"),
      lte(flashShifts.startsAt, now),
      gt(flashShifts.endsAt, now),
    ));
}

export async function getLiveFlashAppearance(appearanceId: string, now: Date, executor: DbExecutor = db) {
  const [row] = await executor
    .select({
      appearanceId: flashShifts.id,
      startsAt: flashShifts.startsAt,
      endsAt: flashShifts.endsAt,
      npcId: flashNpcs.id,
      npcSlug: flashNpcs.slug,
      npcName: flashNpcs.name,
      species: flashNpcs.species,
      personalitySummary: flashNpcs.personalitySummary,
      inviteLine: flashNpcs.inviteLine,
      themeColor: flashNpcs.themeColor,
      avatarUrl: flashNpcs.avatarUrl,
      dialogueQuestions: flashNpcs.dialogueQuestions,
      locationId: flashEncounterLocations.id,
      district: flashEncounterLocations.district,
      latitude: flashEncounterLocations.latitude,
      longitude: flashEncounterLocations.longitude,
    })
    .from(flashShifts)
    .innerJoin(flashSchedulePlans, eq(flashShifts.planId, flashSchedulePlans.id))
    .innerJoin(flashNpcs, eq(flashShifts.npcId, flashNpcs.id))
    .innerJoin(flashEncounterLocations, eq(flashShifts.locationId, flashEncounterLocations.id))
    .where(and(
      eq(flashShifts.id, appearanceId),
      eq(flashSchedulePlans.status, "published"),
      eq(flashShifts.status, "published"),
      eq(flashNpcs.isActive, true),
      eq(flashEncounterLocations.isActive, true),
      eq(flashEncounterLocations.approvalStatus, "approved"),
      lte(flashShifts.startsAt, now),
      gt(flashShifts.endsAt, now),
    ))
    .limit(1);
  return row ?? null;
}

export async function consumeFlashLocateBudget(input: {
  userId: string;
  shiftId: string;
  now: Date;
  windowMs?: number;
  maxAttempts?: number;
}, executor: DbExecutor = db): Promise<{ allowed: boolean; attemptCount: number; retryAfterSeconds: number }> {
  const windowMs = input.windowMs ?? 10 * 60 * 1000;
  const maxAttempts = input.maxAttempts ?? 360;
  const resetCutoff = new Date(input.now.getTime() - windowMs);
  const [row] = await executor.insert(flashLocateBudgets).values({
    userId: input.userId,
    shiftId: input.shiftId,
    windowStartedAt: input.now,
    attemptCount: 1,
    updatedAt: input.now,
  }).onConflictDoUpdate({
    target: [flashLocateBudgets.userId, flashLocateBudgets.shiftId],
    set: {
      attemptCount: sql`case when ${flashLocateBudgets.windowStartedAt} <= ${resetCutoff} then 1 else ${flashLocateBudgets.attemptCount} + 1 end`,
      windowStartedAt: sql`case when ${flashLocateBudgets.windowStartedAt} <= ${resetCutoff} then ${input.now} else ${flashLocateBudgets.windowStartedAt} end`,
      updatedAt: input.now,
    },
  }).returning({
    attemptCount: flashLocateBudgets.attemptCount,
    windowStartedAt: flashLocateBudgets.windowStartedAt,
  });
  const attemptCount = Number(row?.attemptCount ?? maxAttempts + 1);
  const resetAt = (row?.windowStartedAt ?? input.now).getTime() + windowMs;
  return {
    allowed: attemptCount <= maxAttempts,
    attemptCount,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - input.now.getTime()) / 1000)),
  };
}

export async function purgeExpiredFlashLocateBudgets(
  cutoff: Date,
  executor: DbExecutor = db,
): Promise<number> {
  const removed = await executor.delete(flashLocateBudgets)
    .where(lte(flashLocateBudgets.updatedAt, cutoff))
    .returning({ id: flashLocateBudgets.id });
  return removed.length;
}

export async function getOrCreateFlashEncounter(input: {
  userId: string;
  appearance: Awaited<ReturnType<typeof getLiveFlashAppearance>> & {};
  contextDistrict: string;
  now: Date;
  expiresAt: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    const [created] = await tx.insert(flashEncounters).values({
      userId: input.userId,
      shiftId: input.appearance.appearanceId,
      npcId: input.appearance.npcId,
      status: "dialogue",
      answers: [],
      currentQuestionIndex: 0,
      // District personalization is based on the user's one-shot, Tencent-
      // verified location. Never infer it from the hidden NPC point.
      contextDistrict: input.contextDistrict,
      unlockedAt: input.now,
      expiresAt: input.expiresAt,
    }).onConflictDoNothing({
      target: [flashEncounters.userId, flashEncounters.shiftId],
    }).returning();

    const [encounter] = created ? [created] : await tx
      .select()
      .from(flashEncounters)
      .where(and(
        eq(flashEncounters.userId, input.userId),
        eq(flashEncounters.shiftId, input.appearance.appearanceId),
      ))
      .limit(1);

    if (created) {
      await tx.insert(flashNpcRelationships).values({
        userId: input.userId,
        npcId: input.appearance.npcId,
        encounterCount: 1,
        lastMetAt: input.now,
      }).onConflictDoUpdate({
        target: [flashNpcRelationships.userId, flashNpcRelationships.npcId],
        set: {
          encounterCount: sql`${flashNpcRelationships.encounterCount} + 1`,
          lastMetAt: input.now,
          updatedAt: input.now,
        },
      });
    }
    return encounter ?? null;
  });
}

export async function expireFlashEncounterIfNeeded(encounterId: string, userId: string, now: Date) {
  const [expired] = await db.update(flashEncounters).set({
    status: "expired",
    completedAt: now,
    updatedAt: now,
  }).where(and(
    eq(flashEncounters.id, encounterId),
    eq(flashEncounters.userId, userId),
    lt(flashEncounters.expiresAt, now),
    inArray(flashEncounters.status, ["dialogue", "offered"]),
  )).returning({ id: flashEncounters.id });
  return Boolean(expired);
}

export async function getFlashEncounterOwned(encounterId: string, userId: string, executor: DbExecutor = db) {
  const [row] = await executor
    .select({
      id: flashEncounters.id,
      userId: flashEncounters.userId,
      shiftId: flashEncounters.shiftId,
      npcId: flashEncounters.npcId,
      status: flashEncounters.status,
      answers: flashEncounters.answers,
      currentQuestionIndex: flashEncounters.currentQuestionIndex,
      offeredTaskTemplateId: flashEncounters.offeredTaskTemplateId,
      offeredDestinationId: flashEncounters.offeredDestinationId,
      firstOfferedTaskTemplateId: flashEncounters.firstOfferedTaskTemplateId,
      rerollCount: flashEncounters.rerollCount,
      contextDistrict: flashEncounters.contextDistrict,
      unlockedAt: flashEncounters.unlockedAt,
      expiresAt: flashEncounters.expiresAt,
      completedAt: flashEncounters.completedAt,
      npcSlug: flashNpcs.slug,
      npcName: flashNpcs.name,
      species: flashNpcs.species,
      personalitySummary: flashNpcs.personalitySummary,
      themeColor: flashNpcs.themeColor,
      avatarUrl: flashNpcs.avatarUrl,
      dialogueQuestions: flashNpcs.dialogueQuestions,
    })
    .from(flashEncounters)
    .innerJoin(flashNpcs, eq(flashEncounters.npcId, flashNpcs.id))
    .where(and(eq(flashEncounters.id, encounterId), eq(flashEncounters.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getLatestResumableFlashEncounter(
  userId: string,
  now: Date,
  executor: DbExecutor = db,
) {
  const [row] = await executor.select({ id: flashEncounters.id })
    .from(flashEncounters)
    .where(and(
      eq(flashEncounters.userId, userId),
      inArray(flashEncounters.status, ["dialogue", "offered"]),
      gt(flashEncounters.expiresAt, now),
    ))
    .orderBy(desc(flashEncounters.unlockedAt))
    .limit(1);
  return row ?? null;
}

export async function appendFlashEncounterAnswer(input: {
  encounterId: string;
  userId: string;
  expectedQuestionIndex: number;
  answer: { questionId: string; optionId: string; tags: string[] };
  now: Date;
}) {
  const [row] = await db.update(flashEncounters).set({
    answers: sql`${flashEncounters.answers} || ${JSON.stringify([input.answer])}::jsonb`,
    currentQuestionIndex: input.expectedQuestionIndex + 1,
    updatedAt: input.now,
  }).where(and(
    eq(flashEncounters.id, input.encounterId),
    eq(flashEncounters.userId, input.userId),
    eq(flashEncounters.status, "dialogue"),
    eq(flashEncounters.currentQuestionIndex, input.expectedQuestionIndex),
    gt(flashEncounters.expiresAt, input.now),
  )).returning();
  return row ?? null;
}

export async function setFlashEncounterOffer(input: {
  encounterId: string;
  userId: string;
  taskTemplateId: string;
  destinationId: string | null;
  isReroll: boolean;
  now: Date;
}) {
  const [row] = await db.update(flashEncounters).set({
    status: "offered",
    offeredTaskTemplateId: input.taskTemplateId,
    offeredDestinationId: input.destinationId,
    firstOfferedTaskTemplateId: input.isReroll
      ? flashEncounters.firstOfferedTaskTemplateId
      : input.taskTemplateId,
    rerollCount: input.isReroll ? 1 : flashEncounters.rerollCount,
    updatedAt: input.now,
  }).where(and(
    eq(flashEncounters.id, input.encounterId),
    eq(flashEncounters.userId, input.userId),
    input.isReroll
      ? and(eq(flashEncounters.status, "offered"), eq(flashEncounters.rerollCount, 0))
      : eq(flashEncounters.status, "dialogue"),
    gt(flashEncounters.expiresAt, input.now),
  )).returning();
  return row ?? null;
}

export async function declineFlashEncounter(encounterId: string, userId: string, now: Date) {
  const [row] = await db.update(flashEncounters).set({
    status: "declined",
    completedAt: now,
    updatedAt: now,
  }).where(and(
    eq(flashEncounters.id, encounterId),
    eq(flashEncounters.userId, userId),
    inArray(flashEncounters.status, ["dialogue", "offered"]),
    gt(flashEncounters.expiresAt, now),
  )).returning();
  return row ?? null;
}

export type FlashTaskOfferEligibilityState = {
  templateIsActive: boolean;
  templateIsHumanReviewed: boolean;
  templateReviewStatus: string;
  destinationIsActive: boolean;
  destinationApprovalStatus: string;
  destinationCity: string;
  npcTaskLinkIsActive: boolean;
  taskDestinationLinkIsActive: boolean;
};

export function isFlashTaskOfferEligibleForAcceptance(
  state: FlashTaskOfferEligibilityState,
): boolean {
  return state.templateIsActive
    && state.templateIsHumanReviewed
    && state.templateReviewStatus === "active"
    && state.destinationIsActive
    && state.destinationApprovalStatus === "approved"
    && state.destinationCity === "深圳"
    && state.npcTaskLinkIsActive
    && state.taskDestinationLinkIsActive;
}

/**
 * Lock every mutable row that authorizes an offer, then evaluate the locked
 * values. Admin template edits lock the template first; keeping the same first
 * lock here avoids an encounter/template lock inversion with offer withdrawal.
 */
export async function lockEligibleFlashTaskOfferForAcceptance(input: {
  npcId: string;
  taskTemplateId: string;
  destinationId: string;
}, executor: DbExecutor) {
  const [template] = await executor.select({
    taskTemplateId: flashTaskTemplates.id,
    code: flashTaskTemplates.code,
    category: flashTaskTemplates.category,
    title: flashTaskTemplates.title,
    brief: flashTaskTemplates.brief,
    instructions: flashTaskTemplates.instructions,
    dialogueIntro: flashTaskTemplates.dialogueIntro,
    feedbackPrompts: flashTaskTemplates.feedbackPrompts,
    tags: flashTaskTemplates.tags,
    durationDays: flashTaskTemplates.durationDays,
    baseWeight: flashTaskTemplates.baseWeight,
    contentVersion: flashTaskTemplates.contentVersion,
    templateIsActive: flashTaskTemplates.isActive,
    templateIsHumanReviewed: flashTaskTemplates.isHumanReviewed,
    templateReviewStatus: flashTaskTemplates.reviewStatus,
  }).from(flashTaskTemplates)
    .where(eq(flashTaskTemplates.id, input.taskTemplateId))
    .for("update", { of: flashTaskTemplates })
    .limit(1);
  if (!template) return null;

  const [destination] = await executor.select({
    destinationId: flashTaskDestinations.id,
    destinationName: flashTaskDestinations.name,
    destinationCity: flashTaskDestinations.city,
    destinationDistrict: flashTaskDestinations.district,
    destinationAddress: flashTaskDestinations.address,
    destinationLatitude: flashTaskDestinations.latitude,
    destinationLongitude: flashTaskDestinations.longitude,
    destinationCoordinateSystem: flashTaskDestinations.coordinateSystem,
    destinationTags: flashTaskDestinations.tags,
    destinationIsActive: flashTaskDestinations.isActive,
    destinationApprovalStatus: flashTaskDestinations.approvalStatus,
  }).from(flashTaskDestinations)
    .where(eq(flashTaskDestinations.id, input.destinationId))
    .for("update", { of: flashTaskDestinations })
    .limit(1);
  if (!destination) return null;

  const [npcTaskLink] = await executor.select({
    npcTaskLinkId: flashNpcTaskLinks.id,
    requestCopy: flashNpcTaskLinks.requestCopy,
    deliveryCopy: flashNpcTaskLinks.deliveryCopy,
    npcWeight: flashNpcTaskLinks.weight,
    npcTaskLinkIsActive: flashNpcTaskLinks.isActive,
  }).from(flashNpcTaskLinks)
    .where(and(
      eq(flashNpcTaskLinks.npcId, input.npcId),
      eq(flashNpcTaskLinks.taskTemplateId, input.taskTemplateId),
    ))
    .for("update", { of: flashNpcTaskLinks })
    .limit(1);
  if (!npcTaskLink) return null;

  const [taskDestinationLink] = await executor.select({
    taskDestinationLinkId: flashTaskDestinationLinks.id,
    destinationLinkWeight: flashTaskDestinationLinks.weight,
    taskDestinationLinkIsActive: flashTaskDestinationLinks.isActive,
  }).from(flashTaskDestinationLinks)
    .where(and(
      eq(flashTaskDestinationLinks.taskTemplateId, input.taskTemplateId),
      eq(flashTaskDestinationLinks.destinationId, input.destinationId),
    ))
    .for("update", { of: flashTaskDestinationLinks })
    .limit(1);
  if (!taskDestinationLink) return null;

  if (!isFlashTaskOfferEligibleForAcceptance({
    templateIsActive: template.templateIsActive,
    templateIsHumanReviewed: template.templateIsHumanReviewed,
    templateReviewStatus: template.templateReviewStatus,
    destinationIsActive: destination.destinationIsActive,
    destinationApprovalStatus: destination.destinationApprovalStatus,
    destinationCity: destination.destinationCity,
    npcTaskLinkIsActive: npcTaskLink.npcTaskLinkIsActive,
    taskDestinationLinkIsActive: taskDestinationLink.taskDestinationLinkIsActive,
  })) return null;

  return {
    ...template,
    ...destination,
    requestCopy: npcTaskLink.requestCopy,
    deliveryCopy: npcTaskLink.deliveryCopy,
    npcWeight: npcTaskLink.npcWeight,
    destinationLinkWeight: taskDestinationLink.destinationLinkWeight,
  };
}

async function lockEligibleDestinationFreeFlashOfferForAcceptance(input: {
  npcId: string;
  taskTemplateId: string;
}, executor: DbExecutor) {
  const [template] = await executor.select({
    taskTemplateId: flashTaskTemplates.id,
    code: flashTaskTemplates.code,
    category: flashTaskTemplates.category,
    title: flashTaskTemplates.title,
    brief: flashTaskTemplates.brief,
    instructions: flashTaskTemplates.instructions,
    dialogueIntro: flashTaskTemplates.dialogueIntro,
    feedbackPrompts: flashTaskTemplates.feedbackPrompts,
    tags: flashTaskTemplates.tags,
    durationDays: flashTaskTemplates.durationDays,
    baseWeight: flashTaskTemplates.baseWeight,
    contentVersion: flashTaskTemplates.contentVersion,
    templateIsActive: flashTaskTemplates.isActive,
    templateIsHumanReviewed: flashTaskTemplates.isHumanReviewed,
    templateReviewStatus: flashTaskTemplates.reviewStatus,
  }).from(flashTaskTemplates)
    .where(eq(flashTaskTemplates.id, input.taskTemplateId))
    .for("update", { of: flashTaskTemplates })
    .limit(1);
  if (
    !template
    || !getFlashInvitationDefinition(template.code)
    || !template.templateIsActive
    || !template.templateIsHumanReviewed
    || template.templateReviewStatus !== "active"
  ) return null;

  const [npcTaskLink] = await executor.select({
    requestCopy: flashNpcTaskLinks.requestCopy,
    deliveryCopy: flashNpcTaskLinks.deliveryCopy,
    npcWeight: flashNpcTaskLinks.weight,
    npcTaskLinkIsActive: flashNpcTaskLinks.isActive,
  }).from(flashNpcTaskLinks)
    .where(and(
      eq(flashNpcTaskLinks.npcId, input.npcId),
      eq(flashNpcTaskLinks.taskTemplateId, input.taskTemplateId),
    ))
    .for("update", { of: flashNpcTaskLinks })
    .limit(1);
  if (!npcTaskLink?.npcTaskLinkIsActive) return null;
  return {
    ...template,
    ...npcTaskLink,
    destinationId: null,
    destinationName: null,
    destinationCity: null,
    destinationDistrict: null,
    destinationAddress: null,
    destinationLatitude: null,
    destinationLongitude: null,
    destinationCoordinateSystem: null,
    destinationTags: [] as string[],
    destinationLinkWeight: 100,
  };
}

export async function listFlashTaskCandidates(npcId: string, executor: DbExecutor = db) {
  const invitationCodes = FLASH_TASK_SEEDS.map((task) => task.code);
  const destinationRows = await executor
    .select({
      taskTemplateId: flashTaskTemplates.id,
      code: flashTaskTemplates.code,
      category: flashTaskTemplates.category,
      title: flashTaskTemplates.title,
      brief: flashTaskTemplates.brief,
      instructions: flashTaskTemplates.instructions,
      dialogueIntro: flashTaskTemplates.dialogueIntro,
      feedbackPrompts: flashTaskTemplates.feedbackPrompts,
      tags: flashTaskTemplates.tags,
      durationDays: flashTaskTemplates.durationDays,
      baseWeight: flashTaskTemplates.baseWeight,
      contentVersion: flashTaskTemplates.contentVersion,
      requestCopy: flashNpcTaskLinks.requestCopy,
      deliveryCopy: flashNpcTaskLinks.deliveryCopy,
      npcWeight: flashNpcTaskLinks.weight,
      destinationLinkWeight: flashTaskDestinationLinks.weight,
      destinationId: flashTaskDestinations.id,
      destinationName: flashTaskDestinations.name,
      destinationCity: flashTaskDestinations.city,
      destinationDistrict: flashTaskDestinations.district,
      destinationAddress: flashTaskDestinations.address,
      destinationLatitude: flashTaskDestinations.latitude,
      destinationLongitude: flashTaskDestinations.longitude,
      destinationCoordinateSystem: flashTaskDestinations.coordinateSystem,
      destinationTags: flashTaskDestinations.tags,
    })
    .from(flashNpcTaskLinks)
    .innerJoin(flashTaskTemplates, eq(flashNpcTaskLinks.taskTemplateId, flashTaskTemplates.id))
    .innerJoin(
      flashTaskDestinationLinks,
      and(
        eq(flashTaskDestinationLinks.taskTemplateId, flashTaskTemplates.id),
        eq(flashTaskDestinationLinks.isActive, true),
      ),
    )
    .innerJoin(flashTaskDestinations, eq(flashTaskDestinationLinks.destinationId, flashTaskDestinations.id))
    .where(and(
      eq(flashNpcTaskLinks.npcId, npcId),
      eq(flashNpcTaskLinks.isActive, true),
      eq(flashTaskTemplates.isActive, true),
      eq(flashTaskTemplates.isHumanReviewed, true),
      eq(flashTaskTemplates.reviewStatus, "active"),
      notInArray(flashTaskTemplates.code, invitationCodes),
      eq(flashTaskDestinations.city, "深圳"),
      eq(flashTaskDestinations.isActive, true),
      eq(flashTaskDestinations.approvalStatus, "approved"),
    ));
  const invitationRows = await executor.select({
    taskTemplateId: flashTaskTemplates.id,
    code: flashTaskTemplates.code,
    category: flashTaskTemplates.category,
    title: flashTaskTemplates.title,
    brief: flashTaskTemplates.brief,
    instructions: flashTaskTemplates.instructions,
    dialogueIntro: flashTaskTemplates.dialogueIntro,
    feedbackPrompts: flashTaskTemplates.feedbackPrompts,
    tags: flashTaskTemplates.tags,
    durationDays: flashTaskTemplates.durationDays,
    baseWeight: flashTaskTemplates.baseWeight,
    contentVersion: flashTaskTemplates.contentVersion,
    requestCopy: flashNpcTaskLinks.requestCopy,
    deliveryCopy: flashNpcTaskLinks.deliveryCopy,
    npcWeight: flashNpcTaskLinks.weight,
    destinationLinkWeight: sql<number>`100`,
    destinationId: sql<string | null>`null`,
    destinationName: sql<string | null>`null`,
    destinationCity: sql<string | null>`null`,
    destinationDistrict: sql<string | null>`null`,
    destinationAddress: sql<string | null>`null`,
    destinationLatitude: sql<number | null>`null`,
    destinationLongitude: sql<number | null>`null`,
    destinationCoordinateSystem: sql<string | null>`null`,
    destinationTags: sql<string[]>`array[]::text[]`,
  }).from(flashNpcTaskLinks)
    .innerJoin(flashTaskTemplates, eq(flashNpcTaskLinks.taskTemplateId, flashTaskTemplates.id))
    .where(and(
      eq(flashNpcTaskLinks.npcId, npcId),
      eq(flashNpcTaskLinks.isActive, true),
      eq(flashTaskTemplates.isActive, true),
      eq(flashTaskTemplates.isHumanReviewed, true),
      eq(flashTaskTemplates.reviewStatus, "active"),
      inArray(flashTaskTemplates.code, invitationCodes),
    ));
  return [...destinationRows, ...invitationRows];
}

export async function getFlashTaskOffer(input: {
  npcId: string;
  taskTemplateId: string;
  destinationId: string | null;
}, executor: DbExecutor = db) {
  const rows = await listFlashTaskCandidates(input.npcId, executor);
  return rows.find((row: any) => row.taskTemplateId === input.taskTemplateId && row.destinationId === input.destinationId) ?? null;
}

export async function getUserActiveFlashTemplateIds(userId: string, now: Date, executor: DbExecutor = db) {
  const rows = await executor.select({ taskTemplateId: flashTaskAssignments.taskTemplateId })
    .from(flashTaskAssignments)
    .where(and(
      eq(flashTaskAssignments.userId, userId),
      inArray(flashTaskAssignments.status, [...ACTIVE_ASSIGNMENT_STATUSES]),
      or(gt(flashTaskAssignments.expiresAt, now), eq(flashTaskAssignments.status, "ready_to_deliver")),
    ));
  return rows.map((row: any) => row.taskTemplateId);
}

export async function getUserFlashCompletionCounts(userId: string, executor: DbExecutor = db) {
  const rows = await executor
    .select({
      taskTemplateId: flashTaskAssignments.taskTemplateId,
      count: sql<number>`count(*)::int`,
    })
    .from(flashTaskAssignments)
    .where(and(
      eq(flashTaskAssignments.userId, userId),
      inArray(flashTaskAssignments.status, [...FLASH_REPEAT_DECAY_STATUSES]),
    ))
    .groupBy(flashTaskAssignments.taskTemplateId);
  return new Map(rows.map((row: any) => [row.taskTemplateId, Number(row.count)]));
}

export async function getFlashUserPersonalitySignal(userId: string, executor: DbExecutor = db) {
  const [row] = await executor
    .select({
      primaryArchetype: users.primaryArchetype,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function getFlashUserInterestSignal(userId: string, executor: DbExecutor = db) {
  const [row] = await executor
    .select({ interestSelections: userInterests.selections })
    .from(userInterests)
    .where(eq(userInterests.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function getFlashUserIndustrySignal(userId: string, executor: DbExecutor = db) {
  const [row] = await executor
    .select({
      industryCategory: users.industryCategory,
      industryCategoryLabel: users.industryCategoryLabel,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function expireUserFlashAssignments(userId: string, now: Date, executor: DbExecutor = db) {
  return executor.update(flashTaskAssignments).set({ status: "expired", updatedAt: now }).where(and(
    eq(flashTaskAssignments.userId, userId),
    inArray(flashTaskAssignments.status, ["accepted", "arrived"]),
    lte(flashTaskAssignments.expiresAt, now),
  ));
}

export async function expireAllFlashAssignments(now: Date, executor: DbExecutor = db) {
  const rows = await executor.update(flashTaskAssignments).set({
    status: "expired",
    updatedAt: now,
  }).where(and(
    inArray(flashTaskAssignments.status, ["accepted", "arrived"]),
    lte(flashTaskAssignments.expiresAt, now),
  )).returning({ id: flashTaskAssignments.id });
  return rows.length;
}

export async function purgeExpiredFlashPrivateReplies(now: Date, executor: DbExecutor = db) {
  const rows = await executor.update(flashTaskAssignments).set({
    privateReply: null,
    privateReplyDeleteAfter: null,
    updatedAt: now,
  }).where(and(
    isNotNull(flashTaskAssignments.privateReply),
    isNotNull(flashTaskAssignments.privateReplyDeleteAfter),
    lte(flashTaskAssignments.privateReplyDeleteAfter, now),
  )).returning({ id: flashTaskAssignments.id });
  return rows.length;
}

export async function listUserFlashAssignments(userId: string, now: Date, executor: DbExecutor = db) {
  await expireUserFlashAssignments(userId, now, executor);
  return executor
    .select({
      id: flashTaskAssignments.id,
      userId: flashTaskAssignments.userId,
      npcId: flashTaskAssignments.npcId,
      encounterId: flashTaskAssignments.encounterId,
      deliveryEncounterId: flashTaskAssignments.deliveryEncounterId,
      taskTemplateId: flashTaskAssignments.taskTemplateId,
      destinationId: flashTaskAssignments.destinationId,
      status: flashTaskAssignments.status,
      contentSnapshot: flashTaskAssignments.contentSnapshot,
      expiresAt: flashTaskAssignments.expiresAt,
      arrivedAt: flashTaskAssignments.arrivedAt,
      feedbackAnswers: flashTaskAssignments.feedbackAnswers,
      feedbackSubmittedAt: flashTaskAssignments.feedbackSubmittedAt,
      deliveredAt: flashTaskAssignments.deliveredAt,
      createdAt: flashTaskAssignments.createdAt,
      npcSlug: flashNpcs.slug,
      npcName: flashNpcs.name,
      npcAvatarUrl: flashNpcs.avatarUrl,
    })
    .from(flashTaskAssignments)
    .innerJoin(flashNpcs, eq(flashTaskAssignments.npcId, flashNpcs.id))
    .where(and(
      eq(flashTaskAssignments.userId, userId),
      inArray(flashTaskAssignments.status, [...ACTIVE_ASSIGNMENT_STATUSES]),
    ))
    .orderBy(asc(flashTaskAssignments.expiresAt));
}

export async function getFlashAssignmentOwned(assignmentId: string, userId: string, now: Date, executor: DbExecutor = db) {
  await expireUserFlashAssignments(userId, now, executor);
  const [row] = await executor
    .select({
      id: flashTaskAssignments.id,
      userId: flashTaskAssignments.userId,
      npcId: flashTaskAssignments.npcId,
      encounterId: flashTaskAssignments.encounterId,
      deliveryEncounterId: flashTaskAssignments.deliveryEncounterId,
      taskTemplateId: flashTaskAssignments.taskTemplateId,
      destinationId: flashTaskAssignments.destinationId,
      status: flashTaskAssignments.status,
      contentSnapshot: flashTaskAssignments.contentSnapshot,
      expiresAt: flashTaskAssignments.expiresAt,
      arrivedAt: flashTaskAssignments.arrivedAt,
      feedbackAnswers: flashTaskAssignments.feedbackAnswers,
      feedbackSubmittedAt: flashTaskAssignments.feedbackSubmittedAt,
      deliveredAt: flashTaskAssignments.deliveredAt,
      createdAt: flashTaskAssignments.createdAt,
      npcSlug: flashNpcs.slug,
      npcName: flashNpcs.name,
      npcAvatarUrl: flashNpcs.avatarUrl,
    })
    .from(flashTaskAssignments)
    .innerJoin(flashNpcs, eq(flashTaskAssignments.npcId, flashNpcs.id))
    .where(and(eq(flashTaskAssignments.id, assignmentId), eq(flashTaskAssignments.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getPendingFlashDelivery(
  userId: string,
  npcId: string,
  npcSlug?: string,
  executor: DbExecutor = db,
  sourceEncounterIdForTesting?: string,
) {
  const rows = await executor
    .select({
      id: flashTaskAssignments.id,
      contentSnapshot: flashTaskAssignments.contentSnapshot,
      feedbackAnswers: flashTaskAssignments.feedbackAnswers,
      encounterId: flashTaskAssignments.encounterId,
    })
    .from(flashTaskAssignments)
    .where(and(
      eq(flashTaskAssignments.userId, userId),
      inArray(flashTaskAssignments.status, ["accepted", "ready_to_deliver"]),
    ))
    .orderBy(asc(flashTaskAssignments.createdAt))
    .limit(10);
  const row = rows.find((candidate: any) =>
    sourceEncounterIdForTesting && candidate.encounterId === sourceEncounterIdForTesting
  ) ?? rows.find((candidate: any) => {
    const snapshot = candidate.contentSnapshot as FlashTaskSnapshot;
    if (snapshot.invitationType !== "life_invitation" && snapshot.invitationType !== "npc_message") {
      return false;
    }
    return snapshot.invitationType === "npc_message"
      ? resolveFlashNpcMessageCheckpoint({
        sourceNpcSlug: snapshot.npcSlug,
        targetNpcSlug: snapshot.followUpTargetNpcSlug,
        currentNpcSlug: npcSlug,
        targetOutcome: candidate.feedbackAnswers?.[0]?.optionId,
      }) !== null
      : snapshot.npcSlug ? snapshot.npcSlug === npcSlug : false;
  }) ?? rows.find((candidate: any) => {
    const snapshot = candidate.contentSnapshot as FlashTaskSnapshot;
    return candidate.feedbackAnswers?.length
      && !snapshot.invitationType
      && snapshot.npcSlug === npcSlug;
  });
  if (!row) return null;
  const assignment = await getFlashAssignmentOwned(row.id, userId, new Date(), executor);
  if (!assignment) return null;
  const snapshot = assignment.contentSnapshot as FlashTaskSnapshot;
  if (snapshot.invitationType !== "npc_message") return assignment;
  const targetOutcome = assignment.feedbackAnswers?.[0]?.optionId;
  const prompt = !targetOutcome
    ? FLASH_NPC_MESSAGE_TARGET_PROMPT
    : targetOutcome === "relay_message"
      ? FLASH_NPC_MESSAGE_SOURCE_DELIVERED_PROMPT
      : FLASH_NPC_MESSAGE_SOURCE_SKIPPED_PROMPT;
  return {
    ...assignment,
    contentSnapshot: {
      ...snapshot,
      feedbackPrompts: [{
        id: prompt.id,
        prompt: prompt.prompt,
        options: prompt.options.map((option) => ({ ...option })),
      }],
    },
  };
}

export type AcceptFlashAssignmentResult =
  | { ok: true; assignmentId: string }
  | { ok: false; reason: "encounter_state" | "offer_unavailable" | "task_limit" | "npc_limit" };

export async function acceptFlashAssignment(input: {
  userId: string;
  encounterId: string;
  now: Date;
}): Promise<AcceptFlashAssignmentResult> {
  return db.transaction(async (tx: DbExecutor) => {
    await tx.execute(sql`select id from ${users} where id = ${input.userId} for update`);
    await expireUserFlashAssignments(input.userId, input.now, tx);

    const [candidateEncounter] = await tx.select({
      id: flashEncounters.id,
      status: flashEncounters.status,
      npcId: flashEncounters.npcId,
      taskTemplateId: flashEncounters.offeredTaskTemplateId,
      destinationId: flashEncounters.offeredDestinationId,
      expiresAt: flashEncounters.expiresAt,
    }).from(flashEncounters).where(and(
      eq(flashEncounters.id, input.encounterId),
      eq(flashEncounters.userId, input.userId),
    )).limit(1);

    if (
      !candidateEncounter
      || candidateEncounter.status !== "offered"
      || !candidateEncounter.taskTemplateId
      || candidateEncounter.expiresAt <= input.now
    ) {
      return { ok: false as const, reason: "encounter_state" as const };
    }

    const offer = candidateEncounter.destinationId
      ? await lockEligibleFlashTaskOfferForAcceptance({
        npcId: candidateEncounter.npcId,
        taskTemplateId: candidateEncounter.taskTemplateId,
        destinationId: candidateEncounter.destinationId,
      }, tx)
      : await lockEligibleDestinationFreeFlashOfferForAcceptance({
        npcId: candidateEncounter.npcId,
        taskTemplateId: candidateEncounter.taskTemplateId,
      }, tx);
    if (!offer) {
      const healed = await declineUnavailableFlashEncounterOffer({
        encounterId: input.encounterId,
        userId: input.userId,
        taskTemplateId: candidateEncounter.taskTemplateId,
        destinationId: candidateEncounter.destinationId,
        now: input.now,
      }, tx);
      return {
        ok: false as const,
        reason: healed ? "offer_unavailable" as const : "encounter_state" as const,
      };
    }

    // Lock the encounter after the offer-authority rows. Admin edits update the
    // template/destination before retracting offers, so this shared order avoids
    // deadlocks and makes the following state check authoritative.
    const [encounter] = await tx.select({
      id: flashEncounters.id,
      status: flashEncounters.status,
      npcId: flashEncounters.npcId,
      taskTemplateId: flashEncounters.offeredTaskTemplateId,
      destinationId: flashEncounters.offeredDestinationId,
      expiresAt: flashEncounters.expiresAt,
      npcName: flashNpcs.name,
      npcSlug: flashNpcs.slug,
    }).from(flashEncounters)
      .innerJoin(flashNpcs, eq(flashEncounters.npcId, flashNpcs.id))
      .where(and(
        eq(flashEncounters.id, input.encounterId),
        eq(flashEncounters.userId, input.userId),
      ))
      .for("update", { of: flashEncounters })
      .limit(1);

    if (
      !encounter
      || encounter.status !== "offered"
      || encounter.npcId !== candidateEncounter.npcId
      || encounter.taskTemplateId !== offer.taskTemplateId
      || encounter.destinationId !== offer.destinationId
      || encounter.expiresAt <= input.now
    ) {
      return { ok: false as const, reason: "encounter_state" as const };
    }

    const [counts] = await tx.select({
      total: sql<number>`count(*)::int`,
      sameNpc: sql<number>`count(*) filter (where ${flashTaskAssignments.npcId} = ${encounter.npcId})::int`,
    }).from(flashTaskAssignments).where(and(
      eq(flashTaskAssignments.userId, input.userId),
      inArray(flashTaskAssignments.status, [...ACTIVE_ASSIGNMENT_STATUSES]),
    ));
    if (Number(counts?.total ?? 0) >= 3) return { ok: false as const, reason: "task_limit" as const };
    if (Number(counts?.sameNpc ?? 0) >= 1) return { ok: false as const, reason: "npc_limit" as const };

    const invitation = getFlashInvitationDefinition(offer.code);
    const snapshot: FlashTaskSnapshot = {
      templateVersion: offer.contentVersion,
      code: offer.code,
      category: offer.category,
      title: offer.title,
      brief: offer.brief,
      instructions: offer.instructions,
      dialogueIntro: offer.requestCopy,
      deliveryCopy: offer.deliveryCopy,
      feedbackPrompts: offer.feedbackPrompts,
      npcName: encounter.npcName,
      npcSlug: encounter.npcSlug,
      invitationType: invitation?.kind,
      followUpTargetNpcSlug: invitation?.targetNpcSlug,
      followUpTargetNpcName: invitation?.targetNpcName,
      messageCopy: invitation?.messageCopy,
      destination: offer.destinationId ? {
        name: offer.destinationName!,
        city: "深圳",
        district: offer.destinationDistrict!,
        address: offer.destinationAddress!,
        latitude: offer.destinationLatitude!,
        longitude: offer.destinationLongitude!,
        coordinateSystem: "gcj02",
      } : null,
    };

    const [assignment] = await tx.insert(flashTaskAssignments).values({
      userId: input.userId,
      npcId: encounter.npcId,
      encounterId: input.encounterId,
      taskTemplateId: offer.taskTemplateId,
      destinationId: offer.destinationId,
      status: "accepted",
      contentSnapshot: snapshot,
      expiresAt: new Date(input.now.getTime() + offer.durationDays * 24 * 60 * 60 * 1000),
      feedbackSubmittedAt: null,
    }).returning({ id: flashTaskAssignments.id });

    const [acceptedEncounter] = await tx.update(flashEncounters).set({
      status: "accepted",
      completedAt: input.now,
      updatedAt: input.now,
    }).where(and(
      eq(flashEncounters.id, input.encounterId),
      eq(flashEncounters.userId, input.userId),
      eq(flashEncounters.status, "offered"),
      eq(flashEncounters.offeredTaskTemplateId, offer.taskTemplateId),
      offer.destinationId === null
        ? isNull(flashEncounters.offeredDestinationId)
        : eq(flashEncounters.offeredDestinationId, offer.destinationId),
    )).returning({ id: flashEncounters.id });
    if (!acceptedEncounter) throw new Error("FLASH_ACCEPTANCE_STATE_CHANGED");
    return { ok: true as const, assignmentId: assignment.id };
  });
}

export async function markFlashAssignmentArrived(assignmentId: string, userId: string, now: Date) {
  const [row] = await db.update(flashTaskAssignments).set({
    status: "arrived",
    arrivedAt: now,
    updatedAt: now,
  }).where(and(
    eq(flashTaskAssignments.id, assignmentId),
    eq(flashTaskAssignments.userId, userId),
    eq(flashTaskAssignments.status, "accepted"),
    gt(flashTaskAssignments.expiresAt, now),
  )).returning({ id: flashTaskAssignments.id });
  return row ?? null;
}

export async function submitFlashAssignmentFeedback(input: {
  assignmentId: string;
  userId: string;
  answers: Array<{ promptId: string; optionId: string }>;
  privateReply?: string;
  privateReplyDeleteAfter: Date | null;
  now: Date;
}) {
  const privateReply = input.privateReply?.trim() || null;
  if (privateReply && !input.privateReplyDeleteAfter) {
    throw new Error("FLASH_PRIVATE_REPLY_DEADLINE_REQUIRED");
  }
  const [row] = await db.update(flashTaskAssignments).set({
    status: "ready_to_deliver",
    feedbackAnswers: input.answers,
    privateReply,
    // Ready-to-deliver can persist indefinitely, so private text receives an
    // absolute deadline at submission instead of waiting forever for delivery.
    privateReplyDeleteAfter: privateReply ? input.privateReplyDeleteAfter : null,
    feedbackSubmittedAt: input.now,
    updatedAt: input.now,
  }).where(and(
    eq(flashTaskAssignments.id, input.assignmentId),
    eq(flashTaskAssignments.userId, input.userId),
    eq(flashTaskAssignments.status, "arrived"),
  )).returning({ id: flashTaskAssignments.id });
  return row ?? null;
}

export async function deliverFlashAssignment(input: {
  assignmentId: string;
  encounterId: string;
  userId: string;
  npcId: string;
  npcSlug?: string;
  answers?: Array<{ promptId: string; optionId: string }>;
  deliveryEncounterUnlockedAt: Date;
  now: Date;
  privateReplyDeleteAfter: Date;
  allowSameEncounterForTesting?: boolean;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    const owned = await getFlashAssignmentOwned(input.assignmentId, input.userId, input.now, tx);
    const snapshot = owned?.contentSnapshot as FlashTaskSnapshot | undefined;
    const targetOutcome = owned?.feedbackAnswers?.[0]?.optionId;
    const isNpcMessage = snapshot?.invitationType === "npc_message";
    const atMessageTarget = isNpcMessage
      && !targetOutcome
      && snapshot.followUpTargetNpcSlug === input.npcSlug;
    const atMessageSource = isNpcMessage
      && Boolean(targetOutcome)
      && snapshot.npcSlug === input.npcSlug;
    const canDeliverHere = input.allowSameEncounterForTesting || (isNpcMessage
      ? atMessageTarget || atMessageSource
      : owned?.npcId === input.npcId);
    if (!owned || !canDeliverHere) return null;

    if (!input.allowSameEncounterForTesting && atMessageTarget) {
      const optionId = input.answers?.[0]?.optionId;
      if (
        input.answers?.length !== 1
        || input.answers[0]?.promptId !== FLASH_NPC_MESSAGE_TARGET_PROMPT.id
        || !FLASH_NPC_MESSAGE_TARGET_PROMPT.options.some((option) => option.id === optionId)
      ) return null;
      const [recorded] = await tx.update(flashTaskAssignments).set({
        feedbackAnswers: input.answers,
        feedbackSubmittedAt: input.now,
        updatedAt: input.now,
      }).where(and(
        eq(flashTaskAssignments.id, input.assignmentId),
        eq(flashTaskAssignments.userId, input.userId),
        inArray(flashTaskAssignments.status, ["accepted", "ready_to_deliver"]),
        ne(flashTaskAssignments.encounterId, input.encounterId),
        sql`coalesce(jsonb_array_length(${flashTaskAssignments.feedbackAnswers}), 0) = 0`,
      )).returning({ taskTemplateId: flashTaskAssignments.taskTemplateId });
      return recorded ? { ...recorded, outcome: "target_recorded" as const } : null;
    }

    if (!input.allowSameEncounterForTesting && atMessageSource && targetOutcome === "skip_message") {
      const optionId = input.answers?.[0]?.optionId;
      if (
        input.answers?.length !== 1
        || input.answers[0]?.promptId !== FLASH_NPC_MESSAGE_SOURCE_SKIPPED_PROMPT.id
      ) return null;
      if (optionId === "retry_later") {
        const [retried] = await tx.update(flashTaskAssignments).set({
          feedbackAnswers: [],
          feedbackSubmittedAt: null,
          updatedAt: input.now,
        }).where(and(
          eq(flashTaskAssignments.id, input.assignmentId),
          eq(flashTaskAssignments.userId, input.userId),
          inArray(flashTaskAssignments.status, ["accepted", "ready_to_deliver"]),
          ne(flashTaskAssignments.encounterId, input.encounterId),
        )).returning({ taskTemplateId: flashTaskAssignments.taskTemplateId });
        return retried ? { ...retried, outcome: "retry_later" as const } : null;
      }
      if (optionId === "abandon_relay") {
        const [abandoned] = await tx.update(flashTaskAssignments).set({
          status: "abandoned",
          abandonedAt: input.now,
          updatedAt: input.now,
        }).where(and(
          eq(flashTaskAssignments.id, input.assignmentId),
          eq(flashTaskAssignments.userId, input.userId),
          inArray(flashTaskAssignments.status, ["accepted", "ready_to_deliver"]),
        )).returning({ taskTemplateId: flashTaskAssignments.taskTemplateId });
        return abandoned ? { ...abandoned, outcome: "abandoned" as const } : null;
      }
      return null;
    }

    if (!input.allowSameEncounterForTesting && atMessageSource && (
      input.answers?.length !== 1
      || input.answers[0]?.promptId !== FLASH_NPC_MESSAGE_SOURCE_DELIVERED_PROMPT.id
      || input.answers[0]?.optionId !== "report_delivered"
    )) return null;

    const [assignment] = await tx.update(flashTaskAssignments).set({
      status: "delivered",
      deliveryEncounterId: input.encounterId,
      deliveredAt: input.now,
      feedbackAnswers: input.answers ?? owned.feedbackAnswers ?? [],
      feedbackSubmittedAt: owned.feedbackSubmittedAt ?? input.now,
      privateReplyDeleteAfter: sql`case
        when ${flashTaskAssignments.privateReply} is null then null
        when ${flashTaskAssignments.privateReplyDeleteAfter} is null then ${input.privateReplyDeleteAfter}
        else least(${flashTaskAssignments.privateReplyDeleteAfter}, ${input.privateReplyDeleteAfter})
      end`,
      updatedAt: input.now,
    }).where(and(
      eq(flashTaskAssignments.id, input.assignmentId),
      eq(flashTaskAssignments.userId, input.userId),
      inArray(flashTaskAssignments.status, ["accepted", "ready_to_deliver"]),
      input.allowSameEncounterForTesting
        ? undefined
        : ne(flashTaskAssignments.encounterId, input.encounterId),
      isNpcMessage && !input.allowSameEncounterForTesting
        ? and(
          isNotNull(flashTaskAssignments.feedbackSubmittedAt),
          lte(flashTaskAssignments.feedbackSubmittedAt, input.deliveryEncounterUnlockedAt),
        )
        : sql`true`,
    )).returning({ taskTemplateId: flashTaskAssignments.taskTemplateId });
    if (!assignment) return null;

    await tx.insert(flashNpcRelationships).values({
      userId: input.userId,
      npcId: input.npcId,
      completedCount: 1,
      lastDeliveredAt: input.now,
    }).onConflictDoUpdate({
      target: [flashNpcRelationships.userId, flashNpcRelationships.npcId],
      set: {
        completedCount: sql`${flashNpcRelationships.completedCount} + 1`,
        lastDeliveredAt: input.now,
        updatedAt: input.now,
      },
    });
    return { ...assignment, outcome: "delivered" as const };
  });
}

export async function abandonFlashAssignment(assignmentId: string, userId: string, now: Date) {
  const [row] = await db.update(flashTaskAssignments).set({
    status: "abandoned",
    abandonedAt: now,
    privateReply: null,
    privateReplyDeleteAfter: null,
    updatedAt: now,
  }).where(and(
    eq(flashTaskAssignments.id, assignmentId),
    eq(flashTaskAssignments.userId, userId),
    inArray(flashTaskAssignments.status, ["accepted", "arrived", "ready_to_deliver"]),
  )).returning({ id: flashTaskAssignments.id });
  return row ?? null;
}

export async function retryFlashAssignment(assignmentId: string, userId: string, now: Date) {
  const [row] = await db.update(flashTaskAssignments).set({
    status: "accepted",
    arrivedAt: null,
    feedbackAnswers: [],
    feedbackSubmittedAt: null,
    deliveryEncounterId: null,
    deliveredAt: null,
    abandonedAt: null,
    privateReply: null,
    privateReplyDeleteAfter: null,
    updatedAt: now,
  }).where(and(
    eq(flashTaskAssignments.id, assignmentId),
    eq(flashTaskAssignments.userId, userId),
    inArray(flashTaskAssignments.status, ["accepted", "arrived", "ready_to_deliver"]),
  )).returning({ id: flashTaskAssignments.id });
  return row ?? null;
}

export async function getFlashPreferences(userId: string, executor: DbExecutor = db) {
  const [preference] = await executor.select().from(flashUserPreferences)
    .where(eq(flashUserPreferences.userId, userId)).limit(1);
  const tags = await executor.select({
    id: flashUserTaskTags.id,
    source: flashUserTaskTags.source,
    tagKey: flashUserTaskTags.tagKey,
    label: flashUserTaskTags.label,
  }).from(flashUserTaskTags).where(and(
    eq(flashUserTaskTags.userId, userId),
    eq(flashUserTaskTags.isActive, true),
    isNull(flashUserTaskTags.deletedAt),
  )).orderBy(asc(flashUserTaskTags.source), asc(flashUserTaskTags.label));
  return { preference: preference ?? null, tags };
}

export async function updateFlashPreferences(input: {
  userId: string;
  personalizationEnabled: boolean;
  usePersonality: boolean;
  useInterests: boolean;
  useIndustry: boolean;
  useDistrict: boolean;
  useTaskBehavior: boolean;
  consentVersion?: string;
  deleteTagIds?: string[];
  now: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    await tx.insert(flashUserPreferences).values({
      userId: input.userId,
      personalizationEnabled: input.personalizationEnabled,
      usePersonality: input.usePersonality,
      useInterests: input.useInterests,
      useIndustry: input.useIndustry,
      useDistrict: input.useDistrict,
      useTaskBehavior: input.useTaskBehavior,
      consentVersion: input.personalizationEnabled
        ? (input.consentVersion ?? FLASH_PERSONALIZATION_CONSENT_VERSION)
        : null,
      consentedAt: input.personalizationEnabled ? input.now : null,
      updatedAt: input.now,
    }).onConflictDoUpdate({
      target: flashUserPreferences.userId,
      set: {
        personalizationEnabled: input.personalizationEnabled,
        usePersonality: input.usePersonality,
        useInterests: input.useInterests,
        useIndustry: input.useIndustry,
        useDistrict: input.useDistrict,
        useTaskBehavior: input.useTaskBehavior,
        consentVersion: input.personalizationEnabled
          ? sql`coalesce(${flashUserPreferences.consentVersion}, ${input.consentVersion ?? FLASH_PERSONALIZATION_CONSENT_VERSION})`
          : flashUserPreferences.consentVersion,
        consentedAt: input.personalizationEnabled
          ? sql`coalesce(${flashUserPreferences.consentedAt}, ${input.now})`
          : flashUserPreferences.consentedAt,
        updatedAt: input.now,
      },
    });
    if (input.deleteTagIds?.length) {
      await tx.update(flashUserTaskTags).set({
        isActive: false,
        deletedAt: input.now,
        updatedAt: input.now,
      }).where(and(
        eq(flashUserTaskTags.userId, input.userId),
        inArray(flashUserTaskTags.id, input.deleteTagIds),
      ));
    }
  });
}

export async function insertFlashUserTags(
  userId: string,
  tags: Array<{ source: "personality" | "interests" | "industry" | "district" | "task_behavior"; tagKey: string; label: string }>,
  executor: DbExecutor = db,
) {
  if (!tags.length) return;
  await executor.insert(flashUserTaskTags).values(tags.map((tag) => ({
    userId,
    ...tag,
    isActive: true,
  }))).onConflictDoNothing({
    target: [flashUserTaskTags.userId, flashUserTaskTags.source, flashUserTaskTags.tagKey],
  });
}

export async function deleteFlashUserTag(userId: string, tagId: string, now: Date, executor: DbExecutor = db) {
  const [row] = await executor.update(flashUserTaskTags).set({
    isActive: false,
    deletedAt: now,
    updatedAt: now,
  }).where(and(
    eq(flashUserTaskTags.id, tagId),
    eq(flashUserTaskTags.userId, userId),
  )).returning({ id: flashUserTaskTags.id });
  return row ?? null;
}

export async function getRecentDeliveredFlashCategories(userId: string, executor: DbExecutor = db) {
  const rows = await executor.select({ category: flashTaskTemplates.category })
    .from(flashTaskAssignments)
    .innerJoin(flashTaskTemplates, eq(flashTaskAssignments.taskTemplateId, flashTaskTemplates.id))
    .where(and(
      eq(flashTaskAssignments.userId, userId),
      eq(flashTaskAssignments.status, "delivered"),
    ))
    .orderBy(desc(flashTaskAssignments.deliveredAt))
    .limit(20);
  return rows.map((row: any) => row.category);
}

export async function listFlashSchedulingInputs(executor: DbExecutor = db) {
  const npcs = await executor.select().from(flashNpcs)
    .where(eq(flashNpcs.isActive, true))
    .orderBy(asc(flashNpcs.sortOrder));
  const links = await executor
    .select({
      npcId: flashNpcLocationLinks.npcId,
      locationId: flashEncounterLocations.id,
      locationName: flashEncounterLocations.name,
      district: flashEncounterLocations.district,
      availabilityWindows: flashEncounterLocations.availabilityWindows,
      weight: flashNpcLocationLinks.weight,
    })
    .from(flashNpcLocationLinks)
    .innerJoin(flashEncounterLocations, eq(flashNpcLocationLinks.locationId, flashEncounterLocations.id))
    .where(and(
      eq(flashNpcLocationLinks.isActive, true),
      eq(flashEncounterLocations.city, "深圳"),
      eq(flashEncounterLocations.isActive, true),
      eq(flashEncounterLocations.approvalStatus, "approved"),
    ));
  return { npcs, links };
}

export async function getFlashSchedulePlanByDate(serviceDate: string, executor: DbExecutor = db) {
  const [plan] = await executor.select().from(flashSchedulePlans)
    .where(and(eq(flashSchedulePlans.serviceDate, serviceDate), eq(flashSchedulePlans.city, "深圳")))
    .limit(1);
  if (!plan) return null;
  const shifts = await executor.select().from(flashShifts)
    .where(eq(flashShifts.planId, plan.id)).orderBy(asc(flashShifts.startsAt));
  return { plan, shifts };
}

export async function getFlashSchedulePlanById(planId: string, executor: DbExecutor = db) {
  const [plan] = await executor.select().from(flashSchedulePlans)
    .where(eq(flashSchedulePlans.id, planId)).limit(1);
  if (!plan) return null;
  const shifts = await executor.select().from(flashShifts)
    .where(eq(flashShifts.planId, plan.id)).orderBy(asc(flashShifts.startsAt));
  return { plan, shifts };
}

type CreateFlashScheduleDraftInput = {
  serviceDate: string;
  generationSeed: string;
  autoPublishAfter: Date;
  source: "generated" | "fallback" | "manual";
  actor?: string;
  shifts: Array<{ npcId: string; locationId: string; startsAt: Date; endsAt: Date; source: "generated" | "fallback" | "manual" }>;
};

async function createFlashScheduleDraftWithExecutor(
  input: CreateFlashScheduleDraftInput,
  executor: DbExecutor,
) {
  const [plan] = await executor.insert(flashSchedulePlans).values({
    serviceDate: input.serviceDate,
    city: "深圳",
    status: "draft",
    source: input.source,
    generationSeed: input.generationSeed,
    autoPublishAfter: input.autoPublishAfter,
    createdBy: input.actor ?? null,
    updatedBy: input.actor ?? null,
  }).onConflictDoNothing({
    target: [flashSchedulePlans.serviceDate, flashSchedulePlans.city],
  }).returning();
  if (!plan) return getFlashSchedulePlanByDate(input.serviceDate, executor);
  if (input.shifts.length > 0) {
    await executor.insert(flashShifts).values(input.shifts.map((shift) => ({
      ...shift,
      planId: plan.id,
      status: "draft",
    })));
  }
  return { plan, shifts: input.shifts };
}

export async function createFlashScheduleDraft(
  input: CreateFlashScheduleDraftInput,
  executor?: DbExecutor,
) {
  if (executor) return createFlashScheduleDraftWithExecutor(input, executor);
  return db.transaction((tx: DbExecutor) => createFlashScheduleDraftWithExecutor(input, tx));
}

export async function replaceFlashScheduleShifts(input: {
  planId: string;
  expectedVersion: number;
  updatedBy: string;
  shifts: Array<{ npcId: string; locationId: string; startsAt: Date; endsAt: Date; source?: "generated" | "fallback" | "manual" }>;
  now: Date;
  generationSeed?: string;
  source?: "generated" | "fallback" | "manual";
  autoPublishAfter?: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    const [plan] = await tx.update(flashSchedulePlans).set({
      version: sql`${flashSchedulePlans.version} + 1`,
      updatedBy: input.updatedBy,
      updatedAt: input.now,
      ...(input.generationSeed ? { generationSeed: input.generationSeed } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.autoPublishAfter ? { autoPublishAfter: input.autoPublishAfter } : {}),
    }).where(and(
      eq(flashSchedulePlans.id, input.planId),
      eq(flashSchedulePlans.version, input.expectedVersion),
      eq(flashSchedulePlans.status, "draft"),
    )).returning();
    if (!plan) return null;
    await tx.delete(flashShifts).where(eq(flashShifts.planId, input.planId));
    if (input.shifts.length) {
      await tx.insert(flashShifts).values(input.shifts.map((shift) => ({
        planId: input.planId,
        npcId: shift.npcId,
        locationId: shift.locationId,
        startsAt: shift.startsAt,
        endsAt: shift.endsAt,
        status: "draft",
        source: shift.source ?? "manual",
      })));
    }
    return plan;
  });
}

export async function replacePublishedFlashSchedule(input: {
  planId: string;
  expectedVersion: number;
  updatedBy: string;
  shifts: Array<{ npcId: string; locationId: string; startsAt: Date; endsAt: Date; source?: "generated" | "fallback" | "manual" }>;
  now: Date;
  generationSeed: string;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    const [plan] = await tx.update(flashSchedulePlans).set({
      version: sql`${flashSchedulePlans.version} + 1`,
      updatedBy: input.updatedBy,
      updatedAt: input.now,
      generatedAt: input.now,
      generationSeed: input.generationSeed,
      source: "generated",
    }).where(and(
      eq(flashSchedulePlans.id, input.planId),
      eq(flashSchedulePlans.version, input.expectedVersion),
      eq(flashSchedulePlans.status, "published"),
    )).returning();
    if (!plan) return null;

    await tx.update(flashShifts).set({
      status: "cancelled",
      version: sql`${flashShifts.version} + 1`,
      updatedAt: input.now,
    }).where(and(
      eq(flashShifts.planId, input.planId),
      eq(flashShifts.status, "published"),
    ));

    const shifts = await tx.insert(flashShifts).values(input.shifts.map((shift) => ({
      planId: input.planId,
      npcId: shift.npcId,
      locationId: shift.locationId,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      status: "published",
      source: shift.source ?? "generated",
    }))).returning();
    return { plan, shifts };
  });
}

export async function updateUpcomingFlashShift(input: {
  planId: string;
  shiftId: string;
  expectedVersion: number;
  updatedBy: string;
  now: Date;
  cancel?: boolean;
  shift?: { npcId: string; locationId: string; startsAt: Date; endsAt: Date; source?: "generated" | "fallback" | "manual" };
}) {
  return db.transaction(async (tx: DbExecutor) => {
    const [plan] = await tx.update(flashSchedulePlans).set({
      version: sql`${flashSchedulePlans.version} + 1`,
      updatedBy: input.updatedBy,
      updatedAt: input.now,
      source: "manual",
    }).where(and(
      eq(flashSchedulePlans.id, input.planId),
      eq(flashSchedulePlans.version, input.expectedVersion),
      inArray(flashSchedulePlans.status, ["draft", "published"]),
    )).returning();
    if (!plan) return null;

    const values = input.cancel
      ? { status: "cancelled" as const, version: sql`${flashShifts.version} + 1`, updatedAt: input.now }
      : {
          npcId: input.shift!.npcId,
          locationId: input.shift!.locationId,
          startsAt: input.shift!.startsAt,
          endsAt: input.shift!.endsAt,
          source: input.shift!.source ?? "manual",
          version: sql`${flashShifts.version} + 1`,
          updatedAt: input.now,
        };
    const [shift] = await tx.update(flashShifts).set(values).where(and(
      eq(flashShifts.id, input.shiftId),
      eq(flashShifts.planId, input.planId),
      eq(flashShifts.status, plan.status),
      gt(flashShifts.startsAt, input.now),
    )).returning();
    if (!shift) throw new Error("FLASH_UPCOMING_SHIFT_CONFLICT");
    return { plan, shift };
  });
}

type PublishFlashSchedulePlanInput = {
  planId: string;
  expectedVersion: number;
  now: Date;
  actor?: string;
};

async function publishFlashSchedulePlanWithExecutor(
  input: PublishFlashSchedulePlanInput,
  executor: DbExecutor,
) {
  const [plan] = await executor.update(flashSchedulePlans).set({
    status: "published",
    publishedAt: input.now,
    updatedBy: input.actor ?? null,
    version: sql`${flashSchedulePlans.version} + 1`,
    updatedAt: input.now,
  }).where(and(
    eq(flashSchedulePlans.id, input.planId),
    eq(flashSchedulePlans.version, input.expectedVersion),
    eq(flashSchedulePlans.status, "draft"),
  )).returning();
  if (!plan) return null;
  await executor.update(flashShifts).set({
    status: "published",
    version: sql`${flashShifts.version} + 1`,
    updatedAt: input.now,
  }).where(and(eq(flashShifts.planId, input.planId), ne(flashShifts.status, "cancelled")));
  return plan;
}

export async function publishFlashSchedulePlan(
  input: PublishFlashSchedulePlanInput,
  executor?: DbExecutor,
) {
  if (executor) return publishFlashSchedulePlanWithExecutor(input, executor);
  return db.transaction((tx: DbExecutor) => publishFlashSchedulePlanWithExecutor(input, tx));
}

export async function listRecentPublishedFlashPlans(limit = 14, executor: DbExecutor = db) {
  const plans = await executor.select().from(flashSchedulePlans)
    .where(and(eq(flashSchedulePlans.city, "深圳"), eq(flashSchedulePlans.status, "published")))
    .orderBy(desc(flashSchedulePlans.serviceDate)).limit(limit);
  const results = [];
  for (const plan of plans) {
    const shifts = await executor.select().from(flashShifts)
      .where(and(eq(flashShifts.planId, plan.id), eq(flashShifts.status, "published")))
      .orderBy(asc(flashShifts.startsAt));
    results.push({ plan, shifts });
  }
  return results;
}

export async function runWithFlashScheduleAdvisoryLock<T>(work: (executor: DbExecutor) => Promise<T>): Promise<T | null> {
  return db.transaction(async (tx: DbExecutor) => {
    const result = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext('joyjoin_flash_schedule_worker')) as locked`);
    const locked = Boolean((result as any)?.rows?.[0]?.locked ?? (result as any)?.[0]?.locked);
    if (!locked) return null;
    return work(tx);
  });
}
