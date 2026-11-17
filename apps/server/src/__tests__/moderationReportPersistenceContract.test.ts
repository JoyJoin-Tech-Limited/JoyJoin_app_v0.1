import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import { reports } from "@shared/schema";

/**
 * The moderation queue shipped for months writing `admin_notes` / `resolved_at`
 * against a `reports` table that only has `resolution` / `reviewed_at` — every
 * PATCH returned 500, and `reportsRoute.test.ts` could not catch it because it
 * mocks drizzle and the schema wholesale.
 *
 * These locks keep the repository SQL aligned with the real table so the same
 * drift cannot silently return.
 */
const repoSource = readFileSync(new URL("../repositories/moderationRepo.ts", import.meta.url), "utf8");
const routeSource = readFileSync(
  new URL("../routes/domains/userEventPools.ts", import.meta.url),
  "utf8",
);

const updateBlocks = repoSource.match(/UPDATE reports[\s\S]*?RETURNING \*/g) ?? [];

describe("moderation report persistence contract", () => {
  it("has the columns the repository writes", () => {
    const columns = Object.keys(getTableColumns(reports));
    expect(columns).toEqual(
      expect.arrayContaining(["resolution", "reviewedAt", "reviewedBy", "reportedUserId"]),
    );
    expect(columns).not.toContain("adminNotes");
    expect(columns).not.toContain("resolvedAt");
  });

  it("updates reports using the live column names", () => {
    expect(updateBlocks.length).toBeGreaterThan(0);
    const updateSql = updateBlocks.join("\n");
    expect(updateSql).toMatch(/resolution\s*=/);
    expect(updateSql).toMatch(/reviewed_at\s*=/);
    expect(updateSql).toMatch(/reviewed_by\s*=/);
    expect(updateSql).not.toContain("admin_notes");
    expect(updateSql).not.toContain("resolved_at");
  });

  it("records the target user and originating report on moderation logs", () => {
    expect(repoSource).toContain("related_report_id");
    expect(repoSource).toContain("INSERT INTO moderation_logs");
  });

  it("keeps snake_case and camelCase moderation payloads working", () => {
    for (const token of [
      "target_user_id",
      "targetUserId",
      "related_report_id",
      "relatedReportId",
      "INVALID_MODERATION_ACTION",
      "MODERATION_TARGET_REQUIRED",
      "INVALID_REPORT_STATUS",
      "REPORT_NOT_FOUND",
    ]) {
      expect(routeSource).toContain(token);
    }
  });
});
