import type { Express, Request } from "express";
import { requireAuth } from "../../middleware/auth";
import { setupWechatAuth } from "../../wechatAuth";
import { storage } from "../../storage";
import { authEndpointLimiter } from "../../rateLimiter";
import { logger } from "../../lib/logger";
import { sanitizeAuthUser } from "../../auth/sanitizeAuthUser";
import type { AuthUserResponse } from "@shared/api";
import type { User } from "@shared/schema";
import { buildMascotConfigFromEnv } from "@shared/mascotConfig";
import type { TierDisplayFlags } from "@shared/socialIcebreakerTierManifest";
import { peekCachedAnalysis } from "../../xiaoyueAnalysisService";
import type { ArchetypeAnalysisInput } from "../../xiaoyueAnalysisService";

// Module-level cached mascot config (env vars are immutable after startup)
const mascotConfig = buildMascotConfigFromEnv({
  MASCOT_DISPLAY_NAME: process.env.MASCOT_DISPLAY_NAME,
  MASCOT_BACKSTORY_ENABLED: process.env.MASCOT_BACKSTORY_ENABLED,
  MASCOT_ORIGIN_LORE_ENABLED: process.env.MASCOT_ORIGIN_LORE_ENABLED,
});

const VALID_GLOW_VARIANTS: TierDisplayFlags['glowVariant'][] = ['default', 'tipsy', 'kill'];
const resolvedGlowVariant = VALID_GLOW_VARIANTS.includes(process.env.SOCIAL_ICEBREAKER_GLOW_TIER_VARIANT as TierDisplayFlags['glowVariant'])
  ? (process.env.SOCIAL_ICEBREAKER_GLOW_TIER_VARIANT as TierDisplayFlags['glowVariant'])
  : 'default';

logger.info('Mascot config resolved', {
  displayName: mascotConfig.displayName,
  backstoryEnabled: !!mascotConfig.backstory,
  glowVariant: resolvedGlowVariant,
});

export function registerAuthRoutes(app: Express): void {
  // Apply rate limiting to auth endpoints before registering auth routes
  // This protects against brute-force and abuse of login/token endpoints
  app.use("/api/auth/wechat", authEndpointLimiter);

  // WeChat auth setup
  setupWechatAuth(app);

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
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const profileEssentialComplete = !!(
        user.displayName &&
        user.gender &&
        user.currentCity
      );

      const profileExtendedComplete = !!(
        user.educationLevel &&
        (user.industryNicheLabel || user.industryCategoryLabel) &&
        user.hometownRegionCity
      );

      let activeAssessmentSessionId: string | null = null;
      try {
        const activeSession = await storage.getAssessmentSessionByUser(userId);
        if (activeSession?.id) {
          activeAssessmentSessionId = activeSession.id;
        }
      } catch (e) {
        // Ignore errors - session lookup is optional
      }

      type OnboardingStep = 'onboarding' | 'personality-test' | 'essential-data' | 'extended-data' | 'profile-review' | 'discover';

      let nextStep: OnboardingStep;
      if (!user.hasCompletedPersonalityTest && !user.hasCompletedRegistration) {
        nextStep = 'onboarding';
      } else if (!user.hasCompletedPersonalityTest) {
        nextStep = 'personality-test';
      } else if (!profileEssentialComplete) {
        nextStep = 'essential-data';
      } else if (!user.hasCompletedInterestsCarousel) {
        nextStep = 'extended-data';
      } else if (!user.hasSeenProfileReview) {
        nextStep = 'profile-review';
      } else {
        nextStep = 'discover';
      }

      const stepOrder: OnboardingStep[] = [
        'onboarding',
        'personality-test',
        'essential-data',
        'extended-data',
        'profile-review',
        'discover',
      ];

      const baseIndex = stepOrder.indexOf(nextStep);
      const checkpointValue = user.onboardingCheckpoint as OnboardingStep | null;
      const checkpointIndex = checkpointValue ? stepOrder.indexOf(checkpointValue) : -1;

      if (
        checkpointValue &&
        checkpointIndex !== -1 &&
        baseIndex !== -1 &&
        checkpointIndex > baseIndex &&
        checkpointIndex < stepOrder.indexOf('discover')
      ) {
        const nextStepIndex = Math.min(checkpointIndex + 1, stepOrder.indexOf('discover'));
        nextStep = stepOrder[nextStepIndex];
      }

      const tierDisplayFlags: TierDisplayFlags = {
        glowVariant: resolvedGlowVariant,
      };

      let xiaoyueAnalysis: NonNullable<AuthUserResponse['xiaoyueAnalysis']> | null = null;
      if (user.primaryArchetype) {
        try {
          const roleResult = await storage.getRoleResult(userId);
          if (roleResult) {
            const analysisInput: ArchetypeAnalysisInput = {
              archetype: user.primaryArchetype,
              secondaryArchetype: user.secondaryArchetype ?? null,
              traitScores: {
                affinity: roleResult.affinityScore ?? 50,
                openness: roleResult.opennessScore ?? 50,
                conscientiousness: roleResult.conscientiousnessScore ?? 50,
                emotionalStability: roleResult.emotionalStabilityScore ?? 50,
                extraversion: roleResult.extraversionScore ?? 50,
                positivity: roleResult.positivityScore ?? 50,
              },
            };
            const cached = peekCachedAnalysis(analysisInput);
            if (cached) {
              const { ...publicResult } = cached;
              xiaoyueAnalysis = publicResult;
            }
          }
        } catch (e) {
          // Non-critical: if cache lookup fails, return null silently
        }
      }

      const authUserResponse: AuthUserResponse = {
        ...sanitizeAuthUser(user),
        nextStep,
        profileEssentialComplete,
        profileExtendedComplete,
        activeAssessmentSessionId,
        paymentsEnabled: (process.env.PAYMENTS_ENABLED ?? "false").toLowerCase() === "true",
        mascotDisplayName: mascotConfig.displayName,
        mascotBackstory: mascotConfig.backstory,
        tierDisplayFlags,
        xiaoyueAnalysis,
      };

      res.json(authUserResponse);
    } catch (error) {
      logger.error("Error fetching user:", { error });
      res.status(500).json({ message: "Failed to fetch user" });
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
