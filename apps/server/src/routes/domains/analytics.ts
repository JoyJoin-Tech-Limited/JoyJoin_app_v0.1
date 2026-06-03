import type { Express, Request } from "express";
import { getMetricsText } from "../../middleware/metrics";
import { logger } from "../../lib/logger";
import { db } from "../../db";
import { participationExperimentEvents, discoverAnalyticsEvents } from "@shared/schema";
import { createRateLimiter } from "../../rateLimiter";

const participationAnalyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
  keyPrefix: "participation-analytics",
});

const personalityResultAnalyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 80,
  keyPrefix: "personality-result-analytics",
});

const discoverAnalyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: "discover-analytics",
});

const PARTICIPATION_EVENT_TYPES = [
  "atmosphere_framing_shown",
  "atmosphere_framing_selected",
  "goal_reframe_shown",
  "goal_reframe_primary_selected",
  "goal_reframe_secondary_added",
  "ignition_shown",
  "ignition_swipe_started",
  "ignition_swipe_completed",
  "ignition_swipe_abandoned",
  "ignition_fallback_used",
  "archetype_waiting_shown",
] as const;

type ParticipationEventType = (typeof PARTICIPATION_EVENT_TYPES)[number];

const ALLOWED_PARTICIPATION_EVENT_TYPES = new Set<ParticipationEventType>(
  PARTICIPATION_EVENT_TYPES,
);

const PERSONALITY_RESULT_EVENT_TYPES = [
  "personality_result_viewed",
  "personality_text_share_copied",
  "personality_share_variant_copied",
  "personality_poster_opened",
  "personality_native_share_used",
] as const;

type PersonalityResultEventType = (typeof PERSONALITY_RESULT_EVENT_TYPES)[number];

const ALLOWED_PERSONALITY_RESULT_EVENT_TYPES = new Set<PersonalityResultEventType>(
  PERSONALITY_RESULT_EVENT_TYPES,
);

const DISCOVER_EVENT_TYPES = [
  "pool_card_tap",
  "pool_card_impression",
  "registration_start",
  "registration_complete",
  "registration_abandoned",
  "promo_banner_impression",
  "promo_banner_cta_tap",
] as const;

type DiscoverEventType = (typeof DISCOVER_EVENT_TYPES)[number];

const ALLOWED_DISCOVER_EVENT_TYPES = new Set<DiscoverEventType>(DISCOVER_EVENT_TYPES);

const MAX_METADATA_BYTES = 4_096;
const MAX_POOL_ID_LENGTH = 120;

function sanitizeMetadata(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  try {
    const encoded = JSON.stringify(metadata);
    if (encoded.length > MAX_METADATA_BYTES) {
      return null;
    }
    return metadata as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseTimestamp(timestamp: unknown): Date {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return new Date();
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function registerAnalyticsRoutes(app: Express): void {
  // Prometheus-style metrics endpoint — internal use only.
  // Returns plain-text Prometheus exposition format for scraping.
  app.get("/api/metrics", async (req, res) => {
    try {
      const text = await getMetricsText();
      res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      res.status(200).send(text);
    } catch (error) {
      logger.error("Error generating /api/metrics", {
        request_id: req.requestId,
        error: String(error),
      });
      res.status(500).send("# Error generating metrics\n");
    }
  });

  /**
   * POST /api/analytics/participation_experiment
   *
   * Wave 2 experiment event collection. Accepts fire-and-forget events from the
   * client-side `participationExperimentAnalytics` module.
   *
   * Always returns 200 so that analytics failures never block the user flow.
   * Auth is optional: events are accepted from both authenticated and anonymous
   * sessions (anonymous events have userId = null).
   */
  app.post("/api/analytics/participation_experiment", participationAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, poolId, metadata, timestamp } = req.body as {
        eventType?: unknown;
        poolId?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_PARTICIPATION_EVENT_TYPES.has(eventType as ParticipationEventType)
      ) {
        // Silently ignore malformed events — analytics must never error loudly
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedPoolId =
        typeof poolId === "string" && poolId.length > 0 && poolId.length <= MAX_POOL_ID_LENGTH
          ? poolId
          : null;
      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await db.insert(participationExperimentEvents).values({
        userId,
        sessionId,
        eventType,
        poolId: normalizedPoolId,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("participation_experiment analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      // Silent fail — analytics must never break the user flow
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });

  /**
   * POST /api/analytics/personality_result
   *
   * Lightweight personality result instrumentation for copy/share/presenter
   * interactions. This currently logs structured events fail-open so product can
   * validate the new result-page strategy without risking the user flow.
   */
  app.post("/api/analytics/personality_result", personalityResultAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, metadata, timestamp } = req.body as {
        eventType?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_PERSONALITY_RESULT_EVENT_TYPES.has(eventType as PersonalityResultEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      logger.info("personality_result analytics", {
        request_id: req.requestId,
        user_id: req.session.userId ?? null,
        session_id: req.sessionID ?? null,
        event_type: eventType,
        metadata: sanitizeMetadata(metadata),
        timestamp: parseTimestamp(timestamp).toISOString(),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("personality_result analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });

  /**
   * POST /api/analytics/discover
   *
   * Discover page conversion funnel instrumentation.
   * Tracks: pool_card_tap, pool_card_impression, registration_start,
   * registration_complete, registration_abandoned, promo_banner_impression,
   * promo_banner_cta_tap.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   */
  app.post("/api/analytics/discover", discoverAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, poolId, metadata, timestamp } = req.body as {
        eventType?: unknown;
        poolId?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_DISCOVER_EVENT_TYPES.has(eventType as DiscoverEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedPoolId =
        typeof poolId === "string" && poolId.length > 0 && poolId.length <= MAX_POOL_ID_LENGTH
          ? poolId
          : null;
      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await db.insert(discoverAnalyticsEvents).values({
        userId,
        sessionId,
        eventType,
        poolId: normalizedPoolId,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("discover analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });
}
