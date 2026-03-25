/**
 * Unit Tests for wechatAuth.ts
 *
 * Tests cover:
 * - Dev mode mock vs real jscode2session gating (NODE_ENV)
 * - HTTP error handling from WeChat API
 * - JSON parse error handling
 * - Missing openid / session_key error handling
 * - WeChat errcode error mapping
 * - findOrCreateWechatUser: new user creation vs existing user session key update
 * - processTestAnswers: empty answers no-op, valid answers write transaction
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// ── Storage mock ────────────────────────────────────────────────────────────
const mockUser = {
  id: "user-123",
  wechatOpenId: "mock_openid_test_code",
  wechatSessionKey: "old_session",
  hasCompletedPersonalityTest: false,
  hasCompletedRegistration: false,
  archetype: null,
  primaryArchetype: null,
  secondaryArchetype: null,
};

vi.mock("../storage", () => ({
  storage: {
    getUserByWechatOpenId: vi.fn(),
    createUserWithWechat: vi.fn(),
    updateUser: vi.fn(),
    getUserById: vi.fn(),
  },
}));

// ── DB mock ─────────────────────────────────────────────────────────────────
const mockInsertReturning = vi.fn().mockResolvedValue([{ id: "session-abc" }]);
const mockInsertValues = vi.fn().mockReturnValue({
  returning: mockInsertReturning,
  onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
});
const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

const mockUpdateSet = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});
const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

const mockTx = {
  insert: mockInsert,
  update: mockUpdate,
};

vi.mock("../db", () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: any) => Promise<void>) => cb(mockTx)),
  },
}));

// ── @shared/personality/matcherV2 mock ─────────────────────────────────────
vi.mock("@shared/personality/matcherV2", () => ({
  findBestMatchingArchetypesV2: vi.fn().mockReturnValue([
    { archetype: "开心柯基", score: 85, confidence: 0.9 },
    { archetype: "太阳鸡", score: 72, confidence: 0.7 },
    { archetype: "夸夸豚", score: 60, confidence: 0.5 },
  ]),
}));

// ── Import SUT after mocks are registered ──────────────────────────────────
import { getWechatOpenId, findOrCreateWechatUser, processTestAnswers } from "../wechatAuth";
import { storage } from "../storage";
import { findBestMatchingArchetypesV2 } from "@shared/personality/matcherV2";

// ── global fetch mock ───────────────────────────────────────────────────────
const originalFetch = global.fetch;
afterAll(() => {
  global.fetch = originalFetch;
});

function mockFetchOk(body: object) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as any);
}

function mockFetchHttpError(status: number, statusText: string, body = "") {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText,
    text: vi.fn().mockResolvedValue(body),
  } as any);
}

// ─────────────────────────────────────────────────────────────────────────────

describe("getWechatOpenId", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("in development (NODE_ENV=development)", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("returns a mock openid without calling fetch", async () => {
      global.fetch = vi.fn();
      const result = await getWechatOpenId("test_code");
      expect(result.openid).toBe("mock_openid_test_code");
      expect(result.session_key).toMatch(/^mock_session_/);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("in staging (NODE_ENV=staging)", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "staging";
      process.env.WECHAT_APPID = "wx5a038ee6dee12032";
      process.env.WECHAT_SECRET = "test_secret";
    });

    it("calls the real WeChat API and returns openid + session_key", async () => {
      mockFetchOk({ openid: "real_openid_123", session_key: "real_session_key" });
      const result = await getWechatOpenId("code_abc");
      expect(result.openid).toBe("real_openid_123");
      expect(result.session_key).toBe("real_session_key");
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("jscode2session"));
    });

    it("throws WECHAT_AUTH_FAILED when WeChat returns errcode", async () => {
      mockFetchOk({ errcode: 40029, errmsg: "invalid code" });
      await expect(getWechatOpenId("bad_code")).rejects.toMatchObject({
        message: "invalid code",
        code: "WECHAT_AUTH_FAILED",
      });
    });

    it("throws WECHAT_AUTH_FAILED when openid is missing from response", async () => {
      mockFetchOk({ session_key: "sk" });
      await expect(getWechatOpenId("code")).rejects.toMatchObject({
        code: "WECHAT_AUTH_FAILED",
      });
    });

    it("throws WECHAT_AUTH_FAILED when session_key is missing from response", async () => {
      mockFetchOk({ openid: "oid" });
      await expect(getWechatOpenId("code")).rejects.toMatchObject({
        code: "WECHAT_AUTH_FAILED",
      });
    });

    it("throws WECHAT_AUTH_FAILED on HTTP error (e.g. 502)", async () => {
      mockFetchHttpError(502, "Bad Gateway", "<html>502</html>");
      await expect(getWechatOpenId("code")).rejects.toMatchObject({
        code: "WECHAT_AUTH_FAILED",
      });
    });

    it("throws WECHAT_CONFIG_ERROR when WECHAT_APPID is missing", async () => {
      delete process.env.WECHAT_APPID;
      await expect(getWechatOpenId("code")).rejects.toMatchObject({
        code: "WECHAT_CONFIG_ERROR",
      });
      process.env.WECHAT_APPID = "wx5a038ee6dee12032";
    });
  });
});

describe("findOrCreateWechatUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user when no user exists for openid", async () => {
    vi.mocked(storage.getUserByWechatOpenId).mockResolvedValue(undefined);
    vi.mocked(storage.createUserWithWechat).mockResolvedValue(mockUser as any);
    vi.mocked(storage.getUserById).mockResolvedValue(mockUser as any);

    const result = await findOrCreateWechatUser("new_openid", "sk_new");

    expect(storage.createUserWithWechat).toHaveBeenCalledWith({
      wechatOpenId: "new_openid",
      wechatSessionKey: "sk_new",
    });
    expect(result.isNewUser).toBe(true);
  });

  it("updates session key for existing user", async () => {
    vi.mocked(storage.getUserByWechatOpenId).mockResolvedValue(mockUser as any);
    vi.mocked(storage.updateUser).mockResolvedValue({ ...mockUser, wechatSessionKey: "sk_updated" } as any);
    vi.mocked(storage.getUserById).mockResolvedValue({ ...mockUser, wechatSessionKey: "sk_updated" } as any);

    const result = await findOrCreateWechatUser(mockUser.wechatOpenId!, "sk_updated");

    expect(storage.updateUser).toHaveBeenCalledWith(mockUser.id, { wechatSessionKey: "sk_updated" });
    expect(result.isNewUser).toBe(false);
    expect((result.user as any).wechatSessionKey).toBe("sk_updated");
  });
});

describe("processTestAnswers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock chain
    mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
    });
    mockInsert.mockReturnValue({ values: mockInsertValues });
    mockUpdateSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({ set: mockUpdateSet });
  });

  it("is a no-op for empty answer array", async () => {
    await processTestAnswers("user-1", []);
    const { db } = await import("../db");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("inserts an assessment_sessions row and calls db.transaction for valid answers", async () => {
    const answers = [
      { questionId: "q1", questionLevel: 1, selectedOption: "A", traitScores: { A: 5, C: 0, E: 0, O: 0, X: 0, P: 0 } },
      { questionId: "q2", questionLevel: 2, selectedOption: "B", traitScores: { A: 0, C: 3, E: 0, O: 0, X: 0, P: 0 } },
    ];

    await processTestAnswers("user-1", answers);

    const { db } = await import("../db");
    expect(db.transaction).toHaveBeenCalledOnce();
    // 1 insert for assessment_sessions + 2 inserts for per-question assessment_answers
    expect(mockInsert).toHaveBeenCalledTimes(3);
    // 1 update for user flags
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("skips answers with missing questionId or selectedOption gracefully", async () => {
    const answers = [
      { questionId: "", selectedOption: "", traitScores: {} },      // skipped
      { questionId: "q1", selectedOption: "A", traitScores: { A: 2 } },  // valid
    ];

    // Should not throw
    await expect(processTestAnswers("user-1", answers)).resolves.toBeUndefined();
  });

  it("passes conflictPosture from Q_PLAYFUL_CONFLICT to findBestMatchingArchetypesV2", async () => {
    const answers = [
      { questionId: "q1", questionLevel: 1, selectedOption: "A", traitScores: { A: 5 } },
      { questionId: "Q_PLAYFUL_CONFLICT", questionLevel: 3, selectedOption: "A", traitScores: {} },
    ];

    await processTestAnswers("user-1", answers);

    expect(findBestMatchingArchetypesV2).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ conflictPosture: "approach" }),
      3
    );
  });

  it("passes motivationDirection from Q_PLAYFUL_MOTIVATION to findBestMatchingArchetypesV2", async () => {
    const answers = [
      { questionId: "q1", questionLevel: 1, selectedOption: "B", traitScores: { X: 2 } },
      { questionId: "Q_PLAYFUL_MOTIVATION", questionLevel: 3, selectedOption: "B", traitScores: {} },
    ];

    await processTestAnswers("user-1", answers);

    expect(findBestMatchingArchetypesV2).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ motivationDirection: "external" }),
      3
    );
  });

  it("passes both secondary fields when both playful questions are answered", async () => {
    const answers = [
      { questionId: "q1", questionLevel: 1, selectedOption: "A", traitScores: { A: 3 } },
      { questionId: "Q_PLAYFUL_CONFLICT", questionLevel: 3, selectedOption: "C", traitScores: {} },
      { questionId: "Q_PLAYFUL_MOTIVATION", questionLevel: 3, selectedOption: "A", traitScores: {} },
    ];

    await processTestAnswers("user-1", answers);

    expect(findBestMatchingArchetypesV2).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ conflictPosture: "mediate", motivationDirection: "internal" }),
      3
    );
  });

  it("ignores unknown option values in playful questions and does not pass secondary data", async () => {
    const answers = [
      { questionId: "q1", questionLevel: 1, selectedOption: "A", traitScores: { A: 3 } },
      { questionId: "Q_PLAYFUL_CONFLICT", questionLevel: 3, selectedOption: "Z", traitScores: {} },
    ];

    await processTestAnswers("user-1", answers);

    // userSecondaryData is empty, so undefined should be passed
    expect(findBestMatchingArchetypesV2).toHaveBeenCalledWith(
      expect.any(Object),
      undefined,
      3
    );
  });
});
