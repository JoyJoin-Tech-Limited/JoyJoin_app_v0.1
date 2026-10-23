import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockResolveDuoBindingAvailability, mockLoggerWarn } = vi.hoisted(() => ({
  mockDb: {
    transaction: vi.fn(),
  },
  mockResolveDuoBindingAvailability: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock("../db", () => ({
  db: mockDb,
}));

vi.mock("../repositories/eventCreditsRepo", () => ({
  eventCreditsRepo: {
    grantCreditsForPayment: vi.fn(),
    reverseCreditsForPayment: vi.fn(),
  },
}));

// 双人成行 S1: the availability probes are mocked at the repo boundary — their
// own query semantics are locked in duoBindingRepo.test.ts; this file asserts
// the fulfillment call-site wiring (AC-3).
vi.mock("../repositories/duoBindingRepo", () => ({
  resolveDuoBindingAvailability: mockResolveDuoBindingAvailability,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}));

import { paymentFulfillmentRepo } from "../repositories/paymentFulfillmentRepo";
import { eventCreditsRepo } from "../repositories/eventCreditsRepo";

const basePayment = {
  id: "payment-1",
  userId: "user-1",
  paymentType: "subscription",
  relatedId: "subscription-1",
  wechatOrderId: "JJ_ORDER_001",
  status: "pending",
  couponId: null,
  discountAmount: 0,
};

function createTxHarness(options: {
  selectResults?: any[][];
  updateResults?: any[][];
  insertResults?: any[][];
}) {
  const selectResults = [...(options.selectResults ?? [])];
  const updateResults = [...(options.updateResults ?? [])];
  const insertResults = [...(options.insertResults ?? [])];

  const insertValuesCalls: any[] = [];

  const insertMock = vi.fn((table) => ({
    values: vi.fn((values) => {
      insertValuesCalls.push({ table, values });
      const directInsertResult = insertResults.shift() ?? [];
      return {
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => insertResults.shift() ?? []),
        })),
        returning: vi.fn(async () => insertResults.shift() ?? []),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(directInsertResult)),
      };
    }),
  }));

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectResults.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          const directUpdateResult = updateResults.shift() ?? [];
          return {
            returning: vi.fn(async () => directUpdateResult),
            then: (resolve: (value: unknown) => unknown) =>
              Promise.resolve(resolve(directUpdateResult)),
          };
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
    insert: insertMock,
  };

  return { tx, insertMock, insertValuesCalls };
}

describe("paymentFulfillmentRepo.finalizeConfirmedPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats refund_pending as terminal — no resurrection, no side effects (2026-10-06)", async () => {
    // A reconcile/status query on a refund_pending row sees WeChat
    // trade_state=SUCCESS; before this guard the payment was flipped back to
    // completed mid-refund (duplicate notifications + double-refund window).
    const { tx, insertMock } = createTxHarness({
      selectResults: [[{ ...basePayment, status: "refund_pending" }]],
    });

    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId: basePayment.wechatOrderId,
      transactionId: "wx_txn_001",
    });

    expect(result.alreadyCompleted).toBe(true);
    expect(result.payment).toMatchObject({ id: basePayment.id, status: "refund_pending" });
    expect(tx.update).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("treats refunded as terminal — no resurrection, no side effects", async () => {
    const { tx, insertMock } = createTxHarness({
      selectResults: [[{ ...basePayment, status: "refunded" }]],
    });

    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId: basePayment.wechatOrderId,
      transactionId: "wx_txn_001",
    });

    expect(result.alreadyCompleted).toBe(true);
    expect(tx.update).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("treats a zero-row payment update as already completed and skips side effects", async () => {
    const { tx, insertMock } = createTxHarness({
      selectResults: [
        [{ ...basePayment, status: "pending" }],
        [{ ...basePayment, status: "completed", wechatTransactionId: "wx_txn_001" }],
      ],
      updateResults: [[]],
    });

    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId: basePayment.wechatOrderId,
      transactionId: "wx_txn_001",
    });

    expect(result.alreadyCompleted).toBe(true);
    expect(result.payment).toMatchObject({
      id: basePayment.id,
      userId: basePayment.userId,
      wechatOrderId: basePayment.wechatOrderId,
      status: "completed",
      wechatTransactionId: "wx_txn_001",
    });
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("throws when the subscription activation target does not belong to the paying user", async () => {
    const { tx } = createTxHarness({
      selectResults: [[{ ...basePayment, status: "pending" }]],
      updateResults: [
        [{ ...basePayment, status: "completed", paidAt: new Date(), wechatTransactionId: "wx_txn_002" }],
        [],
      ],
    });

    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    await expect(
      paymentFulfillmentRepo.finalizeConfirmedPayment({
        wechatOrderId: basePayment.wechatOrderId,
        transactionId: "wx_txn_002",
      }),
    ).rejects.toThrow(
      "Subscription subscription-1 does not exist or does not belong to user user-1",
    );
  });

  it("applies event registration side effects exactly once when payment completes", async () => {
    const eventPayment = {
      ...basePayment,
      paymentType: "event",
      relatedId: "pool-1",
      couponId: "coupon-1",
      discountAmount: 300,
      eventRegistrationPayload: {
        budgetRange: ["150-200"],
        preferredLanguages: ["普通话"],
        tasteIntensity: ["清淡"],
        cuisinePreferences: ["粤菜"],
        eventIntent: ["交朋友"],
        dietaryRestrictions: ["不吃辣"],
      },
    };
    const completedEventPayment = {
      ...eventPayment,
      status: "completed",
      paidAt: new Date(),
      wechatTransactionId: "wx_txn_003",
    };
    const { tx, insertMock, insertValuesCalls } = createTxHarness({
      selectResults: [
        [eventPayment],
        [{ id: "user-coupon-1" }],
        [{ id: "pool-1" }],
      ],
      updateResults: [
        [completedEventPayment],
        [],
        [],
        [],
      ],
      insertResults: [
        [],
        [],
        [{ id: "registration-1" }],
        [],
      ],
    });

    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId: eventPayment.wechatOrderId,
      transactionId: "wx_txn_003",
    });

    expect(result.alreadyCompleted).toBe(false);
    expect(result.payment?.status).toBe("completed");
    expect(insertMock).toHaveBeenCalledTimes(3);
    expect(tx.update).toHaveBeenCalledTimes(4);
    expect(
      insertValuesCalls.some(({ values }) =>
        values?.poolId === "pool-1" &&
        // L1 write normalization: legacy 饭局 label persisted as its canonical id.
        values?.budgetRange?.[0] === "dining_150_200" &&
        values?.preferredLanguages?.[0] === "普通话" &&
        values?.eventIntent?.[0] === "交朋友",
      ),
    ).toBe(true);
  });

  it("grants event-pack credits when an event-pack payment completes", async () => {
    const eventPackPayment = {
      ...basePayment,
      paymentType: "event_pack",
      relatedId: "pack_3",
    };
    const completedEventPackPayment = {
      ...eventPackPayment,
      status: "completed",
      paidAt: new Date(),
      wechatTransactionId: "wx_txn_004",
    };
    const { tx, insertMock } = createTxHarness({
      selectResults: [[eventPackPayment]],
      updateResults: [[completedEventPackPayment]],
      insertResults: [[]],
    });

    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId: eventPackPayment.wechatOrderId,
      transactionId: "wx_txn_004",
    });

    expect(result.alreadyCompleted).toBe(false);
    expect(result.payment?.status).toBe("completed");
    expect(eventCreditsRepo.grantCreditsForPayment).toHaveBeenCalledWith(tx, {
      paymentId: eventPackPayment.id,
      userId: eventPackPayment.userId,
      planType: "pack_3",
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * 双人成行 S1 (one-partner-per-pool) AC-3 + AC-7 — the PAID registration path
 * must refuse a duplicate duo binding WITHOUT blocking payment completion or
 * the registration write, and a refusal must not increment
 * invitations.total_acceptances. The availability probes are mocked at the
 * repo boundary (their query semantics live in duoBindingRepo.test.ts); the
 * real resolver + real call-site gating are exercised end to end here.
 */
describe("paymentFulfillmentRepo.finalizeConfirmedPayment — duo binding guard (S1 AC-3)", () => {
  const duoEventPayment = {
    ...basePayment,
    paymentType: "event",
    relatedId: "pool-1",
    eventRegistrationPayload: {
      // No budgetRange literal here — the T6 budget guardrail ratchet forbids
      // new hardcoded tier literals, and fulfillment defaults the field to [].
      invitationCode: "abc123def456",
    },
  };
  const completedDuoEventPayment = {
    ...duoEventPayment,
    status: "completed",
    paidAt: new Date(),
    wechatTransactionId: "wx_txn_duo",
  };
  const duoInvitationRow = {
    id: "inv-duo-1",
    code: "abc123def456",
    inviterId: "user-inviter",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    invitationType: "duo",
    poolId: "pool-1",
  };

  function buildDuoTx(options: {
    existingUseRows?: any[];
  }) {
    return createTxHarness({
      // payment → pool → user (DNA, empty) → invitation → [existingUse]
      selectResults: [
        [duoEventPayment],
        [{ id: "pool-1" }],
        [],
        [duoInvitationRow],
        ...(options.existingUseRows ? [options.existingUseRows] : []),
      ],
      // payments (returning) → eventPools → [invitations total_acceptances]
      updateResults: [
        [completedDuoEventPayment],
        [],
        [],
      ],
      // registration (direct + onConflict returning) → [invitation_uses] → notification
      insertResults: [
        [],
        [{ id: "registration-1" }],
        [],
        [],
      ],
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC-3/AC-7: refuses a second consumer of a claimed duo code (partner_taken) without blocking payment or registration", async () => {
    mockResolveDuoBindingAvailability.mockResolvedValue({
      invitationAlreadyBound: true,
      userAlreadyBoundInPool: false,
    });
    const { tx, insertValuesCalls } = buildDuoTx({});
    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId: duoEventPayment.wechatOrderId,
      transactionId: "wx_txn_duo",
    });

    // Payment completes and the registration row is written — refusal never
    // blocks the main transaction.
    expect(result.alreadyCompleted).toBe(false);
    expect(result.payment?.status).toBe("completed");
    expect(
      insertValuesCalls.some(
        ({ values }) => values?.poolId === "pool-1" && values?.userId === "user-1",
      ),
    ).toBe(true);

    // The probes were consulted with the payment's pool/user/invitation…
    expect(mockResolveDuoBindingAvailability).toHaveBeenCalledWith(tx, {
      poolId: "pool-1",
      userId: "user-1",
      invitationId: "inv-duo-1",
    });

    // …but NO invitation_uses row is written…
    expect(
      insertValuesCalls.some(({ values }) => values?.invitationId && values?.inviteeId),
    ).toBe(false);

    // …and total_acceptances is NOT incremented (updates = payments + pools only).
    expect(tx.update).toHaveBeenCalledTimes(2);

    // The discard is observable with the countable reason.
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Discarding unusable invitation during payment fulfillment",
      expect.objectContaining({ reason: "duo_partner_taken" }),
    );
  });

  it("AC-3: refuses when the paying user already holds a valid duo binding in the pool (already_bound)", async () => {
    mockResolveDuoBindingAvailability.mockResolvedValue({
      invitationAlreadyBound: false,
      userAlreadyBoundInPool: true,
    });
    const { tx, insertValuesCalls } = buildDuoTx({});
    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId: duoEventPayment.wechatOrderId,
      transactionId: "wx_txn_duo",
    });

    expect(result.payment?.status).toBe("completed");
    expect(
      insertValuesCalls.some(({ values }) => values?.invitationId && values?.inviteeId),
    ).toBe(false);
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Discarding unusable invitation during payment fulfillment",
      expect.objectContaining({ reason: "duo_already_bound" }),
    );
  });

  it("AC-3: binds a clean duo code over the payment hop (invitation_uses write + total_acceptances increment)", async () => {
    mockResolveDuoBindingAvailability.mockResolvedValue({
      invitationAlreadyBound: false,
      userAlreadyBoundInPool: false,
    });
    const { tx, insertValuesCalls } = buildDuoTx({ existingUseRows: [] });
    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId: duoEventPayment.wechatOrderId,
      transactionId: "wx_txn_duo",
    });

    expect(result.payment?.status).toBe("completed");
    // invitation_uses row links the code to the NEW registration id.
    expect(
      insertValuesCalls.some(
        ({ values }) =>
          values?.invitationId === "inv-duo-1" &&
          values?.inviteeId === "user-1" &&
          values?.poolRegistrationId === "registration-1",
      ),
    ).toBe(true);
    // payments + eventPools + invitations(total_acceptances) = 3 updates.
    expect(tx.update).toHaveBeenCalledTimes(3);
  });

  it("does not probe duo availability for non-duo invitations (legacy codes stay multi-use)", async () => {
    const legacyEventPayment = {
      ...duoEventPayment,
      id: "payment-legacy",
      wechatOrderId: "JJ_ORDER_LEGACY",
    };
    const { tx, insertValuesCalls } = createTxHarness({
      selectResults: [
        [legacyEventPayment],
        [{ id: "pool-1" }],
        [],
        [
          {
            id: "inv-legacy-1",
            inviterId: "user-inviter",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            invitationType: "pre_match",
            poolId: null,
          },
        ],
        [], // existingUse
      ],
      updateResults: [
        [{ ...legacyEventPayment, status: "completed", paidAt: new Date() }],
        [],
        [],
      ],
      insertResults: [[], [{ id: "registration-1" }], [], []],
    });
    mockDb.transaction.mockImplementation(async (callback: any) => callback(tx));

    await paymentFulfillmentRepo.finalizeConfirmedPayment({
      wechatOrderId: legacyEventPayment.wechatOrderId,
      transactionId: "wx_txn_legacy",
    });

    expect(mockResolveDuoBindingAvailability).not.toHaveBeenCalled();
    expect(
      insertValuesCalls.some(({ values }) => values?.invitationId === "inv-legacy-1"),
    ).toBe(true);
    expect(tx.update).toHaveBeenCalledTimes(3);
  });
});
