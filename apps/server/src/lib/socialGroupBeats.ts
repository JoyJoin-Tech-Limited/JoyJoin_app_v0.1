import type { SocialGroupBeatData, SocialGroupBeatPattern, WSMessage } from "@shared/wsEvents";
import { wsService } from "../wsService";
import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";

/**
 * S6 group-synchronized beats (2026-08-12) — state-free sensory triggers for
 * the Social Icebreaker, emitted from the existing transition/reveal choke
 * points. Playbook §10 ruling 6 (LOCKED): beats carry ONLY a pattern, a
 * dedupe nonce, and a server timestamp — the 3s poll remains the sole state
 * truth, and WS failure degrades automatically to the client's poll-detected
 * beats (late, never missing). Buzz-before-picture skew is intended.
 *
 * The room key is the session's `icebreakerSessionId` — the same id the
 * client POSTed to /start and joins the room with, so emission needs no DB
 * lookup and no eventId canonicalization.
 */

/** Choke-point kinds → S1 pattern vocabulary. Config-level by design: merging
 *  or re-mapping beats is a one-record edit (§10 ruling 3 philosophy). */
export type SocialGroupBeatKind =
  | "phase_advanced"
  | "session_recap"
  | "reveal"
  | "auction_outbid"
  | "auction_all_in";

export const GROUP_BEAT_KIND_PATTERN: Record<SocialGroupBeatKind, SocialGroupBeatPattern> = {
  phase_advanced: "nudge",
  session_recap: "celebration",
  reveal: "reveal",
  // Auction V2 (sprint wave2-auctionV2, contract AC-05): kinds are server-only
  // vocabulary — the wire payload still carries ONLY pattern+nonce+sentAt, so
  // packages/shared/src/wsEvents.ts needs zero changes (contract-asserted).
  auction_outbid: "nudge",
  auction_all_in: "reveal",
};

let beatCounter = 0;

/** Build the state-free beat message (pure — unit-testable). */
export function buildSocialGroupBeatMessage(
  icebreakerSessionId: string,
  kind: SocialGroupBeatKind,
  now = Date.now(),
): WSMessage {
  beatCounter += 1;
  const data: SocialGroupBeatData = {
    sessionId: icebreakerSessionId,
    pattern: GROUP_BEAT_KIND_PATTERN[kind],
    nonce: `${icebreakerSessionId}:${now}:${beatCounter}`,
    sentAt: now,
  };
  return {
    type: "SOCIAL_GROUP_BEAT",
    eventId: icebreakerSessionId,
    data,
    timestamp: new Date(now).toISOString(),
  };
}

/**
 * Emit a group beat to the session's room. Flag-gated
 * (`icebreakerGroupBeatsEnabled`, default false) and fire-and-forget: a
 * failure here must never break the transition that triggered the beat.
 * Returns true when a beat was actually broadcast.
 */
export async function emitSocialGroupBeat(
  icebreakerSessionId: string,
  kind: SocialGroupBeatKind,
): Promise<boolean> {
  try {
    const enabled = await getFeatureFlag("icebreakerGroupBeatsEnabled", false);
    if (!enabled) return false;
    wsService.broadcastToEvent(
      icebreakerSessionId,
      buildSocialGroupBeatMessage(icebreakerSessionId, kind),
    );
    return true;
  } catch (err) {
    logger.warn("[SocialGroupBeats] emission failed", {
      icebreakerSessionId,
      kind,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ─── Auction V2 (sprint wave2-auctionV2, contract AC-05) ────────────────────

/** Same-session `auction_outbid` beats merge at ≥5s intervals: a 6-person bid
 *  war buzzes once per window, never continuously (spec D2 rate-limit). */
export const AUCTION_OUTBID_BEAT_MIN_INTERVAL_MS = 5000;

const auctionOutbidBeatLastEmitAt = new Map<string, number>();

/**
 * Rate-limited outbid beat. The timestamp is recorded synchronously BEFORE
 * the async emission so two in-flight bids in the same window cannot both
 * pass the check. Inherits the `icebreakerGroupBeatsEnabled` gate inside
 * emitSocialGroupBeat; fire-and-forget, never throws.
 */
export async function emitAuctionOutbidBeatRateLimited(
  icebreakerSessionId: string,
  now = Date.now(),
): Promise<boolean> {
  const last = auctionOutbidBeatLastEmitAt.get(icebreakerSessionId);
  if (last !== undefined && now - last < AUCTION_OUTBID_BEAT_MIN_INTERVAL_MS) {
    return false;
  }
  auctionOutbidBeatLastEmitAt.set(icebreakerSessionId, now);
  return emitSocialGroupBeat(icebreakerSessionId, "auction_outbid");
}

/** Test hook: clear rate-limit bookkeeping so cases are independent. */
export function __resetAuctionBeatRateLimitForTests(): void {
  auctionOutbidBeatLastEmitAt.clear();
}

// ─── Host nudge-incomplete (targeted, state-free) ───────────────────────────
//
// Companion to the ambient choke-point beats above: the host taps 「还差 N 人」
// and the server nudges ONLY the roster members who have not completed the
// current phase's primary submission. Same SOCIAL_GROUP_BEAT envelope, same
// `icebreakerGroupBeatsEnabled` dark-ship gate, same fire-and-forget contract
// (the 3s poll stays the sole state truth; a missed beat is never lost data).
// The gate matters here beyond dark-ship discipline: the shipped client beat
// model fires a haptic for ANY well-formed beat, so an ungated nudge would
// buzz phones before the client toast/haptic slice for this feature lands.

export interface SocialNudgeBeatContext {
  /** Machine phase id, e.g. 'lie_detective'. */
  phase: string;
  /** 当前环节名 — display copy from the shared phase registry. */
  segmentName: string;
  /** 缺员数 at tap time. */
  missingCount: number;
}

/** Build the targeted nudge beat (pure — unit-testable). */
export function buildSocialNudgeBeatMessage(
  icebreakerSessionId: string,
  context: SocialNudgeBeatContext,
  now = Date.now(),
): WSMessage {
  beatCounter += 1;
  const data: SocialGroupBeatData = {
    sessionId: icebreakerSessionId,
    pattern: "nudge",
    nonce: `${icebreakerSessionId}:${now}:${beatCounter}`,
    sentAt: now,
    nudge: {
      phase: context.phase,
      missingCount: context.missingCount,
      segmentName: context.segmentName,
    },
  };
  return {
    type: "SOCIAL_GROUP_BEAT",
    eventId: icebreakerSessionId,
    data,
    timestamp: new Date(now).toISOString(),
  };
}

/**
 * Emit a nudge beat to the given users only (never room-wide — completed
 * players stay silent). Flag-gated like emitSocialGroupBeat and
 * fire-and-forget: returns true when a broadcast actually happened, never
 * throws into the route.
 */
export async function emitSocialNudgeBeat(
  icebreakerSessionId: string,
  targetUserIds: readonly string[],
  context: SocialNudgeBeatContext,
): Promise<boolean> {
  try {
    if (targetUserIds.length === 0) return false;
    const enabled = await getFeatureFlag("icebreakerGroupBeatsEnabled", false);
    if (!enabled) return false;
    wsService.broadcastToUsers(
      [...targetUserIds],
      buildSocialNudgeBeatMessage(icebreakerSessionId, context),
    );
    return true;
  } catch (err) {
    logger.warn("[SocialGroupBeats] nudge emission failed", {
      icebreakerSessionId,
      phase: context.phase,
      targetCount: targetUserIds.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Host nudge-incomplete rate limit: one nudge per host per session per 30s. */
export const NUDGE_INCOMPLETE_MIN_INTERVAL_MS = 30_000;

const nudgeIncompleteLastNudgeAt = new Map<string, number>();

/**
 * Claim the host's nudge slot. Returns 0 when the slot was free (and records
 * the claim synchronously so two in-flight requests cannot both pass), or the
 * remaining cooldown ms when rate-limited. In-process Map: the budget is
 * PER INSTANCE — with N replicas behind a load balancer a host could fire up
 * to N nudges per window (whichever instance each request lands on). That is
 * acceptable for a sensory nudge with no state writes; if it ever becomes
 * abuse-sensitive, promote the ledger to Redis/DB like the payment claims.
 */
export function claimNudgeIncompleteSlot(
  socialSessionId: string,
  hostUserId: string,
  now = Date.now(),
): number {
  const key = `${socialSessionId}:${hostUserId}`;
  const last = nudgeIncompleteLastNudgeAt.get(key);
  if (last !== undefined && now - last < NUDGE_INCOMPLETE_MIN_INTERVAL_MS) {
    return NUDGE_INCOMPLETE_MIN_INTERVAL_MS - (now - last);
  }
  nudgeIncompleteLastNudgeAt.set(key, now);
  return 0;
}

/** Test hook: clear nudge rate-limit bookkeeping so cases are independent. */
export function __resetNudgeIncompleteRateLimitForTests(): void {
  nudgeIncompleteLastNudgeAt.clear();
}
