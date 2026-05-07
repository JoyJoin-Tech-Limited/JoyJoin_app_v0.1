import type { Express, Request } from "express";
import { aiEndpointLimiter } from "../../rateLimiter";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { onboardingAnalytics, userInterests, users } from "@shared/schema";
import { normalizeOptionalDuration } from "./helpers";

async function requireAuth(req: Request, res: any, next: any) {
  const session = req.session as any;
  if (!session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}


export function registerOnboardingRoutes(app: Express): void {
  // Mark guide as seen (B2: Guide persistence server-side)
  app.post('/api/guide/mark-seen', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      await db.update(users).set({ hasSeenGuide: true }).where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error marking guide as seen:", error);
      res.status(500).json({ message: "Failed to mark guide as seen" });
    }
  });

  // Alias endpoint for guide completion (matches problem statement requirement)
  app.post('/api/guide/complete', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      await db.update(users).set({
        hasSeenGuide: true,
        onboardingCheckpoint: 'guide',
        onboardingCheckpointTimestamp: new Date(),
      }).where(eq(users.id, userId));

      res.json({ success: true, hasSeenGuide: true });
    } catch (error) {
      console.error("Error completing guide:", error);
      res.status(500).json({ message: "Failed to complete guide" });
    }
  });

  app.post('/api/profile-review/complete', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      await db.update(users).set({
        hasSeenProfileReview: true,
        onboardingCheckpoint: 'profile-review',
        onboardingCheckpointTimestamp: new Date(),
      }).where(eq(users.id, userId));

      res.json({ success: true, hasSeenProfileReview: true });
    } catch (error) {
      console.error("Error completing profile review:", error);
      res.status(500).json({ message: "Failed to complete profile review" });
    }
  });

  // Save onboarding checkpoint
  app.post('/api/onboarding/checkpoint', requireAuth, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { step, timestamp } = req.body;
      if (!step) {
        return res.status(400).json({ message: "Step is required" });
      }

      // Validate step value
      const validSteps = ['onboarding', 'personality-test', 'essential-data', 'extended-data', 'profile-review', 'guide'];
      if (!validSteps.includes(step)) {
        return res.status(400).json({ message: "Invalid step value" });
      }

      const checkpointTimestamp = timestamp ? new Date(timestamp) : new Date();

      await db.update(users).set({
        onboardingCheckpoint: step,
        onboardingCheckpointTimestamp: checkpointTimestamp,
      }).where(eq(users.id, userId));

      res.json({ success: true, checkpoint: step });
    } catch (error) {
      console.error("Error saving checkpoint:", error);
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
      console.error('[profileTagline] route error:', error);
      res.status(500).json({ message: 'Failed to generate profile tagline' });
    }
  });

  // Phase 2: Onboarding Analytics endpoint
  app.post('/api/analytics/onboarding', async (req: Request, res) => {
    try {
      const { step, eventType, metadata, timestamp, sessionDuration, stepDuration, userAgent, screenSize } = req.body;

      // Validation
      if (!step || !eventType) {
        return res.status(400).json({ message: "Step and eventType are required" });
      }

      // Get userId from session if authenticated (optional for unauthenticated tracking)
      const userId = req.session?.userId || null;

      // Generate or use session ID
      const sessionId = req.session?.id || req.headers['x-session-id'] as string || null;

      // Fix: Validate duration values are non-negative
      const validSessionDuration = normalizeOptionalDuration(sessionDuration);
      const validStepDuration = normalizeOptionalDuration(stepDuration);

      // Insert analytics event
      await db.insert(onboardingAnalytics).values({
        userId,
        sessionId,
        step,
        eventType,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        sessionDuration: validSessionDuration,
        stepDuration: validStepDuration,
        metadata: metadata || null,
        userAgent: userAgent || req.headers['user-agent'] || null,
        screenSize: screenSize || null,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error saving analytics event:", error);
      // Silent fail - analytics should never block user flow
      res.status(200).json({ success: false, error: 'Analytics tracking failed' });
    }
  });
}
