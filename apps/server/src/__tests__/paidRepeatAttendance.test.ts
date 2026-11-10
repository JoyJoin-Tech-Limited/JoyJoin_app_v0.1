/**
 * Canonical 30-day paid repeat-attendance contract.
 *
 * D0 is the first ELIGIBLE paid attendance's Asia/Shanghai event-start
 * calendar day. Another eligible paid attendance is a repeat only on D1–D30
 * inclusive. Entitlement/credit attendance qualifies without a second event
 * payment. Staff, bots, test pools/sessions, refunded and unattended/no-show
 * rows are excluded. Second-payment SQL is intentionally NOT this metric.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockExecute = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({
  db: { execute: mockExecute },
}));

import {
  PAID_REPEAT_ATTENDANCE_SQL_DEFINITION,
  getPaidAttendanceExclusion,
  getPaidRepeatAttendanceMetric,
  getRepeatAttendanceDayOffset,
  isEligiblePaidAttendance,
  summarizePaidRepeatAttendance,
  toShanghaiCalendarDay,
  type PaidAttendanceFact,
} from "../lib/paidRepeatAttendance";

beforeAll(() => {
  // Deliberate reviewer-facing output: the test run prints the exact metric
  // contract, not a production value or an uplift claim.
  console.info(`\n${PAID_REPEAT_ATTENDANCE_SQL_DEFINITION}\n`);
});

function atShanghai(day: string, hour = 12): string {
  return `${day}T${String(hour).padStart(2, "0")}:00:00+08:00`;
}

function fact(overrides: Partial<PaidAttendanceFact> = {}): PaidAttendanceFact {
  return {
    attendanceId: "attendance-1",
    userId: "user-1",
    eventStartAt: atShanghai("2026-01-01"),
    accessKind: "single_event_payment",
    paymentState: "completed",
    // Default fixture is an arrived attendee: the event lifecycle says attended.
    // A self-reported RSVP (`lifecycleStatus: "confirmed"`) is explicitly not
    // attendance — see the dedicated case below.
    attendanceStatus: "confirmed",
    lifecycleStatus: "attended",
    isStaff: false,
    isBot: false,
    isTestPool: false,
    isTestSession: false,
    ...overrides,
  };
}

describe("Asia/Shanghai event-start calendar-day boundaries", () => {
  it("uses the Shanghai event day rather than the UTC day or server timezone", () => {
    expect(toShanghaiCalendarDay("2025-12-31T16:30:00.000Z")).toBe("2026-01-01");
    expect(toShanghaiCalendarDay("2026-01-01T15:59:59.999Z")).toBe("2026-01-01");
    expect(toShanghaiCalendarDay("2026-01-01T16:00:00.000Z")).toBe("2026-01-02");
  });

  it("does not count another attendance on D0 as a repeat", () => {
    expect(getRepeatAttendanceDayOffset(
      atShanghai("2026-01-01", 8),
      atShanghai("2026-01-01", 23),
    )).toBeNull();
  });

  it("counts D1 and D30, but excludes D31 and earlier days", () => {
    const anchor = atShanghai("2026-01-01");
    expect(getRepeatAttendanceDayOffset(anchor, atShanghai("2026-01-02"))).toBe(1);
    expect(getRepeatAttendanceDayOffset(anchor, atShanghai("2026-01-31"))).toBe(30);
    expect(getRepeatAttendanceDayOffset(anchor, atShanghai("2026-02-01"))).toBeNull();
    expect(getRepeatAttendanceDayOffset(anchor, atShanghai("2025-12-31"))).toBeNull();
  });

  it("handles month boundaries by calendar day, not a rolling 720-hour window", () => {
    const anchor = atShanghai("2026-01-31", 23);
    expect(getRepeatAttendanceDayOffset(anchor, atShanghai("2026-02-01", 0))).toBe(1);
    expect(getRepeatAttendanceDayOffset(anchor, atShanghai("2026-03-02", 0))).toBe(30);
    expect(getRepeatAttendanceDayOffset(anchor, atShanghai("2026-03-03", 0))).toBeNull();
  });
});

describe("eligible paid-attendance classification", () => {
  it.each([
    "single_event_payment",
    "subscription_entitlement",
    "event_credit_redemption",
  ] as const)("includes %s with a completed, non-refunded purchase", (accessKind) => {
    const candidate = fact({ accessKind });
    expect(getPaidAttendanceExclusion(candidate)).toBeNull();
    expect(isEligiblePaidAttendance(candidate)).toBe(true);
  });

  it("includes a lifecycle attended row even if its separate intent column is pending", () => {
    expect(isEligiblePaidAttendance(fact({
      lifecycleStatus: "attended",
      attendanceStatus: "pending",
    }))).toBe(true);
  });

  it.each([
    ["staff", { isStaff: true }, "staff"],
    ["bot", { isBot: true }, "bot"],
    ["test pool", { isTestPool: true }, "test_pool"],
    ["test session", { isTestSession: true }, "test_session"],
    ["refunded purchase", { paymentState: "refunded" }, "refunded"],
    ["pending payment", { paymentState: "pending" }, "not_paid"],
    ["failed payment", { paymentState: "failed" }, "not_paid"],
    ["refund-pending payment", { paymentState: "refund_pending" }, "not_paid"],
    ["free/unpaid access", { accessKind: "free_or_unpaid" }, "not_paid"],
    ["ops-marked no-show", { attendanceStatus: "absent" }, "unattended"],
    ["unattended/pending intent", { attendanceStatus: "pending", lifecycleStatus: null }, "unattended"],
    ["cancelled attendance", { lifecycleStatus: "cancelled" }, "unattended"],
    [
      "self-reported RSVP without an arrival fact",
      { attendanceStatus: "confirmed", lifecycleStatus: "confirmed" },
      "unattended",
    ],
  ] as const)("excludes %s", (_label, overrides, reason) => {
    const candidate = fact(overrides);
    expect(getPaidAttendanceExclusion(candidate)).toBe(reason);
    expect(isEligiblePaidAttendance(candidate)).toBe(false);
  });

  it("treats a self-reported RSVP as intent, not attendance", () => {
    // The KPI must not be inflated by people who merely said they would come:
    // only operator/check-in written arrival (`attended`) or `late` counts.
    const rsvpOnly = fact({ attendanceStatus: "confirmed", lifecycleStatus: "confirmed" });
    expect(isEligiblePaidAttendance(rsvpOnly)).toBe(false);
    expect(isEligiblePaidAttendance({ ...rsvpOnly, lifecycleStatus: "attended" })).toBe(true);
  });
});

describe("participant-level D0 cohort and repeat classification", () => {
  it("computes D0 same-day=no, D1=yes, D30=yes, D31=no across participants", () => {
    const specs = [
      { userId: "same-day", repeatDay: "2026-01-01", expected: false },
      { userId: "d1", repeatDay: "2026-01-02", expected: true },
      { userId: "d30", repeatDay: "2026-01-31", expected: true },
      { userId: "d31", repeatDay: "2026-02-01", expected: false },
    ];
    const facts = specs.flatMap(({ userId, repeatDay }) => [
      fact({ attendanceId: `${userId}-anchor`, userId, eventStartAt: atShanghai("2026-01-01") }),
      fact({ attendanceId: `${userId}-candidate`, userId, eventStartAt: atShanghai(repeatDay) }),
    ]);

    const result = summarizePaidRepeatAttendance(facts, {
      cohortStartDay: "2026-01-01",
      cohortEndDay: "2026-01-01",
    });

    expect(result.eligibleParticipants).toBe(4);
    expect(result.repeatParticipants).toBe(2);
    expect(result.rate).toBe(0.5);
    for (const spec of specs) {
      expect(result.participants.find((p) => p.userId === spec.userId)?.hasRepeat).toBe(spec.expected);
    }
  });

  it("counts a credit repeat with the same underlying pack purchase and no second event payment", () => {
    const result = summarizePaidRepeatAttendance([
      fact({
        attendanceId: "credit-anchor",
        accessKind: "event_credit_redemption",
        paymentId: "one-pack-purchase",
      }),
      fact({
        attendanceId: "credit-repeat",
        eventStartAt: atShanghai("2026-01-15"),
        accessKind: "event_credit_redemption",
        paymentId: "one-pack-purchase",
      }),
    ], {
      cohortStartDay: "2026-01-01",
      cohortEndDay: "2026-01-01",
    });

    expect(result).toMatchObject({
      eligibleParticipants: 1,
      repeatParticipants: 1,
      rate: 1,
    });
    expect(result.participants[0]).toMatchObject({
      anchorDay: "2026-01-01",
      firstRepeatDay: "2026-01-15",
      hasRepeat: true,
    });
  });

  it("anchors to the first ELIGIBLE attendance, ignoring earlier excluded rows", () => {
    const result = summarizePaidRepeatAttendance([
      fact({ attendanceId: "earlier-refund", eventStartAt: atShanghai("2025-12-01"), paymentState: "refunded" }),
      fact({ attendanceId: "eligible-anchor", eventStartAt: atShanghai("2026-01-10") }),
      fact({
        attendanceId: "eligible-subscription-repeat",
        eventStartAt: atShanghai("2026-02-09"),
        accessKind: "subscription_entitlement",
      }),
    ], {
      cohortStartDay: "2026-01-01",
      cohortEndDay: "2026-01-31",
    });

    expect(result.participants[0]).toMatchObject({
      anchorDay: "2026-01-10",
      firstRepeatDay: "2026-02-09",
      hasRepeat: true,
    });
  });

  it("excludes participants whose first eligible D0 predates the cohort window", () => {
    const result = summarizePaidRepeatAttendance([
      fact({ attendanceId: "old-anchor", eventStartAt: atShanghai("2025-12-15") }),
      fact({ attendanceId: "cohort-repeat", eventStartAt: atShanghai("2026-01-05") }),
    ], {
      cohortStartDay: "2026-01-01",
      cohortEndDay: "2026-01-31",
    });

    expect(result).toMatchObject({
      eligibleParticipants: 0,
      repeatParticipants: 0,
      rate: null,
      participants: [],
    });
  });
});

describe("single bounded aggregate SQL helper", () => {
  const params = {
    historyStartDay: "2020-01-01",
    cohortStartDay: "2026-01-01",
    cohortEndDay: "2026-01-31",
    asOfDay: "2026-03-15",
  };

  beforeEach(() => {
    mockExecute.mockReset();
  });

  it("executes exactly one aggregate query (no per-user loop/N+1) and maps its participant-level rate", async () => {
    mockExecute.mockResolvedValue({
      rows: [{ eligible_participants: "2", repeat_participants: "1", rate: "0.5" }],
    });

    const result = await getPaidRepeatAttendanceMetric(params);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ...params,
      eligibleParticipants: 2,
      repeatParticipants: 1,
      rate: 0.5,
    });
  });

  it("keeps attendance, all paid access paths, exclusions and D1–D30 in the canonical SQL", async () => {
    mockExecute.mockResolvedValue({
      rows: [{ eligible_participants: 0, repeat_participants: 0, rate: null }],
    });

    await getPaidRepeatAttendanceMetric(params);
    const query = mockExecute.mock.calls[0]?.[0] as { queryChunks?: unknown[] };
    const statement = renderSql(query);

    for (const required of [
      "WITH attendance_candidates AS",
      "FROM event_attendance ea",
      "event_pool_registrations",
      "event_pool_groups",
      "blind_box_events",
      "payments",
      "direct_payment.related_id = c.event_id",
      "direct_payment.related_id = c.blind_box_event_id",
      "event_credit_redemptions",
      "event_credit_grants",
      "subscriptions",
      "social_icebreaker_sessions",
      "social_icebreaker_participants",
      "Asia/Shanghai",
      "is_test_pool",
      "is_test_bot",
      "is_admin",
      "attendance_status IN ('confirmed', 'late')",
      "attendance_status = 'absent'",
      "payment_type = 'event'",
      "status = 'completed'",
      "start_date <= c.registered_at",
      "end_date > c.registered_at",
      "e.event_day > a.d0",
      "e.event_day <= a.d0 + 30",
    ]) {
      expect(statement).toContain(required);
    }
    expect(statement).not.toContain("SELECT *");
  });

  it("returns a null rate for an empty cohort rather than fabricating 0%", async () => {
    mockExecute.mockResolvedValue({
      rows: [{ eligible_participants: 0, repeat_participants: 0, rate: null }],
    });

    const result = await getPaidRepeatAttendanceMetric(params);
    expect(result.rate).toBeNull();
    expect(result.eligibleParticipants).toBe(0);
  });

  it("rejects an immature cohort before querying instead of treating right-censored users as non-repeaters", async () => {
    await expect(getPaidRepeatAttendanceMetric({
      ...params,
      asOfDay: "2026-02-15",
    })).rejects.toThrow("30-day observation");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("rejects a history start after the cohort start, which would falsify first-ever D0", async () => {
    await expect(getPaidRepeatAttendanceMetric({
      ...params,
      historyStartDay: "2026-02-01",
    })).rejects.toThrow("historyStartDay");
    expect(mockExecute).not.toHaveBeenCalled();
  });
});

function renderSql(query: unknown): string {
  if (typeof query === "string") return query;
  if (Array.isArray(query)) return query.map(renderSql).join("");
  if (!query || typeof query !== "object") return "";
  if ((query as object).constructor === String) return String(query);
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks;
  if (chunks) return renderSql(chunks);
  const value = (query as { value?: unknown }).value;
  return Array.isArray(value) || typeof value === "string" ? renderSql(value) : "";
}
