/**
 * Tests for POST /api/user/interests response shape.
 *
 * Coverage:
 *   - Returns the server-computed onboarding nextStep (top-level, additive)
 *     so onboarding clients can navigate without a follow-up /api/auth/user
 *     round-trip.
 *   - Returns nextStep: null when the post-transaction user read fails to
 *     produce a row (client falls back to refetching auth state).
 */

import express from "express";
import { createWithServer } from '../test-utils/withServer';
import session from "express-session";

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted by vitest) ──────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const interestRecord = { id: "interest-1", userId: "user-123", totalHeat: 38 };
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([interestRecord])),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  };
  return {
    tx,
    findFirstUser: vi.fn(),
  };
});

vi.mock("../db", () => ({
  db: {
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(mocks.tx)),
    query: {
      users: {
        findFirst: mocks.findFirstUser,
      },
    },
  },
}));

vi.mock("../storage", () => ({
  storage: {},
}));

const mockQueueSemanticProfileRecompute = vi.fn();

vi.mock("../userSemanticProfileService", () => ({
  queueSemanticProfileRecompute: mockQueueSemanticProfileRecompute,
}));

vi.mock("../lib/contentSafety", () => ({
  validateContentSafeAsync: vi.fn(() => Promise.resolve({ safe: true })),
  contentViolationResponse: vi.fn(),
}));

vi.mock("../abuseDetection", () => ({
  recordViolation: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
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

const validInterestsBody = {
  interests: {
    totalHeat: 38,
    totalSelections: 3,
    categoryHeat: { food: 28, play: 10 },
    selections: [
      { topicId: 'food_hotpot', emoji: '🍜', label: '火锅', fullName: '美食 · 火锅', category: '美食', categoryId: 'food', level: 3, heat: 25 },
      { topicId: 'food_brunch', emoji: '🍜', label: '早午餐', fullName: '美食 · 早午餐', category: '美食', categoryId: 'food', level: 1, heat: 3 },
      { topicId: 'play_boardgames', emoji: '🎮', label: '桌游', fullName: '玩乐 · 桌游', category: '玩乐', categoryId: 'play', level: 2, heat: 10 },
    ],
  },
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POST /api/user/interests nextStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes the computed nextStep at the top level of the response", async () => {
    // Post-transaction user row: personality test done, essential data
    // complete, interests carousel now complete, profile review pending →
    // nextStep must be 'profile-review'.
    mocks.findFirstUser.mockResolvedValue({
      id: "user-123",
      hasCompletedPersonalityTest: true,
      hasCompletedRegistration: true,
      displayName: "Joy",
      gender: "female",
      currentCity: "深圳",
      hasCompletedInterestsCarousel: true,
      hasSeenProfileReview: false,
      onboardingCheckpoint: null,
    });

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/user/interests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(validInterestsBody),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { interestId: string; userId: string; totalHeat: number };
        nextStep: string;
      };
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({ interestId: "interest-1", userId: "user-123", totalHeat: 38 });
      expect(body.nextStep).toBe("profile-review");
    });
  });

  it("returns nextStep: null when the post-transaction user read yields no row", async () => {
    mocks.findFirstUser.mockResolvedValue(null);

    await withServer(async (baseUrl) => {
      const loginRes = await fetch(`${baseUrl}/__test__/login`, { method: "POST" });
      const cookie = cookieHeader(loginRes);

      const res = await fetch(`${baseUrl}/api/user/interests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(validInterestsBody),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; nextStep: string | null };
      expect(body.success).toBe(true);
      expect(body.nextStep).toBeNull();
    });
  });
});
