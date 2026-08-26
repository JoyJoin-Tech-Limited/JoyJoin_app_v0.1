import type { Express, Request } from "express";
import { z } from "zod";
import { aiEndpointLimiter } from "../../rateLimiter";
import { logger } from "../../lib/logger";
import { validateContentSafeAsync, contentViolationResponse } from "../../lib/contentSafety";
import { recordViolation } from "../../abuseDetection";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { onboardingAnalytics, userInterests, users } from "@shared/schema";
import { normalizeOptionalDuration } from "./helpers";

type DbExecutor = typeof db | any;
import { notifyOnboardingComplete } from "../../lib/wecomNotifications/onboarding";
import { computeOnboardingNextStep } from "../../lib/computeOnboardingNextStep";
import type { OnboardingNextStep } from "@shared/onboarding";

async function requireAuth(req: Request, res: any, next: any) {
  const session = req.session as any;
  if (!session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

/**
 * Onboarding analytics event allow-list (POST /api/analytics/onboarding).
 * Legacy V1-V3 names stay accepted so older clients never break; the V4
 * funnel adds per-substep step_enter and the polish events emitted by the
 * mini-program onboarding instrumentation (R1-3).
 */
const ONBOARDING_ANALYTICS_EVENT_TYPES = [
  // Legacy step lifecycle
  "step_started",
  "step_completed",
  "step_abandoned",
  "validation_failed",
  "error_occurred",
  "interaction",
  // V4 per-substep lifecycle
  "step_enter",
  // V4 polish events
  "slider_advance_blocked",
  "picker_default_adopted",
  "ceremony_advance",
  // PR-2 interaction actions (land as event_type='interaction' rows; listed
  // here so legacy/direct senders using them as eventType stay accepted too)
  "question_answered",
  "commentary_read_complete",
  "commentary_cut_short",
  "slot_animation_start",
  "skip_animation",
  "result_stage_dwell",
] as const;

const ALLOWED_ONBOARDING_EVENT_TYPES = new Set<string>(ONBOARDING_ANALYTICS_EVENT_TYPES);

const MAX_ONBOARDING_STEP_LENGTH = 120;
const MAX_ONBOARDING_SESSION_ID_LENGTH = 120;
const MAX_ONBOARDING_METADATA_BYTES = 4_096;

/**
 * Merge the client metadata object with the structured V4 payload fields
 * (stepIndex, experiment { flagKey, bucket }). Tolerant by design: anything
 * unexpected is dropped, never rejected.
 */
function buildOnboardingEventMetadata(
  metadata: unknown,
  stepIndex: unknown,
  experiment: unknown,
): Record<string, unknown> | null {
  const merged: Record<string, unknown> = {};
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    Object.assign(merged, metadata);
  }
  if (typeof stepIndex === "number" && Number.isInteger(stepIndex) && stepIndex >= 0) {
    merged.stepIndex = stepIndex;
  }
  if (experiment && typeof experiment === "object" && !Array.isArray(experiment)) {
    const { flagKey, bucket } = experiment as Record<string, unknown>;
    if (typeof flagKey === "string" && flagKey.length > 0 && typeof bucket === "string" && bucket.length > 0) {
      merged.experiment = { flagKey, bucket };
    }
  }
  if (Object.keys(merged).length === 0) {
    return null;
  }
  try {
    if (JSON.stringify(merged).length > MAX_ONBOARDING_METADATA_BYTES) {
      return null;
    }
  } catch {
    return null;
  }
  return merged;
}

function parseOnboardingTimestamp(timestamp: unknown): Date {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (typeof timestamp === "string") {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

const profileReviewCompleteBodySchema = z.object({
  bio: z.string().optional(),
});

const onboardingCheckpointBodySchema = z.object({
  step: z.enum([
    "onboarding",
    "personality-test",
    "essential-data",
    "extended-data",
    "profile-review",
    "guide",
  ]),
  timestamp: z.union([z.number(), z.string()]).optional(),
});

const onboardingAnalyticsBodySchema = z.object({
  step: z.string().max(MAX_ONBOARDING_STEP_LENGTH).optional(),
  stepId: z.string().max(MAX_ONBOARDING_STEP_LENGTH).optional(),
  stepIndex: z.number().int().min(0).optional(),
  eventType: z.string(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.union([z.number(), z.string()]).optional(),
  sessionDuration: z.number().min(0).optional(),
  stepDuration: z.number().min(0).optional(),
  duration: z.number().min(0).optional(),
  sessionId: z.string().max(MAX_ONBOARDING_SESSION_ID_LENGTH).optional(),
  experiment: z.object({
    flagKey: z.string(),
    bucket: z.string(),
  }).optional(),
  userAgent: z.string().optional(),
  screenSize: z.string().optional(),
});

export function registerOnboardingRoutes(app: Express): void {
  // Mark guide as seen (B2: Guide persistence server-side).
  // GUIDE STEP REMOVED 2026-05-07: this route remains as a backward-compat no-op
  // so older clients never break; no DB column is touched.
  app.post('/api/guide/mark-seen', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      logger.info("[Onboarding] Guide mark-seen stub called", { userId });
      res.json({ success: true });
    } catch (error) {
      logger.error("Error marking guide as seen", { error: String(error) });
      res.status(500).json({ message: "Failed to mark guide as seen" });
    }
  });

  // Alias endpoint for guide completion (matches problem statement requirement).
  // Same no-op stub as mark-seen.
  app.post('/api/guide/complete', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      logger.info("[Onboarding] Guide complete stub called", { userId });
      res.json({ success: true, hasSeenGuide: true });
    } catch (error) {
      logger.error("Error completing guide", { error: String(error) });
      res.status(500).json({ message: "Failed to complete guide" });
    }
  });

  app.post('/api/profile-review/complete', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parse = profileReviewCompleteBodySchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return res.status(400).json({ message: "请求格式不正确", field: "body" });
      }
      const bio = parse.data.bio?.trim() ?? '';

      if (bio.length > 100) {
        return res.status(400).json({ message: "一句话介绍不能超过 100 个字符", field: "bio" });
      }

      if (bio.length > 0) {
        const safetyResult = await validateContentSafeAsync(bio, "bio", { userId });
        if (!safetyResult.safe) {
          await recordViolation(userId, safetyResult.violation!.type, safetyResult.violation!.severity);
          return res.status(400).json(contentViolationResponse(safetyResult.violation!).body);
        }
      }

      const updateValues: Record<string, unknown> = {
        hasSeenProfileReview: true,
        onboardingCheckpoint: 'profile-review',
        onboardingCheckpointTimestamp: new Date(),
      };
      if (bio.length > 0) {
        updateValues.bio = bio;
      }

      const user = await db.transaction(async (tx: DbExecutor) => {
        await tx.update(users).set(updateValues).where(eq(users.id, userId));
        return tx.query.users.findFirst({
          where: eq(users.id, userId),
        });
      });

      logger.info("[Onboarding] Profile review completed", { userId, bioLength: bio.length, bioUpdated: bio.length > 0 });

      let nextStep: OnboardingNextStep | null = null;
      if (user) {
        nextStep = computeOnboardingNextStep(user);
        if (nextStep === 'discover') {
          const signupTime = user.createdAt || new Date();
          const onboardingDurationMin = Math.round(
            (Date.now() - new Date(signupTime).getTime()) / 60000,
          );

          notifyOnboardingComplete({
            user,
            onboardingDurationMin,
            referralSource: (user as any).referralSource || null,
          });
        }
      }

      res.json({ success: true, hasSeenProfileReview: true, nextStep });
    } catch (error) {
      logger.error("Error completing profile review", { error: String(error), userId: req.session.userId });
      res.status(500).json({ message: "Failed to complete profile review" });
    }
  });

  // Save onboarding checkpoint
  app.post('/api/onboarding/checkpoint', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parse = onboardingCheckpointBodySchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid checkpoint payload", errors: parse.error.format() });
      }

      const { step, timestamp } = parse.data;
      const checkpointTimestamp = timestamp ? new Date(timestamp) : new Date();

      await db.update(users).set({
        onboardingCheckpoint: step,
        onboardingCheckpointTimestamp: checkpointTimestamp,
      }).where(eq(users.id, userId));

      res.json({ success: true, checkpoint: step });
    } catch (error) {
      logger.error("Error saving checkpoint", { error: String(error), userId: req.session.userId });
      res.status(500).json({ message: "Failed to save checkpoint" });
    }
  });

  // AI profile tagline — presentation-only, no onboarding state side-effects
  app.get('/api/onboarding/profile-tagline', requireAuth, aiEndpointLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      // Fetch user and interests in parallel
      const [userRow, interestsRow] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, userId) }),
        db.query.userInterests.findFirst({ where: eq(userInterests.userId, userId) }),
      ]);

      if (!userRow) return res.status(404).json({ message: 'User not found' });

      const { generateProfileTagline } = await import('../../profileTaglineService');
      const tagline = await generateProfileTagline({
        archetype: (userRow.archetype ?? userRow.primaryArchetype) as string | undefined,
        categoryHeat: (interestsRow?.categoryHeat as Record<string, number> | null) ?? {},
        intentKeys: Array.isArray(userRow.intent) ? (userRow.intent as string[]) : [],
      });

      res.json(tagline);
    } catch (error) {
      logger.error('[profileTagline] route error', { error: String(error), userId: req.session.userId });
      res.status(500).json({ message: 'Failed to generate profile tagline' });
    }
  });

  // Phase 2: Onboarding Analytics endpoint
  app.post('/api/analytics/onboarding', async (req: Request, res) => {
    try {
      const parse = onboardingAnalyticsBodySchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return res.status(200).json({ success: false, error: 'invalid payload' });
      }

      const {
        step,
        stepId,
        stepIndex,
        eventType,
        metadata,
        timestamp,
        sessionDuration,
        stepDuration,
        duration,
        sessionId: bodySessionId,
        experiment,
        userAgent,
        screenSize,
      } = parse.data;

      // Allow-listed event types only; anything else is silently ignored so
      // analytics ingestion never 4xx's the client. Legacy V1-V3 names are
      // kept alongside the V4 per-substep + polish events.
      if (!ALLOWED_ONBOARDING_EVENT_TYPES.has(eventType)) {
        return res.status(200).json({ success: false, error: 'invalid eventType' });
      }

      // V4 clients send `stepId`; legacy clients send `step`.
      const rawStep = typeof stepId === 'string' && stepId.length > 0 ? stepId : step;
      if (typeof rawStep !== 'string' || rawStep.length === 0 || rawStep.length > MAX_ONBOARDING_STEP_LENGTH) {
        return res.status(200).json({ success: false, error: 'invalid step' });
      }

      // Get userId from session if authenticated (optional for unauthenticated tracking)
      const userId = req.session?.userId || null;

      // Anonymous session id stitched across login: the client-generated id
      // (body) wins, then the explicit header, then the express session id.
      const headerSessionId = req.headers['x-session-id'];
      const sessionId =
        (typeof bodySessionId === 'string' && bodySessionId.length > 0 && bodySessionId.length <= MAX_ONBOARDING_SESSION_ID_LENGTH
          ? bodySessionId
          : null)
        || (typeof headerSessionId === 'string' && headerSessionId.length > 0 ? headerSessionId : null)
        || req.session?.id
        || null;

      // Fix: Validate duration values are non-negative. V4 per-substep events
      // report `duration`; treat it as the step duration when stepDuration is
      // absent.
      const validSessionDuration = normalizeOptionalDuration(sessionDuration);
      const validStepDuration = normalizeOptionalDuration(stepDuration) ?? normalizeOptionalDuration(duration);

      // Tolerant metadata merge: client metadata object + stepIndex +
      // experiment { flagKey, bucket }. Unknown extra body fields are ignored.
      const normalizedMetadata = buildOnboardingEventMetadata(metadata, stepIndex, experiment);

      // Insert analytics event
      await db.insert(onboardingAnalytics).values({
        userId,
        sessionId,
        step: rawStep,
        eventType,
        timestamp: parseOnboardingTimestamp(timestamp),
        sessionDuration: validSessionDuration,
        stepDuration: validStepDuration,
        metadata: normalizedMetadata,
        userAgent: typeof userAgent === 'string' && userAgent.length > 0 ? userAgent : req.headers['user-agent'] || null,
        screenSize: typeof screenSize === 'string' && screenSize.length > 0 ? screenSize : null,
      });

      res.json({ success: true });
    } catch (error) {
      logger.warn('onboarding analytics write failed (non-fatal)', {
        request_id: req.requestId,
        error: String(error),
      });
      // Silent fail - analytics should never block user flow
      res.status(200).json({ success: false, error: 'Analytics tracking failed' });
    }
  });
}
