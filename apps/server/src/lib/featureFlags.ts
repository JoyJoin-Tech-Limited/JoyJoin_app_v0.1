import { eq } from "drizzle-orm";
import { db } from "../db";
import { featureFlags } from "@shared/schema";
import { logger } from "./logger";

/**
 * Feature flag resolver — DB-backed with env var fallback.
 *
 * Checks the `feature_flags` table first. If no row exists, falls back to
 * the corresponding env var. This lets ops toggle features at runtime
 * without redeploying.
 */

export const FLAG_ENV_MAP: Record<string, string> = {
  restartOnboarding: "RESTART_ONBOARDING_ENABLED",
  smartProfession: "SMART_PROFESSION_V1_ENABLED",
  onboardingForceSkip: "ONBOARDING_FORCE_SKIP_ENABLED",
  matchingLiveReveal: "MATCHING_LIVE_REVEAL_ENABLED",
  socialIcebreakerClientForceEnd: "SOCIAL_ICEBREAKER_CLIENT_FORCE_END",
  /** Controls BOTH the template-driven run plan compiler (server) AND the 3×3 vibe grid UX (client).
   *  When false: legacy compileAgentRunPlan() runs unchanged; client should hide vibe selector.
   *  When true: compileForSession() queries DB templates + falls back to compileAgentRunPlan();
   *            client shows the deep_chat / balanced / play_fun vibe selector. */
  runPlanTemplatesEnabled: "RUN_PLAN_TEMPLATES_ENABLED",
  personalityShareEnabled: "PERSONALITY_SHARE_ENABLED",
  personalitySlotAnimationEnabled: "PERSONALITY_SLOT_ANIMATION_ENABLED",
  /** When false, hides the Hero Promo Banner on discover entirely.
   *  Default: true. Use to A/B test banner variants or kill it during
   *  prom content audits. */
  promoBannerEnabled: "PROMO_BANNER_ENABLED",
  /** Master kill-switch for the entire payment system.
   *  When false, payment creation endpoints return 503 PAYMENTS_DISABLED.
   *  Also controls the paymentsEnabled flag in auth responses.
   *  Env fallback: PAYMENTS_ENABLED (default: false). */
  paymentsEnabled: "PAYMENTS_ENABLED",
  /** When false, falls back to a simple spinner instead of the answer-echo
   *  loading state in the personality test. Default: true. */
  personalityTestEchoEnabled: "PERSONALITY_TEST_ECHO_ENABLED",
  /** Master toggle for the drag-to-reveal ribbon on squad-unboxing.
   *  When false: falls back to the legacy "揭晓桌友" button.
   *  Default: true. */
  squadUnboxingDragRevealEnabled: "SQUAD_UNBOXING_DRAG_REVEAL_ENABLED",
  /** Master kill-switch for event pool registration.
   *  When false, POST /api/event-pools/:id/register returns 503.
   *  Env fallback: REGISTRATION_ENABLED (default: true). */
  registrationEnabled: "REGISTRATION_ENABLED",
  /** When false, creation of and tier changes to the custom Social Icebreaker
   *  mode are rejected. Existing preset-tier sessions are unaffected.
   *  Env fallback: SOCIAL_ICEBREAKER_CUSTOM_MODE_ENABLED (default: true). */
  socialIcebreakerCustomModeEnabled: "SOCIAL_ICEBREAKER_CUSTOM_MODE_ENABLED",
  /** Profile tab redesign kill-switch. When false, the mini-program renders a
   *  simplified legacy-style Profile layout without the new hero, milestones,
   *  or share-card entry point. Env fallback: PROFILE_REDESIGN_ENABLED
   *  (default: true). */
  profileRedesignEnabled: "PROFILE_REDESIGN_ENABLED",
  /** Master kill-switch for venue assignment after pool matching.
   *  When false, assignVenuesToGroups() marks all groups unassigned
   *  with reason 'feature_disabled'.
   *  Env fallback: VENUE_ASSIGNMENT_ENABLED (default: true). */
  venueAssignmentEnabled: "VENUE_ASSIGNMENT_ENABLED",
};

const cache = new Map<string, { value: boolean; ts: number }>();
const CACHE_TTL_MS = 5_000;
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

function envToBool(key: string, fallback = false): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val.toLowerCase() === "true";
}

async function fetchFromDb(flagKey: string): Promise<
  | { value: boolean; updatedAt: Date | null; updatedBy: string | null }
  | null
> {
  try {
    const [row] = await db
      .select({
        value: featureFlags.value,
        updatedAt: featureFlags.updatedAt,
        updatedBy: featureFlags.updatedBy,
      })
      .from(featureFlags)
      .where(eq(featureFlags.key, flagKey))
      .limit(1);
    if (row) {
      return {
        value: row.value.toLowerCase() === "true",
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      };
    }
  } catch (err) {
    logger.warn("[FeatureFlags] DB lookup failed, falling back to env", {
      flagKey,
      error: String(err),
    });
  }
  return null;
}

/**
 * Resolve a boolean feature flag.
 * @param flagKey — camelCase flag name (e.g. 'matchingLiveReveal')
 * @param fallback — default when DB and env are both absent
 */
export async function getFeatureFlag(
  flagKey: string,
  fallback = false,
): Promise<boolean> {
  if (!isTest) {
    const cached = cache.get(flagKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return cached.value;
    }
  }

  const dbRow = await fetchFromDb(flagKey);
  const resolved =
    dbRow !== null ? dbRow.value : envToBool(FLAG_ENV_MAP[flagKey] ?? "", fallback);

  if (!isTest) {
    cache.set(flagKey, { value: resolved, ts: Date.now() });
  }
  return resolved;
}

/**
 * Synchronous version for paths that cannot await.
 * Reads from env var only (no DB round-trip).
 */
export function getFeatureFlagSync(flagKey: string, fallback = false): boolean {
  const cached = cache.get(flagKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.value;
  }
  const resolved = envToBool(FLAG_ENV_MAP[flagKey] ?? "", fallback);
  cache.set(flagKey, { value: resolved, ts: Date.now() });
  return resolved;
}

/**
 * Refresh a single flag (useful after admin update).
 */
export async function refreshFeatureFlag(flagKey: string): Promise<boolean> {
  cache.delete(flagKey);
  return getFeatureFlag(flagKey);
}

/**
 * List all known flags with their resolved values.
 */
export async function listFeatureFlags(): Promise<
  Array<{
    key: string;
    value: boolean;
    source: "db" | "env" | "fallback";
    updatedAt: string | null;
    updatedBy: string | null;
  }>
> {
  const results: Array<{
    key: string;
    value: boolean;
    source: "db" | "env" | "fallback";
    updatedAt: string | null;
    updatedBy: string | null;
  }> = [];

  for (const [key, envKey] of Object.entries(FLAG_ENV_MAP)) {
    const dbRow = await fetchFromDb(key);
    if (dbRow !== null) {
      results.push({
        key,
        value: dbRow.value,
        source: "db",
        updatedAt: dbRow.updatedAt ? dbRow.updatedAt.toISOString() : null,
        updatedBy: dbRow.updatedBy,
      });
    } else {
      const envVal = process.env[envKey];
      results.push({
        key,
        value: envToBool(envKey),
        source: envVal !== undefined ? "env" : "fallback",
        updatedAt: null,
        updatedBy: null,
      });
    }
  }

  return results;
}
