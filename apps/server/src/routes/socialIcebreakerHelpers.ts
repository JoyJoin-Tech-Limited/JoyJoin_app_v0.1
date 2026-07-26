import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  LieDetectivePlayer,
  SocialSessionParticipantSummary,
} from '@shared/socialIcebreaker';
import { migrateLegacySocialIcebreakerPhases, getNextEligiblePhase } from '@shared/socialIcebreaker';
import {
  getSessionWithExpiry,
  getParticipant,
  listParticipants,
  updateSession,
  loadSessionLieTruths,
  savePhaseMetric,
} from '../lib/socialIcebreakerStore';
import { shouldAutoAdvance, getPhaseTimeoutMinutes } from '../xiaoyueAdaptiveEngine';
import { logger } from '../lib/logger';
import { buildArchetypeContext } from '../lib/contextInjector';
import { isCustomMode, computeSelectablePhases, generatePhaseSelectionId } from '../services/customModeService';
import { mapBotUserIdsToBotIds, buildBotIdByUserId } from '../lib/socialIcebreakerClientIdMapper';
import { isSingleTestMode } from '../lib/isSingleTestMode';
import { curateMedals } from '../lib/medalCuration';
import { generateRecapSummary, buildLieDetectiveV2RecapData, generateMicroChallenges } from '../socialIcebreakerAIService';
import { cleanupPhaseStateForNextPhase } from '../socialIcebreakerPhaseConfig';
import { seedSingleTestBotsWarmupReady } from '../services/socialIcebreakerBotService';

function isEnabled(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

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

  // Strip server-only participant profiles before sending to clients
  if (sanitized.joinedParticipants) {
    sanitized.joinedParticipants = sanitized.joinedParticipants.map(p => {
      const { profile: _, ...safe } = p;
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
    sanitized.miniScriptFramework = framework as SocialSessionState['miniScriptFramework'];
  }

  if (requestingUserId && sanitized.miniScriptPlayerRuntimeViews) {
    const ownView = sanitized.miniScriptPlayerRuntimeViews[requestingUserId];
    sanitized.miniScriptPlayerRuntimeViews = ownView
      ? { [requestingUserId]: ownView }
      : {};
  }

  // Strip individual bonus-gate sentiment votes to protect voter privacy;
  // clients only need the aggregate count computed server-side or in UI.
  delete (sanitized as Partial<SocialSessionState>).bonusGatePlayerSentiment;

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
  const withCustomExtras = isCustomMode(state)
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

export function getMicroChallengeDeadlineMs(state: SocialSessionState): number | null {
  if (!state.currentChallenge?.durationSeconds) return null;
  return state.phaseStartedAt + state.currentChallenge.durationSeconds * 1000;
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

export function buildMiniScriptRecapLine(state: SocialSessionState): string | undefined {
  const premise = state.miniScriptFramework?.premise?.trim();
  if (!premise) return undefined;
  return premise.length > 220 ? `${premise.slice(0, 219)}…` : premise;
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
    const miniScriptRecapLine = buildMiniScriptRecapLine(state);
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

export function incrementCommonGround(state: SocialSessionState): void {
  state.commonGroundCount = Math.max(0, state.commonGroundCount || 0) + 1;
}

export function getCurrentLieDetectivePlayer(state: SocialSessionState): LieDetectivePlayer | null {
  const currentIndex = state.currentLieDetectivePlayerIndex ?? 0;
  return state.lieDetectivePlayers?.[currentIndex] ?? null;
}

/**
 * Check if a user is authorized to perform host actions.
 * When autoAdvanceEnabled is true, any roster participant can trigger actions (democratized hosting).
 * When false, only the designated hostUserId can act (legacy mode).
 */
export async function isHostAuthorized(
  state: SocialSessionState,
  userId: string | undefined,
  socialSessionId: string,
): Promise<boolean> {
  if (!userId) return false;
  // Treat undefined as true for backward compatibility with sessions created
  // before the autoAdvanceEnabled field was introduced.
  if (state.autoAdvanceEnabled !== false) {
    const participant = await getParticipant(socialSessionId, userId);
    return !!participant;
  }
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

export const WARMUP_TURN_DURATION_SECONDS = 30;

export function hasWarmupTurnCompleted(state: SocialSessionState): boolean {
  return !!state.warmupTurnUserId && (state.warmupReadyUserIds || []).includes(state.warmupTurnUserId);
}

export function isWarmupTurnExpired(state: SocialSessionState): boolean {
  const turnStartedAt = state.warmupTurnStartedAt;
  if (!turnStartedAt) return false;
  const durationSeconds = state.warmupTurnDurationSeconds ?? WARMUP_TURN_DURATION_SECONDS;
  return Date.now() - turnStartedAt >= durationSeconds * 1000;
}

/**
 * Whether the current phase has reached its natural completion condition
 * (mirrors the manual /advance guards). Drives the fast all-ready fuse.
 */
export function isPhaseNaturallyComplete(state: SocialSessionState): boolean {
  switch (state.currentPhase) {
    case 'warmup': {
      const topicsReady = (state.warmupTopics || []).length > 0;
      if (!topicsReady) return false;
      return (
        hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount) ||
        hasWarmupTurnCompleted(state) ||
        isWarmupTurnExpired(state)
      );
    }
    case 'micro_challenge':
      return (
        !!state.currentChallenge &&
        hasAllRosterParticipantsResponded(state.challengeCompletedBy, state.playerCount)
      );
    case 'lie_detective':
      return (
        (state.lieDetectivePlayers || []).length >= state.playerCount &&
        hasAllRosterParticipantsResponded(state.lieDetectiveCompletedUserIds, state.playerCount)
      );
    case 'personality_dice': {
      const done = new Set([...(state.diceCompletedBy || []), ...(state.dicePassedBy || [])]);
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
        readyCount: new Set([...(state.diceCompletedBy || []), ...(state.dicePassedBy || [])]).size,
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
}

export interface TransitionPhaseResult {
  transitioned: boolean;
  nextPhase: SocialIcebreakerPhase;
  pausedAtBonusGate: boolean;
  challenge?: SocialSessionState['currentChallenge'];
  challengeMeta?: SocialSessionState['currentChallengeMeta'];
}

/**
 * Single pipeline for EVERY phase transition: host advance, auto fuse,
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
  // lie_detective (previously manual-/advance only; fuse/stall/early-end skipped it).
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
  // host+player vote. The fuse never auto-enters mini_script past this point.
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
    try {
      const challengeResult = await generateMicroChallenges({
        eventType: state.eventType || '活动',
        participantCount: state.playerCount,
        seed: socialSessionId,
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

  if (targetPhase === 'recap') {
    // R5: build from the pre-cleanup copy, then persist the live state.
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

// ---------------------------------------------------------------------------
// Auto-advance scheduling (all-ready fast fuse + stall nudge/recovery)
// ---------------------------------------------------------------------------

/** Visible all-ready fuse. Long enough for the phase's celebration beat to land. */
const ALL_READY_FUSE_MS = 7_000;
/** Test-mode fuse: longer so QA can observe the celebration before the flip. */
const ALL_READY_FUSE_TEST_MODE_MS = 10_000;
/** Grace period after the stall nudge before automation fires without the host. */
const STALL_GRACE_MS = 75_000;

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

function resolveFuseMs(state: SocialSessionState): number {
  return isSingleTestMode() && state.singleTest?.isTestModeSkip
    ? ALL_READY_FUSE_TEST_MODE_MS
    : ALL_READY_FUSE_MS;
}

/**
 * Process auto-advance for a session if conditions are met.
 * Runs on every state read (including the client poll).
 *
 * Model (locked 2026-07-17):
 * - All-ready → short visible fuse (~7s prod / ~10s test), then advance via the
 *   unified pipeline (content generation, dwell metrics, recap snapshot included).
 * - Stall (adaptive advance_ready signal OR phase timeout) → host nudge first;
 *   auto-fire only after a further grace period if the host is also AFK.
 * - Bonus gate → the fuse pauses at the offer; it never auto-enters mini_script
 *   and never auto-skips the vote.
 */
/** In-flight fuse executions (sessionId:fuseAt) — prevents double transitionPhase. */
const fuseExecutionsInFlight = new Set<string>();

export async function processAutoAdvance(state: SocialSessionState): Promise<SocialSessionState> {
  if (state.autoAdvanceEnabled !== true) return state;
  if (state.currentPhase === 'recap' || (state.currentPhase as string) === 'ended') return state;
  if (isCustomMode(state)) return state;

  const now = Date.now();

  // Execute a due fuse.
  if (state.autoAdvanceScheduledAt && now >= state.autoAdvanceScheduledAt) {
    // Concurrent readers (poll + mutation routes) can both see the same due
    // fuse before either persists the clear — the state store is
    // last-writer-wins with no CAS. Claim the fuse in-process so
    // transitionPhase (and its inline content generation) runs exactly once.
    const fuseKey = `${state.socialSessionId}:${state.autoAdvanceScheduledAt}`;
    if (fuseExecutionsInFlight.has(fuseKey)) return state;
    fuseExecutionsInFlight.add(fuseKey);
    try {
      // Re-verify against the persisted row before executing: a stale reader
      // whose snapshot predates another executor's clear-persist could claim
      // the same key after its finally released it. If the persisted fuse no
      // longer matches ours, someone else already handled it.
      const persisted = await getSessionWithExpiry(state.socialSessionId).catch(() => null);
      if (persisted?.state && persisted.state.autoAdvanceScheduledAt !== state.autoAdvanceScheduledAt) {
        return state;
      }
      const nextPhase = getNextEligiblePhase(state.currentPhase, state);
      const gatePending =
        nextPhase === 'mini_script' && !state.bonusGateAccepted && !state.bonusGateDeclined;
      if (gatePending) {
        state.autoAdvanceScheduledAt = undefined;
        state.advanceFuseKind = undefined;
        if (!state.bonusGateOffered) {
          state.bonusGateOffered = true;
          state.bonusGateFrameworkPreloading = true;
        }
        await updateSession(state.socialSessionId, state);
        return state;
      }
      // R2: an all-ready fuse re-verifies completion at execution — a player may
      // have un-readied (or a guard condition regressed) during the fuse window.
      if (state.advanceFuseKind === 'all_ready' && !isPhaseNaturallyComplete(state)) {
        state.autoAdvanceScheduledAt = undefined;
        state.advanceFuseKind = undefined;
        await updateSession(state.socialSessionId, state);
        logger.info('[SocialIcebreaker] All-ready fuse cancelled (completion regressed)', {
          sessionId: state.socialSessionId,
          phase: state.currentPhase,
        });
        return state;
      }
      if (nextPhase !== state.currentPhase) {
        const trigger: AdvanceTrigger =
          state.advanceFuseKind === 'stall_recovery' ? 'stall_recovery' : 'auto_all_ready';
        // R3: clear + persist the fuse BEFORE the transition so concurrent
        // poll-driven reads cannot double-execute it.
        state.autoAdvanceScheduledAt = undefined;
        state.advanceFuseKind = undefined;
        await updateSession(state.socialSessionId, state);
        try {
          await transitionPhase({ state, socialSessionId: state.socialSessionId, trigger });
        } catch (error) {
          // C1: transition failed after the clear persist — log and re-arm a
          // short retry fuse so the session self-heals on a later poll instead
          // of silently wedging on the pre-transition phase.
          logger.error('[SocialIcebreaker] Fuse transition failed; re-arming retry fuse', {
            sessionId: state.socialSessionId,
            phase: state.currentPhase,
            trigger,
            error: error instanceof Error ? error.message : String(error),
          });
          state.autoAdvanceScheduledAt = Date.now() + 15_000;
          state.advanceFuseKind = trigger === 'stall_recovery' ? 'stall_recovery' : 'all_ready';
          await updateSession(state.socialSessionId, state).catch(() => {});
        }
      } else {
        state.autoAdvanceScheduledAt = undefined;
        state.advanceFuseKind = undefined;
        await updateSession(state.socialSessionId, state);
      }
      return state;
    } finally {
      fuseExecutionsInFlight.delete(fuseKey);
    }
  }

  // Fuse already ticking — clients render the countdown from autoAdvanceScheduledAt.
  if (state.autoAdvanceScheduledAt) return state;

  // Fast path: everyone is ready → short, visible fuse.
  if (isPhaseNaturallyComplete(state)) {
    state.autoAdvanceScheduledAt = now + resolveFuseMs(state);
    state.advanceFuseKind = 'all_ready';
    await updateSession(state.socialSessionId, state);
    logger.info('[SocialIcebreaker] All-ready fuse scheduled', {
      sessionId: state.socialSessionId,
      phase: state.currentPhase,
      fuseAt: state.autoAdvanceScheduledAt,
    });
    return state;
  }

  // Stall path: host nudge first, auto-fire only after the grace period.
  if (state.stallSuppressedForPhase === state.currentPhase) return state;

  // Never nudge or fuse warmup while topics are generating — the host is
  // waiting on the system, not on people.
  if (isWarmupTopicsGenerating(state, now)) return state;

  if (state.stallNudgeAt) {
    if (now - state.stallNudgeAt >= STALL_GRACE_MS) {
      state.stallNudgeAt = undefined;
      state.autoAdvanceScheduledAt = now + resolveFuseMs(state);
      state.advanceFuseKind = 'stall_recovery';
      await updateSession(state.socialSessionId, state);
      logger.info('[SocialIcebreaker] Stall recovery fuse scheduled', {
        sessionId: state.socialSessionId,
        phase: state.currentPhase,
        fuseAt: state.autoAdvanceScheduledAt,
      });
    }
    return state;
  }

  const phaseElapsedMinutes = Math.max(0, (now - state.phaseStartedAt) / 60_000);
  const timedOut = phaseElapsedMinutes >= getPhaseTimeoutMinutes(state.currentPhase, state);
  if (shouldAutoAdvance(state) || timedOut) {
    state.stallNudgeAt = now;
    await updateSession(state.socialSessionId, state);
    logger.info('[SocialIcebreaker] Stall nudge issued', {
      sessionId: state.socialSessionId,
      phase: state.currentPhase,
      timedOut,
    });
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
  // Process auto-advance on every state read so clients don't need to poll separately
  await processAutoAdvance(hydrated);
  return hydrated;
}
