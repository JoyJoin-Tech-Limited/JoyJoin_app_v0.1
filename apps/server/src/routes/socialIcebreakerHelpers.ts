import type {
  SocialSessionState,
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
} from '../lib/socialIcebreakerStore';
import { shouldAutoAdvance } from '../xiaoyueAdaptiveEngine';
import { logger } from '../lib/logger';
import { buildArchetypeContext } from '../lib/contextInjector';
import { isCustomMode, computeSelectablePhases } from '../services/customModeService';
import { mapBotUserIdsToBotIds, buildBotIdByUserId } from '../lib/socialIcebreakerClientIdMapper';
import { isSingleTestMode } from '../lib/isSingleTestMode';
import { curateMedals } from '../lib/medalCuration';
import { generateRecapSummary, buildLieDetectiveV2RecapData } from '../socialIcebreakerAIService';

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
  const joinedParticipants = await listParticipants(state.socialSessionId);
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
 */
export async function ensureRecapSnapshot(
  state: SocialSessionState,
  socialSessionId: string,
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
    await updateSession(socialSessionId, state);
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

/**
 * Process auto-advance for a session if conditions are met.
 * When the adaptive engine signals advance_ready and the scheduled time has passed,
 * automatically advance to the next phase and persist the updated state.
 */
export async function processAutoAdvance(state: SocialSessionState): Promise<SocialSessionState> {
  if (state.autoAdvanceEnabled !== true) return state;
  if (state.currentPhase === 'recap') return state;
  if (isCustomMode(state)) return state;

  // If auto-advance is not yet scheduled, check if we should schedule it
  if (!state.autoAdvanceScheduledAt) {
    if (shouldAutoAdvance(state)) {
      // Schedule auto-advance 30 seconds from now to give Xiaoyue time to announce
      state.autoAdvanceScheduledAt = Date.now() + 30_000;
      await updateSession(state.socialSessionId, state);
      logger.info('[SocialIcebreaker] Auto-advance scheduled', {
        sessionId: state.socialSessionId,
        phase: state.currentPhase,
        scheduledAt: state.autoAdvanceScheduledAt,
      });
    }
    return state;
  }

  // If scheduled time has passed, execute the advance
  if (Date.now() >= state.autoAdvanceScheduledAt) {
    const nextPhase = getNextEligiblePhase(state.currentPhase, state);
    if (nextPhase && nextPhase !== state.currentPhase) {
      state.completedPhases = [...(state.completedPhases || []), state.currentPhase];
      state.currentPhase = nextPhase;
      state.phaseStartedAt = Date.now();
      state.autoAdvanceScheduledAt = undefined;
      // Clean up per-phase state for the new phase
      state.warmupReadyUserIds = [];
      state.challengeCompletedBy = [];
      state.lieDetectiveCompletedUserIds = [];
      state.diceCompletedBy = [];
      await updateSession(state.socialSessionId, state);
      logger.info('[SocialIcebreaker] Auto-advance executed', {
        sessionId: state.socialSessionId,
        fromPhase: state.completedPhases[state.completedPhases.length - 1],
        toPhase: nextPhase,
      });
    }
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
