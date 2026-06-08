import type { Express, Request } from "express";
import { getMetricsText } from "../../middleware/metrics";
import { logger } from "../../lib/logger";
import { db } from "../../db";
import { participationExperimentEvents, discoverAnalyticsEvents, paymentRitualEvents } from "@shared/schema";
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

const paymentRitualAnalyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: "payment-ritual-analytics",
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
  "promo_banner_image_error",
  "promo_banner_image_retry",
] as const;

type DiscoverEventType = (typeof DISCOVER_EVENT_TYPES)[number];

const ALLOWED_DISCOVER_EVENT_TYPES = new Set<DiscoverEventType>(DISCOVER_EVENT_TYPES);

const AUTH_EVENT_TYPES = [
  "auth_revalidation_started",
  "auth_revalidation_succeeded",
  "auth_revalidation_failed",
  "gate_timeout",
  "gate_retry",
  "gate_dismiss",
] as const;

const PAYMENT_RITUAL_EVENT_TYPES = [
  "ritual_enter",
  "ritual_act1_complete",
  "ritual_act2_reveal",
  "ritual_archetype_shown",
  "ritual_plan_hover",
  "ritual_plan_select",
  "ritual_plan_reselect",
  "ritual_cta_tap",
  "ritual_cta_hesitation",
  "ritual_payment_start",
  "ritual_payment_success",
  "ritual_payment_error",
  "ritual_verification_enter",
  "ritual_achievement_shown",
  "ritual_emotional_score",
] as const;

type AuthEventType = (typeof AUTH_EVENT_TYPES)[number];

const ALLOWED_AUTH_EVENT_TYPES = new Set<AuthEventType>(AUTH_EVENT_TYPES);

type PaymentRitualEventType = (typeof PAYMENT_RITUAL_EVENT_TYPES)[number];

const ALLOWED_PAYMENT_RITUAL_EVENT_TYPES = new Set<PaymentRitualEventType>(
  PAYMENT_RITUAL_EVENT_TYPES,
);

const SQUAD_UNBOXING_EVENT_TYPES = [
  "squad_unboxing_reveal",
  "squad_unboxing_reveal_drag",
  "squad_unboxing_reveal_tap",
] as const;

type SquadUnboxingEventType = (typeof SQUAD_UNBOXING_EVENT_TYPES)[number];

const ALLOWED_SQUAD_UNBOXING_EVENT_TYPES = new Set<SquadUnboxingEventType>(
  SQUAD_UNBOXING_EVENT_TYPES,
);

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
   * promo_banner_cta_tap, promo_banner_image_error, promo_banner_image_retry.
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

  /**
   * POST /api/analytics/auth
   *
   * Auth revalidation and index-gate event instrumentation.
   * Tracks: auth_revalidation_started, auth_revalidation_succeeded,
   * auth_revalidation_failed, gate_timeout, gate_retry, gate_dismiss.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   * Reuses discoverAnalyticsLimiter (120 req/min).
   */
  app.post("/api/analytics/auth", discoverAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, metadata, timestamp } = req.body as {
        eventType?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_AUTH_EVENT_TYPES.has(eventType as AuthEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await db.insert(discoverAnalyticsEvents).values({
        userId,
        sessionId,
        eventType,
        poolId: null,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("auth analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });

  /**
   * POST /api/analytics/payment
   *
   * Payment Ritual V2 A/B test funnel instrumentation.
   * Tracks the full emotional journey for funnel analysis.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   */
  app.post("/api/analytics/payment", paymentRitualAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, metadata, timestamp } = req.body as {
        eventType?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_PAYMENT_RITUAL_EVENT_TYPES.has(eventType as PaymentRitualEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await db.insert(paymentRitualEvents).values({
        userId,
        sessionId,
        eventType,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("payment ritual analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });

  /**
   * POST /api/analytics/squad-unboxing
   *
   * Squad unboxing reveal interaction instrumentation.
   * Tracks: drag vs tap reveal methods, completion rates.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   * Reuses discoverAnalyticsLimiter (120 req/min).
   */
  app.post("/api/analytics/squad-unboxing", discoverAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, metadata, timestamp } = req.body as {
        eventType?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_SQUAD_UNBOXING_EVENT_TYPES.has(eventType as SquadUnboxingEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await db.insert(discoverAnalyticsEvents).values({
        userId,
        sessionId,
        eventType,
        poolId: null,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("squad unboxing analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });
}
