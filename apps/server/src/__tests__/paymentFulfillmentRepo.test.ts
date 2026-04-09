import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    transaction: vi.fn(),
  },
}));

vi.mock("../db", () => ({
  db: mockDb,
}));

import { paymentFulfillmentRepo } from "../repositories/paymentFulfillmentRepo";

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

  const insertMock = vi.fn(() => ({
    values: vi.fn(() => {
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
    insert: insertMock,
  };

  return { tx, insertMock };
}

describe("paymentFulfillmentRepo.finalizeConfirmedPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    };
    const completedEventPayment = {
      ...eventPayment,
      status: "completed",
      paidAt: new Date(),
      wechatTransactionId: "wx_txn_003",
    };
    const { tx, insertMock } = createTxHarness({
      selectResults: [
        [eventPayment],
        [{ id: "pool-1" }],
      ],
      updateResults: [
        [completedEventPayment],
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
    expect(tx.update).toHaveBeenCalledTimes(3);
  });
});
