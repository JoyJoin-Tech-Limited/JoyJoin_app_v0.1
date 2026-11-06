import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withServerForApp as withServer } from "../test-utils/withServer";

const mockState = {
  notifications: [] as Array<{
    id: string;
    userId: string;
    category: string;
    isRead: boolean;
  }>,
};
let currentUserId: string | null = null;

const notificationsTable = {
  id: Symbol("notifications.id"),
  userId: Symbol("notifications.userId"),
  category: Symbol("notifications.category"),
  isRead: Symbol("notifications.isRead"),
  createdAt: Symbol("notifications.createdAt"),
};

vi.mock("@shared/schema", () => ({
  notifications: notificationsTable,
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ type: "and", conditions }),
  desc: (field: unknown) => ({ type: "desc", field }),
  eq: (field: unknown, value: unknown) => ({ type: "eq", field, value }),
  lt: (field: unknown, value: unknown) => ({ type: "lt", field, value }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: "sql",
    strings,
    values,
  }),
}));

function matchesCondition(row: (typeof mockState.notifications)[number], condition: any): boolean {
  if (condition?.type === "and") {
    return condition.conditions.every((child: unknown) => matchesCondition(row, child));
  }
  if (condition?.type !== "eq") return true;
  if (condition.field === notificationsTable.id) return row.id === condition.value;
  if (condition.field === notificationsTable.userId) return row.userId === condition.value;
  if (condition.field === notificationsTable.category) return row.category === condition.value;
  if (condition.field === notificationsTable.isRead) return row.isRead === condition.value;
  return false;
}

const mockUpdate = vi.fn((table: unknown) => {
  expect(table).toBe(notificationsTable);
  return {
    set: (values: { isRead?: boolean }) => ({
      where: (condition: unknown) => ({
        returning: async (_selection: unknown) => {
          const rows = mockState.notifications.filter((row) => matchesCondition(row, condition));
          for (const row of rows) Object.assign(row, values);
          return rows.map((row) => ({ id: row.id }));
        },
      }),
    }),
  };
});

vi.mock("../db", () => ({
  db: { update: mockUpdate },
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!currentUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    req.session = { ...req.session, userId: currentUserId };
    next();
  },
}));

vi.mock("../adminAuth", () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  requireOperatorOrAbove: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../rateLimiter", () => ({
  aiEndpointLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getNotificationCounts: vi.fn(),
    markNotificationsAsRead: vi.fn(),
  },
}));

const { registerIcebreakerContentRoutes } = await import("../routes/domains/icebreakerContent");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerIcebreakerContentRoutes(app);
  return app;
}

beforeEach(() => {
  currentUserId = "user-owner";
  mockState.notifications = [
    {
      id: "notification-1",
      userId: "user-owner",
      category: "activities",
      isRead: false,
    },
    {
      id: "notification-other",
      userId: "user-other",
      category: "activities",
      isRead: false,
    },
  ];
  mockUpdate.mockClear();
});

describe("POST /api/notifications/:id/read", () => {
  it("marks an owned notification read", async () => {
    await withServer(buildTestApp(), async (_base, request) => {
      const response = await request("/api/notifications/notification-1/read", { method: "POST" });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ success: true });
      expect(mockState.notifications[0].isRead).toBe(true);
      expect(mockState.notifications[1].isRead).toBe(false);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });

  it("succeeds again when the owned notification is already read", async () => {
    await withServer(buildTestApp(), async (_base, request) => {
      const first = await request("/api/notifications/notification-1/read", { method: "POST" });
      const second = await request("/api/notifications/notification-1/read", { method: "POST" });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      await expect(second.json()).resolves.toEqual({ success: true });
      expect(mockState.notifications[0].isRead).toBe(true);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
  });

  it.each(["notification-missing", "notification-other"])(
    "returns the same 404 for a missing or other-user notification (%s)",
    async (notificationId) => {
      await withServer(buildTestApp(), async (_base, request) => {
        const response = await request(`/api/notifications/${notificationId}/read`, { method: "POST" });

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
          error: "Notification not found",
          code: "NOTIFICATION_NOT_FOUND",
        });
        expect(mockState.notifications.every((row) => !row.isRead)).toBe(true);
      });
    },
  );

  it.each(["%20%20%20", "a".repeat(129)])("rejects a malformed notification id (%s)", async (id) => {
    await withServer(buildTestApp(), async (_base, request) => {
      const response = await request(`/api/notifications/${id}/read`, { method: "POST" });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid notification id",
        code: "INVALID_NOTIFICATION_ID",
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  it("requires authentication before touching persistence", async () => {
    currentUserId = null;

    await withServer(buildTestApp(), async (_base, request) => {
      const response = await request("/api/notifications/notification-1/read", { method: "POST" });

      expect(response.status).toBe(401);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockState.notifications[0].isRead).toBe(false);
    });
  });
});
