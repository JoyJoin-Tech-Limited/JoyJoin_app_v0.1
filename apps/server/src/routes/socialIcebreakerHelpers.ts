import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  LieDetectivePlayer,
  SocialSessionParticipantSummary,
} from '@shared/socialIcebreaker';
import { migrateLegacySocialIcebreakerPhases, getNextEligiblePhase } from '@shared/socialIcebreaker';
import { getPhaseModule } from '@shared/phaseRegistry';
import { computeMiniScriptVoteProgress } from '@shared/miniscriptStoryFramework';
import {
  getSessionWithExpiry,
  listParticipants,
  updateSession,
  loadSessionLieTruths,
  savePhaseMetric,
} from '../lib/socialIcebreakerStore';
import { emitSocialGroupBeat } from '../lib/socialGroupBeats';
import { logger } from '../lib/logger';
import { buildArchetypeContext } from '../lib/contextInjector';
import { inferMicroChallengeEnergyArc } from '../lib/icebreakerRosterSignals';
import { isCustomMode, computeSelectablePhases, generatePhaseSelectionId } from '../services/customModeService';
import { mapBotUserIdsToBotIds, buildBotIdByUserId } from '../lib/socialIcebreakerClientIdMapper';
import { isSingleTestMode } from '../lib/isSingleTestMode';
import { curateMedals } from '../lib/medalCuration';
import { generateRecapSummary, buildLieDetectiveV2RecapData, generateMicroChallenges } from '../socialIcebreakerAIService';
import { cleanupPhaseStateForNextPhase } from '../socialIcebreakerPhaseConfig';
import { seedSingleTestBotsWarmupReady } from '../services/socialIcebreakerBotService';
import { getFeatureFlag } from '../lib/featureFlags';

function isEnabled(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

/** V2 P3: server-side delay before a presented evidence reaction becomes
 *  visible to non-presenters (mirrors the former client-side 8s constant,
 *  now enforced here so device clock skew cannot leak or withhold it). */
export const MINISCRIPT_REACTION_REVEAL_DELAY_MS = 8_000;

export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (
      (('code' in error) && (error as { code?: unknown }).code === '23505') ||
      (('cause' in error) &&
        typeof (error as { cause?: unknown }).cause === 'object' &&
        (error as { cause?: { code?: unknown } }).cause?.code === '23505') ||
      (('message' in error) &&
        typeof (error as { message?: unknown }).message === 'string' &&
        (error as { message: string }).message.includes('unique constraint'))
    )
  );
}

export function sanitizeStateForClient(
  state: SocialSessionState,
  requestingUserId?: string,
): SocialSessionState {
  const sanitized = { ...state };
  delete (sanitized as Partial<SocialSessionState>).xiaoyueAdaptiveSuggestion;
  delete (sanitized as Partial<SocialSessionState>).xiaoyueSessionPackMeta;
  // perf-W1: `expiresAt` is a server-owned sliding-TTL timestamp with zero
  // client readers (the client uses `isActive` for presence). It changes on
  // every heartbeat-driven TTL bump, so it defeated TanStack structural
  // sharing and starved the idle-poll backoff. Expiry is still enforced
  // server-side (resolveSession / getSessionWithExpiry); only the client
  // projection omits it.
  delete (sanitized as Partial<SocialSessionState>).expiresAt;
  if (requestingUserId && sanitized.hostUserId !== requestingUserId) {
    delete sanitized.miniScriptCandidateFramework;
    delete sanitized.miniScriptCandidateGeneratedAt;
    delete sanitized.miniScriptCandidateGeneratedByUserId;
  }

  // Strip server-only participant profiles + W5 interest hooks before sending
  // to clients. `interests` is AI prompt context only — never a new exposure.
  if (sanitized.joinedParticipants) {
    // perf-W1: `lastSeenAt` is a heartbeat-driven ISO timestamp with no client
    // reader (`isActive` already conveys presence). It changes ~10s while the
    // session is idle, which broke payload structural sharing and the idle-poll
    // backoff. Keep it server-side (presence queries) but omit it here.
    sanitized.joinedParticipants = sanitized.joinedParticipants.map(p => {
      const { profile: _, interests: __, lastSeenAt: ___, ...safe } = p;
      return safe;
    }) as SocialSessionParticipantSummary[];
  }

  if (sanitized.miniScriptFramework) {
    const framework = { ...sanitized.miniScriptFramework } as Record<string, unknown>;
    delete framework.clues;
    delete framework.solution;
    delete framework.playerKnowledge;
    delete framework.redHerrings;
    delete framework.deductionChain;
    if (Array.isArray(framework.characters)) {
      framework.characters = framework.characters.map((c: Record<string, unknown>) => {
        const { secret: _, ...pub } = c;
        return pub;
      });
    }

    // Defense in depth: evidenceReactions is server-only (present-evidence
    // lookup table). stripFrameworkSecrets already removes it, but state may
    // hold a framework assembled elsewhere — never let reactions leak.
    if (Array.isArray(framework.act_flow)) {
      framework.act_flow = framework.act_flow.map((act: Record<string, unknown>) => {
        if (!Array.isArray(act?.evidence)) return act;
        return {
          ...act,
          evidence: act.evidence.map((item: Record<string, unknown>) => {
            const { evidenceReactions: _reactions, ...pub } = item;
            return pub;
          }),
        };
      });
    }

    // Once the solution is revealed, restore the full resolution summary.
    // It is stripped from the framework during generation to avoid spoilers.
    if (
      sanitized.miniScriptSolutionRevealed === true &&
      sanitized.miniScriptRevealedResolutionSummary
    ) {
      const ending = (framework.ending as Record<string, unknown> | undefined) || {};
      framework.ending = {
        ...ending,
        resolutionSummary: sanitized.miniScriptRevealedResolutionSummary,
      };
    }

    if (requestingUserId && sanitized.hostUserId !== requestingUserId) {
      const assignments = sanitized.miniScriptRoleAssignments ?? {};
      const rolesAssigned = Object.keys(assignments).length > 0;
      if (!rolesAssigned) {
        // Before roles are assigned, players see only the premise placeholder
        // and the acts that have already been reached. The cast preview and
        // future acts stay host-only.
        framework.characters = [];
        framework.act_flow = Array.isArray(framework.act_flow)
          ? framework.act_flow.slice(0, sanitized.miniScriptCurrentAct ?? 0)
          : [];
        framework.premise = '剧本已生成，等待主持人分配角色。';
      }
      // Once roles are assigned, all players need the full public cast list
      // (secrets already stripped above) and the full act flow for the stepper
      // and vote-suspect chips.
    }
    sanitized.miniScriptFramework = framework as SocialSessionState['miniScriptFramework'];
  }

  if (requestingUserId && sanitized.miniScriptPlayerRuntimeViews) {
    const ownView = sanitized.miniScriptPlayerRuntimeViews[requestingUserId];
    sanitized.miniScriptPlayerRuntimeViews = ownView
      ? { [requestingUserId]: ownView }
      : {};
  }

  // V2 P3: server-owned reaction reveal gating (replaces the broken client
  // clock compare — never trust a device clock, 2026-08-13 canon). The
  // presenter always sees their own entries immediately; every other member
  // receives reactionText only once the entry is server-side ≥8s old OR the
  // presenter confirmed the read-aloud (readConfirmedAt). The field is
  // OMITTED while gated — clients treat `reactionText == null` as unrevealed.
  if (sanitized.miniScriptPresentedEvidence) {
    const now = Date.now();
    sanitized.miniScriptPresentedEvidence = sanitized.miniScriptPresentedEvidence.map((entry) => {
      if (requestingUserId && entry.presentedBy === requestingUserId) return entry;
      if (entry.readConfirmedAt !== undefined) return entry;
      if (now - entry.presentedAt >= MINISCRIPT_REACTION_REVEAL_DELAY_MS) return entry;
      const { reactionText: _gated, ...gatedEntry } = entry;
      return gatedEntry;
    });
  }

  // Mini-script structured vote progress — derived fresh on every poll so the
  // 90s quorum escape hatch evaluates against the current time. Individual
  // ballots were already visible on state before this change, so the aggregate
  // tally stays visible too (no new information exposure).
  if (sanitized.miniScriptRoleAssignments) {
    const totalAssigned = Object.keys(sanitized.miniScriptRoleAssignments).length;
    // V2 P2: progress is per round. Entries without voteRound are legacy
    // round-1 ballots, so the filter is backward compatible.
    sanitized.miniScriptVoteProgress = computeMiniScriptVoteProgress({
      votes: (sanitized.miniScriptVotes ?? []).filter((v) => (v.voteRound ?? 1) === 1),
      totalAssigned,
      voteOpenedAt: sanitized.miniScriptVoteOpenedAt,
    });
    // Round-2 (motive) progress lives in its own field, computed from
    // round-2-filtered ballots against the independent openedAt.
    if (sanitized.miniScriptMotiveVoteOpenedAt !== undefined) {
      sanitized.miniScriptMotiveVoteProgress = computeMiniScriptVoteProgress({
        votes: (sanitized.miniScriptVotes ?? []).filter((v) => v.voteRound === 2),
        totalAssigned,
        voteOpenedAt: sanitized.miniScriptMotiveVoteOpenedAt,
      });
    }
  }

  // Role-to-user mapping is secret in a social-deduction game. Non-hosts see
  // only their own slot; the host keeps the full map to manage the table.
  if (
    requestingUserId &&
    sanitized.hostUserId !== requestingUserId &&
    sanitized.miniScriptRoleAssignments
  ) {
    const ownSlot = sanitized.miniScriptRoleAssignments[requestingUserId];
    sanitized.miniScriptRoleAssignments =
      ownSlot !== undefined ? { [requestingUserId]: ownSlot } : {};
  }

  // Preserve only the requesting player's own choice plus aggregate counts.
  // The host can judge group interest without learning who voted which way.
  if (sanitized.bonusGatePlayerSentiment) {
    const sentiments = Object.values(sanitized.bonusGatePlayerSentiment);
    sanitized.bonusGateSentimentSummary = {
      wantCount: sentiments.filter((sentiment) => sentiment === 'want').length,
      passCount: sentiments.filter((sentiment) => sentiment === 'pass').length,
      responseCount: sentiments.length,
    };
    sanitized.bonusGateOwnSentiment = requestingUserId
      ? sanitized.bonusGatePlayerSentiment[requestingUserId]
      : undefined;
  }
  delete (sanitized as Partial<SocialSessionState>).bonusGatePlayerSentiment;

  // The custom-mode phase-selection nonce is host-owned; only the host can
  // act on it, so players never need it.
  if (requestingUserId && sanitized.hostUserId !== requestingUserId) {
    delete (sanitized as Partial<SocialSessionState>).phaseSelectionId;
  }

  return sanitized;
}

import type { SpeedFriendingPair, SpeedFriendingRound } from '@shared/socialIcebreaker';

export function generateSpeedFriendingPairs(
  playerIds: string[],
  displayNames: Map<string, string>,
): SpeedFriendingRound[] {
  const n = playerIds.length;
  if (n < 2) return [];

  const hasBye = n % 2 === 1;
  const ids = hasBye ? [...playerIds, '__BYE__'] : [...playerIds];
  const m = ids.length;
  const totalRounds = m - 1;
  const allRounds: SpeedFriendingRound[] = [];

  for (let r = 0; r < totalRounds; r++) {
    const roundPairs: SpeedFriendingPair[] = [];
    for (let i = 0; i < m / 2; i++) {
      const left = ids[i];
      const right = ids[m - 1 - i];
      if (left !== '__BYE__' && right !== '__BYE__') {
        roundPairs.push({
          userIdA: left,
          userIdB: right,
          displayNameA: displayNames.get(left) || left,
          displayNameB: displayNames.get(right) || right,
          roundIndex: r,
        });
      }
    }
    allRounds.push(roundPairs);
    // Circle method rotation: keep ids[0] fixed, rotate the rest right
    ids.splice(1, 0, ids.pop()!);
  }

  return allRounds;
}

export async function buildClientState(
  state: SocialSessionState,
  requestingUserId?: string,
): Promise<SocialSessionState> {
  const joinedParticipants = await listParticipants(state.socialSessionId).catch((error) => {
    logger.warn('[SocialIcebreaker] buildClientState roster unavailable; returning session state without roster', {
      socialSessionId: state.socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  });
  const archetypeCtx = buildArchetypeContext(joinedParticipants.map((p) => ({ archetype: p.archetype })));
  const withCustomExtras =
    isCustomMode(state) && requestingUserId === state.hostUserId
      ? { ...state, selectablePhases: computeSelectablePhases(state) }
      : state;
  const isTestMode = isSingleTestMode() && state.singleTest?.isTestModeSkip === true;
  const clientState = sanitizeStateForClient(
    {
      ...withCustomExtras,
      joinedParticipants,
      archetypeMixText: archetypeCtx.mixText || undefined,
      ...(isTestMode
        ? {
            isTestModeSkip: true,
            testModeBots: state.singleTest!.bots,
            runBots: state.singleTest!.runBots ?? false,
          }
        : {}),
    },
    requestingUserId,
  );

  // Mask any bot userIds in the client state before it leaves the server.
  if (isTestMode && state.singleTest?.botPersonas?.length) {
    const botIdByUserId = buildBotIdByUserId(state.singleTest.botPersonas);
    return mapBotUserIdsToBotIds(clientState, botIdByUserId);
  }

  return clientState;
}

export function hydrateDerivedState(state: SocialSessionState): SocialSessionState {
  migrateLegacySocialIcebreakerPhases(state);
  if (state.commonGroundCount === undefined) {
    state.commonGroundCount = 0;
  }
  if (!Array.isArray(state.warmupReadyUserIds)) {
    state.warmupReadyUserIds = [];
  }
  if (!Array.isArray(state.lieDetectiveCompletedUserIds)) {
    state.lieDetectiveCompletedUserIds = [];
  }
  return state;
}

export function getUniqueUserCount(userIds?: string[]): number {
  return new Set(userIds || []).size;
}

export function hasAllRosterParticipantsResponded(userIds: string[] | undefined, playerCount: number): boolean {
  return getUniqueUserCount(userIds) >= playerCount;
}

// ---------------------------------------------------------------------------
// W3 — active-presence phase guards + honest opt-out
//
// A phase's completion guard is scoped to the roster snapshot captured at phase
// entry (AC-W3.2), not `playerCount` (everyone who ever joined). That makes a
// late join mid-phase a non-event (AC-W3.4) and lets a quiet member pass their
// turn without host `force` (AC-W3.5).
//
// Required set = snapshot − departed, where departed = deliberate opt-outs
// (phaseOptOutUserIds) ∪ silent auto-completes (phaseSilentCompletedUserIds).
// Both sets are append-only for the lifetime of the phase, so guards are
// monotonic and can never regress a completed set.
// ---------------------------------------------------------------------------

/** Default silence window before a non-responding roster member is auto-completed. */
export const SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS_DEFAULT = 180_000;

/**
 * Minimum required participants for a full-participation phase to stay
 * interactive.
 *
 * Intended end condition (W3 quorum floor): when the snapshot minus departed
 * members drops below this floor — including the empty set when everyone has
 * left — the phase is DONE, not blocked. Interactive reveals that need at least
 * one *other* participant (e.g. lie_detective's `otherPlayerCount > 0`) can
 * never fire below the floor, so guards report the phase complete and the host
 * advances instead of the session deadlocking.
 */
export const MIN_FULL_PHASE_QUORUM = 2;

/** Read the silence timeout (positive integer ms) from env; default 180000. */
export function getSilentPlayerTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS;
  if (!raw) return SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS_DEFAULT;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : SOCIAL_ICEBREAKER_SILENT_PLAYER_TIMEOUT_MS_DEFAULT;
}

/**
 * Snapshot the participation scope for a full-participation phase.
 *
 * Only recently-active participants are captured, so a member who already left
 * the table is not re-required in every subsequent phase (W3 finding 3). When
 * nobody is currently active — a brief heartbeat gap exactly at the phase
 * boundary — fall back to the full roster rather than snapshotting an empty
 * scope, which would make every guard trivially complete.
 */
export function buildPhaseRosterSnapshot(
  roster: SocialSessionParticipantSummary[],
): string[] {
  const active = roster.filter((participant) => participant.isActive).map((p) => p.userId);
  return active.length > 0 ? active : roster.map((p) => p.userId);
}

/** Snapshot members excluded from the required set (opt-out or silent). */
export function getPhaseDepartedUserIds(state: SocialSessionState): string[] {
  return [
    ...new Set([
      ...(state.phaseOptOutUserIds ?? []),
      ...(state.phaseSilentCompletedUserIds ?? []),
    ]),
  ];
}

/**
 * userIds that must take part in the current phase. Empty when the session
 * predates the roster snapshot — callers then fall back to `playerCount`.
 */
export function getPhaseRequiredRosterIds(state: SocialSessionState): string[] {
  const snapshot = state.phaseRosterSnapshot?.length
    ? [...new Set(state.phaseRosterSnapshot)]
    : undefined;
  if (!snapshot) return [];
  const departed = new Set(getPhaseDepartedUserIds(state));
  return snapshot.filter((userId) => !departed.has(userId));
}

/** Required participant count for the current phase (snapshot-aware, min 1). */
export function getPhaseRequiredPlayerCount(state: SocialSessionState): number {
  if (!state.phaseRosterSnapshot?.length) return state.playerCount;
  return Math.max(getPhaseRequiredRosterIds(state).length, 1);
}

export interface PhasePresenceGuardInput {
  rosterSnapshot?: string[];
  /** Snapshot members excluded from the required set (opt-out / silent). */
  departedUserIds?: string[];
  completedUserIds?: string[];
  /**
   * userIds whose heartbeat is inside the presence threshold. Undefined means
   * "assume everyone is present" so a synchronous caller never auto-completes
   * anyone (silence is only inferred when presence is actually known).
   */
  activeUserIds?: ReadonlySet<string>;
  phaseStartedAt: number;
  now: number;
  timeoutMs: number;
  /** Legacy fallback when the session has no roster snapshot. */
  fallbackPlayerCount?: number;
}

export interface PhasePresenceGuardResult {
  complete: boolean;
  /** Required members not complete and currently absent past the timeout. */
  silentUserIds: string[];
  requiredUserIds: string[];
  completedCount: number;
  requiredCount: number;
}

/**
 * Pure presence-guard evaluation. When `rosterSnapshot` exists the guard only
 * cares about snapshot members; when it is absent (legacy sessions) it keeps
 * the historical `completed >= playerCount` semantics.
 *
 * A required member is auto-completable only once the phase has been running
 * for at least `timeoutMs` AND they are not currently active. Undefined
 * `activeUserIds` disables auto-complete entirely.
 */
export function evaluatePhasePresenceGuard(
  input: PhasePresenceGuardInput,
): PhasePresenceGuardResult {
  const completed = new Set(input.completedUserIds ?? []);
  const snapshot = input.rosterSnapshot?.length
    ? [...new Set(input.rosterSnapshot)]
    : undefined;

  if (!snapshot) {
    const total = input.fallbackPlayerCount ?? 0;
    return {
      complete: completed.size >= total,
      silentUserIds: [],
      requiredUserIds: [],
      completedCount: completed.size,
      requiredCount: total,
    };
  }

  const departed = new Set(input.departedUserIds ?? []);
  const required = snapshot.filter((userId) => !departed.has(userId));
  // Quorum floor: below the minimum required members the phase is structurally
  // complete (nothing meaningful left to wait for), never a deadlock.
  if (required.length < MIN_FULL_PHASE_QUORUM) {
    return {
      complete: true,
      silentUserIds: [],
      requiredUserIds: required,
      completedCount: completed.size,
      requiredCount: required.length,
    };
  }
  const canAutoComplete = input.now - input.phaseStartedAt >= input.timeoutMs;
  const activeUserIds = input.activeUserIds;
  const silentUserIds =
    canAutoComplete && activeUserIds !== undefined
      ? required.filter(
          (userId) => !completed.has(userId) && !activeUserIds.has(userId),
        )
      : [];
  const effective = new Set([...completed, ...silentUserIds]);

  return {
    complete: required.every((userId) => effective.has(userId)),
    silentUserIds,
    requiredUserIds: required,
    completedCount: effective.size,
    requiredCount: required.length,
  };
}

/**
 * SINGLE SOURCE OF TRUTH for the persisted completion arrays each phase's
 * participation marker (opt-out / silent auto-complete) must write.
 *
 * Most phases complete in one stage. `quip_battle` completes in TWO ordered
 * stages — submit answers, then vote — and its reveal gates BOTH arrays; a
 * marker that only touched the vote array left a submit-stage opt-out stuck at
 * "everyone must submit" forever (W3 review BLOCKER). Marking every listed
 * array keeps the two gates in lockstep.
 *
 * Client mirror (read-only, mini-program — keep in sync):
 *   apps/mini-program/src/pages/icebreaker-session/viewModels/phaseOptOutModel.ts
 *   `getPhaseCompletionUserIds` returns the primary array (see below) for the
 *   ready/complete counter; it does not need the secondary stage to render.
 */
type PhaseCompletionField =
  | 'challengeCompletedBy'
  | 'lieDetectiveCompletedUserIds'
  | 'warmupReadyUserIds'
  | 'quipBattleSubmittedUserIds'
  | 'quipBattleVotedUserIds'
  | 'groupMirrorSubmittedUserIds'
  | 'undercoverWordVotedUserIds';

const PHASE_COMPLETION_FIELDS: Partial<
  Record<SocialIcebreakerPhase, readonly PhaseCompletionField[]>
> = {
  micro_challenge: ['challengeCompletedBy'],
  lie_detective: ['lieDetectiveCompletedUserIds'],
  warmup: ['warmupReadyUserIds'],
  quip_battle: ['quipBattleSubmittedUserIds', 'quipBattleVotedUserIds'],
  group_mirror: ['groupMirrorSubmittedUserIds'],
  undercover_word: ['undercoverWordVotedUserIds'],
};

/**
 * Primary array a phase's ready/complete counter reads. `quip_battle` reads the
 * vote stage (the later of its two stages), matching the client mirror.
 */
const PHASE_PRIMARY_COMPLETION_FIELD: Partial<Record<SocialIcebreakerPhase, PhaseCompletionField>> = {
  micro_challenge: 'challengeCompletedBy',
  lie_detective: 'lieDetectiveCompletedUserIds',
  warmup: 'warmupReadyUserIds',
  quip_battle: 'quipBattleVotedUserIds',
  group_mirror: 'groupMirrorSubmittedUserIds',
  undercover_word: 'undercoverWordVotedUserIds',
};

function readPhaseCompletionField(
  state: SocialSessionState,
  field: PhaseCompletionField,
): string[] {
  return ((state as unknown as Record<string, unknown>)[field] as string[] | undefined) ?? [];
}

function writePhaseCompletionField(
  state: SocialSessionState,
  field: PhaseCompletionField,
  userIds: string[],
): void {
  (state as unknown as Record<string, unknown>)[field] = userIds;
}

/** Map a phase to its primary persisted completion array (undefined when none). */
export function getPhaseCompletionUserIds(
  state: SocialSessionState,
  phase: SocialIcebreakerPhase,
): string[] | undefined {
  const field = PHASE_PRIMARY_COMPLETION_FIELD[phase];
  return field ? readPhaseCompletionField(state, field) : undefined;
}

/**
 * Append `userIds` to EVERY persisted completion array owned by the phase
 * (idempotent). No-op when the phase has no completion array — the caller's
 * `phaseOptOutUserIds` / `phaseSilentCompletedUserIds` marker still removes them
 * from the required set.
 */
export function markPhaseParticipationUserIdsComplete(
  state: SocialSessionState,
  phase: SocialIcebreakerPhase,
  userIds: readonly string[],
): void {
  const fields = PHASE_COMPLETION_FIELDS[phase];
  if (!fields?.length || userIds.length === 0) return;
  for (const field of fields) {
    const merged = [...new Set([...readPhaseCompletionField(state, field), ...userIds])];
    writePhaseCompletionField(state, field, merged);
  }
}

/**
 * Mark a player complete for the phase's persisted completion array(s) (used by
 * the honest opt-out route).
 */
export function markPhaseParticipationComplete(
  state: SocialSessionState,
  phase: SocialIcebreakerPhase,
  userId: string,
): void {
  markPhaseParticipationUserIdsComplete(state, phase, [userId]);
}

/**
 * Whether the current phase still has the minimum required participants to run
 * its interactive reveal. Legacy sessions without a snapshot keep the
 * `playerCount` fallback (always true). See `MIN_FULL_PHASE_QUORUM`.
 */
export function hasFullPhaseQuorum(state: SocialSessionState): boolean {
  if (!state.phaseRosterSnapshot?.length) return true;
  return getPhaseRequiredRosterIds(state).length >= MIN_FULL_PHASE_QUORUM;
}

/**
 * Synchronous snapshot-scoped completion check. Safe for readiness reporting —
 * it never auto-completes anyone (presence is unknown), it only honours the
 * opt-out / prior silent-complete markers.
 */
export function isPhaseRosterComplete(
  state: SocialSessionState,
  completedUserIds: string[] | undefined,
): boolean {
  return evaluatePhasePresenceGuard({
    rosterSnapshot: state.phaseRosterSnapshot,
    departedUserIds: getPhaseDepartedUserIds(state),
    completedUserIds,
    phaseStartedAt: state.phaseStartedAt,
    now: Date.now(),
    timeoutMs: getSilentPlayerTimeoutMs(),
    fallbackPlayerCount: state.playerCount,
  }).complete;
}

export interface ReconcilePhasePresenceOptions {
  now?: number;
  timeoutMs?: number;
  /** Presence set; undefined triggers a roster lookup (tests may inject). */
  activeUserIds?: Set<string> | undefined;
  /** Persist silent auto-completes through the store. Default true. */
  persist?: boolean;
}

export interface ReconcilePhasePresenceResult extends PhasePresenceGuardResult {
  autoCompletedUserIds: string[];
}

/**
 * Evaluate the presence guard for the current phase and persist any silent
 * members as complete. Idempotent: completed or already-auto-completed members
 * are never re-added. Centralized so every phase shares one rule.
 */
export async function reconcilePhasePresence(
  state: SocialSessionState,
  socialSessionId: string,
  options: ReconcilePhasePresenceOptions = {},
): Promise<ReconcilePhasePresenceResult> {
  const completed = getPhaseCompletionUserIds(state, state.currentPhase);
  const now = options.now ?? Date.now();
  const timeoutMs = options.timeoutMs ?? getSilentPlayerTimeoutMs();

  let activeUserIds = options.activeUserIds;
  if (activeUserIds === undefined) {
    try {
      const roster = await listParticipants(socialSessionId);
      activeUserIds = new Set(
        roster.filter((participant) => participant.isActive).map((participant) => participant.userId),
      );
    } catch (error) {
      logger.warn('[SocialIcebreaker] presence lookup failed; skipping silent auto-complete', {
        socialSessionId,
        phase: state.currentPhase,
        error: error instanceof Error ? error.message : String(error),
      });
      activeUserIds = undefined;
    }
  }

  // Keep the client-visible presence count honest with the same threshold the
  // guard used (activePlayerCount semantics = PRESENCE_THRESHOLD_MS).
  if (activeUserIds !== undefined) {
    state.activePlayerCount = activeUserIds.size;
  }

  const result = evaluatePhasePresenceGuard({
    rosterSnapshot: state.phaseRosterSnapshot,
    departedUserIds: getPhaseDepartedUserIds(state),
    completedUserIds: completed,
    activeUserIds,
    phaseStartedAt: state.phaseStartedAt,
    now,
    timeoutMs,
    fallbackPlayerCount: state.playerCount,
  });

  if (result.silentUserIds.length > 0) {
    const silentCompleted = new Set(state.phaseSilentCompletedUserIds ?? []);
    for (const userId of result.silentUserIds) silentCompleted.add(userId);
    state.phaseSilentCompletedUserIds = [...silentCompleted];

    if (completed !== undefined) {
      markPhaseParticipationUserIdsComplete(state, state.currentPhase, result.silentUserIds);
    }

    result.complete = true;
    result.requiredCount = getPhaseRequiredRosterIds(state).length;
    logger.info('[SocialIcebreaker] silent players auto-completed', {
      socialSessionId,
      phase: state.currentPhase,
      autoCompletedUserIds: result.silentUserIds,
      timeoutMs,
      phaseElapsedMs: now - state.phaseStartedAt,
    });

    if (options.persist !== false) {
      await updateSession(socialSessionId, state);
    }
  }

  return { ...result, autoCompletedUserIds: result.silentUserIds };
}

export function recapDisplayNameByUserId(
  roster: SocialSessionParticipantSummary[],
  state: SocialSessionState,
  userId: string,
): string {
  const fromRoster = roster.find((p) => p.userId === userId)?.displayName;
  if (fromRoster) return fromRoster;
  if (userId === state.hostUserId) return state.hostDisplayName;
  const fromLie = state.lieDetectivePlayers?.find((p) => p.userId === userId)?.displayName;
  return fromLie || '某位参与者';
}

export function buildLieDetectiveRecapHighlights(
  state: SocialSessionState,
  roster: SocialSessionParticipantSummary[],
  sessionLieMap: Map<string, Array<{ index: number; text: string; isLie: boolean }>>,
): string[] {
  const highlights: string[] = [];
  for (const vote of state.votes || []) {
    const stmts = sessionLieMap.get(vote.targetUserId);
    const lieStmt = stmts?.find((s) => s.isLie);
    if (!lieStmt || vote.guessedStatementIndex !== lieStmt.index) continue;
    const voterName = recapDisplayNameByUserId(roster, state, vote.voterId);
    const targetName = recapDisplayNameByUserId(roster, state, vote.targetUserId);
    highlights.push(`${voterName}猜对了${targetName}的谎言`);
  }
  return highlights.slice(0, 8);
}

export function buildPersonalityDiceRecapLines(state: SocialSessionState): string[] {
  if (isEnabled(process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED, true) &&
      state.personalityDiceChallengeGroups && state.diceSelectedOption) {
    return state.personalityDiceChallengeGroups.slice(0, 6).map((group) => {
      const chosenIdx = state.diceSelectedOption![group.userId];
      if (chosenIdx === undefined) {
        return `${group.displayName}：未选择挑战`;
      }
      const chosen = group.options[chosenIdx];
      if (!chosen) {
        return `${group.displayName}：未选择挑战`;
      }
      const title = chosen.challengeTitle.length > 48 ? `${chosen.challengeTitle.slice(0, 47)}…` : chosen.challengeTitle;
      const diffLabel = DIFFICULTY_LABELS[chosen.difficulty] || chosen.difficulty;
      return `${group.displayName} 选择了${diffLabel}挑战：${title}`;
    });
  }

  const challenges = state.personalityDiceChallenges || [];
  return challenges.slice(0, 6).map((c) => {
    const title = c.challengeTitle.length > 48 ? `${c.challengeTitle.slice(0, 47)}…` : c.challengeTitle;
    return `${c.displayName}：${title}`;
  });
}

export function buildMiniScriptRecapLine(
  state: SocialSessionState,
  roster: SocialSessionParticipantSummary[] = [],
): string | undefined {
  const premise = state.miniScriptFramework?.premise?.trim();
  if (!premise) return undefined;
  const premiseLine = premise.length > 220 ? `${premise.slice(0, 219)}…` : premise;

  // V2 P3 (Q15): 本桌名侦探 honor — session recap line only, no profile
  // persistence. Players correct on BOTH steps (suspect + motive) are named
  // with a low-pressure Xiaoyue line; zero dual-correct keeps the gentle
  // base tone (no shaming). Copy rules: no emoji, no 真凶 (use 当事人
  // framing elsewhere), no 匹配/社交/AI vocabulary.
  const dualCorrect = (state.miniScriptRevealedPlayerResults ?? []).filter(
    (result) => result.round1Correct === true && result.round2Correct === true,
  );
  if (dualCorrect.length === 0) return premiseLine;
  const names = dualCorrect.map((result) => {
    const name = recapDisplayNameByUserId(roster, state, result.userId);
    return name.length > 12 ? `${name.slice(0, 11)}…` : name;
  });
  return `${premiseLine}\n本桌名侦探：${names.join('、')}——两轮全对，悦仔为你鼓掌。`;
}

export function buildAuctionRecapLines(state: SocialSessionState): string[] {
  const lines = state.auctionRecapLines;
  if (!Array.isArray(lines) || lines.length === 0) return [];
  return lines.map((l) => (l.length > 120 ? `${l.slice(0, 119)}…` : l)).slice(0, 8);
}

export function buildRecapParticipants(
  roster: SocialSessionParticipantSummary[],
  state: SocialSessionState,
): Array<{ displayName: string; archetype?: string }> {
  if (roster.length > 0) {
    return roster.map((p) => ({ displayName: p.displayName, archetype: p.archetype }));
  }
  const out: Array<{ displayName: string; archetype?: string }> = [];
  const seen = new Set<string>();
  if (state.hostDisplayName) {
    out.push({ displayName: state.hostDisplayName });
    seen.add(state.hostUserId);
  }
  for (const pl of state.lieDetectivePlayers || []) {
    if (!seen.has(pl.userId)) {
      out.push({ displayName: pl.displayName });
      seen.add(pl.userId);
    }
  }
  return out.length > 0 ? out : [{ displayName: '参与者' }];
}

export function buildRecapHighlights(state: SocialSessionState, roster?: Array<{ userId: string; displayName: string }>) {
  const highlights: Partial<{
    lieDetectiveV2Stats: { aiWinRate: number; hardestRound: number; fooledEveryone: number };
    personalityDiceHighlights: { completedCount: number; passedCount: number; completionRate: number };
    undercoverWordResult: { caught: boolean; undercoverDisplayName: string };
    microChallengeHighlights: { completedCount: number; totalCount: number; completionRate: number };
    groupMirrorHighlights: { topVotedDisplayName: string; questionText: string; voteCount: number };
  }> = {};

  if (state.lieDetectiveRevealHistory && state.lieDetectiveRevealHistory.length > 0) {
    highlights.lieDetectiveV2Stats = buildLieDetectiveV2RecapData(state.lieDetectiveRevealHistory);
  }

  if (state.diceCompletedBy || state.dicePassedBy) {
    const completedCount = state.diceCompletedBy?.length || 0;
    const passedCount = state.dicePassedBy?.length || 0;
    const totalChallenges = state.personalityDiceChallenges?.length || state.playerCount || 1;
    highlights.personalityDiceHighlights = {
      completedCount,
      passedCount,
      completionRate: Math.round(((completedCount + passedCount) / totalChallenges) * 100),
    };
  }

  if (state.undercoverWordResults) {
    highlights.undercoverWordResult = {
      caught: state.undercoverWordResults.caught,
      undercoverDisplayName: state.undercoverWordResults.undercoverDisplayName,
    };
  }

  if (state.challengeCompletedBy) {
    const completedCount = state.challengeCompletedBy.length;
    const totalCount = state.playerCount || 1;
    highlights.microChallengeHighlights = {
      completedCount,
      totalCount,
      completionRate: Math.round((completedCount / totalCount) * 100),
    };
  }

  const mirrorAnswers = state.groupMirrorVotes || state.groupMirrorAnswers || [];
  if (mirrorAnswers.length > 0) {
    const targetCounts: Record<string, number> = {};
    for (const a of mirrorAnswers) {
      targetCounts[a.targetUserId] = (targetCounts[a.targetUserId] || 0) + 1;
    }
    let topTarget = '';
    let maxCount = 0;
    for (const [uid, count] of Object.entries(targetCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topTarget = uid;
      }
    }
    if (topTarget && maxCount > 0) {
      const questions = state.groupMirrorQuestions || [];
      const targetDisplayName = roster?.find((r) => r.userId === topTarget)?.displayName
        || mirrorAnswers.find((a) => a.userId === topTarget)?.displayName
        || '匿名';
      highlights.groupMirrorHighlights = {
        topVotedDisplayName: targetDisplayName,
        questionText: questions[0]?.questionText || '',
        voteCount: maxCount,
      };
    }
  }

  return highlights;
}

/**
 * Generate and persist a recap snapshot for a session entering the recap phase.
 * Idempotent: if a snapshot already exists, it is left untouched.
 * `persist` defaults to true; transitionPhase passes false and persists the
 * live state itself (the snapshot may have been built from a pre-cleanup copy).
 */
export async function ensureRecapSnapshot(
  state: SocialSessionState,
  socialSessionId: string,
  persist = true,
): Promise<void> {
  if (state.recapSnapshot) return;

  try {
    const roster = await listParticipants(socialSessionId);
    const medals = curateMedals(state, roster);

    const durationMinutes = Math.round(
      (Date.now() - (state.sessionStartedAt || state.phaseStartedAt || Date.now())) / 60000
    );
    const sessionLieMap = await loadSessionLieTruths(socialSessionId);
    const lieHighlights = buildLieDetectiveRecapHighlights(state, roster, sessionLieMap);
    const personalityDiceRecapLines = buildPersonalityDiceRecapLines(state);
    const miniScriptRecapLine = buildMiniScriptRecapLine(state, roster);
    const auctionRecapLines = buildAuctionRecapLines(state);

    const summaryResult = await generateRecapSummary({
      participants: buildRecapParticipants(roster, state),
      topicsDiscussed: (state.warmupTopics || []).slice(0, (state.currentTopicIndex ?? 0) + 1).map(t => t.question),
      challengesCompleted: state.challengeCompletedBy?.length || 0,
      commonGroundCount: state.commonGroundCount || 0,
      lieDetectiveHighlights: lieHighlights.length ? lieHighlights : undefined,
      personalityDiceRecapLines: personalityDiceRecapLines.length ? personalityDiceRecapLines : undefined,
      miniScriptRecapLine,
      auctionRecapLines: auctionRecapLines.length ? auctionRecapLines : undefined,
      durationMinutes,
    });

    state.recapSnapshot = {
      recapSummary: summaryResult.data,
      medals,
      meta: summaryResult.meta,
      ...(state.endedEarlyAt && state.interruptedAtPhase
        ? {
            interrupted: {
              interrupted: true as const,
              phase: state.interruptedAtPhase,
            },
          }
        : {}),
      ...buildRecapHighlights(state, roster),
    };
    if (persist) {
      await updateSession(socialSessionId, state);
    }
  } catch (error) {
    logger.error('[SocialIcebreaker] Failed to generate recap snapshot:', { error: String(error) });
    // Continue without snapshot — consumers fall back to on-demand generation.
  }
}

const deferredRecapSnapshots = new Map<string, Promise<void>>();

function scheduleDeferredRecapSnapshot(
  sourceState: SocialSessionState,
  socialSessionId: string,
): void {
  if (deferredRecapSnapshots.has(socialSessionId)) return;
  const task = (async () => {
    await ensureRecapSnapshot(sourceState, socialSessionId, false);
    if (!sourceState.recapSnapshot) return;
    const { state: latest } = await getSessionWithExpiry(socialSessionId);
    if (!latest) return;
    latest.recapSnapshot = sourceState.recapSnapshot;
    await updateSession(socialSessionId, latest);
  })().finally(() => {
    deferredRecapSnapshots.delete(socialSessionId);
  });
  deferredRecapSnapshots.set(socialSessionId, task);
}

export async function waitForDeferredRecapSnapshot(socialSessionId: string): Promise<void> {
  await deferredRecapSnapshots.get(socialSessionId);
}

export function incrementCommonGround(state: SocialSessionState): void {
  state.commonGroundCount = Math.max(0, state.commonGroundCount || 0) + 1;
}

export function getCurrentLieDetectivePlayer(state: SocialSessionState): LieDetectivePlayer | null {
  const currentIndex = state.currentLieDetectivePlayerIndex ?? 0;
  return state.lieDetectivePlayers?.[currentIndex] ?? null;
}

/**
 * Check if a user is authorized to perform host actions.
 * Phase transitions are host-owned. Countdown-driven democratized hosting was
 * removed because it could advance while the table was still recapping.
 * When false, only the designated hostUserId can act (legacy mode).
 */
export async function isHostAuthorized(
  state: SocialSessionState,
  userId: string | undefined,
  socialSessionId: string,
): Promise<boolean> {
  if (!userId) return false;
  return state.hostUserId === userId;
}

// ---------------------------------------------------------------------------
// Unified phase-transition pipeline (PR1 flow revamp)
// ---------------------------------------------------------------------------

export type AdvanceTrigger =
  | 'host_tap'
  | 'auto_all_ready'
  | 'stall_recovery'
  | 'early_end_jump'
  | 'custom_select'
  | 'custom_end';

export function hasWarmupTurnCompleted(state: SocialSessionState): boolean {
  return !!state.warmupTurnUserId && (state.warmupReadyUserIds || []).includes(state.warmupTurnUserId);
}

/**
 * Whether the current phase has reached its natural completion condition
 * (mirrors the manual /advance guards) for readiness reporting.
 */
export function isPhaseNaturallyComplete(state: SocialSessionState): boolean {
  switch (state.currentPhase) {
    case 'warmup': {
      const topicsReady = (state.warmupTopics || []).length > 0;
      if (!topicsReady) return false;
      return (
        hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount) ||
        hasWarmupTurnCompleted(state)
      );
    }
    case 'micro_challenge':
      return (
        !!state.currentChallenge &&
        isPhaseRosterComplete(state, state.challengeCompletedBy)
      );
    case 'lie_detective':
      return (
        (state.lieDetectivePlayers || []).length >= getPhaseRequiredPlayerCount(state) &&
        isPhaseRosterComplete(state, state.lieDetectiveCompletedUserIds)
      );
    case 'personality_dice': {
      const done = state.personalityDiceChooseModeEnabled && state.diceRevealOrder
        ? new Set(state.diceRevealReadyBy || [])
        : new Set([...(state.diceCompletedBy || []), ...(state.dicePassedBy || [])]);
      return done.size >= state.playerCount;
    }
    case 'auction':
      return state.auctionAllLotsClosed === true;
    case 'quip_battle':
      return state.quipBattleRevealed === true;
    case 'group_mirror':
      return state.groupMirrorRevealed === true;
    case 'undercover_word':
      return state.undercoverWordRevealed === true;
    case 'speed_friending':
      return state.speedFriendingAllRoundsComplete === true;
    case 'mini_script':
      return state.miniScriptSolutionRevealed === true;
    default:
      return false;
  }
}

function completionSnapshot(
  state: SocialSessionState,
  phase: SocialIcebreakerPhase,
): { readyCount: number; totalCount: number } {
  const totalCount = state.playerCount;
  switch (phase) {
    case 'warmup':
      return { readyCount: getUniqueUserCount(state.warmupReadyUserIds), totalCount };
    case 'micro_challenge':
      return { readyCount: getUniqueUserCount(state.challengeCompletedBy), totalCount };
    case 'lie_detective':
      return { readyCount: getUniqueUserCount(state.lieDetectiveCompletedUserIds), totalCount };
    case 'personality_dice':
      return {
        readyCount: state.personalityDiceChooseModeEnabled && state.diceRevealOrder
          ? new Set(state.diceRevealReadyBy || []).size
          : new Set([...(state.diceCompletedBy || []), ...(state.dicePassedBy || [])]).size,
        totalCount,
      };
    default:
      return { readyCount: 0, totalCount };
  }
}

function clearAdvanceScheduling(state: SocialSessionState): void {
  state.autoAdvanceScheduledAt = undefined;
  state.advanceFuseKind = undefined;
  state.stallNudgeAt = undefined;
  state.stallSuppressedForPhase = undefined;
}

export interface TransitionPhaseOptions {
  state: SocialSessionState;
  socialSessionId: string;
  trigger: AdvanceTrigger;
  /** Defaults to `getNextEligiblePhase`. */
  targetPhase?: SocialIcebreakerPhase;
  /**
   * Default true. Early-end passes false so a phase the table skipped mid-way
   * is not counted as played (honest 「今晚玩了 N 个环节」 framing).
   */
  countCurrentPhaseCompleted?: boolean;
  /** Skip the bonus-gate pause (the host already resolved the gate). */
  skipBonusGate?: boolean;
  /** Persist the recap transition before generating its AI snapshot. */
  deferRecapSnapshot?: boolean;
}

export interface TransitionPhaseResult {
  transitioned: boolean;
  nextPhase: SocialIcebreakerPhase;
  pausedAtBonusGate: boolean;
  challenge?: SocialSessionState['currentChallenge'];
  challengeMeta?: SocialSessionState['currentChallengeMeta'];
}

/**
 * Single pipeline for EVERY phase transition: host advance, early-end,
 * stall recovery, early-end, custom select/end. Owns completion bookkeeping,
 * dwell metrics, per-phase cleanup, bonus-gate pause, next-phase seeding
 * (speed-friending pairs, micro-challenge content), recap snapshot, and
 * advance attribution. Routes keep only auth + per-phase guards.
 */
export async function transitionPhase(opts: TransitionPhaseOptions): Promise<TransitionPhaseResult> {
  const { state, socialSessionId, trigger } = opts;
  const currentPhase = state.currentPhase;
  const targetPhase = opts.targetPhase ?? getNextEligiblePhase(currentPhase, state);

  const snapshot = completionSnapshot(state, currentPhase);
  const phaseStartedAtMs = state.phaseStartedAt ? new Date(state.phaseStartedAt).getTime() : Date.now();
  const dwellTimeMs = Date.now() - phaseStartedAtMs;

  const alreadyCounted = state.completedPhases.includes(currentPhase);
  if (opts.countCurrentPhaseCompleted !== false && !alreadyCounted) {
    state.completedPhases = [...(state.completedPhases || []), currentPhase];
  }

  // R6: skip the dwell row when this phase was already counted (bonus-gate
  // resolution re-enters transitionPhase for the same phase), and floor out
  // sub-second rows from back-to-back automated transitions.
  if (!alreadyCounted && dwellTimeMs >= 1000) {
    savePhaseMetric(socialSessionId, currentPhase, {
      dwellTimeMs,
      startedAt: new Date(phaseStartedAtMs),
      endedAt: new Date(),
      participantCount: state.playerCount,
    }).catch((err) => {
      logger.warn('[PhaseMetrics] save failed', {
        socialSessionId,
        phase: currentPhase,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // R5: capture the pre-cleanup state so the recap snapshot keeps the
  // just-left phase's content (auction lines, dice lines, undercover result,
  // mirror highlights, lie votes, miniscript premise).
  const preCleanupState: SocialSessionState = { ...state };

  cleanupPhaseStateForNextPhase(state, currentPhase);

  // O1: build the lie-detective V2 recap block on EVERY transition out of
  // lie_detective transition side effects.
  if (
    currentPhase === 'lie_detective' &&
    state.lieDetectiveRevealHistory &&
    state.lieDetectiveRevealHistory.length > 0
  ) {
    preCleanupState.recapData = preCleanupState.recapData || {
      topicsDiscussed: [],
      challengesCompleted: 0,
      funMoments: [],
    };
    preCleanupState.recapData.lieDetective = buildLieDetectiveV2RecapData(state.lieDetectiveRevealHistory);
    state.recapData = preCleanupState.recapData;
  }

  if (targetPhase === 'phase_selection') {
    state.phaseSelectionId = generatePhaseSelectionId();
  }

  // Bonus gate: advancing into mini_script for the first time pauses for the
  // Host + player vote. Automation never enters mini_script past this point.
  if (
    targetPhase === 'mini_script' &&
    !opts.skipBonusGate &&
    !isCustomMode(state) &&
    !state.bonusGateOffered &&
    !state.bonusGateAccepted &&
    !state.bonusGateDeclined
  ) {
    state.bonusGateOffered = true;
    if (!state.bonusGateFrameworkPreloading) {
      state.bonusGateFrameworkPreloading = true;
    }
    clearAdvanceScheduling(state);
    await updateSession(socialSessionId, state);
    logger.info('[SocialIcebreaker] phase_advance paused at bonus gate', {
      socialSessionId,
      fromPhase: currentPhase,
      trigger,
    });
    return { transitioned: false, nextPhase: currentPhase, pausedAtBonusGate: true };
  }

  state.currentPhase = targetPhase;
  state.phaseStartedAt = Date.now();
  state.pulseChecks = [];
  clearAdvanceScheduling(state);
  state.lastAdvanceTrigger = trigger;

  // W3: lock the participation scope for full-participation phases to the
  // roster present at entry. Late joiners are excluded (AC-W3.4) and can never
  // deadlock a guard; departing members are tracked per-phase. Only recently
  // active members are captured so a long-departed member is not re-required
  // every subsequent phase (finding 3); an all-idle boundary moment falls back
  // to the full roster rather than an empty (trivially complete) scope. Non-full
  // phases and legacy sessions keep the playerCount fallback.
  if (getPhaseModule(targetPhase).participation === 'full') {
    try {
      const snapshotRoster = await listParticipants(socialSessionId);
      state.phaseRosterSnapshot = buildPhaseRosterSnapshot(snapshotRoster);
    } catch (error) {
      state.phaseRosterSnapshot = undefined;
      logger.warn('[SocialIcebreaker] phase roster snapshot unavailable', {
        socialSessionId,
        phase: targetPhase,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    state.phaseRosterSnapshot = undefined;
  }
  state.phaseOptOutUserIds = undefined;
  state.phaseSilentCompletedUserIds = undefined;

  // V2 P2: resolve the evidence/motive flag ONCE at mini_script phase entry
  // and snapshot it into session state. Every route and client reads the
  // snapshot — a mid-session admin flip never affects a live session
  // (contract AC-06). The undefined guard keeps the first snapshot on any
  // later re-entry.
  if (targetPhase === 'mini_script' && state.miniScriptV2Enabled === undefined) {
    state.miniScriptV2Enabled = await getFeatureFlag('miniscriptEvidenceVoteV2Enabled');
    logger.info('[SocialIcebreaker] miniscript v2 flag snapshot', {
      socialSessionId,
      miniScriptV2Enabled: state.miniScriptV2Enabled,
    });
  }

  if (targetPhase === 'warmup') {
    state.warmupReadyUserIds = [];
    // Single-test bot attendees default to ready when warmup restarts.
    seedSingleTestBotsWarmupReady(state);
  }

  if (targetPhase === 'speed_friending') {
    const roster = await listParticipants(socialSessionId);
    const playerIds = roster.map((p) => p.userId);
    const displayNames = new Map(roster.map((p) => [p.userId, p.displayName]));
    const rounds = generateSpeedFriendingPairs(playerIds, displayNames);
    state.speedFriendingPairs = rounds.flat();
    state.speedFriendingTotalRounds = rounds.length;
    state.speedFriendingCurrentRound = 0;
    state.speedFriendingAllRoundsComplete = false;
    state.speedFriendingRoundStartedAt = Date.now();
  }

  let challenge: SocialSessionState['currentChallenge'];
  let challengeMeta: SocialSessionState['currentChallengeMeta'];
  if (targetPhase === 'micro_challenge') {
    state.challengeCompletedBy = [];
    // W5 (gm-debrief): feed the matched roster + host mood + energy arc into
    // selector scoring, behind the matching-aware kill switch. Flag off → the
    // call args are byte-identical to pre-W5.
    const matchingAware = await getFeatureFlag('icebreakerMatchingAwareEnabled', false);
    const microRoster = matchingAware
      ? await listParticipants(socialSessionId).catch(() => [])
      : [];
    try {
      const challengeResult = await generateMicroChallenges({
        eventType: state.eventType || '活动',
        participantCount: state.playerCount,
        seed: socialSessionId,
        ...(matchingAware
          ? {
              roster: microRoster.map((p) => ({
                archetype: p.archetype,
                interests: p.interests,
              })),
              mood: state.selectedMood,
              energyArc: inferMicroChallengeEnergyArc({
                roster: microRoster,
                mood: state.selectedMood,
              }),
            }
          : {}),
      });
      state.currentChallenge = challengeResult.data[0];
      state.currentChallengeMeta = challengeResult.meta;
      challenge = state.currentChallenge;
      challengeMeta = challengeResult.meta;
    } catch {
      // fallback silently handled in AI service
    }
  }

  await updateSession(socialSessionId, state);

  // S6: group beat for every committed transition — nudge-family for phase
  // advances, celebration for the recap arrival. State-free; emitted after
  // the persist (WS is a notification layer). The bonus-gate pause path
  // returns before this point, so a paused transition emits nothing.
  void emitSocialGroupBeat(
    state.icebreakerSessionId,
    targetPhase === 'recap' ? 'session_recap' : 'phase_advanced',
  );

  if (targetPhase === 'recap') {
    // R5: build from the pre-cleanup copy, then persist the live state.
    if (opts.deferRecapSnapshot) {
      // The recap screen immediately calls GET /recap, which runs the same
      // coalesced snapshot pipeline. Deferring makes the phase change visible
      // without waiting for an LLM round-trip while preserving pre-cleanup data.
      scheduleDeferredRecapSnapshot(preCleanupState, socialSessionId);
      return { transitioned: true, nextPhase: targetPhase, pausedAtBonusGate: false, challenge, challengeMeta };
    }
    await ensureRecapSnapshot(preCleanupState, socialSessionId, false);
    if (preCleanupState.recapSnapshot && !state.recapSnapshot) {
      state.recapSnapshot = preCleanupState.recapSnapshot;
      await updateSession(socialSessionId, state);
    }
  }

  logger.info('[SocialIcebreaker] phase_advance', {
    socialSessionId,
    fromPhase: currentPhase,
    toPhase: targetPhase,
    trigger,
    readyCount: snapshot.readyCount,
    totalCount: snapshot.totalCount,
    phaseElapsedMs: dwellTimeMs,
  });

  return { transitioned: true, nextPhase: targetPhase, pausedAtBonusGate: false, challenge, challengeMeta };
}

/** Bound on stall suppression during warmup topic generation. Well beyond the
 *  6s LLM race + route overhead so a live /topics request is never nudged,
 *  but short enough that a wedged 'generating' state (server restart
 *  mid-request) self-heals and the host gets nudged to retry. */
const WARMUP_GENERATING_STALL_SUPPRESS_MS = 30_000;

/** True while warmup topics are actively generating (bounded window). The
 *  stall detector must never nudge a host who is waiting on the system rather
 *  than on people (2026-07-26 出题卡死 incident). Exported for tests. */
export function isWarmupTopicsGenerating(state: SocialSessionState, now = Date.now()): boolean {
  if (state.currentPhase !== 'warmup' || state.warmupTopicsStatus !== 'generating') return false;
  const startedAt = state.warmupTopicsGeneratingAt;
  if (!startedAt) return false;
  return now - startedAt < WARMUP_GENERATING_STALL_SUPPRESS_MS;
}

/**
 * Auto-advance is retired. Reads only scrub scheduling fields left by older
 * clients; revealed/completed phases remain visible until the host advances.
 */
export async function processAutoAdvance(state: SocialSessionState): Promise<SocialSessionState> {
  // Countdown-driven advancement has been retired. Clear stale fuse state from
  // sessions created by older builds, but never move the phase.
  if (
    state.autoAdvanceEnabled !== false ||
    state.autoAdvanceScheduledAt !== undefined ||
    state.advanceFuseKind !== undefined ||
    state.stallNudgeAt !== undefined
  ) {
    clearAdvanceScheduling(state);
    state.autoAdvanceEnabled = false;
    await updateSession(state.socialSessionId, state);
  }
  return state;
}

export async function resolveSession(
  socialSessionId: string,
  res: any,
): Promise<SocialSessionState | null> {
  const { state, expired } = await getSessionWithExpiry(socialSessionId);
  if (!state) {
    if (expired) {
      res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    } else {
      res.status(404).json({ error: 'Social session not found' });
    }
    return null;
  }
  const hydrated = hydrateDerivedState({ ...state });
  // Retire any stale countdown/fuse state from sessions created by older builds.
  await processAutoAdvance(hydrated);
  return hydrated;
}
