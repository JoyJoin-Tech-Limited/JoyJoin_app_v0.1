import { Router } from 'express';
import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  AtmosphereMood,
  LieDetectivePlayer,
  LieDetectiveVote,
  PulseCheckResult,
  LieDetectiveReveal,
} from '@shared/socialIcebreaker';
import { getNextEligiblePhase } from '@shared/socialIcebreaker';
import {
  generateWarmupTopics,
  generateMicroChallenges,
  generateLieDetectiveStatements,
  generateXiaoYueComment,
  generateRecapSummary,
  generatePersonalityDiceChallenges,
} from '../socialIcebreakerAIService';
import { buildCachedAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import {
  cleanupPhaseStateForNextPhase,
  ensureSessionEnabledPhases,
  getServerEnabledPhases,
} from '../socialIcebreakerPhaseConfig';
import {
  getSocialSessionId,
  getSessionWithExpiry,
  getSessionByIcebreakerSessionId,
  createSession,
  updateSession,
  upsertParticipant,
  getParticipant,
  listParticipants,
  heartbeat as dbHeartbeat,
  getRosterCount,
  getActiveParticipantCount,
  setLieTruths,
  getLieTruths,
  getAllSessionLieTruths,
  sweepExpiredSessions,
} from '../lib/socialIcebreakerStore';
import { getIcebreakerSessionParticipantAccess } from '../lib/icebreakerAccess';
import { logger } from '../lib/logger';
import { requireAuthenticatedUserId } from '../lib/requestAuth';

const router = Router();

function isUniqueConstraintError(error: unknown): boolean {
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

// ============ TTL / CLEANUP ============
// Sweep expired sessions from the DB every 5 minutes.
const sweepInterval = setInterval(() => {
  sweepExpiredSessions().catch((err) =>
    console.error('[SocialIcebreaker] sweep error:', err),
  );
}, 5 * 60 * 1000);
sweepInterval.unref?.();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize state before sending to client.
 *
 * Lie-detective truth data (isLie) is stored in a separate DB table and never
 * included in stateJson, so there is nothing to strip here.  Kept as an
 * explicit hook for future redactions.
 */
function sanitizeStateForClient(state: SocialSessionState): SocialSessionState {
  return { ...state };
}

async function buildClientState(state: SocialSessionState): Promise<SocialSessionState> {
  const joinedParticipants = await listParticipants(state.socialSessionId);
  return sanitizeStateForClient({
    ...state,
    joinedParticipants,
  });
}

function hydrateDerivedState(state: SocialSessionState): SocialSessionState {
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

function getUniqueUserCount(userIds?: string[]): number {
  return new Set(userIds || []).size;
}

function hasAllRosterParticipantsResponded(userIds: string[] | undefined, playerCount: number): boolean {
  return getUniqueUserCount(userIds) >= playerCount;
}

function getMicroChallengeDeadlineMs(state: SocialSessionState): number | null {
  if (!state.currentChallenge?.durationSeconds) return null;
  return state.phaseStartedAt + state.currentChallenge.durationSeconds * 1000;
}

function incrementCommonGround(state: SocialSessionState): void {
  state.commonGroundCount = Math.max(0, state.commonGroundCount || 0) + 1;
}

function getCurrentLieDetectivePlayer(state: SocialSessionState): LieDetectivePlayer | null {
  const currentIndex = state.currentLieDetectivePlayerIndex ?? 0;
  return state.lieDetectivePlayers?.[currentIndex] ?? null;
}

/**
 * Look up a session and write structured errors for missing vs expired.
 * Returns the state on success, or null after sending the HTTP response.
 */
async function resolveSession(
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
  return hydrateDerivedState({ ...state });
}

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/start
// ---------------------------------------------------------------------------
router.post('/start', async (req: any, res) => {
  const { sessionId, displayName, eventType } = req.body;
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const access = await getIcebreakerSessionParticipantAccess(sessionId, userId);
  if (!access.allowed) {
    return res.status(access.status).json(access.body);
  }

  // Check for an existing session by the icebreaker session key first.
  const existing = await getSessionByIcebreakerSessionId(sessionId);

  if (existing) {
    if (existing.expired) {
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }

    const state = existing.state;
    const existingParticipant = await getParticipant(existing.socialSessionId, userId);
    const participantDisplayName =
      displayName || existingParticipant?.displayName || state.hostDisplayName;

    // Register (or re-register) this participant and bump lastSeen.
    await upsertParticipant(existing.socialSessionId, userId, participantDisplayName);

    const rosterCount = await getRosterCount(existing.socialSessionId);
    const activeCount = await getActiveParticipantCount(existing.socialSessionId);

    state.playerCount = rosterCount;
    state.activePlayerCount = activeCount;
    // ensureSessionEnabledPhases mutates `state` in place for older persisted
    // sessions; only persist when that backfill actually changed the payload.
    const enabledPhasesBefore = JSON.stringify(state.enabledPhases ?? []);
    ensureSessionEnabledPhases(state);
    if (JSON.stringify(state.enabledPhases ?? []) !== enabledPhasesBefore) {
      await updateSession(existing.socialSessionId, state);
    }

    return res.json({
      socialSessionId: existing.socialSessionId,
      hostUserId: state.hostUserId,
      hostDisplayName: state.hostDisplayName,
      currentPhase: state.currentPhase,
      state: await buildClientState(state),
    });
  }

  // Create new social session — first caller becomes host.
  const socialSessionId = getSocialSessionId(sessionId);
  const now = Date.now();
  const newState: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId: sessionId,
    currentPhase: 'warmup',
    hostUserId: userId,
    hostDisplayName: displayName || '主持人',
    playerCount: 1,
    activePlayerCount: 1,
    phaseStartedAt: now,
    sessionStartedAt: now,
    completedPhases: [],
    eventType,
    enabledPhases: getServerEnabledPhases(),
    commonGroundCount: 0,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
  };

  try {
    await createSession(newState);
    await upsertParticipant(socialSessionId, userId, displayName || '主持人');
    logger.info('Started social icebreaker session', {
      sessionId,
      socialSessionId,
      userId,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const concurrent = await getSessionByIcebreakerSessionId(sessionId);
    if (!concurrent || concurrent.expired) {
      throw error;
    }

    const concurrentParticipant = await getParticipant(concurrent.socialSessionId, userId);
    const participantDisplayName =
      displayName || concurrentParticipant?.displayName || concurrent.state.hostDisplayName;

    await upsertParticipant(concurrent.socialSessionId, userId, participantDisplayName);

    const rosterCount = await getRosterCount(concurrent.socialSessionId);
    const activeCount = await getActiveParticipantCount(concurrent.socialSessionId);
    concurrent.state.playerCount = rosterCount;
    concurrent.state.activePlayerCount = activeCount;

    return res.json({
      socialSessionId: concurrent.socialSessionId,
      hostUserId: concurrent.state.hostUserId,
      hostDisplayName: concurrent.state.hostDisplayName,
      currentPhase: concurrent.state.currentPhase,
      state: await buildClientState(concurrent.state),
    });
  }

  return res.json({
    socialSessionId,
    hostUserId: newState.hostUserId,
    hostDisplayName: newState.hostDisplayName,
    currentPhase: newState.currentPhase,
    state: await buildClientState(newState),
  });
});

// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId
// ---------------------------------------------------------------------------
router.get('/:socialSessionId', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  ensureSessionEnabledPhases(state);

  if (userId) {
    // Bump lastSeen so polling counts as presence.
    await dbHeartbeat(socialSessionId, userId);
    const rosterCount = await getRosterCount(socialSessionId);
    const activeCount = await getActiveParticipantCount(socialSessionId);
    state.playerCount = rosterCount;
    state.activePlayerCount = activeCount;
  }

  return res.json(await buildClientState(state));
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/heartbeat
// ---------------------------------------------------------------------------
/**
 * Lightweight presence endpoint.  Clients call this every ~10 s to stay
 * "active" without triggering a full state reload.  The GET polling endpoint
 * also bumps lastSeen, so this is additive.
 */
router.post('/:socialSessionId/heartbeat', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { state, expired } = await getSessionWithExpiry(socialSessionId);
  if (!state) {
    if (expired) return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    return res.status(404).json({ error: 'Social session not found' });
  }

  await dbHeartbeat(socialSessionId, userId);
  const activeCount = await getActiveParticipantCount(socialSessionId);

  return res.json({ ok: true, activePlayerCount: activeCount });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/topics
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/topics', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { mood, eventType = '活动', participantCount = 4, avoidTopics } = req.body as {
    mood: AtmosphereMood;
    eventType?: string;
    participantCount?: number;
    avoidTopics?: string[];
  };

  if (!mood) {
    return res.status(400).json({ error: 'mood is required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.hostUserId !== userId) {
    return res.status(403).json({ error: 'Only the host can change topics' });
  }

  try {
    const topicResult = await generateWarmupTopics({
      mood,
      eventType,
      participantCount: state.playerCount || participantCount,
      avoidTopics,
    });

    state.warmupTopics = topicResult.data;
    state.warmupTopicsMeta = topicResult.meta;
    state.selectedMood = mood;
    state.currentTopicIndex = 0;
    state.warmupReadyUserIds = [];
    await updateSession(socialSessionId, state);

    return res.json({ topics: topicResult.data, meta: topicResult.meta });
  } catch (error) {
    console.error('[SocialIcebreaker] topics error:', error);
    return res.status(500).json({ error: 'Failed to generate topics' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/warmup/ready
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/warmup/ready', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { ready = true } = req.body as { ready?: boolean };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  if (state.currentPhase !== 'warmup') {
    return res.status(400).json({ error: 'Not in warmup phase' });
  }

  const readyUserIds = new Set(state.warmupReadyUserIds || []);
  if (ready) {
    readyUserIds.add(userId);
  } else {
    readyUserIds.delete(userId);
  }

  state.warmupReadyUserIds = [...readyUserIds];
  await updateSession(socialSessionId, state);

  return res.json({
    readyUserIds: state.warmupReadyUserIds,
    readyCount: state.warmupReadyUserIds.length,
    allReady: hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount),
    currentTopicIndex: state.currentTopicIndex ?? 0,
    commonGroundCount: state.commonGroundCount ?? 0,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/warmup/next-topic
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/warmup/next-topic', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.hostUserId !== userId) {
    return res.status(403).json({ error: 'Only the host can move to the next topic' });
  }

  if (state.currentPhase !== 'warmup') {
    return res.status(400).json({ error: 'Not in warmup phase' });
  }

  const topics = state.warmupTopics || [];
  if (topics.length === 0) {
    return res.status(400).json({ error: 'No warmup topics available' });
  }

  if (!hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount)) {
    return res.status(400).json({ error: 'All participants must be ready before changing topics' });
  }

  const currentTopicIndex = state.currentTopicIndex ?? 0;
  if (currentTopicIndex >= topics.length - 1) {
    return res.status(400).json({ error: 'No additional warmup topics remain' });
  }

  incrementCommonGround(state);
  state.currentTopicIndex = currentTopicIndex + 1;
  state.warmupReadyUserIds = [];
  await updateSession(socialSessionId, state);

  return res.json({
    currentTopicIndex: state.currentTopicIndex,
    currentTopic: state.warmupTopics?.[state.currentTopicIndex] ?? null,
    commonGroundCount: state.commonGroundCount ?? 0,
    state: await buildClientState(state),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/advance
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/advance', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { currentPhase } = req.body as { currentPhase: SocialIcebreakerPhase };

  if (!currentPhase) {
    return res.status(400).json({ error: 'currentPhase is required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.hostUserId !== userId) {
    return res.status(403).json({ error: 'Only the host can advance phases' });
  }

  if (state.currentPhase !== currentPhase) {
    return res.status(400).json({ error: 'Phase mismatch' });
  }

  if (currentPhase === 'warmup') {
    if (!hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount)) {
      return res.status(400).json({ error: 'All participants must be ready before advancing warmup' });
    }

    if ((state.warmupTopics || []).length === 0) {
      return res.status(400).json({ error: 'Warmup topics must be generated before advancing' });
    }

    incrementCommonGround(state);
  }

  if (currentPhase === 'micro_challenge') {
    const challengeDeadlineMs = getMicroChallengeDeadlineMs(state);
    const everyoneCompleted = hasAllRosterParticipantsResponded(state.challengeCompletedBy, state.playerCount);
    const timerExpired = challengeDeadlineMs !== null && Date.now() >= challengeDeadlineMs;

    if (!everyoneCompleted && !timerExpired) {
      return res.status(400).json({ error: 'Wait for everyone to finish or for the timer to expire' });
    }
  }

  if (currentPhase === 'lie_detective') {
    const generatedPlayers = state.lieDetectivePlayers || [];
    const currentPlayer = getCurrentLieDetectivePlayer(state);

    if (generatedPlayers.length < state.playerCount) {
      return res.status(400).json({ error: 'All participants must generate statements before leaving lie_detective' });
    }

    if (!currentPlayer || state.currentLieDetectivePlayerIndex !== generatedPlayers.length - 1) {
      return res.status(400).json({ error: 'Finish every lie-detective turn before advancing' });
    }

    const reveal = state.currentLieDetectiveReveal;
    if (!reveal || reveal.targetUserId !== currentPlayer.userId) {
      return res.status(400).json({ error: 'The current lie-detective turn must be revealed before advancing' });
    }

    if (!hasAllRosterParticipantsResponded(state.lieDetectiveCompletedUserIds, state.playerCount)) {
      return res.status(400).json({ error: 'Every lie-detective turn must be completed before advancing' });
    }
  }

  const resolvedEnabledPhases = ensureSessionEnabledPhases(state);
  const effectiveNextPhase = getNextEligiblePhase(currentPhase, resolvedEnabledPhases, state.playerCount);

  if (!state.completedPhases.includes(currentPhase)) {
    state.completedPhases = [...(state.completedPhases || []), currentPhase];
  }

  cleanupPhaseStateForNextPhase(state, currentPhase);
  state.currentPhase = effectiveNextPhase;
  state.phaseStartedAt = Date.now();
  state.pulseChecks = [];
  if (effectiveNextPhase === 'warmup') {
    state.warmupReadyUserIds = [];
  }
  await updateSession(socialSessionId, state);

  let content: any = null;
  let meta: AIResponseMeta | undefined;
  if (effectiveNextPhase === 'micro_challenge') {
    try {
      const challengeResult = await generateMicroChallenges({
        eventType: state.eventType || '活动',
        participantCount: state.playerCount,
      });
      state.currentChallenge = challengeResult.data[0];
      state.currentChallengeMeta = challengeResult.meta;
      state.challengeCompletedBy = [];
      await updateSession(socialSessionId, state);
      content = { challenge: state.currentChallenge };
      meta = challengeResult.meta;
    } catch {
      // fallback silently handled in AI service
    }
  }

  const comment = await generateXiaoYueComment({
    phase: effectiveNextPhase,
    event: 'phase_start',
  }).catch(() => '');

  return res.json({
    nextPhase: effectiveNextPhase,
    content,
    xiaoYueComment: comment,
    meta,
    state: await buildClientState(state),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/pulse-check
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/pulse-check', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { vibe } = req.body as { vibe: number };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (typeof vibe !== 'number' || ![1, 2, 3].includes(vibe)) {
    return res.status(400).json({ error: 'vibe must be 1, 2, or 3' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const pulseChecks = state.pulseChecks || [];
  const existingIdx = pulseChecks.findIndex((p: PulseCheckResult) => p.userId === userId);
  const vibeValue = vibe as 1 | 2 | 3;
  if (existingIdx >= 0) {
    pulseChecks[existingIdx].vibe = vibeValue;
  } else {
    pulseChecks.push({ userId, vibe: vibeValue });
  }
  state.pulseChecks = pulseChecks;
  await updateSession(socialSessionId, state);

  const voteCount = pulseChecks.length;
  const averageVibe = pulseChecks.reduce((sum: number, p: PulseCheckResult) => sum + p.vibe, 0) / voteCount;

  return res.json({
    voteCount,
    averageVibe: Math.round(averageVibe * 10) / 10,
    allVoted: voteCount >= state.playerCount,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/micro-challenge/complete
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/micro-challenge/complete', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'micro_challenge') {
    return res.status(400).json({ error: 'Not in micro_challenge phase' });
  }

  const completedBy = state.challengeCompletedBy || [];
  if (!completedBy.includes(userId)) {
    completedBy.push(userId);
    state.challengeCompletedBy = completedBy;
    await updateSession(socialSessionId, state);
  }

  return res.json({
    completedBy: state.challengeCompletedBy,
    completedCount: completedBy.length,
    totalCount: state.playerCount,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/lie-detective/generate
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { displayName, archetype, interests } = req.body as {
    displayName: string;
    archetype?: string;
    interests?: string[];
  };

  if (!userId || !displayName) {
    return res.status(400).json({ error: 'Authentication and displayName are required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // F3: Wrong-phase guard — statement generation is only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  try {
    const statementResult = await generateLieDetectiveStatements({
      userId,
      displayName,
      archetype,
      interests,
    });

    // Persist server-only truth data (isLie) in the separate lie-truths table.
    await setLieTruths(socialSessionId, userId, statementResult.data);

    // Store sanitized statements (no isLie) in public session state.
    const players: LieDetectivePlayer[] = state.lieDetectivePlayers || [];
    const existingPlayer = players.findIndex((p: LieDetectivePlayer) => p.userId === userId);
    const sanitizedStatements = statementResult.data.map(s => ({ index: s.index, text: s.text }));

    if (existingPlayer >= 0) {
      players[existingPlayer].statements = sanitizedStatements;
    } else {
      players.push({ userId, displayName, statements: sanitizedStatements });
    }

    state.lieDetectivePlayers = players;
    if (state.currentLieDetectivePlayerIndex === undefined) {
      state.currentLieDetectivePlayerIndex = 0;
    }
    state.lieDetectiveCompletedUserIds = state.lieDetectiveCompletedUserIds || [];
    state.currentLieDetectiveReveal = undefined;
    state.votes = state.votes || [];
    await updateSession(socialSessionId, state);

    return res.json({ statements: sanitizedStatements, meta: statementResult.meta });
  } catch (error) {
    console.error('[SocialIcebreaker] lie-detective/generate error:', error);
    return res.status(500).json({ error: 'Failed to generate statements' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/lie-detective/vote
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/vote', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const voterId: string = req.session?.userId;
  const { targetUserId, guessedStatementIndex } = req.body as {
    targetUserId: string;
    guessedStatementIndex: number;
  };

  if (!voterId || !targetUserId || guessedStatementIndex === undefined || guessedStatementIndex === null) {
    return res.status(400).json({ error: 'Authentication, targetUserId, and guessedStatementIndex are required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // F3: Wrong-phase guard — votes are only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  if (voterId === targetUserId) {
    return res.status(400).json({ error: 'Players cannot vote on their own statements' });
  }

  const currentPlayer = getCurrentLieDetectivePlayer(state);
  if (!currentPlayer || currentPlayer.userId !== targetUserId) {
    return res.status(400).json({ error: 'Votes are only allowed for the active lie-detective player' });
  }

  if ((state.lieDetectivePlayers || []).length < state.playerCount) {
    return res.status(400).json({ error: 'All participants must generate statements before voting begins' });
  }

  if (state.currentLieDetectiveReveal?.targetUserId === targetUserId) {
    return res.json({
      votes: (state.votes || []).filter((v: LieDetectiveVote) => v.targetUserId === targetUserId),
      isRevealed: true,
      lieIndex: state.currentLieDetectiveReveal.lieIndex,
      reveal: state.currentLieDetectiveReveal,
    });
  }

  const votes: LieDetectiveVote[] = state.votes || [];
  const existingVoteIdx = votes.findIndex(
    (v: LieDetectiveVote) => v.voterId === voterId && v.targetUserId === targetUserId,
  );
  if (existingVoteIdx >= 0) {
    votes[existingVoteIdx].guessedStatementIndex = guessedStatementIndex;
  } else {
    votes.push({ voterId, targetUserId, guessedStatementIndex });
  }
  state.votes = votes;
  await updateSession(socialSessionId, state);

  const otherPlayerCount = Math.max(0, state.playerCount - 1);
  const votesForTarget = votes.filter((v: LieDetectiveVote) => v.targetUserId === targetUserId).length;
  const isRevealed = votesForTarget >= otherPlayerCount && otherPlayerCount > 0;

  let lieIndex: number | undefined;
  let reveal: LieDetectiveReveal | undefined;
  if (isRevealed) {
    // Fetch server-only truth from the separate table (never from stateJson).
    const playerStatements = await getLieTruths(socialSessionId, targetUserId);
    lieIndex = playerStatements?.find(s => s.isLie)?.index;
    if (lieIndex !== undefined) {
      const correctVoteCount = votes
        .filter((v: LieDetectiveVote) => v.targetUserId === targetUserId && v.guessedStatementIndex === lieIndex)
        .length;
      reveal = {
        targetUserId,
        lieIndex,
        voteCount: votesForTarget,
        correctVoteCount,
        revealedAt: Date.now(),
      };
      state.currentLieDetectiveReveal = reveal;
      const completedUserIds = new Set(state.lieDetectiveCompletedUserIds || []);
      completedUserIds.add(targetUserId);
      state.lieDetectiveCompletedUserIds = [...completedUserIds];
      await updateSession(socialSessionId, state);
    }
  }

  return res.json({
    votes: votes.filter((v: LieDetectiveVote) => v.targetUserId === targetUserId),
    isRevealed,
    lieIndex,
    reveal,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/lie-detective/next-player
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/next-player', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.hostUserId !== userId) {
    return res.status(403).json({ error: 'Only the host can advance lie-detective turns' });
  }

  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  const currentPlayer = getCurrentLieDetectivePlayer(state);
  if (!currentPlayer) {
    return res.status(400).json({ error: 'No active lie-detective player' });
  }

  if (state.currentLieDetectiveReveal?.targetUserId !== currentPlayer.userId) {
    return res.status(400).json({ error: 'Reveal the current lie before moving on' });
  }

  const players = state.lieDetectivePlayers || [];
  const currentIndex = state.currentLieDetectivePlayerIndex ?? 0;
  if (currentIndex >= players.length - 1) {
    return res.status(400).json({ error: 'No additional lie-detective players remain' });
  }

  state.currentLieDetectivePlayerIndex = currentIndex + 1;
  state.currentLieDetectiveReveal = undefined;
  await updateSession(socialSessionId, state);

  return res.json({
    currentLieDetectivePlayerIndex: state.currentLieDetectivePlayerIndex,
    currentPlayer: getCurrentLieDetectivePlayer(state),
    state: await buildClientState(state),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/personality-dice/generate
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/personality-dice/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { participants } = req.body as {
    participants: Array<{ userId: string; displayName: string; archetype?: string; traitScores?: Record<string, number> }>;
  };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.hostUserId !== userId) {
    return res.status(403).json({ error: 'Only the host can generate dice challenges' });
  }

  if (state.currentPhase !== 'personality_dice') {
    return res.status(400).json({ error: 'Not in personality_dice phase' });
  }

  // Idempotent retry: if challenges already exist, return them instead of regenerating
  if ((state.personalityDiceChallenges || []).length > 0) {
    const cachedMeta = state.personalityDiceChallengesMeta
      ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-personality-dice-v1');
    return res.json({ challenges: state.personalityDiceChallenges, meta: cachedMeta });
  }

  try {
    const challengeResult = await generatePersonalityDiceChallenges(participants || []);
    state.personalityDiceChallenges = challengeResult.data;
    state.personalityDiceChallengesMeta = challengeResult.meta;
    state.currentDicePlayerIndex = 0;
    state.diceCompletedBy = [];
    await updateSession(socialSessionId, state);

    return res.json({ challenges: challengeResult.data, meta: challengeResult.meta });
  } catch (error) {
    console.error('[SocialIcebreaker] personality-dice/generate error:', error);
    return res.status(500).json({ error: 'Failed to generate dice challenges' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/personality-dice/complete
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/personality-dice/complete', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const diceCompletedBy = state.diceCompletedBy || [];
  if (!diceCompletedBy.includes(userId)) {
    diceCompletedBy.push(userId);
    state.diceCompletedBy = diceCompletedBy;
  }

  const challenges = state.personalityDiceChallenges || [];
  const currentIdx = state.currentDicePlayerIndex ?? 0;
  if (challenges[currentIdx]?.userId === userId) {
    state.currentDicePlayerIndex = Math.min(currentIdx + 1, challenges.length - 1);
  }

  await updateSession(socialSessionId, state);

  const allCompleted = challenges.length > 0 && diceCompletedBy.length >= challenges.length;

  return res.json({
    diceCompletedBy,
    currentDicePlayerIndex: state.currentDicePlayerIndex,
    allCompleted,
  });
});

// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId/recap
// ---------------------------------------------------------------------------
router.get('/:socialSessionId/recap', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const durationMinutes = Math.round((Date.now() - (state.sessionStartedAt || state.phaseStartedAt)) / 60000);

  interface Medal {
    emoji: string;
    title: string;
    recipientDisplayName: string;
    description: string;
  }
  const medals: Medal[] = [];

  // Fetch lie truths from the separate server-only table for medal computation.
  const sessionLieMap = await getAllSessionLieTruths(socialSessionId);

  // 🕵️ 最佳侦探: most correct lie guesses
  if (sessionLieMap.size > 0 && (state.votes || []).length > 0) {
    const correctByVoter: Record<string, number> = {};
    for (const vote of state.votes || []) {
      const playerStmts = sessionLieMap.get(vote.targetUserId);
      const lieStmt = playerStmts?.find(s => s.isLie);
      if (lieStmt && vote.guessedStatementIndex === lieStmt.index) {
        correctByVoter[vote.voterId] = (correctByVoter[vote.voterId] || 0) + 1;
      }
    }
    const topVoter = Object.entries(correctByVoter).sort((a, b) => b[1] - a[1])[0];
    if (topVoter && topVoter[1] > 0) {
      const allPlayers = [
        ...(state.lieDetectivePlayers || []),
        { userId: state.hostUserId, displayName: state.hostDisplayName },
      ];
      const recipient = allPlayers.find(p => p.userId === topVoter[0]);
      if (recipient) {
        medals.push({
          emoji: '🕵️',
          title: '最佳侦探',
          recipientDisplayName: recipient.displayName,
          description: `猜对了 ${topVoter[1]} 个谎言`,
        });
      }
    }
  }

  // ⚡ 挑战先锋: first person in challengeCompletedBy
  if (state.challengeCompletedBy && state.challengeCompletedBy.length > 0) {
    const firstUserId = state.challengeCompletedBy[0];
    const allPlayersForChallenge = [
      ...(state.lieDetectivePlayers || []),
      { userId: state.hostUserId, displayName: state.hostDisplayName },
    ];
    const recipient = allPlayersForChallenge.find(p => p.userId === firstUserId);
    if (recipient) {
      medals.push({
        emoji: '⚡',
        title: '挑战先锋',
        recipientDisplayName: recipient.displayName,
        description: '第一个完成挑战',
      });
    }
  }

  // 💬 话题王
  const MIN_TOPICS_FOR_MEDAL = 3;
  if ((state.currentTopicIndex ?? 0) >= MIN_TOPICS_FOR_MEDAL - 1) {
    medals.push({
      emoji: '💬',
      title: '话题王',
      recipientDisplayName: state.hostDisplayName,
      description: '带领大家聊了多个精彩话题',
    });
  }

  try {
    const players = state.lieDetectivePlayers || [];
    const summaryResult = await generateRecapSummary({
      participants: players.map((p: LieDetectivePlayer) => ({ displayName: p.displayName })),
      topicsDiscussed: (state.warmupTopics || []).slice(0, (state.currentTopicIndex ?? 0) + 1).map(t => t.question),
      challengesCompleted: state.challengeCompletedBy?.length || 0,
      commonGroundCount: state.commonGroundCount || 0,
      durationMinutes,
    });

    return res.json({ summary: summaryResult.data, meta: summaryResult.meta, medals, state: await buildClientState(state) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate recap' });
  }
});

export default router;
