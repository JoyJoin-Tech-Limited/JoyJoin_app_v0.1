import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { personalStoryUpdateJobs } from "@shared/schema/personalStory";

vi.mock("../db", () => ({ db: {} }));

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_SOURCE = readFileSync(
  path.resolve(TEST_FILE_DIR, "../repositories/personalStoryRepo.ts"),
  "utf8",
);

function blindBoxEligibilityQuerySource(): string {
  const start = REPOSITORY_SOURCE.indexOf(
    "async function listBlindBoxExperienceSnapshots",
  );
  const end = REPOSITORY_SOURCE.indexOf(
    "export async function listEligiblePersonalStoryExperiences",
    start,
  );
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return REPOSITORY_SOURCE.slice(start, end);
}

const {
  createPersonalStoryLeaseToken,
  getPartnerAnimalLabel,
  sortAndDedupeExperienceSnapshots,
  toPersonalStoryChapterView,
  toPersonalStoryUpdateJobView,
} = await import("../repositories/personalStoryRepo");

describe("personal story repository boundaries", () => {
  it("admits a completed blind-box experience only with the acting user's strict participation proof", () => {
    const source = blindBoxEligibilityQuerySource();

    expect(source).toContain(".innerJoin(\n      eventFeedback,");
    expect(source).toContain(
      "eq(eventFeedback.eventId, eventPoolGroups.eventId)",
    );
    expect(source).toContain("eq(eventFeedback.userId, userId)");
    expect(source).toContain("isNotNull(eventFeedback.completedAt)");
    expect(source).toContain('eq(eventPoolRegistrations.matchStatus, "matched")');
    expect(source).toContain("isNotNull(eventPoolGroups.eventId)");
    expect(source).toContain("finalDateTime}, ${eventPools.dateTime}) <= now()");
  });

  it("excludes outcome-only, incomplete-feedback, test, and cancelled blind-box records", () => {
    const source = blindBoxEligibilityQuerySource();

    // INNER JOIN excludes users without feedback; completedAt excludes partial
    // feedback. These are intentionally independent of outcome submission.
    expect(source.match(/\.innerJoin\([\s\S]*?eventFeedback,/)).not.toBeNull();
    expect(source).not.toContain("leftJoin(\n      eventFeedback,");
    expect(source).toContain("isNotNull(eventFeedback.completedAt)");
    expect(source).toContain("eq(eventPools.isTestPool, false)");
    expect(source).toContain("eventPools.status}, '') <> 'cancelled'");
    expect(source).toContain("eventPoolGroups.status}, '') <> 'cancelled'");
  });

  it("defines a persisted lease-token column and creates a fresh UUID fencing token per claim", () => {
    expect(personalStoryUpdateJobs.leaseToken.name).toBe("lease_token");

    const tokens = Array.from({ length: 64 }, () =>
      createPersonalStoryLeaseToken(),
    );
    expect(new Set(tokens)).toHaveLength(tokens.length);
    for (const token of tokens) {
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("exposes only the animal-partner label rather than the rigid full archetype name", () => {
    expect(getPartnerAnimalLabel("owl")).toBe("猫头鹰伙伴");
    expect(getPartnerAnimalLabel("corgi")).toBe("柯基伙伴");
    expect(getPartnerAnimalLabel("unknown-archetype")).toBeNull();
  });

  it("always exposes AIGC disclosure metadata for generated chapters", () => {
    const view = toPersonalStoryChapterView({
      id: "chapter-1",
      title: "2026年07月15日 · 闪现",
      body: "事实记录。",
      factKeywords: { activityType: "闪现" },
      sourceOccurredAt: new Date("2026-07-15T10:00:00.000Z"),
      fallbackUsed: true,
    } as any);

    expect(view.aigc).toEqual({
      aiGenerated: true,
      labelType: "ai-generated",
    });
  });

  it("sorts verified experiences chronologically and deduplicates the same source", () => {
    const blindBox = {
      sourceType: "blind_box" as const,
      sourceId: "registration-1",
      occurredAt: "2026-07-15T10:00:00.000Z",
      keywords: {
        occurredOn: "2026-07-15",
        activityType: "盲盒饭局",
      },
    };
    const alang = {
      sourceType: "alang" as const,
      sourceId: "archive-1",
      occurredAt: "2026-07-14T10:00:00.000Z",
      keywords: {
        occurredOn: "2026-07-14",
        activityType: "闪现",
      },
    };

    expect(sortAndDedupeExperienceSnapshots([blindBox, alang, blindBox])).toEqual([
      alang,
      blindBox,
    ]);
  });

  it.each([
    ["pending", "queued"],
    ["running", "running"],
    ["completed", "succeeded"],
    ["partial_failed", "failed"],
    ["failed", "failed"],
  ] as const)("maps internal %s state to the public %s contract", (status, expected) => {
    const view = toPersonalStoryUpdateJobView({
      id: "job-1",
      status,
      updatedAt: new Date("2026-07-15T10:00:00.000Z"),
    } as any);

    expect(view).toEqual({
      id: "job-1",
      status: expected,
      updatedAt: "2026-07-15T10:00:00.000Z",
    });
  });
});
