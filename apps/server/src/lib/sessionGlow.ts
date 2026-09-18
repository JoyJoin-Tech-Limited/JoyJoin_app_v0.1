/**
 * Wave 4 高光值 Session Glow (sprint wave4-sessionGlow, contract AC-04).
 *
 * Pure, synchronous, deterministic accumulation + derivation module.
 * ZERO LLM calls, ZERO async, ZERO imports from AI modules — the same
 * discipline as the Wave 3 sessionHighlights extractor.
 *
 * Contract anchors:
 * - AC-04: D1 point table + per-source caps + per-phase-instance idempotency
 *   (verifier N4: banked markers, NOT max-merge) + participation marks.
 * - AC-05: consumed by transitionPhase at the PRE-CLEANUP choke point —
 *   every read below assumes the just-left phase's data is still present
 *   (cleanup wipes quip/mirror/undercover/miniscript/dice/lie sources).
 * - V-1: sources that SURVIVE cleanup (auction lot results, challenge
 *   completions) carry banked-count markers in `state.glowBanked` so a
 *   bonus-gate double-fire never double-counts and an honest phase re-run
 *   still banks its newly appended entries. Wiped sources need no marker:
 *   cleanup runs in the same transitionPhase pass, so a repeated exit reads
 *   empty data and adds nothing.
 * - M2 (verifier): mini_script participation = ready OR vote OR revealed
 *   result — all three wiped by cleanup, banked pre-cleanup.
 * - V-5: "phases actually offered" = runPlan.segments else enabledPhases,
 *   intersected with the 8 full-participation source phases.
 * - M3 (verifier): exactly 3 deterministic table-line variants
 *   (hot / warm / quiet); tests pin variant count + selection determinism,
 *   never the copy strings (final copy via AC-11(a) 🔴 review).
 */

import type {
  GlowPointBreakdown,
  GlowTier,
  SocialIcebreakerPhase,
  SocialSessionState,
} from '@joyjoin/shared/socialIcebreaker';
import {
  GLOW_TABLE_LINES,
  type GlowTableLineVariant,
} from '@shared/copy/sessionGlow';

// ─── D1 累积规则表 ──────────────────────────────────────────────────────────

export type GlowSource = keyof GlowPointBreakdown;

/** The 8 full-participation source phases (spec D1). 全勤小可爱 is judged
 *  against the session's offered phases intersected with this set (V-5). */
export const GLOW_SOURCE_PHASES: readonly SocialIcebreakerPhase[] = [
  'quip_battle',
  'group_mirror',
  'auction',
  'mini_script',
  'undercover_word',
  'micro_challenge',
  'personality_dice',
  'lie_detective',
] as const;

/** Per-event points and per-person source caps (spec D1). Undercover uses a
 *  single source cap of 3: hide-success adds 3, catch-vote adds 2 — a player
 *  cannot be both in one run, and a re-run clamps deterministically at 3. */
export const GLOW_POINT_RULES: Record<GlowSource, { perEvent: number; cap: number }> = {
  quip: { perEvent: 2, cap: 8 },
  mirror: { perEvent: 2, cap: 8 },
  auction: { perEvent: 3, cap: 6 },
  miniscript: { perEvent: 3, cap: 3 },
  undercover: { perEvent: 3, cap: 3 },
  challenge: { perEvent: 2, cap: 2 },
  dice: { perEvent: 2, cap: 2 },
  lie: { perEvent: 1, cap: 1 },
} as const;

/** Undercover catch-vote event points (caught=true → 投对者, spec D1). */
export const GLOW_UNDERCOVER_CATCH_POINTS = 2;

// ─── Tier thresholds (spec D2) ──────────────────────────────────────────────

export const GLOW_TIER_WARM_MIN_TOTAL = 6;
export const GLOW_TIER_BLAZING_MIN_TOTAL = 12;

// ─── Table-line aggregate thresholds (verifier M3 — 3 variants) ─────────────

export const GLOW_TABLE_HOT_AVG_MIN = 10;
export const GLOW_TABLE_WARM_AVG_MIN = 4;

export function emptyGlowBreakdown(): GlowPointBreakdown {
  return {
    quip: 0,
    mirror: 0,
    auction: 0,
    miniscript: 0,
    undercover: 0,
    challenge: 0,
    dice: 0,
    lie: 0,
  };
}

/** Server-side only — totals NEVER leave the server as numbers (AC-09). */
export function glowTotal(breakdown: GlowPointBreakdown | undefined): number {
  if (!breakdown) return 0;
  return (
    breakdown.quip +
    breakdown.mirror +
    breakdown.auction +
    breakdown.miniscript +
    breakdown.undercover +
    breakdown.challenge +
    breakdown.dice +
    breakdown.lie
  );
}

function addGlow(
  state: SocialSessionState,
  userId: string,
  source: GlowSource,
  points: number,
  cap: number,
): void {
  if (!userId || points <= 0) return;
  state.glowPoints = state.glowPoints ?? {};
  const current = state.glowPoints[userId] ?? emptyGlowBreakdown();
  // Never reduce an existing value; clamp the SOURCE total at the cap.
  const next = Math.max(current[source], Math.min(current[source] + points, cap));
  state.glowPoints[userId] = { ...current, [source]: next };
}

function markParticipation(
  state: SocialSessionState,
  userIds: Iterable<string | null | undefined>,
  phase: SocialIcebreakerPhase,
): void {
  state.glowParticipation = state.glowParticipation ?? {};
  for (const userId of userIds) {
    if (!userId) continue;
    const marks = state.glowParticipation[userId] ?? [];
    if (!marks.includes(phase)) {
      state.glowParticipation[userId] = [...marks, phase];
    }
  }
}

/**
 * Bank the just-left phase's glow points + participation marks into state.
 * MUST be called BEFORE cleanupPhaseStateForNextPhase (contract AC-05 —
 * cleanup wipes the quip/mirror/undercover/miniscript/dice/lie sources).
 * Sync, deterministic, no awaits. Mutates `state` in place; the caller
 * dual-writes the references into preCleanupState (verifier M2 lesson).
 */
export function accumulateGlowForPhase(
  state: SocialSessionState,
  phase: SocialIcebreakerPhase,
): void {
  switch (phase) {
    case 'quip_battle': {
      // +2 per vote received (cap 8). answerId = `${userId}::${promptId}`.
      for (const vote of state.quipBattleVotes ?? []) {
        const owner = vote.answerId?.split('::')[0];
        if (owner) addGlow(state, owner, 'quip', GLOW_POINT_RULES.quip.perEvent, GLOW_POINT_RULES.quip.cap);
      }
      markParticipation(state, state.quipBattleSubmittedUserIds ?? [], phase);
      return;
    }
    case 'group_mirror': {
      // +2 per nomination received (cap 8). Votes reuse the answer shape.
      const votes = state.groupMirrorVotes ?? state.groupMirrorAnswers ?? [];
      for (const vote of votes) {
        if (vote.targetUserId) {
          addGlow(state, vote.targetUserId, 'mirror', GLOW_POINT_RULES.mirror.perEvent, GLOW_POINT_RULES.mirror.cap);
        }
      }
      markParticipation(state, state.groupMirrorSubmittedUserIds ?? [], phase);
      return;
    }
    case 'auction': {
      // +3 per lot won (cap 6). auctionLotResults SURVIVES cleanup → banked
      // marker (verifier N4): accumulate only results appended since the
      // last banking, so double-fire is a no-op and honest re-runs bank
      // their new lots. wasAllIn earns nothing extra (spec §5).
      const results = state.auctionLotResults ?? [];
      const banked = state.glowBanked?.auctionLots ?? 0;
      for (const result of results.slice(banked)) {
        if (result.winnerUserId) {
          addGlow(state, result.winnerUserId, 'auction', GLOW_POINT_RULES.auction.perEvent, GLOW_POINT_RULES.auction.cap);
        }
      }
      if (results.length > banked) {
        state.glowBanked = { ...state.glowBanked, auctionLots: results.length };
      }
      const participants = new Set<string>();
      for (const bid of state.auctionBidHistory ?? []) participants.add(bid.userId);
      for (const result of results) {
        if (result.winnerUserId) participants.add(result.winnerUserId);
      }
      markParticipation(state, participants, phase);
      return;
    }
    case 'mini_script': {
      // +3 for dual-correct (round1 + round2, cap 3). The honor line stays
      // the textual recognition — no duplicate medal (spec §5).
      for (const result of state.miniScriptRevealedPlayerResults ?? []) {
        if (result.round1Correct && result.round2Correct) {
          addGlow(state, result.userId, 'miniscript', GLOW_POINT_RULES.miniscript.perEvent, GLOW_POINT_RULES.miniscript.cap);
        }
      }
      // M2 (verifier): participation = ready OR vote OR revealed result.
      const participants = new Set<string>();
      for (const [userId, ready] of Object.entries(state.miniScriptPlayerReady ?? {})) {
        if (ready) participants.add(userId);
      }
      for (const vote of state.miniScriptVotes ?? []) participants.add(vote.userId);
      for (const result of state.miniScriptRevealedPlayerResults ?? []) participants.add(result.userId);
      markParticipation(state, participants, phase);
      return;
    }
    case 'undercover_word': {
      const result = state.undercoverWordResults;
      if (result) {
        if (!result.caught) {
          // 卧底成功隐藏 → 卧底本人 +3.
          addGlow(state, result.undercoverUserId, 'undercover', GLOW_POINT_RULES.undercover.perEvent, GLOW_POINT_RULES.undercover.cap);
        } else {
          // 抓对卧底 → 投对者各 +2.
          for (const vote of state.undercoverWordVotes ?? []) {
            if (vote.targetUserId === result.undercoverUserId) {
              addGlow(state, vote.voterId, 'undercover', GLOW_UNDERCOVER_CATCH_POINTS, GLOW_POINT_RULES.undercover.cap);
            }
          }
        }
      }
      const participants = new Set(state.undercoverWordVotedUserIds ?? []);
      if (result?.undercoverUserId) participants.add(result.undercoverUserId);
      markParticipation(state, participants, phase);
      return;
    }
    case 'micro_challenge': {
      // +2 per completion (cap 2). challengeCompletedBy SURVIVES cleanup →
      // banked marker (same discipline as auction above).
      const completed = state.challengeCompletedBy ?? [];
      const banked = state.glowBanked?.challengeCompleted ?? 0;
      for (const userId of completed.slice(banked)) {
        addGlow(state, userId, 'challenge', GLOW_POINT_RULES.challenge.perEvent, GLOW_POINT_RULES.challenge.cap);
      }
      if (completed.length > banked) {
        state.glowBanked = { ...state.glowBanked, challengeCompleted: completed.length };
      }
      markParticipation(state, completed, phase);
      return;
    }
    case 'personality_dice': {
      // +2 per completion (cap 2). diceCompletedBy is wiped on exit, so a
      // double-fire reads empty data — no marker needed.
      for (const userId of state.diceCompletedBy ?? []) {
        addGlow(state, userId, 'dice', GLOW_POINT_RULES.dice.perEvent, GLOW_POINT_RULES.dice.cap);
      }
      // Participation = completed OR honestly passed (opt-out is never
      // penalized — psychological-safety canon, spec D5).
      markParticipation(
        state,
        [...(state.diceCompletedBy ?? []), ...(state.dicePassedBy ?? [])],
        phase,
      );
      return;
    }
    case 'lie_detective': {
      // +1 for completing one's own detective turn (cap 1). Per-player
      // correctness is deliberately NOT scored — the history is
      // round-aggregate only (spec §2). lieDetectiveCompletedUserIds is
      // wiped on exit — double-fire reads empty, no marker needed.
      for (const userId of state.lieDetectiveCompletedUserIds ?? []) {
        addGlow(state, userId, 'lie', GLOW_POINT_RULES.lie.perEvent, GLOW_POINT_RULES.lie.cap);
      }
      markParticipation(state, state.lieDetectiveCompletedUserIds ?? [], phase);
      return;
    }
    default:
      // warmup / speed_friending / phase_selection / recap contribute no
      // glow sources (spec D1 table is final).
      return;
  }
}

// ─── V-5: phases actually offered (全勤小可爱 denominator) ──────────────────

export function resolveOfferedGlowPhases(state: SocialSessionState): SocialIcebreakerPhase[] {
  const offered = state.runPlan?.segments?.length
    ? state.runPlan.segments.map((segment) => segment.phase)
    : (state.enabledPhases ?? []);
  return offered.filter((phase) => GLOW_SOURCE_PHASES.includes(phase));
}

/** Honest 全勤: participated in EVERY offered full-participation phase.
 *  Returns false when no source phase was offered (no data → no medal). */
export function hasFullGlowAttendance(state: SocialSessionState, userId: string): boolean {
  const offered = resolveOfferedGlowPhases(state);
  if (offered.length === 0) return false;
  const marks = state.glowParticipation?.[userId] ?? [];
  return offered.every((phase) => marks.includes(phase));
}

// ─── Tier derivation (spec D2 — totals server-side only) ────────────────────

export function deriveGlowTier(total: number): GlowTier {
  if (total >= GLOW_TIER_BLAZING_MIN_TOTAL) return 'blazing';
  if (total >= GLOW_TIER_WARM_MIN_TOTAL) return 'warm';
  return 'ember';
}

/** Every roster member gets a tier — `ember` is the positive floor
 *  (presence alone glows, spec D2). */
export function deriveGlowTiers(
  state: SocialSessionState,
  userIds: readonly string[],
): Record<string, GlowTier> {
  const tiers: Record<string, GlowTier> = {};
  for (const userId of userIds) {
    tiers[userId] = deriveGlowTier(glowTotal(state.glowPoints?.[userId]));
  }
  return tiers;
}

// ─── Table line (verifier M3 — exactly 3 deterministic variants) ────────────

export function selectGlowTableLineVariant(
  state: SocialSessionState,
  rosterSize: number,
): GlowTableLineVariant {
  const size = Math.max(rosterSize, 1);
  let tableTotal = 0;
  for (const breakdown of Object.values(state.glowPoints ?? {})) {
    tableTotal += glowTotal(breakdown);
  }
  const average = tableTotal / size;
  if (average >= GLOW_TABLE_HOT_AVG_MIN) return 'hot';
  if (average >= GLOW_TABLE_WARM_AVG_MIN) return 'warm';
  return 'quiet';
}

/** All-zero tables resolve to the `quiet` variant — the honest empty state
 *  (spec D5: never fabricate highlights). */
export function selectGlowTableLine(state: SocialSessionState, rosterSize: number): string {
  return GLOW_TABLE_LINES[selectGlowTableLineVariant(state, rosterSize)];
}
