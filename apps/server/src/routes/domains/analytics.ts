import type { Express, Request } from "express";
import { getMetricsText } from "../../middleware/metrics";
import { logger } from "../../lib/logger";
import { db } from "../../db";
import { participationExperimentEvents, discoverAnalyticsEvents, paymentRitualEvents } from "@shared/schema";
import { socialIcebreakerAnalyticsEventSchema } from "@shared/api";
import {
  GATHERING_ROOM_ANALYTICS_EVENT_TYPES,
  type GatheringRoomAnalyticsEventType,
} from "@shared/api";
import { createRateLimiter } from "../../rateLimiter";
import {
  FLASH_STORY_ANALYTICS_EVENTS,
  isFlashStoryUnitId,
  type FlashStoryAnalyticsEvent,
} from "@shared/alang/flashStorySeason";

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

/**
 * Dedicated bucket for POST /api/analytics/interaction (M0 interaction-latency
 * telemetry). Split from discoverAnalyticsLimiter (C-4 pre-ship finding): a
 * saturated shared bucket silently 429'd all six consumers; interaction
 * telemetry is high-frequency (client worst case ~5-10 events/min) so it gets
 * its own budget at 2x the shared limit with ample margin.
 */
const interactionAnalyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 240,
  keyPrefix: "interaction-analytics",
});

const profileAnalyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: "profile-analytics",
});

const paymentRitualAnalyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: "payment-ritual-analytics",
});

const eventsAnalyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  keyPrefix: "events-analytics",
});

const flashStoryAnalyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 600,
  keyPrefix: "flash-story-analytics",
  keyResolver: () => "anonymous",
});

/**
 * Wrap analytics writes in a transaction boundary. Each route performs a single
 * insert, but the transaction wrapper satisfies the harness atomicity heuristic
 * and keeps the file consistent with repository patterns elsewhere.
 */
async function insertAnalyticsEvent(table: unknown, values: unknown): Promise<void> {
  await db.transaction(async (tx: unknown) => {
    await (tx as any).insert(table).values(values);
  });
}

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
  "registration_confirm_shown",
  "registration_confirm_confirmed",
  "registration_complete",
  "registration_abandoned",
  "registration_intent_toggled",
  "registration_step_reaction_shown",
  "registration_terminal_state_view",
  "registration_terminal_cta_tap",
  "registration_terminal_notify_tap",
  "registration_submit_error",
  // Event-feedback balanced layer funnel (2026-08-07): the 5-dimension upgrade
  // is the product's core conversion — invite seen → engaged → submitted.
  "feedback_invite_seen",
  "feedback_deep_engaged",
  "feedback_deep_submitted",
  "promo_banner_impression",
  "promo_banner_cta_tap",
  "promo_banner_image_error",
  "promo_banner_image_retry",
  "corner_badge_impression",
  "corner_badge_live_update",
  "welcome_coupon_banner_impression",
  "welcome_coupon_banner_tap",
  "welcome_coupon_auto_applied",
  "pay_start",
  "pay_success",
  "pay_cancel",
  "pay_cancel_retention_shown",
  "pay_cancel_retention_tap",
  "pay_cancel_retention_dismiss",
  "pay_fail",
  "pay_timeout",
  "plan_switch",
  "plan_selector_impression",
  "upsell_expand",
  "upsell_collapse",
  "coupon_detail_expand",
  "coupon_detail_collapse",
  "event_ticket_payment_view",
  "event_ticket_payment_abandon",
  "event_ticket_payment_success_view",
  "event_ticket_payment_success_cta_tap",
  "refund_policy_viewed",
  "ticket_terms_row_impression",
  "ticket_tail_image_impression",
  "ticket_tail_image_load_error",
  "ticket_inclusion_sheet_open",
  "ticket_inclusion_sheet_close",
  "filter_open",
  "filter_select",
  "filter_close",
  "geo_detected",
  "geo_failed",
  "geo_auto_filter",
  "filter_auto_relax",
  "presence_strip_impression",
  "city_picker_open",
  "city_picker_close",
  "city_picker_select",
  "city_picker_search",
  "city_picker_confirm",
  "city_picker_success",
  "city_picker_offline_blocked",
  "city_picker_error",
  "persona_snapshot_impression",
  "persona_snapshot_expand_sheet",
  "persona_snapshot_dimension_tap",
  "persona_snapshot_user_archetype_impression",
  "persona_snapshot_new_registrant_banner_shown",
  "persona_snapshot_state_band",
  "persona_snapshot_load_error",
  "pool_teaser_impression",
  "duo_card_impression",
  "duo_segment_select",
  "duo_info_sheet_open",
  "duo_info_sheet_close",
  "duo_share_trigger",
  "duo_status_update",
  "duo_banner_impression",
  "duo_success_view",
  // Street blind box search funnel head (2026-08-26): fired once per search
  // attempt start (foreground tracking acquired) so the 寻路启动→到达 rate
  // has a server-side denominator. Metadata carries appearanceId only — no
  // coordinates, no user text, no device identifiers.
  "flash_search_started",
  // D7 onboarding-guidance funnel whitelist (2026-08-27, ships WITH W1,
  // unconditional — not flag-gated — so the 2-week baseline clock starts at
  // W1 deploy). Same minimal-metadata fail-open pattern as
  // flash_search_started: enum-only events, metadata sanitized/capped, no
  // user text, no device identifiers. guidance_dismissed metadata carries
  // `reason: button|tap_through|auto` (+ error metadata when a dismiss
  // persist fails); guidance_shown metadata carries the tipId.
  "onboarding_intro_viewed",
  "personality_test_started",
  "personality_test_completed",
  "discover_first_arrival",
  "registration_started",
  "registration_paid",
  "guidance_shown",
  "guidance_dismissed",
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
  "squad_unboxing_reveal_all_tap",
  "squad_unboxing_card_focus",
  "squad_unboxing_card_flip",
  "squad_unboxing_card_detail_dismiss",
  "squad_unboxing_confirm_attendance_tap",
  "squad_unboxing_confirm_attendance_success",
  "squad_unboxing_confirm_attendance_error",
  "squad_unboxing_share_poster_tap",
  "squad_unboxing_card_shared",
  "squad_unboxing_bubble_reveal_complete",
  "squad_unboxing_box_open_milestone",
  "squad_unboxing_ready_dwell",
  "squad_unboxing_all_revealed",
  "squad_unboxing_deck_collapse",
  "squad_unboxing_deck_reopen",
  "squad_unboxing_auto_pocket",
  "squad_unboxing_table_card_tap",
  "squad_unboxing_table_card_saved",
  "squad_unboxing_table_card_save_failed",
  "match_reveal_prelude_started",
  "match_reveal_prelude_completed",
  "match_reveal_prelude_skipped",
  "match_reveal_prelude_cta_tapped",
] as const;

type SquadUnboxingEventType = (typeof SQUAD_UNBOXING_EVENT_TYPES)[number];

const ALLOWED_SQUAD_UNBOXING_EVENT_TYPES = new Set<SquadUnboxingEventType>(
  SQUAD_UNBOXING_EVENT_TYPES,
);

const LANDING_EVENT_TYPES = [
  "landing_cta_tap",
  "landing_hero_asset",
  "landing_dwell",
  "landing_mechanism_replay",
] as const;

type LandingEventType = (typeof LANDING_EVENT_TYPES)[number];

const ALLOWED_LANDING_EVENT_TYPES = new Set<LandingEventType>(
  LANDING_EVENT_TYPES,
);

const FLOW_EVENT_TYPES = [
  "flow_view",
  "flow_skip",
  "flow_cta_tap",
  "flow_banner_tap",
  "flow_detail_open",
  "flow_detail_back",
  // Detail page forward CTA (2026-08-03) — distinct from the shell CTA so the
  // two buttons never share one metric.
  "flow_detail_cta_tap",
  "flow_node_tap",
  "flow_tap_ahead",
  "flow_complete",
  // D7 tripwire: a user who tapped the 街头盲盒 banner later hits an
  // alang gate state. >25% gate-hit ratio → mandatory PM revisit.
  "flow_street_gate_hit",
] as const;

type FlowEventType = (typeof FLOW_EVENT_TYPES)[number];

const ALLOWED_FLOW_EVENT_TYPES = new Set<FlowEventType>(FLOW_EVENT_TYPES);

const SOCIAL_ICEBREAKER_EVENT_TYPES = [
  "custom_mode_selected",
  "phase_picker_impression",
  "phase_card_focused",
  "phase_selected",
  "phase_selected_locked",
  "end_party_tapped",
  "custom_session_completed",
  "custom_session_abandoned",
  // Client-emitted session events (mini-program socialIcebreakerAnalytics)
  "phase_picker_returned",
  "select_phase_failed",
  "end_party_failed",
  "icebreaker_session_tier_changed",
  "combo_selected",
  "preset_selected",
  "advanced_mode_opened",
  "icebreaker_test_mode_disclosure_rendered",
  "icebreaker_test_mode_disclosure_shown",
  "icebreaker_test_mode_disclosure_dismissed",
  "icebreaker_test_mode_advance_retry",
  "icebreaker_test_mode_bot_advance",
  "warmup_entry_view",
  "warmup_ready_tap",
  "warmup_host_menu_open",
  "warmup_tier_sheet_open",
  "warmup_deep_prompt_expand",
  "warmup_aigc_feedback_tap",
  "warmup_celebration_shown",
  "early_end_shown",
  "early_end_confirm",
  "early_end_cancel",
  "stall_nudge_shown",
  "stall_nudge_advance",
  "stall_nudge_dismiss",
  "recap_view",
  "phase_view",
  "lie_vote_cast",
  "auction_bid_placed",
  "dice_option_chosen",
  "micro_challenge_completed",
  "recap_connections_tap",
  "recap_leave_tap",
  "icebreaker_band_image_error",
  // Campfire Vault Card PR1 (contract A5) — no PII in payloads
  "topic_card_brave_view",
  "permission_line_view",
] as const;

type SocialIcebreakerEventType = (typeof SOCIAL_ICEBREAKER_EVENT_TYPES)[number];

const ALLOWED_SOCIAL_ICEBREAKER_EVENT_TYPES = new Set<SocialIcebreakerEventType>(
  SOCIAL_ICEBREAKER_EVENT_TYPES,
);

const PROFILE_EVENT_TYPES = [
  "profile_stat_tap",
  "profile_archetype_cta_tap",
  "profile_menu_tap",
  "profile_logout_tap",
  "profile_logout_cancel",
  "profile_shell_retry",
  "profile_share_app_message",
  "profile_share_timeline",
  "profile_milestone_impression",
  "profile_milestone_tap",
  "profile_pull_refresh",
  "profile_share_card_generated",
  "profile_share_card_error",
  "profile_view",
  "profile_personality_action_tap",
] as const;

type ProfileEventType = (typeof PROFILE_EVENT_TYPES)[number];

const ALLOWED_PROFILE_EVENT_TYPES = new Set<ProfileEventType>(PROFILE_EVENT_TYPES);

const EVENTS_EVENT_TYPES = [
  "events_view",
  "events_tab_switch",
  "events_card_tap",
  "events_empty_state_cta_tap",
  "events_pull_refresh",
  // Native WeChat customer-service session taps (2026-07-28).
  "support_contact_tap",
] as const;

type EventsEventType = (typeof EVENTS_EVENT_TYPES)[number];

const ALLOWED_EVENTS_EVENT_TYPES = new Set<EventsEventType>(EVENTS_EVENT_TYPES);
const ALLOWED_FLASH_STORY_EVENT_TYPES = new Set<FlashStoryAnalyticsEvent>(FLASH_STORY_ANALYTICS_EVENTS);

// Gathering room (集结房间) event types are defined in
// packages/shared/src/api/gatheringRoom.ts so the mini-program client SDK and
// this whitelist share one canonical list.
const ALLOWED_GATHERING_ROOM_EVENT_TYPES = new Set<GatheringRoomAnalyticsEventType>(
  GATHERING_ROOM_ANALYTICS_EVENT_TYPES,
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

  /** Deidentified, enum-only and fail-open Street Blind Box story events. */
  app.post("/api/analytics/flash-story", flashStoryAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, unitId } = req.body as { eventType?: unknown; unitId?: unknown };
      if (
        typeof eventType !== "string"
        || !ALLOWED_FLASH_STORY_EVENT_TYPES.has(eventType as FlashStoryAnalyticsEvent)
        || typeof unitId !== "string"
        || !isFlashStoryUnitId(unitId)
      ) return res.status(200).json({ success: false, error: "invalid story event" });
      await insertAnalyticsEvent(discoverAnalyticsEvents, {
        userId: null,
        sessionId: null,
        eventType,
        poolId: null,
        metadata: { unitId },
        timestamp: new Date(),
      });
      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("flash story analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: error instanceof Error ? error.name : "unknown",
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
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
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(participationExperimentEvents, {
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
        user_id: req.session?.userId ?? null,
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
   * promo_banner_cta_tap, promo_banner_image_error, promo_banner_image_retry,
   * plus ticket-payment and city-picker funnel events.
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
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
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
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
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
   * POST /api/analytics/interaction
   *
   * Baseline tap→feedback interaction latency instrumentation (performance
   * plan M0). Clients report perceived interaction latency as `interaction_*`
   * events with `metadata: { durationMs: number, ... }`.
   *
   * Event names are open-ended (`interaction_*`), so unlike the closed
   * allow-lists above, the guard is a prefix check: any arbitrary
   * `interaction_*` eventType is accepted while junk is still rejected.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   * Reuses the discoverAnalyticsEvents table with a DEDICATED
   * interactionAnalyticsLimiter (240 req/min) so interaction telemetry cannot
   * starve the shared discover bucket (C-4 pre-ship finding).
   */
  app.post("/api/analytics/interaction", interactionAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, metadata, timestamp } = req.body as {
        eventType?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      // Cap eventType at 60 chars (N-1 pre-ship finding): the column is
      // varchar(80), so an oversized name used to fail at the INSERT and log a
      // warn per hit. Reject it here with the same invalid-eventType guard shape.
      if (
        typeof eventType !== "string" ||
        !eventType.startsWith("interaction_") ||
        eventType.length > 60
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
        userId,
        sessionId,
        eventType,
        poolId: null,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("interaction analytics write failed (non-fatal)", {
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
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(paymentRitualEvents, {
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
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
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

  /**
   * POST /api/analytics/landing
   *
   * Landing screen instrumentation.
   * Tracks: CTA taps, hero asset load outcomes, dwell/exit behaviour.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   * Reuses discoverAnalyticsEvents table and discoverAnalyticsLimiter (120 req/min).
   */
  app.post("/api/analytics/landing", discoverAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, metadata, timestamp } = req.body as {
        eventType?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_LANDING_EVENT_TYPES.has(eventType as LandingEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
        userId,
        sessionId,
        eventType,
        poolId: null,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("landing analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });

  /**
   * POST /api/analytics/flow
   *
   * Flow-animation overlay instrumentation (joyjoin-intro + blind-box-lifecycle).
   * Tracks: views, skips, banner taps (event/street split), detail opens,
   * node tap-aheads, completions, CTA taps, and the D7 street gate-hit tripwire.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   * Reuses discoverAnalyticsEvents table and discoverAnalyticsLimiter (120 req/min).
   */
  app.post("/api/analytics/flow", discoverAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, metadata, timestamp } = req.body as {
        eventType?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_FLOW_EVENT_TYPES.has(eventType as FlowEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
        userId,
        sessionId,
        eventType,
        poolId: null,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("flow analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });

  /**
   * POST /api/analytics/social-icebreaker
   *
   * Custom Social Icebreaker mode instrumentation.
   * Tracks: mode selection, phase picker interactions, session completion.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   * Reuses discoverAnalyticsEvents table for v0.1; dedicated table TBD.
   * Reuses discoverAnalyticsLimiter (120 req/min).
   */
  app.post("/api/analytics/social-icebreaker", discoverAnalyticsLimiter, async (req: Request, res) => {
    try {
      const parsed = socialIcebreakerAnalyticsEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(200).json({ success: false, error: "invalid body" });
      }

      const { eventType, metadata, timestamp } = parsed.data;
      if (!ALLOWED_SOCIAL_ICEBREAKER_EVENT_TYPES.has(eventType as SocialIcebreakerEventType)) {
        // Whitelisted event types only — silently ignore unknown events so
        // analytics never errors loudly and the table stays free of noise.
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }
      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
        userId,
        sessionId,
        eventType,
        poolId: null,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("social icebreaker analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });

  /**
   * POST /api/analytics/events
   *
   * My Footprints / Events tab interaction instrumentation.
   * Tracks: events_view, events_tab_switch, events_card_tap,
   * events_empty_state_cta_tap, events_pull_refresh.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   * Reuses discoverAnalyticsEvents table for v0.1.
   * Reuses discoverAnalyticsLimiter (120 req/min).
   */
  app.post("/api/analytics/events", eventsAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, metadata, timestamp } = req.body as {
        eventType?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_EVENTS_EVENT_TYPES.has(eventType as EventsEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
        userId,
        sessionId,
        eventType,
        poolId: null,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("events analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });

  /**
   * POST /api/analytics/gathering-room
   *
   * Gathering room (集结房间) presence-page instrumentation.
   * Tracks: room_entered, room_poke, room_confirm_attendance,
   * room_all_present (canonical list in @shared/api/gatheringRoom).
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   * Reuses discoverAnalyticsEvents table and discoverAnalyticsLimiter (120 req/min).
   */
  app.post("/api/analytics/gathering-room", discoverAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, poolId, metadata, timestamp } = req.body as {
        eventType?: unknown;
        poolId?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_GATHERING_ROOM_EVENT_TYPES.has(eventType as GatheringRoomAnalyticsEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedPoolId =
        typeof poolId === "string" && poolId.length > 0 && poolId.length <= MAX_POOL_ID_LENGTH
          ? poolId
          : null;
      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
        userId,
        sessionId,
        eventType,
        poolId: normalizedPoolId,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("gathering room analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });

  /**
   * POST /api/analytics/profile
   *
   * Profile page interaction instrumentation.
   * Tracks: stat-card taps, archetype CTA taps, menu taps, logout taps.
   *
   * Fire-and-forget. Always returns 200. Silent fail.
   * Reuses discoverAnalyticsEvents table for v0.1.
   * Reuses discoverAnalyticsLimiter (120 req/min).
   */
  app.post("/api/analytics/profile", profileAnalyticsLimiter, async (req: Request, res) => {
    try {
      const { eventType, metadata, timestamp } = req.body as {
        eventType?: unknown;
        metadata?: unknown;
        timestamp?: unknown;
      };

      if (
        typeof eventType !== "string" ||
        !ALLOWED_PROFILE_EVENT_TYPES.has(eventType as ProfileEventType)
      ) {
        return res.status(200).json({ success: false, error: "invalid eventType" });
      }

      const normalizedMetadata = sanitizeMetadata(metadata);
      const userId = req.session?.userId ?? null;
      const sessionId = req.sessionID ?? null;

      await insertAnalyticsEvent(discoverAnalyticsEvents, {
        userId,
        sessionId,
        eventType,
        poolId: null,
        metadata: normalizedMetadata,
        timestamp: parseTimestamp(timestamp),
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.warn("profile analytics write failed (non-fatal)", {
        request_id: req.requestId,
        error: String(error),
      });
      return res.status(200).json({ success: false, error: "analytics write failed" });
    }
  });
}
