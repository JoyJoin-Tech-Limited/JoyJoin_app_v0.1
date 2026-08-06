import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WechatRiskVerdict } from "../lib/wechatMsgSecCheck";

/**
 * Red-team / chaos evidence for the content-moderation greenlight (Sprint 3).
 *
 * Target: the launch-risk scenario — WeChat msgSecCheck (Tier-1) being DOWN
 * (network error) or HANGING past the 250ms budget while users are writing
 * text. This file proves the two-tier gate's failure semantics under that
 * chaos, using the REAL featureFlags module (env-controlled, like
 * contentSafetyDecisionTable.test.ts) and an injected mock Tier-1 client.
 *
 * Assertions locked in here (all deterministic — no wall-clock sleeps):
 *   1. Severe Tier-0 keyword + Tier-1 DOWN  → BLOCK (never fail-open for severe)
 *   2. Benign text           + Tier-1 DOWN  → ALLOW (fail-open, unchanged semantics)
 *   3. Warning keyword + F ON + Tier-1 DOWN → BLOCK at Tier-0 (before Tier-1)
 *   4. Warning keyword + F OFF + Tier-1 DOWN → ALLOW + log row + NO
 *      recordViolation (decision-table row 3 is unaffected by Tier-1 state)
 *   5. Budget hang: risky verdict lands after the budget → request fail-opens,
 *      background enforcement still records the violation
 *   6. Budget boundary: verdict lands EXACTLY at the deadline → the timeout
 *      branch (registered first) wins the tie → fail-open + background
 *      enforcement fires (nothing silently dropped)
 *   7. Tier-0 independence: a must-catch corpus is fully caught with the
 *      Tier-1 client down — the deterministic layer never depends on Tier-1
 *      availability (short-circuit means Tier-1 is never consulted for
 *      Tier-0 hits).
 */

const logRows: Array<Record<string, unknown>> = [];

const mockCheckTextWithMsgSecCheck = vi.fn();
const mockWarmWechatAccessToken = vi.fn();
vi.mock("../lib/wechatMsgSecCheck", () => ({
  checkTextWithMsgSecCheck: mockCheckTextWithMsgSecCheck,
  warmWechatAccessToken: mockWarmWechatAccessToken,
}));

const mockLoggerWarn = vi.fn();
vi.mock("../lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock("../db", () => ({
  // featureFlags.fetchFromDb resolves null (no DB row) → env/fallback path.
  // The only inserts on this path are content-filter logs.
  db: {
    select: () => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    }),
    insert: vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        logRows.push(values);
        return { execute: vi.fn(() => Promise.resolve()) };
      },
    })),
  },
}));

const mockRecordViolation = vi.fn();
vi.mock("../abuseDetection", () => ({
  recordViolation: mockRecordViolation,
}));

const {
  validateContentSafeAsync,
  contentViolationResponse,
} = await import("../lib/contentSafety");
const {
  getFeatureFlag,
  refreshFeatureFlag,
  DEFAULT_FLAG_VALUES,
  FLAG_ENV_MAP,
} = await import("../lib/featureFlags");

const SEVERE_FLAG = "contentModerationSevereFailClosedEnabled";
const SEVERE_FLAG_ENV = "CONTENT_MODERATION_SEVERE_FAIL_CLOSED_ENABLED";
const MSGSEC_FLAG_ENV = "CONTENT_MODERATION_MSGSECCHECK_ENABLED";
const TIER1_BUDGET_ENV = "CONTENT_MODERATION_TIER1_BUDGET_MS";

// Real Tier-0 keywords (contentFilter.ts): severe = 共产党, warning = 傻逼.
const SEVERE_TEXT = "共产党";
const WARNING_TEXT = "傻逼";
const CLEAN_TEXT = "今天天气不错，一起喝杯奶茶吧";

/** Tier-1 outage: the WeChat client throws a transport error (ECONNRESET). */
function mockTier1DownNetworkError(): void {
  mockCheckTextWithMsgSecCheck.mockRejectedValue(new Error("ECONNRESET: upstream unreachable"));
}

/** Tier-1 outage: the WeChat client never settles until we release it. */
function mockTier1Hang(): {
  release: (verdict: WechatRiskVerdict) => void;
} {
  // Shared mutable handle: the mock assigns the resolver later, when the
  // Tier-1 client is invoked — returning a plain object literal would capture
  // the undefined value at call time and `release()` would throw.
  const handle: { release?: (verdict: WechatRiskVerdict) => void } = {};
  mockCheckTextWithMsgSecCheck.mockImplementation(
    () =>
      new Promise<WechatRiskVerdict>((resolve) => {
        handle.release = resolve;
      }),
  );
  return handle as { release: (verdict: WechatRiskVerdict) => void };
}

/**
 * Drain the microtask chain until the Tier-1 client has been invoked. The
 * budget setTimeout inside withTier1Budget is registered synchronously right
 * after that invocation, so once this returns, fake-timer registration order
 * is deterministic: budget timer first, client-release timer second.
 */
async function drainUntilTier1Reached(handle: { release?: (verdict: WechatRiskVerdict) => void }): Promise<void> {
  for (let i = 0; i < 100 && !handle.release; i++) {
    await Promise.resolve();
  }
}

describe("contentSafety red-team: Tier-1 outage chaos (content-mod-s1)", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    vi.clearAllMocks();
    logRows.length = 0;
    // Defaults: severe-fail-closed ON, tier-1 msgSecCheck ON.
    process.env[SEVERE_FLAG_ENV] = "true";
    process.env[MSGSEC_FLAG_ENV] = "true";
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });
    // Refresh the sync cache so getFeatureFlagSync sees the env state.
    await refreshFeatureFlag(SEVERE_FLAG);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env[SEVERE_FLAG_ENV];
    delete process.env[MSGSEC_FLAG_ENV];
    delete process.env[TIER1_BUDGET_ENV];
  });

  it("flag contract: both moderation flags registered, defaults fail-closed TRUE", async () => {
    expect(DEFAULT_FLAG_VALUES.contentModerationSevereFailClosedEnabled).toBe(true);
    expect(DEFAULT_FLAG_VALUES.contentModerationMsgSecCheckEnabled).toBe(true);
    expect(FLAG_ENV_MAP[SEVERE_FLAG]).toBe(SEVERE_FLAG_ENV);
    expect(FLAG_ENV_MAP.contentModerationMsgSecCheckEnabled).toBe(MSGSEC_FLAG_ENV);

    // No DB row (mocked), no env → resolved defaults.
    delete process.env[SEVERE_FLAG_ENV];
    delete process.env[MSGSEC_FLAG_ENV];
    expect(await getFeatureFlag(SEVERE_FLAG, true)).toBe(true);
    expect(await getFeatureFlag("contentModerationMsgSecCheckEnabled", false)).toBe(true);
  });

  // ─── Severe tier: never fail-open, even with Tier-1 fully down ────────────

  it("severe keyword + Tier-1 DOWN (network error) → BLOCK; never fail-open for severe", async () => {
    mockTier1DownNetworkError();

    const result = await validateContentSafeAsync(SEVERE_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(false);
    expect(result.code).toBe("CONTENT_VIOLATION");
    expect(result.violation!.source).toBe("tier0");
    expect(result.violation!.severity).toBe("severe");
    // The route contract maps this to HTTP 400.
    expect(contentViolationResponse(result.violation!).status).toBe(400);
    expect(logRows).toHaveLength(1);
    expect(logRows[0].severity).toBe("severe");
    // Tier-0 hit short-circuits — the dead Tier-1 client is never consulted.
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
    expect(mockRecordViolation).not.toHaveBeenCalled();
  });

  // ─── Clean tier: fail-open semantics unchanged by Tier-1 outage ───────────

  it("benign text + Tier-1 DOWN (network error) → ALLOW; fail-open for clean text", async () => {
    mockTier1DownNetworkError();

    const result = await validateContentSafeAsync(CLEAN_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(true);
    // Tier-0 was clean so Tier-1 WAS consulted and threw → fail-open, no
    // violation, nothing recorded.
    expect(mockCheckTextWithMsgSecCheck).toHaveBeenCalledTimes(1);
    expect(logRows).toHaveLength(0);
    expect(mockRecordViolation).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  // ─── Warning tier under Tier-1 outage (both flag states) ──────────────────

  it("warning keyword + flag ON + Tier-1 DOWN → BLOCK at Tier-0 (Tier-1 never consulted)", async () => {
    mockTier1DownNetworkError();

    const result = await validateContentSafeAsync(WARNING_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(false);
    expect(result.code).toBe("CONTENT_VIOLATION");
    expect(result.violation!.source).toBe("tier0");
    expect(result.violation!.severity).toBe("warning");
    expect(contentViolationResponse(result.violation!).status).toBe(400);
    expect(logRows).toHaveLength(1);
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  it("warning keyword + flag OFF (rollback) + Tier-1 DOWN → ALLOW + log row + NO recordViolation (row 3 unaffected by Tier-1 state)", async () => {
    process.env[SEVERE_FLAG_ENV] = "false";
    await refreshFeatureFlag(SEVERE_FLAG);
    mockTier1DownNetworkError();

    const result = await validateContentSafeAsync(WARNING_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(true);
    // Detection + logging stay unconditional (emergency-rollback visibility).
    expect(logRows).toHaveLength(1);
    expect(logRows[0].severity).toBe("warning");
    // The rollback contract: ALLOW with no escalation — even with Tier-1 down.
    expect(mockRecordViolation).not.toHaveBeenCalled();
    // LOCKED control flow: warning-tier text allowed through by row 3 is not
    // Tier-0 clean → Tier-1 is never consulted, so its outage is irrelevant.
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  // ─── Budget hang: request fail-opens, background enforcement still fires ──

  it("Tier-1 hang: risky verdict after budget → request ALLOWs, background enforcement records violation + tier1 log", async () => {
    process.env[TIER1_BUDGET_ENV] = "10";
    const hangHandle = mockTier1Hang();
    vi.useFakeTimers();

    const pending = validateContentSafeAsync("borderline text", "bio", { userId: "u1", openid: "o1" });

    await drainUntilTier1Reached(hangHandle);

    // Budget expires → fail-open on the request path.
    await vi.advanceTimersByTimeAsync(10);
    const result = await pending;
    expect(result.safe).toBe(true);
    expect(mockRecordViolation).not.toHaveBeenCalled();

    // The late risky verdict lands → background enforcement fires.
    hangHandle.release({ risky: true, label: 20004, violationType: "harassment", severity: "warning" });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRecordViolation).toHaveBeenCalledWith("u1", "harassment", "warning");
    const tier1Log = logRows.find((r) => String(r.source) === "tier1:bio");
    expect(tier1Log).toBeDefined();
    expect(tier1Log!.severity).toBe("warning");
  });

  it("Tier-1 hang: benign verdict after budget → fail-open, NO background enforcement", async () => {
    process.env[TIER1_BUDGET_ENV] = "10";
    const hangHandle = mockTier1Hang();
    vi.useFakeTimers();

    const pending = validateContentSafeAsync("borderline text", "bio", { userId: "u1", openid: "o1" });

    await drainUntilTier1Reached(hangHandle);

    await vi.advanceTimersByTimeAsync(10);
    const result = await pending;
    expect(result.safe).toBe(true);

    hangHandle.release({ risky: false });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRecordViolation).not.toHaveBeenCalled();
    expect(logRows).toHaveLength(0);
  });

  // ─── Budget boundary: verdict lands exactly at the deadline ───────────────

  it("budget boundary: verdict lands EXACTLY at the deadline → timeout branch wins the tie, fail-open + background enforcement", async () => {
    process.env[TIER1_BUDGET_ENV] = "100";
    const hangHandle = mockTier1Hang();
    vi.useFakeTimers();

    const pending = validateContentSafeAsync("borderline text", "bio", { userId: "u1", openid: "o1" });

    // Drain microtasks until the Tier-1 client has actually been invoked (the
    // flag-lookup chain is a few microtask hops deep), so the budget timer
    // (delay 100, registered inside validateContentSafeAsync) exists BEFORE we
    // register the client-side resolution timer at the same 100ms deadline.
    // Fake timers fire same-time timers in registration order → the budget
    // timeout branch deterministically wins the tie, which is the designed
    // fail-closed-on-latency behavior.
    await drainUntilTier1Reached(hangHandle);
    setTimeout(() => {
      hangHandle.release({ risky: true, label: 20004, violationType: "harassment", severity: "warning" });
    }, 100);

    await vi.advanceTimersByTimeAsync(100);

    // Request path already failed open at the deadline…
    const result = await pending;
    expect(result.safe).toBe(true);
    // …and the verdict that landed exactly at the edge is enforced in the
    // background — nothing silently dropped.
    await vi.advanceTimersByTimeAsync(0);
    expect(mockRecordViolation).toHaveBeenCalledWith("u1", "harassment", "warning");
    expect(logRows.some((r) => String(r.source) === "tier1:bio")).toBe(true);
  });

  // ─── Tier-0 independence: must-catch corpus under Tier-1 outage ───────────

  it("Tier-0 independence: must-catch corpus fully caught with Tier-1 DOWN; benign control still fail-opens", async () => {
    mockTier1DownNetworkError();

    // Representative must-catch machinery from the sim corpus (real lists):
    // exact Chinese (severe + warning), English exact, leet, separators,
    // emoji separators, repetition, vowel-drop, casemix, zero-width,
    // combining marks, pinyin.
    const corpus: Array<{ text: string; label: string }> = [
      { text: "共产党", label: "zh-severe-exact" },
      { text: "约炮", label: "zh-severe-exact-2" },
      { text: "傻逼", label: "zh-warning-exact" },
      { text: "你妈死了", label: "zh-warning-exact-2" },
      { text: "fuck", label: "en-exact" },
      { text: "shit", label: "en-exact-2" },
      { text: "cnm", label: "pinyin-exact" },
      { text: "nmsl", label: "pinyin-exact-2" },
      { text: "shabi", label: "pinyin-exact-3" },
      { text: "5h17", label: "en-leet" },
      { text: "sh1t", label: "en-leet-2" },
      { text: "f.u.c.k", label: "en-separators" },
      { text: "f\u{1F600}u\u{1F600}c\u{1F600}k", label: "en-emoji-separator" },
      { text: "fuuuuck", label: "en-repeat" },
      { text: "fck", label: "en-vowel-drop" },
      { text: "FuCk", label: "en-casemix" },
      { text: "f\u200Bu\u200Bc\u200Bk", label: "en-zwsp" },
      { text: "s\u0336h\u0336i\u0336t\u0336", label: "en-combining" },
    ];

    const escaped: string[] = [];
    for (const item of corpus) {
      const result = await validateContentSafeAsync(item.text, "bio", { userId: "u1", openid: "o1" });
      if (result.safe || result.violation?.source !== "tier0") {
        escaped.push(item.label);
      }
    }
    expect(escaped).toEqual([]);

    // The deterministic layer never depends on Tier-1 availability: every
    // Tier-0 hit short-circuited, so the DOWN client was never consulted.
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
    // Catch-rate independence is exactly this: the same corpus would be caught
    // identically with Tier-1 up (pure function of the text).
    // Every Tier-0 hit wrote its detection log row (unconditional logging).
    expect(logRows).toHaveLength(corpus.length);

    // Control: a benign text still reaches the (dead) Tier-1 client and
    // fail-opens — the outage does not turn benign text into blocks, and no
    // false-positive log row is written for it.
    const logRowsBeforeControl = logRows.length;
    const benign = await validateContentSafeAsync(CLEAN_TEXT, "bio", { userId: "u1", openid: "o1" });
    expect(benign.safe).toBe(true);
    expect(mockCheckTextWithMsgSecCheck).toHaveBeenCalledTimes(1);
    expect(logRows.length).toBe(logRowsBeforeControl);
  });
});
