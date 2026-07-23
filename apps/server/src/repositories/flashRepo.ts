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
  FLASH_NPC_SEEDS,
  FLASH_TASK_SEEDS,
} from "@shared/alang/flashCatalog";
import { FLASH_PERSONALIZATION_CONSENT_VERSION } from "@shared/alang/flashTypes";

import { db } from "../db";
import { countCanonicalFlashNpcWeekdayMatches } from "../lib/flashNpcPolicy";

type DbExecutor = typeof db | any;

const ACTIVE_ASSIGNMENT_STATUSES = ["accepted", "arrived", "ready_to_deliver"] as const;
export const FLASH_REPEAT_DECAY_STATUSES = ["delivered"] as const;
const CANONICAL_FLASH_NPC_SLUGS = FLASH_NPC_SEEDS.map((npc) => npc.slug);
const CANONICAL_FLASH_TASK_CATEGORIES = [...new Set(FLASH_TASK_SEEDS.map((task) => task.category))];

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
    .where(and(
      eq(flashNpcs.isActive, true),
      inArray(flashNpcs.slug, CANONICAL_FLASH_NPC_SLUGS),
    ));

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
    .innerJoin(
      flashTaskDestinationLinks,
      and(
        eq(flashTaskDestinationLinks.taskTemplateId, flashTaskTemplates.id),
        eq(flashTaskDestinationLinks.isActive, true),
      ),
    )
    .innerJoin(
      flashTaskDestinations,
      and(
        eq(flashTaskDestinationLinks.destinationId, flashTaskDestinations.id),
        eq(flashTaskDestinations.approvalStatus, "approved"),
        eq(flashTaskDestinations.isActive, true),
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
    .innerJoin(
      flashTaskDestinationLinks,
      and(
        eq(flashTaskDestinationLinks.taskTemplateId, flashTaskTemplates.id),
        eq(flashTaskDestinationLinks.isActive, true),
      ),
    )
    .innerJoin(
      flashTaskDestinations,
      and(
        eq(flashTaskDestinationLinks.destinationId, flashTaskDestinations.id),
        eq(flashTaskDestinations.approvalStatus, "approved"),
        eq(flashTaskDestinations.isActive, true),
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
    .innerJoin(
      flashTaskDestinationLinks,
      and(
        eq(flashTaskDestinationLinks.taskTemplateId, flashTaskTemplates.id),
        eq(flashTaskDestinationLinks.isActive, true),
      ),
    )
    .innerJoin(
      flashTaskDestinations,
      and(
        eq(flashTaskDestinationLinks.destinationId, flashTaskDestinations.id),
        eq(flashTaskDestinations.approvalStatus, "approved"),
        eq(flashTaskDestinations.isActive, true),
      ),
    )
    .where(and(
      eq(flashNpcs.isActive, true),
      inArray(flashNpcs.slug, CANONICAL_FLASH_NPC_SLUGS),
    ));

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
    const npcBySlug = new Map(npcRows.map((row: any) => [row.slug, row.id]));
    const taskByCode = new Map(taskRows.map((row: any) => [row.code, row.id]));

    for (const task of FLASH_TASK_SEEDS) {
      const taskTemplateId = taskByCode.get(task.code);
      if (!taskTemplateId) continue;
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
            updatedAt: new Date(),
          },
        });
      }
    }

    return {
      npcCount: npcRows.filter((row: any) => FLASH_NPC_SEEDS.some((seed) => seed.slug === row.slug)).length,
      taskCount: taskRows.filter((row: any) => FLASH_TASK_SEEDS.some((seed) => seed.code === row.code)).length,
      note: "Encounter locations, task destinations and destination links must be approved by operators before readiness passes.",
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
      .where(inArray(flashTaskTemplates.code, FLASH_TASK_SEEDS.map((task) => task.code)));
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

    retur…8544 tokens truncated…tus !== "offered"
      || !candidateEncounter.taskTemplateId
      || !candidateEncounter.destinationId
      || candidateEncounter.expiresAt <= input.now
    ) {
      return { ok: false as const, reason: "encounter_state" as const };
    }

    const offer = await lockEligibleFlashTaskOfferForAcceptance({
      npcId: candidateEncounter.npcId,
      taskTemplateId: candidateEncounter.taskTemplateId,
      destinationId: candidateEncounter.destinationId,
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
      destination: {
        name: offer.destinationName,
        city: "深圳",
        district: offer.destinationDistrict,
        address: offer.destinationAddress,
        latitude: offer.destinationLatitude,
        longitude: offer.destinationLongitude,
        coordinateSystem: "gcj02",
      },
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
      eq(flashEncounters.offeredDestinationId, offer.destinationId),
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
  deliveryEncounterUnlockedAt: Date;
  now: Date;
  privateReplyDeleteAfter: Date;
}) {
  return db.transaction(async (tx: DbExecutor) => {
    const [assignment] = await tx.update(flashTaskAssignments).set({
      status: "delivered",
      deliveryEncounterId: input.encounterId,
      deliveredAt: input.now,
      privateReplyDeleteAfter: sql`case
        when ${flashTaskAssignments.privateReply} is null then null
        when ${flashTaskAssignments.privateReplyDeleteAfter} is null then ${input.privateReplyDeleteAfter}
        else least(${flashTaskAssignments.privateReplyDeleteAfter}, ${input.privateReplyDeleteAfter})
      end`,
      updatedAt: input.now,
    }).where(and(
      eq(flashTaskAssignments.id, input.assignmentId),
      eq(flashTaskAssignments.userId, input.userId),
      eq(flashTaskAssignments.npcId, input.npcId),
      eq(flashTaskAssignments.status, "ready_to_deliver"),
      ne(flashTaskAssignments.encounterId, input.encounterId),
      isNotNull(flashTaskAssignments.feedbackSubmittedAt),
      lte(flashTaskAssignments.feedbackSubmittedAt, input.deliveryEncounterUnlockedAt),
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
    return assignment;
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

