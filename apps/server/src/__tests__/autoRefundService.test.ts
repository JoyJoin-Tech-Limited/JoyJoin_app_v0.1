import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventCreditRedemptions, eventPoolRegistrations, payments } from "@shared/schema";

/**
 * Auto-refund pipeline tests (sprint auto-refund-pipeline-20260805).
 * The service queries via a fake db stub keyed by table identity; repo
 * collaborators are mocked directly. Tests cover triggers A (cancellation)
 * and B (unmatched), mock-mode, idempotency, failure isolation, and the
 * kill switch.
 */

type AnyRow = Record<string, unknown> & { id?: string };

const state: { payments: AnyRow[]; redemptions: AnyRow[]; registrations: AnyRow[] } = {
  payments: [],
  redemptions: [],
  registrations: [],
};

function rowsForTable(table: unknown): AnyRow[] {
  if (table === payments) return state.payments;
  if (table === eventCreditRedemptions) return state.redemptions;
  if (table === eventPoolRegistrations) return state.registrations;
  return [];
}

/** Minimal drizzle where-clause evaluator for the SQL-fragment shape
 *  (queryChunks): extracts every [col = value] triple and ANDs them — the
 *  service only builds conjunctions of eq() conditions. */
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
      if (row[col.col] !== value.value) return false;
    }
  }
  return true;
}

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: async (cond: unknown) => rowsForTable(table).filter((row) => evalWhere(row, cond)),
        limit: async (cond: unknown) =>
          rowsForTable(table)
            .filter((row) => evalWhere(row, cond))
            .slice(0, 1),
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}));

vi.mock("../lib/featureFlags", () => ({
  getFeatureFlag: vi.fn(async () => true),
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

vi.mock("../repositories/eventCreditsRepo", () => ({
  eventCreditsRepo: {
    reverseRedemptionForRegistration: vi.fn(async () => true),
  },
}));

vi.mock("../repositories/refundAttemptsRepo", () => ({
  refundAttemptsRepo: {
    create: vi.fn(async () => ({ id: "ra-1" })),
  },
}));

vi.mock("../repositories/notificationsRepo", () => ({
  notificationsRepo: {
    createNotification: vi.fn(async () => undefined),
  },
}));

vi.mock("../lib/wecomNotifications/poolLifecycle", () => ({
  notifyAutoRefundSummary: vi.fn(async () => undefined),
}));

import { getFeatureFlag } from "../lib/featureFlags";
import { paymentService } from "../paymentService";
import { paymentFulfillmentRepo } from "../repositories/paymentFulfillmentRepo";
import { eventCreditsRepo } from "../repositories/eventCreditsRepo";
import { refundAttemptsRepo } from "../repositories/refundAttemptsRepo";
import { notificationsRepo } from "../repositories/notificationsRepo";
import { notifyAutoRefundSummary } from "../lib/wecomNotifications/poolLifecycle";
import {
  refundPoolCancellation,
  refundUnmatchedRegistrations,
  refundCollapsedGroupRegistrations,
} from "../services/autoRefundService";

const moneyPayment = (id: string, userId: string, wechatOrderId = `wx_${id}`): AnyRow => ({
  id,
  userId,
  wechatOrderId,
  finalAmount: 3000,
  status: "completed",
  payment_type: "event",
  related_id: "pool-1",
});

const mockPayment = (id: string, userId: string): AnyRow => ({
  id,
  userId,
  wechatOrderId: `MOCK_${id}`,
  finalAmount: 100,
  status: "completed",
  payment_type: "event",
  related_id: "pool-1",
});

const redemption = (id: string, userId: string, registrationId: string): AnyRow => ({
  id,
  userId,
  registrationId,
  pool_id: "pool-1",
  creditsUsed: 1,
});

beforeEach(() => {
  state.payments = [];
  state.redemptions = [];
  state.registrations = [];
  vi.mocked(getFeatureFlag).mockResolvedValue(true);
  vi.mocked(paymentService.createRefund).mockClear();
  vi.mocked(paymentFulfillmentRepo.finalizeRefundedPayment).mockClear();
  vi.mocked(eventCreditsRepo.reverseRedemptionForRegistration).mockClear();
  vi.mocked(eventCreditsRepo.reverseRedemptionForRegistration).mockResolvedValue(true);
  vi.mocked(refundAttemptsRepo.create).mockClear();
  vi.mocked(notificationsRepo.createNotification).mockClear();
  vi.mocked(notifyAutoRefundSummary).mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("refundPoolCancellation (Trigger A)", () => {
  it("refunds completed money payments via createRefund and notifies each user", async () => {
    state.payments = [moneyPayment("p1", "u1"), moneyPayment("p2", "u2")];

    const summary = await refundPoolCancellation("pool-1", "测试饭局");

    expect(paymentService.createRefund).toHaveBeenCalledTimes(2);
    expect(paymentService.createRefund).toHaveBeenCalledWith("p1", "活动取消自动退款", "auto-refund");
    expect(summary.refundedPayments).toBe(2);
    expect(notificationsRepo.createNotification).toHaveBeenCalledTimes(2);
    const firstNotif = vi.mocked(notificationsRepo.createNotification).mock.calls[0][0];
    expect(firstNotif.type).toBe("pool_cancelled_refund");
    expect(firstNotif.title).toBe("活动取消，报名费已退回");
    expect(firstNotif.message).toContain("测试饭局");
  });

  it("skips non-completed payments (idempotency guard)", async () => {
    state.payments = [
      moneyPayment("p1", "u1"),
      { ...moneyPayment("p2", "u2"), status: "refund_pending" },
      { ...moneyPayment("p3", "u3"), status: "refunded" },
    ];

    const summary = await refundPoolCancellation("pool-1", "测试饭局");

    expect(paymentService.createRefund).toHaveBeenCalledTimes(1);
    expect(summary.refundedPayments).toBe(1);
  });

  it("finalizes MOCK_ orders directly without the WeChat API and records an attempt", async () => {
    state.payments = [mockPayment("m1", "u1")];

    const summary = await refundPoolCancellation("pool-1", "测试饭局");

    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(paymentFulfillmentRepo.finalizeRefundedPayment).toHaveBeenCalledWith({
      wechatOrderId: "MOCK_m1",
    });
    expect(refundAttemptsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", initiatedBy: "auto-refund" }),
    );
    expect(summary.refundedPayments).toBe(1);
  });

  it("reverses consumed credits and notifies the credit variant", async () => {
    state.redemptions = [redemption("r1", "u1", "reg-1")];

    const summary = await refundPoolCancellation("pool-1", "测试饭局");

    expect(eventCreditsRepo.reverseRedemptionForRegistration).toHaveBeenCalledWith(
      expect.anything(),
      { registrationId: "reg-1" },
    );
    expect(summary.refundedCredits).toBe(1);
    const notif = vi.mocked(notificationsRepo.createNotification).mock.calls[0][0];
    expect(notif.title).toBe("活动取消，次数已退回");
  });

  it("isolates failures — one failed refund does not block the rest", async () => {
    state.payments = [moneyPayment("p1", "u1"), moneyPayment("p2", "u2")];
    vi.mocked(paymentService.createRefund)
      .mockRejectedValueOnce(new Error("WeChat refund rejected"))
      .mockResolvedValueOnce(undefined);

    const summary = await refundPoolCancellation("pool-1", "测试饭局");

    expect(summary.refundedPayments).toBe(1);
    expect(summary.failedRefunds).toHaveLength(1);
    expect(summary.failedRefunds[0].paymentId).toBe("p1");
    expect(summary.failedRefunds[0].reason).toContain("WeChat refund rejected");
  });

  it("sends a WeCom summary only when work was done", async () => {
    const empty = await refundPoolCancellation("pool-1", "测试饭局");
    expect(notifyAutoRefundSummary).not.toHaveBeenCalled();

    state.payments = [moneyPayment("p1", "u1")];
    const worked = await refundPoolCancellation("pool-1", "测试饭局");
    expect(notifyAutoRefundSummary).toHaveBeenCalledTimes(1);
    expect(worked.refundedPayments).toBe(1);
  });

  it("does not classify a successfully refunded payment as failed when the notification throws (P0-3)", async () => {
    state.payments = [moneyPayment("p1", "u1")];
    vi.mocked(notificationsRepo.createNotification).mockRejectedValueOnce(new Error("notify db hiccup"));

    const summary = await refundPoolCancellation("pool-1", "测试饭局");

    expect(summary.refundedPayments).toBe(1);
    expect(summary.failedRefunds).toHaveLength(0);
    expect(paymentService.createRefund).toHaveBeenCalledTimes(1);
  });

  it("no-ops entirely when the kill switch is off", async () => {
    vi.mocked(getFeatureFlag).mockResolvedValue(false);
    state.payments = [moneyPayment("p1", "u1")];
    state.redemptions = [redemption("r1", "u1", "reg-1")];

    const summary = await refundPoolCancellation("pool-1", "测试饭局");

    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(eventCreditsRepo.reverseRedemptionForRegistration).not.toHaveBeenCalled();
    expect(summary.refundedPayments).toBe(0);
    expect(summary.refundedCredits).toBe(0);
  });
});

describe("refundUnmatchedRegistrations (Trigger B)", () => {
  it("refunds only unmatched users; matched users are skipped", async () => {
    state.payments = [moneyPayment("p1", "u1"), moneyPayment("p2", "u2")];
    state.redemptions = [redemption("r1", "u3", "reg-3"), redemption("r2", "u4", "reg-4")];
    // u1 + reg-3 are unmatched; u2 + reg-4 are matched.
    state.registrations = [
      { id: "reg-1", userId: "u1", pool_id: "pool-1", match_status: "unmatched" },
      { id: "reg-2", userId: "u2", pool_id: "pool-1", match_status: "matched" },
      { id: "reg-3", userId: "u3", pool_id: "pool-1", match_status: "unmatched" },
      { id: "reg-4", userId: "u4", pool_id: "pool-1", match_status: "matched" },
    ];

    const summary = await refundUnmatchedRegistrations("pool-1", "测试饭局");

    expect(paymentService.createRefund).toHaveBeenCalledTimes(1);
    expect(paymentService.createRefund).toHaveBeenCalledWith("p1", "场次未成行，自动退款", "auto-refund");
    expect(eventCreditsRepo.reverseRedemptionForRegistration).toHaveBeenCalledTimes(1);
    expect(eventCreditsRepo.reverseRedemptionForRegistration).toHaveBeenCalledWith(
      expect.anything(),
      { registrationId: "reg-3" },
    );
    expect(summary.refundedPayments).toBe(1);
    expect(summary.refundedCredits).toBe(1);
    expect(summary.skippedRefunds).toBe(2);
  });

  it("does not double-refund a second run (redemption gone, payment not completed)", async () => {
    state.payments = [{ ...moneyPayment("p1", "u1"), status: "refunded" }];
    state.registrations = [
      { id: "reg-1", userId: "u1", pool_id: "pool-1", match_status: "unmatched" },
    ];
    // Redemption row already deleted by the first run.

    const summary = await refundUnmatchedRegistrations("pool-1", "测试饭局");

    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(eventCreditsRepo.reverseRedemptionForRegistration).not.toHaveBeenCalled();
    expect(summary.refundedPayments).toBe(0);
  });

  it("uses the unmatched notification type and copy", async () => {
    state.payments = [moneyPayment("p1", "u1")];
    state.registrations = [
      { id: "reg-1", userId: "u1", pool_id: "pool-1", match_status: "unmatched" },
    ];

    await refundUnmatchedRegistrations("pool-1", "测试饭局");

    const notif = vi.mocked(notificationsRepo.createNotification).mock.calls[0][0];
    expect(notif.type).toBe("unmatched_refund");
    expect(notif.title).toBe("场次未成行，报名费已退回");
  });
});

describe("refundCollapsedGroupRegistrations (post-reveal collapse, Phase 0 Amendment 3)", () => {
  it("refunds only unmatched stayers with the DISTINCT collapse copy (M2), never matched users", async () => {
    state.payments = [moneyPayment("p1", "u1"), moneyPayment("p2", "u2")];
    state.redemptions = [redemption("r1", "u3", "reg-3"), redemption("r2", "u4", "reg-4")];
    // u1 + reg-3 are stayers flipped to unmatched by the cancel transaction;
    // u2 + reg-4 belong to another still-matched group and must be skipped.
    state.registrations = [
      { id: "reg-1", userId: "u1", pool_id: "pool-1", match_status: "unmatched" },
      { id: "reg-2", userId: "u2", pool_id: "pool-1", match_status: "matched" },
      { id: "reg-3", userId: "u3", pool_id: "pool-1", match_status: "unmatched" },
      { id: "reg-4", userId: "u4", pool_id: "pool-1", match_status: "matched" },
    ];

    const summary = await refundCollapsedGroupRegistrations("pool-1", "测试饭局");

    expect(paymentService.createRefund).toHaveBeenCalledTimes(1);
    expect(paymentService.createRefund).toHaveBeenCalledWith(
      "p1",
      "同桌人数不足，本次未能成行，自动退款",
      "auto-refund",
    );
    expect(eventCreditsRepo.reverseRedemptionForRegistration).toHaveBeenCalledTimes(1);
    expect(eventCreditsRepo.reverseRedemptionForRegistration).toHaveBeenCalledWith(
      expect.anything(),
      { registrationId: "reg-3" },
    );
    expect(summary.refundedPayments).toBe(1);
    expect(summary.refundedCredits).toBe(1);
    expect(summary.skippedRefunds).toBe(2);
    expect(summary.reason).toBe("collapsed");
  });

  it("uses the collapse notification type + copy incl. 「已为你优先保留下一场的排桌资格」", async () => {
    state.payments = [moneyPayment("p1", "u1")];
    state.registrations = [
      { id: "reg-1", userId: "u1", pool_id: "pool-1", match_status: "unmatched" },
    ];

    await refundCollapsedGroupRegistrations("pool-1", "测试饭局");

    const notif = vi.mocked(notificationsRepo.createNotification).mock.calls[0][0];
    expect(notif.type).toBe("collapsed_refund");
    expect(notif.title).toBe("这次没能成行，报名费已退回");
    expect(notif.message).toContain("已为你优先保留下一场的排桌资格");
    // M2: collapse copy must NOT be the 场次未成行 verbatim wording.
    expect(notif.title).not.toBe("场次未成行，报名费已退回");
  });

  it("uses the credit-variant collapse copy for credit reversals", async () => {
    state.redemptions = [redemption("r1", "u3", "reg-3")];
    state.registrations = [
      { id: "reg-3", userId: "u3", pool_id: "pool-1", match_status: "unmatched" },
    ];

    await refundCollapsedGroupRegistrations("pool-1", "测试饭局");

    const notif = vi.mocked(notificationsRepo.createNotification).mock.calls[0][0];
    expect(notif.title).toBe("这次没能成行，次数已退回");
    expect(notif.message).toContain("已为你优先保留下一场的排桌资格");
  });

  it("sends a WeCom summary when collapse refunds were issued", async () => {
    state.payments = [moneyPayment("p1", "u1")];
    state.registrations = [
      { id: "reg-1", userId: "u1", pool_id: "pool-1", match_status: "unmatched" },
    ];

    await refundCollapsedGroupRegistrations("pool-1", "测试饭局");

    expect(notifyAutoRefundSummary).toHaveBeenCalledTimes(1);
  });
});
