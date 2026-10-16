import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contract invariant: every FeedbackAnalyticsEventType emitted by the
 * mini-program must also exist in the server's DISCOVER_EVENT_TYPES allowlist
 * (feedback events ride the /api/analytics/discover channel).
 *
 * Mirrors discoverAnalyticsAllowlistContract.test.ts — catches the regression
 * where a client event is added to
 * apps/mini-program/src/lib/analytics/feedbackAnalytics.ts but the server
 * route allowlist is not updated, silently dropping the event.
 */
const CLIENT_SOURCE = resolve(
  __dirname,
  "../../../mini-program/src/lib/analytics/feedbackAnalytics.ts",
);
const SERVER_SOURCE = resolve(__dirname, "../routes/domains/analytics.ts");

describe("feedback analytics allowlist contract", () => {
  it("includes every client feedback event type in the server allowlist", () => {
    const clientSource = readFileSync(CLIENT_SOURCE, "utf-8");
    const serverSource = readFileSync(SERVER_SOURCE, "utf-8");

    const typeMatch = clientSource.match(
      /export type FeedbackAnalyticsEventType\s*=\s*([\s\S]*?)(?=\n\nexport|\nexport|$)/,
    );
    expect(typeMatch).not.toBeNull();

    const clientEventTypes = (typeMatch?.[1] ?? "")
      // Strip single-line comments before splitting to avoid parsing
      // comment content as types.
      .replace(/\/\/[^\n]*/g, "")
      .split("|")
      .map((line) => line.trim().replace(/^'/, "").replace(/'$/, ""))
      .filter((type) => type.length > 0 && !type.includes("\n"));

    expect(clientEventTypes.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const eventType of clientEventTypes) {
      if (!serverSource.includes(`"${eventType}"`)) {
        missing.push(eventType);
      }
    }

    expect(missing).toEqual([]);
  });
});
