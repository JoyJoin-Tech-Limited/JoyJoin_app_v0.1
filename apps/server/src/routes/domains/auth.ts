import type { Express, Request } from "express";
import { requireAuth } from "../../middleware/auth";
import { setupWechatAuth } from "../../wechatAuth";
import { storage } from "../../storage";
import { authEndpointLimiter } from "../../rateLimiter";
import { logger } from "../../lib/logger";
import { captureLocationSnapshot } from "../../lib/captureLocationSnapshot";
import { sanitizeAuthUser } from "../../auth/sanitizeAuthUser";
import { isTestMode } from "../../auth/policy";
import type { AuthUserResponse } from "@shared/api";
import type { User } from "@shared/schema";
import { buildAuthUserResponse } from "../../lib/buildAuthUserResponse";
import { computeOnboardingNextStep } from "../../lib/computeOnboardingNextStep";
import { getFeatureFlag } from "../../lib/featureFlags";
export function registerAuthRoutes(app: Express): void {
  // WeChat auth setup — skipped in test mode (phone+password login instead)
  if (!isTestMode()) {
    app.use("/api/auth/wechat", authEndpointLimiter);
    setupWechatAuth(app);
  }

  // Admin password login endpoint (legacy: phone-based; kept for backward compat during transition)
  // New canonical endpoint is POST /api/admin/login (username-based).
  app.post('/api/auth/admin-login', async (req: Request, res) => {
    try {
      // Support both old phone-based format and new username-based format
      const { username, phoneNumber, password } = req.body;
      const loginId = username || phoneNumber;

      if (!loginId || !password) {
        return res.status(400).json({ message: "用户名和密码不能为空" });
      }

      const bcrypt = await import('bcrypt');

      // Try new admin_accounts table first (username-based)
      const adminAccount = await storage.getAdminAccountByUsername(loginId);
      if (adminAccount) {
        if (adminAccount.status !== 'active') {
          logger.warn("Admin login attempt for disabled account", {
            username: adminAccount.username,
            status: adminAccount.status,
          });
          return res.status(401).json({ message: "用户名或密码错误" });
        }
        const isValid = await bcrypt.compare(password, adminAccount.passwordHash);
        if (!isValid) {
          return res.status(401).json({ message: "用户名或密码错误" });
        }
        await storage.updateAdminLastLogin(adminAccount.id);
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err: any) => {
            if (err) return reject(err);
            req.session.adminAccountId = adminAccount.id;
            req.session.adminRole = adminAccount.role;
            req.session.save((saveErr: any) => {
              if (saveErr) return reject(saveErr);
              resolve();
            });
          });
        });
        return res.json({ message: "登录成功", role: adminAccount.role, displayName: adminAccount.displayName });
      }

      // Fallback: legacy users table (phone-based admin, transitional)
      if (phoneNumber) {
        const users = await storage.getUserByPhone(phoneNumber);
        if (users.length === 0) {
          return res.status(401).json({ message: "用户名或密码错误" });
        }
        const user = users[0];
        if (!user.isAdmin) {
          return res.status(403).json({ message: "该账号没有管理员权限" });
        }
        if (!user.password) {
          return res.status(401).json({ message: "该账号未设置密码" });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ message: "用户名或密码错误" });
        }
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err: any) => {
            if (err) return reject(err);
            req.session.userId = user.id;
            req.session.save((saveErr: any) => {
              if (saveErr) return reject(saveErr);
              resolve();
            });
          });
        });
        return res.json({ message: "登录成功", userId: user.id });
      }

      return res.status(401).json({ message: "用户名或密码错误" });
    } catch (error) {
      logger.error("Error during admin login", { error: String(error) });
      res.status(500).json({ message: "登录失败" });
    }
  });

  // Dev-only login endpoint for testing
  app.post('/api/auth/dev-login', async (req: Request, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ message: "Dev login is only available in development mode" });
    }

    try {
      const testUsers = await storage.getUserByPhone("dev-test-12345");
      let testUser = testUsers && testUsers.length > 0 ? testUsers[0] : null;

      if (!testUser) {
        testUser = await storage.createUserWithPhone({
          phoneNumber: "dev-test-12345",
          email: "dev-test@joyjoin.app",
          firstName: "测试",
          lastName: "用户",
        });
      }

      req.session.regenerate((err: any) => {
        if (err) {
          logger.error("Session regeneration error", { error: String(err) });
          return res.status(500).json({ message: "Dev login failed" });
        }

        req.session.userId = testUser!.id;
        req.session.save((err: any) => {
          if (err) {
            logger.error("Session save error", { error: String(err) });
            return res.status(500).json({ message: "Dev login failed" });
          }

          logger.info("[DEV-LOGIN] Test session created for user", { userId: testUser!.id });
          res.json({
            message: "Dev login successful",
            userId: testUser!.id,
          });
        });
      });
    } catch (error) {
      logger.error("Error during dev login", { error: String(error) });
      res.status(500).json({ message: "Dev login failed" });
    }
  });

  // ── Phone+password auth (dev/test accounts, always available) ───────────
  app.post('/api/auth/login', async (req: Request, res) => {
      try {
        const { phone, password } = req.body;
        if (!phone || !password) {
          return res.status(400).json({ message: "手机号和密码不能为空" });
        }

        const users = await storage.getUserByPhone(phone);
        if (!users || users.length === 0) {
          return res.status(401).json({ message: "手机号或密码错误" });
        }

        const user = users[0];
        if (!user.password) {
          return res.status(401).json({ message: "该账号未设置密码，请使用微信登录" });
        }

        const bcrypt = await import('bcrypt');
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return res.status(401).json({ message: "手机号或密码错误" });
        }

        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err: any) => {
            if (err) return reject(err);
            req.session.userId = user.id;
            req.session.save((saveErr: any) => {
              if (saveErr) return reject(saveErr);
              resolve();
            });
          });
        });

        logger.info("[Test Auth] Login success", { userId: user.id });
        const fullUser = await buildAuthUserResponse(user.id);
        res.json({
          success: true,
          isNewUser: false,
          user: fullUser,
          sessionToken: req.sessionID,
        });

        // Best-effort geolocation capture; do not await to avoid delaying auth response.
        captureLocationSnapshot(req, "login", user.id).catch(() => {});
      } catch (error: any) {
        logger.error("[Test Auth] Login error", { error: String(error) });
        res.status(500).json({ message: "登录失败" });
      }
    });

    app.post('/api/auth/register', async (req: Request, res) => {
      try {
        const { phone, password, displayName, gender, archetype } = req.body;
        if (!phone || !password) {
          return res.status(400).json({ message: "手机号和密码为必填项" });
        }

        const existing = await storage.getUserByPhone(phone);
        if (existing && existing.length > 0) {
          return res.status(409).json({ message: "该手机号已注册" });
        }

        const bcrypt = await import('bcrypt');
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await storage.createUserWithPhone({
          phoneNumber: phone,
          email: `test_${phone}@joyjoin.test`,
          firstName: displayName || phone,
          lastName: "",
        });

        await storage.updateUser(user.id, {
          password: hashedPassword,
          displayName: displayName || phone,
          ...(gender ? { gender } : {}),
          ...(archetype ? {
            archetype,
            primaryArchetype: archetype,
            hasCompletedPersonalityTest: true,
          } : {}),
        });

        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err: any) => {
            if (err) return reject(err);
            req.session.userId = user.id;
            req.session.save((saveErr: any) => {
              if (saveErr) return reject(saveErr);
              resolve();
            });
          });
        });

        const updatedUser = await storage.getUser(user.id) ?? user;
        logger.info("[Test Auth] Register success", { userId: user.id });
        res.json({
          success: true,
          user: sanitizeAuthUser(updatedUser),
          sessionToken: req.sessionID,
        });
      } catch (error: any) {
        logger.error("[Test Auth] Register error", { error: String(error) });
        res.status(500).json({ message: "注册失败" });
      }
    });

  // Complete onboarding - sets registration flags and user profile data
  app.post('/api/auth/complete-onboarding', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const {
        displayName,
        gender,
        currentCity,
        intent,
        birthYear,
        relationshipStatus,
      } = req.body;

      if (!displayName || !gender || !currentCity || !intent || intent.length === 0) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const updateData: Partial<User> = {
        displayName,
        gender,
        currentCity,
        intent,
        hasCompletedRegistration: true,
        hasCompletedInterestsTopics: true, // Skip interests step in new flow
      };

      // Convert birthYear to birthdate if provided
      if (birthYear && typeof birthYear === 'number') {
        updateData.birthdate = `${birthYear}-01-01`;
      }
      if (relationshipStatus) {
        updateData.relationshipStatus = relationshipStatus;
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      logger.info("[COMPLETE-ONBOARDING] Updated user", { userId, displayName, gender, currentCity });

      res.json({ message: "Onboarding completed", user: sanitizeAuthUser(updatedUser) });
    } catch (error) {
      logger.error("Error completing onboarding", { error: String(error) });
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Complete personality test - sets hasCompletedPersonalityTest flag
  app.post('/api/auth/complete-personality-test', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const updatedUser = await storage.updateUser(userId, {
        hasCompletedPersonalityTest: true,
        hasCompletedProfileSetup: true,
        hasCompletedRegistration: true,
        hasCompletedInterestsTopics: true,
      });
      logger.info("[COMPLETE-PERSONALITY-TEST] User completed personality test flow", { userId });

      // Invalidate user cache to reflect role changes immediately
      if (req.session) {
        // Force session save to ensure state is consistent
        req.session.save(() => {});
      }

      res.json({ message: "Personality test completed", user: sanitizeAuthUser(updatedUser) });
    } catch (error) {
      logger.error("Error completing personality test", { error: String(error) });
      res.status(500).json({ message: "Failed to complete personality test" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', async (req: Request, res) => {
    if (process.env.DEBUG_AUTH === "1") {
      logger.debug("Auth user lookup", {
        request_id: req.requestId,
        has_user_session: Boolean(req.session?.userId),
        has_admin_session: Boolean(req.session?.adminAccountId),
      });
    }

    if (!req.session?.adminAccountId && !req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.session?.adminAccountId) {
      try {
        const adminAccount = await storage.getAdminAccountById(req.session.adminAccountId);
        if (adminAccount && adminAccount.status === 'active') {
          return res.json({
            id: adminAccount.id,
            displayName: adminAccount.displayName || adminAccount.username,
            isAdmin: true,
            adminRole: adminAccount.role,
            nextStep: 'discover',
          });
        }
        req.session.adminAccountId = undefined;
        req.session.adminRole = undefined;
        return res.status(401).json({ message: "Unauthorized" });
      } catch (err) {
        return res.status(500).json({ message: "Internal server error" });
      }
    }

    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.session.userId;
      const authUserResponse = await buildAuthUserResponse(userId);

      if (!authUserResponse) {
        req.session.userId = undefined;
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Attach pending referral code from session if present
      if (req.session.pendingReferralCode) {
        (authUserResponse as any).pendingReferralCode = req.session.pendingReferralCode;
      }

      res.json(authUserResponse);
    } catch (error) {
      logger.error("Error fetching user:", { error });
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/auth/onboarding/restart', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const result = await storage.restartOnboarding(userId);

      if (result.action === 'already_complete') {
        logger.info("[ONBOARDING-RESTART] rejected already_complete", { userId });
        return res.status(400).json({ code: 'ONBOARDING_ALREADY_COMPLETE', message: "Onboarding already complete" });
      }

      if (result.action === 'idempotent') {
        logger.info("[ONBOARDING-RESTART] idempotent", { userId });
        const authResponse = await buildAuthUserResponse(userId);
        return res.json(authResponse);
      }

      logger.info("[ONBOARDING-RESTART] success", {
        userId,
        oldCount: (result.user.onboardingRestartCount ?? 0) - 1,
        newCount: result.user.onboardingRestartCount ?? 0,
      });

      const authResponse = await buildAuthUserResponse(userId);
      return res.json(authResponse);
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(404).json({ message: "User not found" });
      }
      logger.error("Error during onboarding restart", { error: String(error) });
      res.status(500).json({ message: "Failed to restart onboarding" });
    }
  });

  app.post('/api/auth/onboarding/force-skip', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      if (!(await getFeatureFlag('onboardingForceSkip', false))) {
        return res.status(403).json({ code: 'FORCE_SKIP_DISABLED', message: "Force skip is not enabled" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentStep = computeOnboardingNextStep(user);
      const skipFlags: Partial<User> = { updatedAt: new Date() };

      switch (currentStep) {
        case 'onboarding':
          skipFlags.hasCompletedRegistration = true;
          break;
        case 'personality-test':
          skipFlags.hasCompletedPersonalityTest = true;
          break;
        case 'extended-data':
          skipFlags.hasCompletedInterestsCarousel = true;
          break;
        case 'profile-review':
          skipFlags.hasSeenProfileReview = true;
          break;
        case 'essential-data':
          // Essential data has no dedicated skip flag; set registration complete
          // and rely on client to fill required fields later.
          skipFlags.hasCompletedRegistration = true;
          break;
        default:
          return res.status(400).json({ code: 'NOT_SKIPPABLE', message: "Current step cannot be skipped" });
      }

      await storage.updateUser(userId, skipFlags);

      logger.info("[ONBOARDING-FORCE-SKIP] success", {
        userId,
        skippedStep: currentStep,
        action: 'ONBOARDING_FORCE_SKIPPED',
      });

      const authResponse = await buildAuthUserResponse(userId);
      return res.json(authResponse);
    } catch (error) {
      logger.error("Error during onboarding force skip", { error: String(error) });
      res.status(500).json({ message: "Failed to skip onboarding step" });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res) => {
    try {
      req.session.destroy((err: any) => {
        if (err) {
          logger.error("Error destroying session", { error: String(err) });
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      logger.error("Error during logout", { error: String(error) });
      res.status(500).json({ message: "Failed to logout" });
    }
  });
}
