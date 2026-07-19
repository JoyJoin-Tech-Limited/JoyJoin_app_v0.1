import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

const CLIENT_FILE = "apps/mini-program/src/lib/analytics/socialIcebreakerAnalytics.ts";
const SERVER_FILE = "apps/server/src/routes/domains/analytics.ts";

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

/** Extract members of the client's `type EventType = | 'a' | 'b' ...` union. */
function extractClientEventTypes(source: string): string[] {
  const members = [...source.matchAll(/\|\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
  return [...new Set(members)];
}

/** Extract the string literals from the server SOCIAL_ICEBREAKER_EVENT_TYPES array. */
function extractServerWhitelist(source: string): string[] {
  const match = source.match(
    /const SOCIAL_ICEBREAKER_EVENT_TYPES = \[([\s\S]*?)\] as const;/,
  );
  expect(match, "server whitelist array literal not found").not.toBeNull();
  const members = [...match![1].matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
  return [...new Set(members)];
}

describe("social icebreaker analytics whitelist parity", () => {
  const clientEvents = extractClientEventTypes(readRepoFile(CLIENT_FILE));
  const serverWhitelist = extractServerWhitelist(readRepoFile(SERVER_FILE));

  it("parses a non-trivial number of events from both files (guard against regex drift)", () => {
    expect(clientEvents.length).toBeGreaterThanOrEqual(30);
    expect(serverWhitelist.length).toBeGreaterThanOrEqual(30);
  });

  it("accepts every event type the mini-program client can emit", () => {
    const missing = clientEvents.filter((e) => !serverWhitelist.includes(e));
    expect(
      missing,
      `client EventType members missing from server SOCIAL_ICEBREAKER_EVENT_TYPES: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("includes the Campfire Vault Card audit regression events", () => {
    expect(serverWhitelist).toContain("recap_leave_tap");
    expect(serverWhitelist).toContain("icebreaker_band_image_error");
  });
});
