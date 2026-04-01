import type { Express, Request } from "express";
import { setupPhoneAuth, isPhoneAuthenticated, validateVerificationCode } from "../../phoneAuth";
import { setupWechatAuth } from "../../wechatAuth";
import { storage } from "../../storage";
import { authEndpointLimiter } from "../../rateLimiter";
import { db } from "../../db";
import { and, desc, eq } from "drizzle-orm";
import { assessmentAnswers, assessmentSessions, users, type User } from "@shared/schema";

export function registerAuthRoutes(app: Express): void {
  // Apply rate limiting to auth endpoints before registering auth routes
  // This protects against brute-force and abuse of login/token endpoints
  app.use("/api/auth/wechat", authEndpointLimiter);
  app.use("/api/auth/phone", authEndpointLimiter);

  // Phone auth setup
  setupPhoneAuth(app);

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
          console.warn("Admin login attempt for disabled account", {
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
      console.error("Error during admin login:", error);
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
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Dev login failed" });
        }

        req.session.userId = testUser!.id;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "Dev login failed" });
          }

          console.log("[DEV-LOGIN] Test session created for user:", testUser!.id);
          res.json({
            message: "Dev login successful",
            userId: testUser!.id,
          });
        });
      });
    } catch (error) {
      console.error("Error during dev login:", error);
      res.status(500).json({ message: "Dev login failed" });
    }
  });

  // Simplified phone login (no SMS verification for MVP)
  app.post('/api/auth/quick-login', async (req: Request, res) => {
    try {
      const { phone } = req.body;

      if (!phone || phone.length < 8) {
        return res.status(400).json({ message: "Invalid phone number" });
      }

      // Find or create user by phone number
      const existingUsers = await storage.getUserByPhone(phone);
      let user = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;

      if (!user) {
        user = await storage.createUserWithPhone({
          phoneNumber: phone,
          email: `${phone}@joyjoin.app`,
          firstName: "用户",
          lastName: phone.slice(-4),
        });
        console.log("[PHONE-LOGIN] Created new user:", user.id);
      } else {
        console.log("[PHONE-LOGIN] Found existing user:", user.id);
      }

      req.session.regenerate((err: any) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Login failed" });
        }

        req.session.userId = user!.id;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "Login failed" });
          }

          console.log("[PHONE-LOGIN] Session created for user:", user!.id);
          res.json({
            message: "Login successful",
            userId: user!.id,
          });
        });
      });
    } catch (error) {
      console.error("Error during phone login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Cache pre-signup answers by temporary session
  app.post('/api/auth/presignup-cache', async (req: any, res) => {
    try {
      const { sessionId, answers, metadata } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      const record = await storage.savePreSignupData(sessionId, { answers, metadata });
      res.json({ sessionId: record.temporarySessionId, answers: record.answers || [], metadata: record.metadata || null });
    } catch (error: any) {
      console.error('[Presignup Cache] Error:', error);
      res.status(500).json({ message: 'Failed to cache answers' });
    }
  });

  app.get('/api/auth/presignup-cache/:sessionId', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const record = await storage.getPreSignupData(sessionId);
      if (!record) {
        return res.status(404).json({ message: 'No data found' });
      }
      res.json({ sessionId: record.temporarySessionId, answers: record.answers || [], metadata: record.metadata || null });
    } catch (error: any) {
      console.error('[Presignup Cache] Error:', error);
      res.status(500).json({ message: 'Failed to fetch cached answers' });
    }
  });

  // Unified onboarding - auth + profile + answers in one transaction
  app.post('/api/auth/unified-onboarding', async (req: any, res) => {
    try {
      const { authData, profileData, assessmentAnswers: assessmentAnswerPayload, temporarySessionId } = req.body;
      const phoneNumber = authData?.phoneNumber || authData?.phone;
      const code = authData?.code;

      if (!phoneNumber || !code) {
        return res.status(400).json({ message: 'Phone number and code are required' });
      }

      const verification = validateVerificationCode(phoneNumber, code);
      if (!verification.ok) {
        return res.status(400).json({ message: verification.message });
      }

      if (!profileData?.displayName || !profileData?.gender || !profileData?.currentCity || !Array.isArray(profileData?.intent) || profileData.intent.length === 0) {
        return res.status(400).json({ message: 'Missing required profile fields' });
      }

      const cachedRecord = temporarySessionId ? await storage.getPreSignupData(temporarySessionId) : undefined;
      const incomingAnswers = Array.isArray(assessmentAnswerPayload) ? assessmentAnswerPayload : [];
      const mergedAnswers = [...incomingAnswers, ...(Array.isArray(cachedRecord?.answers) ? cachedRecord?.answers : [])];
      const dedupedAnswers = new Map<string, any>();

      const getAnswerTimestamp = (answer: any): number | null => {
        if (!answer) return null;
        const timestampFields = [
          "updatedAt",
          "updated_at",
          "timestamp",
          "answeredAt",
          "answered_at",
          "createdAt",
          "created_at",
        ];
        for (const field of timestampFields) {
          const value = (answer as any)[field];
          if (!value) continue;
          const date = typeof value === "number" ? new Date(value) : new Date(String(value));
          const time = date.getTime();
          if (!Number.isNaN(time)) return time;
        }
        return null;
      };

      for (const ans of mergedAnswers) {
        const key = (ans && (ans.questionId || ans.question_id || ans.id)) ? String(ans.questionId || ans.question_id || ans.id) : null;
        if (!key) continue;

        const existing = dedupedAnswers.get(key);
        if (!existing) {
          dedupedAnswers.set(key, ans);
          continue;
        }

        const incomingTs = getAnswerTimestamp(ans);
        const existingTs = getAnswerTimestamp(existing);
        if (incomingTs === null && existingTs === null) {
          continue;
        }
        if (existingTs === null || (incomingTs !== null && incomingTs > existingTs)) {
          dedupedAnswers.set(key, ans);
        }
      }

      const uniqueAnswers = Array.from(dedupedAnswers.values());

      let user: User | undefined;
      let assessmentSessionId: string | null = null;

      await db.transaction(async (tx: any) => {
        const existing = await tx.select().from(users).where(eq(users.phoneNumber, phoneNumber));
        if (existing.length > 0) {
          user = existing[0];
        } else {
          const [created] = await tx.insert(users).values({
            phoneNumber,
            email: `${phoneNumber}@joyjoin.app`,
            firstName: '用户',
            lastName: phoneNumber.slice(-4),
          }).returning();
          user = created;
        }

        const updates: Partial<User> = {
          displayName: profileData?.displayName,
          gender: profileData?.gender,
          currentCity: profileData?.currentCity,
          intent: profileData?.intent,
          hasCompletedRegistration: true,
          hasCompletedInterestsTopics: true,
          hasCompletedProfileSetup: true,
        };
        if (profileData?.birthYear) {
          updates.birthdate = `${profileData.birthYear}-01-01`;
        }
        if (profileData?.relationshipStatus) {
          updates.relationshipStatus = profileData.relationshipStatus;
        }

        const [updatedUser] = await tx.update(users).set(updates).where(eq(users.id, user!.id)).returning();
        if (updatedUser) {
          user = updatedUser;
        }

        if (uniqueAnswers.length > 0) {
          const [session] = await tx.insert(assessmentSessions).values({
            userId: user!.id,
            phase: 'post_signup',
            preSignupData: uniqueAnswers,
            currentQuestionIndex: uniqueAnswers.length,
          }).returning();
          assessmentSessionId = session?.id || null;

          for (const ans of uniqueAnswers) {
            if (!assessmentSessionId) break;
            const questionId = String(ans.questionId || ans.question_id || ans.id);
            const selectedOption = ans.selectedOption || ans.value || ans.answer || ans.selected_option;
            await tx.insert(assessmentAnswers).values({
              sessionId: assessmentSessionId,
              questionId,
              questionLevel: (ans.questionLevel || ans.question_level || 1),
              selectedOption,
              traitScores: ans.traitScores || ans.trait_scores || {},
            }).onConflictDoUpdate({
              target: [assessmentAnswers.sessionId, assessmentAnswers.questionId],
              set: {
                selectedOption,
                traitScores: ans.traitScores || ans.trait_scores || {},
                answeredAt: new Date(),
              },
            });
          }
        }
      });

      if (!user) {
        return res.status(500).json({ message: 'Failed to create user' });
      }

      if (temporarySessionId) {
        await storage.clearPreSignupData(temporarySessionId);
      }

      req.session.userId = user.id;
      await new Promise((resolve, reject) => {
        req.session.save((err: any) => err ? reject(err) : resolve(null));
      });

      res.json({ message: 'Onboarding completed', user, assessmentSessionId });
    } catch (error: any) {
      console.error('[Unified Onboarding] Error:', error);
      res.status(500).json({ message: 'Failed to complete onboarding' });
    }
  });

  // Complete onboarding - sets registration flags and user profile data
  app.post('/api/auth/complete-onboarding', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const {
        displayName,
        gender,
        currentCity,
        intent,
        birthYear,
        showBirthYear,
        relationshipStatus,
        preSignupAnswers,
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
      console.log("[COMPLETE-ONBOARDING] Updated user:", userId, { displayName, gender, currentCity });

      res.json({ message: "Onboarding completed", user: updatedUser });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Complete personality test - sets hasCompletedPersonalityTest flag
  app.post('/api/auth/complete-personality-test', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const updatedUser = await storage.updateUser(userId, {
        hasCompletedPersonalityTest: true,
        hasCompletedProfileSetup: true,
        hasCompletedRegistration: true,
        hasCompletedInterestsTopics: true,
      });
      console.log("[COMPLETE-PERSONALITY-TEST] User completed personality test flow:", userId);

      // Invalidate user cache to reflect role changes immediately
      if (req.session) {
        // Force session save to ensure state is consistent
        req.session.save(() => {});
      }

      res.json({ message: "Personality test completed", user: updatedUser });
    } catch (error) {
      console.error("Error completing personality test:", error);
      res.status(500).json({ message: "Failed to complete personality test" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', async (req: Request, res) => {
    if (process.env.DEBUG_AUTH === "1") {
      console.log("[AUTH/USER]", {
        sid: req.sessionID,
        cookie: req.headers.cookie,
        userId: req.session?.userId,
        adminAccountId: req.session?.adminAccountId,
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
        const sessions = await db
          .select({ id: assessmentSessions.id })
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.userId, userId),
              eq(assessmentSessions.phase, 'in_progress')
            )
          )
          .orderBy(desc(assessmentSessions.createdAt))
          .limit(1);
        if (sessions.length > 0) {
          activeAssessmentSessionId = sessions[0].id;
        }
      } catch (e) {
        // Ignore errors - session lookup is optional
      }

      type OnboardingStep = 'onboarding' | 'personality-test' | 'essential-data' | 'extended-data' | 'profile-review' | 'guide' | 'discover';

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
      } else if (!user.hasSeenGuide) {
        nextStep = 'guide';
      } else {
        nextStep = 'discover';
      }

      const stepOrder: OnboardingStep[] = [
        'onboarding',
        'personality-test',
        'essential-data',
        'extended-data',
        'profile-review',
        'guide',
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

      res.json({
        ...user,
        nextStep,
        profileEssentialComplete,
        profileExtendedComplete,
        activeAssessmentSessionId,
        paymentsEnabled: (process.env.PAYMENTS_ENABLED ?? "false").toLowerCase() === "true",
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res) => {
    try {
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });
}
