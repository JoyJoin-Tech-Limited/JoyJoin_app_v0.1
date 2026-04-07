import express from "express";
import session from "express-session";
import type { AddressInfo } from "net";
import bcrypt from "bcrypt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storage", () => ({
  storage: {
    getAdminAccountByUsername: vi.fn(),
    getAdminAccountById: vi.fn(),
    getUserByPhone: vi.fn(),
    listAdminAccounts: vi.fn(),
    createAdminAccount: vi.fn(),
    updateAdminAccount: vi.fn(),
    updateAdminLastLogin: vi.fn(),
    getUser: vi.fn(),
  },
}));

const { storage } = await import("../storage");
const { registerAdminAuthRoutes, requireAdmin, requireSuperAdmin } = await import("../adminAuth");

const superAdminPassword = "correct-password";
const operatorPassword = "operator-password";
const legacyAdminPassword = "legacy-password";

const superAdminAccount = {
  id: "admin-1",
  username: "super-admin",
  passwordHash: await bcrypt.hash(superAdminPassword, 12),
  role: "super_admin",
  status: "active",
  displayName: "Super Admin",
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const operatorAccount = {
  ...superAdminAccount,
  id: "admin-2",
  username: "ops-admin",
  passwordHash: await bcrypt.hash(operatorPassword, 12),
  role: "operator",
  displayName: "Operator Admin",
};

const legacyAdminUser = {
  id: "legacy-admin-user-1",
  phoneNumber: "13800138000",
  email: "legacy-admin@joyjoin.app",
  password: await bcrypt.hash(legacyAdminPassword, 12),
  isAdmin: true,
  displayName: "Legacy Admin",
};

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

  registerAdminAuthRoutes(app);

  app.post("/__test__/legacy-login", (req, res) => {
    req.session.userId = "legacy-user-1";
    req.session.save(() => {
      res.json({ ok: true });
    });
  });

  app.get("/__test__/admin-only", requireAdmin, (req, res) => {
    res.json({ ok: true, role: (req as any).adminRole });
  });

  app.get("/__test__/super-only", requireAdmin, requireSuperAdmin, (req, res) => {
    res.json({ ok: true, role: (req as any).adminRole });
  });

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
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function cookieHeader(response: Response) {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : "";
}

describe("admin auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows public login on /api/admin/login and sets admin session", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockImplementation(async (username: string) =>
      username === superAdminAccount.username ? (superAdminAccount as any) : undefined,
    );
    vi.mocked(storage.updateAdminLastLogin).mockResolvedValue(undefined as any);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: superAdminAccount.username, password: superAdminPassword }),
      });

      const body: any = await response.json();

      expect(response.status).toBe(200);
      expect(body.role).toBe("super_admin");
      expect(cookieHeader(response)).toContain("connect.sid=");
      expect(storage.updateAdminLastLogin).toHaveBeenCalledWith(superAdminAccount.id);
    });
  });

  it("returns generic invalid-credentials response for disabled accounts", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockResolvedValue({
      ...superAdminAccount,
      status: "disabled",
    } as any);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: superAdminAccount.username, password: superAdminPassword }),
      });

      const body: any = await response.json();
      expect(response.status).toBe(401);
      expect(body.message).toBe("用户名或密码错误");
    });
  });

  it("returns 401 for invalid password", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockResolvedValue(superAdminAccount as any);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: superAdminAccount.username, password: "wrong-password" }),
      });

      const body: any = await response.json();
      expect(response.status).toBe(401);
      expect(body.message).toBe("用户名或密码错误");
    });
  });

  it("allows login for legacy phone-based admins via the admin portal endpoint", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockResolvedValue(undefined);
    vi.mocked(storage.getUserByPhone).mockImplementation(async (phoneNumber: string) =>
      phoneNumber === legacyAdminUser.phoneNumber ? [legacyAdminUser as any] : [],
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: legacyAdminUser.phoneNumber, password: legacyAdminPassword }),
      });

      const body: any = await response.json();

      expect(response.status).toBe(200);
      expect(body.role).toBe("super_admin");
      expect(body.username).toBe(legacyAdminUser.phoneNumber);
      expect(cookieHeader(response)).toContain("connect.sid=");
    });
  });

  it("falls back to legacy admin login when admin_accounts lookup is unavailable", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockRejectedValue(new Error('relation "admin_accounts" does not exist'));
    vi.mocked(storage.getUserByPhone).mockImplementation(async (phoneNumber: string) =>
      phoneNumber === legacyAdminUser.phoneNumber ? [legacyAdminUser as any] : [],
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: legacyAdminUser.phoneNumber, password: legacyAdminPassword }),
      });

      const body: any = await response.json();

      expect(response.status).toBe(200);
      expect(body.id).toBe(legacyAdminUser.id);
      expect(body.role).toBe("super_admin");
    });
  });

  it("validates minimum password length when creating admin accounts", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockImplementation(async (username: string) =>
      username === superAdminAccount.username ? (superAdminAccount as any) : undefined,
    );
    vi.mocked(storage.getAdminAccountById).mockResolvedValue(superAdminAccount as any);
    vi.mocked(storage.updateAdminLastLogin).mockResolvedValue(undefined as any);

    await withServer(async (baseUrl) => {
      const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: superAdminAccount.username, password: superAdminPassword }),
      });
      const cookie = cookieHeader(loginResponse);

      const response = await fetch(`${baseUrl}/api/admin/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ username: "new-admin", password: "1234567", role: "viewer" }),
      });

      const body: any = await response.json();
      expect(response.status).toBe(400);
      expect(body.message).toBe("密码至少需要8个字符");
      expect(storage.createAdminAccount).not.toHaveBeenCalled();
    });
  });

  it("accepts an 8-character password when creating admin accounts", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockImplementation(async (username: string) => {
      if (username === superAdminAccount.username) return superAdminAccount as any;
      return undefined;
    });
    vi.mocked(storage.getAdminAccountById).mockResolvedValue(superAdminAccount as any);
    vi.mocked(storage.updateAdminLastLogin).mockResolvedValue(undefined as any);
    vi.mocked(storage.createAdminAccount).mockResolvedValue({
      id: "admin-3",
      username: "new-admin",
      passwordHash: "hashed",
      role: "viewer",
      status: "active",
      displayName: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await withServer(async (baseUrl) => {
      const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: superAdminAccount.username, password: superAdminPassword }),
      });
      const cookie = cookieHeader(loginResponse);

      const response = await fetch(`${baseUrl}/api/admin/accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ username: "new-admin", password: "12345678", role: "viewer" }),
      });

      const body: any = await response.json();
      expect(response.status).toBe(201);
      expect(body.username).toBe("new-admin");
      expect(storage.createAdminAccount).toHaveBeenCalled();
    });
  });

  it("denies operator access to super-admin-only admin account management", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockImplementation(async (username: string) =>
      username === operatorAccount.username ? (operatorAccount as any) : undefined,
    );
    vi.mocked(storage.getAdminAccountById).mockResolvedValue(operatorAccount as any);
    vi.mocked(storage.updateAdminLastLogin).mockResolvedValue(undefined as any);

    await withServer(async (baseUrl) => {
      const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: operatorAccount.username, password: operatorPassword }),
      });
      const cookie = cookieHeader(loginResponse);

      const response = await fetch(`${baseUrl}/api/admin/accounts`, {
        method: "GET",
        headers: { Cookie: cookie },
      });

      expect(response.status).toBe(403);
    });
  });

  it("keeps legacy users.isAdmin sessions working through requireAdmin", async () => {
    vi.mocked(storage.getUser).mockResolvedValue({ id: "legacy-user-1", isAdmin: true } as any);

    await withServer(async (baseUrl) => {
      const legacyLogin = await fetch(`${baseUrl}/__test__/legacy-login`, {
        method: "POST",
      });
      const cookie = cookieHeader(legacyLogin);

      const response = await fetch(`${baseUrl}/__test__/admin-only`, {
        headers: { Cookie: cookie },
      });
      const body: any = await response.json();

      expect(response.status).toBe(200);
      expect(body.role).toBe("super_admin");
    });
  });
});
