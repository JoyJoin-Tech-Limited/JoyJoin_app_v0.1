import type {
  SocialSessionState,
  LieDetectivePlayer,
  SocialSessionParticipantSummary,
} from '@shared/socialIcebreaker';
import { migrateLegacySocialIcebreakerPhases, getNextEligiblePhase } from '@shared/socialIcebreaker';
import {
  getSessionWithExpiry,
  listParticipants,
  updateSession,
} from '../lib/socialIcebreakerStore';
import { shouldAutoAdvance } from '../xiaoyueAdaptiveEngine';
import { logger } from '../lib/logger';

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

  return sanitized;
}

export async function buildClientState(
  state: SocialSessionState,
  requestingUserId?: string,
): Promise<SocialSessionState> {
  const joinedParticipants = await listParticipants(state.socialSessionId);
  return sanitizeStateForClient(
    {
      ...state,
      joinedParticipants,
    },
    requestingUserId,
  );
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
    return roster.map((p) => ({ displayName: p.displayName }));
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

export function incrementCommonGround(state: SocialSessionState): void {
  state.commonGroundCount = Math.max(0, state.commonGroundCount || 0) + 1;
}

export function getCurrentLieDetectivePlayer(state: SocialSessionState): LieDetectivePlayer | null {
  const currentIndex = state.currentLieDetectivePlayerIndex ?? 0;
  return state.lieDetectivePlayers?.[currentIndex] ?? null;
}

/**
 * Check if a user is authorized to perform host actions.
 * When autoAdvanceEnabled is true, any participant can trigger actions (democratized hosting).
 * When false, only the designated hostUserId can act (legacy mode).
 */
export function isHostAuthorized(state: SocialSessionState, userId: string): boolean {
  if (state.autoAdvanceEnabled === true) return true;
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
