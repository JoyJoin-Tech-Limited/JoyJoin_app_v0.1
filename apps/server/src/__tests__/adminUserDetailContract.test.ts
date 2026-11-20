import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("admin user detail contract", () => {
  it("separates RSVP from check-in on joined events", () => {
    const repoSource = readRepoFile("apps/server/src/repositories/legacyStorageRepo.ts");

    // Regression guard for the drawer reporting 已签到 from the RSVP column.
    // `event_attendance.status` is the signup lifecycle; only
    // `attendance_status` proves the user actually showed up.
    expect(repoSource).toContain("rsvpStatus: eventAttendance.status");
    expect(repoSource).toContain("attendanceStatus: eventAttendance.attendanceStatus");
    expect(repoSource).toContain("eventAttendance.attendanceStatus} IN ('confirmed', 'late')");
    expect(repoSource).toContain("inArray(eventAttendance.attendanceStatus, ['confirmed', 'late'])");
  });

  it("counts attendance and revenue on their own predicates", () => {
    const metricsSource = readRepoFile("apps/server/src/lib/adminMetrics.ts");

    // The commercial snapshot must not borrow the RSVP column, and revenue is
    // completed payments only (refunds excluded by status).
    expect(metricsSource).toContain("ea.attendance_status IN ('confirmed', 'late')");
    expect(metricsSource).toContain("COUNT(DISTINCT COALESCE(ea.event_id, ea.blind_box_event_id, ea.id))");
    expect(metricsSource).toContain("AND status = 'completed'");
    expect(metricsSource).toContain("FROM event_pool_registrations");
    expect(metricsSource).toContain("AND match_status = 'matched'");
  });

  it("resolves match-history partners through the canonical name columns", () => {
    const routeSource = readRepoFile("apps/server/src/routes/domains/adminUsers.ts");

    // display_name is the chosen name; wechat_nickname is the fallback. A raw
    // UUID must never be the partner label when a name exists.
    expect(routeSource).toContain(
      "partnerName: sql<string | null>`COALESCE(${users.displayName}, ${users.wechatNickname})`",
    );
  });
});
