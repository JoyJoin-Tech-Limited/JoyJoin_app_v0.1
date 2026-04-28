import type { Express, Request } from "express";
import { z } from "zod";
import { isPhoneAuthenticated } from "../../phoneAuth";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { storage } from "../../storage";
import { db } from "../../db";
import { userInterests, connections, eventAttendance, events, users, interestsTopicsSchema } from "@shared/schema";
import * as schema from "@shared/schema";
import { eq, and, or, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { queueSemanticProfileRecompute } from "../../userSemanticProfileService";
import { normalizeProfileInterests, getInterestById, validateTelemetry } from "@shared/interests";
import { updateProfileSchema, updatePersonalitySchema, updateFullProfileSchema } from "@shared/schema";
import { logger } from "../../lib/logger";

const interestSelectionSchema = z.object({
  topicId: z.string(),
  emoji: z.string(),
  label: z.string(),
  fullName: z.string(),
  category: z.string(),
  categoryId: z.string(),
  level: z.number().int().min(1).max(3),
  heat: z.number().int().min(3).max(25),
});

const topPrioritySchema = z.object({
  topicId: z.string(),
  label: z.string(),
  heat: z.literal(25),
});

const userInterestsDataSchema = z.object({
  totalHeat: z.number().int().min(0),
  totalSelections: z.number().int().min(3),
  categoryHeat: z.record(z.string(), z.number().int().min(0)),
  selections: z.array(interestSelectionSchema).min(3),
  topPriorities: z.array(topPrioritySchema).optional(),
});

const interestSignalSchema = z.object({
  interestKey: z.string().min(1).max(100),
  discussionStyle: z.enum([
    "casual_vibes",
    "character_people",
    "plot_worldbuilding",
    "meme_humor",
    "deeper_analysis",
  ]),
  conversationDepth: z.number().int().min(1).max(3),
});

function deriveEnthusiasmFromHeat(heat: number): number {
  if (heat >= 25) return 5;
  if (heat >= 10) return 3;
  if (heat >= 5) return 2;
  return 3;
}

async function getOnboardingHeatForInterest(userId: string, interestKey: string): Promise<number> {
  const rows = await db.select().from(userInterests).where(eq(userInterests.userId, userId)).limit(1);
  if (!rows.length) return 0;
  const selections = (rows[0].selections as any[]) ?? [];
  const match = selections.find((s: any) => s.topicId === interestKey);
  return match?.heat ?? 0;
}

async function requireAuth(req: Request, res: any, next: any) {
  if (!getAuthenticatedUserId(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function registerProfileRoutes(app: Express): void {
  app.get('/api/profile/stats', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      // Calculate events completed: count completed events the user attended
      const [completedEventsResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventAttendance)
        .innerJoin(events, eq(eventAttendance.eventId, events.id))
        .where(
          and(
            eq(eventAttendance.userId, userId),
            eq(events.status, 'completed')
          )
        );

      const eventsCompleted = completedEventsResult?.count ?? 0;

      // Calculate connections made: count mutual connections where user is participant
      const [connectionsResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(connections)
        .where(
          and(
            or(
              eq(connections.userAId, userId),
              eq(connections.userBId, userId)
            ),
            eq(connections.status, 'mutual')
          )
        );

      const connectionsMade = connectionsResult?.count ?? 0;
      
      res.json({
        eventsCompleted,
        connectionsMade,
      });
    } catch (error) {
      logger.error("Error fetching profile stats:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch profile stats" });
    }
  });
  app.post('/api/profile/setup', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = updateProfileSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const user = await storage.updateProfile(userId, result.data);
      await storage.markProfileSetupComplete(userId);
      queueSemanticProfileRecompute(userId, 'profile_setup');
      
      res.json(user);
    } catch (error) {
      logger.error("Error updating profile:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
  app.post('/api/user/interests-topics', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = interestsTopicsSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Validate and normalize interest fields
      const normalized = normalizeProfileInterests({
        interestsTop: result.data.interestsTop,
        primaryInterests: result.data.primaryInterests,
        topicAvoidances: result.data.topicAvoidances,
      });

      // Log warnings for observability
      if (normalized.warnings.length > 0) {
        logger.info('Normalization warnings', { userId, warnings: normalized.warnings });
      }

      const normalizedData = {
        ...result.data,
        interestsTop: normalized.interestsTop,
        primaryInterests: normalized.primaryInterests,
        topicAvoidances: normalized.topicAvoidances,
      };

      const user = await storage.updateInterestsTopics(userId, normalizedData);
      
      res.json(user);
    } catch (error) {
      logger.error("Error updating interests and topics:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to update interests and topics" });
    }
  });
  app.post('/api/user/interests', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { interests } = req.body;

      // Validate interests is a proper object (not array, not null)
      if (typeof interests !== 'object' || Array.isArray(interests) || interests === null) {
        return res.status(400).json({ error: "Invalid interests data - must be an object" });
      }

      // Validate using Zod schema
      const validationResult = userInterestsDataSchema.safeParse(interests);
      if (!validationResult.success) {
        logger.error('Validation failed', { issues: validationResult.error.issues });
        return res.status(400).json({ 
          error: "Invalid interests data structure",
          details: process.env.NODE_ENV === 'development' ? validationResult.error.issues : undefined
        });
      }

      const { totalHeat, totalSelections, categoryHeat, selections, topPriorities } = validationResult.data;

      // Additional business logic validation
      if (totalSelections < 3) {
        return res.status(400).json({ error: "Minimum 3 selections required" });
      }

      // Use transaction to ensure atomicity - both operations succeed or both fail
      const result = await db.transaction(async (tx: NeonDatabase<typeof schema>) => {
        // Check if user already has interests
        const existing = await tx
          .select()
          .from(userInterests)
          .where(eq(userInterests.userId, userId))
          .limit(1);

        let interestRecord;

        if (existing.length > 0) {
          // Update existing record
          const [updated] = await tx
            .update(userInterests)
            .set({
              totalHeat,
              totalSelections,
              categoryHeat,
              selections,
              topPriorities: topPriorities || null,
              updatedAt: new Date(),
            })
            .where(eq(userInterests.userId, userId))
            .returning();
          interestRecord = updated;
        } else {
          // Create new record
          const [created] = await tx
            .insert(userInterests)
            .values({
              userId,
              totalHeat,
              totalSelections,
              categoryHeat,
              selections,
              topPriorities: topPriorities || null,
            })
            .returning();
          interestRecord = created;
        }

        // Update user's completion flag in same transaction
        await tx
          .update(users)
          .set({ hasCompletedInterestsCarousel: true })
          .where(eq(users.id, userId));

        return interestRecord;
      });

      queueSemanticProfileRecompute(userId, 'interests_update');

      res.json({
        success: true,
        message: "兴趣已保存",
        data: {
          interestId: result.id,
          userId: result.userId,
          totalHeat: result.totalHeat,
        },
      });
    } catch (error) {
      logger.error("Error saving user interests:", { error: error instanceof Error ? error.message : String(error) });
      const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error 
        ? error.message 
        : "Failed to save interests";
      res.status(500).json({ message: errorMessage });
    }
  });
  app.get('/api/user/interests', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;

      const result = await db
        .select()
        .from(userInterests)
        .where(eq(userInterests.userId, userId))
        .limit(1);

      if (result.length === 0) {
        return res.status(404).json({ error: "No interests found" });
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Error fetching user interests:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch interests" });
    }
  });
  app.get('/api/user/interests/summary', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;

      const result = await db
        .select({
          totalHeat: userInterests.totalHeat,
          totalSelections: userInterests.totalSelections,
          topPriorities: userInterests.topPriorities,
          categoryHeat: userInterests.categoryHeat,
        })
        .from(userInterests)
        .where(eq(userInterests.userId, userId))
        .limit(1);

      if (result.length === 0) {
        return res.status(404).json({ error: "No interests found" });
      }

      res.json(result[0]);
    } catch (error) {
      logger.error("Error fetching interest summary:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch interest summary" });
    }
  });
  app.patch('/api/user/interests/nudge', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { boostTopicIds } = req.body;

      if (!Array.isArray(boostTopicIds) || boostTopicIds.length === 0) {
        return res.status(400).json({ error: "boostTopicIds must be a non-empty array" });
      }

      // Load existing interests
      const existing = await db
        .select()
        .from(userInterests)
        .where(eq(userInterests.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "No interests found" });
      }

      // Heat values are normalized from level — single source of truth prevents aggregate drift
      const HEAT_BY_LEVEL: Record<number, number> = { 1: 3, 2: 10, 3: 25 };
      // Only boost topics already in the user's selections — nudge refines existing signals.
      // Adding new topics requires the full edit flow (/profile/edit/interests).
      let boostedCount = 0;
      const selections = (existing[0].selections as any[]).map(s => {
        // Normalize heat from level for all entries to prevent aggregate drift from stale data
        const normalizedHeat = HEAT_BY_LEVEL[s.level] ?? s.heat;
        if (boostTopicIds.includes(s.topicId) && s.level < 3) {
          const newLevel = (s.level + 1) as 1 | 2 | 3;
          boostedCount++;
          return { ...s, level: newLevel, heat: HEAT_BY_LEVEL[newLevel] };
        }
        return { ...s, heat: normalizedHeat };
      });

      // Recompute totals
      const totalHeat = selections.reduce((sum: number, s: any) => sum + s.heat, 0);
      const totalSelections = selections.length;
      const categoryHeat: Record<string, number> = {};
      selections.forEach((s: any) => {
        categoryHeat[s.categoryId] = (categoryHeat[s.categoryId] || 0) + s.heat;
      });
      const topPriorities = selections
        .filter((s: any) => s.level === 3)
        .map((s: any) => ({ topicId: s.topicId, label: s.label, heat: s.heat }));

      await db
        .update(userInterests)
        .set({ selections, totalHeat, totalSelections, categoryHeat, topPriorities, updatedAt: new Date() })
        .where(eq(userInterests.userId, userId));

      queueSemanticProfileRecompute(userId, 'interests_nudge');

      res.json({ success: true, boostedCount });
    } catch (error) {
      logger.error("Error applying interest nudge:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to apply interest nudge" });
    }
  });
  app.post('/api/user/interest-signals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = interestSignalSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const interest = getInterestById(result.data.interestKey);
      if (!interest?.active) {
        return res.status(400).json({ message: "Invalid interestKey: not found in active interest taxonomy" });
      }

      // Derive enthusiasm from onboarding data so we never duplicate the self-report
      const heat = await getOnboardingHeatForInterest(userId, result.data.interestKey);
      const enthusiasmLevel = deriveEnthusiasmFromHeat(heat);

      const signal = await storage.upsertInterestSignal(userId, {
        interestKey: result.data.interestKey,
        interestLabel: interest.label,
        enthusiasmLevel,
        discussionStyle: result.data.discussionStyle,
        conversationDepth: result.data.conversationDepth,
      });

      // Instrumentation: log completion for opt-in rate metrics
      logger.info(`[InterestSignalBoost] completed userId=${userId} interestKey=${result.data.interestKey} style=${result.data.discussionStyle} depth=${result.data.conversationDepth} derivedEnthusiasm=${enthusiasmLevel}`);

      res.json({ success: true, data: signal });
    } catch (error) {
      logger.error("Error upserting interest signal:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to save interest signal" });
    }
  });
  app.get('/api/user/interest-signals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const signals = await storage.getUserInterestSignals(userId);
      res.json({ signals });
    } catch (error) {
      logger.error("Error fetching interest signals:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to fetch interest signals" });
    }
  });
  app.post('/api/profile/personality', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = updatePersonalitySchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const user = await storage.updatePersonality(userId, result.data);
      
      res.json(user);
    } catch (error) {
      logger.error("Error updating personality:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to update personality" });
    }
  });
  app.patch('/api/profile', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = updateFullProfileSchema.safeParse(req.body);
      
      if (!result.success) {
        logger.error('Validation failed', { userId, issues: result.error.issues });
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
      // logger.info(`[Profile] Interest normalization warnings for user ${userId}:`, normalized.warnings);
      //   }
      //   profileData.interestsTop = normalized.interestsTop.length > 0 ? normalized.interestsTop : undefined;
      //   profileData.primaryInterests = normalized.primaryInterests.length > 0 ? normalized.primaryInterests : undefined;
      //   profileData.topicAvoidances = normalized.topicAvoidances.length > 0 ? normalized.topicAvoidances : undefined;
      // }

      // Validate telemetry if present
      if (profileData.interestsTelemetry) {
        const telemetryResult = validateTelemetry(profileData.interestsTelemetry);
        if (!telemetryResult.valid) {
          logger.info('Invalid telemetry', { userId, errors: telemetryResult.errors });
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
      logger.error("Error updating full profile:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to update profile" });
    }
  });
  app.post("/api/profile/update-industry", isPhoneAuthenticated, async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "未登录" });
      }
      
      const {
        category,
        categoryLabel,
        segment,
        segmentLabel,
        niche,
        nicheLabel,
        rawInput,
        normalizedInput,
        source,
        confidence,
      } = req.body;
      
      if (!category || !segment) {
        return res.status(400).json({ error: "Category and segment are required" });
      }
      
      // 构建完整路径用于显示
      const pathParts = [categoryLabel, segmentLabel, nicheLabel].filter(Boolean);
      const fullPath = pathParts.join(" > ");
      
      await db.update(users)
        .set({
          industryCategory: category,
          industryCategoryLabel: categoryLabel,
          industrySegmentNew: segment,
          industrySegmentLabel: segmentLabel,
          industryNiche: niche || null,
          industryNicheLabel: nicheLabel || null,
          industry: fullPath, // 更新legacy字段以向后兼容
          industryRawInput: rawInput,
          industryNormalized: normalizedInput || rawInput, // Use normalized or fallback to raw
          industrySource: source,
          industryConfidence: confidence?.toString(),
          industryClassifiedAt: new Date(),
          industryLastVerifiedAt: new Date(),
        })
        .where(eq(users.id, req.session.userId));
      
      res.json({ success: true, industry: fullPath });
    } catch (error: any) {
      logger.error("Update industry error:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Update failed", message: error.message });
    }
  });
  app.get('/api/personality-test/share-card-data', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      
      // Get user data for rankings
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get assessment result
      const session = await storage.getLatestCompletedAssessmentSessionByUser(userId);
      let archetype: string;
      let traitScores: Record<string, number>;

      if (session) {
        const finalResult = session.finalResult as any;
        archetype = session.primaryArchetype || finalResult?.primaryArchetype || finalResult?.archetype;
        // Use trait scores from finalResult (already normalized to 0-100 by V4 adaptive engine)
        // Fallback to top-level traitScores for legacy sessions
        traitScores = (finalResult?.traitScores || session.traitScores || {}) as Record<string, number>;
      } else {
        // Fallback to legacy role_results (already 0-100 scale)
        const legacyResult = await storage.getRoleResult(userId);
        if (!legacyResult) {
          return res.status(404).json({ message: 'No assessment result found' });
        }
        archetype = legacyResult.primaryArchetype;
        traitScores = {
          A: legacyResult.affinityScore,
          O: legacyResult.opennessScore,
          C: legacyResult.conscientiousnessScore,
          E: legacyResult.emotionalStabilityScore,
          X: legacyResult.extraversionScore,
          P: legacyResult.positivityScore,
        };
      }

      // Validate archetype exists
      if (!archetype) {
        return res.status(400).json({ message: 'No archetype found in assessment result' });
      }

      // Check for user createdAt
      if (!user.createdAt) {
        return res.status(400).json({ message: 'User account missing creation date' });
      }

      // Calculate user rankings
      const totalUserRank = await storage.calculateUserRank(user.createdAt);
      const archetypeRank = await storage.calculateArchetypeRank(userId, archetype);

      // Normalize trait scores to 0-100 scale
      // V4 finalResult.traitScores are already 0-100 (normalized by adaptive engine)
      // Top-level session.traitScores are also 0-100 (from engineState.traitConfidences)
      // Legacy role_results are expected to be 0-100; normalization also defensively handles 0-1 inputs
      const normalizeScore = (score: number | undefined): number => {
        if (score === undefined || score === null) return 50;
        // If score is a fractional value in (0, 1), treat as legacy 0-1 and convert to 0-100
        if (score > 0 && score < 1) return Math.round(score * 100);
        // Already in 0-100 range (including 0 and 1)
        return Math.round(score);
      };

      // Get archetype primary color
      const archetypePrimaryColors: Record<string, string> = {
        "fox": "#FF6B6B",
        "corgi": "#FFD93D",
        "koala": "#FFA07A",
        "spider": "#9B59B6",
        "hamster_praise": "#FF69B4",
        "rooster": "#FFA500",
        "dolphin_calm": "#4FC3F7",
        "owl": "#8B4789",
        "turtle": "#2E7D32",
        "cat": "#757575",
        "elephant": "#5C6BC0",
        "octopus": "#AB47BC"
      };

      // Get default gradients for each archetype
      const archetypeGradients: Record<string, string> = {
        'corgi': 'from-yellow-500 via-orange-500 to-red-500',
        'rooster': 'from-amber-500 via-yellow-500 to-orange-500',
        'hamster_praise': 'from-cyan-500 via-blue-500 to-indigo-500',
        'fox': 'from-orange-500 via-red-500 to-pink-500',
        'dolphin_calm': 'from-blue-500 via-indigo-500 to-purple-500',
        'spider': 'from-purple-500 via-pink-500 to-fuchsia-500',
        'koala': 'from-rose-500 via-pink-500 to-red-500',
        'octopus': 'from-violet-500 via-purple-500 to-indigo-500',
        'owl': 'from-slate-500 via-gray-500 to-zinc-500',
        'elephant': 'from-gray-500 via-slate-500 to-stone-500',
        'turtle': 'from-green-500 via-emerald-500 to-teal-500',
        'cat': 'from-indigo-500 via-purple-500 to-violet-500',
      };

      res.json({
        archetype,
        gradient: archetypeGradients[archetype] || 'from-gray-500 to-gray-600',
        primaryColor: archetypePrimaryColors[archetype] || '#9CA3AF',
        illustrationUrl: `/assets/${archetype}_transparent.png`, // Placeholder - frontend will use actual imported images
        rankings: {
          totalUserRank,
          archetypeRank,
        },
        // Trait scores are 0-100 from adaptive engine
        traitScores: {
          A: normalizeScore(traitScores.A),
          O: normalizeScore(traitScores.O),
          C: normalizeScore(traitScores.C),
          E: normalizeScore(traitScores.E),
          X: normalizeScore(traitScores.X),
          P: normalizeScore(traitScores.P),
        }
      });
    } catch (error: any) {
      logger.error('[Share Card Data] Error:', error);
      res.status(500).json({ message: 'Failed to get share card data', error: error.message });
    }
  });
}
