import express from "express";
import { createWithServer } from '../test-utils/withServer';
import session from "express-session";

import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => {
  // Explicit signature matching lib/logger's Logger interface (info/error take
  // a message plus optional structured context). Annotating the bare vi.fn()
  // stubs keeps the mock assignable under stricter mock-typing inference.
  const loggerInfo = vi.fn<(message: string, ctx?: Record<string, unknown>) => void>();
  const loggerError = vi.fn<(message: string, ctx?: Record<string, unknown>) => void>();
  const loggerWarn = vi.fn();

  return {
    getGroupMembershipContext: vi.fn(),
    upsertEventGroupOutcome: vi.fn(),
    deriveMatchHistoryAndRefreshCalibration: vi.fn(),
    validateContentSafeAsync: vi.fn(),
    recordViolation: vi.fn(),
    logAITrace: vi.fn(),
    loggerChild: vi.fn(() => ({
      info: loggerInfo,
      error: loggerError,
      warn: loggerWarn,
    })),
    loggerInfo,
    loggerError,
    loggerWarn,
  };
});

vi.mock("../repositories/eventGroupOutcomesRepo", () => ({
  eventGroupOutcomesRepo: {
    getGroupMembershipContext: routeMocks.getGroupMembershipContext,
    upsertEventGroupOutcome: routeMocks.upsertEventGroupOutcome,
  },
}));

vi.mock("../services/matchHistoryDerivation", () => ({
  deriveMatchHistoryAndRefreshCalibration: routeMocks.deriveMatchHistoryAndRefreshCalibration,
}));

vi.mock("../lib/contentSafety", () => ({
  validateContentSafeAsync: routeMocks.validateContentSafeAsync,
  contentViolationResponse: vi.fn(),
}));

vi.mock("../abuseDetection", () => ({
  recordViolation: routeMocks.recordViolation,
}));

vi.mock("../lib/aiTraceLogger", () => ({
  logAITrace: routeMocks.logAITrace,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    child: routeMocks.loggerChild,
    info: routeMocks.loggerInfo,
    error: routeMocks.loggerError,
    warn: routeMocks.loggerWarn,
  },
}));

const { registerEventGroupOutcomeRoutes } = await import("../routes/domains/eventGroupOutcomes");

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

  app.post("/__test__/login/:userId", (req, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true, userId: req.params.userId }));
  });

  registerEventGroupOutcomeRoutes(app);
  return app;
}
const withServer = createWithServer(createApp);

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

async function login(baseUrl: string, userId: string) {
  const response = await fetch(`${baseUrl}/__test__/login/${userId}`, { method: "POST" });
  return cookieHeader(response);
}

function buildValidPayload() {
  return {
    groupId: "group-1",
    atmosphereScore: 4,
    wouldMeetAgain: true,
    connectionRadar: {
      "member-2": 5,
    },
    icebreakerRatings: {
      warmup_intro: "helpful",
    },
    freeTextSignal: "Great chemistry",
  };
}

describe("event group outcome routes", () => {
  beforeEach(() => {
    routeMocks.getGroupMembershipContext.mockReset();
    routeMocks.upsertEventGroupOutcome.mockReset();
    routeMocks.deriveMatchHistoryAndRefreshCalibration.mockReset();
    // Fire-and-forget derivation: the route calls .catch on the returned
    // promise, so the mock must resolve (never undefined).
    routeMocks.deriveMatchHistoryAndRefreshCalibration.mockResolvedValue({
      groupId: "group-1",
      status: "derived",
      pairCount: 1,
      insertedCount: 1,
      updatedCount: 0,
    });
    routeMocks.validateContentSafeAsync.mockReset();
    routeMocks.validateContentSafeAsync.mockResolvedValue({ safe: true });
    routeMocks.recordViolation.mockReset();
    routeMocks.logAITrace.mockReset();
    routeMocks.loggerChild.mockClear();
    routeMocks.loggerInfo.mockClear();
    routeMocks.loggerError.mockClear();
    routeMocks.loggerWarn.mockClear();
  });

  it("requires authentication for submissions", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/event-pools/pool-1/group-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildValidPayload()),
      });

      expect(response.status).toBe(401);
      expect(routeMocks.getGroupMembershipContext).not.toHaveBeenCalled();
    });
  });

  it("rejects invalid payloads before repository access", async () => {
    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "member-1");
      const response = await fetch(`${baseUrl}/api/event-pools/pool-1/group-outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          ...buildValidPayload(),
          atmosphereScore: 7,
        }),
      });

      expect(response.status).toBe(400);
      expect(routeMocks.getGroupMembershipContext).not.toHaveBeenCalled();
      expect(routeMocks.deriveMatchHistoryAndRefreshCalibration).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({
        message: "Invalid group outcome submission",
      });
    });
  });

  it("rejects submissions from users outside the group", async () => {
    routeMocks.getGroupMembershipContext.mockResolvedValue({
      group: { id: "group-1", poolId: "pool-1" },
      memberUserIds: ["member-2", "member-3"],
      isMember: false,
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "member-1");
      const response = await fetch(`${baseUrl}/api/event-pools/pool-1/group-outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify(buildValidPayload()),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        message: "Not a member of this group",
      });
      expect(routeMocks.upsertEventGroupOutcome).not.toHaveBeenCalled();
    });
  });

  it("rejects connection radar entries that target invalid group members", async () => {
    routeMocks.getGroupMembershipContext.mockResolvedValue({
      group: { id: "group-1", poolId: "pool-1" },
      memberUserIds: ["member-1", "member-2", "member-3"],
      isMember: true,
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "member-1");
      const response = await fetch(`${baseUrl}/api/event-pools/pool-1/group-outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({
          ...buildValidPayload(),
          connectionRadar: {
            stranger: 2,
          },
        }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        message: "Connection radar must only reference other members of this group",
      });
      expect(routeMocks.upsertEventGroupOutcome).not.toHaveBeenCalled();
    });
  });

  it("creates a new submission for an authenticated group member and emits an AI trace log", async () => {
    routeMocks.getGroupMembershipContext.mockResolvedValue({
      group: { id: "group-1", poolId: "pool-1" },
      memberUserIds: ["member-1", "member-2", "member-3"],
      isMember: true,
    });
    routeMocks.upsertEventGroupOutcome.mockResolvedValue({
      outcome: {
        id: "outcome-1",
        submittedAt: new Date("2026-04-02T11:00:00.000Z"),
      },
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "member-1");
      const response = await fetch(`${baseUrl}/api/event-pools/pool-1/group-outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify(buildValidPayload()),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        message: "Group outcome submitted",
        duplicateSubmissionStrategy: "replace",
        outcomeId: "outcome-1",
      });
      expect(routeMocks.upsertEventGroupOutcome).toHaveBeenCalledWith({
        poolId: "pool-1",
        groupId: "group-1",
        submittedBy: "member-1",
        atmosphereScore: 4,
        wouldMeetAgain: true,
        connectionRadar: {
          "member-2": 5,
        },
        icebreakerRatings: {
          warmup_intro: "helpful",
        },
        freeTextSignal: "Great chemistry",
      });
      expect(routeMocks.logAITrace).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "event_group_outcomes",
          feature: "submitGroupOutcome",
          provider: null,
          success: true,
        }),
      );
      // W1: successful submissions trigger fire-and-forget match-history derivation.
      expect(routeMocks.deriveMatchHistoryAndRefreshCalibration).toHaveBeenCalledWith("group-1");
    });
  });

  it("returns the same success contract for duplicate submissions", async () => {
    routeMocks.getGroupMembershipContext.mockResolvedValue({
      group: { id: "group-1", poolId: "pool-1" },
      memberUserIds: ["member-1", "member-2"],
      isMember: true,
    });
    routeMocks.upsertEventGroupOutcome.mockResolvedValue({
      outcome: {
        id: "outcome-1",
        submittedAt: new Date("2026-04-02T11:05:00.000Z"),
      },
    });

    await withServer(async (baseUrl) => {
      const cookie = await login(baseUrl, "member-1");
      const response = await fetch(`${baseUrl}/api/event-pools/pool-1/group-outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify(buildValidPayload()),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        message: "Group outcome submitted",
        duplicateSubmissionStrategy: "replace",
        outcomeId: "outcome-1",
      });
      expect(routeMocks.upsertEventGroupOutcome).toHaveBeenCalledWith({
        poolId: "pool-1",
        groupId: "group-1",
        submittedBy: "member-1",
        atmosphereScore: 4,
        wouldMeetAgain: true,
        connectionRadar: {
          "member-2": 5,
        },
        icebreakerRatings: {
          warmup_intro: "helpful",
        },
        freeTextSignal: "Great chemistry",
      });
    });
  });
});
