import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import {
  flashNpcTaskLinks,
  flashTaskDestinationLinks,
  flashTaskDestinations,
  flashTaskTemplates,
} from "@shared/schema";

import {
  countCanonicalFlashNpcWeekdayMatches,
  isCanonicalFlashNpcSlug,
  matchesCanonicalFlashNpcWeekdays,
} from "../lib/flashNpcPolicy";
import {
  flashPrivateReplyDeliveryDeadline,
  flashPrivateReplyPendingDeadline,
} from "../lib/flashPrivacyPolicy";
import {
  declineUnavailableFlashEncounterOffer,
  isFlashTaskOfferEligibleForAcceptance,
  lockEligibleFlashTaskOfferForAcceptance,
  withdrawOfferedFlashEncountersForTaskTemplate,
} from "../repositories/flashRepo";

const DAY_MS = 24 * 60 * 60 * 1000;

const eligibleState = {
  templateIsActive: true,
  templateIsHumanReviewed: true,
  templateReviewStatus: "active",
  destinationIsActive: true,
  destinationApprovalStatus: "approved",
  destinationCity: "深圳",
  npcTaskLinkIsActive: true,
  taskDestinationLinkIsActive: true,
};

function lockedOfferRows() {
  return {
    taskTemplateId: {
      taskTemplateId: "task-1",
      code: "T01",
      category: "探店借口",
      title: "替我看看",
      brief: "到附近看看",
      instructions: "不要求进店或消费",
      dialogueIntro: "我还没去过",
      feedbackPrompts: [],
      tags: ["安静"],
      durationDays: 7,
      baseWeight: 100,
      contentVersion: 3,
      templateIsActive: true,
      templateIsHumanReviewed: true,
      templateReviewStatus: "active",
    },
    destinationId: {
      destinationId: "destination-1",
      destinationName: "安全地点",
      destinationCity: "深圳",
      destinationDistrict: "南山区",
      destinationAddress: "测试路 1 号",
      destinationLatitude: 22.53,
      destinationLongitude: 113.94,
      destinationCoordinateSystem: "gcj02",
      destinationTags: ["安静"],
      destinationIsActive: true,
      destinationApprovalStatus: "approved",
    },
    npcTaskLinkId: {
      npcTaskLinkId: "npc-task-1",
      requestCopy: "可以替我去看看吗？",
      deliveryCopy: "谢谢你。",
      npcWeight: 100,
      npcTaskLinkIsActive: true,
    },
    taskDestinationLinkId: {
      taskDestinationLinkId: "task-destination-1",
      destinationLinkWeight: 100,
      taskDestinationLinkIsActive: true,
    },
  };
}

function lockingExecutor(rows = lockedOfferRows()) {
  const locks: Array<{ strength: string; of: unknown }> = [];
  return {
    locks,
    select: (projection: Record<string, unknown>) => {
      const row = rows[Object.keys(projection)[0] as keyof typeof rows];
      const builder: any = {
        from: () => builder,
        where: () => builder,
        for: (strength: string, config: { of?: unknown } = {}) => {
          locks.push({ strength, of: config.of });
          return builder;
        },
        limit: () => Promise.resolve(row ? [row] : []),
      };
      return builder;
    },
  };
}

function updateExecutor(returnedIds: string[]) {
  const returning = vi.fn().mockResolvedValue(returnedIds.map((id) => ({ id })));
  const builder: any = {
    set: () => builder,
    where: () => builder,
    returning,
  };
  return { update: vi.fn(() => builder), returning };
}

describe("Flash task acceptance state integrity", () => {
  it("locks every mutable eligibility row before returning an offer snapshot", async () => {
    const executor = lockingExecutor();

    const offer = await lockEligibleFlashTaskOfferForAcceptance({
      npcId: "npc-1",
      taskTemplateId: "task-1",
      destinationId: "destination-1",
    }, executor as any);

    expect(offer).toMatchObject({ taskTemplateId: "task-1", destinationId: "destination-1" });
    expect(executor.locks).toHaveLength(4);
    expect(executor.locks.map((lock) => lock.strength)).toEqual(["update", "update", "update", "update"]);
    expect(executor.locks[0]?.of).toBe(flashTaskTemplates);
    expect(executor.locks[1]?.of).toBe(flashTaskDestinations);
    expect(executor.locks[2]?.of).toBe(flashNpcTaskLinks);
    expect(executor.locks[3]?.of).toBe(flashTaskDestinationLinks);
  });

  it.each([
    ["inactive template", { templateIsActive: false }],
    ["unreviewed template", { templateIsHumanReviewed: false }],
    ["non-active review", { templateReviewStatus: "pending_review" }],
    ["inactive destination", { destinationIsActive: false }],
    ["unapproved destination", { destinationApprovalStatus: "draft" }],
    ["non-Shenzhen destination", { destinationCity: "东莞" }],
    ["inactive NPC-task link", { npcTaskLinkIsActive: false }],
    ["inactive task-destination link", { taskDestinationLinkIsActive: false }],
  ])("rejects %s after locking", (_label, override) => {
    expect(isFlashTaskOfferEligibleForAcceptance({ ...eligibleState, ...override })).toBe(false);
  });

  it("accepts only the complete reviewed and approved eligibility state", () => {
    expect(isFlashTaskOfferEligibleForAcceptance(eligibleState)).toBe(true);
  });

  it("retracts every still-offered encounter after a task edit", async () => {
    const executor = updateExecutor(["encounter-1", "encounter-2"]);
    await expect(withdrawOfferedFlashEncountersForTaskTemplate(
      "task-1",
      new Date("2026-07-21T10:00:00+08:00"),
      executor as any,
    )).resolves.toBe(2);
  });

  it("self-heals only the exact unavailable offer snapshot", async () => {
    const executor = updateExecutor(["encounter-1"]);
    await expect(declineUnavailableFlashEncounterOffer({
      encounterId: "encounter-1",
      userId: "user-1",
      taskTemplateId: "task-1",
      destinationId: "destination-1",
      now: new Date("2026-07-21T10:00:00+08:00"),
    }, executor as any)).resolves.toBe(true);
  });

  it("keeps locked revalidation and assignment creation in one transaction", () => {
    // Structural regression guard: moving either call outside this function
    // would reopen the admin-withdrawal race even if helper unit tests passed.
    const source = readFileSync(
      fileURLToPath(new URL("../repositories/flashRepo.ts", import.meta.url)),
      "utf8",
    );
    const start = source.indexOf("export async function acceptFlashAssignment");
    const end = source.indexOf("export async function markFlashAssignmentArrived", start);
    const body = source.slice(start, end);
    expect(body.indexOf("db.transaction")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("lockEligibleFlashTaskOfferForAcceptance")).toBeGreaterThan(body.indexOf("db.transaction"));
    expect(body.indexOf("tx.insert(flashTaskAssignments)")).toBeGreaterThan(body.indexOf("lockEligibleFlashTaskOfferForAcceptance"));
  });

  it("wires task edits to transactional offer withdrawal and reads to self-healing", () => {
    const adminSource = readFileSync(
      fileURLToPath(new URL("../routes/domains/adminAlang.ts", import.meta.url)),
      "utf8",
    );
    const serviceSource = readFileSync(
      fileURLToPath(new URL("../services/flashService.ts", import.meta.url)),
      "utf8",
    );
    const patchStart = adminSource.indexOf('app.patch("/api/admin/alang/task-templates/:id"');
    const patchEnd = adminSource.indexOf('app.get("/api/admin/alang/schedules"', patchStart);
    const patchBody = adminSource.slice(patchStart, patchEnd);
    expect(patchBody).toContain("db.transaction");
    expect(patchBody).toContain("withdrawOfferedFlashEncountersForTaskTemplate");
    expect(patchBody).toContain("retiredFlashTaskAdmin");
  });

  it("keeps offers on the dialogue route and uses reviewed delivery copy as the outcome-aware fallback", () => {
    const serviceSource = readFileSync(
      fileURLToPath(new URL("../services/flashService.ts", import.meta.url)),
      "utf8",
    );
    const repositorySource = readFileSync(
      fileURLToPath(new URL("../repositories/flashRepo.ts", import.meta.url)),
      "utf8",
    );
    expect(serviceSource).toContain('else if (status === "offered") canonicalScreen = "dialogue"');
    expect(repositorySource).toContain("deliveryCopy: offer.deliveryCopy");
    expect(serviceSource).toContain('else if (status === "offered") canonicalScreen = "dialogue"');
  });
});

describe("Flash private reply retention", () => {
  it("sets an absolute pending cap and a shorter post-delivery deadline", () => {
    const now = new Date("2026-07-21T10:00:00+08:00");
    expect(flashPrivateReplyPendingDeadline(now, "  想告诉你这里很安静  ")?.getTime())
      .toBe(now.getTime() + 37 * DAY_MS);
    expect(flashPrivateReplyPendingDeadline(now, "   ")).toBeNull();
    expect(flashPrivateReplyDeliveryDeadline(now).getTime()).toBe(now.getTime() + 30 * DAY_MS);
  });

  it("never extends an existing absolute deadline when delivery happens", () => {
    // Regression guard: delivery uses PostgreSQL LEAST(existing cap, delivered + 30 days).
    const source = readFileSync(
      fileURLToPath(new URL("../repositories/flashRepo.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain("least(${flashTaskAssignments.privateReplyDeleteAfter}, ${input.privateReplyDeleteAfter})");
  });
});

describe("Flash canonical NPC weekday policy", () => {
  it("compares sorted weekdays and rejects any canonical drift", () => {
    expect(isCanonicalFlashNpcSlug("alang")).toBe(true);
    expect(matchesCanonicalFlashNpcWeekdays("alang", [5, 2, 4])).toBe(true);
    expect(matchesCanonicalFlashNpcWeekdays("alang", [2, 4])).toBe(false);
    expect(matchesCanonicalFlashNpcWeekdays("custom-npc", [1])).toBe(false);
  });

  it("counts only active canonical NPCs with exact seeded weekdays", () => {
    expect(countCanonicalFlashNpcWeekdayMatches([
      { slug: "alang", eligibleWeekdays: [2, 4, 5], isActive: true },
      { slug: "lizi", eligibleWeekdays: [1, 3, 6], isActive: true },
      { slug: "momo", eligibleWeekdays: [3, 5], isActive: false },
      { slug: "shiqi", eligibleWeekdays: [2, 7], isActive: true },
      { slug: "custom-npc", eligibleWeekdays: [1], isActive: true },
    ])).toBe(2);
  });

  it("returns a direct 400 policy error for canonical weekday drift", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../routes/domains/adminAlang.ts", import.meta.url)),
      "utf8",
    );
    const start = source.indexOf('app.patch("/api/admin/alang/npcs/:id"');
    const end = source.indexOf('app.get("/api/admin/alang/encounter-locations"', start);
    const body = source.slice(start, end);
    expect(body).toContain("matchesCanonicalFlashNpcWeekdays");
    expect(body).toContain("res.status(400)");
    expect(body).toContain("FLASH_ADMIN_CANONICAL_WEEKDAYS_FIXED");
  });
});
