import { describe, expect, it, vi } from "vitest";
import {
  buildFlashNpcTaskRequestCopy,
  FLASH_LOCATION_SEEDS,
  FLASH_NPC_SEEDS,
  FLASH_TASK_CATEGORIES,
  FLASH_TASK_SEEDS,
  getFlashTaskSeedByCode,
  resolveFlashDeliveryCopy,
} from "@shared/alang/flashCatalog";
import {
  FLASH_INVITATION_DEFINITIONS,
  isDestinationFreeFlashInvitation,
} from "@shared/alang/flashInvitationCatalog";
import {
  FLASH_ARRIVAL_RADIUS_METERS,
  FLASH_ENCOUNTER_ARRIVAL_RADIUS_METERS,
  FLASH_PERSONALIZATION_CONSENT_VERSION,
  flashCoordinateSchema,
  flashPreferenceUpdateSchema,
} from "@shared/alang/flashTypes";

import {
  FLASH_REPEAT_DECAY_STATUSES,
  isFlashSchemaReady,
  resolveFlashNpcMessageCheckpoint,
} from "../repositories/flashRepo";
import {
  createSeededRandom,
  generateFlashScheduleDraft,
  isoWeekdayForServiceDate,
  validateFlashScheduleDraft,
} from "../services/flashScheduleService";
import {
  calculateFlashCandidateWeight,
  evaluateFlashFeatureReadiness,
  isLaterFlashDeliveryEncounter,
  syncEnabledPreferenceTags,
} from "../services/flashService";

describe("Flash geofence boundaries", () => {
  it("keeps the NPC encounter radius independent from task-destination arrival", () => {
    expect(FLASH_ENCOUNTER_ARRIVAL_RADIUS_METERS).toBe(100);
    expect(FLASH_ARRIVAL_RADIUS_METERS).toBe(50);
  });
});

const readyTaskCategoryCounts = Object.fromEntries(
  [...new Set(FLASH_TASK_SEEDS.map((task) => task.category))].map((category) => [category, 5]),
);
const readyRuntime = { tencentMapConfigured: true };

function npc(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "alang",
    name: "阿浪",
    species: "灰狼",
    personalitySummary: "test",
    inviteLine: "test",
    voiceGuide: [],
    dialogueQuestions: [],
    eligibleWeekdays: [1],
    oneShiftProbability: 35,
    twoShiftProbability: 65,
    minShiftMinutes: 90,
    maxShiftMinutes: 150,
    minGapMinutes: 90,
    themeColor: "#64748B",
    avatarUrl: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

function location() {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    name: "审核地点",
    district: "南山区",
    availabilityWindows: [{ weekday: 1, startTime: "09:00", endTime: "21:00" }],
    weight: 100,
  } as any;
}

describe("formal Flash catalog", () => {
  it("contains five distinct NPCs and six categories of five reviewed drafts", () => {
    expect(FLASH_NPC_SEEDS).toHaveLength(5);
    expect(new Set(FLASH_NPC_SEEDS.map((item) => item.slug)).size).toBe(5);
    expect(FLASH_TASK_SEEDS).toHaveLength(30);
    expect(new Set(FLASH_TASK_SEEDS.map((item) => item.code)).size).toBe(30);
    const counts = new Map<string, number>();
    for (const task of FLASH_TASK_SEEDS) counts.set(task.category, (counts.get(task.category) ?? 0) + 1);
    expect([...counts.values()].sort()).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it("uses self-reported life invitations and NPC messages without proof requirements", () => {
    expect(FLASH_INVITATION_DEFINITIONS).toHaveLength(30);
    expect(FLASH_INVITATION_DEFINITIONS.filter((item) => item.kind === "life_invitation")).toHaveLength(25);
    expect(FLASH_INVITATION_DEFINITIONS.filter((item) => item.kind === "npc_message")).toHaveLength(5);
    expect(FLASH_INVITATION_DEFINITIONS
      .filter((item) => item.kind === "life_invitation")
      .every((item) => !item.targetNpcSlug && !item.messageCopy)).toBe(true);
    expect(FLASH_INVITATION_DEFINITIONS
      .filter((item) => item.kind === "npc_message")
      .every((item) => item.targetNpcSlug && item.messageCopy)).toBe(true);
  });

  it("treats every current invitation as destination-free even with normalized code or tag-only data", () => {
    expect(FLASH_INVITATION_DEFINITIONS.every((task) => (
      isDestinationFreeFlashInvitation({ code: task.code, tags: task.tags })
    ))).toBe(true);
    expect(isDestinationFreeFlashInvitation({ code: " t16 " })).toBe(true);
    expect(isDestinationFreeFlashInvitation({ code: "custom", tags: ["invitation:life"] })).toBe(true);
    expect(isDestinationFreeFlashInvitation({ code: "legacy-gps", tags: ["destination"] })).toBe(false);
  });

  it("gives every NPC a distinct five-invitation life pool plus its own message", () => {
    const lifeInvitations = FLASH_INVITATION_DEFINITIONS.filter((item) => item.kind === "life_invitation");
    const pools = FLASH_NPC_SEEDS.map((npc) => lifeInvitations
      .filter((item) => item.npcSlugs.includes(npc.slug))
      .map((item) => item.code)
      .sort());

    expect(pools.every((pool) => pool.length === 5)).toBe(true);
    expect(new Set(pools.map((pool) => pool.join(","))).size).toBe(5);
    expect(lifeInvitations.every((item) => item.npcSlugs.length === 1)).toBe(true);
    for (const npc of FLASH_NPC_SEEDS) {
      expect(FLASH_INVITATION_DEFINITIONS.filter((item) => item.npcSlugs.includes(npc.slug))).toHaveLength(6);
    }
  });

  it("frames life invitations as something to begin now and preserves each NPC voice", () => {
    const lifeTasks = FLASH_TASK_SEEDS.filter((task) => task.tags.includes("invitation:life"));
    const copies = lifeTasks.map((task) => {
      const npcSlug = task.npcSlugs[0];
      return buildFlashNpcTaskRequestCopy(npcSlug, task);
    });

    expect(copies.every((copy) => !copy.includes("哪天想起来"))).toBe(true);
    expect(new Set(FLASH_NPC_SEEDS.map((npc) => {
      const task = lifeTasks.find((candidate) => candidate.npcSlugs.includes(npc.slug));
      return task ? buildFlashNpcTaskRequestCopy(npc.slug, task).split("：")[0] : "";
    })).size).toBe(5);
    expect(FLASH_TASK_SEEDS.find((task) => task.code === "T06")?.brief).toContain("现在");
    expect(FLASH_TASK_SEEDS.find((task) => task.code === "T10")?.brief).toContain("现在");
  });

  it("makes every life invitation actionable now and responds to the reported outcome", () => {
    const lifeTasks = FLASH_TASK_SEEDS.filter((task) => task.tags.includes("invitation:life"));
    expect(lifeTasks.every((task) => task.brief.includes("现在") || task.brief.includes("今天"))).toBe(true);

    const liziMovie = FLASH_TASK_SEEDS.find((task) => task.code === "T06");
    expect(liziMovie?.feedbackPrompts[0]?.options.map((option) => option.id)).toEqual([
      "liked",
      "continuing",
      "not_for_me",
      "switched",
      "not_started",
    ]);
    expect(resolveFlashDeliveryCopy({
      npcSlug: "lizi",
      taskCode: "T06",
      invitationKind: "life_invitation",
      optionId: "not_for_me",
    })).toContain("别对一部电影讲礼貌");
    expect(resolveFlashDeliveryCopy({
      npcSlug: "momo",
      taskCode: "T10",
      invitationKind: "life_invitation",
      optionId: "liked",
    })).toContain("没有过期");
    expect(resolveFlashDeliveryCopy({
      npcSlug: "shiqi",
      taskCode: "T16",
      invitationKind: "life_invitation",
      optionId: "started",
    })).toContain("零和一之间");
  });

  it("uses the two-stage NPC relay contract instead of self-reported delivery", () => {
    const relay = FLASH_TASK_SEEDS.find((task) => task.code === "T26");
    expect(relay?.feedbackPrompts[0]?.options).toEqual([
      { id: "relay_message", label: "帮它把话带到" },
      { id: "skip_message", label: "这次先不带" },
    ]);
    expect(resolveFlashNpcMessageCheckpoint({
      sourceNpcSlug: "alang",
      targetNpcSlug: "lizi",
      currentNpcSlug: "lizi",
    })).toBe("target");
    expect(resolveFlashNpcMessageCheckpoint({
      sourceNpcSlug: "alang",
      targetNpcSlug: "lizi",
      currentNpcSlug: "alang",
    })).toBeNull();
    expect(resolveFlashNpcMessageCheckpoint({
      sourceNpcSlug: "alang",
      targetNpcSlug: "lizi",
      currentNpcSlug: "alang",
      targetOutcome: "relay_message",
    })).toBe("source");
    expect(resolveFlashNpcMessageCheckpoint({
      sourceNpcSlug: "alang",
      targetNpcSlug: "lizi",
      currentNpcSlug: "lizi",
      targetOutcome: "skip_message",
    })).toBeNull();
    expect(resolveFlashDeliveryCopy({
      npcSlug: "lizi",
      taskCode: "T26",
      invitationKind: "npc_message",
      optionId: "relay_message",
    })).toContain("我没有在原地等过");
    expect(resolveFlashDeliveryCopy({
      npcSlug: "alang",
      taskCode: "T26",
      invitationKind: "npc_message",
      optionId: "report_delivered",
    })).toContain("没有回头");
    for (const code of ["T26", "T27", "T28", "T29", "T30"]) {
      for (const optionId of [
        "relay_message",
        "skip_message",
        "report_delivered",
        "retry_later",
        "abandon_relay",
      ]) {
        expect(resolveFlashDeliveryCopy({
          npcSlug: "alang",
          taskCode: code,
          invitationKind: "npc_message",
          optionId,
        })).not.toBe("好，我记住了。谢谢你愿意回来告诉我。");
      }
    }
  });

  it("contains two free public location candidates for every Shenzhen district", () => {
    expect(FLASH_LOCATION_SEEDS).toHaveLength(20);
    const counts = new Map<string, number>();
    for (const location of FLASH_LOCATION_SEEDS) {
      counts.set(location.district, (counts.get(location.district) ?? 0) + 1);
      expect(location.tags).toContain("免费");
      expect(location.latitude).toBeGreaterThanOrEqual(22.35);
      expect(location.latitude).toBeLessThanOrEqual(22.95);
      expect(location.longitude).toBeGreaterThanOrEqual(113.7);
      expect(location.longitude).toBeLessThanOrEqual(114.75);
      expect(location.safetyNotes.length).toBeGreaterThan(8);
    }
    expect([...counts.values()].sort()).toEqual(Array(10).fill(2));
  });

  it("accepts partial preference updates and rejects empty writes", () => {
    expect(flashPreferenceUpdateSchema.safeParse({ useInterests: true }).success).toBe(true);
    expect(flashPreferenceUpdateSchema.safeParse({ useTaskBehavior: false }).success).toBe(true);
    expect(flashPreferenceUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("requires the canonical consent version whenever personalization is enabled", () => {
    expect(flashPreferenceUpdateSchema.safeParse({ personalizationEnabled: true }).success).toBe(false);
    expect(flashPreferenceUpdateSchema.safeParse({
      personalizationEnabled: true,
      consentVersion: FLASH_PERSONALIZATION_CONSENT_VERSION,
    }).success).toBe(true);
    expect(flashPreferenceUpdateSchema.safeParse({ personalizationEnabled: false }).success).toBe(true);
  });

  it("keeps transport validation bounded before the server-owned Tencent Shenzhen check", () => {
    expect(flashCoordinateSchema.safeParse({
      latitude: 22.5431,
      longitude: 114.0579,
      coordinateSystem: "gcj02",
    }).success).toBe(true);
    expect(flashCoordinateSchema.safeParse({ latitude: 22.5431, longitude: 114.0579 }).success).toBe(false);
    expect(flashCoordinateSchema.safeParse({ latitude: 23.2, longitude: 114.0579 }).success).toBe(false);
    expect(flashCoordinateSchema.safeParse({ latitude: 22.5431, longitude: 113.1 }).success).toBe(false);
  });

  it("fails readiness closed until every formal dependency is configured", () => {
    expect(evaluateFlashFeatureReadiness(false).blockers).toEqual(["schema_not_ready"]);
    const incomplete = evaluateFlashFeatureReadiness(true, {
      activeNpcs: 5,
      canonicalNpcs: 5,
      canonicalWeekdayNpcs: 5,
      schedulableNpcs: 4,
      taskReadyNpcs: 4,
      reviewedTasks: 30,
      approvedEncounterLocations: 3,
      approvedTaskDestinations: 0,
      linkedTasks: 30,
      readyTaskCategoryCounts,
    }, readyRuntime);
    expect(incomplete.ready).toBe(false);
    expect(incomplete.blockers).toContain("all_active_npcs_require_approved_locations");
    expect(incomplete.blockers).toContain("all_active_npcs_require_ready_tasks");
    expect(evaluateFlashFeatureReadiness(true, {
      ...incomplete.counts,
      schedulableNpcs: 5,
      taskReadyNpcs: 5,
    }, readyRuntime).ready).toBe(true);
    expect(evaluateFlashFeatureReadiness(true, {
      ...incomplete.counts,
      activeNpcs: 6,
      schedulableNpcs: 6,
      taskReadyNpcs: 6,
    }, readyRuntime).ready).toBe(true);
  });

  it("keeps the formal task catalog on the single six-category contract", () => {
    expect(FLASH_TASK_CATEGORIES).toEqual([
      "城市出发",
      "文化娱乐",
      "身体动起来",
      "一直想做",
      "关系连接",
      "NPC传话",
    ]);
    expect(new Set(FLASH_TASK_SEEDS.map((task) => task.category))).toEqual(new Set(FLASH_TASK_CATEGORIES));
    expect(getFlashTaskSeedByCode("T01")?.category).toBe("城市出发");
    expect(getFlashTaskSeedByCode("T30")?.category).toBe("NPC传话");
    expect(getFlashTaskSeedByCode("UNKNOWN")).toBeNull();
  });

  it("keeps rollout blocked until Tencent reverse geocoding is configured", () => {
    const counts = {
      activeNpcs: 5,
      canonicalNpcs: 5,
      canonicalWeekdayNpcs: 5,
      schedulableNpcs: 5,
      taskReadyNpcs: 5,
      reviewedTasks: 30,
      approvedEncounterLocations: 5,
      approvedTaskDestinations: 10,
      linkedTasks: 30,
      readyTaskCategoryCounts,
    };
    expect(evaluateFlashFeatureReadiness(true, counts).blockers).toContain("tencent_map_key_required");
    expect(evaluateFlashFeatureReadiness(true, counts, readyRuntime).ready).toBe(true);
  });

  it("blocks readiness when a canonical NPC is replaced or one category has fewer than five ready tasks", () => {
    const readyCounts = {
      activeNpcs: 5,
      canonicalNpcs: 5,
      canonicalWeekdayNpcs: 5,
      schedulableNpcs: 5,
      taskReadyNpcs: 5,
      reviewedTasks: 30,
      approvedEncounterLocations: 5,
      approvedTaskDestinations: 10,
      linkedTasks: 30,
      readyTaskCategoryCounts,
    };
    const replacedNpc = evaluateFlashFeatureReadiness(true, { ...readyCounts, canonicalNpcs: 4 }, readyRuntime);
    expect(replacedNpc.blockers).toContain("five_builtin_seed_npcs_required");

    const [category] = Object.keys(readyTaskCategoryCounts);
    const thinCategory = evaluateFlashFeatureReadiness(true, {
      ...readyCounts,
      readyTaskCategoryCounts: { ...readyTaskCategoryCounts, [category]: 4 },
    }, readyRuntime);
    expect(thinCategory.blockers).toContain("six_categories_with_five_ready_tasks_required");

    const changedWeekday = evaluateFlashFeatureReadiness(
      true,
      { ...readyCounts, canonicalWeekdayNpcs: 4 },
      readyRuntime,
    );
    expect(changedWeekday.blockers).toContain("canonical_npc_weekdays_required");
  });

  it("probes critical formal columns and fails schema readiness for a partial table", async () => {
    const projections: string[][] = [];
    const executor = {
      select: (projection: Record<string, unknown>) => {
        const keys = Object.keys(projection);
        projections.push(keys);
        return { from: () => ({ limit: () => Promise.resolve([]) }) };
      },
    };
    await expect(isFlashSchemaReady(executor as any)).resolves.toBe(true);
    expect(projections).toContainEqual(expect.arrayContaining(["lastReviewedAt", "reviewedBy"]));
    expect(projections).toContainEqual(expect.arrayContaining(["contentVersion", "isHumanReviewed"]));
    expect(projections).toContainEqual(expect.arrayContaining(["createdAt", "windowStartedAt", "attemptCount"]));
    expect(projections).toContainEqual(expect.arrayContaining(["deliveryEncounterId", "privateReplyDeleteAfter"]));

    const partialExecutor = {
      select: (projection: Record<string, unknown>) => ({
        from: () => ({
          limit: () => Object.hasOwn(projection, "deliveryEncounterId")
            ? Promise.reject(new Error("column does not exist"))
            : Promise.resolve([]),
        }),
      }),
    };
    await expect(isFlashSchemaReady(partialExecutor as any)).resolves.toBe(false);
  });

  it("does not read disabled personalization sources", async () => {
    const readers = {
      personality: vi.fn().mockResolvedValue({ primaryArchetype: "海豚" }),
      interests: vi.fn().mockResolvedValue({ interestSelections: [{ label: "展览" }] }),
      industry: vi.fn().mockResolvedValue({ industryCategory: "technology", industryCategoryLabel: "科技" }),
      taskCategories: vi.fn().mockResolvedValue(["文化发现"]),
      insertTags: vi.fn().mockResolvedValue(undefined),
    };
    await syncEnabledPreferenceTags("user-1", {
      personalizationEnabled: true,
      usePersonality: false,
      useInterests: false,
      useIndustry: false,
      useDistrict: true,
      useTaskBehavior: false,
      consentVersion: FLASH_PERSONALIZATION_CONSENT_VERSION,
      consentedAt: new Date(),
    }, "南山区", readers as any);

    expect(readers.personality).not.toHaveBeenCalled();
    expect(readers.interests).not.toHaveBeenCalled();
    expect(readers.industry).not.toHaveBeenCalled();
    expect(readers.taskCategories).not.toHaveBeenCalled();
    expect(readers.insertTags).toHaveBeenCalledWith("user-1", [{
      source: "district",
      tagKey: "district:南山区",
      label: "南山区",
    }]);
  });
});

describe("formal Flash scheduling", () => {
  it("uses ISO weekdays for Shenzhen calendar dates without UTC rollover", () => {
    expect(isoWeekdayForServiceDate("2026-07-20")).toBe(1); // Monday
    expect(isoWeekdayForServiceDate("2026-07-19")).toBe(7); // Sunday
  });

  it("creates one or two 90-150 minute shifts only on an eligible day", () => {
    const locationRow = location();
    const generated = generateFlashScheduleDraft({
      serviceDate: "2026-07-20",
      npcs: [npc()],
      locationsByNpc: new Map([[npc().id, [locationRow]]]),
      seed: "monday-regression",
    });
    expect(generated.shifts.length).toBeGreaterThanOrEqual(1);
    expect(generated.shifts.length).toBeLessThanOrEqual(2);
    for (const shift of generated.shifts) {
      const minutes = (shift.endsAt.getTime() - shift.startsAt.getTime()) / 60_000;
      expect(minutes).toBeGreaterThanOrEqual(90);
      expect(minutes).toBeLessThanOrEqual(150);
    }
    const validation = validateFlashScheduleDraft({
      serviceDate: "2026-07-20",
      shifts: generated.shifts,
      npcsById: new Map([[npc().id, npc()]]),
      locationsByNpc: new Map([[npc().id, [locationRow]]]),
    });
    expect(validation).toEqual({ valid: true, errors: [] });
  });

  it("blocks a third NPC shift and any shift crossing the Shenzhen service date", () => {
    const npcRow = npc();
    const locationRow = location();
    const shifts = [
      ["2026-07-20T09:00:00+08:00", "2026-07-20T10:30:00+08:00"],
      ["2026-07-20T13:00:00+08:00", "2026-07-20T14:30:00+08:00"],
      ["2026-07-20T19:30:00+08:00", "2026-07-21T00:00:00+08:00"],
    ].map(([startsAt, endsAt]) => ({
      npcId: npcRow.id,
      locationId: locationRow.id,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      source: "manual" as const,
    }));
    const validation = validateFlashScheduleDraft({
      serviceDate: "2026-07-20",
      shifts,
      npcsById: new Map([[npcRow.id, npcRow]]),
      locationsByNpc: new Map([[npcRow.id, [locationRow]]]),
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(`NPC_SHIFT_COUNT_EXCEEDED:${npcRow.id}`);
    expect(validation.errors).toContain(`CROSS_SERVICE_DATE:${npcRow.id}`);
  });

  it("rejects hand-edited shifts that are not aligned to whole minutes", () => {
    const npcRow = npc();
    const locationRow = location();
    const validation = validateFlashScheduleDraft({
      serviceDate: "2026-07-20",
      shifts: [{
        npcId: npcRow.id,
        locationId: locationRow.id,
        startsAt: new Date("2026-07-20T09:00:01+08:00"),
        endsAt: new Date("2026-07-20T10:30:01+08:00"),
        source: "manual" as const,
      }],
      npcsById: new Map([[npcRow.id, npcRow]]),
      locationsByNpc: new Map([[npcRow.id, [locationRow]]]),
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain(`TIME_NOT_MINUTE_ALIGNED:${npcRow.id}`);
  });

  it("seeded random is deterministic", () => {
    const first = createSeededRandom("same-seed");
    const second = createSeededRandom("same-seed");
    expect([first(), first(), first()]).toEqual([second(), second(), second()]);
  });
});

describe("formal Flash repeat decay", () => {
  const base = {
    baseWeight: 100,
    npcWeight: 100,
    destinationWeight: 100,
    candidateTags: [],
    answerTags: [],
    userTagLabels: [],
    destinationDistrict: "南山区",
    contextDistrict: null,
    useDistrict: false,
  };

  it("always applies 0.35^n and keeps a five-percent floor", () => {
    expect(calculateFlashCandidateWeight({ ...base, completionCount: 0 })).toBeCloseTo(100);
    expect(calculateFlashCandidateWeight({ ...base, completionCount: 1 })).toBeCloseTo(35);
    expect(calculateFlashCandidateWeight({ ...base, completionCount: 2 })).toBeCloseTo(12.25);
    expect(calculateFlashCandidateWeight({ ...base, completionCount: 20 })).toBeCloseTo(5);
  });

  it("counts only delivered tasks; declined, expired and abandoned do not decay", () => {
    expect(FLASH_REPEAT_DECAY_STATUSES).toEqual(["delivered"]);
    expect(FLASH_REPEAT_DECAY_STATUSES).not.toContain("expired" as never);
    expect(FLASH_REPEAT_DECAY_STATUSES).not.toContain("abandoned" as never);
  });
});

describe("formal Flash delivery encounter", () => {
  const feedbackSubmittedAt = new Date("2026-07-20T12:00:00+08:00");

  it("requires a different encounter unlocked after feedback", () => {
    const assignment = { encounterId: "encounter-original", feedbackSubmittedAt };
    expect(isLaterFlashDeliveryEncounter(assignment, {
      id: "encounter-original",
      unlockedAt: new Date("2026-07-20T13:00:00+08:00"),
    })).toBe(false);
    expect(isLaterFlashDeliveryEncounter(assignment, {
      id: "encounter-early",
      unlockedAt: new Date("2026-07-20T11:59:59+08:00"),
    })).toBe(false);
    expect(isLaterFlashDeliveryEncounter(assignment, {
      id: "encounter-next",
      unlockedAt: new Date("2026-07-21T10:00:00+08:00"),
    })).toBe(true);
  });

  it("uses acceptance time for a destination-free invitation but still rejects the same encounter", () => {
    const createdAt = new Date("2026-07-20T10:00:00+08:00");
    const assignment = {
      encounterId: "encounter-original",
      feedbackSubmittedAt: null,
      createdAt,
      contentSnapshot: { invitationType: "life_invitation" } as any,
    };
    expect(isLaterFlashDeliveryEncounter(assignment, {
      id: "encounter-original",
      unlockedAt: new Date("2026-07-20T11:00:00+08:00"),
    })).toBe(false);
    expect(isLaterFlashDeliveryEncounter(assignment, {
      id: "encounter-next",
      unlockedAt: new Date("2026-07-20T11:00:00+08:00"),
    })).toBe(true);
  });
});
