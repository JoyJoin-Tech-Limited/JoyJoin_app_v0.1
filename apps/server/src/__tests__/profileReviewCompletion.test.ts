/**
 * Tests for POST /api/profile-review/complete bio handling.
 *
 * Coverage:
 *   - Accepts an optional bio and persists it alongside profile-review completion
 *   - Rejects bios >100 chars
 *   - Runs validateContentSafe on non-empty bios
 *   - Leaves existing bio unchanged when bio is omitted
 *   - Logs bio updates at info level
 */

import express from "express";
import { createWithServer } from '../test-utils/withServer';
import session from "express-session";

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted by vitest) ──────────────────────────────────────────────

vi.mock("../db", () => {
  const db = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve([{ id: "user-123" }])),
        })),
      })),
    })),
    query: {
      users: {
        findFirst: vi.fn(() => Promise.resolve(null)),
      },
    },
    transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(db)),
  };
  return { db };
});

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

vi.mock("../lib/wecomNotifications/onboarding", () => ({
  notifyOnboardingComplete: vi.fn(),
}));

vi.mock("../lib/computeOnboardingNextStep", () => ({
  computeOnboardingNextStep: vi.fn(() => "discover"),
}));

// ── Imports after mocks ────────────────────────────────────────────────────

import { db } from "../db";

const { registerOnboardingRoutes } = await import("../routes/domains/onboarding");

const mockFindFirstUser = db.query.users.findFirst as unknown as ReturnType<typeof vi.fn>;

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

  registerOnboardingRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/profile-review/complete bio handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateContentSafeAsync.mockResolvedValue({ safe: true });
  });

  it("returns 401 for unauthenticated requests", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/profile-review/complete`, {
        method: "POST",
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

      const res = await fetch(`${baseUrl}/api/profile-review/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: "  喜欢轻松聊天  " }),
      });

      expect(res.status).toBe(200);
      expect(mockValidateContentSafeAsync).toHaveBeenCalledWith("喜欢轻松聊天", "bio", { userId: "user-123" });
      const infoLog = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "[Onboarding] Profile review completed",
      );
      expect(infoLog).toBeDefined();
      expect(infoLog![1]).toMatchObject({ userId: "user-123", bioLength: 6, bioUpdated: true });
    });
  });

  it("does not send bio when body is omitted", async () => {
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile-review/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      expect(mockValidateContentSafeAsync).not.toHaveBeenCalled();
      const infoLog = mockLoggerInfo.mock.calls.find(
        (call) => call[0] === "[Onboarding] Profile review completed",
      );
      expect(infoLog![1]).toMatchObject({ userId: "user-123", bioLength: 0, bioUpdated: false });
    });
  });

  it("rejects a bio longer than 100 chars", async () => {
    const longBio = "a".repeat(101);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile-review/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: longBio }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { message: string; field: string };
      expect(body.message).toContain("100");
      expect(body.field).toBe("bio");
      expect(mockValidateContentSafeAsync).not.toHaveBeenCalled();
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

      const res = await fetch(`${baseUrl}/api/profile-review/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ bio: "this is blocked content" }),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe("CONTENT_VIOLATION");
      expect(mockRecordViolation).toHaveBeenCalledWith("user-123", "harassment", "warning");
    });
  });

  it("includes the computed nextStep in the response when the user row is available", async () => {
    mockFindFirstUser.mockResolvedValueOnce({ id: "user-123", hasSeenProfileReview: true });

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile-review/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; hasSeenProfileReview: boolean; nextStep: string };
      // computeOnboardingNextStep is mocked above to return "discover".
      expect(body).toMatchObject({ success: true, hasSeenProfileReview: true, nextStep: "discover" });
    });
  });

  it("returns nextStep: null when the post-write user row cannot be read", async () => {
    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/profile-review/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { nextStep: string | null };
      expect(body.nextStep).toBeNull();
    });
  });
});
