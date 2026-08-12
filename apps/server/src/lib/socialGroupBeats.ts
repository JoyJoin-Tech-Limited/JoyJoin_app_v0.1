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
export type SocialGroupBeatKind = "phase_advanced" | "session_recap" | "reveal";

export const GROUP_BEAT_KIND_PATTERN: Record<SocialGroupBeatKind, SocialGroupBeatPattern> = {
  phase_advanced: "nudge",
  session_recap: "celebration",
  reveal: "reveal",
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
