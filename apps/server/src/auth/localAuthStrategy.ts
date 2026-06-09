import type { AuthStrategy, LoginResult } from "./authStrategy";
import type { Request } from "express";
import bcrypt from "bcrypt";
import { storage } from "../storage";
import { sanitizeAuthUser } from "./sanitizeAuthUser";
import { logger } from "../lib/logger";

export class LocalAuthStrategy implements AuthStrategy {
  async login(req: Request, credentials: Record<string, unknown>): Promise<LoginResult> {
    const phoneNumber = credentials.phoneNumber as string | undefined;
    const password = credentials.password as string | undefined;

    if (!phoneNumber || !password) {
      return { success: false, error: "phoneNumber and password are required" };
    }

    try {
      const users = await storage.getUserByPhone(phoneNumber);

      if (users.length === 0) {
        return { success: false, error: "用户不存在" };
      }

      const user = users[0];

      if (!user.password) {
        return { success: false, error: "该账号未设置密码" };
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return { success: false, error: "密码错误" };
      }

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) return reject(err);
          req.session.userId = user.id;
          req.session.save((saveErr) => {
            if (saveErr) return reject(saveErr);
            resolve();
          });
        });
      });

      return {
        success: true,
        user: sanitizeAuthUser(user),
        sessionToken: req.sessionID,
      };
    } catch (error) {
      logger.error("[LocalAuthStrategy] Login failed", { error: String(error) });
      return { success: false, error: "Login failed. Please try again." };
    }
  }

  async register(req: Request, credentials: Record<string, unknown>): Promise<LoginResult> {
    const phoneNumber = credentials.phoneNumber as string | undefined;
    const password = credentials.password as string | undefined;

    if (!phoneNumber || !password) {
      return { success: false, error: "phoneNumber and password are required" };
    }

    try {
      const existing = await storage.getUserByPhone(phoneNumber);
      if (existing.length > 0) {
        return this.login(req, credentials);
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await storage.createUserWithPhone({
        phoneNumber,
        email: `${phoneNumber}@test.joyjoin.app`,
        firstName: "",
        lastName: phoneNumber,
      });

      await storage.updateUser(user.id, { password: passwordHash });

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) return reject(err);
          req.session.userId = user.id;
          req.session.save((saveErr) => {
            if (saveErr) return reject(saveErr);
            resolve();
          });
        });
      });

      return {
        success: true,
        user: sanitizeAuthUser({ ...user, password: passwordHash }),
        sessionToken: req.sessionID,
      };
    } catch (error) {
      logger.error("[LocalAuthStrategy] Register failed", { error: String(error) });
      return { success: false, error: "Registration failed. Please try again." };
    }
  }
}
