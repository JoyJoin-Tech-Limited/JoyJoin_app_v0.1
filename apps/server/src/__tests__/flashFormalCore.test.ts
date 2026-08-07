import { describe, expect, it, vi } from "vitest";
import {
  FLASH_NPC_SEEDS,
  FLASH_TASK_SEEDS,
} from "@shared/alang/flashCatalog";
import { FLASH_INVITATION_DEFINITIONS } from "@shared/alang/flashInvitationCatalog";
import {
  FLASH_PERSONALIZATION_CONSENT_VERSION,
  flashCoordinateSchema,
  flashPreferenceUpdateSchema,
} from "@shared/alang/flashTypes";

import {
  isFlashShenzhenBoundaryAssetValid,
  isFlashShenzhenBoundaryLicenseApproved,
  isFlashShenzhenBoundaryReady,
  isWithinFlashShenzhenBoundary,
} from "../lib/flashShenzhenBoundary";
import { FLASH_REPEAT_DECAY_STATUSES, isFlashSchemaReady } from "../repositories/flashRepo";
import {
  canRegeneratePublishedFlashSchedule,
  canAdjustUpcomingFlashShift,
  createSeededRandom,
  flashSchedulePreviewDigest,
  generateFlashScheduleDraft,
  isoWeekdayForServiceDate,
  validateFlashScheduleDraft,
} from "../services/flashScheduleService";
import {
  calculateFlashMapFrame,
  calculateFlashCandidateWeight,
  evaluateFlashFeatureReadiness,
  isLaterFlashDeliveryEncounter,
  syncEnabledPreferenceTags,
} from "../services/flashService";

const readyTaskCategoryCounts = Object.fromEntries(
  [...new Set(FLASH_TASK_SEEDS.map((task) => task.category))].map((category) => [category, 5]),
);
const readyBoundary = { assetValid: true, licenseApproved: true };

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
    minShiftMinutes: 180,
    maxShiftMinutes: 300,
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
  it("calculates a north-based map frame without returning target coordinates", () => {
    const frame = calculateFlashMapFrame(
      { latitude: 22.5431, longitude: 114.0579 },
      { latitude: 22.5441, longitude: 114.0579 },
    );

    expect(frame.distanceMeters).toBeGreaterThan(100);
    expect(frame.distanceMeters).toBeLessThan(120);
    expect(frame.targetBearingDegrees).toBeCloseTo(0, 0);
    expect(frame.proximityBand).toBe("approaching");
    expect(frame).not.toHaveProperty("latitude");
    expect(frame).not.toHaveProperty("longitude");
  });

  it("normalizes eastbound map bearings and arrival proximity", () => {
    const east = calculateFlashMapFrame(
      { latitude: 22.5431, longitude: 114.0579 },
      { latitude: 22.5431, longitude: 114.0589 },
    );
    const arrived = calculateFlashMapFrame(
      { latitude: 22.5431, longitude: 114.0579 },
      { latitude: 22.54315, longitude: 114.0579 },
    );

    expect(east.targetBearingDegrees).toBeCloseTo(90, 0);
    expect(arrived.proximityBand).toBe("arrived");
  });

  it("contains five distinct NPCs and six categories of five reviewed drafts", () => {
    expect(FLASH_NPC_SEEDS).toHaveLength(5);
    expect(new Set(FLASH_NPC_SEEDS.map((item) => item.slug)).size).toBe(5);
    expect(FLASH_TASK_SEEDS).toHaveLength(30);
    expect(new Set(FLASH_TASK_SEEDS.map((item) => item.code)).size).toBe(30);
    const counts = new Map<string, number>();
    for (const task of FLASH_TASK_SEEDS) counts.set(task.category, (counts.get(task.category) ?? 0) + 1);
    expect([...counts.values()].sort()).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it("uses non-punitive life invitations and digital-NPC-only message relays", () => {
    expect(FLASH_INVITATION_DEFINITIONS).toHaveLength(30);
    expect(FLASH_INVITATION_DEFINITIONS.filter((item) => item.kind === "life_invitation")).toHaveLength(25);
    const relays = FLASH_INVITATION_DEFINITIONS.filter((item) => item.kind === "npc_message");
    expect(relays).toHaveLength(5);
    expect(relays.every((item) => item.targetNpcSlug && item.targetNpcName && item.messageCopy)).toBe(true);
    expect(relays.every((item) => item.tags.includes(`target-npc:${item.targetNpcSlug}`))).toBe(true);
    // The reviewed task library is retained for historical records only. The
    // formal story flow no longer exposes task feedback as a runtime contract.
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

  it("keeps broad transport validation light and enforces the pinned Shenzhen boundary on the server", () => {
    expect(flashCoordinateSchema.safeParse({
      latitude: 22.5431,
      longitude: 114.0579,
      coordinateSystem: "gcj02",
    }).success).toBe(true);
    expect(flashCoordinateSchema.safeParse({ latitude: 22.5431, longitude: 114.0579 }).success).toBe(false);
    expect(flashCoordinateSchema.safeParse({ latitude: 23.2, longitude: 114.0579 }).success).toBe(false);
    expect(flashCoordinateSchema.safeParse({ latitude: 22.5431, longitude: 113.1 }).success).toBe(false);
    expect(isWithinFlashShenzhenBoundary(22.5431, 114.0579)).toBe(true);
    expect(isWithinFlashShenzhenBoundary(22.596, 114.479)).toBe(true);
    // Regression points from the old rectangle and hand-drawn polygons.
    expect(isWithinFlashShenzhenBoundary(22.495, 114.139)).toBe(false);
    expect(isWithinFlashShenzhenBoundary(22.7448, 114.141)).toBe(false);
    expect(isWithinFlashShenzhenBoundary(22.75, 113.73)).toBe(false);
    expect(isWithinFlashShenzhenBoundary(22.80, 114.46)).toBe(false);
  });

  it("fails readiness closed until every formal dependency is configured", () => {
    expect(evaluateFlashFeatureReadiness(false).blockers).toEqual(["schema_not_ready"]);
    const incomplete = evaluateFlashFeatureReadiness(true, {
      activeNpcs: 5,
      canonicalNpcs: 5,
      schedulableNpcs: 4,
      taskReadyNpcs: 4,
      reviewedTasks: 30,
      approvedEncounterLocations: 3,
      approvedTaskDestinations: 10,
      linkedTasks: 30,
      readyTaskCategoryCounts,
      publishedStorySeasons: 1,
      reviewedStoryEpisodes: 15,
      storyCoveredNpcs: 5,
    }, readyBoundary);
    expect(incomplete.ready).toBe(false);
    expect(incomplete.blockers).toContain("all_active_npcs_require_approved_locations");
    expect(evaluateFlashFeatureReadiness(true, {
      ...incomplete.counts,
      schedulableNpcs: 5,
      taskReadyNpcs: 5,
    }, readyBoundary).ready).toBe(true);
    expect(evaluateFlashFeatureReadiness(true, {
      ...incomplete.counts,
      activeNpcs: 6,
      schedulableNpcs: 6,
      taskReadyNpcs: 6,
    }, readyBoundary).ready).toBe(true);
  });

  it("keeps rollout blocked until the pinned boundary asset and its commercial use are approved", () => {
    const counts = {
      activeNpcs: 5,
      canonicalNpcs: 5,
      schedulableNpcs: 5,
      taskReadyNpcs: 5,
      reviewedTasks: 30,
      approvedEncounterLocations: 5,
      approvedTaskDestinations: 10,
      linkedTasks: 30,
      readyTaskCategoryCounts,
      publishedStorySeasons: 1,
      reviewedStoryEpisodes: 15,
      storyCoveredNpcs: 5,
    };
    expect(evaluateFlashFeatureReadiness(true, counts, {
      assetValid: false,
      licenseApproved: true,
    }).blockers).toContain("shenzhen_boundary_asset_not_ready");
    expect(evaluateFlashFeatureReadiness(true, counts, {
      assetValid: true,
      licenseApproved: false,
    }).blockers).toContain("shenzhen_boundary_license_not_approved");
  });

  it("binds boundary approval to the exact reviewed semantic hash", () => {
    expect(isFlashShenzhenBoundaryAssetValid()).toBe(true);
    vi.stubEnv("FLASH_SHENZHEN_BOUNDARY_APPROVED_SHA256", "wrong-revision");
    expect(isFlashShenzhenBoundaryLicenseApproved()).toBe(false);
    expect(isFlashShenzhenBoundaryReady()).toBe(false);
    vi.stubEnv(
      "FLASH_SHENZHEN_BOUNDARY_APPROVED_SHA256",
      "B691FAA581D9330E6DC738DCD11421958CA2D4DDEA271B656A56237F9FA6FB0B",
    );
    expect(isFlashShenzhenBoundaryLicenseApproved()).toBe(true);
    expect(isFlashShenzhenBoundaryReady()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("blocks readiness when a canonical NPC is replaced or the published season is incomplete", () => {
    const readyCounts = {
      activeNpcs: 5,
      canonicalNpcs: 5,
      schedulableNpcs: 5,
      taskReadyNpcs: 5,
      reviewedTasks: 30,
      approvedEncounterLocations: 5,
      approvedTaskDestinations: 10,
      linkedTasks: 30,
      readyTaskCategoryCounts,
      publishedStorySeasons: 1,
      reviewedStoryEpisodes: 15,
      storyCoveredNpcs: 5,
    };
    const replacedNpc = evaluateFlashFeatureReadiness(true, { ...readyCounts, canonicalNpcs: 4 }, readyBoundary);
    expect(replacedNpc.blockers).toContain("five_builtin_seed_npcs_required");

    const incompleteSeason = evaluateFlashFeatureReadiness(true, {
      ...readyCounts,
      reviewedStoryEpisodes: 14,
    }, readyBoundary);
    expect(incompleteSeason.blockers).toContain("fifteen_reviewed_story_episodes_required");
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
  it("allows only today's published shifts that have not started to be adjusted", () => {
    const now = new Date("2026-08-02T14:00:00+08:00");
    const plan = { status: "published", serviceDate: "2026-08-02" };
    expect(canAdjustUpcomingFlashShift(plan, { status: "published", startsAt: "2026-08-02T15:00:00+08:00" }, now)).toBe(true);
    expect(canAdjustUpcomingFlashShift({ ...plan, status: "draft" }, { status: "draft", startsAt: "2026-08-02T15:00:00+08:00" }, now)).toBe(true);
    expect(canAdjustUpcomingFlashShift(plan, { status: "published", startsAt: "2026-08-02T14:00:00+08:00" }, now)).toBe(false);
    expect(canAdjustUpcomingFlashShift(plan, { status: "published", startsAt: "2026-08-02T12:00:00+08:00" }, now)).toBe(false);
    expect(canAdjustUpcomingFlashShift({ ...plan, serviceDate: "2026-08-03" }, { status: "published", startsAt: "2026-08-03T15:00:00+08:00" }, now)).toBe(false);
    expect(canAdjustUpcomingFlashShift(plan, { status: "cancelled", startsAt: "2026-08-02T15:00:00+08:00" }, now)).toBe(false);
  });

  it("only allows a published Shenzhen next-day plan to be regenerated", () => {
    const now = new Date("2026-07-31T14:00:00+08:00");
    expect(canRegeneratePublishedFlashSchedule({
      status: "published",
      serviceDate: "2026-08-01",
    }, now)).toBe(true);
    expect(canRegeneratePublishedFlashSchedule({
      status: "draft",
      serviceDate: "2026-08-01",
    }, now)).toBe(false);
    expect(canRegeneratePublishedFlashSchedule({
      status: "published",
      serviceDate: "2026-07-31",
    }, now)).toBe(false);
    expect(canRegeneratePublishedFlashSchedule({
      status: "published",
      serviceDate: "2026-08-02",
    }, now)).toBe(false);
  });

  it("binds a regeneration preview digest to its exact generated shifts", () => {
    const shifts = [{
      npcId: "00000000-0000-4000-8000-000000000001",
      locationId: "00000000-0000-4000-8000-000000000101",
      startsAt: new Date("2026-08-01T09:00:00+08:00"),
      endsAt: new Date("2026-08-01T12:00:00+08:00"),
      source: "generated" as const,
    }];
    expect(flashSchedulePreviewDigest(shifts)).toBe(flashSchedulePreviewDigest(shifts.map((shift) => ({ ...shift }))));
    expect(flashSchedulePreviewDigest(shifts)).not.toBe(flashSchedulePreviewDigest([{
      ...shifts[0],
      endsAt: new Date("2026-08-01T13:00:00+08:00"),
    }]));
  });

  it("uses ISO weekdays for Shenzhen calendar dates without UTC rollover", () => {
    expect(isoWeekdayForServiceDate("2026-07-20")).toBe(1); // Monday
    expect(isoWeekdayForServiceDate("2026-07-19")).toBe(7); // Sunday
  });

  it("creates one or two 180-300 minute shifts only on an eligible day", () => {
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
      expect(minutes).toBeGreaterThanOrEqual(180);
      expect(minutes).toBeLessThanOrEqual(300);
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
      ["2026-07-20T09:00:00+08:00", "2026-07-20T12:00:00+08:00"],
      ["2026-07-20T13:30:00+08:00", "2026-07-20T16:30:00+08:00"],
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
});
