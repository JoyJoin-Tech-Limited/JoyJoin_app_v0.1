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

describe("discover analytics allowlist contract", () => {
  it("includes every client event type in the server allowlist", () => {
    const clientSource = readFileSync(CLIENT_SOURCE, "utf-8");
    const serverSource = readFileSync(SERVER_SOURCE, "utf-8");

    // Extract the union members from the client type alias.
    // The alias is not semicolon-terminated; it ends at the blank line before
    // the next export, so we stop at the next top-level `export` keyword.
    const typeMatch = clientSource.match(
      /export type DiscoverAnalyticsEventType\s*=\s*([\s\S]*?)(?=\n\nexport|\nexport|$)/,
    );
    expect(typeMatch).not.toBeNull();

    const clientEventTypes = (typeMatch?.[1] ?? "")
      // Strip single-line comments before splitting to avoid parsing
      // comment content (e.g. // reason: 'button'|'tap_through') as types.
      .replace(/\/\/[^\n]*/g, "")
      .split("|")
      .map((line) => line.trim().replace(/^'/, "").replace(/'$/, ""))
      .filter((type) => type.length > 0 && !type.includes("\n"));

    expect(clientEventTypes.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const eventType of clientEventTypes) {
      // The server allowlist is declared as a const array literal.
      if (!serverSource.includes(`"${eventType}"`)) {
        missing.push(eventType);
      }
    }

    expect(missing).toEqual([]);
  });
});
