import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => {
  const loggerInfo = vi.fn();
  const loggerError = vi.fn();

  return {
    getGroupMembershipContext: vi.fn(),
    upsertEventGroupOutcome: vi.fn(),
    logAITrace: vi.fn(),
    loggerChild: vi.fn(() => ({
      info: loggerInfo,
      error: loggerError,
    })),
    loggerInfo,
    loggerError,
  };
});

vi.mock("../repositories/eventGroupOutcomesRepo", () => ({
  eventGroupOutcomesRepo: {
    getGroupMembershipContext: routeMocks.getGroupMembershipContext,
    upsertEventGroupOutcome: routeMocks.upsertEventGroupOutcome,
  },
}));

vi.mock("../lib/aiTraceLogger", () => ({
  logAITrace: routeMocks.logAITrace,
}));

vi.mock("../lib/logger", () => ({
  logger: {
    child: routeMocks.loggerChild,
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

async function withServer<T>(fn: (baseUrl: string) => Promise<T>) {
  const app = createApp();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  try {
    const { port } = server.address() as AddressInfo;
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

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
    routeMocks.logAITrace.mockReset();
    routeMocks.loggerChild.mockClear();
    routeMocks.loggerInfo.mockClear();
    routeMocks.loggerError.mockClear();
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
      replacedExisting: false,
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

      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        message: "Group outcome submitted",
        duplicateSubmissionStrategy: "replace",
        replacedExisting: false,
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
    });
  });

  it("updates the existing submission when the same member submits again", async () => {
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
      replacedExisting: true,
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
        message: "Group outcome updated",
        duplicateSubmissionStrategy: "replace",
        replacedExisting: true,
      });
    });
  });
});
