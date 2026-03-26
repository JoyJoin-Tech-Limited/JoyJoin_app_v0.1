import type { Express, Request, RequestHandler } from "express";
import { storage } from "./storage";

const VALID_ADMIN_ROLES = ["super_admin", "operator", "viewer"] as const;
type AdminRole = (typeof VALID_ADMIN_ROLES)[number];

const INVALID_CREDENTIALS_MESSAGE = "用户名或密码错误";

async function establishAdminSession(req: Request, adminAccountId: string, adminRole: string) {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err: any) => {
      if (err) return reject(err);
      req.session.adminAccountId = adminAccountId;
      req.session.adminRole = adminRole;
      req.session.save((saveErr: any) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const session = req.session as any;

  if (session?.adminAccountId) {
    try {
      const adminAccount = await storage.getAdminAccountById(session.adminAccountId);
      if (!adminAccount || adminAccount.status !== "active") {
        return res.status(403).json({ message: "Forbidden - Admin access required" });
      }
      (req as any).adminAccount = adminAccount;
      (req as any).adminRole = adminAccount.role;
      return next();
    } catch (error) {
      console.error("Error checking admin account status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  if (session?.userId) {
    try {
      const user = await storage.getUser(session.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden - Admin access required" });
      }
      (req as any).adminRole = "super_admin";
      return next();
    } catch (error) {
      console.error("Error checking admin status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  return res.status(401).json({ message: "Unauthorized" });
};

export const requireSuperAdmin: RequestHandler = (req, res, next) => {
  const role = (req as any).adminRole;
  if (role !== "super_admin") {
    return res.status(403).json({ message: "Forbidden - Super admin access required" });
  }
  next();
};

export const requireOperatorOrAbove: RequestHandler = (req, res, next) => {
  const role = (req as any).adminRole;
  if (role !== "super_admin" && role !== "operator") {
    return res.status(403).json({ message: "Forbidden - Operator access required" });
  }
  next();
};

export function registerAdminAuthRoutes(app: Express) {
  app.post("/api/admin/login", async (req: Request, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "用户名和密码不能为空" });
      }

      const adminAccount = await storage.getAdminAccountByUsername(username);
      if (!adminAccount) {
        return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
      }

      if (adminAccount.status !== "active") {
        console.warn("Admin login attempt for disabled account", {
          username: adminAccount.username,
          status: adminAccount.status,
        });
        return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
      }

      const bcrypt = await import("bcrypt");
      const isValid = await bcrypt.compare(password, adminAccount.passwordHash);
      if (!isValid) {
        return res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
      }

      await storage.updateAdminLastLogin(adminAccount.id);
      await establishAdminSession(req, adminAccount.id, adminAccount.role);

      return res.json({
        message: "登录成功",
        id: adminAccount.id,
        username: adminAccount.username,
        role: adminAccount.role,
        displayName: adminAccount.displayName,
      });
    } catch (error) {
      console.error("Error during admin login:", error);
      return res.status(500).json({ message: "登录失败" });
    }
  });

  app.get("/api/admin/me", requireAdmin, async (req: Request, res) => {
    const adminAccount = (req as any).adminAccount;
    const session = req.session as any;

    if (adminAccount) {
      return res.json({
        id: adminAccount.id,
        username: adminAccount.username,
        role: adminAccount.role,
        displayName: adminAccount.displayName,
        isAdmin: true,
      });
    }

    if (session?.userId) {
      const user = await storage.getUser(session.userId);
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
      return res.json({ message: "密码已重置" });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
}
