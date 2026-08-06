import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Decision-table unit tests for the severity-gated content-moderation policy
 * (Sprint Contract content-mod-s1, ratified 2026-08-06).
 *
 * Rows under test:
 *   1. T0=severe                    → BLOCK (unconditional — no flag weakens)
 *   2. T0=warning + F=ON            → BLOCK
 *   3. T0=warning + F=OFF           → ALLOW + log only, NO recordViolation
 *   4. T0=clean + T1=benign         → ALLOW
 *   5. T0=clean + T1=risky          → BLOCK
 *   6. T0=clean + T1=unavailable    → ALLOW (fail-open)
 *
 * The REAL featureFlags module is used here (with a mocked DB) so the
 * flag-default and fallback semantics are exercised for real; env vars control
 * flag state and refreshFeatureFlag() keeps the sync cache hygienic.
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
  validateContentSafe,
  validateContentSafeAsync,
  warnIfSevereFailClosedDisabled,
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

// Real Tier-0 keywords (contentFilter.ts): severe = 共产党, warning = 傻逼.
const SEVERE_TEXT = "共产党";
const WARNING_TEXT = "傻逼";
const CLEAN_TEXT = "今天天气不错，一起喝杯奶茶吧";

describe("contentSafety decision table (content-mod-s1)", () => {
  beforeEach(async () => {
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
    delete process.env[SEVERE_FLAG_ENV];
    delete process.env[MSGSEC_FLAG_ENV];
  });

  // ─── Flag registration ────────────────────────────────────────────────────

  it("registers the flag in FLAG_ENV_MAP and DEFAULT_FLAG_VALUES", () => {
    expect(FLAG_ENV_MAP[SEVERE_FLAG]).toBe(SEVERE_FLAG_ENV);
    expect(DEFAULT_FLAG_VALUES[SEVERE_FLAG]).toBe(true);
  });

  it("flag default resolves TRUE with no DB row and no env var", async () => {
    delete process.env[SEVERE_FLAG_ENV];
    expect(await getFeatureFlag(SEVERE_FLAG)).toBe(true);
  });

  // ─── Row 1: severe → unconditional block ──────────────────────────────────

  it("row 1: severe blocks even when the severe-fail-closed flag is OFF", async () => {
    process.env[SEVERE_FLAG_ENV] = "false";
    await refreshFeatureFlag(SEVERE_FLAG);

    const result = await validateContentSafeAsync(SEVERE_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(false);
    expect(result.code).toBe("CONTENT_VIOLATION");
    expect(result.violation!.source).toBe("tier0");
    expect(result.violation!.severity).toBe("severe");
    expect(logRows).toHaveLength(1);
    expect(logRows[0].severity).toBe("severe");
    // Tier-1 is never consulted for tier-0 violations.
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  it("row 1 invariant: severe blocks even when contentModerationMsgSecCheckEnabled=false", async () => {
    process.env[MSGSEC_FLAG_ENV] = "false";

    const result = await validateContentSafeAsync(SEVERE_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(false);
    expect(result.violation!.source).toBe("tier0");
    expect(result.violation!.severity).toBe("severe");
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  // ─── Row 2: warning + F ON → block ────────────────────────────────────────

  it("row 2: warning blocks when the severe-fail-closed flag is ON (default)", async () => {
    const result = await validateContentSafeAsync(WARNING_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(false);
    expect(result.code).toBe("CONTENT_VIOLATION");
    expect(result.violation!.source).toBe("tier0");
    expect(result.violation!.severity).toBe("warning");
    expect(logRows).toHaveLength(1);
    expect(logRows[0].severity).toBe("warning");
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  it("row 2 sync: validateContentSafe blocks warning when F is ON", () => {
    const result = validateContentSafe(WARNING_TEXT, "bio");
    expect(result.safe).toBe(false);
    expect(result.violation!.severity).toBe("warning");
  });

  // ─── Row 3: warning + F OFF → allow + log, NO recordViolation ─────────────

  it("row 3: warning is ALLOWED when F is OFF — log written, no recordViolation, no tier-1 consult", async () => {
    process.env[SEVERE_FLAG_ENV] = "false";
    await refreshFeatureFlag(SEVERE_FLAG);

    const result = await validateContentSafeAsync(WARNING_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(true);
    // Detection + logging stay unconditional (emergency-rollback visibility).
    expect(logRows).toHaveLength(1);
    expect(logRows[0].severity).toBe("warning");
    // The wrapper never escalates sync-returned verdicts — and here there is
    // nothing to escalate: ALLOW means the route must not recordViolation.
    expect(mockRecordViolation).not.toHaveBeenCalled();
    // Short-circuit preserved: warning-tier text (even when allowed) never
    // reaches Tier-1 — msgSecCheck is enabled in this test, yet not consulted.
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  it("row 3 sync: validateContentSafe allows warning when F is OFF", async () => {
    process.env[SEVERE_FLAG_ENV] = "false";
    await refreshFeatureFlag(SEVERE_FLAG);

    const result = validateContentSafe(WARNING_TEXT, "bio");
    expect(result.safe).toBe(true);
    expect(logRows).toHaveLength(1);
  });

  // ─── Rows 4–6: Tier-1 semantics (regression-lock) ─────────────────────────

  it("row 4: clean text + benign tier-1 verdict → ALLOW", async () => {
    mockCheckTextWithMsgSecCheck.mockResolvedValue({ risky: false });

    const result = await validateContentSafeAsync(CLEAN_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(true);
    expect(logRows).toHaveLength(0);
    expect(mockRecordViolation).not.toHaveBeenCalled();
  });

  it("row 5: clean text + risky tier-1 verdict → BLOCK (tier1 log, no recordViolation — route escalates)", async () => {
    mockCheckTextWithMsgSecCheck.mockResolvedValue({
      risky: true,
      label: 20004,
      violationType: "harassment",
      severity: "warning",
    });

    const result = await validateContentSafeAsync("evasive abuse", "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(false);
    expect(result.code).toBe("CONTENT_VIOLATION");
    expect(result.violation!.source).toBe("tier1");
    expect(logRows).toHaveLength(1);
    expect(logRows[0].source).toBe("tier1:bio");
    // Sync-returned tier-1 violations are escalated by the route, never the
    // wrapper — no double-counting.
    expect(mockRecordViolation).not.toHaveBeenCalled();
  });

  it("row 6: clean text + unavailable tier-1 verdict → ALLOW (fail-open)", async () => {
    mockCheckTextWithMsgSecCheck.mockResolvedValue(null);

    const result = await validateContentSafeAsync(CLEAN_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(true);
    expect(logRows).toHaveLength(0);
  });

  it("row 6: tier-1 disabled (contentModerationMsgSecCheckEnabled=false) → ALLOW, no consult", async () => {
    process.env[MSGSEC_FLAG_ENV] = "false";

    const result = await validateContentSafeAsync(CLEAN_TEXT, "bio", { userId: "u1", openid: "o1" });

    expect(result.safe).toBe(true);
    expect(mockCheckTextWithMsgSecCheck).not.toHaveBeenCalled();
  });

  // ─── Startup warning ──────────────────────────────────────────────────────

  it("startup warning fires when the severe-fail-closed flag is OFF", async () => {
    process.env[SEVERE_FLAG_ENV] = "false";
    await refreshFeatureFlag(SEVERE_FLAG);

    warnIfSevereFailClosedDisabled();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining(SEVERE_FLAG),
    );
  });

  it("no startup warning when the flag is ON", async () => {
    warnIfSevereFailClosedDisabled();
    await new Promise((resolve) => setTimeout(resolve, 20));

    const warnCalls = mockLoggerWarn.mock.calls.filter((call) =>
      String(call[0]).includes(SEVERE_FLAG),
    );
    expect(warnCalls).toHaveLength(0);
  });
});
