import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contract invariant: every DiscoverAnalyticsEventType emitted by the
 * mini-program must also exist in the server's DISCOVER_EVENT_TYPES allowlist.
 *
 * This catches the common regression where a client analytics event is added
 * to apps/mini-program/src/lib/analytics/discoverAnalytics.ts but the server
 * route in apps/server/src/routes/domains/analytics.ts is not updated, causing
 * the event to be silently dropped.
 */
const CLIENT_SOURCE = resolve(
  __dirname,
  "../../../mini-program/src/lib/analytics/discoverAnalytics.ts",
);
const SERVER_SOURCE = resolve(__dirname, "../routes/domains/analytics.ts");

/**
 * 对标平台 conversion-funnel events (2026-10-20 gap audit §3). These six must exist
 * in BOTH the client union and the server DISCOVER_EVENT_TYPES allowlist. The
 * forward test below (client ⊆ server) catches "added to client only"; the
 * bidirectional test catches "added to server only" — so registering an event
 * on one side without the other fails the suite.
 */
const 对标平台_CONVERSION_EVENTS = [
  "guest_preview_card_impression",
  "guest_preview_card_tap",
  "guest_preview_login_tap",
  "guest_preview_login_success",
  "duo_entry_link_impression",
  "duo_entry_link_tap",
] as const;

/** Extract the string-literal members of the client DiscoverAnalyticsEventType union. */
function extractClientEventTypes(source: string): Set<string> {
  // The alias is not semicolon-terminated; it ends at the blank line before
  // the next export, so we stop at the next top-level `export` keyword.
  const typeMatch = source.match(
    /export type DiscoverAnalyticsEventType\s*=\s*([\s\S]*?)(?=\n\nexport|\nexport|$)/,
  );
  const members = (typeMatch?.[1] ?? "")
    // Strip single-line comments before splitting to avoid parsing
    // comment content (e.g. // reason: 'button'|'tap_through') as types.
    .replace(/\/\/[^\n]*/g, "")
    .split("|")
    .map((line) => line.trim().replace(/^'/, "").replace(/'$/, ""))
    .filter((type) => type.length > 0 && !type.includes("\n"));
  return new Set(members);
}

/** Extract the string-literal members of the server DISCOVER_EVENT_TYPES array. */
function extractServerEventTypes(source: string): Set<string> {
  const arrayMatch = source.match(
    /const DISCOVER_EVENT_TYPES\s*=\s*\[([\s\S]*?)\]\s*as const;/,
  );
  const members =
    (arrayMatch?.[1] ?? "")
      .replace(/\/\/[^\n]*/g, "")
      .match(/"([^"]+)"/g)
      ?.map((s) => s.slice(1, -1)) ?? [];
  return new Set(members);
}

describe("discover analytics allowlist contract", () => {
  it("includes every client event type in the server allowlist", () => {
    const clientSource = readFileSync(CLIENT_SOURCE, "utf-8");
    const serverSource = readFileSync(SERVER_SOURCE, "utf-8");

    const clientEventTypes = extractClientEventTypes(clientSource);
    const serverEventTypes = extractServerEventTypes(serverSource);

    expect(clientEventTypes.size).toBeGreaterThan(0);
    expect(serverEventTypes.size).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const eventType of clientEventTypes) {
      if (!serverEventTypes.has(eventType)) {
        missing.push(eventType);
      }
    }

    expect(missing).toEqual([]);
  });

  it("locks the 6 对标平台 conversion-funnel events on both sides (bidirectional parity)", () => {
    const clientSource = readFileSync(CLIENT_SOURCE, "utf-8");
    const serverSource = readFileSync(SERVER_SOURCE, "utf-8");

    const clientEventTypes = extractClientEventTypes(clientSource);
    const serverEventTypes = extractServerEventTypes(serverSource);

    const missingFromServer = 对标平台_CONVERSION_EVENTS.filter((e) => !serverEventTypes.has(e));
    const missingFromClient = 对标平台_CONVERSION_EVENTS.filter((e) => !clientEventTypes.has(e));

    expect(missingFromServer).toEqual([]);
    expect(missingFromClient).toEqual([]);
  });
});
