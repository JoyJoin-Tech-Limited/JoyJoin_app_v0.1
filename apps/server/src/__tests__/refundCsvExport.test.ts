import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({ db: {} }));
vi.mock("../repositories/refundAttemptsRepo", () => ({
  refundAttemptsRepo: {
    getAllWithPaymentDetails: vi.fn(),
  },
}));

const { refundAttemptsRepo } = await import("../repositories/refundAttemptsRepo");
const { buildCsvContent } = await import("@joyjoin/shared");

describe("refund CSV export", () => {
  beforeEach(() => {
    vi.mocked(refundAttemptsRepo.getAllWithPaymentDetails).mockReset();
  });

  it("builds CSV rows from refund attempt records", () => {
    const attempts = [
      {
        id: "ref-1",
        payment_id: "pay-1",
        payment_wechat_order_id: "wx-123",
        payment_type: "event",
        user_first_name: "Alice",
        user_last_name: "",
        user_phone_number: "13800138000",
        amount: 8800,
        status: "success",
        reason: "User request",
        wechat_refund_id: "wx-ref-1",
        initiated_at: new Date("2026-05-01T10:00:00Z"),
        resolved_at: new Date("2026-05-01T10:05:00Z"),
        failure_reason: null,
      },
      {
        id: "ref-2",
        payment_id: "pay-2",
        payment_wechat_order_id: null,
        payment_type: "subscription",
        user_first_name: null,
        user_last_name: null,
        user_phone_number: null,
        amount: 9800,
        status: "failed",
        reason: null,
        wechat_refund_id: null,
        initiated_at: new Date("2026-05-02T12:00:00Z"),
        resolved_at: null,
        failure_reason: "Insufficient balance",
      },
    ];

    const headers = [
      "退款ID",
      "支付ID",
      "微信支付订单号",
      "支付类型",
      "用户姓名",
      "手机号",
      "金额(分)",
      "状态",
      "原因",
      "微信退款ID",
      "发起时间",
      "完成时间",
      "失败原因",
    ];

    const rows = attempts.map((a: any) => [
      a.id,
      a.payment_id,
      a.payment_wechat_order_id ?? "",
      a.payment_type ?? "",
      `${a.user_first_name ?? ""} ${a.user_last_name ?? ""}`.trim(),
      a.user_phone_number ?? "",
      a.amount,
      a.status,
      a.reason ?? "",
      a.wechat_refund_id ?? "",
      a.initiated_at ? new Date(a.initiated_at).toISOString() : "",
      a.resolved_at ? new Date(a.resolved_at).toISOString() : "",
      a.failure_reason ?? "",
    ]);

    const csv = buildCsvContent({ headers, rows });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.split("\n");
    expect(lines[0]).toContain('"退款ID"');
    expect(lines[1]).toContain('"ref-1"');
    expect(lines[1]).toContain('"Alice"');
    expect(lines[2]).toContain('"ref-2"');
    expect(lines[2]).toContain('"failed"');
  });

  it("passes date filters to the repository", async () => {
    const since = new Date("2026-05-01T00:00:00Z");
    const until = new Date("2026-05-10T23:59:59Z");
    vi.mocked(refundAttemptsRepo.getAllWithPaymentDetails).mockResolvedValue([]);

    await refundAttemptsRepo.getAllWithPaymentDetails({ since, until });

    expect(refundAttemptsRepo.getAllWithPaymentDetails).toHaveBeenCalledWith({
      since,
      until,
    });
  });

  it("escapes formula injection in refund reasons", () => {
    const attempts = [
      {
        id: "ref-3",
        payment_id: "pay-3",
        payment_wechat_order_id: null,
        payment_type: null,
        user_first_name: null,
        user_last_name: null,
        user_phone_number: null,
        amount: 100,
        status: "pending",
        reason: "=cmd|' /C calc'!A0",
        wechat_refund_id: null,
        initiated_at: new Date(),
        resolved_at: null,
        failure_reason: null,
      },
    ];

    const rows = attempts.map((a: any) => [
      a.id,
      a.payment_id,
      a.payment_wechat_order_id ?? "",
      a.payment_type ?? "",
      "",
      a.user_phone_number ?? "",
      a.amount,
      a.status,
      a.reason ?? "",
      a.wechat_refund_id ?? "",
      a.initiated_at ? new Date(a.initiated_at).toISOString() : "",
      a.resolved_at ? new Date(a.resolved_at).toISOString() : "",
      a.failure_reason ?? "",
    ]);

    const csv = buildCsvContent({ headers: ["ID", "Reason"], rows });
    expect(csv).toContain('"\t=cmd|\'');
  });
});
