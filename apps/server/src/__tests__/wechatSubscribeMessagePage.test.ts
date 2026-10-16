import { describe, expect, it, vi } from "vitest";
import { resolveTemplatePage, type SubscribePushContext } from "../lib/wechatSubscribeMessage";

/**
 * Landing-page contract for the 3-template subscribe-message set (2026-10-16).
 *
 * The recap (活动评价提醒) template deep-links straight into the feedback flow.
 * Before this, every template landed on `pages/events/index` — and the events
 * tab has NO feedback entry, so the T+1 summons led nowhere actionable.
 * Locked here so a future template edit cannot silently regress the deep-link
 * (the P0-adjacent half of the 2026-10-16 feedback-activation work).
 *
 * The import graph needs db/token/ledger stubs even though the tested function
 * is pure — mirror of the subscribeReminderScheduler.test.ts mock style.
 */
vi.mock("../db", () => ({ db: { select: vi.fn() } }));
vi.mock("../lib/wechatMsgSecCheck", () => ({ getWechatAccessToken: vi.fn() }));
vi.mock("../repositories/subscribeMessageSendsRepo", () => ({
  subscribeMessageSendsRepo: { tryClaimSend: vi.fn() },
}));
vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

const POOL_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function buildCtx(overrides: Partial<SubscribePushContext> = {}): SubscribePushContext {
  return {
    poolId: POOL_ID,
    poolTitle: "周六晚 破冰局",
    eventTime: new Date("2026-10-17T11:00:00.000Z"),
    hint: "来聊聊感受，帮下次排桌更合拍",
    ...overrides,
  };
}

describe("resolveTemplatePage — subscribe-message landing pages", () => {
  it("recap deep-links into the feedback page with the recap attribution flag", () => {
    expect(resolveTemplatePage("recap", buildCtx())).toBe(
      `pages/event-feedback/index?id=${POOL_ID}&from=recap_push`,
    );
  });

  it("URL-encodes the pool id (query param must survive special characters)", () => {
    const page = resolveTemplatePage("recap", buildCtx({ poolId: "pool/with?chars&x=1" }));
    expect(page).toBe(
      `pages/event-feedback/index?id=${encodeURIComponent("pool/with?chars&x=1")}&from=recap_push`,
    );
    expect(page).not.toContain("pool/with?chars&x=1&from=");
  });

  it("result keeps the events-tab landing page (no override)", () => {
    expect(resolveTemplatePage("result", buildCtx())).toBe("pages/events/index");
  });

  it("reminder keeps the events-tab landing page (no override)", () => {
    expect(resolveTemplatePage("reminder", buildCtx())).toBe("pages/events/index");
  });

  it("landing pages carry no leading slash (WeChat `page` field format)", () => {
    for (const key of ["result", "reminder", "recap"] as const) {
      expect(resolveTemplatePage(key, buildCtx()).startsWith("/")).toBe(false);
    }
  });
});
