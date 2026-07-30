import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  LieDetectivePlayer,
  SocialSessionParticipantSummary,
} from '@shared/socialIcebreaker';
import { migrateLegacySocialIcebreakerPhases, getNextEligiblePhase } from '@shared/socialIcebreaker';
import {
  getSessionWithExpiry,
  listParticipants,
  updateSession,
  loadSessionLieTruths,
  savePhaseMetric,
} from '../lib/socialIcebreakerStore';
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
        hasAllRosterParticipantsResponded(state.challengeCompletedBy, state.playerCount)
      );
    case 'lie_detective':
      return (
        (state.lieDetectivePlayers || []).length >= state.playerCount &&
        hasAllRosterParticipantsResponded(state.lieDetectiveCompletedUserIds, state.playerCount)
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
