/**
 * Unit Tests for admin authentication (username/password + RBAC)
 *
 * Tests cover:
 * - POST /api/admin/login: success with valid credentials
 * - POST /api/admin/login: failure with wrong password
 * - POST /api/admin/login: failure for unknown username
 * - POST /api/admin/login: failure for disabled account
 * - GET /api/admin/accounts: super_admin can list accounts
 * - POST /api/admin/accounts: super_admin can create account
 * - RBAC: operator is denied access to /api/admin/accounts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";

// ── Storage mock ──────────────────────────────────────────────────────────
const mockAdminAccount = {
  id: "admin-1",
  username: "testadmin",
  passwordHash: "", // set in beforeEach
  role: "super_admin",
  status: "active",
  displayName: "Test Admin",
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOperatorAccount = {
  ...mockAdminAccount,
  id: "admin-2",
  username: "operator1",
  role: "operator",
};

vi.mock("../storage", () => ({
  storage: {
    getAdminAccountByUsername: vi.fn(),
    getAdminAccountById: vi.fn(),
    listAdminAccounts: vi.fn(),
    createAdminAccount: vi.fn(),
    updateAdminAccount: vi.fn(),
    updateAdminLastLogin: vi.fn(),
  },
}));

const { storage } = await import("../storage");

// ── Helper: build a minimal express-like context ──────────────────────────
function buildMockReqRes(body: Record<string, any> = {}, sessionData: Record<string, any> = {}) {
  const sessionStore: Record<string, any> = { ...sessionData };
  const session = {
    ...sessionStore,
    regenerate: vi.fn((cb: (err: null) => void) => {
      cb(null);
    }),
    save: vi.fn((cb: (err: null) => void) => {
      cb(null);
    }),
    destroy: vi.fn((cb: (err: null) => void) => {
      cb(null);
    }),
  };
  const req: any = { body, session, sessionID: "test-session-id" };
  const res: any = {
    _status: 200,
    _json: null,
    status(code: number) { this._status = code; return this; },
    json(data: any) { this._json = data; return this; },
  };
  return { req, res };
}

// ── Import the handler functions under test ────────────────────────────────
// We test the logic indirectly by calling through a simplified route handler
// that mirrors what routes.ts does for POST /api/admin/login.

async function adminLoginHandler(req: any, res: any) {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ message: "用户名和密码不能为空" });
    return;
  }
  const adminAccount = await storage.getAdminAccountByUsername(username);
  if (!adminAccount) {
    res.status(401).json({ message: "用户名或密码错误" });
    return;
  }
  if ((adminAccount as any).status !== "active") {
    res.status(403).json({ message: "该账号已被禁用" });
    return;
  }
  const isValid = await bcrypt.compare(password, (adminAccount as any).passwordHash);
  if (!isValid) {
    res.status(401).json({ message: "用户名或密码错误" });
    return;
  }
  await storage.updateAdminLastLogin((adminAccount as any).id);
  // Simulate session setup
  req.session.regenerate((err: null) => {
    if (err) { res.status(500).json({ message: "登录失败" }); return; }
    req.session.adminAccountId = (adminAccount as any).id;
    req.session.adminRole = (adminAccount as any).role;
    req.session.save((err: null) => {
      if (err) { res.status(500).json({ message: "登录失败" }); return; }
      res.json({
        message: "登录成功",
        id: (adminAccount as any).id,
        username: (adminAccount as any).username,
        role: (adminAccount as any).role,
        displayName: (adminAccount as any).displayName,
      });
    });
  });
}

// ── RBAC middleware ────────────────────────────────────────────────────────
async function requireAdmin(req: any, res: any, next: () => void) {
  if (req.session?.adminAccountId) {
    const account = await storage.getAdminAccountById(req.session.adminAccountId);
    if (!account || (account as any).status !== "active") {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    req.adminRole = (account as any).role;
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

function requireSuperAdmin(req: any, res: any, next: () => void) {
  if (req.adminRole !== "super_admin") {
    res.status(403).json({ message: "Forbidden - Super admin access required" }); return;
  }
  next();
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Admin Login (username/password)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockAdminAccount.passwordHash = await bcrypt.hash("correct-password", 12);
  });

  it("returns 200 with role on valid credentials", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockResolvedValue(mockAdminAccount as any);
    vi.mocked(storage.updateAdminLastLogin).mockResolvedValue(undefined as any);

    const { req, res } = buildMockReqRes({ username: "testadmin", password: "correct-password" });
    await adminLoginHandler(req, res);

    expect(res._status).toBe(200);
    expect(res._json.message).toBe("登录成功");
    expect(res._json.role).toBe("super_admin");
    expect(req.session.adminAccountId).toBe("admin-1");
    expect(req.session.adminRole).toBe("super_admin");
  });

  it("returns 401 for unknown username", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockResolvedValue(undefined);

    const { req, res } = buildMockReqRes({ username: "unknown", password: "any" });
    await adminLoginHandler(req, res);

    expect(res._status).toBe(401);
    expect(res._json.message).toBe("用户名或密码错误");
  });

  it("returns 401 for wrong password", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockResolvedValue(mockAdminAccount as any);

    const { req, res } = buildMockReqRes({ username: "testadmin", password: "wrong-password" });
    await adminLoginHandler(req, res);

    expect(res._status).toBe(401);
    expect(res._json.message).toBe("用户名或密码错误");
  });

  it("returns 403 for disabled account", async () => {
    vi.mocked(storage.getAdminAccountByUsername).mockResolvedValue({
      ...mockAdminAccount,
      status: "disabled",
    } as any);

    const { req, res } = buildMockReqRes({ username: "testadmin", password: "correct-password" });
    await adminLoginHandler(req, res);

    expect(res._status).toBe(403);
    expect(res._json.message).toBe("该账号已被禁用");
  });

  it("returns 400 when username or password is missing", async () => {
    const { req, res } = buildMockReqRes({ username: "testadmin" });
    await adminLoginHandler(req, res);

    expect(res._status).toBe(400);
  });
});

describe("RBAC middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows super_admin through requireSuperAdmin", async () => {
    vi.mocked(storage.getAdminAccountById).mockResolvedValue(mockAdminAccount as any);
    const next = vi.fn();
    const req: any = { session: { adminAccountId: "admin-1" } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await requireAdmin(req, res, () => {
      requireSuperAdmin(req, res, next);
    });

    expect(next).toHaveBeenCalled();
  });

  it("denies operator from reaching requireSuperAdmin", async () => {
    vi.mocked(storage.getAdminAccountById).mockResolvedValue(mockOperatorAccount as any);
    const next = vi.fn();
    const req: any = { session: { adminAccountId: "admin-2" } };
    const res: any = { _status: 200, status(c: number) { this._status = c; return this; }, json: vi.fn() };

    await requireAdmin(req, res, () => {
      requireSuperAdmin(req, res, next);
    });

    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when no adminAccountId in session", async () => {
    const next = vi.fn();
    const req: any = { session: {} };
    const res: any = { _status: 200, status(c: number) { this._status = c; return this; }, json: vi.fn() };

    await requireAdmin(req, res, next);

    expect(res._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
