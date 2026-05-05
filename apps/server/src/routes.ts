//my path:/Users/felixg/projects/JoyJoin3/server/routes.ts
import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { registerAdminRoutes } from "./routes/domains/admin";
import { registerAnalyticsRoutes } from "./routes/domains/analytics";
import { registerAssessmentRoutes } from "./routes/domains/assessment";
import { registerAuthRoutes } from "./routes/domains/auth";
import { registerEventGroupOutcomeRoutes } from "./routes/domains/eventGroupOutcomes";
import { registerAssessmentV4Routes } from "./routes/domains/assessmentV4";
import { registerBlindBoxEventRoutes } from "./routes/domains/blindBoxEvents";
import { registerDemoRoutes } from "./routes/domains/demo";
import { registerGeoRoutes } from "./routes/domains/geo";
import { registerIcebreakerGameRoutes } from "./routes/domains/icebreakerGame";
import { registerProfileRoutes } from "./routes/domains/profile";
import { registerEventPoolRoutes } from "./routes/domains/eventPools";
import { registerIcebreakerRoutes } from "./routes/domains/icebreaker";
import { registerIcebreakerSessionRoutes } from "./routes/domains/icebreakerSessions";
import { registerOnboardingRoutes } from "./routes/domains/onboarding";
import { registerPaymentRoutes } from "./routes/domains/payments";
import { registerUserEventPoolRoutes } from "./routes/domains/userEventPools";
import { registerAdminOperationsRoutes } from "./routes/domains/adminOperations";
import { registerMatchingConfigRoutes } from "./routes/domains/matchingConfig";
import { registerMatchingAdminRoutes } from "./routes/domains/matchingAdmin";
import { registerAIServiceRoutes } from "./routes/domains/aiServices";
import { registerMatchExplanationRoutes } from "./routes/domains/matchExplanations";
import { registerAssessmentResultRoutes } from "./routes/domains/assessmentResults";
import { registerXiaoyueRoutes } from "./routes/domains/xiaoyue";
import { registerDevToolRoutes } from "./routes/domains/devTools";
import { storage } from "./storage";
import { isPhoneAuthenticated } from "./phoneAuth";
import { requireAdmin, requireOperatorOrAbove } from "./adminAuth";
import { isDevAuthToolsEnabled } from "./auth/policy";
import { logAdminAudit } from "./lib/adminAuditLogger";
import { venueMatchingService } from "./venueMatchingService";
import { broadcastEventStatusChanged, broadcastAdminAction, broadcastAttendanceStatusUpdated } from "./eventBroadcast";
import { matchEventPool, saveMatchResults } from "./poolMatchingService";
import { ARCHETYPE_NAMES } from "./archetypeConfig";
import type { ArchetypeName } from "./archetypeConfig";
import { registerHealthRoutes } from "./healthRoutes";
import { logger } from "./lib/logger";

import { getAuthenticatedUserId } from "./lib/requestAuth";
import { getMatchingMetricsSnapshot } from "./matchingMetrics";
import { queueSemanticProfileRecompute } from "./userSemanticProfileService";
import {
  assertValidTransition as assertValidEventPoolTransition,
  InvalidTransitionError as InvalidPoolTransitionError,
} from "./lib/stateTransitions";
import {
  checkVenueDataQuality,
  normalizeVenueQualityRecord,
} from "./lib/venueDataQuality";

import { aiEndpointLimiter, kpiEndpointLimiter } from "./rateLimiter";
import { checkUserAbuse, resetConversationTurns, recordTokenUsage } from "./abuseDetection";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { updateFullProfileSchema, insertEventFeedbackSchema, events, users, eventPools, eventPoolRegistrations, eventPoolGroups, insertEventPoolSchema, invitations, poolMatchingLogs, blindBoxEvents, referralCodes, referralConversions, assessmentSessions, userInterests, userInterestSignals, venues, venueTimeSlots, matchHistory, connections, reports, payments, type ChatMessage, type User } from "@shared/schema";
import * as schema from "@shared/schema";
import { normalizeProfileInterests, validateTelemetry } from "@shared/interests";
import { db } from "./db";
import { eq, or, and, desc, inArray, gt, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";

// Type alias for database transaction
type DbTransaction = NeonDatabase<typeof schema>;
type UserInterestSignalRow = typeof userInterestSignals.$inferSelect;
const SAMPLE_ARCHETYPE_COUNT = 3;

/**
 * Batch-load interest signals for multiple users.
 * Returns a Map<userId, UserInterestSignal[]>.
 */
async function loadInterestSignalsByUserIds(
  userIds: string[],
): Promise<Map<string, UserInterestSignalRow[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(userInterestSignals)
    .where(inArray(userInterestSignals.userId, userIds));
  const map = new Map<string, UserInterestSignalRow[]>();
  for (const row of rows) {
    const existing = map.get(row.userId) ?? [];
    existing.push(row);
    map.set(row.userId, existing);
  }
  return map;
}

function getActingAdminId(req: any): string {
  return req.adminAccount?.id ?? req.session?.userId ?? "unknown";
}

function firstNonEmptyString(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

type EventChatParticipantSummary = {
  id: string;
  displayName: string;
  firstName: string | null;
  nickname: string;
  archetype: string | null;
  profileImageUrl: string | null;
};

function getEventChatDisplayName(user: Pick<User, 'displayName' | 'firstName' | 'lastName'>): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return firstNonEmptyString(user.displayName, fullName) ?? '参与者';
}

function toEventChatParticipantSummary(
  user: Pick<User, 'id' | 'displayName' | 'firstName' | 'lastName' | 'archetype' | 'profileImageUrl' | 'wechatAvatarUrl'>,
): EventChatParticipantSummary {
  const displayName = getEventChatDisplayName(user);

  return {
    id: user.id,
    displayName,
    firstName: user.firstName ?? null,
    nickname: displayName,
    archetype: user.archetype ?? null,
    profileImageUrl: firstNonEmptyString(user.profileImageUrl, user.wechatAvatarUrl) ?? null,
  };
}

function toEventChatMessageSummary(message: ChatMessage & { user: User }) {
  return {
    ...message,
    user: toEventChatParticipantSummary(message.user),
  };
}

function buildVenueAuditAfter(body: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!body) return {};

  const allowedKeys = [
    "name",
    "type",
    "city",
    "district",
    "clusterId",
    "districtId",
    "commissionRate",
    "tags",
    "cuisines",
    "priceRange",
    "maxConcurrentEvents",
    "decorStyle",
    "tasteIntensity",
    "barThemes",
    "alcoholOptions",
    "vibeDescriptor",
    "isActive",
  ] as const;

  return Object.fromEntries(
    allowedKeys
      .filter((key) => body[key] !== undefined)
      .map((key) => [key, body[key]]),
  );
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // 🔧 确保 trust proxy 在 session 之前设置（防止 index.ts 漏掉）
  app.set('trust proxy', 1);

  // API v1 backward compat: /api/v1/* routes work identically to /api/* routes.
  // Rewrite happens before session and route handlers so all existing logic is reused.
  app.use((req, _res, next) => {
    if (req.url) {
      if (req.url.startsWith('/api/v1/')) {
        req.url = '/api/' + req.url.slice('/api/v1/'.length);
      } else if (req.url === '/api/v1' || req.url.startsWith('/api/v1?')) {
        req.url = '/api' + req.url.slice('/api/v1'.length);
      }
    }
    next();
  });
  
  // 🔧 DEBUG: Add identity headers to ALL API responses (Phase 1.1)
  app.use((req, res, next) => {
    res.setHeader("X-App", "joyjoin-api");
    res.setHeader("X-Instance", process.env.HOSTNAME || "replit");
    res.setHeader("X-Git", process.env.GIT_SHA || "unknown");
    next();
  });

  // Health and readiness endpoints must be before session middleware for cloud checks
  registerHealthRoutes(app);

  registerAnalyticsRoutes(app);

  // Reverse geocode endpoint - converts GPS coordinates to city/district
  // Uses Amap API for accurate Chinese address resolution

  // Session middleware
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  // Cookie domain configuration for cross-subdomain session sharing
  // In production with yuejuapp.com, use '.yuejuapp.com' to share across subdomains
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  const isProduction = process.env.NODE_ENV === 'production';
  
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction, // Required for secure cookies behind an HTTPS reverse proxy
    cookie: {
      domain: cookieDomain, // '.yuejuapp.com' enables sharing across api/admin/www subdomains
      httpOnly: true,
      secure: isProduction, // true when Nginx provides HTTPS
      maxAge: sessionTtl,
      sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-subdomain in production
    },
  }));

  registerAuthRoutes(app);
  registerOnboardingRoutes(app);
  registerPaymentRoutes(app);

  // Profile stats endpoint

  // ============ AI Chat Registration Routes (小悦对话注册) ============
  
  app.post('/api/registration/chat/start', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const { mode, enrichmentContext } = req.body; // 接收模式参数: express | standard | deep | all_in_one | enrichment
      
      if (userId) {
        resetConversationTurns(userId);
      }
      
      // Chat registration is deprecated - only enrichment mode is supported
      if (mode === 'enrichment' && enrichmentContext) {
        const { startXiaoyueChatEnrichment } = await import('./deepseekClient');
        const result = await startXiaoyueChatEnrichment(enrichmentContext);
        res.json(result);
        return;
      }
      
      // Legacy registration modes removed - return error
      res.status(400).json({ 
        message: "Chat registration is no longer supported. Please use the Duolingo-style onboarding flow." 
      });
    } catch (error) {
      console.error("Error starting chat registration:", error);
      res.status(500).json({ message: "Failed to start chat" });
    }
  });

  app.post('/api/registration/chat/message', async (req: any, res) => {
    try {
      const { message, conversationHistory, sessionId: clientSessionId } = req.body;
      const userId = req.session?.userId;
      
      if (userId) {
        const abuseCheck = await checkUserAbuse(userId, message);
        if (!abuseCheck.allowed) {
          return res.status(abuseCheck.action === 'ban' ? 403 : 429).json({ 
            message: abuseCheck.message,
            action: abuseCheck.action,
            violationType: abuseCheck.violationType
          });
        }
        if (abuseCheck.action === 'warn' && abuseCheck.message) {
          console.log(`[Abuse Detection] Warning for user ${userId}: ${abuseCheck.message}`);
        }
      }
      
      // 使用带推断引擎的增强版对话函数
      const { continueXiaoyueChatWithInference } = await import('./deepseekClient');
      // sessionId: 优先使用客户端传入的，其次用userId，再用express session ID，最后才是匿名ID
      const sessionId = clientSessionId || userId || req.sessionID || `anon_${Date.now()}`;
      const result = await continueXiaoyueChatWithInference(message, conversationHistory, sessionId);
      
      if (userId && (result as any).usage?.totalTokens) {
        await recordTokenUsage(userId, (result as any).usage.totalTokens);
      }
      
      // 返回结果，包含推断信息供前端调试
      res.json({
        ...result,
        inference: result.inferenceResult ? {
          skippedQuestions: result.inferenceResult.skipQuestions,
          inferred: result.inferenceResult.inferred.map(i => ({ field: i.field, value: i.value }))
        } : undefined
      });
    } catch (error) {
      console.error("Error in chat registration:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  app.post('/api/registration/chat/message/stream', async (req: any, res) => {
    const reqStart = Date.now();
    console.log(`\n[ROUTE PERF] ========== 请求到达 /api/registration/chat/message/stream ==========`);
    console.log(`[ROUTE PERF] 时间: ${new Date().toISOString()}`);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    
    const { message, conversationHistory, sessionId: clientSessionId } = req.body;
    const userId = req.session?.userId;
    
    if (!message || !conversationHistory) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: '缺少必要参数' })}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
      res.end();
      return;
    }
    
    const t1_afterValidation = Date.now();
    console.log(`[ROUTE PERF] 参数验证耗时: ${t1_afterValidation - reqStart}ms`);
    
    if (userId) {
      const abuseCheck = await checkUserAbuse(userId, message);
      if (!abuseCheck.allowed) {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          content: abuseCheck.message,
          action: abuseCheck.action,
          violationType: abuseCheck.violationType
        })}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
        res.end();
        return;
      }
      if (abuseCheck.action === 'warn' && abuseCheck.message) {
        res.write(`data: ${JSON.stringify({ 
          type: 'warning', 
          content: abuseCheck.message 
        })}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
      }
    }
    
    const t2_afterAbuseCheck = Date.now();
    console.log(`[ROUTE PERF] 滥用检查耗时: ${t2_afterAbuseCheck - t1_afterValidation}ms`);
    
    try {
      // 使用带推断引擎的增强版流式对话函数
      const { continueXiaoyueChatStreamWithInference } = await import('./deepseekClient');
      const t3_afterImport = Date.now();
      console.log(`[ROUTE PERF] 动态import耗时: ${t3_afterImport - t2_afterAbuseCheck}ms`);
      
      // sessionId: 优先使用客户端传入的，其次用userId，最后用会话ID（express-session会自动生成稳定的session ID）
      const sessionId = clientSessionId || userId || req.sessionID || `anon_${Date.now()}`;
      
      let chunkCount = 0;
      let firstChunkTime: number | null = null;
      
      for await (const chunk of continueXiaoyueChatStreamWithInference(message, conversationHistory, sessionId)) {
        if (firstChunkTime === null) {
          firstChunkTime = Date.now();
          console.log(`[ROUTE PERF] 首个chunk到达，从请求开始: ${firstChunkTime - reqStart}ms`);
        }
        chunkCount++;
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
      }
      
      const reqEnd = Date.now();
      console.log(`[ROUTE PERF] 发送chunks: ${chunkCount}, 请求总耗时: ${reqEnd - reqStart}ms`);
      console.log(`[ROUTE PERF] ========== 请求结束 ==========\n`);
    } catch (error) {
      console.error("Error in streaming chat:", error);
      res.write(`data: ${JSON.stringify({ type: 'error', content: '悦仔暂时走神了，请重试' })}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
    }
    
    res.end();
  });
  // ============ Registration Session Telemetry Routes ============
  
  // Create a new registration session (called when chat registration starts)
  app.post('/api/registration/sessions', async (req: any, res) => {
    try {
      const { sessionMode, deviceChannel } = req.body;
      const userId = req.session?.userId;
      const userAgent = req.headers['user-agent'];
      
      const session = await storage.createRegistrationSession({
        sessionMode: sessionMode || 'ai_chat',
        userId,
        deviceChannel,
        userAgent,
      });
      
      res.json({ sessionId: session.id });
    } catch (error) {
      console.error("Error creating registration session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });
  
  // Update registration session (lifecycle updates)
  app.patch('/api/registration/sessions/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Convert string dates to Date objects
      const processedUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (['l1CompletedAt', 'l2EnrichedAt', 'completedAt', 'abandonedAt', 'lastTouchAt'].includes(key) && value) {
          processedUpdates[key] = new Date(value as string);
        } else {
          processedUpdates[key] = value;
        }
      }
      
      const session = await storage.updateRegistrationSession(id, processedUpdates);
      res.json(session);
    } catch (error) {
      console.error("Error updating registration session:", error);
      res.status(500).json({ message: "Failed to update session" });
    }
  });
  
  // Get registration session stats (admin endpoint)
  app.get('/api/registration/sessions/stats', requireAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getRegistrationSessionStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting registration session stats:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // ========== Insight Feedback API ==========
  // 收集"小悦偷偷碎嘴"推理准确度反馈（无需登录）
  app.post('/api/insight-feedback', async (req: any, res) => {
    try {
      const { trigger, pillar, confidence, feedback, timestamp } = req.body;
      
      // 简单验证
      if (!trigger || !feedback || !['up', 'down'].includes(feedback)) {
        return res.status(400).json({ error: 'Invalid feedback data' });
      }
      
      // 记录到控制台（后续可存入数据库）
      console.log('[Insight Feedback]', {
        trigger,
        pillar,
        confidence,
        feedback,
        timestamp,
        sessionId: req.session?.id || 'anonymous'
      });
      
      // TODO: 存入数据库以供分析
      // await storage.saveInsightFeedback({ trigger, pillar, confidence, feedback, timestamp });
      
      res.json({ success: true, message: 'Feedback recorded' });
    } catch (error) {
      console.error("Error saving insight feedback:", error);
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  });

  registerAssessmentRoutes(app);
  registerEventGroupOutcomeRoutes(app);
  registerIcebreakerRoutes(app);
  registerIcebreakerSessionRoutes(app);
  registerAssessmentV4Routes(app);
  registerBlindBoxEventRoutes(app);
  registerDemoRoutes(app);
  registerGeoRoutes(app);
  registerIcebreakerGameRoutes(app);
  registerProfileRoutes(app);
  registerEventPoolRoutes(app);

  // Profile routes

  // ❌ DEPRECATED: Legacy interests-topics endpoint
  // Use /api/user/interests (Interest Carousel) instead
  app.patch('/api/profile', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = updateFullProfileSchema.safeParse(req.body);
      
      if (!result.success) {
        console.error(`[Profile PATCH] Validation failed for user ${userId}:`, JSON.stringify(result.error.issues, null, 2));
        return res.status(400).json({ error: result.error });
      }

      const profileData: Record<string, any> = { ...result.data };

      // ✅ Age validation (Phase 0: Fix #8) - JoyJoin is 18+ only
      if (profileData.birthdate) {
        const birthDate = new Date(profileData.birthdate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        // Adjust age if birthday hasn't occurred yet this year
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age < 18) {
          return res.status(400).json({ 
            message: "JoyJoin 仅面向 18 岁及以上用户开放",
            field: "birthdate" 
          });
        }
      }
      
      // Age validation for birthYear field (legacy support)
      // Fix: More strict validation to match birthdate precision
      if (profileData.birthYear && !profileData.birthdate) {
        const birthYear = parseInt(profileData.birthYear, 10);
        
        if (!Number.isFinite(birthYear)) {
          return res.status(400).json({
            message: "无效的出生年份",
            field: "birthYear",
          });
        }
        
        const currentYear = new Date().getFullYear();
        const roughAge = currentYear - birthYear;
        
        // Definitely under 18 based on year alone
        if (roughAge < 18) {
          return res.status(400).json({ 
            message: "JoyJoin 仅面向 18 岁及以上用户开放",
            field: "birthYear" 
          });
        }
        
        // Borderline case: could be 17 or 18 depending on month/day
        // Require full birthdate for precise validation
        if (roughAge === 18) {
          return res.status(400).json({
            message: "为了确保您已满 18 周岁，请填写完整出生日期（年-月-日）",
            field: "birthdate",
          });
        }
      }

      // ❌ REMOVED: Interest fields validation - these fields no longer exist
      // Legacy interests are now managed by user_interests table
      // if (profileData.interestsTop || profileData.primaryInterests || profileData.topicAvoidances) {
      //   const normalized = normalizeProfileInterests({
      //     interestsTop: profileData.interestsTop ?? undefined,
      //     primaryInterests: profileData.primaryInterests ?? undefined,
      //     topicAvoidances: profileData.topicAvoidances ?? undefined,
      //   });
      //   // Log warnings for observability
      //   if (normalized.warnings.length > 0) {
      //     console.log(`[Profile] Interest normalization warnings for user ${userId}:`, normalized.warnings);
      //   }
      //   profileData.interestsTop = normalized.interestsTop.length > 0 ? normalized.interestsTop : undefined;
      //   profileData.primaryInterests = normalized.primaryInterests.length > 0 ? normalized.primaryInterests : undefined;
      //   profileData.topicAvoidances = normalized.topicAvoidances.length > 0 ? normalized.topicAvoidances : undefined;
      // }

      // Validate telemetry if present
      if (profileData.interestsTelemetry) {
        const telemetryResult = validateTelemetry(profileData.interestsTelemetry);
        if (!telemetryResult.valid) {
          console.log(`[Profile] Invalid telemetry for user ${userId}:`, telemetryResult.errors);
          // Log and truncate oversized/invalid telemetry rather than reject
          profileData.interestsTelemetry = telemetryResult.data ?? undefined;
        } else {
          profileData.interestsTelemetry = telemetryResult.data;
        }
      }

      if (profileData.industryConfidence !== undefined) {
        profileData.industryConfidence = String(profileData.industryConfidence);
      }

      const user = await storage.updateFullProfile(userId, profileData);
      
      // Set hasCompletedRegistration if profile is being set with essential data
      if (user && (req.body.displayName || req.body.gender || req.body.currentCity)) {
        const updatedUser = await storage.updateUser(user.id, { hasCompletedRegistration: true });
        queueSemanticProfileRecompute(userId, 'full_profile_update');
        res.json(updatedUser);
      } else {
        queueSemanticProfileRecompute(userId, 'full_profile_update');
        res.json(user);
      }
    } catch (error) {
      console.error("Error updating full profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Social tag endpoints
  app.post('/api/user/social-tags/generate', isPhoneAuthenticated, aiEndpointLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { archetype, profession, hobbies, forceRegenerate } = req.body;

      // Input validation
      if (!archetype || typeof archetype !== 'string') {
        return res.status(400).json({ error: 'Valid archetype is required' });
      }

      // Validate profession structure if provided
      if (profession !== undefined && profession !== null) {
        if (typeof profession !== 'object' || Array.isArray(profession)) {
          return res.status(400).json({ error: 'Profession must be an object' });
        }
      }

      // Validate hobbies structure if provided
      if (hobbies !== undefined && hobbies !== null) {
        if (!Array.isArray(hobbies)) {
          return res.status(400).json({ error: 'Hobbies must be an array' });
        }
        // Validate each hobby has name and heat
        const invalidHobby = hobbies.find((h: any) => 
          !h || typeof h !== 'object' || typeof h.name !== 'string' || typeof h.heat !== 'number'
        );
        if (invalidHobby) {
          return res.status(400).json({ error: 'Each hobby must have name (string) and heat (number)' });
        }
      }

      // Check if tags were generated within last 24 hours (return cached unless forceRegenerate)
      if (!forceRegenerate) {
        const existingTags = await storage.getUserGeneratedTags(userId);
        if (existingTags && existingTags.generatedAt) {
          const hoursSinceGeneration = (Date.now() - new Date(existingTags.generatedAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceGeneration < 24 && existingTags.tags) {
            return res.json({
              tags: existingTags.tags,
              isFallback: false,
              cached: true,
            });
          }
        }
      }

      // Generate new tags
      const { generateSocialTags } = await import('./tagGenerationService');
      const result = await generateSocialTags({ archetype, profession, hobbies });

      // Save to database
      await storage.saveGeneratedTags(userId, {
        tags: result.tags,
        generatedAt: new Date(),
        version: 'v1.0',
        context: { archetype, profession, hobbies },
      });

      res.json({
        tags: result.tags,
        isFallback: result.isFallback,
      });
    } catch (error) {
      console.error('Error generating social tags:', error);
      res.status(500).json({ message: 'Failed to generate social tags' });
    }
  });

  app.post('/api/user/social-tags/select', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { tagIndex, fullTag } = req.body;

      if (tagIndex === undefined || !fullTag) {
        return res.status(400).json({ error: 'Tag index and full tag are required' });
      }

      await storage.recordTagSelection(userId, {
        selectedIndex: tagIndex,
        selectedTag: fullTag,
        selectedAt: new Date(),
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error selecting social tag:', error);
      res.status(500).json({ message: 'Failed to select social tag' });
    }
  });

  // Event routes
  app.get('/api/events/joined', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const events = await storage.getUserJoinedEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching joined events:", error);
      res.status(500).json({ message: "Failed to fetch joined events" });
    }
  });

  app.get('/api/events/:eventId/participants', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const participants = await storage.getEventParticipants(eventId);
      res.json(participants);
    } catch (error) {
      console.error("Error fetching event participants:", error);
      res.status(500).json({ message: "Failed to fetch event participants" });
    }
  });

  // Chat routes (group chat opens 24 hours before event)
  app.get('/api/events/:eventId/messages', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      
      // Try to get event from events table first (for demo/regular events)
      const [event] = await db.select().from(events).where(eq(events.id, eventId));
      
      // If not found in events table, try blindBoxEvents table
      let eventDateTime = event?.dateTime;
      if (!event) {
        const blindBoxEvent = await storage.getBlindBoxEventById(eventId, userId);
        if (!blindBoxEvent) {
          return res.status(404).json({ message: "Event not found" });
        }
        eventDateTime = blindBoxEvent.dateTime;
      }

      // Check if group chat is open (24 hours before event OR event has passed)
      const now = new Date();
      const eventTime = new Date(eventDateTime);
      const hoursUntilEvent = (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      // Chat unlocks 24 hours before event, and remains accessible after event completes
      const chatUnlocked = hoursUntilEvent <= 24;

      if (!chatUnlocked) {
        return res.json({
          chatUnlocked: false,
          hoursUntilUnlock: Math.max(0, hoursUntilEvent - 24),
          messages: [],
        });
      }

      const messages = await storage.getEventMessages(eventId);
      res.json({
        chatUnlocked: true,
        hoursUntilUnlock: 0,
        messages: messages.map(toEventChatMessageSummary),
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/events/:eventId/messages', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;

        logger.warn('Blocked event chat write because the feature is under compliance freeze', {
          route: '/api/events/:eventId/messages',
          eventId,
          userId,
        });

        return res.status(503).json({
          message: '活动群聊暂不可用',
          featureUnavailable: true,
        });
    } catch (error) {
        console.error("Error blocking message creation:", error);
        res.status(500).json({ message: "Failed to apply event chat freeze" });
    }
  });

  // Feedback routes
  app.get('/api/my-feedbacks', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const feedbacks = await storage.getUserAllFeedbacks(userId);
      res.json(feedbacks);
    } catch (error) {
      console.error("Error fetching all feedbacks:", error);
      res.status(500).json({ message: "Failed to fetch feedbacks" });
    }
  });

  // ── Connections endpoints ──────────────────────────────────────────────────

  /**
   * GET /api/my-connections
   * Returns the authenticated user's mutual connections, enriched with peer
   * display name, archetype, wechat id, and any saved connection feedback.
   */
  app.get('/api/my-connections', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;

      type ConnRow = {
        id: string;
        eventId: string;
        userAId: string;
        userBId: string;
        userAWechatId: string | null;
        userBWechatId: string | null;
        createdAt: Date | null;
        userAConnectionReasons: string[] | null;
        userANextStepPreference: string | null;
        userBConnectionReasons: string[] | null;
        userBNextStepPreference: string | null;
      };

      const rows: ConnRow[] = await db
        .select({
          id: connections.id,
          eventId: connections.eventId,
          userAId: connections.userAId,
          userBId: connections.userBId,
          userAWechatId: connections.userAWechatId,
          userBWechatId: connections.userBWechatId,
          createdAt: connections.createdAt,
          userAConnectionReasons: connections.userAConnectionReasons,
          userANextStepPreference: connections.userANextStepPreference,
          userBConnectionReasons: connections.userBConnectionReasons,
          userBNextStepPreference: connections.userBNextStepPreference,
        })
        .from(connections)
        .where(and(
          or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
          eq(connections.status, 'mutual'),
        ))
        .orderBy(desc(connections.createdAt))
        .limit(50);

      // Collect peer user ids to fetch display info
      const peerIds: string[] = rows.map((r) => r.userAId === userId ? r.userBId : r.userAId);
      const uniquePeerIds: string[] = Array.from(new Set(peerIds));

      const peerRows = uniquePeerIds.length > 0
        ? await db
            .select({ id: users.id, displayName: users.displayName, archetype: users.archetype })
            .from(users)
            .where(inArray(users.id, uniquePeerIds))
        : ([] as { id: string; displayName: string | null; archetype: string | null }[]);

      const peerMap: Record<string, { id: string; displayName: string | null; archetype: string | null }> = {};
      for (const u of peerRows) peerMap[u.id] = u;

      // Collect event names
      const eventIds: string[] = Array.from(new Set(rows.map((r) => r.eventId)));
      const eventRows = eventIds.length > 0
        ? await db
            .select({ id: blindBoxEvents.id, eventType: blindBoxEvents.eventType, dateTime: blindBoxEvents.dateTime })
            .from(blindBoxEvents)
            .where(inArray(blindBoxEvents.id, eventIds))
        : ([] as { id: string; eventType: string | null; dateTime: Date | null }[]);
      const eventMap: Record<string, { id: string; eventType: string | null; dateTime: Date | null }> = {};
      for (const e of eventRows) eventMap[e.id] = e;

      const result = rows.map((r) => {
        const isA = r.userAId === userId;
        const peerId = isA ? r.userBId : r.userAId;
        const peer = peerMap[peerId];
        const evt = eventMap[r.eventId];
        return {
          id: r.id,
          eventId: r.eventId,
          // Return raw fields so the client can format using HK timezone helpers
          eventType: evt?.eventType ?? null,
          eventDate: evt?.dateTime ? evt.dateTime.toISOString() : null,
          peerId,
          peerDisplayName: peer?.displayName ?? '连接用户',
          peerArchetype: peer?.archetype ?? null,
          peerWechatId: isA ? r.userBWechatId : r.userAWechatId,
          connectionReasons: isA ? r.userAConnectionReasons : r.userBConnectionReasons,
          nextStepPreference: isA ? r.userANextStepPreference : r.userBNextStepPreference,
          createdAt: r.createdAt,
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching my connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  /**
   * PATCH /api/connections/:connectionId/feedback
   * Saves optional enrichment data (reasons + next-step) for a connection.
   * Only the two parties in the connection can update their own feedback slot.
   */
  app.patch('/api/connections/:connectionId/feedback', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { connectionId } = req.params;
      const { connectionReasons, nextStepPreference } = req.body;

      const [conn] = await db
        .select()
        .from(connections)
        .where(eq(connections.id, connectionId))
        .limit(1);

      if (!conn) {
        return res.status(404).json({ message: "Connection not found" });
      }

      if (conn.userAId !== userId && conn.userBId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (conn.status !== 'mutual') {
        return res.status(400).json({ message: "Connection is not mutual" });
      }

      // Validate reasons (array of strings, max 4 to allow 3 canonical chips + 1 free-text element)
      const reasonsInput: unknown = connectionReasons;
      let reasons: string[] | null = null;
      if (Array.isArray(reasonsInput)) {
        reasons = reasonsInput.slice(0, 4).map(String);
      } else if (reasonsInput === null || reasonsInput === undefined) {
        reasons = null;
      } else {
        return res.status(400).json({ message: "connectionReasons must be an array" });
      }

      // Validate nextStepPreference
      const nextStep = (typeof nextStepPreference === 'string' && nextStepPreference.trim())
        ? nextStepPreference.trim()
        : null;

      const isA = conn.userAId === userId;
      await db
        .update(connections)
        .set(
          isA
            ? { userAConnectionReasons: reasons, userANextStepPreference: nextStep }
            : { userBConnectionReasons: reasons, userBNextStepPreference: nextStep }
        )
        .where(eq(connections.id, connectionId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating connection feedback:", error);
      res.status(500).json({ message: "Failed to update connection feedback" });
    }
  });

  app.get('/api/events/:eventId/feedback', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const feedback = await storage.getUserFeedback(userId, eventId);
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.post('/api/events/:eventId/feedback', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const result = insertEventFeedbackSchema.safeParse({
        ...req.body,
        eventId,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Save wechatContactId if provided and not previously set
      const { wechatContactId } = req.body;
      if (wechatContactId && typeof wechatContactId === 'string' && wechatContactId.trim()) {
        const currentUser = await storage.getUser(userId);
        if (!currentUser?.wechatContactId) {
          await storage.updateUserWechatId(userId, wechatContactId.trim());
        }
      }

      // Create feedback
      const feedback = await storage.createEventFeedback(userId, result.data);
      
      // Award XP and coins for completing feedback
      try {
        const { awardXPAndCoins } = await import('./gamificationService');
        const xpResult = await awardXPAndCoins(userId, 'feedback_basic', eventId, feedback.id);
        console.log(`[Gamification] Awarded basic feedback XP to user ${userId}:`, xpResult);
      } catch (xpError) {
        console.error("Error awarding feedback XP:", xpError);
      }
      
      // Process connection selections and detect mutual matches
      if (feedback.connections && feedback.connections.length > 0) {
        for (const selectedUserId of feedback.connections) {
          // Guard: skip self-selection
          if (selectedUserId === userId) {
            console.warn(`[Connections] User ${userId} attempted self-selection — skipped`);
            continue;
          }
          try {
            await storage.upsertConnection(eventId, userId, selectedUserId);
          } catch (connError) {
            console.error(`[Connections] Error upserting connection for ${userId} → ${selectedUserId}:`, connError);
          }
        }
      }

      // After the connections loop, notify the other side of any newly mutual connections
      const MUTUAL_MATCH_NOTIFICATION_WINDOW_MS = 60_000; // 60 seconds
      try {
        const freshMutualRows = await storage.getMutualConnections(eventId, userId);
        for (const conn of freshMutualRows) {
          const otherUserId = conn.userAId === userId ? conn.userBId : conn.userAId;
          // Only notify if this mutual was just created (revealedAt within last 60 seconds)
          const isNew = conn.revealedAt && (Date.now() - new Date(conn.revealedAt).getTime()) < MUTUAL_MATCH_NOTIFICATION_WINDOW_MS;
          if (isNew && otherUserId !== userId) {
            try {
              // Deduplicate: only create notification if one doesn't already exist for this user+event
              const existing = await db
                .select({ id: schema.notifications.id })
                .from(schema.notifications)
                .where(
                  and(
                    eq(schema.notifications.userId, otherUserId),
                    eq(schema.notifications.type, 'mutual_match'),
                    eq(schema.notifications.relatedResourceId, eventId)
                  )
                )
                .limit(1);
              if (existing.length === 0) {
                await storage.createNotification({
                  userId: otherUserId,
                  category: 'chat',
                  type: 'mutual_match',
                  title: '🎉 新的双向匹配',
                  message: `你和一位参与者互相选择了对方！查看Ta的微信号吧`,
                  relatedResourceId: eventId,
                });
              }
            } catch (notifError) {
              console.error(`[Connections] Failed to notify other user ${otherUserId}:`, notifError);
            }
          }
        }
      } catch (notifLoopError) {
        console.error(`[Connections] Failed to process mutual match notifications:`, notifLoopError);
      }

      // Collect all mutual connections for this event and return with wechat IDs.
      // Use the snapshot stored on the connection row at reveal time; fall back to live user
      // field only for legacy rows that pre-date snapshotting.
      const mutualConnectionRows = await storage.getMutualConnections(eventId, userId);
      const mutualMatches = await Promise.all(
        mutualConnectionRows.map(async (conn: any) => {
          const otherUserId = conn.userAId === userId ? conn.userBId : conn.userAId;
          // Snapshot WeChat ID for THIS user's counterpart
          const snapshotWechatId =
            conn.userAId === userId ? conn.userBWechatId : conn.userAWechatId;
          const otherUser = await storage.getUser(otherUserId);
          return {
            userId: otherUserId,
            displayName: otherUser?.displayName || otherUser?.firstName || "参与者",
            archetype: otherUser?.archetype ?? null,
            // Prefer snapshot; fall back to live field for legacy rows
            wechatContactId: snapshotWechatId ?? otherUser?.wechatContactId ?? null,
          };
        })
      );

      // Note: In a real app, you'd update user points here
      // await storage.awardFeedbackPoints(userId, 50);

      const responsePayload = { ...feedback, mutualMatches };
      const shadowRecommendationInput = {
        source: 'event_feedback',
        eventId,
        feedbackId: feedback.id,
        userId,
        wouldMeetAgain:
          feedback.hasNewConnections ??
          (Array.isArray(feedback.connections) ? feedback.connections.length > 0 : mutualMatches.length > 0),
        wouldAttendAgain: feedback.wouldAttendAgain ?? null,
        hasNewConnections: feedback.hasNewConnections ?? (mutualMatches.length > 0 ? true : null),
        atmosphereScore: feedback.atmosphereScore ?? feedback.rating ?? null,
        connectionStatus: feedback.connectionStatus ?? null,
        connectionCount: Array.isArray(feedback.connections) ? feedback.connections.length : null,
        mutualConnectionCount: mutualMatches.length,
        conversationComfort: feedback.conversationComfort ?? null,
        connectionRadar:
          feedback.connectionRadar && typeof feedback.connectionRadar === 'object'
            ? feedback.connectionRadar
            : null,
      };

      res.json(responsePayload);

      setImmediate(() => {
        void import('./matchingWeightsService')
          .then(({ matchingWeightsService }) => matchingWeightsService.recordShadowRecommendation(shadowRecommendationInput))
          .catch((shadowError) => {
            logger.error('Failed to record shadow recommendation from event_feedback', {
              eventId,
              feedbackId: feedback.id,
              userId,
              error: String(shadowError),
            });
          });
      });
    } catch (error) {
      console.error("Error creating feedback:", error);
      res.status(500).json({ message: "Failed to create feedback" });
    }
  });

  // Deep feedback route (optional extension)
  app.post('/api/events/:eventId/feedback/deep', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      
      // Get existing feedback
      const existingFeedback = await storage.getUserFeedback(userId, eventId);
      
      if (!existingFeedback) {
        return res.status(404).json({ message: "Basic feedback not found. Please complete basic feedback first." });
      }

      // Update with deep feedback data
      const deepFeedbackData = {
        hasDeepFeedback: true,
        matchPointValidation: req.body.matchPointValidation,
        additionalMatchPoints: req.body.additionalMatchPoints,
        conversationBalance: req.body.conversationBalance,
        conversationComfort: req.body.conversationComfort,
        conversationNotes: req.body.conversationNotes,
        futurePreferences: req.body.futurePreferences,
        futurePreferencesOther: req.body.futurePreferencesOther,
        deepFeedbackCompletedAt: new Date(),
      };

      const updatedFeedback = await storage.updateEventFeedbackDeep(userId, eventId, deepFeedbackData);
      
      // Award XP and coins for completing deep feedback
      try {
        const { awardXPAndCoins } = await import('./gamificationService');
        const xpResult = await awardXPAndCoins(userId, 'feedback_deep', eventId, updatedFeedback.id);
        console.log(`[Gamification] Awarded deep feedback XP to user ${userId}:`, xpResult);
      } catch (xpError) {
        console.error("Error awarding deep feedback XP:", xpError);
      }
      
      res.json(updatedFeedback);
    } catch (error) {
      console.error("Error updating deep feedback:", error);
      res.status(500).json({ message: "Failed to update deep feedback" });
    }
  });

  // 🎯 DEMO: Seed demonstration events

  // 🎯 DEMO: Seed registrations into a pool for quick matching tests

  // 🎄 DEMO: Create a Christmas Mystery Cocktail Pool for testing

  // 🍸 DEMO: Create "弥所 Homebar" partner venue with exclusive deal

  // Debug middleware for blind box event routes
  app.use('/api/blind-box-events', (req, _res, next) => {
    console.log("[BlindBoxDebug] incoming request on /api/blind-box-events", {
      method: req.method,
      originalUrl: req.originalUrl,
      params: req.params,
      query: req.query,
      body: req.body,
    });
    next();
  });
  // Blind Box Event routes
  app.get('/api/my-events', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const events = await storage.getUserBlindBoxEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching blind box events:", error);
      res.status(500).json({ message: "Failed to fetch blind box events" });
    }
  });


  // ============ ATTENDANCE STATUS ROUTES ============

  function getUserDisplayName(user: any): string {
    return user?.displayName || user?.display_name || user?.firstName || 'Unknown';
  }

  function isParticipantOfBlindBoxEvent(event: any, userId: string): boolean {
    if (event.userId === userId) return true;
    const matchedAttendees = Array.isArray(event.matchedAttendees) ? event.matchedAttendees : [];
    return matchedAttendees.some((a: any) => a.userId === userId);
  }

  // User: get my attendance status for an event

  // User: update my attendance status for an event

  // User/TableMates: get attendance summary for an event (all attendees' statuses)

  // Admin: get attendance summary for an event
  app.get('/api/admin/events/:eventId/attendance-summary', requireAdmin, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const summary = await storage.getEventAttendanceSummary(eventId);
      res.json(summary);
    } catch (error) {
      console.error("[AttendanceStatus] Admin error fetching attendance summary:", error);
      res.status(500).json({ message: "Failed to fetch attendance summary" });
    }
  });

  // Admin: override attendance status for a specific user
  app.patch('/api/admin/events/:eventId/attendees/:userId/attendance-status', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      const { eventId, userId } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'confirmed', 'late', 'absent'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      await storage.adminOverrideAttendanceStatus(eventId, userId, status, adminId);

      // Broadcast the override
      const user = await storage.getUser(userId);
      const displayName = getUserDisplayName(user);
      broadcastAttendanceStatusUpdated(eventId, userId, displayName, status as any);

      res.json({ success: true });
    } catch (error) {
      console.error("[AttendanceStatus] Admin error overriding status:", error);
      res.status(500).json({ message: "Failed to override attendance status" });
    }
  });

  // ============ ADMIN BLIND BOX EVENT ROUTES ============
  // ============ ADMIN BLIND BOX EVENT ROUTES ============

  // Admin: list all blind box events (for management console)
  app.get('/api/admin/events', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      console.log("[AdminBlindBox] GET /api/admin/events by admin:", adminId);

      const events = await db
        .select()
        .from(blindBoxEvents)
        .orderBy(desc(blindBoxEvents.dateTime));

      console.log("[AdminBlindBox] Loaded blind box events count:", events.length);
      res.json(events);
    } catch (error: any) {
      console.error("[AdminBlindBox] Error fetching blind box events:", error);
      res.status(500).json({
        message: "Failed to fetch blind box events",
        error: error?.message || String(error),
      });
    }
  });

  // Admin: create a blind box event (桌) that admins manage
  app.post('/api/admin/blind-box-events', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      if (!adminId) {
        console.error("[AdminBlindBox] No adminId in session on create");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        // 桌子标题（比如「海底捞」）
        title,
        // 饭局 / 酒局
        eventType,
        // 必须绑定一个池子：这个桌子就是在这个池子里开出来的
        poolId,
        // 预算档位（前端传的 budgetTier，直接存进去）
        budgetTier,
        // 下面几个是偏好字段，前端可能用 languages / cuisines / tasteIntensity，
        // 也可能用 selectedLanguages / selectedCuisines / selectedTasteIntensity，这里统一兼容
        languages,
        cuisines,
        tasteIntensity,
        selectedLanguages,
        selectedCuisines,
        selectedTasteIntensity,
        // 预留：后面如果要做「自动匹配」可以用这个开关
        autoMatch,
      } = req.body || {};

      // 必填校验：这里刻意不要求 city/district/dateTime，因为这些都从 pool 上继承
      if (!title || !eventType || !poolId || !budgetTier) {
        console.warn("[AdminBlindBox] Missing required fields when creating blind box event");
        return res.status(400).json({
          message: "缺少必填字段：title / eventType / poolId / budgetTier",
        });
      }

      // 找到对应的活动池
      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, poolId));

      if (!pool) {
        console.warn("[AdminBlindBox] Pool not found for create:", poolId);
        return res.status(404).json({ message: "活动池不存在" });
      }

      // 参数归一化
      const toStringArray = (value: any): string[] => {
        if (Array.isArray(value)) return value.map((v) => String(v));
        if (typeof value === "string") {
          return value
            .split(/[,\s/、]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return [];
      };

      const normalizedLanguages = toStringArray(selectedLanguages ?? languages);
      const normalizedCuisines = toStringArray(selectedCuisines ?? cuisines);
      const normalizedTasteIntensity = toStringArray(selectedTasteIntensity ?? tasteIntensity);

      console.log("[AdminBlindBox] incoming create payload:", {
        adminId,
        title,
        eventType,
        poolId,
        budgetTier,
        normalizedLanguages,
        normalizedCuisines,
        normalizedTasteIntensity,
        autoMatch,
      });

      const [created] = await db
        .insert(blindBoxEvents)
        .values({
          // 用 admin 的 userId 做创建者
          userId: adminId ?? "",
          title: title ?? "",
          eventType: eventType ?? "",
          // 城市 / 区域 / 时间直接继承池子的配置
          city: pool.city,
          district: pool.district ?? "",
          dateTime: pool.dateTime,
          // 绑定池子，后面匹配会用到
          poolId: pool.id,
          // 桌子的预算档
          budgetTier: budgetTier ?? "",
          // 偏好字段
          selectedLanguages: normalizedLanguages,
          selectedTasteIntensity: normalizedTasteIntensity,
          selectedCuisines: normalizedCuisines,
          cuisineTags: normalizedCuisines,
          // 桌子初始状态：匹配中
          status: "matching",
          progress: 0,
          currentParticipants: 0,
          totalParticipants: pool.maxGroupSize ?? null,
          // 暂时把池子的 venue 复用到店名/地址上（以后有更细 schema 再拆）
          restaurantName: null,
          restaurantAddress: null,
        })
        .returning();

      console.log("[AdminBlindBox] created blindBoxEvent:", created);

      res.json(created);
    } catch (error: any) {
      console.error("[AdminBlindBox] Failed to create blind box event:", error);
      res.status(500).json({
        message: "Failed to create blind box event",
        error: error?.message || String(error),
      });
    }
  });

  // Admin: manual match trigger for blind box event
  app.post('/api/admin/events/:id/match', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      const eventId = req.params.id;

      console.log("[AdminBlindBox] manual match trigger by admin:", {
        adminId,
        eventId,
      });

      // 1. 读取桌子信息
      const [event] = await db
        .select()
        .from(blindBoxEvents)
        .where(eq(blindBoxEvents.id, eventId));

      if (!event) {
        console.warn("[AdminBlindBox] event not found for manual match:", eventId);
        return res.status(404).json({ message: "Event not found" });
      }

      if (!event.poolId) {
        console.warn("[AdminBlindBox] event has no poolId, cannot match:", eventId);
        return res.status(400).json({ message: "该盲盒活动未绑定活动池，无法匹配" });
      }

      // 2. 读取池子配置
      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, event.poolId));

      if (!pool) {
        console.warn("[AdminBlindBox] pool not found for event:", {
          eventId,
          poolId: event.poolId,
        });
        return res.status(404).json({ message: "活动池不存在" });
      }

      const minSize = pool.minGroupSize ?? 4;
      const maxSize = pool.maxGroupSize ?? 6;

      // 3. 取出池子里所有「待匹配」的用户
      const pendingRegistrations = await db
        .select()
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, pool.id),
            eq(eventPoolRegistrations.matchStatus, "pending")
          )
        )
        .orderBy(eventPoolRegistrations.registeredAt);

      console.log("[AdminBlindBox] pending registrations count:", pendingRegistrations.length);

      if (pendingRegistrations.length < minSize) {
        return res.status(400).json({
          message: `当前池子报名人数不足（${pendingRegistrations.length}/${minSize}），暂时无法成局`,
        });
      }

      // 简单版本：按报名先后顺序取一桌
      const groupSize = Math.min(maxSize, pendingRegistrations.length);
      const selected = pendingRegistrations.slice(0, groupSize);

      const selectedIds = (selected as any[]).map((r: any) => r.id);

      // 4. 更新报名记录为 matched，并标记桌子 id
      await db
        .update(eventPoolRegistrations)
        .set({
          matchStatus: "matched",
          assignedGroupId: event.id,
        })
        .where(inArray(eventPoolRegistrations.id, selectedIds));

      // 5. 更新桌子状态
      const [updatedEvent] = await db
        .update(blindBoxEvents)
        .set({
          status: "matched",
          progress: 100,
          currentParticipants: groupSize,
          totalParticipants: groupSize,
        })
        .where(eq(blindBoxEvents.id, event.id))
        .returning();

      console.log("[AdminBlindBox] manual match finished:", {
        eventId: event.id,
        poolId: pool.id,
        groupSize,
      });

      return res.json({
        ok: true,
        event: updatedEvent,
        poolId: pool.id,
        groupSize,
        registrationIds: selectedIds,
      });
    } catch (error: any) {
      console.error("[AdminBlindBox] Error in manual match:", error);
      res.status(500).json({
        message: "Failed to run manual match",
        error: error?.message || String(error),
      });
    }
  });
  // // Admin: list all blind box events (for management console)


// =============================================end of blind box event routes============================
// ======================================================================================================












  // Demo endpoint to set match data for testing

  // Icebreaker routes - Multi-layered questions for deeper connection
  const icebreakerQuestions = {
    // Layer 1: Simple & Lighthearted - Easy entry points
    lighthearted: [
      "今天什么事让你微笑了？",
      "本周最好的消息是什么？",
      "最近吃过最奇怪的一道菜是什么？",
      "如果可以从日常生活中去掉一件事，你会选什么？为什么？",
      "如果能立刻学会一项技能，你想学什么？",
      "周末最喜欢做的一件小事是什么？",
      "最近什么事让你觉得很治愈？",
      "你的「快乐按钮」是什么？做什么事能让你立刻开心起来？",
    ],
    
    // Layer 2: Passions & Hobbies - Discovering interests
    passions: [
      "你对什么充满热情？为什么？",
      "有什么爱好或活动是你真正享受的？它吸引你的地方是什么？",
      "最近沉迷的一项运动或爱好是什么？",
      "有什么一直想尝试但还没开始的事情？",
      "如果有一整天自由时间，你会怎么度过？",
      "你会推荐别人尝试什么爱好或体验？",
      "什么事情会让你完全忘记时间？",
    ],
    
    // Layer 3: Travel & Adventures - Shared experiences
    travel: [
      "最难忘的一次旅行经历是什么？",
      "如果可以立刻去任何地方旅行，你会去哪里？",
      "旅行中遇到过什么意外的惊喜？",
      "你更喜欢计划好的行程，还是随性探索？",
      "有什么地方去了之后改变了你的想法？",
      "推荐一个你觉得被低估的旅行目的地",
      "下一个最想去的地方是哪里？为什么？",
    ],
    
    // Layer 4: Art & Creativity - Cultural connections
    creativity: [
      "最近有什么艺术作品或表演让你印象深刻？",
      "你会用什么方式表达创意？（音乐、绘画、写作等）",
      "有没有特别喜欢的艺术家或创作者？",
      "如果可以掌握一门艺术，你会选什么？",
      "最近在读什么书或在看什么剧？",
      "有什么电影或音乐改变了你的看法？",
      "你觉得什么样的创作最能打动人心？",
    ],
    
    // Layer 5: Innovation & Technology - Future thinking
    innovation: [
      "你觉得什么技术会改变我们的未来？",
      "有什么新科技产品让你觉得很酷？",
      "如果能发明一样东西解决生活中的问题，你会发明什么？",
      "你对AI有什么看法？它会如何影响我们的生活？",
      "最让你期待的未来趋势是什么？",
      "科技让生活更好了，还是更复杂了？",
    ],
    
    // Layer 6: Deeper Personal - Building trust
    personal: [
      "今晚你对这次聚会有什么期待？",
      "猜猜看，大家都是做什么工作的？",
      "如果明年要实现一个重要目标，会是什么？为什么？",
      "有什么经历塑造了现在的你？",
      "如果要教一门课，你会教什么？",
      "你觉得自己在哪方面成长了很多？",
      "最近学到的最重要的一课是什么？",
      "如果可以给5年前的自己一个建议，会说什么？",
    ],
    
    // Layer 7: Values & Beliefs - Deep connection
    values: [
      "有什么信念或价值观对你很重要？它如何影响你的选择？",
      "你觉得人类的发展方向是在进步还是倒退？为什么？",
      "什么样的事情会让你觉得很有意义？",
      "你觉得什么品质在人身上最可贵？",
      "有什么原则是你一直坚持的？",
      "你希望为这个世界留下什么？",
      "对你来说，成功意味着什么？",
    ],
    
    // Context-specific: Dining & Local
    dining: [
      "今天最想点的一道菜是什么？",
      "有什么特别的饮食偏好或禁忌吗？",
      "分享一个你难忘的用餐体验",
      "最近发现的好吃的店铺",
      "如果只能选一种菜系吃一辈子，会选什么？",
    ],
    
    city_life: [
      "在这座城市最爱的一个小店是哪里？",
      "推荐一个你觉得被低估的城市角落",
      "你最喜欢这个城市的哪个季节？",
      "如果要带朋友游览，会带去哪里？",
      "这个城市让你最惊喜的发现是什么？",
    ],
  };

  // Category labels for UI display
  const categoryLabels: Record<string, { name: string, color: string }> = {
    lighthearted: { name: "轻松愉快", color: "green" },
    passions: { name: "兴趣爱好", color: "blue" },
    travel: { name: "旅行探险", color: "purple" },
    creativity: { name: "艺术创意", color: "pink" },
    innovation: { name: "创新科技", color: "cyan" },
    personal: { name: "个人成长", color: "orange" },
    values: { name: "共同价值观", color: "red" },
    dining: { name: "美食话题", color: "yellow" },
    city_life: { name: "城市生活", color: "teal" },
  };

  app.get('/api/icebreakers/random', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { topic } = req.query;
      let selectedCategory: string;
      let questions: string[];
      
      if (topic && topic in icebreakerQuestions) {
        selectedCategory = topic;
        questions = icebreakerQuestions[topic as keyof typeof icebreakerQuestions];
      } else {
        // General: randomly select a category
        const categories = Object.keys(icebreakerQuestions);
        selectedCategory = categories[Math.floor(Math.random() * categories.length)];
        questions = icebreakerQuestions[selectedCategory as keyof typeof icebreakerQuestions];
      }
      
      const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
      const categoryInfo = categoryLabels[selectedCategory] || { name: "破冰问题", color: "gray" };
      
      res.json({ 
        question: randomQuestion,
        category: categoryInfo.name,
        categoryColor: categoryInfo.color
      });
    } catch (error) {
      console.error("Error fetching icebreaker:", error);
      res.status(500).json({ message: "Failed to fetch icebreaker question" });
    }
  });

  // AI-powered topic recommendations for icebreaker toolkit
  app.post('/api/icebreaker/ai-topics', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { participants, atmosphereType = 'balanced', count = 5 } = req.body;
      
      if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ message: "participants array is required" });
      }
      
      const { getAIRecommendedTopics, getQuickRecommendedTopics, getAllTopicsForToolkit } = await import('./topicRecommendationService');
      
      // Get AI recommendations with personalized reasons
      const recommendedTopics = await getAIRecommendedTopics(participants, atmosphereType, count);
      
      // Get all available topics for the full toolkit
      const archetypes = participants.map((p: any) => p.archetype).filter(Boolean);
      const allTopics = getAllTopicsForToolkit(archetypes, atmosphereType);
      
      res.json({
        recommendedTopics,
        allTopics,
      });
    } catch (error) {
      console.error("Error fetching AI topic recommendations:", error);
      res.status(500).json({ message: "Failed to fetch AI topic recommendations" });
    }
  });

  // Quick (non-AI) topic recommendations for faster loading
  app.post('/api/icebreaker/quick-topics', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { archetypes = [], atmosphereType = 'balanced', count = 5 } = req.body;
      
      const { getQuickRecommendedTopics, getAllTopicsForToolkit } = await import('./topicRecommendationService');
      
      // Get quick local recommendations (no AI call)
      const recommendedTopics = getQuickRecommendedTopics(archetypes, atmosphereType, count);
      
      // Get all available topics
      const allTopics = getAllTopicsForToolkit(archetypes, atmosphereType);
      
      res.json({
        recommendedTopics,
        allTopics,
      });
    } catch (error) {
      console.error("Error fetching quick topic recommendations:", error);
      res.status(500).json({ message: "Failed to fetch quick topic recommendations" });
    }
  });

  // AI-powered welcome message for icebreaker session
  app.post('/api/icebreaker/welcome-message', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { participants, eventTitle } = req.body;
      
      if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ message: "participants array is required" });
      }
      
      const { generateWelcomeMessage, generateQuickWelcome } = await import('./icebreakerAIService');
      
      // Try AI generation, fallback to quick generation
      let message: string;
      try {
        message = await generateWelcomeMessage(participants, eventTitle);
      } catch {
        const archetypes = participants.map((p: any) => p.archetype).filter(Boolean);
        message = await generateQuickWelcome(participants.length, archetypes);
      }
      
      res.json({ message });
    } catch (error) {
      console.error("Error generating welcome message:", error);
      res.status(500).json({ message: "Failed to generate welcome message" });
    }
  });

  // AI-powered closing message for icebreaker session
  app.post('/api/icebreaker/closing-message', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { participants, durationMinutes, topicsDiscussed, gamesPlayed } = req.body;
      
      if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ message: "participants array is required" });
      }
      
      const { generateClosingMessage } = await import('./icebreakerAIService');
      
      const message = await generateClosingMessage(
        participants,
        durationMinutes || 0,
        topicsDiscussed,
        gamesPlayed
      );
      
      res.json({ message });
    } catch (error) {
      console.error("Error generating closing message:", error);
      res.status(500).json({ message: "Failed to generate closing message" });
    }
  });

  // ============ In-Event Icebreaker Card Game Endpoints ============
  
  // Helper function to verify user is authorized to access session
  async function verifySessionAccess(sessionId: string, userId: string, db: any, schema: any): Promise<boolean> {
    const { icebreakerSessions, eventPoolRegistrations, eventPoolGroups } = schema;
    const { eq, and } = await import('drizzle-orm');
    
    // Get session
    const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.id, sessionId)).limit(1);
    if (!session) return false;
    
    // Check if user is in the event/group
    if (session.groupId) {
      // Check pool group membership
      const registration = await db.select()
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.userId, userId),
            eq(eventPoolRegistrations.assignedGroupId, session.groupId)
          )
        )
        .limit(1);
      return registration.length > 0;
    } else if (session.blindBoxEventId) {
      // Check blind box event attendance
      const event = await storage.getBlindBoxEventById(session.blindBoxEventId, userId);
      if (!event) return false;
      const matchedAttendees = (Array.isArray(event.matchedAttendees) ? event.matchedAttendees : []) as Array<{ userId?: string }>;
      return matchedAttendees.some((a: any) => a.userId === userId);
    }
    
    return false;
  }
  
  // Generate cards for current round
  
  // Get cards for a session
  
  // Record card interaction
  
  // Get game progress

  // Notification endpoints
  app.get('/api/notifications/counts', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const counts = await storage.getNotificationCounts(userId);
      res.json(counts);
    } catch (error) {
      console.error("Error fetching notification counts:", error);
      res.status(500).json({ message: "Failed to fetch notification counts" });
    }
  });

  app.post('/api/notifications/mark-read', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { category } = req.body;
      if (!category || !['discover', 'activities', 'chat'].includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }

      await storage.markNotificationsAsRead(userId, category);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // ============ INVITATION SYSTEM ROUTES ============

  // Helper function to generate unique invitation code
  function generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  // POST /api/events/:id/create-invitation - Generate invitation link
  app.post('/api/events/:id/create-invitation', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const eventId = req.params.id;

      // Verify user owns this event
      const event = await storage.getBlindBoxEventById(eventId, userId);
      if (!event) {
        return res.status(404).json({ message: "Event not found or access denied" });
      }

      // Check if invitation already exists for this user and event
      const existingInvite = await db.query.invitations.findFirst({
        where: (invites: any, { and, eq }: any) => and(
          eq(invites.inviterId, userId),
          eq(invites.eventId, eventId)
        )
      });

      if (existingInvite) {
        return res.json({
          code: existingInvite.code,
          inviteLink: `${req.protocol}://${req.get('host')}/invite/${existingInvite.code}`
        });
      }

      // Generate unique code
      let code = generateInviteCode();
      let attempts = 0;
      while (attempts < 5) {
        const existing = await db.query.invitations.findFirst({
          where: (invites: any, { eq }: any) => eq(invites.code, code)
        });
        if (!existing) break;
        code = generateInviteCode();
        attempts++;
      }

      // Create invitation record
      const [invitation] = await db.insert(invitations).values({
        code,
        inviterId: userId,
        eventId,
        invitationType: event.status === 'matched' ? 'post_match' : 'pre_match',
        expiresAt: event.dateTime, // Expires when event starts
      }).returning();

      res.json({
        code: invitation.code,
        inviteLink: `${req.protocol}://${req.get('host')}/invite/${invitation.code}`
      });
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  // ============ User Referral System API ============

  // GET /api/referrals/stats - Get user's referral code and stats
  app.get('/api/referrals/stats', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if user already has a referral code
      let [existingCode] = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.userId, userId))
        .limit(1);

      // If no code exists, create one
      if (!existingCode) {
        // Generate unique 6-char code
        const generateCode = () => {
          const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // No confusing chars
          let code = '';
          for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
          }
          return code;
        };

        let code = generateCode();
        let attempts = 0;
        while (attempts < 5) {
          const [existing] = await db
            .select({ id: referralCodes.id })
            .from(referralCodes)
            .where(eq(referralCodes.code, code))
            .limit(1);
          if (!existing) break;
          code = generateCode();
          attempts++;
        }

        [existingCode] = await db.insert(referralCodes).values({
          userId,
          code,
        }).returning();
      }

      // Count conversions for this user
      const conversions = await db
        .select({ id: referralConversions.id })
        .from(referralConversions)
        .where(eq(referralConversions.referralCodeId, existingCode.id));

      const successfulInvites = conversions.length;

      // Platform-wide stats (for social proof) - count all conversions
      const allConversions = await db
        .select({ id: referralConversions.id })
        .from(referralConversions);

      const platformTotal = allConversions.length;

      res.json({
        referralCode: existingCode.code,
        successfulInvites,
        platformTotal,
        inviteLink: `${req.protocol}://${req.get('host')}/invite/${existingCode.code}`,
      });
    } catch (error: any) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // GET /api/referrals/check/:code - Check if a code is a referral code (public)
  app.get('/api/referrals/check/:code', async (req, res) => {
    try {
      const { code } = req.params;

      const [referral] = await db
        .select({ id: referralCodes.id })
        .from(referralCodes)
        .where(eq(referralCodes.code, code))
        .limit(1);

      res.json({ exists: !!referral });
    } catch (error: any) {
      console.error("Error checking referral code:", error);
      res.status(500).json({ error: "Failed to check referral code" });
    }
  });

  // GET /api/referrals/:code - Get referral info for landing page (public)
  app.get('/api/referrals/:code', async (req, res) => {
    try {
      const { code } = req.params;

      const [referral] = await db
        .select({
          id: referralCodes.id,
          code: referralCodes.code,
          userId: referralCodes.userId,
        })
        .from(referralCodes)
        .where(eq(referralCodes.code, code))
        .limit(1);

      if (!referral) {
        return res.status(404).json({ message: "Referral code not found" });
      }

      // Get inviter info
      const [inviter] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          firstName: users.firstName,
        })
        .from(users)
        .where(eq(users.id, referral.userId))
        .limit(1);

      // Increment click count
      await db.update(referralCodes)
        .set({ totalClicks: sql`${referralCodes.totalClicks} + 1` })
        .where(eq(referralCodes.id, referral.id));

      res.json({
        code: referral.code,
        inviter: {
          displayName: inviter?.displayName || inviter?.firstName || '好友',
        }
      });
    } catch (error: any) {
      console.error("Error fetching referral:", error);
      res.status(500).json({ message: "Failed to fetch referral" });
    }
  });

  // GET /api/invitations/:code - Get invitation details (public, for landing page)
  app.get('/api/invitations/:code', async (req, res) => {
    try {
      const { code } = req.params;

      const [invitation] = await db
        .select({
          id: invitations.id,
          code: invitations.code,
          inviterId: invitations.inviterId,
          eventId: invitations.eventId,
          invitationType: invitations.invitationType,
          totalClicks: invitations.totalClicks,
          expiresAt: invitations.expiresAt,
          createdAt: invitations.createdAt,
        })
        .from(invitations)
        .where(eq(invitations.code, code))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }

      // Check if expired
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(410).json({ message: "Invitation has expired" });
      }

      // Fetch inviter info
      const [inviter] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, invitation.inviterId))
        .limit(1);

      // Fetch event info (use inviter's userId for access)
      const event = await storage.getBlindBoxEventById(invitation.eventId, invitation.inviterId);

      // Increment click count
      await db.update(invitations)
        .set({ totalClicks: (invitation.totalClicks ?? 0) + 1 })
        .where(eq(invitations.id, invitation.id));

      res.json({
        inviter,
        event,
        invitationType: invitation.invitationType,
        code: invitation.code,
      });
    } catch (error: any) {
      console.error("Error fetching invitation:", error);
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });

  // Create notification
  app.post('/api/notifications', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { category, type, title, message, relatedResourceId } = req.body;
      
      if (!category || !type || !title) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      await storage.createNotification({
        userId,
        category,
        type,
        title,
        message,
        relatedResourceId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  // Demo: Create sample chat data

  // Demo: Create sample notifications
  app.post('/api/notifications/seed-demo', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Create discover notifications
      await storage.createNotification({
        userId,
        category: 'discover',
        type: 'new_activity',
        title: '新活动推荐',
        message: '发现了一个超适合你的周末咖啡聚会',
      });

      // Create activities notifications
      await storage.createNotification({
        userId,
        category: 'activities',
        type: 'match_success',
        title: '匹配成功',
        message: '你的周末轰趴活动已成功匹配4位小伙伴',
      });

      await storage.createNotification({
        userId,
        category: 'activities',
        type: 'activity_reminder',
        title: '活动提醒',
        message: '距离「周末轰趴」开始还有2小时',
      });

      await storage.createNotification({
        userId,
        category: 'activities',
        type: 'feedback_reminder',
        title: '反馈提醒',
        message: '「周末轰趴」已结束，快来分享你的感受吧',
      });

      // Create chat notifications
      await storage.createNotification({
        userId,
        category: 'chat',
        type: 'new_message',
        title: '新消息',
        message: 'Alex 在群聊中@了你',
      });

      await storage.createNotification({
        userId,
        category: 'chat',
        type: 'new_message',
        title: '新消息',
        message: '周末轰趴群聊有6条新消息',
      });

      res.json({ success: true, message: 'Demo notifications created' });
    } catch (error) {
      console.error("Error creating demo notifications:", error);
      res.status(500).json({ message: "Failed to create demo notifications" });
    }
  });

  // ============ AUTH MIDDLEWARE ============
  
  async function requireAuth(req: Request, res: any, next: any) {
    if (!getAuthenticatedUserId(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }

  registerAdminRoutes(app);

  // Simple profile completeness calculator for stats (used before main function is defined)
  function calculateProfileCompletenessSimple(user: any): { score: number; starRating: number; missingFields: string[] } {
    const fields = [
      { key: 'displayName', label: '昵称', weight: 1 },
      { key: 'gender', label: '性别', weight: 1 },
      { key: 'birthdate', label: '生日', weight: 1 },
      { key: 'currentCity', label: '城市', weight: 1 },
      { key: 'interestsTop', label: '兴趣', weight: 1, isArray: true },
      { key: 'intent', label: '活动意向', weight: 1, isArray: true },
      { key: 'archetype', label: '社交原型', weight: 1 },
      { key: 'relationshipStatus', label: '感情状态', weight: 0.5 },
      { key: 'educationLevel', label: '学历', weight: 0.5 },
      { key: 'lifeStage', label: '人生阶段', weight: 0.5 },
      { key: 'socialStyle', label: '社交风格', weight: 0.5 },
      { key: 'venueStylePreference', label: '场地偏好', weight: 0.5 },
      { key: 'cuisinePreference', label: '菜系偏好', weight: 0.5, isArray: true },
    ];
    
    const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
    const missingFields: string[] = [];
    let filledWeight = 0;
    
    for (const field of fields) {
      const value = user[field.key];
      const isFilled = (field as any).isArray 
        ? Array.isArray(value) && value.length > 0
        : value !== null && value !== undefined && value !== '';
      
      if (isFilled) filledWeight += field.weight;
      else missingFields.push(field.label);
    }
    
    const score = Math.round((filledWeight / totalWeight) * 100);
    const starRating = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;
    
    return { score, starRating, missingFields };
  }

  // Dashboard Statistics
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // Calculate stats
      const totalUsers = allUsers.length;
      const subscribedUsers = 0; // TODO: Count from subscriptions table
      const newUsersThisWeek = 0; // TODO: Count users created in last 7 days
      const userGrowth = 0; // TODO: Calculate growth percentage
      
      // Count events (for now using blindBoxEvents)
      const allBlindBoxEvents = await storage.getAllBlindBoxEvents();
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const eventsThisMonth = allBlindBoxEvents.filter((event: any) => {
        const eventDate = new Date(event.createdAt || '');
        return eventDate >= thisMonth;
      }).length;
      
      // Revenue stats (placeholder)
      const monthlyRevenue = 0; // TODO: Calculate from payments table
      
      // Personality distribution (archetypes)
      const personalityDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.primaryArchetype) {
          acc[user.primaryArchetype] = (acc[user.primaryArchetype] || 0) + 1;
        }
        return acc;
      }, {});
      
      // Archetype distribution (12-archetype system)
      const archetypeDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.archetype) {
          acc[user.archetype] = (acc[user.archetype] || 0) + 1;
        }
        return acc;
      }, {});
      
      // Profile completeness distribution
      const completenessStats = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0, weakUsers: [] as any[] };
      for (const user of allUsers) {
        const completeness = calculateProfileCompletenessSimple(user);
        if (completeness.starRating === 1) completenessStats.star1++;
        else if (completeness.starRating === 2) completenessStats.star2++;
        else if (completeness.starRating === 3) completenessStats.star3++;
        else if (completeness.starRating === 4) completenessStats.star4++;
        else if (completeness.starRating === 5) completenessStats.star5++;
        
        // Track weak users (< 50% completeness)
        if (completeness.score < 50 && completenessStats.weakUsers.length < 10) {
          completenessStats.weakUsers.push({
            id: user.id,
            displayName: user.displayName || user.firstName || '未命名',
            score: completeness.score,
            starRating: completeness.starRating,
            missingFields: completeness.missingFields.slice(0, 5),
          });
        }
      }
      
      // City distribution
      const cityDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.currentCity) {
          acc[user.currentCity] = (acc[user.currentCity] || 0) + 1;
        }
        return acc;
      }, {});

      // Calculate gamification stats
      const levelDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        const level = user.currentLevel || 1;
        acc[`Lv.${level}`] = (acc[`Lv.${level}`] || 0) + 1;
        return acc;
      }, {});
      
      const totalXP = allUsers.reduce((sum: number, user: any) => sum + (user.experiencePoints || 0), 0);
      const totalJoyCoins = allUsers.reduce((sum: number, user: any) => sum + (user.joyCoins || 0), 0);
      const activeStreakUsers = allUsers.filter((user: any) => (user.activityStreak || 0) > 0).length;
      
      const gamificationStats = {
        levelDistribution,
        totalXP,
        totalJoyCoins,
        activeStreakUsers,
        avgLevel: allUsers.length > 0 
          ? Math.round((allUsers.reduce((sum: number, u: any) => sum + (u.currentLevel || 1), 0) / allUsers.length) * 10) / 10
          : 1,
      };

      // Calculate weekly matching satisfaction and low-scoring matches
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      let weeklyMatchingSatisfaction = 70; // Default value
      let lowScoringMatches = 0;
      
      try {
        // Get recent pool matching logs from past 7 days
        const recentLogs = await db
          .select()
          .from(poolMatchingLogs)
          .where(gt(poolMatchingLogs.createdAt, sevenDaysAgo));
        
        if (recentLogs.length > 0) {
          // Calculate average satisfaction from matchScores (assuming > 70 is satisfied)
          const totalScore = recentLogs.reduce((sum: number, log: any) => {
            const score = typeof log.matchScore === 'number' ? log.matchScore : 0;
            return sum + score;
          }, 0);
          weeklyMatchingSatisfaction = Math.round(totalScore / recentLogs.length);
          
          // Count low-scoring matches (< 50)
          lowScoringMatches = recentLogs.filter((log: any) => {
            const score = typeof log.matchScore === 'number' ? log.matchScore : 0;
            return score < 50;
          }).length;
        }
      } catch (err) {
        console.warn("Error calculating matching metrics:", err);
        // Use defaults if calculation fails
      }

      res.json({
        totalUsers,
        subscribedUsers,
        eventsThisMonth,
        monthlyRevenue,
        newUsersThisWeek,
        userGrowth,
        personalityDistribution,
        archetypeDistribution,
        completenessStats,
        cityDistribution,
        weeklyMatchingSatisfaction,
        lowScoringMatches,
        gamificationStats,
        matchingMetrics: getMatchingMetricsSnapshot(),
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Operational Dashboard — Today's Events + Alerts
  app.get("/api/admin/ops-dashboard", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      // Today's events
      const todayEventsResult = await db.execute(sql`
        SELECT
          e.id,
          e.title,
          e.date_time as "dateTime",
          e.location,
          e.status,
          e.max_attendees as "maxAttendees",
          COUNT(CASE WHEN ea.status != 'cancelled' THEN 1 END) as "registeredCount",
          COUNT(CASE WHEN ea.status = 'attended' THEN 1 END) as "checkedInCount"
        FROM events e
        LEFT JOIN event_attendance ea ON e.id = ea.event_id
        WHERE e.date_time >= ${todayStart} AND e.date_time <= ${todayEnd}
        GROUP BY e.id, e.title, e.date_time, e.location, e.status, e.max_attendees
        ORDER BY e.date_time ASC
      `);

      const todayEvents = (todayEventsResult.rows as any[]).map((row) => ({
        id: row.id,
        title: row.title,
        dateTime: row.dateTime,
        location: row.location,
        status: row.status,
        maxAttendees: row.maxAttendees,
        registeredCount: Number(row.registeredCount) || 0,
        checkedInCount: Number(row.checkedInCount) || 0,
        noShowCount: Math.max(0, (Number(row.registeredCount) || 0) - (Number(row.checkedInCount) || 0)),
      }));

      // Alerts
      const pendingReportsResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM reports WHERE status = 'pending'
      `);
      const pendingReports = Number((pendingReportsResult.rows[0] as any).count) || 0;

      const underfilledPoolsResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM event_pools
        WHERE registration_deadline > NOW()
          AND registration_deadline <= NOW() + INTERVAL '24 hours'
      `);
      const underfilledPoolsClosingSoon = Number((underfilledPoolsResult.rows[0] as any).count) || 0;

      const refundsPendingResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM payments WHERE status = 'refund_pending'
      `);
      const refundsPending = Number((refundsPendingResult.rows[0] as any).count) || 0;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const stuckUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE (
          onboarding_checkpoint IS NULL
          OR onboarding_checkpoint NOT IN ('profile-review', 'guide')
        )
        AND COALESCE(onboarding_checkpoint_timestamp, created_at) < ${sevenDaysAgo}
        AND created_at < ${sevenDaysAgo}
      `);
      const usersStuckInOnboarding = Number((stuckUsersResult.rows[0] as any).count) || 0;

      res.json({
        todayEvents,
        alerts: {
          pendingReports,
          underfilledPoolsClosingSoon,
          refundsPending,
          usersStuckInOnboarding,
        },
      });
    } catch (error) {
      console.error("Error fetching ops dashboard:", error);
      res.status(500).json({ message: "Failed to fetch ops dashboard" });
    }
  });

  // Helper function to calculate profile completeness
  function calculateProfileCompleteness(user: any): { score: number; starRating: number; missingFields: string[] } {
    const essentialFields = [
      { key: 'displayName', label: '昵称', weight: 1 },
      { key: 'gender', label: '性别', weight: 1 },
      { key: 'birthdate', label: '生日', weight: 1 },
      { key: 'currentCity', label: '城市', weight: 1 },
    ];
    const coreFields = [
      { key: 'interestsTop', label: '兴趣', weight: 1, isArray: true },
      { key: 'intent', label: '活动意向', weight: 1, isArray: true },
      { key: 'archetype', label: '社交原型', weight: 1 },
    ];
    const enrichmentFields = [
      { key: 'relationshipStatus', label: '感情状态', weight: 0.5 },
      { key: 'educationLevel', label: '学历', weight: 0.5 },
      { key: 'lifeStage', label: '人生阶段', weight: 0.5 },
      { key: 'socialStyle', label: '社交风格', weight: 0.5 },
      { key: 'venueStylePreference', label: '场地偏好', weight: 0.5 },
      { key: 'cuisinePreference', label: '菜系偏好', weight: 0.5, isArray: true },
      { key: 'topicAvoidances', label: '避免话题', weight: 0.3, isArray: true },
      { key: 'hasPets', label: '养宠物', weight: 0.3 },
      { key: 'hometown', label: '家乡', weight: 0.3 },
    ];
    
    const allFields = [...essentialFields, ...coreFields, ...enrichmentFields];
    const totalWeight = allFields.reduce((sum, f) => sum + f.weight, 0);
    const missingFields: string[] = [];
    
    let filledWeight = 0;
    for (const field of allFields) {
      const value = user[field.key];
      const isFilled = (field as any).isArray 
        ? Array.isArray(value) && value.length > 0
        : value !== null && value !== undefined && value !== '';
      
      if (isFilled) {
        filledWeight += field.weight;
      } else {
        missingFields.push(field.label);
      }
    }
    
    const score = Math.round((filledWeight / totalWeight) * 100);
    const starRating = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;
    
    return { score, starRating, missingFields };
  }

  // User Management - Get all users with filters and pagination
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { search, filter, city, archetype, intent, interest, minCompleteness, maxCompleteness } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      let users = await storage.getAllUsers();

      // Apply search filter
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        users = users.filter((user: any) => 
          user.firstName?.toLowerCase().includes(searchLower) ||
          user.lastName?.toLowerCase().includes(searchLower) ||
          user.displayName?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.phoneNumber?.includes(search)
        );
      }

      // Apply status filter
      if (filter === "banned") {
        users = users.filter((user: any) => user.isBanned);
      } else if (filter === "subscribed") {
        users = [];
      } else if (filter === "non-subscribed") {
        users = users;
      } else if (filter === "stuck") {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        users = users.filter((user: any) => {
          const checkpoint = user.onboardingCheckpoint;
          const checkpointTime = user.onboardingCheckpointTimestamp ? new Date(user.onboardingCheckpointTimestamp) : null;
          const createdAt = user.createdAt ? new Date(user.createdAt) : null;
          const isComplete = checkpoint === 'profile-review' || checkpoint === 'guide';
          if (isComplete) return false;
          const isStale = (checkpointTime && checkpointTime < sevenDaysAgo) || (createdAt && createdAt < sevenDaysAgo);
          return isStale;
        });
      }
      
      // Apply city filter
      if (city && typeof city === "string") {
        users = users.filter((user: any) => user.currentCity === city);
      }
      
      // Apply archetype filter
      if (archetype && typeof archetype === "string") {
        users = users.filter((user: any) => user.archetype === archetype);
      }
      
      // Apply intent filter
      if (intent && typeof intent === "string") {
        users = users.filter((user: any) => 
          Array.isArray(user.intent) && user.intent.includes(intent)
        );
      }
      
      // Apply interest filter
      if (interest && typeof interest === "string") {
        users = users.filter((user: any) => 
          Array.isArray(user.interestsTop) && user.interestsTop.some((i: string) => 
            i.toLowerCase().includes(interest.toLowerCase())
          )
        );
      }
      
      // Calculate completeness for each user and apply completeness filter
      const usersWithCompleteness = users.map((user: any) => {
        const completeness = calculateProfileCompleteness(user);
        return { ...user, profileCompleteness: completeness };
      });
      
      // Apply completeness filters
      let filteredUsers = usersWithCompleteness;
      if (minCompleteness) {
        const minVal = parseInt(minCompleteness as string);
        filteredUsers = filteredUsers.filter(u => u.profileCompleteness.score >= minVal);
      }
      if (maxCompleteness) {
        const maxVal = parseInt(maxCompleteness as string);
        filteredUsers = filteredUsers.filter(u => u.profileCompleteness.score <= maxVal);
      }

      const totalUsers = filteredUsers.length;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);

      res.json({
        users: paginatedUsers,
        pagination: {
          page,
          limit,
          total: totalUsers,
          totalPages: Math.ceil(totalUsers / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // User Management - Get user details with profile completeness
  app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's events
      const events = await storage.getUserBlindBoxEvents(req.params.id);
      
      // Calculate profile completeness
      const profileCompleteness = calculateProfileCompleteness(user);
      
      res.json({
        ...user,
        profileCompleteness,
        events,
        subscriptions: [],
        payments: [],
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ message: "Failed to fetch user details" });
    }
  });

  // User Management - Get comprehensive user detail for admin portal
  app.get("/api/admin/users/:id/detail", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const profileCompleteness = calculateProfileCompleteness(user);

      // Onboarding lifecycle — mirrors /api/auth/user logic including onboardingCheckpoint override
      type OnboardingStep = 'onboarding' | 'personality-test' | 'essential-data' | 'extended-data' | 'profile-review' | 'guide' | 'discover';
      const profileEssentialComplete = !!(user.displayName && user.gender && user.currentCity);
      let nextStep: OnboardingStep;
      // Keep consistent with /api/auth/user: gate on hasCompletedPersonalityTest rather than
      // hasCompletedRegistration so post-WeChat-auth users advance correctly.
      if (!user.hasCompletedPersonalityTest && !user.hasCompletedRegistration) nextStep = 'onboarding';
      else if (!user.hasCompletedPersonalityTest) nextStep = 'personality-test';
      else if (!profileEssentialComplete) nextStep = 'essential-data';
      else if (!user.hasCompletedInterestsCarousel) nextStep = 'extended-data';
      else if (!user.hasSeenProfileReview) nextStep = 'profile-review';
      else if (!user.hasSeenGuide) nextStep = 'guide';
      else nextStep = 'discover';

      const stepOrder: OnboardingStep[] = ['onboarding', 'personality-test', 'essential-data', 'extended-data', 'profile-review', 'guide', 'discover'];
      const baseIndex = stepOrder.indexOf(nextStep);
      const checkpointValue = user.onboardingCheckpoint as OnboardingStep | null;
      const checkpointIndex = checkpointValue ? stepOrder.indexOf(checkpointValue) : -1;
      if (checkpointValue && checkpointIndex !== -1 && baseIndex !== -1 && checkpointIndex > baseIndex && checkpointIndex < stepOrder.indexOf('discover')) {
        const nextStepIndex = Math.min(checkpointIndex + 1, stepOrder.indexOf('discover'));
        nextStep = stepOrder[nextStepIndex];
      }

      // Fetch all independent data in parallel
      const [
        assessmentSessionResult,
        joinedEvents,
        poolRegistrations,
        userConnections,
        userMatchHistory,
        interestsResult,
      ] = await Promise.all([
        db
          .select()
          .from(assessmentSessions)
          .where(and(eq(assessmentSessions.userId, userId), eq(assessmentSessions.phase, 'completed')))
          .orderBy(desc(assessmentSessions.completedAt))
          .limit(1),
        storage.getUserJoinedEvents(userId),
        db
          .select()
          .from(eventPoolRegistrations)
          .where(eq(eventPoolRegistrations.userId, userId))
          .orderBy(desc(eventPoolRegistrations.registeredAt))
          .limit(20),
        db
          .select()
          .from(connections)
          .where(and(
            or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
            eq(connections.status, 'mutual')
          ))
          .orderBy(desc(connections.createdAt))
          .limit(20),
        db
          .select()
          .from(matchHistory)
          .where(or(eq(matchHistory.user1Id, userId), eq(matchHistory.user2Id, userId)))
          .orderBy(desc(matchHistory.matchedAt))
          .limit(20),
        db
          .select()
          .from(userInterests)
          .where(eq(userInterests.userId, userId))
          .limit(1),
      ]);

      const assessmentSession = assessmentSessionResult[0] || null;
      const interests = interestsResult[0] || null;

      // Matching readiness
      const blockers: string[] = [];
      if (!user.hasCompletedPersonalityTest) blockers.push('人格测试未完成');
      if (!user.archetype) blockers.push('原型未确定');
      if (!profileEssentialComplete) blockers.push('基本资料不完整');
      if (!user.hasCompletedInterestsCarousel) blockers.push('兴趣数据未完成');
      if (user.isBanned) blockers.push('用户已被封禁');
      const matchingReadiness = { isReady: blockers.length === 0, blockers };

      // Strip sensitive credential fields before sending to browser
      const { password, wechatSessionKey, wechatOpenId, ...safeUser } = user as any;
      res.json({
        user: { ...safeUser, profileCompleteness },
        onboarding: {
          nextStep,
          profileEssentialComplete,
          hasCompletedRegistration: user.hasCompletedRegistration,
          hasCompletedPersonalityTest: user.hasCompletedPersonalityTest,
          hasCompletedInterestsCarousel: user.hasCompletedInterestsCarousel,
          hasSeenProfileReview: user.hasSeenProfileReview,
          hasSeenGuide: user.hasSeenGuide,
        },
        assessmentSession: assessmentSession || null,
        joinedEvents,
        poolRegistrations,
        connections: userConnections,
        matchHistory: userMatchHistory,
        interests: interests || null,
        matchingReadiness,
      });
    } catch (error) {
      console.error("Error fetching user detail:", error);
      res.status(500).json({ message: "Failed to fetch user detail" });
    }
  });

  // Icebreaker Session Monitor — Read-only view of active sessions
  app.get("/api/admin/icebreaker-sessions", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const sessionsResult = await db.execute(sql`
        SELECT
          s.id,
          s.current_phase as "currentPhase",
          s.phase_started_at as "phaseStartedAt",
          s.expected_attendees as "expectedAttendees",
          s.checked_in_count as "checkedInCount",
          s.host_user_id as "hostUserId",
          s.started_at as "startedAt",
          s.created_at as "createdAt",
          e.title as "eventTitle",
          u.first_name as "hostFirstName",
          u.last_name as "hostLastName"
        FROM icebreaker_sessions s
        LEFT JOIN events e ON s.event_id = e.id
        LEFT JOIN users u ON s.host_user_id = u.id
        WHERE s.ended_at IS NULL
        ORDER BY s.created_at DESC
      `);

      const sessions = (sessionsResult.rows as any[]).map((row) => {
        const phaseStarted = row.phaseStartedAt ? new Date(row.phaseStartedAt) : null;
        const now = new Date();
        const phaseDurationMinutes = phaseStarted
          ? Math.floor((now.getTime() - phaseStarted.getTime()) / 60000)
          : null;

        return {
          id: row.id,
          currentPhase: row.currentPhase || "waiting",
          phaseStartedAt: row.phaseStartedAt,
          phaseDurationMinutes,
          expectedAttendees: Number(row.expectedAttendees) || 0,
          checkedInCount: Number(row.checkedInCount) || 0,
          hostUserId: row.hostUserId,
          hostName: row.hostFirstName || row.hostLastName
            ? `${row.hostFirstName || ""} ${row.hostLastName || ""}`.trim()
            : null,
          eventTitle: row.eventTitle || "未关联活动",
          startedAt: row.startedAt,
        };
      });

      res.json({ sessions });
    } catch (error) {
      console.error("Error fetching icebreaker sessions:", error);
      res.status(500).json({ message: "Failed to fetch icebreaker sessions" });
    }
  });

  // User Management - Ban user
  app.patch("/api/admin/users/:id/ban", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(req.params.id, { isBanned: true });

      logAdminAudit({
        action: 'USER_BANNED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'user',
        targetEntityId: req.params.id,
        before: { isBanned: user.isBanned },
        after: { isBanned: true },
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error banning user:", error);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  // User Management - Unban user
  app.patch("/api/admin/users/:id/unban", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(req.params.id, { isBanned: false });

      logAdminAudit({
        action: 'USER_UNBANNED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'user',
        targetEntityId: req.params.id,
        before: { isBanned: user.isBanned },
        after: { isBanned: false },
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error unbanning user:", error);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  // Subscription Management - Get all subscriptions with pagination
  app.get("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    try {
      const { filter } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      let subscriptions;
      
      if (filter === "active") {
        subscriptions = await storage.getActiveSubscriptions();
      } else {
        subscriptions = await storage.getAllSubscriptions();
      }

      const total = subscriptions.length;
      const paginatedData = subscriptions.slice(offset, offset + limit);

      res.json({
        subscriptions: paginatedData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // Subscription Management - Create subscription
  app.post("/api/admin/subscriptions", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { userId, planType, durationMonths } = req.body;
      
      if (!userId || !planType || !durationMonths) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + durationMonths);

      const subscription = await storage.createSubscription({
        userId,
        planType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive: true,
        autoRenew: false,
      });

      res.json(subscription);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // Subscription Management - Update subscription
  app.patch("/api/admin/subscriptions/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { isActive, autoRenew, endDate } = req.body;
      
      const subscription = await storage.updateSubscription(req.params.id, {
        isActive,
        autoRenew,
        endDate,
      });

      res.json(subscription);
    } catch (error) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // Coupon Management - Get all coupons
  app.get("/api/admin/coupons", requireAdmin, async (req, res) => {
    try {
      const coupons = await storage.getAllCoupons();
      res.json(coupons);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  // Coupon Management - Get coupon details
  app.get("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
    try {
      const coupon = await storage.getCoupon(req.params.id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      console.error("Error fetching coupon:", error);
      res.status(500).json({ message: "Failed to fetch coupon" });
    }
  });

  // Coupon Management - Get coupon usage stats
  app.get("/api/admin/coupons/:id/usage", requireAdmin, async (req, res) => {
    try {
      const usage = await storage.getCouponUsageStats(req.params.id);
      res.json(usage);
    } catch (error) {
      console.error("Error fetching coupon usage:", error);
      res.status(500).json({ message: "Failed to fetch coupon usage" });
    }
  });

  // Coupon Management - Create coupon
  app.post("/api/admin/coupons", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { code, discountType, discountValue, validFrom, validUntil, maxUses } = req.body;
      
      if (!code || !discountType || !discountValue) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const coupon = await storage.createCoupon({
        code: code.toUpperCase(),
        discountType,
        discountValue,
        validFrom: validFrom || new Date().toISOString(),
        validUntil: validUntil || null,
        maxUses: maxUses || null,
        isActive: true,
      });

      res.json(coupon);
    } catch (error) {
      console.error("Error creating coupon:", error);
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  // Coupon Management - Update coupon
  app.patch("/api/admin/coupons/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const coupon = await storage.updateCoupon(req.params.id, req.body);
      res.json(coupon);
    } catch (error) {
      console.error("Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  // ============ PUBLIC STATS ============

  // Public API - Get platform stats for landing page
  app.get("/api/public/stats", async (req, res) => {
    try {
      const stats = await storage.getPublicStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching public stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ PROMOTION BANNERS ============

  // Public API - Get active banners
  app.get("/api/banners", async (req, res) => {
    try {
      const { city, placement } = req.query;
      const banners = await storage.getActiveBanners(
        city as string | undefined,
        placement as string | undefined
      );
      res.json(banners);
    } catch (error) {
      console.error("Error fetching banners:", error);
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  // ============ PRICING MANAGEMENT ============

  // Public API - Get active pricing settings (for payment page)
  app.get("/api/pricing", async (req, res) => {
    try {
      const settings = await storage.getActivePricingSettings();
      const formatted = settings.map(s => ({
        id: s.id,
        planType: s.planType,
        displayName: s.displayName,
        displayNameEn: s.displayNameEn,
        name: s.displayName,
        nameEn: s.displayNameEn,
        description: s.description,
        price: s.priceInCents / 100,
        originalPrice: s.originalPriceInCents ? s.originalPriceInCents / 100 : null,
        durationDays: s.durationDays,
        isActive: s.isActive,
        isFeatured: s.isFeatured,
      }));
      res.json(formatted);
    } catch (error) {
      console.error("Error fetching pricing:", error);
      res.status(500).json({ message: "Failed to fetch pricing" });
    }
  });

  // Admin - Get all pricing settings
  app.get("/api/admin/pricing", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllPricingSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching pricing settings:", error);
      res.status(500).json({ message: "Failed to fetch pricing settings" });
    }
  });

  // Admin - Get single pricing setting
  app.get("/api/admin/pricing/:id", requireAdmin, async (req, res) => {
    try {
      const setting = await storage.getPricingSetting(req.params.id);
      if (!setting) {
        return res.status(404).json({ message: "Pricing setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching pricing setting:", error);
      res.status(500).json({ message: "Failed to fetch pricing setting" });
    }
  });

  // Admin - Update pricing setting
  app.patch("/api/admin/pricing/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { displayName, displayNameEn, description, priceInCents, originalPriceInCents, durationDays, sortOrder, isActive, isFeatured } = req.body;
      
      const setting = await storage.updatePricingSetting(req.params.id, {
        displayName,
        displayNameEn,
        description,
        priceInCents,
        originalPriceInCents,
        durationDays,
        sortOrder,
        isActive,
        isFeatured,
      });
      
      res.json(setting);
    } catch (error) {
      console.error("Error updating pricing setting:", error);
      res.status(500).json({ message: "Failed to update pricing setting" });
    }
  });

  // Venue Management - Get all venues
  app.get("/api/admin/venues", requireAdmin, async (req, res) => {
    try {
      const venues = await storage.getAllVenues();
      res.json(venues);
    } catch (error) {
      console.error("Error fetching venues:", error);
      res.status(500).json({ message: "Failed to fetch venues" });
    }
  });

  // Venue Data Quality — admin-facing summary of missing/invalid venue data.
  // Must be registered before /:id to avoid the segment matching "data-quality".
  app.get("/api/admin/venues/data-quality", requireAdmin, async (_req, res) => {
    try {
      const venues = await storage.getAllVenues();
      const report = checkVenueDataQuality(venues.map((venue) => normalizeVenueQualityRecord(venue)));
      res.json(report);
    } catch (error) {
      logger.error("Error running venue data quality check", { error: String(error) });
      res.status(500).json({ message: "Failed to run venue data quality check" });
    }
  });

  // Venue Management - Get venue details
  app.get("/api/admin/venues/:id", requireAdmin, async (req, res) => {
    try {
      const venue = await storage.getVenue(req.params.id);
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      res.json(venue);
    } catch (error) {
      console.error("Error fetching venue:", error);
      res.status(500).json({ message: "Failed to fetch venue" });
    }
  });

  // Venue Management - Create venue
  app.post("/api/admin/venues", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { 
        name, type, address, city, district, clusterId, districtId,
        contactName, contactPhone, commissionRate, tags, cuisines, 
        priceRange, maxConcurrentEvents, notes, decorStyle, tasteIntensity,
        barThemes, alcoholOptions, vibeDescriptor
      } = req.body;
      
      if (!name || !type || !address || !city || !district) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const venue = await storage.createVenue({
        name,
        type,
        address,
        city,
        district,
        clusterId: clusterId || null,
        districtId: districtId || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        commissionRate: commissionRate || 20,
        tags: tags || [],
        cuisines: cuisines || [],
        priceRange: priceRange || null,
        decorStyle: decorStyle || [],
        tasteIntensity: tasteIntensity || [],
        maxConcurrentEvents: maxConcurrentEvents || 1,
        isActive: true,
        notes: notes || null,
        barThemes: barThemes || [],
        alcoholOptions: alcoholOptions || [],
        vibeDescriptor: vibeDescriptor || null,
      });

      logAdminAudit({
        action: 'VENUE_CREATED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'venue',
        targetEntityId: venue.id,
        context: { name: venue.name, city: venue.city, type: venue.type },
      });

      res.json(venue);
    } catch (error) {
      logger.error("Error creating venue", { error: String(error) });
      res.status(500).json({ message: "Failed to create venue" });
    }
  });

  // Venue Management - Update venue
  app.patch("/api/admin/venues/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const venue = await storage.updateVenue(req.params.id, req.body);
      logAdminAudit({
        action: 'VENUE_UPDATED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'venue',
        targetEntityId: req.params.id,
        after: buildVenueAuditAfter(req.body),
      });
      res.json(venue);
    } catch (error) {
      logger.error("Error updating venue", { venueId: req.params.id, error: String(error) });
      res.status(500).json({ message: "Failed to update venue" });
    }
  });

  // Venue Management - Delete venue
  app.delete("/api/admin/venues/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      await storage.deleteVenue(req.params.id);
      logAdminAudit({
        action: 'VENUE_DELETED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'venue',
        targetEntityId: req.params.id,
      });
      res.json({ message: "Venue deleted successfully" });
    } catch (error) {
      logger.error("Error deleting venue", { venueId: req.params.id, error: String(error) });
      res.status(500).json({ message: "Failed to delete venue" });
    }
  });

  // ============ VENUE DEALS API (场地优惠) ============
  
  // Get all deals for a venue (admin)
  app.get("/api/admin/venues/:venueId/deals", requireAdmin, async (req, res) => {
    try {
      const deals = await storage.getVenueDeals(req.params.venueId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching venue deals:", error);
      res.status(500).json({ message: "Failed to fetch venue deals" });
    }
  });

  // Get active deals for a venue (public - for event detail page)
  app.get("/api/venues/:venueId/deals", async (req, res) => {
    try {
      const deals = await storage.getActiveVenueDeals(req.params.venueId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching active venue deals:", error);
      res.status(500).json({ message: "Failed to fetch venue deals" });
    }
  });

  // Create venue deal (admin)
  app.post("/api/admin/venues/:venueId/deals", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const deal = await storage.createVenueDeal({
        ...req.body,
        venueId: req.params.venueId,
      });
      res.json(deal);
    } catch (error) {
      console.error("Error creating venue deal:", error);
      res.status(500).json({ message: "Failed to create venue deal" });
    }
  });

  // Update venue deal (admin)
  app.patch("/api/admin/venue-deals/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const deal = await storage.updateVenueDeal(req.params.id, req.body);
      res.json(deal);
    } catch (error) {
      console.error("Error updating venue deal:", error);
      res.status(500).json({ message: "Failed to update venue deal" });
    }
  });

  // Delete venue deal (admin)
  app.delete("/api/admin/venue-deals/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      await storage.deleteVenueDeal(req.params.id);
      res.json({ message: "Venue deal deleted successfully" });
    } catch (error) {
      console.error("Error deleting venue deal:", error);
      res.status(500).json({ message: "Failed to delete venue deal" });
    }
  });

  // Record deal usage (for analytics)
  app.post("/api/venue-deals/:id/use", isPhoneAuthenticated, async (req, res) => {
    try {
      await storage.incrementVenueDealUsage(req.params.id);
      res.json({ message: "Deal usage recorded" });
    } catch (error) {
      console.error("Error recording deal usage:", error);
      res.status(500).json({ message: "Failed to record deal usage" });
    }
  });

  // Get venue with deals (public - for event detail page)
  app.get("/api/venues/:venueId/with-deals", async (req, res) => {
    try {
      const venue = await storage.getVenue(req.params.venueId);
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      const deals = await storage.getActiveVenueDeals(req.params.venueId);
      res.json({ venue, deals });
    } catch (error) {
      console.error("Error fetching venue with deals:", error);
      res.status(500).json({ message: "Failed to fetch venue info" });
    }
  });

  // Get venue by restaurant name with deals (for blind box event detail page)
  app.get("/api/venues/by-name", async (req, res) => {
    try {
      const { name } = req.query;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Restaurant name required" });
      }
      
      const venue = await storage.getVenueByName(name);
      if (!venue) {
        return res.json({ venue: null, deals: [] });
      }
      
      // Only return partner venues with active deals
      if (venue.partner_status !== 'active') {
        return res.json({ venue: null, deals: [] });
      }
      
      const deals = await storage.getActiveVenueDeals(venue.id);
      res.json({ venue, deals });
    } catch (error) {
      console.error("Error fetching venue by name:", error);
      res.status(500).json({ message: "Failed to fetch venue info" });
    }
  });

  // Get active venue districts (public - for event join form)
  app.get("/api/venues/active-districts", async (req, res) => {
    try {
      const { eventType } = req.query;
      const districts = await storage.getActiveVenueDistricts(eventType as string | undefined);
      res.json(districts);
    } catch (error) {
      console.error("Error fetching active venue districts:", error);
      res.status(500).json({ message: "Failed to fetch active districts" });
    }
  });

  // Venue Booking - Check availability
  app.post("/api/venues/check-availability", requireAuth, async (req, res) => {
    try {
      const { venueId, bookingDate, bookingTime } = req.body;
      
      if (!venueId || !bookingDate || !bookingTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const isAvailable = await storage.checkVenueAvailability(
        venueId,
        new Date(bookingDate),
        bookingTime
      );

      res.json({ available: isAvailable });
    } catch (error) {
      console.error("Error checking venue availability:", error);
      res.status(500).json({ message: "Failed to check venue availability" });
    }
  });

  // Venue Booking - Create booking
  app.post("/api/venues/book", requireAuth, async (req, res) => {
    try {
      const { venueId, eventId, bookingDate, bookingTime, participantCount, estimatedRevenue } = req.body;
      
      if (!venueId || !eventId || !bookingDate || !bookingTime || !participantCount) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const booking = await storage.createVenueBooking({
        venueId,
        eventId,
        bookingDate: new Date(bookingDate),
        bookingTime,
        participantCount,
        estimatedRevenue,
      });

      res.json(booking);
    } catch (error: any) {
      console.error("Error creating venue booking:", error);
      if (error.message === 'Venue is not available at the requested time') {
        res.status(409).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create venue booking" });
      }
    }
  });

  // Venue Booking - Get bookings for a venue
  app.get("/api/admin/venues/:venueId/bookings", requireAdmin, async (req, res) => {
    try {
      const bookings = await storage.getVenueBookings(req.params.venueId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching venue bookings:", error);
      res.status(500).json({ message: "Failed to fetch venue bookings" });
    }
  });

  // Venue Booking - Get booking for an event
  app.get("/api/events/:eventId/venue-booking", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getEventVenueBooking(req.params.eventId);
      res.json(booking || null);
    } catch (error) {
      console.error("Error fetching event venue booking:", error);
      res.status(500).json({ message: "Failed to fetch event venue booking" });
    }
  });

  // Venue Booking - Cancel booking
  app.post("/api/venues/bookings/:bookingId/cancel", requireAuth, async (req, res) => {
    try {
      const booking = await storage.cancelVenueBooking(req.params.bookingId);
      res.json(booking);
    } catch (error) {
      console.error("Error cancelling venue booking:", error);
      res.status(500).json({ message: "Failed to cancel venue booking" });
    }
  });

  // Venue Booking - Update revenue (Admin only)
  app.patch("/api/admin/venues/bookings/:bookingId/revenue", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { actualRevenue } = req.body;
      
      if (actualRevenue === undefined) {
        return res.status(400).json({ message: "Missing actualRevenue" });
      }

      const booking = await storage.updateVenueBookingRevenue(req.params.bookingId, actualRevenue);
      res.json(booking);
    } catch (error) {
      console.error("Error updating venue booking revenue:", error);
      res.status(500).json({ message: "Failed to update venue booking revenue" });
    }
  });

  // ============ Emergency Venue Migration ============
  
  // Get active bookings for a venue (for migration planning)
  app.get("/api/admin/venues/:venueId/active-bookings", requireAdmin, async (req, res) => {
    try {
      const bookings = await storage.getActiveBookingsForVenue(req.params.venueId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching active venue bookings:", error);
      res.status(500).json({ message: "Failed to fetch active venue bookings" });
    }
  });

  // Migrate a booking to a new venue
  app.post("/api/admin/venues/bookings/:bookingId/migrate", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { newVenueId, reason } = req.body;
      
      if (!newVenueId) {
        return res.status(400).json({ message: "newVenueId is required" });
      }

      const result = await storage.migrateVenueBooking(req.params.bookingId, newVenueId, reason);
      res.json({
        success: true,
        message: "Booking migrated successfully",
        ...result
      });
    } catch (error: any) {
      console.error("Error migrating venue booking:", error);
      res.status(400).json({ message: error.message || "Failed to migrate venue booking" });
    }
  });

  // Find alternative venues for a booking
  app.get("/api/admin/venues/bookings/:bookingId/alternatives", requireAdmin, async (req, res) => {
    try {
      const booking = await db.execute(sql`
        SELECT vb.*, v.city, v.district, e.event_type
        FROM venue_bookings vb
        LEFT JOIN venues v ON vb.venue_id = v.id
        LEFT JOIN blind_box_events e ON vb.event_id = e.id
        WHERE vb.id = ${req.params.bookingId}
      `);
      
      if (booking.rows.length === 0) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      const bookingData = booking.rows[0] as Record<string, any>;
      
      const alternatives = await venueMatchingService.findMatchingVenues({
        eventType: String(bookingData.event_type || "dining"),
        participantCount: Number(bookingData.participant_count) || 8,
        preferredCity: String(bookingData.city || ""),
        preferredDistrict: String(bookingData.district || ""),
        dateTime: new Date(bookingData.booking_date),
        durationHours: 3
      });
      
      const filteredAlternatives = alternatives.filter(a => a.venue.id !== bookingData.venue_id);
      
      res.json(filteredAlternatives);
    } catch (error) {
      console.error("Error finding alternative venues:", error);
      res.status(500).json({ message: "Failed to find alternative venues" });
    }
  });

  // ============ Venue Time Slots Management ============
  
  // Get all time slots across all venues (for calendar overview)
  app.get("/api/admin/time-slots/all", requireAdmin, async (req, res) => {
    try {
      const timeSlots = await storage.getAllVenueTimeSlotsWithVenue();
      res.json(timeSlots);
    } catch (error) {
      console.error("Error fetching all venue time slots:", error);
      res.status(500).json({ message: "Failed to fetch all venue time slots" });
    }
  });
  
  // Get all time slots for a venue
  app.get("/api/admin/venues/:venueId/time-slots", requireAdmin, async (req, res) => {
    try {
      const timeSlots = await storage.getVenueTimeSlots(req.params.venueId);
      res.json(timeSlots);
    } catch (error) {
      console.error("Error fetching venue time slots:", error);
      res.status(500).json({ message: "Failed to fetch venue time slots" });
    }
  });

  // Create a time slot for a venue
  app.post("/api/admin/venues/:venueId/time-slots", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { dayOfWeek, specificDate, startTime, endTime, maxConcurrentEvents, notes } = req.body;
      
      if (!startTime || !endTime) {
        return res.status(400).json({ message: "Start time and end time are required" });
      }
      
      if (dayOfWeek === undefined && !specificDate) {
        return res.status(400).json({ message: "Either dayOfWeek or specificDate is required" });
      }

      const timeSlot = await storage.createVenueTimeSlot({
        venueId: req.params.venueId,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        specificDate: specificDate || null,
        startTime,
        endTime,
        maxConcurrentEvents: maxConcurrentEvents || 1,
        notes: notes || null,
        isActive: true,
      });

      res.json(timeSlot);
    } catch (error) {
      console.error("Error creating venue time slot:", error);
      res.status(500).json({ message: "Failed to create venue time slot" });
    }
  });

  // Batch create time slots (for weekly recurring)
  app.post("/api/admin/venues/:venueId/time-slots/batch", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { timeSlots } = req.body;
      
      if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
        return res.status(400).json({ message: "timeSlots array is required" });
      }

      const createdSlots = await storage.batchCreateVenueTimeSlots(
        req.params.venueId,
        timeSlots
      );

      res.json(createdSlots);
    } catch (error) {
      console.error("Error batch creating venue time slots:", error);
      res.status(500).json({ message: "Failed to batch create venue time slots" });
    }
  });

  // Update a time slot
  app.patch("/api/admin/time-slots/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const timeSlot = await storage.updateVenueTimeSlot(req.params.id, req.body);
      res.json(timeSlot);
    } catch (error) {
      console.error("Error updating venue time slot:", error);
      res.status(500).json({ message: "Failed to update venue time slot" });
    }
  });

  // Delete a time slot
  app.delete("/api/admin/time-slots/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      await storage.deleteVenueTimeSlot(req.params.id);
      res.json({ message: "Time slot deleted successfully" });
    } catch (error) {
      console.error("Error deleting venue time slot:", error);
      res.status(500).json({ message: "Failed to delete venue time slot" });
    }
  });

  // Get available venues for a specific date/time (for event pool creation)
  app.get("/api/admin/available-venues", requireAdmin, async (req, res) => {
    try {
      const { city, district, date, startTime, endTime } = req.query;
      
      if (!city || !date) {
        return res.status(400).json({ message: "City and date are required" });
      }

      const availableVenues = await storage.getAvailableVenuesForDateTime(
        city as string,
        district as string | undefined,
        date as string,
        startTime as string | undefined,
        endTime as string | undefined
      );

      res.json(availableVenues);
    } catch (error) {
      console.error("Error fetching available venues:", error);
      res.status(500).json({ message: "Failed to fetch available venues" });
    }
  });

  // Smart venue filter API - with budget and cuisine filtering
  app.get("/api/admin/smart-venues", requireAdmin, async (req, res) => {
    try {
      const { 
        city, 
        district, 
        eventType, 
        budgetRestrictions 
      } = req.query;
      
      if (!city || !eventType) {
        return res.status(400).json({ message: "缺少必要参数: city and eventType required" });
      }
      
      // Parse and validate budget restrictions
      let budgets: string[] = [];
      if (budgetRestrictions) {
        try {
          const parsed = JSON.parse(budgetRestrictions as string);
          if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
            return res.status(400).json({ message: "无效的 budgetRestrictions 参数，必须是字符串数组的 JSON" });
          }
          budgets = parsed;
        } catch {
          return res.status(400).json({ message: "无法解析 budgetRestrictions 参数，必须是有效的 JSON" });
        }
      }
      
      // Determine allowed venue types based on event type
      const allowedVenueTypes = eventType === "酒局"
        ? ["bar", "homebar"]
        : ["restaurant", "cafe"];
      
      // Build base query with venue type filter
      let whereConditions = and(
        eq(venues.city, city as string),
        eq(venues.isActive, true),
        inArray(venues.venueType, allowedVenueTypes)
      );
      
      // Apply district filter if provided
      if (district) {
        whereConditions = and(
          whereConditions,
          eq(venues.area, district as string)
        );
      }
      
      // Apply budget filter using SQL array overlap if restrictions provided
      if (budgets.length > 0) {
        whereConditions = and(
          whereConditions,
          sql`${venues.budgetCategories} && ${budgets}::text[]`
        );
      }
      
      const filteredVenues = await db
        .select()
        .from(venues)
        .where(whereConditions);
      
      // Batch check which venues have time slots configured
      let venuesWithSlots;
      if (filteredVenues.length === 0) {
        venuesWithSlots = [];
      } else {
        // Single query to fetch all venueIds that have at least one active time slot
        const activeSlots = await db
          .select({ venueId: venueTimeSlots.venueId })
          .from(venueTimeSlots)
          .where(eq(venueTimeSlots.isActive, true));

        const venuesWithActiveSlots = new Set(
          activeSlots.map((slot: { venueId: string | null }) => slot.venueId)
        );

        venuesWithSlots = filteredVenues.map((venue: typeof venues.$inferSelect) => ({
          ...venue,
          hasTimeSlots: venuesWithActiveSlots.has(venue.id),
        }));
      }
      
      res.json(venuesWithSlots);
    } catch (error) {
      console.error("Smart venue filter error:", error);
      res.status(500).json({ message: "查询失败" });
    }
  });

  // Event Templates - Get all templates
  app.get("/api/admin/event-templates", requireAdmin, async (req, res) => {
    try {
      const templates = await storage.getAllEventTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching event templates:", error);
      res.status(500).json({ message: "Failed to fetch event templates" });
    }
  });

  // Event Templates - Create template
  app.post("/api/admin/event-templates", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { name, eventType, dayOfWeek, timeOfDay, theme, genderRestriction, minAge, maxAge, minParticipants, maxParticipants, customPrice } = req.body;
      
      if (!name || !eventType || dayOfWeek === undefined || !timeOfDay) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const template = await storage.createEventTemplate({
        name,
        eventType,
        dayOfWeek,
        timeOfDay,
        theme: theme || null,
        genderRestriction: genderRestriction || null,
        minAge: minAge || null,
        maxAge: maxAge || null,
        minParticipants: minParticipants || 5,
        maxParticipants: maxParticipants || 10,
        customPrice: customPrice || null,
        isActive: true,
      });

      res.json(template);
    } catch (error) {
      console.error("Error creating event template:", error);
      res.status(500).json({ message: "Failed to create event template" });
    }
  });

  // Event Templates - Update template
  app.patch("/api/admin/event-templates/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const template = await storage.updateEventTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error) {
      console.error("Error updating event template:", error);
      res.status(500).json({ message: "Failed to update event template" });
    }
  });

  // Event Templates - Delete template
  app.delete("/api/admin/event-templates/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      await storage.deleteEventTemplate(req.params.id);
      res.json({ message: "Event template deleted successfully" });
    } catch (error) {
      console.error("Error deleting event template:", error);
      res.status(500).json({ message: "Failed to delete event template" });
    }
  });

  // Event Management - Get all events (admin view)
  app.get("/api/admin/events/:id", requireAdmin, async (req, res) => {
    try {
      const event = await storage.getBlindBoxEventAdmin(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Event Management - Update event status
  app.patch("/api/admin/events/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const eventId = req.params.id;
      const user = req.user as User;
      
      // Get old event state
      const oldEvent = await storage.getBlindBoxEventAdmin(eventId);
      if (!oldEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Update event
      const updatedEvent = await storage.updateBlindBoxEventAdmin(eventId, req.body);
      
      // Broadcast status change if status was updated
      if (req.body.status && req.body.status !== oldEvent.status) {
        await broadcastEventStatusChanged(
          eventId,
          oldEvent.status,
          req.body.status,
          user.id,
          req.body.reason
        );
      }
      
      // Broadcast admin action for other changes
      if (Object.keys(req.body).length > 0 && !req.body.status) {
        await broadcastAdminAction(
          eventId,
          'update_event',
          user.id,
          req.body
        );
      }

      // Emit audit log when event status is mutated
      if (req.body.status && req.body.status !== oldEvent.status) {
        logAdminAudit({
          action: 'EVENT_STATUS_CHANGED',
          adminId: getActingAdminId(req),
          adminRole: (req as any).adminRole,
          targetEntityType: 'event',
          targetEntityId: eventId,
          before: { status: oldEvent.status },
          after: { status: req.body.status },
          context: { reason: req.body.reason },
        });
      }

      res.json(updatedEvent);
    } catch (error) {
      logger.error("Error updating event", { eventId: req.params.id, error: String(error) });
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // ============ EVENT POOLS (两阶段匹配模型) ============
  
  // Event Pools - Get all event pools (admin view)
  app.get("/api/admin/event-pools", requireAdmin, async (req, res) => {
    try {
      // 不用 relations，直接查 event_pools 表
      const pools = await db
        .select({
          id: eventPools.id,
          title: eventPools.title,
          description: eventPools.description,
          eventType: eventPools.eventType,
          city: eventPools.city,
          district: eventPools.district,
          dateTime: eventPools.dateTime,
          registrationDeadline: eventPools.registrationDeadline,
          genderRestriction: eventPools.genderRestriction,
          industryRestrictions: eventPools.industryRestrictions,
          seniorityRestrictions: eventPools.seniorityRestrictions,
          educationLevelRestrictions: eventPools.educationLevelRestrictions,
          ageRangeMin: eventPools.ageRangeMin,
          ageRangeMax: eventPools.ageRangeMax,
          minGroupSize: eventPools.minGroupSize,
          maxGroupSize: eventPools.maxGroupSize,
           targetGroups: eventPools.targetGroups,
           status: eventPools.status,
           totalRegistrations: eventPools.totalRegistrations,
           successfulMatches: eventPools.successfulMatches,
           predictiveRerankEnabledOverride: eventPools.predictiveRerankEnabledOverride,
           createdBy: eventPools.createdBy,
           createdAt: eventPools.createdAt,
           updatedAt: eventPools.updatedAt,
           matchedAt: eventPools.matchedAt,
        })
        .from(eventPools)
        .orderBy(desc(eventPools.createdAt));

      console.log("[Admin] fetched raw eventPools:", pools);

      // 继续保留“报名数 / matched / pending”统计逻辑
      const poolsWithStats = await Promise.all(
        pools.map(async (pool: any) => {
          const registrations = await db.query.eventPoolRegistrations.findMany({
            where: (regs: any, { eq }: any) => eq(regs.poolId, pool.id),
          });

          return {
            ...pool,
            registrationCount: registrations.length,
            matchedCount: registrations.filter((r: any) => r.matchStatus === "matched").length,
            pendingCount: registrations.filter((r: any) => r.matchStatus === "pending").length,
          };
        })
      );

      console.log("[Admin] eventPools with stats:", poolsWithStats);

      res.json(poolsWithStats);
    } catch (error) {
      console.error("Error fetching event pools:", error);
      res.status(500).json({ message: "Failed to fetch event pools" });
    }
  });

  // // Event Pools - Create new event pool
  app.post("/api/admin/event-pools", requireAdmin, requireOperatorOrAbove, async (req, res) => {
  try {
    const anyReq = req as any;
    const user = anyReq.user as User | undefined;
    const userIdFromReq = anyReq.userId || anyReq.adminId;
    const sessionUserId = anyReq.session?.userId;

    console.log("[EventPools] incoming create payload:", req.body);
    console.log("[EventPools] req.user =", user);
    console.log("[EventPools] req.userId / adminId =", userIdFromReq);
    console.log("[EventPools] session.userId =", sessionUserId);

    // ⚠️ 这里连 session 也一起兜底
    const createdBy =
      (user && user.id) ||
      userIdFromReq ||
      sessionUserId ||
      null;

    if (!createdBy) {
      console.error(
        "[EventPools] Missing admin user when creating event pool. Headers:",
        req.headers,
      );
      return res.status(401).json({
        message: "Unauthorized: admin user not found on request",
      });
    }

    // 校验 + 正常化
    const validatedData = insertEventPoolSchema.parse({
      ...req.body,
      createdBy,
      dateTime: new Date(req.body.dateTime),
      registrationDeadline: new Date(req.body.registrationDeadline),
    });

    console.log("[EventPools] validatedData =", validatedData);

    const [pool] = await db
      .insert(eventPools)
      .values(validatedData)
      .returning();

    console.log("[EventPools] created pool:", pool);

    // Fire-and-forget: generate AI card copy for new pool
    const { generateAndSavePoolCardCopy } = await import("./ai/workers/poolCardCopyWorker");
    generateAndSavePoolCardCopy(pool.id).catch((err: any) => {
      console.error(`[poolCardCopyWorker] Failed to generate copy for new pool ${pool.id}:`, err);
    });

    res.json(pool);
  } catch (error: any) {
    console.error("Error creating event pool:", error);
    res.status(400).json({
      message: "Failed to create event pool",
      error: error?.message,
    });
  }
});

  // Event Pools - Update event pool
  app.patch("/api/admin/event-pools/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const updates: any = { ...req.body };
      
      // Convert date strings to Date objects
      if (updates.dateTime) {
        updates.dateTime = new Date(updates.dateTime);
      }
      if (updates.registrationDeadline) {
        updates.registrationDeadline = new Date(updates.registrationDeadline);
      }
      
      updates.updatedAt = new Date();

      // ── State transition guard ────────────────────────────────────────
      // If a status change is requested, validate it against the allowed
      // transition graph before persisting anything.
      let oldStatus: string | undefined;
      if (updates.status) {
        const [currentPool] = await db
          .select({ status: eventPools.status })
          .from(eventPools)
          .where(eq(eventPools.id, req.params.id));

        if (!currentPool) {
          return res.status(404).json({ message: "Event pool not found" });
        }

        oldStatus = currentPool.status ?? undefined;

        try {
          assertValidEventPoolTransition('event_pool', oldStatus, updates.status);
        } catch (transitionErr) {
          if (transitionErr instanceof InvalidPoolTransitionError) {
            return res.status(409).json({
              message: transitionErr.message,
              code: 'INVALID_TRANSITION',
              from: oldStatus,
              to: updates.status,
            });
          }
          throw transitionErr;
        }
      }

      // Optimistic concurrency control: when status is being mutated, only
      // update the row if the status is still the value we just validated.
      const whereClause = updates.status && oldStatus
        ? and(
            eq(eventPools.id, req.params.id),
            eq(eventPools.status, oldStatus),
          )
        : eq(eventPools.id, req.params.id);

      const [pool] = await db
        .update(eventPools)
        .set(updates)
        .where(whereClause)
        .returning();
      
      if (!pool) {
        if (updates.status && oldStatus) {
          const [latestPool] = await db
            .select({ id: eventPools.id, status: eventPools.status })
            .from(eventPools)
            .where(eq(eventPools.id, req.params.id));

          if (!latestPool) {
            return res.status(404).json({ message: "Event pool not found" });
          }

          return res.status(409).json({
            message: "Event pool status changed during update. Please retry.",
            code: "STALE_STATUS",
            from: oldStatus,
            current: latestPool.status,
            to: updates.status,
          });
        }

        return res.status(404).json({ message: "Event pool not found" });
      }

      // Emit audit log when the status is mutated
      if (updates.status && updates.status !== oldStatus) {
        logAdminAudit({
          action: 'EVENT_POOL_STATUS_CHANGED',
          adminId: getActingAdminId(req),
          adminRole: (req as any).adminRole,
          targetEntityType: 'event_pool',
          targetEntityId: pool.id,
          before: { status: oldStatus },
          after: { status: pool.status },
        });
      }

      res.json(pool);
    } catch (error) {
      logger.error("Error updating event pool", { poolId: req.params.id, error: String(error) });
      res.status(500).json({ message: "Failed to update event pool" });
    }
  });

  // Event Pools - Get registrations for a pool
  app.get("/api/admin/event-pools/:id/registrations", requireAdmin, async (req, res) => {
    try {
      const registrations = await db
        .select({
          id: eventPoolRegistrations.id,
          poolId: eventPoolRegistrations.poolId,
          userId: eventPoolRegistrations.userId,
          budgetRange: eventPoolRegistrations.budgetRange,
          preferredLanguages: eventPoolRegistrations.preferredLanguages,
          eventIntent: eventPoolRegistrations.eventIntent,
          cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
          dietaryRestrictions: eventPoolRegistrations.dietaryRestrictions,
          tasteIntensity: eventPoolRegistrations.tasteIntensity,
          matchStatus: eventPoolRegistrations.matchStatus,
          assignedGroupId: eventPoolRegistrations.assignedGroupId,
          matchScore: eventPoolRegistrations.matchScore,
          registeredAt: eventPoolRegistrations.registeredAt,
          // User info
          userName: users.displayName,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
          userGender: users.gender,
          userBirthdate: users.birthdate,
          // ✅ UPDATED: Use 3-tier industry classification
          userIndustryNiche: users.industryNicheLabel,
          userIndustryCategory: users.industryCategoryLabel,
          userArchetype: users.archetype,
        })
        .from(eventPoolRegistrations)
        .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
        .where(eq(eventPoolRegistrations.poolId, req.params.id));
      
      res.json(registrations);
    } catch (error) {
      console.error("Error fetching registrations:", error);
      res.status(500).json({ message: "Failed to fetch registrations" });
    }
  });

  // Event Pools - Get groups for a pool
  app.get("/api/admin/event-pools/:id/groups", requireAdmin, async (req, res) => {
    try {
      const groups = await db.query.eventPoolGroups.findMany({
        where: (groups: any, { eq }: any) => eq(groups.poolId, req.params.id),
        orderBy: (groups: any, { asc }: any) => [asc(groups.groupNumber)],
      });
      
      // Get members for each group
      const groupsWithMembers = await Promise.all(groups.map(async (group: any) => {
        const members = await db
          .select({
            registrationId: eventPoolRegistrations.id,
            userId: eventPoolRegistrations.userId,
            userName: users.displayName,
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userGender: users.gender,
            userArchetype: users.archetype,
            // ✅ UPDATED: Use 3-tier industry classification
            userIndustryNiche: users.industryNicheLabel,
            userIndustryCategory: users.industryCategoryLabel,
            matchScore: eventPoolRegistrations.matchScore,
          })
          .from(eventPoolRegistrations)
          .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
          .where(eq(eventPoolRegistrations.assignedGroupId, group.id));
        
        return {
          ...group,
          members,
        };
      }));
      
      res.json(groupsWithMembers);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  // Event Pools - Trigger matching algorithm
  app.post("/api/admin/event-pools/:id/match", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const poolId = req.params.id;
      
      // Check if pool exists and is in active status
      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, poolId)
      });
      
      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }
      
      if (pool.status !== 'active') {
        return res.status(400).json({ message: "Pool is not in active status" });
      }
      
      // Run matching algorithm
      const groups = await matchEventPool(poolId);
      
      // Save results
      await saveMatchResults(poolId, groups);
      
      // Broadcast to admins and users
      await broadcastAdminAction(
        poolId,
        'pool_matched',
        (req.user as User).id,
        { groupCount: groups.length, totalMatched: groups.reduce((sum, g) => sum + g.members.length, 0) }
      );
      
      res.json({ 
        message: "Matching completed successfully",
        groupCount: groups.length,
        totalMatched: groups.reduce((sum, g) => sum + g.members.length, 0),
        groups: groups.map(g => ({
          memberCount: g.members.length,
          avgChemistryScore: g.avgChemistryScore,
          diversityScore: g.diversityScore,
          overallScore: g.overallScore,
        }))
      });
    } catch (error: any) {
      console.error("Error matching event pool:", error);
      res.status(500).json({ 
        message: "Failed to match event pool",
        error: error.message 
      });
    }
  });

  registerUserEventPoolRoutes(app);


  registerAdminOperationsRoutes(app);


  registerMatchingConfigRoutes(app);


  registerMatchingAdminRoutes(app);


  


  registerAIServiceRoutes(app);


  return httpServer;
}
