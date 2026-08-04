/**
 * Tests for PATCH /api/profile bio validation and content-safety gating.
 *
 * Coverage:
 *   - Accepts and persists a trimmed bio ≤100 chars
 *   - Clears empty/whitespace-only bios to null
 *   - Rejects bios >100 chars
 *   - Runs validateContentSafe on non-empty bios only
 *   - Logs validation failures
 */

import express from "express";
import { createWithServer } from '../test-utils/withServer';
import session from "express-session";

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted by vitest) ──────────────────────────────────────────────

const mockUpdateFullProfile = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock("../storage", () => ({
  storage: {
    updateFullProfile: mockUpdateFullProfile,
    updateUser: mockUpdateUser,
  },
}));

const mockQueueSemanticProfileRecompute = vi.fn();

vi.mock("../userSemanticProfileService", () => ({
  queueSemanticProfileRecompute: mockQueueSemanticProfileRecompute,
}));

const mockValidateContentSafeAsync = vi.fn();
const mockContentViolationResponse = vi.fn();

vi.mock("../lib/contentSafety", () => ({
  validateContentSafeAsync: mockValidateContentSafeAsync,
  contentViolationResponse: mockContentViolationResponse,
}));

const mockRecordViolation = vi.fn();

vi.mock("../abuseDetection", () => ({
  recordViolation: mockRecordViolation,
}));

const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("../lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

vi.mock("../db", () => ({
  db: {},
}));

// ── Imports after mocks ────────────────────────────────────────────────────

const { registerProfileRoutes } = await import("../routes/domains/profile");

// ── Test helpers ───────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.post("/__test__/login", (req, res) => {
    req.session.userId = "user-123";
    req.session.save(() => {
      res.json({ sessionId: req.sessionID });
    });
  });

  registerProfileRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PATCH /api/profile bio validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateContentSafeAsync.mockResolvedValue({ safe: true });
    mockUpdateFullProfile.mockResolvedValue({ id: "user-123", bio: "persisted" });
  });

  it("returns 401 for unauthenticated requests", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: "hello" }),
      });
      expect(res.status).toBe(401);
    });
  });

  it("accepts and persists a trimmed bio up to 100 chars", async () => {
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: "  喜欢轻松聊天  " }),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateFullProfile).toHaveBeenCalledTimes(1);
      const callArg = mockUpdateFullProfile.mock.calls[0][1];
      expect(callArg.bio).toBe("喜欢轻松聊天");

      expect(mockValidateContentSafeAsync).toHaveBeenCalledWith("喜欢轻松聊天", "bio", { userId: "user-123" });
    });
  });

  it("clears an empty bio to null", async () => {
    mockUpdateFullProfile.mockResolvedValue({ id: "user-123", bio: null });

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: "" }),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateFullProfile).toHaveBeenCalledTimes(1);
      const callArg = mockUpdateFullProfile.mock.calls[0][1];
      expect(callArg.bio).toBeNull();
      const body = (await res.json()) as { bio: null };
      expect(body.bio).toBeNull();
      expect(mockValidateContentSafeAsync).not.toHaveBeenCalledWith(expect.anything(), "bio", expect.anything());
    });
  });

  it("clears a whitespace-only bio to null", async () => {
    mockUpdateFullProfile.mockResolvedValue({ id: "user-123", bio: null });

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: "     " }),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateFullProfile).toHaveBeenCalledTimes(1);
      const callArg = mockUpdateFullProfile.mock.calls[0][1];
      expect(callArg.bio).toBeNull();
      const body = (await res.json()) as { bio: null };
      expect(body.bio).toBeNull();
      expect(mockValidateContentSafeAsync).not.toHaveBeenCalledWith(expect.anything(), "bio", expect.anything());
    });
  });

  it("accepts a bio together with other profile fields", async () => {
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          displayName: "Joy",
          currentCity: "深圳",
          bio: "喜欢轻松聊天",
        }),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateFullProfile).toHaveBeenCalledTimes(1);
      const callArg = mockUpdateFullProfile.mock.calls[0][1];
      expect(callArg.bio).toBe("喜欢轻松聊天");
      expect(callArg.displayName).toBe("Joy");
      expect(callArg.currentCity).toBe("深圳");
    });
  });

  it("rejects a bio longer than 100 chars", async () => {
    const longBio = "a".repeat(101);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: longBio }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain("100");
      expect(mockUpdateFullProfile).not.toHaveBeenCalled();
    });
  });

  it("accepts a bio of exactly 100 chars", async () => {
    const exactBio = "a".repeat(100);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: exactBio }),
      });

      expect(res.status).toBe(200);
      expect(mockUpdateFullProfile).toHaveBeenCalledTimes(1);
      const callArg = mockUpdateFullProfile.mock.calls[0][1];
      expect(callArg.bio).toBe(exactBio);
    });
  });

  it("rejects a bio that fails content-safety filtering", async () => {
    mockValidateContentSafeAsync.mockImplementation(async (value: string, field: string) => {
      if (field === "bio" && value.includes("blocked")) {
        return {
          safe: false,
          code: "CONTENT_VIOLATION" as const,
          violation: {
            type: "harassment" as const,
            severity: "warning" as const,
            field: "bio",
            message: "内容包含不当用语",
            matchedKeywords: ["blocked"],
          },
        };
      }
      return { safe: true };
    });

    mockContentViolationResponse.mockReturnValue({
      status: 400 as const,
      body: {
        error: "内容包含不当用语",
        code: "CONTENT_VIOLATION",
        violation: {
          type: "harassment",
          severity: "warning",
          field: "bio",
          message: "内容包含不当用语",
          matchedKeywords: ["blocked"],
        },
      },
    });

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: "this is blocked content" }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("CONTENT_VIOLATION");
      expect(mockUpdateFullProfile).not.toHaveBeenCalled();
      expect(mockRecordViolation).toHaveBeenCalledWith("user-123", "harassment", "warning");
    });
  });

  it("logs validation failures", async () => {
    const longBio = "a".repeat(101);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      await fetch(`${baseUrl}/api/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: longBio }),
      });

      const errorLog = mockLoggerError.mock.calls.find(
        (call) => call[0] === "Validation failed",
      );
      expect(errorLog).toBeDefined();
      expect(errorLog![1].userId).toBe("user-123");
    });
  });
});
