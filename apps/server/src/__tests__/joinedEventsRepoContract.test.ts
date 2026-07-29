import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("joined events summary persistence contract", () => {
  it("excludes pool-match-derived legacy events so each matched pool yields one servable card", () => {
    const repoSource = readRepoFile("apps/server/src/repositories/joinedEventsRepo.ts");

    // Regression guard for the 足迹 duplicate + 活动详情 404 bug:
    // a matched pool dual-writes a legacy `events` row titled `<pool> - 第N组`
    // whose `events.id` has no serving detail endpoint. The legacy branch must
    // drop those pool-group-derived rows (the pool branch already covers them).
    expect(repoSource).toContain(".leftJoin(eventPoolGroups, eq(eventPoolGroups.eventId, events.id))");
    expect(repoSource).toContain("isNull(eventPoolGroups.id)");
    expect(repoSource).toContain('import { eq, desc, and, inArray, isNull } from "drizzle-orm"');
  });

  it("keeps the pool branch join shape intact (no cartesian product, registration id present)", () => {
    const repoSource = readRepoFile("apps/server/src/repositories/joinedEventsRepo.ts");

    // The pool card must stay servable: it joins pools on registration.poolId
    // and left-joins the assigned group for venue/member info.
    expect(repoSource).toContain(".innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))");
    expect(repoSource).toContain(".leftJoin(eventPoolGroups, eq(eventPoolRegistrations.assignedGroupId, eventPoolGroups.id))");
    expect(repoSource).toContain("registrationId: eventPoolRegistrations.id");
  });
});
