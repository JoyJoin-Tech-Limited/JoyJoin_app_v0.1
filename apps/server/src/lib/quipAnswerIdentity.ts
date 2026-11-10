/**
 * Opaque quip-answer identity (G0, 2026-11-10 — 24h 互选闭环 / attribution privacy).
 *
 * Problem: the pre-reveal quip-battle payload used to carry each answer's raw
 * `userId` because the vote key was `${userId}::${promptId}`. That let any
 * player correlate an anonymous answer with a real account before the host
 * revealed the round.
 *
 * Fix: every answer is votable + reportable by a stable OPAQUE id derived from
 * `sha256(sessionId + userId)` — stable across polls (so an in-flight vote map
 * keeps resolving), unlinkable to the account (no userId substring, no
 * reversible encoding), and resolvable server-side without a new table because
 * the same derivation runs over the session's own answers.
 *
 * Compatibility (the mini-program is NOT changed by this backend slice):
 *   - the client still builds its vote key from `answer.userId`, so the
 *     sanitizer substitutes the opaque token for other authors' `userId`
 *     pre-reveal — the string it sends back is therefore already opaque;
 *   - the legacy internal form `${userId}::${promptId}` and single-test bot ids
 *     remain accepted (rollout safety + older published clients).
 *
 * Server-side state and every persisted vote stay in the internal
 * `${userId}::${promptId}` form — this module only translates at the boundary.
 */

import { createHash } from "node:crypto";
import type { SocialSessionState } from "@shared/socialIcebreaker";

/** Namespace prefix — an opaque token can never be mistaken for a user id. */
export const QUIP_OPAQUE_ID_PREFIX = "q_";

const TOKEN_BYTE_LENGTH = 22;
const ANSWER_ID_SEPARATOR = "::";

/**
 * Stable per-(session, user) opaque token. Deterministic on purpose: the same
 * author keeps the same token for the whole session, so a vote submitted after
 * a poll refresh still targets the answer the player saw.
 */
export function quipAuthorToken(socialSessionId: string, userId: string): string {
  const digest = createHash("sha256")
    .update(`quip-author:v1:${socialSessionId ?? ""}:${userId}`)
    .digest("base64url");
  return `${QUIP_OPAQUE_ID_PREFIX}${digest.slice(0, TOKEN_BYTE_LENGTH)}`;
}

export function isOpaqueQuipAuthorToken(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(QUIP_OPAQUE_ID_PREFIX);
}

/** Internal vote/result key — unchanged, and never sent pre-reveal. */
export function internalQuipAnswerId(userId: string, promptId: string): string {
  return `${userId}${ANSWER_ID_SEPARATOR}${promptId}`;
}

/** Client-facing key: opaque for other authors, internal for the revealed round. */
export function publicQuipAnswerId(
  socialSessionId: string,
  userId: string,
  promptId: string,
): string {
  return `${quipAuthorToken(socialSessionId, userId)}${ANSWER_ID_SEPARATOR}${promptId}`;
}

export interface ResolvedQuipAnswerIdentity {
  userId: string;
  promptId: string;
}

type QuipAnswerIndexState = Pick<SocialSessionState, "socialSessionId"> &
  Partial<Pick<SocialSessionState, "quipBattleAnswers">>;

/**
 * Every id a client may legitimately send → the answer it points at.
 *
 * A map (not a scan per vote) because the vote route validates a full ballot in
 * one pass; duplicate internal/opaque keys cannot collide structurally (the
 * prefix keeps the two namespaces disjoint).
 */
export function buildQuipAnswerIdIndex(
  state: QuipAnswerIndexState,
): Map<string, ResolvedQuipAnswerIdentity> {
  const index = new Map<string, ResolvedQuipAnswerIdentity>();
  const socialSessionId = state.socialSessionId ?? "";

  for (const answer of state.quipBattleAnswers ?? []) {
    if (!answer?.userId || !answer?.promptId) continue;
    const identity: ResolvedQuipAnswerIdentity = {
      userId: answer.userId,
      promptId: answer.promptId,
    };
    index.set(internalQuipAnswerId(answer.userId, answer.promptId), identity);
    index.set(publicQuipAnswerId(socialSessionId, answer.userId, answer.promptId), identity);
  }

  return index;
}

/**
 * Translate one client-supplied answerId into the answer it points at.
 * Returns null for anything that is not this session's answer (the caller maps
 * that to the existing 400 `Invalid answerId`).
 */
export function resolveQuipAnswerIdentity(
  state: QuipAnswerIndexState,
  answerId: unknown,
): ResolvedQuipAnswerIdentity | null {
  if (typeof answerId !== "string" || answerId.length === 0) return null;
  return buildQuipAnswerIdIndex(state).get(answerId) ?? null;
}

/**
 * Map an opaque author token back to the real user id (UGC report `targetUserId`
 * arrives as a token because the client only ever sees the sanitized answer).
 * Returns null when the token belongs to no answer of this session; callers keep
 * the original value so a real user id still passes through unchanged.
 */
export function resolveQuipAuthorUserId(
  state: QuipAnswerIndexState,
  candidate: unknown,
): string | null {
  if (!isOpaqueQuipAuthorToken(candidate)) return null;
  const socialSessionId = state.socialSessionId ?? "";
  for (const answer of state.quipBattleAnswers ?? []) {
    if (!answer?.userId) continue;
    if (quipAuthorToken(socialSessionId, answer.userId) === candidate) {
      return answer.userId;
    }
  }
  return null;
}

/**
 * Project one internal vote key to its client-facing form. Pre-reveal the author
 * half becomes the opaque token; already-opaque + malformed values pass through
 * untouched (defensive: a persisted row from an older runtime must never throw).
 */
export function projectQuipAnswerIdForClient(
  socialSessionId: string,
  answerId: string,
): string {
  if (typeof answerId !== "string") return answerId;
  const separatorIndex = answerId.lastIndexOf(ANSWER_ID_SEPARATOR);
  if (separatorIndex <= 0) return answerId;
  const author = answerId.slice(0, separatorIndex);
  const promptId = answerId.slice(separatorIndex + ANSWER_ID_SEPARATOR.length);
  if (!author || !promptId || isOpaqueQuipAuthorToken(author)) return answerId;
  return publicQuipAnswerId(socialSessionId, author, promptId);
}
