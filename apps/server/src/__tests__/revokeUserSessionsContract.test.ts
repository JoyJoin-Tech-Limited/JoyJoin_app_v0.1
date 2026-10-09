/**
 * Sprint Contract launch-qa-hs12-revoke-sessions (Tier 2) — HS-12.
 *
 * Locks all four session-revocation call sites (admin ban, permaban, admin
 * delete-user-data, admin account disable) and their failure semantics:
 * fail-open for ban/permaban/disable (warn-logged; the per-request gates stay
 * the authority), fail-closed inside the delete-user-data transaction.
 * Removing any wire fails this test.
 */
import express from "express";
import session from "express-session";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWithServer } from "../test-utils/withServer";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function renderSql(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (typeof chunk === "string") return chunk;
      const value = (chunk as { value?: unknown })?.value;
      if (Array.isArray(value)) return value.join("");
      if (chunk && (chunk as object).constructor === String) return String(chunk);
      return "";
    })
    .join("");
}

const dbMock = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../db", () => ({ db: dbMock }));

vi.mock("../lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
    getAdminAccountById: vi.fn(),
    updateAdminAccount: vi.fn(),
  },
}));

vi.mock("../lib/adminAuditLogger", () => ({ logAdminAudit: vi.fn() }));
vi.mock("../matchingMetrics", () => ({ getMatchingMetricsSnapshot: vi.fn(() => ({})) }));
vi.mock("../lib/wecomNotifications", () => ({ notifyAdminAction: vi.fn() }));
vi.mock("../lib/fkCascadeDelete", () => ({ cascadeDeleteByIds: vi.fn() }));
vi.mock("../lib/socialIcebreakerStore", () => ({
  reassignOrTombstoneHostedSessions: vi.fn(async () => ({ reassigned: [], tombstoned: [] })),
}));
vi.mock("../routes/domains/adminSocialIcebreaker", () => ({
  registerAdminSocialIcebreakerRoutes: vi.fn(),
}));

vi.mock("../lib/revokeUserSessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/revokeUserSessions")>();
  return {
    revokeUserSessions: vi.fn(actual.revokeUserSessions),
    revokeAdminSessions: vi.fn(actual.revokeAdminSessions),
  };
});

const { logger: mockedLogger } = await import("../lib/logger");
const { revokeUserSessions, revokeAdminSessions } = await import("../lib/revokeUserSessions");
const { cascadeDeleteByIds } = await import("../lib/fkCascadeDelete");
const { storage: mockedStorage } = await import("../storage");
const { recordViolation } = await import("../abuseDetection");
const { registerAdminUserRoutes } = await import("../routes/domains/adminUsers");
const { registerAdminAuthRoutes } = await import("../adminAuth");

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
  registerAdminUserRoutes(app);
  registerAdminAuthRoutes(app);
  app.post("/__test__/admin-session", (req, res) => {
    req.session.adminAccountId = "admin-1";
    req.session.adminRole = "super_admin";
    req.session.save(() => res.json({ ok: true }));
  });
  return app;
}

const withServer = createWithServer(createApp);

async function adminCookie(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/__test__/admin-session`, { method: "POST" });
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

let lastViolationUpdate: Record<string, unknown> | undefined;

function mockViolationLookup(currentCount: number): void {
  lastViolationUpdate = undefined;
  dbMock.select.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: async () => [{ violationCount: currentCount }],
      }),
    }),
  });
  dbMock.update.mockReturnValueOnce({
    set: (values: Record<string, unknown>) => {
      lastViolationUpdate = values;
      return { where: async () => undefined };
    },
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  dbMock.execute.mockReset();
  dbMock.transaction.mockReset();
  dbMock.select.mockReset();
  dbMock.update.mockReset();
  (mockedStorage.getUser as any).mockReset();
  (mockedStorage.updateUser as any).mockReset();
  (mockedStorage.getAdminAccountById as any).mockReset();
  (mockedStorage.updateAdminAccount as any).mockReset();

  const actual = await vi.importActual<typeof import("../lib/revokeUserSessions")>(
    "../lib/revokeUserSessions",
  );
  vi.mocked(revokeUserSessions).mockImplementation(actual.revokeUserSessions);
  vi.mocked(revokeAdminSessions).mockImplementation(actual.revokeAdminSessions);

  (mockedStorage.getAdminAccountById as any).mockResolvedValue({
    id: "admin-1",
    username: "root",
    role: "super_admin",
    status: "active",
    displayName: "Root",
  });
});

describe("HS-12 call-site contract (source scan)", () => {
  const adminUsersSource = readRepoFile("apps/server/src/routes/domains/adminUsers.ts");
  const abuseSource = readRepoFile("apps/server/src/abuseDetection.ts");
  const adminAuthSource = readRepoFile("apps/server/src/adminAuth.ts");
  const libSource = readRepoFile("apps/server/src/lib/revokeUserSessions.ts");
  const authMiddlewareSource = readRepoFile("apps/server/src/middleware/auth.ts");

  it("wires all four revocation call sites (AC-04)", () => {
    expect(adminUsersSource).toContain("await revokeUserSessions(req.params.id);");
    expect(adminUsersSource).toContain("await revokeUserSessions(userId, tx);");
    expect(abuseSource).toContain("await revokeUserSessions(userId);");
    expect(adminAuthSource).toContain("await revokeAdminSessions(id);");
  });

  it("delete-data revocation is scoped to the DELETE /api/admin/users/:id/data transaction (AC-02)", () => {
    const routeStart = adminUsersSource.indexOf('app.delete("/api/admin/users/:id/data"');
    const revokeIndex = adminUsersSource.indexOf("await revokeUserSessions(userId, tx);");
    const cascadeIndex = adminUsersSource.indexOf('cascadeDeleteByIds(tx, "users", "id", [userId])');

    expect(routeStart).toBeGreaterThan(-1);
    expect(revokeIndex).toBeGreaterThan(routeStart);
    expect(cascadeIndex).toBeGreaterThan(revokeIndex);
    expect(adminUsersSource).not.toContain("await revokeUserSessions(userId);");
  });

  it("permaban revocation is try/caught and warn-logged (fail-open, A2/AC-01/AC-05)", () => {
    expect(abuseSource).toMatch(
      /try\s*\{\s*await revokeUserSessions\(userId\);\s*\}\s*catch[\s\S]{0,600}logger\.warn/,
    );
  });

  it("admin disable revocation is conditional, try/caught and warn-logged (AC-03/AC-05)", () => {
    expect(adminAuthSource).toMatch(
      /if\s*\(\s*updates\.status === "disabled"\s*\)\s*\{\s*try\s*\{\s*await revokeAdminSessions\(id\);\s*\}\s*catch[\s\S]{0,240}logger\.warn/,
    );
  });

  it("per-request gates remain the authority after fail-open revocation (AC-05)", () => {
    expect(authMiddlewareSource).toContain("if (await isUserBanned(userId))");
    expect(authMiddlewareSource).toContain('code: "USER_BANNED"');
    expect(adminAuthSource).toContain('adminAccount.status !== "active"');
  });

  it("lib targets the session JSON keys, accepts an executor, and logs counts (AC-02/AC-03/OBS-01)", () => {
    expect(libSource).toContain("DELETE FROM sessions WHERE sess->>'userId' = ${userId}");
    expect(libSource).toContain("DELETE FROM sessions WHERE sess->>'adminAccountId' = ${adminAccountId}");
    expect(libSource).toContain("executor: SessionStoreExecutor = db");
    expect(libSource).toContain("executor.execute(");
    expect(libSource).toContain('logger.info("[Auth] Revoked user sessions"');
    expect(libSource).toContain('logger.info("[Auth] Revoked admin sessions"');
  });
});

describe("revokeUserSessions / revokeAdminSessions behavior (REL-01/SCA-01)", () => {
  it("is idempotent when no sessions match — returns 0, does not throw (REL-01)", async () => {
    dbMock.execute.mockResolvedValueOnce({ rowCount: 0 });

    await expect(revokeUserSessions("user-empty")).resolves.toBe(0);
    expect(dbMock.execute).toHaveBeenCalledTimes(1);
  });

  it("deletes user sessions with one statement scoped to sess->>'userId' (SCA-01)", async () => {
    dbMock.execute.mockResolvedValueOnce({ rowCount: 2 });

    await expect(revokeUserSessions("user-42")).resolves.toBe(2);
    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    expect(renderSql(dbMock.execute.mock.calls[0][0])).toBe(
      "DELETE FROM sessions WHERE sess->>'userId' = user-42",
    );
  });

  it("deletes admin sessions with one statement scoped to sess->>'adminAccountId' (AC-03)", async () => {
    dbMock.execute.mockResolvedValueOnce({ rowCount: 2 });

    await expect(revokeAdminSessions("admin-42")).resolves.toBe(2);
    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    expect(renderSql(dbMock.execute.mock.calls[0][0])).toBe(
      "DELETE FROM sessions WHERE sess->>'adminAccountId' = admin-42",
    );
  });

  it("uses the provided executor (transaction) instead of the root db (AC-02)", async () => {
    const tx = { execute: vi.fn(async () => ({ rowCount: 3 })) };

    await expect(revokeUserSessions("user-tx", tx as any)).resolves.toBe(3);
    expect(tx.execute).toHaveBeenCalledTimes(1);
    expect(dbMock.execute).not.toHaveBeenCalled();
  });

  it("propagates executor failures so fail-closed callers can roll back (AC-02)", async () => {
    dbMock.execute.mockRejectedValueOnce(new Error("session store down"));

    await expect(revokeAdminSessions("admin-err")).rejects.toThrow("session store down");
  });
});

describe("recordViolation permaban wiring (AC-01/AC-05)", () => {
  it("deletes the user's stored sessions after the users update succeeds (AC-01)", async () => {
    mockViolationLookup(4);
    dbMock.execute.mockResolvedValueOnce({ rowCount: 2 });

    await recordViolation("user-perm", "spam", "severe");

    expect(lastViolationUpdate).toMatchObject({ isBanned: true, violationCount: 6 });
    expect(dbMock.update).toHaveBeenCalledTimes(1);
    expect(revokeUserSessions).toHaveBeenCalledWith("user-perm");
    expect(dbMock.execute).toHaveBeenCalledTimes(1);
    expect(renderSql(dbMock.execute.mock.calls[0][0])).toBe(
      "DELETE FROM sessions WHERE sess->>'userId' = user-perm",
    );
  });

  it("revocation failure never throws to callers and is warn-logged (AC-05)", async () => {
    mockViolationLookup(4);
    dbMock.execute.mockRejectedValueOnce(new Error("session store down"));

    await expect(recordViolation("user-perm", "spam", "severe")).resolves.toBeUndefined();

    expect(lastViolationUpdate).toMatchObject({ isBanned: true });
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      "Failed to revoke sessions on permaban",
      expect.objectContaining({
        userId: "user-perm",
        error: expect.stringContaining("session store down"),
      }),
    );
  });

  it("does not revoke sessions below the permaban threshold", async () => {
    mockViolationLookup(0);

    await recordViolation("user-warn", "spam", "warning");

    expect(revokeUserSessions).not.toHaveBeenCalled();
    expect(dbMock.execute).not.toHaveBeenCalled();
  });
});

describe("admin ban route (AC-04/AC-05)", () => {
  function mockBanTarget(userId: string): void {
    (mockedStorage.getUser as any).mockResolvedValue({
      id: userId,
      displayName: `Banned ${userId}`,
      isBanned: false,
      isAdmin: false,
    });
    (mockedStorage.updateUser as any).mockResolvedValue({ id: userId, isBanned: true });
    dbMock.transaction.mockImplementationOnce(async (cb: (connection: unknown) => unknown) => cb({}));
  }

  it("revokes the banned user's sessions after the ban update succeeds", async () => {
    mockBanTarget("user-ban");
    dbMock.execute.mockResolvedValueOnce({ rowCount: 2 });

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/admin/users/user-ban/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ reason: "repeated violations" }),
      });

      expect(response.status).toBe(200);
      expect(mockedStorage.updateUser).toHaveBeenCalledWith("user-ban", { isBanned: true });
      expect(revokeUserSessions).toHaveBeenCalledWith("user-ban");
      expect(dbMock.execute).toHaveBeenCalledTimes(1);
      expect(renderSql(dbMock.execute.mock.calls[0][0])).toContain("sess->>'userId' = user-ban");
    });
  });

  it("fail-open: revocation failure does not abort the ban and is warn-logged (AC-05)", async () => {
    mockBanTarget("user-ban2");
    dbMock.execute.mockRejectedValueOnce(new Error("session store down"));

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/admin/users/user-ban2/ban`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ reason: "repeated violations" }),
      });

      expect(response.status).toBe(200);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "Failed to revoke banned user sessions",
        expect.objectContaining({ userId: "user-ban2" }),
      );
    });
  });
});

describe("admin delete-user-data route (AC-02)", () => {
  function mockDeleteTarget(userId: string): { execute: ReturnType<typeof vi.fn> } {
    (mockedStorage.getUser as any).mockResolvedValue({
      id: userId,
      displayName: `Deleted ${userId}`,
      phoneNumber: "13800000000",
      isAdmin: false,
    });
    const tx = { execute: vi.fn(async () => ({ rowCount: 0 })) };
    dbMock.transaction.mockImplementationOnce(async (cb: (connection: unknown) => unknown) => cb(tx));
    return tx;
  }

  it("revokes sessions inside the deletion transaction, then cascades", async () => {
    const tx = mockDeleteTarget("user-del");

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/admin/users/user-del/data`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      });

      expect(response.status).toBe(200);
      expect(revokeUserSessions).toHaveBeenCalledWith("user-del", tx);
      expect(cascadeDeleteByIds).toHaveBeenCalledWith(tx, "users", "id", ["user-del"]);
    });
  });

  it("fail-closed: revocation failure rolls back the deletion (500; cascade never runs)", async () => {
    const tx = mockDeleteTarget("user-del");
    tx.execute.mockRejectedValueOnce(new Error("session store down"));

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/admin/users/user-del/data`, {
        method: "DELETE",
        headers: { Cookie: cookie },
      });

      expect(response.status).toBe(500);
      expect(cascadeDeleteByIds).not.toHaveBeenCalled();
      expect(tx.execute).toHaveBeenCalledTimes(1);
      expect(mockedLogger.error).toHaveBeenCalledWith(
        "Error deleting user data",
        expect.objectContaining({ error: expect.stringContaining("session store down") }),
      );
    });
  });
});

describe("admin account disable route (AC-03/AC-05)", () => {
  const disabledAccount = {
    id: "admin-2",
    username: "ops",
    passwordHash: "hashed",
    role: "viewer",
    status: "disabled",
    displayName: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("disabling an admin account revokes that admin's sessions (AC-03)", async () => {
    (mockedStorage.updateAdminAccount as any).mockResolvedValueOnce(disabledAccount);
    dbMock.execute.mockResolvedValueOnce({ rowCount: 2 });

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/admin/accounts/admin-2`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ status: "disabled" }),
      });

      expect(response.status).toBe(200);
      expect(revokeAdminSessions).toHaveBeenCalledWith("admin-2");
      expect(dbMock.execute).toHaveBeenCalledTimes(1);
      expect(renderSql(dbMock.execute.mock.calls[0][0])).toContain("sess->>'adminAccountId' = admin-2");
    });
  });

  it("fail-open: revocation failure keeps the 200 response and is warn-logged (AC-05)", async () => {
    (mockedStorage.updateAdminAccount as any).mockResolvedValueOnce(disabledAccount);
    dbMock.execute.mockRejectedValueOnce(new Error("session store down"));

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/admin/accounts/admin-2`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ status: "disabled" }),
      });

      expect(response.status).toBe(200);
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        "Failed to revoke disabled admin account sessions",
        expect.objectContaining({ adminAccountId: "admin-2" }),
      );
    });
  });

  it("does not revoke sessions for updates that do not disable the account", async () => {
    (mockedStorage.updateAdminAccount as any).mockResolvedValueOnce({
      ...disabledAccount,
      status: "active",
    });

    await withServer(async (baseUrl) => {
      const cookie = await adminCookie(baseUrl);
      const response = await fetch(`${baseUrl}/api/admin/accounts/admin-2`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ displayName: "Renamed" }),
      });

      expect(response.status).toBe(200);
      expect(revokeAdminSessions).not.toHaveBeenCalled();
    });
  });
});
