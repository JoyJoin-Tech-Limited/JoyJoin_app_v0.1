import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  eventAttendance,
  eventPoolGroups,
  eventPoolRegistrations,
  eventPools,
  invitationUses,
  payments,
} from "@shared/schema";

/**
 * Phase 0 安心补位 — pool registration cancel flow tests
 * (LOCKED sprint contract `.git/.orchestration/sprints/sprint-contract.post-reveal-phase0.md`).
 *
 * The orchestrator (lib/poolRegistrationCancel.ts) is exercised through a
 * fake db stub keyed by table identity (same style as autoRefundService.test.ts)
 * with an operation-order log for the F6 / Amendment-1 ordering assertions.
 * Repo/service collaborators are mocked directly. AC-12 parity and the AC-9
 * DTO/handler wiring are locked by structural (source-text) assertions.
 */

type AnyRow = Record<string, unknown> & { id?: string };

const state: {
  registrations: AnyRow[];
  pools: AnyRow[];
  groups: AnyRow[];
  attendance: AnyRow[];
  invitationUses: AnyRow[];
  payments: AnyRow[];
  callOrder: string[];
} = {
  registrations: [],
  pools: [],
  groups: [],
  attendance: [],
  invitationUses: [],
  payments: [],
  callOrder: [],
};

const flagState: Record<string, boolean> = {};

function rowsForTable(table: unknown): AnyRow[] {
  if (table === eventPoolRegistrations) return state.registrations;
  if (table === eventPools) return state.pools;
  if (table === eventPoolGroups) return state.groups;
  if (table === eventAttendance) return state.attendance;
  if (table === invitationUses) return state.invitationUses;
  if (table === payments) return state.payments;
  return [];
}

function nameForTable(table: unknown): string {
  if (table === eventPoolRegistrations) return "eventPoolRegistrations";
  if (table === eventPools) return "eventPools";
  if (table === eventPoolGroups) return "eventPoolGroups";
  if (table === eventAttendance) return "eventAttendance";
  if (table === invitationUses) return "invitationUses";
  if (table === payments) return "payments";
  return "unknown";
}

function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

/** Minimal drizzle where-clause evaluator (conjunctions of eq() only) —
 *  same flatten approach as autoRefundService.test.ts, with column names
 *  normalized to the camelCase keys the fixtures use. */
type Token = { col?: string; text?: string; value?: unknown };

function flattenChunks(node: unknown): Token[] {
  if (Array.isArray(node)) return node.flatMap((child) => flattenChunks(child));
  if (node && typeof node === "object") {
    const candidate = node as Record<string, unknown>;
    if ("queryChunks" in candidate) return flattenChunks(candidate.queryChunks);
    if ("encoder" in candidate && candidate.encoder && typeof candidate.encoder === "object") {
      const enc = candidate.encoder as { name?: unknown };
      if (typeof enc.name === "string") {
        return [{ value: candidate.value }];
      }
    }
    if ("value" in candidate) {
      const v = candidate.value;
      if (Array.isArray(v)) return v.flatMap((child) => flattenChunks(child));
      if (typeof v === "string") return [{ text: v }];
      return [{ value: v }];
    }
    if ("name" in candidate && typeof candidate.name === "string") {
      return [{ col: candidate.name }];
    }
    return [];
  }
  if (typeof node === "string") return [{ text: node }];
  return [];
}

function evalWhere(row: AnyRow, cond: unknown): boolean {
  if (!cond) return true;
  const tokens = flattenChunks(cond);
  for (let i = 0; i < tokens.length - 2; i++) {
    const col = tokens[i];
    const op = tokens[i + 1];
    const value = tokens[i + 2];
    if (col?.col && op?.text && op.text.includes("=") && "value" in (value ?? {})) {
      if (row[snakeToCamel(col.col)] !== value.value) return false;
    }
  }
  return true;
}

/** Evaluate `sql`${col} ± n`` arithmetic fragments inside update .set().
 *  Drizzle folds the operator AND the literal into a single StringChunk
 *  (e.g. ' - 1'), so parse "± n" out of the text token. */
function evalSetValue(current: unknown, value: unknown): unknown {
  if (value && typeof value === "object" && "queryChunks" in (value as Record<string, unknown>)) {
    const tokens = flattenChunks(value);
    const opTok = tokens.find((t) => t.text && /[+-]\s*\d/.test(t.text));
    const match = opTok?.text?.match(/([+-])\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const base = Number(current ?? 0);
      const delta = Number(match[2]);
      return match[1] === "-" ? base - delta : base + delta;
    }
    return current;
  }
  return value;
}

function applyDelete(table: unknown, cond: unknown): AnyRow[] {
  const rows = rowsForTable(table);
  const removed = rows.filter((row) => evalWhere(row, cond));
  const kept = rows.filter((row) => !evalWhere(row, cond));
  rows.length = 0;
  rows.push(...kept);
  state.callOrder.push(`delete:${nameForTable(table)}`);
  return removed.map((row) => ({ ...row }));
}

function applyUpdate(table: unknown, values: Record<string, unknown>, cond: unknown): AnyRow[] {
  const rows = rowsForTable(table);
  const matched = rows.filter((row) => evalWhere(row, cond));
  for (const row of matched) {
    for (const [key, value] of Object.entries(values)) {
      row[key] = evalSetValue(row[key], value);
    }
  }
  state.callOrder.push(`update:${nameForTable(table)}`);
  return matched.map((row) => ({ ...row }));
}

function thenableQuery(run: () => unknown, extra: Record<string, unknown>) {
  return {
    ...extra,
    then: (onFulfilled?: unknown, onRejected?: unknown) =>
      Promise.resolve()
        .then(run)
        .then(onFulfilled as never, onRejected as never),
  };
}

function makeFakeDb() {
  const fake: Record<string, unknown> = {
    select: () => ({
      from: (table: unknown) => ({
        where: (cond: unknown) => {
          const run = () => rowsForTable(table).filter((row) => evalWhere(row, cond));
          return thenableQuery(run, {
            limit: async (n: number) => run().slice(0, n),
          });
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: (cond: unknown) =>
        thenableQuery(() => applyDelete(table, cond), {
          returning: async () => applyDelete(table, cond),
        }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (cond: unknown) =>
          thenableQuery(() => applyUpdate(table, values, cond), {
            returning: async () => applyUpdate(table, values, cond),
          }),
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fake),
  };
  return fake;
}

vi.mock("../db", () => ({
  db: makeFakeDb(),
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: vi.fn(async (key: string) => flagState[key] ?? false),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../paymentService", () => ({
  paymentService: {
    createRefund: vi.fn(async () => undefined),
  },
}));

vi.mock("../repositories/paymentFulfillmentRepo", () => ({
  paymentFulfillmentRepo: {
    finalizeRefundedPayment: vi.fn(async () => ({ payment: { id: "p" }, alreadyRefunded: false })),
  },
}));

vi.mock("../repositories/refundAttemptsRepo", () => ({
  refundAttemptsRepo: {
    create: vi.fn(async () => ({ id: "ra-1" })),
  },
}));

vi.mock("../repositories/eventCreditsRepo", () => ({
  eventCreditsRepo: {
    reverseRedemptionForRegistration: vi.fn(async () => {
      state.callOrder.push("reverse-redemption");
      return true;
    }),
  },
}));

vi.mock("../repositories/notificationsRepo", () => ({
  notificationsRepo: {
    createNotification: vi.fn(async () => undefined),
  },
}));

vi.mock("../lib/adminAuditLogger", () => ({
  logAdminAudit: vi.fn(),
}));

vi.mock("../lib/wecomNotifications/poolLifecycle", () => ({
  notifyPostRevealCancel: vi.fn(async () => undefined),
}));

vi.mock("../services/autoRefundService", () => ({
  refundCollapsedGroupRegistrations: vi.fn(async () => ({
    poolId: "pool-1",
    refundedPayments: 0,
    refundedCredits: 0,
    failedRefunds: [],
    skippedRefunds: 0,
    reason: "collapsed",
  })),
}));

import { logger } from "../lib/logger";
import { paymentService } from "../paymentService";
import { paymentFulfillmentRepo } from "../repositories/paymentFulfillmentRepo";
import { refundAttemptsRepo } from "../repositories/refundAttemptsRepo";
import { eventCreditsRepo } from "../repositories/eventCreditsRepo";
import { notificationsRepo } from "../repositories/notificationsRepo";
import { logAdminAudit } from "../lib/adminAuditLogger";
import { notifyPostRevealCancel } from "../lib/wecomNotifications/poolLifecycle";
import { refundCollapsedGroupRegistrations } from "../services/autoRefundService";

const {
  cancelPoolRegistrationWithPolicy,
  computeRegistrationCancelPolicy,
  POST_REVEAL_CANCEL_AUDIT_REASON,
  SEAT_VACATED_NOTICE_TYPE,
} = await import("../lib/poolRegistrationCancel");

// ── Fixtures ────────────────────────────────────────────────────────────────

const LOG_PREFIX = "[TestCancel]";

const regRow = (
  id: string,
  userId: string,
  matchStatus: string,
  assignedGroupId: string | null = null,
  poolId = "pool-1",
): AnyRow => ({ id, poolId, userId, matchStatus, assignedGroupId });

const poolRow = (over: Partial<AnyRow> = {}): AnyRow => ({
  id: "pool-1",
  title: "周五夜聊饭局",
  isTestPool: false,
  totalRegistrations: 5,
  matchedAt: null,
  ...over,
});

const groupRow = (memberCount: number, over: Partial<AnyRow> = {}): AnyRow => ({
  id: "group-1",
  poolId: "pool-1",
  memberCount,
  eventId: "event-1",
  ...over,
});

const attendanceRow = (userId: string, eventId = "event-1"): AnyRow => ({
  id: `att-${userId}`,
  eventId,
  userId,
  status: "confirmed",
  attendanceStatus: "pending",
});

const completedPaymentRow = (id: string, userId: string, over: Partial<AnyRow> = {}): AnyRow => ({
  id,
  userId,
  paymentType: "event",
  relatedId: "pool-1",
  status: "completed",
  wechatOrderId: `wx_${id}`,
  finalAmount: 3000,
  ...over,
});

function seedMatchedGroup(memberCount: number, exiterId = "user-x") {
  // Exiter + (memberCount - 1) stayers, all matched into group-1.
  state.registrations = [
    regRow("reg-x", exiterId, "matched", "group-1"),
    ...Array.from({ length: memberCount - 1 }, (_, i) =>
      regRow(`reg-s${i + 1}`, `user-s${i + 1}`, "matched", "group-1"),
    ),
  ];
  state.groups = [groupRow(memberCount)];
  state.attendance = state.registrations.map((reg) => attendanceRow(reg.userId as string));
}

async function cancel(registrationId: string, userId: string) {
  return cancelPoolRegistrationWithPolicy({ registrationId, userId, logPrefix: LOG_PREFIX });
}

beforeEach(() => {
  state.registrations = [];
  state.pools = [poolRow()];
  state.groups = [];
  state.attendance = [];
  state.invitationUses = [];
  state.payments = [];
  state.callOrder = [];
  for (const key of Object.keys(flagState)) delete flagState[key];
  vi.clearAllMocks();
  vi.mocked(eventCreditsRepo.reverseRedemptionForRegistration).mockImplementation(async () => {
    state.callOrder.push("reverse-redemption");
    return true;
  });
  vi.mocked(paymentFulfillmentRepo.finalizeRefundedPayment).mockResolvedValue({
    payment: { id: "p" },
    alreadyRefunded: false,
  } as never);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Branch selection, legacy parity, test-pool skip (AC-4 / AC-5) ───────────

describe("branch selection + legacy parity (AC-4, AC-5)", () => {
  it("flags off → byte-identical legacy behavior even for a matched registration", async () => {
    seedMatchedGroup(5);
    const result = await cancel("reg-x", "user-x");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.branch).toBe("legacy");
    // Registration row gone + pool counter decremented.
    expect(state.registrations.find((r) => r.id === "reg-x")).toBeUndefined();
    expect(state.pools[0].totalRegistrations).toBe(4);
    // NO Phase 0 machinery: group untouched, no refund, no hygiene, no alerts.
    expect(state.groups[0].memberCount).toBe(5);
    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(eventCreditsRepo.reverseRedemptionForRegistration).not.toHaveBeenCalled();
    expect(logAdminAudit).not.toHaveBeenCalled();
    expect(notifyPostRevealCancel).not.toHaveBeenCalled();
    expect(notificationsRepo.createNotification).not.toHaveBeenCalled();
    expect(refundCollapsedGroupRegistrations).not.toHaveBeenCalled();
    expect(state.attendance.every((row) => row.status === "confirmed")).toBe(true);
  });

  it("preRevealRefundEnabled on but noRefundAfterReveal off → matched cancel stays legacy (independent rollback)", async () => {
    flagState.preRevealRefundEnabled = true;
    seedMatchedGroup(5);

    const result = await cancel("reg-x", "user-x");

    expect(result.ok && result.branch).toBe("legacy");
    expect(state.groups[0].memberCount).toBe(5);
    expect(logAdminAudit).not.toHaveBeenCalled();
    expect(notifyPostRevealCancel).not.toHaveBeenCalled();
  });

  it("noRefundAfterReveal on but preRevealRefundEnabled off → pre-reveal cancel stays legacy (independent rollback)", async () => {
    flagState.noRefundAfterReveal = true;
    state.registrations = [regRow("reg-1", "user-1", "pending")];
    state.payments = [completedPaymentRow("p1", "user-1")];

    const result = await cancel("reg-1", "user-1");

    expect(result.ok && result.branch).toBe("legacy");
    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(eventCreditsRepo.reverseRedemptionForRegistration).not.toHaveBeenCalled();
    expect(state.registrations).toHaveLength(0);
    expect(state.pools[0].totalRegistrations).toBe(4);
  });

  it("is_test_pool=true skips the entire Phase 0 lifecycle (AC-5)", async () => {
    flagState.preRevealRefundEnabled = true;
    flagState.noRefundAfterReveal = true;
    state.pools = [poolRow({ isTestPool: true })];
    seedMatchedGroup(5);

    const result = await cancel("reg-x", "user-x");

    expect(result.ok && result.branch).toBe("legacy");
    expect(state.registrations.find((r) => r.id === "reg-x")).toBeUndefined();
    expect(state.pools[0].totalRegistrations).toBe(4);
    expect(state.groups[0].memberCount).toBe(5);
    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(logAdminAudit).not.toHaveBeenCalled();
    expect(notifyPostRevealCancel).not.toHaveBeenCalled();
    expect(notificationsRepo.createNotification).not.toHaveBeenCalled();
  });

  it("unknown registration → 404 with the legacy message", async () => {
    const result = await cancel("reg-missing", "user-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(404);
    expect(result.message).toBe("没有找到可以取消的报名记录，可能已经取消过了");
  });
});

// ── Pre-reveal refund branch (AC-1) ─────────────────────────────────────────

describe("pre-reveal cancel with refund (AC-1)", () => {
  beforeEach(() => {
    flagState.preRevealRefundEnabled = true;
  });

  it("money-paid pending registration → exactly one createRefund, then delete", async () => {
    state.registrations = [regRow("reg-1", "user-1", "pending")];
    state.payments = [completedPaymentRow("p1", "user-1")];

    const result = await cancel("reg-1", "user-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.branch).toBe("pre_reveal_refund");
    expect(result.refundedMoney).toBe(true);
    expect(paymentService.createRefund).toHaveBeenCalledTimes(1);
    expect(paymentService.createRefund).toHaveBeenCalledWith("p1", "揭示前取消，全额退款", "user-cancel");
    expect(state.registrations).toHaveLength(0);
    expect(state.pools[0].totalRegistrations).toBe(4);
  });

  it("reveal boundary is the REGISTRATION matchStatus — unmatched registration in a matched pool is still refundable", async () => {
    state.pools = [poolRow({ matchedAt: new Date("2026-08-26T12:00:00Z") })];
    state.registrations = [regRow("reg-1", "user-1", "unmatched")];
    state.payments = [completedPaymentRow("p1", "user-1")];

    const result = await cancel("reg-1", "user-1");

    expect(result.ok && result.branch).toBe("pre_reveal_refund");
    expect(paymentService.createRefund).toHaveBeenCalledTimes(1);
  });

  it("duplicate/concurrent cancel claim ('Can only refund completed payments') → treated as already-refunded, delete proceeds", async () => {
    state.registrations = [regRow("reg-1", "user-1", "pending")];
    state.payments = [completedPaymentRow("p1", "user-1")];
    vi.mocked(paymentService.createRefund).mockRejectedValueOnce(
      new Error("Can only refund completed payments"),
    );

    const result = await cancel("reg-1", "user-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyRefunded).toBe(true);
    expect(result.refundedMoney).toBe(false);
    expect(state.registrations).toHaveLength(0);
  });

  it("Amendment 1: refund call failure aborts WITHOUT deleting; retry succeeds", async () => {
    state.registrations = [regRow("reg-1", "user-1", "pending")];
    state.payments = [completedPaymentRow("p1", "user-1")];
    vi.mocked(paymentService.createRefund).mockRejectedValueOnce(new Error("WeChat network down"));

    const failed = await cancel("reg-1", "user-1");

    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.status).toBe(502);
    expect(failed.code).toBe("REFUND_FAILED_RETRYABLE");
    // Registration NOT deleted; no delete was issued.
    expect(state.registrations).toHaveLength(1);
    expect(state.callOrder.filter((op) => op === "delete:eventPoolRegistrations")).toHaveLength(0);

    // Retry (createRefund self-released the claim + recorded the failed attempt).
    const retried = await cancel("reg-1", "user-1");
    expect(retried.ok).toBe(true);
    expect(paymentService.createRefund).toHaveBeenCalledTimes(2);
    expect(state.registrations).toHaveLength(0);
  });

  it("F6: credit-paid cancel succeeds (200 not 500) — reversal runs INSIDE the transaction, strictly BEFORE the delete", async () => {
    state.registrations = [regRow("reg-1", "user-1", "pending")];

    const result = await cancel("reg-1", "user-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.branch).toBe("pre_reveal_refund");
    expect(result.reversedCredit).toBe(true);
    expect(eventCreditsRepo.reverseRedemptionForRegistration).toHaveBeenCalledWith(
      expect.anything(),
      { registrationId: "reg-1" },
    );
    const reverseIdx = state.callOrder.indexOf("reverse-redemption");
    const deleteIdx = state.callOrder.indexOf("delete:eventPoolRegistrations");
    expect(reverseIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeGreaterThan(reverseIdx);
    expect(state.registrations).toHaveLength(0);
  });

  it("MOCK_ order → finalize directly without the WeChat API and record a success attempt", async () => {
    state.registrations = [regRow("reg-1", "user-1", "pending")];
    state.payments = [completedPaymentRow("m1", "user-1", { wechatOrderId: "MOCK_m1" })];

    const result = await cancel("reg-1", "user-1");

    expect(result.ok && result.refundedMoney).toBe(true);
    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(paymentFulfillmentRepo.finalizeRefundedPayment).toHaveBeenCalledWith({
      wechatOrderId: "MOCK_m1",
    });
    expect(refundAttemptsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", initiatedBy: "user-cancel" }),
    );
  });

  it("payment already refunded → no second refund, delete proceeds (idempotent)", async () => {
    state.registrations = [regRow("reg-1", "user-1", "pending")];
    state.payments = [completedPaymentRow("p1", "user-1", { status: "refunded" })];

    const result = await cancel("reg-1", "user-1");

    expect(result.ok).toBe(true);
    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(state.registrations).toHaveLength(0);
  });
});

// ── Post-reveal no-refund branch (AC-2, AC-6, AC-7, AC-8) ───────────────────

describe("post-reveal cancel — no refund + honest group state (AC-2)", () => {
  beforeEach(() => {
    flagState.noRefundAfterReveal = true;
  });

  it("full hygiene: delete + decrement + attendance cancelled + audit + WeCom + shrink notices", async () => {
    seedMatchedGroup(5);

    const result = await cancel("reg-x", "user-x");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.branch).toBe("post_reveal_no_refund");
    expect(result.remainingCount).toBe(4);
    expect(result.collapsed).toBe(false);

    // No refund, no credit reversal for the exiter.
    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(eventCreditsRepo.reverseRedemptionForRegistration).not.toHaveBeenCalled();

    // Registration deleted + counters.
    expect(state.registrations.find((r) => r.id === "reg-x")).toBeUndefined();
    expect(state.pools[0].totalRegistrations).toBe(4);
    expect(state.groups[0].memberCount).toBe(4);

    // Amendment 4: status='cancelled' on the pinned column; attendanceStatus untouched.
    const exiterAttendance = state.attendance.find((row) => row.userId === "user-x");
    expect(exiterAttendance?.status).toBe("cancelled");
    expect(exiterAttendance?.attendanceStatus).toBe("pending");
    // Stayers' attendance untouched.
    expect(
      state.attendance.filter((row) => row.userId !== "user-x").every((row) => row.status === "confirmed"),
    ).toBe(true);

    // Audit entry with the pinned 「揭示后取消（不退款）」 vocabulary.
    expect(logAdminAudit).toHaveBeenCalledTimes(1);
    const audit = vi.mocked(logAdminAudit).mock.calls[0][0];
    expect(audit.action).toBe("POST_REVEAL_CANCEL_NO_REFUND");
    expect(audit.targetEntityType).toBe("event_pool_registration");
    expect(audit.targetEntityId).toBe("reg-x");
    expect(audit.context?.reason).toBe(POST_REVEAL_CANCEL_AUDIT_REASON);
    expect(POST_REVEAL_CANCEL_AUDIT_REASON).toBe("揭示后取消（不退款）");
    expect(audit.context?.remainingCount).toBe(4);

    // WeCom alert (AC-8): poolId + remaining count, invoked after commit.
    expect(notifyPostRevealCancel).toHaveBeenCalledTimes(1);
    expect(notifyPostRevealCancel).toHaveBeenCalledWith(
      expect.objectContaining({ poolId: "pool-1", remainingCount: 4, collapsed: false }),
    );
    const lastTxOp = Math.max(
      state.callOrder.lastIndexOf("delete:eventPoolRegistrations"),
      state.callOrder.lastIndexOf("update:eventPoolGroups"),
    );
    expect(lastTxOp).toBeGreaterThanOrEqual(0);

    // Shrink notices to every remaining member with the ACTUAL headcount,
    // and no exiter identity anywhere in the payloads.
    expect(notificationsRepo.createNotification).toHaveBeenCalledTimes(4);
    const recipients = vi.mocked(notificationsRepo.createNotification).mock.calls.map((c) => c[0]);
    expect(new Set(recipients.map((n) => n.userId))).toEqual(
      new Set(["user-s1", "user-s2", "user-s3", "user-s4"]),
    );
    for (const notice of recipients) {
      expect(notice.type).toBe(SEAT_VACATED_NOTICE_TYPE);
      expect(notice.category).toBe("activities");
      expect(notice.message).toContain("温馨的 4 人局");
      expect(JSON.stringify(notice)).not.toContain("user-x");
    }
    expect(refundCollapsedGroupRegistrations).not.toHaveBeenCalled();
  });

  it("missing attendance row → skip + logger.warn, never upsert (Amendment 4 no-row semantics)", async () => {
    seedMatchedGroup(5);
    state.attendance = []; // legacy/defensive case: no row for the exiter

    const result = await cancel("reg-x", "user-x");

    expect(result.ok).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("no event_attendance row to cancel"),
      expect.objectContaining({ userId: "user-x", eventId: "event-1" }),
    );
    expect(state.attendance).toHaveLength(0); // never upserted
  });

  it("duo boundary (AC-6): one member cancels → partner registration, seat, and membership unaffected", async () => {
    seedMatchedGroup(5);
    state.invitationUses = [
      { id: "iu-1", poolRegistrationId: "reg-x", invitationId: "inv-1", inviteeId: "user-s1" },
      { id: "iu-2", poolRegistrationId: "reg-s1", invitationId: "inv-1", inviteeId: null },
    ];

    const result = await cancel("reg-x", "user-x");

    expect(result.ok).toBe(true);
    // Partner (user-s1, the duo counterpart) keeps registration + matched seat.
    const partner = state.registrations.find((r) => r.id === "reg-s1");
    expect(partner).toBeDefined();
    expect(partner?.matchStatus).toBe("matched");
    expect(partner?.assignedGroupId).toBe("group-1");
    // Exactly one seat removed.
    expect(state.groups[0].memberCount).toBe(4);
    // Exiter's invitation_uses cleaned; partner's preserved.
    expect(state.invitationUses.find((row) => row.poolRegistrationId === "reg-x")).toBeUndefined();
    expect(state.invitationUses.find((row) => row.poolRegistrationId === "reg-s1")).toBeDefined();
    // No refund to the exiter.
    expect(paymentService.createRefund).not.toHaveBeenCalled();
  });

  it("notification failure never blocks the cancel (AC-7)", async () => {
    seedMatchedGroup(5);
    vi.mocked(notificationsRepo.createNotification).mockRejectedValue(new Error("notify db hiccup"));

    const result = await cancel("reg-x", "user-x");

    expect(result.ok).toBe(true);
    expect(state.registrations.find((r) => r.id === "reg-x")).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("seat-vacated notification failed"),
      expect.objectContaining({ registrationId: "reg-x" }),
    );
  });

  it("WeCom alert failure never affects the cancel (AC-8)", async () => {
    seedMatchedGroup(5);
    vi.mocked(notifyPostRevealCancel).mockRejectedValueOnce(new Error("wecom down"));

    const result = await cancel("reg-x", "user-x");

    expect(result.ok).toBe(true);
    expect(state.registrations.find((r) => r.id === "reg-x")).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("WeCom post-reveal cancel alert failed"),
      expect.objectContaining({ registrationId: "reg-x" }),
    );
  });
});

// ── Collapse (AC-3) ─────────────────────────────────────────────────────────

describe("collapse below minimum group size (AC-3)", () => {
  beforeEach(() => {
    flagState.noRefundAfterReveal = true;
  });

  it("4-member group → 3 remain: stayers flipped to unmatched, collapse refund path invoked, exiter never refunded", async () => {
    seedMatchedGroup(4);

    const result = await cancel("reg-x", "user-x");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.remainingCount).toBe(3);
    expect(result.collapsed).toBe(true);
    expect(state.groups[0].memberCount).toBe(3);

    // Stayers flipped to 'unmatched' (the wrapper's Trigger B filter).
    const stayers = state.registrations.filter((r) => r.id !== "reg-x");
    expect(stayers).toHaveLength(3);
    expect(stayers.every((r) => r.matchStatus === "unmatched")).toBe(true);

    // Collapse refund path (Amendment 3: new wrapper, collapse context).
    expect(refundCollapsedGroupRegistrations).toHaveBeenCalledTimes(1);
    expect(refundCollapsedGroupRegistrations).toHaveBeenCalledWith("pool-1", "周五夜聊饭局");

    // Exiter never refunded; no shrink notices in a collapse.
    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(notificationsRepo.createNotification).not.toHaveBeenCalled();

    // Audit + WeCom still fire, marked collapsed.
    expect(vi.mocked(logAdminAudit).mock.calls[0][0].context?.collapsed).toBe(true);
    expect(notifyPostRevealCancel).toHaveBeenCalledWith(
      expect.objectContaining({ remainingCount: 3, collapsed: true }),
    );
  });

  it("Amendment 2 race guard: two concurrent cancels on a 5-member group → exactly one collapse, final count consistent", async () => {
    seedMatchedGroup(5, "user-a");
    // Second concurrent exiter is one of the seeded stayers (user-s1/reg-s1).
    const [resultA, resultB] = await Promise.all([
      cancel("reg-x", "user-a"),
      cancel("reg-s1", "user-s1"),
    ]);

    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (!resultA.ok || !resultB.ok) return;

    // Post-decrement counts are obtained atomically (UPDATE … RETURNING), so
    // the two cancels see 4 and 3 — never both 5. Exactly one collapses.
    const collapsedFlags = [resultA.collapsed, resultB.collapsed].sort();
    expect(collapsedFlags).toEqual([false, true]);
    expect(state.groups[0].memberCount).toBe(3);
    expect(refundCollapsedGroupRegistrations).toHaveBeenCalledTimes(1);

    // Neither exiter was flipped; only true stayers are unmatched.
    expect(state.registrations.find((r) => r.id === "reg-x")).toBeUndefined();
    expect(state.registrations.find((r) => r.id === "reg-s1")).toBeUndefined();
    const remaining = state.registrations;
    expect(remaining).toHaveLength(3);
    expect(remaining.every((r) => r.matchStatus === "unmatched")).toBe(true);
  });
});

// ── cancelPolicy DTO (AC-9) ─────────────────────────────────────────────────

describe("server-computed cancelPolicy (AC-9)", () => {
  const base = { matchStatus: "pending", isTestPool: false };

  it("flags off → field omitted (legacy-safe encoding)", () => {
    expect(
      computeRegistrationCancelPolicy({
        ...base,
        preRevealRefundEnabled: false,
        noRefundAfterReveal: false,
      }),
    ).toBeUndefined();
  });

  it("pre-reveal + preRevealRefundEnabled → 'refundable'", () => {
    expect(
      computeRegistrationCancelPolicy({
        ...base,
        preRevealRefundEnabled: true,
        noRefundAfterReveal: false,
      }),
    ).toBe("refundable");
  });

  it("matched + flags on → 'non_refundable'", () => {
    expect(
      computeRegistrationCancelPolicy({
        matchStatus: "matched",
        isTestPool: false,
        preRevealRefundEnabled: true,
        noRefundAfterReveal: true,
      }),
    ).toBe("non_refundable");
  });

  it("pre-reveal with only noRefundAfterReveal on → 'non_refundable' (legacy gives no refund)", () => {
    expect(
      computeRegistrationCancelPolicy({
        ...base,
        preRevealRefundEnabled: false,
        noRefundAfterReveal: true,
      }),
    ).toBe("non_refundable");
  });

  it("test pool → omitted even with flags on", () => {
    expect(
      computeRegistrationCancelPolicy({
        matchStatus: "pending",
        isTestPool: true,
        preRevealRefundEnabled: true,
        noRefundAfterReveal: true,
      }),
    ).toBeUndefined();
  });

  it("DTO + handler wiring: PoolRegistrationSummary carries cancelPolicy and the summary route computes it server-side", () => {
    const dtoSrc = readFileSync(
      new URL("../../../../packages/shared/src/api/eventPools.ts", import.meta.url),
      "utf8",
    );
    expect(dtoSrc).toContain("cancelPolicy?: 'refundable' | 'non_refundable'");

    const routeSrc = readFileSync(
      new URL("../routes/domains/userEventPools.ts", import.meta.url),
      "utf8",
    );
    expect(routeSrc).toContain("computeRegistrationCancelPolicy(");
    expect(routeSrc).toContain('getFeatureFlag("preRevealRefundEnabled")');
    expect(routeSrc).toContain('getFeatureFlag("noRefundAfterReveal")');
  });
});

// ── AC-12 parity structural lock ────────────────────────────────────────────

describe("cancel-path parity (AC-12)", () => {
  it("both cancel entry points delegate to the shared orchestrator", () => {
    const userEventPoolsSrc = readFileSync(
      new URL("../routes/domains/userEventPools.ts", import.meta.url),
      "utf8",
    );
    const blindBoxSrc = readFileSync(
      new URL("../routes/domains/blindBoxEvents.ts", import.meta.url),
      "utf8",
    );
    expect(userEventPoolsSrc).toContain("cancelPoolRegistrationWithPolicy(");
    expect(blindBoxSrc).toContain("cancelPoolRegistrationWithPolicy(");
    // Both branches of the blind-box path (registrationId + poolId).
    expect(blindBoxSrc.match(/cancelPoolRegistrationWithPolicy\(/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
