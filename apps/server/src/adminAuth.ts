import type { Express, Request, RequestHandler } from "express";
import bcrypt from "bcrypt";
import { isProductionEnvironment } from "./auth/policy";
import { storage } from "./storage";
import { logAdminAudit } from "./lib/adminAuditLogger";

const VALID_ADMIN_ROLES = ["super_admin", "operator", "viewer"] as const;
type AdminRole = (typeof VALID_ADMIN_ROLES)[number];

const INVALID_CREDENTIALS_MESSAGE = "用户名或密码错误";
const LEGACY_ADMIN_FALLBACK_USERNAME = "legacy-admin";
const PG_UNDEFINED_TABLE = "42P01";
const PG_UNDEFINED_COLUMN = "42703";
const MISSING_ADMIN_ACCOUNTS_RELATION_PATTERN = /relation "admin_accounts" does not exist/i;
const MISSING_ADMIN_ACCOUNTS_COLUMN_PATTERN = /column .*admin_accounts/i;

function getActingAdminId(req: Request): string {
  return req.adminAccount?.id ?? req.session.userId ?? "unknown";
}

function extractLoginIdentifier(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const username = typeof (body as { username?: unknown }).username === "string"
    ? (body as { username: string }).username.trim()
    : "";
  if (username) {
    return username;
  }

  const phoneNumber = typeof (body as { phoneNumber?: unknown }).phoneNumber === "string"
    ? (body as { phoneNumber: string }).phoneNumber.trim()
    : "";
  return phoneNumber;
}

async function establishAdminSession(req: Request, adminAccountId: string, adminRole: string) {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.adminAccountId = adminAccountId;
      req.session.adminRole = adminRole as AdminRole;
      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

async function establishLegacyAdminSession(req: Request, userId: string) {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

function isMissingAdminAccountsRelation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const matchesAdminAccountsMessage = MISSING_ADMIN_ACCOUNTS_RELATION_PATTERN.test(message)
    || MISSING_ADMIN_ACCOUNTS_COLUMN_PATTERN.test(message);
  if (!matchesAdminAccountsMessage) {
    return false;
  }

  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code);
    return code === PG_UNDEFINED_TABLE || code === PG_UNDEFINED_COLUMN;
  }

  return true;
}

async function getAdminAccountByLoginId(loginId: string) {
  try {
    return await storage.getAdminAccountByUsername(loginId);
  } catch (error) {
    if (isMissingAdminAccountsRelation(error)) {
      console.warn("admin_accounts lookup unavailable during admin login; falling back to legacy admin auth");
      return undefined;
    }
    throw error;
  }
}

async function comparePasswordOrFailClosed(password: string, hash: string, context: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.warn(`Invalid password hash during ${context}; treating as invalid credentials`);
    return false;
  }
}

async function tryLegacyPhoneAdminLogin(req: Request, loginId: string, password: string) {
  const [user] = await storage.getUserByPhone(loginId);
  if (!user?.isAdmin || !user.password) {
    return null;
  }

  const isValid = await comparePasswordOrFailClosed(password, user.password, "legacy admin login");
  if (!isValid) {
    return null;
  }

  await establishLegacyAdminSession(req, user.id);
  return {
    id: user.id,
    username: user.phoneNumber ?? user.email ?? LEGACY_ADMIN_FALLBACK_USERNAME,
    role: "super_admin" as const,
    displayName: user.displayName,
  };
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const { adminAccountId, userId } = req.session;

  if (adminAccountId) {
    try {
      const adminAccount = await storage.getAdminAccountById(adminAccountId);
      if (!adminAccount || adminAccount.status !== "active") {
        return res.status(403).json({ message: "Forbidden - Admin access required" });
      }
      req.adminAccount = adminAccount;
      req.adminRole = adminAccount.role;
      return next();
    } catch (error) {
      console.error("Error checking admin account status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  if (userId) {
    if (isProductionEnvironment()) {
      return res.status(403).json({
        message:
          "Forbidden - Admin access required. Use POST /api/admin/login with an admin_accounts username (legacy phone admin is disabled in production).",
      });
    }
    try {
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden - Admin access required" });
      }
      req.adminRole = "super_admin";
      return next();
    } catch (error) {
      console.error("Error checking admin status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
};

export const requireSuperAdmin: RequestHandler = (req, res, next) => {
  const role = req.adminRole;
  if (role !== "super_admin") {
    return res.status(403).json({ message: "Forbidden - Super admin access required" });
  }
  next();
};

export const requireOperatorOrAbove: RequestHandler = (req, res, next) => {
  const role = req.adminRole;
  if (role !== "super_admin" && role !== "operator") {
    return res.status(403).json({ message: "Forbidden - Operator access required" });
  }
  next();
};

export function registerAdminAuthRoutes(app: Express) {
  app.post("/api/admin/login", async (req: Request, res) => {
    try {
      const loginId = extractLoginIdentifier(req.body);
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      if (!loginId || !password) {
        return res.status(400).json({ message: "用户名和密码不能为空" });
      }

      const adminAccount = await getAdminAccountByLoginId(loginId);
      if (adminAccount) {
        if (adminAccount.status !== "active") {
          console.warn("Admin login attempt for disabled account", {
            username: adminAccount.username,
            status: adminAccount.status,
          });
          return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
        }

        const isValid = await comparePasswordOrFailClosed(password, adminAccount.passwordHash, "admin login");
        if (!isValid) {
          return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
        }

        await storage.updateAdminLastLogin(adminAccount.id);
        await establishAdminSession(req, adminAccount.id, adminAccount.role);

        logAdminAudit({
          action: "ADMIN_LOGIN",
          adminId: adminAccount.id,
          adminRole: adminAccount.role,
          targetEntityType: "admin_account",
          targetEntityId: adminAccount.id,
          context: { username: adminAccount.username },
        });

        return res.json({
          message: "登录成功",
          id: adminAccount.id,
          username: adminAccount.username,
          role: adminAccount.role,
          displayName: adminAccount.displayName,
          sessionToken: req.sessionID,
        });
      }

      if (!isProductionEnvironment()) {
        const legacyAdmin = await tryLegacyPhoneAdminLogin(req, loginId, password);
        if (legacyAdmin) {
          logAdminAudit({
            action: "ADMIN_LOGIN",
            adminId: legacyAdmin.id,
            adminRole: legacyAdmin.role,
            targetEntityType: "user",
            targetEntityId: legacyAdmin.id,
          });

          return res.json({
            message: "登录成功",
            ...legacyAdmin,
            sessionToken: req.sessionID,
          });
        }
      }

      return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    } catch (error) {
      console.error("Error during admin login:", error);
      return res.status(500).json({ message: "登录失败" });
    }
  });

  app.get("/api/admin/me", requireAdmin, async (req: Request, res) => {
    const adminAccount = req.adminAccount;

    if (adminAccount) {
      return res.json({
        id: adminAccount.id,
        username: adminAccount.username,
        role: adminAccount.role,
        displayName: adminAccount.displayName,
        isAdmin: true,
      });
    }

    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      return res.json({
        id: user?.id,
        username: user?.phoneNumber || user?.email,
        role: "super_admin",
        displayName: user?.displayName,
        isAdmin: true,
      });
    }

    return res.status(401).json({ message: "Unauthorized" });
  });

  app.get("/api/admin/accounts", requireAdmin, requireSuperAdmin, async (_req: Request, res) => {
    try {
      const accounts = await storage.listAdminAccounts();
      return res.json(accounts.map(({ passwordHash: _ph, ...safe }) => safe));
    } catch (error) {
      console.error("Error listing admin accounts:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/accounts", requireAdmin, requireSuperAdmin, async (req: Request, res) => {
    try {
      const { username, password, role, displayName } = req.body;
      if (!username || !password || !role) {
        return res.status(400).json({ message: "用户名、密码和角色不能为空" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "密码至少需要8个字符" });
      }
      if (!VALID_ADMIN_ROLES.includes(role as AdminRole)) {
        return res.status(400).json({ message: "无效的角色" });
      }
      const existing = await storage.getAdminAccountByUsername(username);
      if (existing) {
        return res.status(409).json({ message: "用户名已存在" });
      }
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(password, 12);
      const account = await storage.createAdminAccount({ username, passwordHash, role, displayName });
      const { passwordHash: _ph, ...safe } = account;

      logAdminAudit({
        action: "ADMIN_ACCOUNT_CREATED",
        adminId: getActingAdminId(req),
        adminRole: req.adminRole,
        targetEntityType: "admin_account",
        targetEntityId: account.id,
        context: { username: account.username, role: account.role, displayName: account.displayName },
      });

      return res.status(201).json(safe);
    } catch (error) {
      console.error("Error creating admin account:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/accounts/:id", requireAdmin, requireSuperAdmin, async (req: Request, res) => {
    try {
      const { id } = req.params;
      const { role, status, displayName } = req.body;
      const updates: Record<string, string> = {};
      if (role !== undefined) {
        if (!VALID_ADMIN_ROLES.includes(role as AdminRole)) {
          return res.status(400).json({ message: "无效的角色" });
        }
        updates.role = role;
      }
      if (status !== undefined) {
        if (!["active", "disabled"].includes(status)) {
          return res.status(400).json({ message: "无效的状态" });
        }
        updates.status = status;
      }
      if (displayName !== undefined) updates.displayName = displayName;
      const account = await storage.updateAdminAccount(id, updates as any);
      const { passwordHash: _ph, ...safe } = account;

      logAdminAudit({
        action: "ADMIN_ACCOUNT_UPDATED",
        adminId: getActingAdminId(req),
        adminRole: req.adminRole,
        targetEntityType: "admin_account",
        targetEntityId: id,
        after: updates,
      });

      return res.json(safe);
    } catch (error) {
      console.error("Error updating admin account:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/accounts/:id/reset-password", requireAdmin, requireSuperAdmin, async (req: Request, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ message: "密码至少需要8个字符" });
      }
      const bcrypt = await import("bcrypt");
      const passwordHash = await bcrypt.hash(newPassword, 12);
      await storage.updateAdminAccount(id, { passwordHash });

      logAdminAudit({
        action: "ADMIN_PASSWORD_RESET",
        adminId: getActingAdminId(req),
        adminRole: req.adminRole,
        targetEntityType: "admin_account",
        targetEntityId: id,
        // newPassword is intentionally NOT logged
      });

      return res.json({ message: "密码已重置" });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
}
