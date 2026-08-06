import { filterContent, ViolationType } from "../contentFilter";
import { db } from "../db";
import { contentFilterLogs, users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { getFeatureFlag, getFeatureFlagSync } from "./featureFlags";
import { checkTextWithMsgSecCheck, warmWechatAccessToken, WechatRiskVerdict } from "./wechatMsgSecCheck";
import { recordViolation } from "../abuseDetection";

export interface ContentSafetyResult {
  safe: boolean;
  code?: "CONTENT_VIOLATION";
  violation?: {
    type: ViolationType;
    severity: "warning" | "severe";
    field: string;
    message: string;
    matchedKeywords: string[];
    /** Which layer flagged it: deterministic filter (tier0) or msgSecCheck (tier1). */
    source?: "tier0" | "tier1";
    /** WeChat security label for tier1 verdicts. */
    label?: number;
  };
}

export function validateContentSafe(text: string, field: string): ContentSafetyResult {
  if (!text || text.trim().length === 0) {
    return { safe: true };
  }

  const filterResult = filterContent(text);

  if (!filterResult.isViolation) {
    return { safe: true };
  }

  const violation = {
    type: filterResult.violationType!,
    severity: filterResult.severity as "warning" | "severe",
    field,
    message: filterResult.message || "内容包含不当用语，请修改后重试",
    matchedKeywords: filterResult.matchedKeywords,
    source: "tier0" as const,
  };

  // Tier-0 detection + logging are UNCONDITIONAL (the log row below is written
  // even when the warning tier is rolled back to allow-through, so the
  // emergency rollback stays observable).
  createContentViolationLog(violation, text);

  // Decision-table rows 2/3: the warning tier blocks by default but can be
  // rolled back via `contentModerationSevereFailClosedEnabled`. The severe
  // tier (row 1) is UNCONDITIONAL — no flag weakens it. Sync read (5s cache +
  // env), fail-closed fallback `true` — deliberately NOT the hardcoded `false`
  // fallback pattern used for the msgSecCheck flag.
  if (
    violation.severity === "warning" &&
    !getFeatureFlagSync("contentModerationSevereFailClosedEnabled", true)
  ) {
    // Row 3: ALLOW + log only — NO recordViolation (the route only escalates
    // when `safe === false`).
    return { safe: true };
  }

  return {
    safe: false,
    code: "CONTENT_VIOLATION",
    violation,
  };
}

export interface ContentSafetyAsyncOptions {
  userId?: string;
  openid?: string;
}

/**
 * Tier-0 + Tier-1 content gate. Runs the deterministic filter first; when the
 * text passes, optionally runs WeChat msgSecCheck (gated by the
 * `contentModerationMsgSecCheckEnabled` feature flag).
 *
 * Latency policy — the Tier-1 round-trip is bounded by a strict time budget
 * (default 250ms, env `CONTENT_MODERATION_TIER1_BUDGET_MS`). The user's
 * response is never blocked for a full WeChat API call:
 *   - verdict inside budget → violation blocks the request (route escalates)
 *   - verdict after budget / upstream error / missing openid → FAIL-OPEN: the
 *     request proceeds, and the still-running check enforces in the background
 *     (violation log + recordViolation) so nothing is silently dropped.
 *
 * Tier-1 violations are logged with source `tier1:<field>`. Escalation is
 * never double-counted: the route records only sync-returned violations; the
 * wrapper records only budget-timed-out violations detected in the background.
 */
export async function validateContentSafeAsync(
  text: string | undefined | null,
  field: string,
  opts: ContentSafetyAsyncOptions = {},
): Promise<ContentSafetyResult> {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) {
    return { safe: true };
  }

  const tier0 = validateContentSafe(trimmed, field);
  if (!tier0.safe) {
    // Row 1 (severe — unconditional) or row 2 (warning — fail-closed ON).
    return tier0;
  }

  // LOCKED control flow (content-mod-s1 Q3): Tier-1 is consulted ONLY when
  // Tier-0 is clean. A warning-tier text allowed through by the row-3
  // rollback (`contentModerationSevereFailClosedEnabled` OFF) is NOT Tier-0
  // clean — return ALLOW without consulting Tier-1.
  if (filterContent(trimmed).isViolation) {
    return { safe: true };
  }

  const tier1Enabled = await getFeatureFlag("contentModerationMsgSecCheckEnabled", false);
  if (!tier1Enabled) {
    return { safe: true };
  }

  // Warm the WeChat access token in the background so it never costs the user
  // an extra round-trip on the critical path (no-op when already cached).
  void warmWechatAccessToken();

  const checkPromise = (async (): Promise<WechatRiskVerdict | null> => {
    const openid = opts.openid ?? (opts.userId ? await resolveUserOpenid(opts.userId) : undefined);
    if (!openid) {
      logger.warn("[contentSafety] Tier-1 skipped: no openid available, failing open", { field });
      return null;
    }
    return checkTextWithMsgSecCheck(trimmed, openid);
  })();

  let verdict: WechatRiskVerdict | null = null;
  try {
    verdict = await withTier1Budget(checkPromise);
  } catch (err) {
    // Budget exhausted (or unexpected failure) — fail open now, enforce later.
    void checkPromise
      .then((lateVerdict) => {
        if (lateVerdict?.risky) {
          void enforceTier1Violation(lateVerdict, trimmed, field, opts.userId);
        }
      })
      .catch(() => {});
    logger.warn("[contentSafety] Tier-1 budget exceeded, failing open", {
      field,
      error: err instanceof Error ? err.message : String(err),
    });
    return { safe: true };
  }

  if (!verdict || !verdict.risky) {
    return { safe: true };
  }

  const violation = buildTier1Violation(verdict, field);
  createContentViolationLog(violation, trimmed, { userId: opts.userId, route: field });

  return {
    safe: false,
    code: "CONTENT_VIOLATION",
    violation,
  };
}

const DEFAULT_TIER1_BUDGET_MS = 250;

function tier1BudgetMs(): number {
  const raw = Number(process.env.CONTENT_MODERATION_TIER1_BUDGET_MS ?? DEFAULT_TIER1_BUDGET_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIER1_BUDGET_MS;
}

class Tier1BudgetExceededError extends Error {}

function withTier1Budget<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Tier1BudgetExceededError(`tier1 budget ${tier1BudgetMs()}ms`)),
      tier1BudgetMs(),
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function buildTier1Violation(
  verdict: WechatRiskVerdict,
  field: string,
): NonNullable<ContentSafetyResult["violation"]> {
  return {
    type: verdict.violationType ?? "harassment",
    severity: verdict.severity ?? "warning",
    field,
    message: "内容包含不当信息，请遵守社区规范。",
    matchedKeywords: ["msgSecCheck"],
    source: "tier1" as const,
    label: verdict.label,
  };
}

/**
 * Background enforcement for violations detected after the time budget
 * expired. Logs the attempt and escalates the user (never awaited).
 */
async function enforceTier1Violation(
  verdict: WechatRiskVerdict,
  text: string,
  field: string,
  userId?: string,
): Promise<void> {
  const violation = buildTier1Violation(verdict, field);
  createContentViolationLog(violation, text, { userId, route: field });
  if (!userId) return;
  try {
    await recordViolation(userId, violation.type, violation.severity);
  } catch (err) {
    logger.warn("[contentSafety] background Tier-1 escalation failed", { field, error: String(err) });
  }
}

async function resolveUserOpenid(userId: string): Promise<string | undefined> {
  try {
    const [row] = await db
      .select({ wechatOpenId: users.wechatOpenId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.wechatOpenId ?? undefined;
  } catch (err) {
    logger.warn("[contentSafety] openid lookup failed, failing open", { error: String(err) });
    return undefined;
  }
}

export function contentViolationResponse(
  violation: NonNullable<ContentSafetyResult["violation"]>
) {
  return {
    status: 400 as const,
    body: {
      error: violation.message,
      code: "CONTENT_VIOLATION" as const,
      violation,
    },
  };
}

export function createContentViolationLog(
  violation: NonNullable<ContentSafetyResult["violation"]>,
  rawInput?: string,
  meta?: { userId?: string; route?: string; userAgent?: string }
): void {
  // Fire-and-forget: log the blocked attempt without blocking the response
  db.insert(contentFilterLogs)
    .values({
      userId: meta?.userId ?? null,
      field: violation.field,
      violationType: violation.type,
      severity: violation.severity,
      matchedKeywords: violation.matchedKeywords,
      inputPreview: (rawInput ?? violation.message).slice(0, 200),
      source:
        violation.source === "tier1"
          ? (meta?.route ? `tier1:${meta.route}` : "tier1")
          : (meta?.route ?? null),
    })
    .execute()
    .catch((err: unknown) => {
      logger.warn("Failed to write content filter log", { error: String(err) });
    });
}

/**
 * Startup visibility for the emergency-rollback state: when
 * `contentModerationSevereFailClosedEnabled` is OFF, warning-tier violations
 * are ALLOWED through (logged, not escalated) and that state must be loud.
 * Fire-and-forget at module init; fail-closed read (fallback `true`).
 */
export function warnIfSevereFailClosedDisabled(): void {
  try {
    void Promise.resolve(getFeatureFlag("contentModerationSevereFailClosedEnabled", true))
      .then((enabled) => {
        if (!enabled) {
          logger.warn(
            "[contentSafety] contentModerationSevereFailClosedEnabled is OFF — warning-tier violations are ALLOWED (logged, not escalated); severe-tier blocking is unaffected",
          );
        }
      })
      .catch(() => {
        // Flag lookup failure is fail-closed by the `true` fallback — nothing
        // to warn about beyond the flag resolver's own log.
      });
  } catch {
    // Never let a startup check take down the process.
  }
}

warnIfSevereFailClosedDisabled();
