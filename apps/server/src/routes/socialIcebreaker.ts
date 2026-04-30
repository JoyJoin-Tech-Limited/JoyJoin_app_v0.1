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
import {
  getNextEligiblePhase,
  AUCTION_STARTING_COINS,
} from '@shared/socialIcebreaker';
import {
  generateWarmupTopics,
  generateMicroChallenges,
  generateLieDetectiveStatements,
  generateXiaoYueComment,
  generateRecapSummary,
  generatePersonalityDiceChallenges,
  generateAuctionLots,
  generateXiaoyueSessionPack,
  generateQuipBattlePrompts,
  generateUndercoverWordPair,
  generateGroupMirrorQuestions,
} from '../socialIcebreakerAIService';
import { generateXiaoyueAdaptiveSuggestion } from '../xiaoyueAdaptiveEngine';
import { buildCachedAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import {
  cleanupPhaseStateForNextPhase,
  ensureSessionEnabledPhases,
  getServerEnabledPhases,
} from '../socialIcebreakerPhaseConfig';
import { DEFAULT_STANDARD_RUN_PLAN } from '@shared/phaseRegistry';
import { socialIcebreakerAiFeedbackRepo } from '../repositories/socialIcebreakerAiFeedbackRepo';
import { submitSocialIcebreakerAiFeedbackSchema } from '@shared/schema';
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
  loadSessionLieTruths,
  savePulseCheck,
  getPhaseRatings,
  logMomentCardInteraction,
  getMomentCardStats,
} from '../lib/socialIcebreakerStore';
import { getIcebreakerSessionParticipantAccess } from '../lib/icebreakerAccess';
import { buildMomentCardPayload } from '../lib/momentCardPayload';
import { curateMedals } from '../lib/medalCuration';
import { logger } from '../lib/logger';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import { startSocialIcebreakerSweep } from '../lib/socialIcebreakerSweep';
import {
  isUniqueConstraintError,
  sanitizeStateForClient,
  buildClientState,
  hydrateDerivedState,
  getUniqueUserCount,
  hasAllRosterParticipantsResponded,
  getMicroChallengeDeadlineMs,
  recapDisplayNameByUserId,
  buildLieDetectiveRecapHighlights,
  buildPersonalityDiceRecapLines,
  buildMiniScriptRecapLine,
  buildAuctionRecapLines,
  buildRecapParticipants,
  incrementCommonGround,
  getCurrentLieDetectivePlayer,
  resolveSession,
  isHostAuthorized,
} from './socialIcebreakerHelpers';

const router = Router();

// ============ TTL / CLEANUP ============
// Sweep expired sessions from the DB every 5 minutes. Fail open if the store
// is unavailable so the route module does not take down the server process.
startSocialIcebreakerSweep();

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
      state: await buildClientState(state, userId),
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
    autoAdvanceEnabled: true,
    runPlan: DEFAULT_STANDARD_RUN_PLAN,
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

  return res.json(await buildClientState(state, userId));
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

  if (!isHostAuthorized(state, userId)) {
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
    logger.error('[SocialIcebreaker] topics error:', { error });
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

  if (!isHostAuthorized(state, userId)) {
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
    state: await buildClientState(state, userId),
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

  if (!isHostAuthorized(state, userId)) {
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

  if (currentPhase === 'auction') {
    if (!state.auctionAllLotsClosed) {
      return res.status(400).json({
        error: 'Host must close every auction lot (use close-lot) before advancing out of auction',
      });
    }
  }

  if (currentPhase === 'mini_script') {
    // Must have framework
    if (!state.miniScriptFramework) {
      return res.status(400).json({
        error: 'MINI_SCRIPT_NOT_GENERATED',
        message: '剧本尚未生成，请先配置风格与题材并生成剧本',
      });
    }
    // Must have assigned roles
    if (!state.miniScriptRoleAssignments || Object.keys(state.miniScriptRoleAssignments).length < state.playerCount) {
      return res.status(400).json({ error: 'Roles not assigned' });
    }
    // Must have revealed all acts
    const totalActs = state.miniScriptFramework.act_flow.length;
    if ((state.miniScriptCurrentAct ?? 0) < totalActs) {
      return res.status(400).json({ error: 'Not all acts revealed' });
    }
    // Must have solution revealed
    if (!state.miniScriptSolutionRevealed) {
      return res.status(400).json({ error: 'Solution not revealed' });
    }
  }

  if (currentPhase === 'undercover_word') {
    if (!state.undercoverWordPair) {
      return res.status(400).json({ error: 'Word pair not generated' });
    }
    if (!state.undercoverWordRevealed) {
      return res.status(400).json({ error: 'Undercover word must be revealed before advancing' });
    }
  }

  if (currentPhase === 'group_mirror') {
    if (!state.groupMirrorQuestions || state.groupMirrorQuestions.length === 0) {
      return res.status(400).json({ error: 'Group mirror questions not generated' });
    }
    if (!state.groupMirrorRevealed) {
      return res.status(400).json({ error: 'Group mirror results must be revealed before advancing' });
    }
  }

  const effectiveNextPhase = getNextEligiblePhase(currentPhase, state);

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

  if (effectiveNextPhase === 'recap') {
    if (!state.recapSnapshot) {
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
        };
        await updateSession(socialSessionId, state);
      } catch (error) {
        logger.error('[SocialIcebreaker] Failed to generate recap snapshot:', { error: String(error) });
        // Continue without snapshot — GET /recap and GET /moment-card will fall back
      }
    }
  }

  let content: any = null;
  let meta: AIResponseMeta | undefined;
  if (effectiveNextPhase === 'micro_challenge') {
    try {
      const challengeResult = await generateMicroChallenges({
        eventType: state.eventType || '活动',
        participantCount: state.playerCount,
        seed: socialSessionId,
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

  const xyResult = await generateXiaoYueComment({
    phase: effectiveNextPhase,
    event: 'phase_start',
  }).catch(
    (): { data: string; meta: AIResponseMeta } => ({
      data: '',
      meta: {
        generatedAt: new Date().toISOString(),
        fromCache: false,
        provider: null,
        fallbackUsed: false,
      },
    }),
  );

  return res.json({
    nextPhase: effectiveNextPhase,
    content,
    xiaoYueComment: xyResult.data,
    xiaoYueCommentMeta: xyResult.meta,
    meta,
    state: await buildClientState(state, userId),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/pulse-check
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/pulse-check', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { vibe, phase } = req.body as { vibe: number; phase?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (typeof vibe !== 'number' || ![1, 2, 3].includes(vibe)) {
    return res.status(400).json({ error: 'vibe must be 1, 2, or 3' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // Persist to session state (existing behavior)
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

  // Persist to DB for analytics (new v2 instrumentation)
  const phaseName = phase || state.currentPhase || 'unknown';
  await savePulseCheck(socialSessionId, userId, phaseName, vibe).catch(() => {
    // Fire-and-forget: don't fail the user request if DB write fails
  });

  const voteCount = pulseChecks.length;
  const averageVibe = pulseChecks.reduce((sum: number, p: PulseCheckResult) => sum + p.vibe, 0) / voteCount;

  return res.json({
    voteCount,
    averageVibe: Math.round(averageVibe * 10) / 10,
    allVoted: voteCount >= state.playerCount,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/moment-card-event
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/moment-card-event', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { action, deviceInfo } = req.body as { action: string; deviceInfo?: Record<string, unknown> };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!action || !['save', 'share', 'qr_scan'].includes(action)) {
    return res.status(400).json({ error: 'action must be save, share, or qr_scan' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await logMomentCardInteraction(socialSessionId, userId, action, deviceInfo).catch(() => {
    // Fire-and-forget telemetry
  });

  return res.json({ success: true });
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
// POST /api/social-icebreaker/:socialSessionId/micro-challenge/generate
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/micro-challenge/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!isHostAuthorized(state, userId)) {
    return res.status(403).json({ error: 'Only the host can generate challenges' });
  }

  if (state.currentPhase !== 'micro_challenge') {
    return res.status(400).json({ error: 'Not in micro_challenge phase' });
  }

  // Idempotent retry: if a challenge already exists, return it instead of regenerating
  if (state.currentChallenge) {
    const cachedMeta = state.currentChallengeMeta
      ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-micro-challenge-v1');
    return res.json({ challenge: state.currentChallenge, meta: cachedMeta });
  }

  try {
    const challengeResult = await generateMicroChallenges({
      eventType: state.eventType || '活动',
      participantCount: state.playerCount,
      seed: socialSessionId,
    });
    state.currentChallenge = challengeResult.data[0];
    state.currentChallengeMeta = challengeResult.meta;
    state.challengeCompletedBy = [];
    await updateSession(socialSessionId, state);

    return res.json({ challenge: state.currentChallenge, meta: challengeResult.meta });
  } catch (error) {
    logger.error('[SocialIcebreaker] micro-challenge/generate error:', { error });
    return res.status(500).json({ error: 'Failed to generate micro-challenge' });
  }
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
    logger.error('[SocialIcebreaker] lie-detective/generate error:', { error });
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

  if (!isHostAuthorized(state, userId)) {
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
    state: await buildClientState(state, userId),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/auction/generate-lots
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/auction/generate-lots', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!isHostAuthorized(state, userId)) {
    return res.status(403).json({ error: 'Only the host can generate auction lots' });
  }

  if (state.currentPhase !== 'auction') {
    return res.status(400).json({ error: 'Not in auction phase' });
  }

  if ((state.auctionLots || []).length > 0) {
    const cachedMeta =
      state.auctionLotsMeta ??
      buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-auction-lots-v1');
    return res.json({
      lots: state.auctionLots,
      meta: cachedMeta,
      balances: state.auctionBalances,
      currentLotIndex: state.auctionCurrentLotIndex ?? 0,
      state: await buildClientState(state, userId),
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const lotResult = await generateAuctionLots({
      participantCount: Math.max(state.playerCount, roster.length || 1),
      eventType: state.eventType,
    });
    const balances: Record<string, number> = {};
    for (const p of roster) {
      balances[p.userId] = AUCTION_STARTING_COINS;
    }
    if (!balances[state.hostUserId]) {
      balances[state.hostUserId] = AUCTION_STARTING_COINS;
    }

    state.auctionLots = lotResult.data;
    state.auctionLotsMeta = lotResult.meta;
    state.auctionBalances = balances;
    state.auctionCurrentLotIndex = 0;
    state.auctionHighBid = null;
    state.auctionAllLotsClosed = false;
    state.auctionRecapLines = [];
    await updateSession(socialSessionId, state);

    return res.json({
      lots: lotResult.data,
      meta: lotResult.meta,
      balances: state.auctionBalances,
      currentLotIndex: 0,
      state: await buildClientState(state, userId),
    });
  } catch (error) {
    logger.error('[SocialIcebreaker] auction/generate-lots error:', { error });
    return res.status(500).json({ error: 'Failed to generate auction lots' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/xiaoyue/session-pack
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/xiaoyue/session-pack', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!isHostAuthorized(state, userId)) {
    return res.status(403).json({ error: 'Only the host can generate a session pack' });
  }

  if (state.currentPhase !== 'warmup') {
    return res.status(400).json({ error: 'Session pack can only be generated during warmup phase' });
  }

  if (state.xiaoyueSessionPack) {
    const cachedMeta = {
      ...(state.xiaoyueSessionPackMeta ??
        buildCachedAIMeta(state.xiaoyueSessionPack.generatedAt, null, 'social-session-pack-v1')),
      fromCache: true,
    };
    return res.json({
      pack: state.xiaoyueSessionPack,
      meta: cachedMeta,
      state: await buildClientState(state, userId),
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const packResult = await generateXiaoyueSessionPack({
      participants: roster.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
      })),
      eventType: state.eventType,
      playerCount: Math.max(state.playerCount, roster.length || 1),
    });

    state.xiaoyueSessionPack = packResult.data;
    state.xiaoyueSessionPackMeta = packResult.meta;
    await updateSession(socialSessionId, state);

    return res.json({
      pack: packResult.data,
      meta: packResult.meta,
      state: await buildClientState(state, userId),
    });
  } catch (error) {
    logger.error('[SocialIcebreaker] xiaoyue/session-pack error:', { error });
    return res.status(500).json({ error: 'Failed to generate session pack' });
  }
});


// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/xiaoyue/adaptive-suggestion
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/xiaoyue/adaptive-suggestion', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!isHostAuthorized(state, userId)) {
    return res.status(403).json({ error: 'Only the host can request adaptive suggestions' });
  }

  // Adaptive suggestions are meaningful only during active phases
  if (state.currentPhase === 'recap') {
    return res.status(400).json({ error: 'Adaptive suggestions are not available during recap' });
  }

  try {
    const suggestion = generateXiaoyueAdaptiveSuggestion(state);
    state.xiaoyueAdaptiveSuggestion = suggestion;
    await updateSession(socialSessionId, state);

    return res.json({
      suggestion,
      state: await buildClientState(state, userId),
    });
  } catch (error) {
    logger.error('[SocialIcebreaker] xiaoyue/adaptive-suggestion error:', { error });
    return res.status(500).json({ error: 'Failed to generate adaptive suggestion' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/auction/bid
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/auction/bid', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { amount } = req.body as { amount?: number };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'auction') {
    return res.status(400).json({ error: 'Not in auction phase' });
  }

  const lots = state.auctionLots || [];
  if (lots.length === 0) {
    return res.status(400).json({ error: 'Auction lots have not been generated yet' });
  }

  if (state.auctionAllLotsClosed) {
    return res.status(400).json({ error: 'Auction is complete' });
  }

  if (typeof amount !== 'number' || !Number.isFinite(amount) || !Number.isInteger(amount) || amount < 1) {
    return res.status(400).json({ error: 'amount must be a positive integer' });
  }

  const balances = { ...(state.auctionBalances || {}) };
  const available = balances[userId] ?? 0;
  const high = state.auctionHighBid;

  if (high && amount <= high.amount) {
    return res.status(400).json({ error: 'Bid must be higher than the current high bid' });
  }

  if (amount > available) {
    return res.status(400).json({ error: 'Insufficient virtual coins for this bid' });
  }

  if (high) {
    balances[high.userId] = (balances[high.userId] ?? 0) + high.amount;
  }

  balances[userId] = available - amount;
  state.auctionBalances = balances;
  state.auctionHighBid = { userId, amount };

  await updateSession(socialSessionId, state);

  return res.json({
    highBid: state.auctionHighBid,
    balances: state.auctionBalances,
    state: await buildClientState(state, userId),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/auction/close-lot
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/auction/close-lot', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!isHostAuthorized(state, userId)) {
    return res.status(403).json({ error: 'Only the host can close an auction lot' });
  }

  if (state.currentPhase !== 'auction') {
    return res.status(400).json({ error: 'Not in auction phase' });
  }

  const lots = state.auctionLots || [];
  const idx = state.auctionCurrentLotIndex ?? 0;
  if (lots.length === 0 || idx >= lots.length) {
    return res.status(400).json({ error: 'No active auction lot' });
  }

  if (state.auctionAllLotsClosed) {
    return res.status(400).json({ error: 'All auction lots are already closed' });
  }

  const lot = lots[idx];
  const high = state.auctionHighBid;
  const roster = await listParticipants(socialSessionId);
  const nameOf = (uid: string) =>
    recapDisplayNameByUserId(roster, state, uid);

  const lines = [...(state.auctionRecapLines || [])];
  if (high) {
    lines.push(`${lot.title}由${nameOf(high.userId)}以${high.amount}虚拟币拍下`);
  } else {
    lines.push(`${lot.title}流拍（无人出价）`);
  }

  state.auctionRecapLines = lines.slice(0, 16);
  state.auctionHighBid = null;

  if (idx >= lots.length - 1) {
    state.auctionAllLotsClosed = true;
  } else {
    state.auctionCurrentLotIndex = idx + 1;
  }

  await updateSession(socialSessionId, state);

  return res.json({
    currentLotIndex: state.auctionCurrentLotIndex ?? 0,
    allLotsClosed: state.auctionAllLotsClosed ?? false,
    recapLines: state.auctionRecapLines,
    state: await buildClientState(state, userId),
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

  if (!isHostAuthorized(state, userId)) {
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
    const challengeResult = await generatePersonalityDiceChallenges({ participants: participants || [] });
    state.personalityDiceChallenges = challengeResult.data;
    state.personalityDiceChallengesMeta = challengeResult.meta;
    state.currentDicePlayerIndex = 0;
    state.diceCompletedBy = [];
    state.dicePassedBy = [];
    await updateSession(socialSessionId, state);

    return res.json({ challenges: challengeResult.data, meta: challengeResult.meta });
  } catch (error) {
    logger.error('[SocialIcebreaker] personality-dice/generate error:', { error });
    return res.status(500).json({ error: 'Failed to generate dice challenges' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/personality-dice/complete
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/personality-dice/complete', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { pass } = req.body as { pass?: boolean };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'personality_dice') {
    return res.status(400).json({ error: 'Not in personality_dice phase' });
  }

  const diceCompletedBy = state.diceCompletedBy || [];
  const dicePassedBy = state.dicePassedBy || [];

  if (pass === true) {
    if (!dicePassedBy.includes(userId)) {
      dicePassedBy.push(userId);
      state.dicePassedBy = dicePassedBy;
    }
  } else {
    if (!diceCompletedBy.includes(userId)) {
      diceCompletedBy.push(userId);
      state.diceCompletedBy = diceCompletedBy;
    }
  }

  const challenges = state.personalityDiceChallenges || [];
  const currentIdx = state.currentDicePlayerIndex ?? 0;
  if (challenges[currentIdx]?.userId === userId) {
    state.currentDicePlayerIndex = Math.min(currentIdx + 1, challenges.length - 1);
  }

  await updateSession(socialSessionId, state);

  const allResponded = challenges.length > 0 && (diceCompletedBy.length + dicePassedBy.length) >= challenges.length;

  return res.json({
    diceCompletedBy,
    dicePassedBy,
    currentDicePlayerIndex: state.currentDicePlayerIndex,
    allCompleted: allResponded,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/quip-battle/generate
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/quip-battle/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const roster = await listParticipants(socialSessionId);
  const participantList = roster.map((p) => ({
    displayName: p.displayName,
    archetype: p.archetype,
  }));

  try {
    const result = await generateQuipBattlePrompts({
      eventType: state.eventType || '活动',
      participantCount: roster.length,
      participants: participantList,
    });

    state.quipBattlePrompts = result.data;
    state.quipBattlePromptsMeta = result.meta;
    await updateSession(socialSessionId, state);

    return res.json({ prompts: result.data, meta: result.meta });
  } catch (error) {
    logger.error('[SocialIcebreaker] generateQuipBattlePrompts error:', { error: String(error) });
    return res.status(500).json({ error: 'Failed to generate quip battle prompts' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/quip-battle/submit
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/quip-battle/submit', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { answers } = req.body as { answers: Array<{ promptId: string; answerText: string }> };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers array required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const participant = await getParticipant(socialSessionId, userId);
  const displayName = participant?.displayName || '匿名';

  const existingAnswers = state.quipBattleAnswers || [];
  const newAnswers = answers.map((a) => ({
    userId,
    displayName,
    promptId: a.promptId,
    answerText: a.answerText.slice(0, 100),
  }));

  state.quipBattleAnswers = [...existingAnswers, ...newAnswers];

  const submittedUserIds = state.quipBattleSubmittedUserIds || [];
  if (!submittedUserIds.includes(userId)) {
    submittedUserIds.push(userId);
    state.quipBattleSubmittedUserIds = submittedUserIds;
  }

  await updateSession(socialSessionId, state);

  return res.json({ submitted: true, totalAnswers: state.quipBattleAnswers.length });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/quip-battle/vote
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/quip-battle/vote', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { votes } = req.body as { votes: Array<{ answerId: string; promptId: string }> };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!votes || !Array.isArray(votes)) {
    return res.status(400).json({ error: 'votes array required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const existingVotes = state.quipBattleVotes || [];
  const newVotes = votes.map((v) => ({
    voterId: userId,
    answerId: v.answerId,
    promptId: v.promptId,
  }));

  // Filter out duplicate votes by same voter for same prompt
  const voteKey = (v: any) => `${v.voterId}::${v.promptId}`;
  const voteMap = new Map<string, any>();
  for (const v of [...existingVotes, ...newVotes]) {
    voteMap.set(voteKey(v), v);
  }
  state.quipBattleVotes = Array.from(voteMap.values());

  const votedUserIds = state.quipBattleVotedUserIds || [];
  if (!votedUserIds.includes(userId)) {
    votedUserIds.push(userId);
    state.quipBattleVotedUserIds = votedUserIds;
  }

  await updateSession(socialSessionId, state);

  return res.json({ voted: true, totalVotes: state.quipBattleVotes.length });
});

// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId/quip-battle/results
// ---------------------------------------------------------------------------

router.get('/:socialSessionId/quip-battle/results', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const prompts = state.quipBattlePrompts || [];
  const answers = state.quipBattleAnswers || [];
  const votes = state.quipBattleVotes || [];

  // Compute results per prompt
  const results = prompts.map((prompt: any) => {
    const promptAnswers = answers.filter((a: any) => a.promptId === prompt.id);
    const promptVotes = votes.filter((v: any) => v.promptId === prompt.id);

    // Count votes per answer
    const voteCounts: Record<string, number> = {};
    for (const v of promptVotes) {
      voteCounts[v.answerId] = (voteCounts[v.answerId] || 0) + 1;
    }

    // Find winner
    let winnerUserId = '';
    let winnerDisplayName = '';
    let maxVotes = 0;
    for (const [answerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        const answer = promptAnswers.find((a: any) => `${a.userId}::${a.promptId}` === answerId);
        winnerUserId = answer?.userId || '';
        winnerDisplayName = answer?.displayName || '';
      }
    }

    return {
      promptId: prompt.id,
      promptText: prompt.promptText,
      answers: promptAnswers,
      winnerUserId,
      winnerDisplayName,
      voteCount: maxVotes,
    };
  });

  state.quipBattleResults = results;
  state.quipBattleRevealed = true;
  await updateSession(socialSessionId, state);

  return res.json({ results, allVoted: (state.quipBattleVotedUserIds || []).length >= (state.playerCount || 1) });
});

// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId/recap
// ---------------------------------------------------------------------------
router.get('/:socialSessionId/recap', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.recapSnapshot) {
    const roster = await listParticipants(socialSessionId);
    return res.json({
      summary: state.recapSnapshot.recapSummary,
      meta: state.recapSnapshot.meta,
      medals: state.recapSnapshot.medals,
      state: await buildClientState(state),
    });
  }

  const durationMinutes = Math.round((Date.now() - (state.sessionStartedAt || state.phaseStartedAt)) / 60000);

  interface Medal {
    emoji: string;
    title: string;
    recipientDisplayName: string;
    description: string;
  }
  const medals: Medal[] = [];

  // Fetch lie truths from the separate server-only table for medal computation.
  const sessionLieMap = await loadSessionLieTruths(socialSessionId);

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
    const roster = await listParticipants(socialSessionId);
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

    return res.json({ summary: summaryResult.data, meta: summaryResult.meta, medals, state: await buildClientState(state) });
  } catch (error) {
    logger.error('[SocialIcebreaker] Failed to generate recap:', { error: String(error) });
    return res.status(500).json({ error: 'Failed to generate recap' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId/moment-card
// ---------------------------------------------------------------------------

router.get('/:socialSessionId/moment-card', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const roster = await listParticipants(socialSessionId);

  const recapSummary = state.recapSnapshot?.recapSummary;
  const medals = state.recapSnapshot?.medals ?? [];

  const payload = buildMomentCardPayload(state, roster, recapSummary, medals);

  return res.json({ payload });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/ai-feedback
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/ai-feedback', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = submitSocialIcebreakerAiFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId } = req.params;
  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  try {
    await socialIcebreakerAiFeedbackRepo.upsertFeedback({
      socialSessionId,
      submittedBy: userId,
      phase: parsed.data.phase,
      promptVersion: parsed.data.promptVersion,
      aiCorrelationId: parsed.data.aiCorrelationId,
      rating: parsed.data.rating,
    });
    return res.json({ ok: true });
  } catch (error) {
    logger.error('[SocialIcebreaker] ai-feedback error:', { error });
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// ---------------------------------------------------------------------------
// Undercover Word routes
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/undercover-word/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  try {
    const result = await generateUndercoverWordPair({
      eventType: state.eventType || '活动',
      participantCount: state.playerCount || 4,
    });

    // Randomly assign undercover
    const roster = await listParticipants(socialSessionId);
    const undercoverIdx = Math.floor(Math.random() * roster.length);
    const undercoverUserId = roster[undercoverIdx]?.userId;

    state.undercoverWordPair = result.data;
    state.undercoverWordPairMeta = result.meta;
    state.undercoverUserId = undercoverUserId;
    state.undercoverWordRounds = [];
    state.undercoverWordCurrentRound = 0;
    state.undercoverWordVotes = [];
    state.undercoverWordVotedUserIds = [];
    state.undercoverWordRevealed = false;
    state.undercoverWordResults = undefined;
    await updateSession(socialSessionId, state);

    return res.json({ pair: result.data, undercoverAssigned: !!undercoverUserId });
  } catch (error) {
    logger.error('[SocialIcebreaker] generateUndercoverWordPair error:', { error: String(error) });
    return res.status(500).json({ error: 'Failed to generate undercover word pair' });
  }
});

router.post('/:socialSessionId/undercover-word/describe', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { text } = req.body as { text: string };

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Description required' });

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const currentRound = state.undercoverWordCurrentRound ?? 0;
  const rounds = state.undercoverWordRounds || [];
  const round = rounds[currentRound] || { roundNumber: currentRound + 1, descriptions: [] };

  // Prevent duplicate descriptions from same user in same round
  const existing = round.descriptions.find((d: any) => d.userId === userId);
  if (existing) {
    existing.text = text.trim().slice(0, 100);
  } else {
    round.descriptions.push({ userId, displayName: (await getParticipant(socialSessionId, userId))?.displayName || '匿名', text: text.trim().slice(0, 100) });
  }

  rounds[currentRound] = round;
  state.undercoverWordRounds = rounds;
  await updateSession(socialSessionId, state);

  return res.json({ submitted: true, round: currentRound + 1 });
});

router.post('/:socialSessionId/undercover-word/vote', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { targetUserId } = req.body as { targetUserId: string };

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const votes = state.undercoverWordVotes || [];
  const existingIdx = votes.findIndex((v: any) => v.voterId === userId);
  if (existingIdx >= 0) {
    votes[existingIdx] = { voterId: userId, targetUserId };
  } else {
    votes.push({ voterId: userId, targetUserId });
  }

  state.undercoverWordVotes = votes;
  const votedUserIds = state.undercoverWordVotedUserIds || [];
  if (!votedUserIds.includes(userId)) votedUserIds.push(userId);
  state.undercoverWordVotedUserIds = votedUserIds;
  await updateSession(socialSessionId, state);

  return res.json({ voted: true, totalVotes: votes.length });
});

router.post('/:socialSessionId/undercover-word/reveal', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!isHostAuthorized(state, userId)) {
    return res.status(403).json({ error: 'Only host can reveal' });
  }

  const votes = state.undercoverWordVotes || [];
  const voteCounts: Record<string, number> = {};
  for (const v of votes) {
    voteCounts[v.targetUserId] = (voteCounts[v.targetUserId] || 0) + 1;
  }

  let maxVotes = 0;
  let topTarget = '';
  for (const [uid, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      topTarget = uid;
    }
  }

  const pair = state.undercoverWordPair;
  const undercoverUserId = state.undercoverUserId || '';

  const result: typeof state.undercoverWordResults = {
    undercoverUserId,
    undercoverDisplayName: (await getParticipant(socialSessionId, undercoverUserId))?.displayName || '匿名',
    civilianWord: pair?.civilianWord || '',
    undercoverWord: pair?.undercoverWord || '',
    voteCounts,
    caught: topTarget === undercoverUserId,
  };

  state.undercoverWordResults = result;
  state.undercoverWordRevealed = true;
  await updateSession(socialSessionId, state);

  return res.json({ revealed: true, result });
});

// ---------------------------------------------------------------------------
// Group Mirror routes
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/group-mirror/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  try {
    const roster = await listParticipants(socialSessionId);
    const result = await generateGroupMirrorQuestions({
      eventType: state.eventType || '活动',
      participantCount: roster.length,
      participantNames: roster.map((p) => p.displayName).filter(Boolean) as string[],
    });

    state.groupMirrorQuestions = result.data;
    state.groupMirrorQuestionsMeta = result.meta;
    state.groupMirrorAnswers = [];
    state.groupMirrorVotes = [];
    state.groupMirrorSubmittedUserIds = [];
    state.groupMirrorRevealed = false;
    state.groupMirrorResults = undefined;
    await updateSession(socialSessionId, state);

    return res.json({ questions: result.data, meta: result.meta });
  } catch (error) {
    logger.error('[SocialIcebreaker] generateGroupMirrorQuestions error:', { error: String(error) });
    return res.status(500).json({ error: 'Failed to generate group mirror questions' });
  }
});

router.post('/:socialSessionId/group-mirror/submit', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { answers } = req.body as { answers: Array<{ questionId: string; targetUserId: string; reasonText?: string }> };

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: 'answers array required' });

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const participant = await getParticipant(socialSessionId, userId);
  const displayName = participant?.displayName || '匿名';

  const existingAnswers = state.groupMirrorAnswers || [];
  const newAnswers = answers.map((a) => ({
    userId,
    displayName,
    questionId: a.questionId,
    targetUserId: a.targetUserId,
    reasonText: a.reasonText?.slice(0, 100),
  }));

  // Deduplicate by user + question
  const answerMap = new Map<string, typeof newAnswers[0]>();
  for (const a of existingAnswers) {
    answerMap.set(`${a.userId}::${a.questionId}`, a as any);
  }
  for (const a of newAnswers) {
    answerMap.set(`${a.userId}::${a.questionId}`, a as any);
  }
  state.groupMirrorAnswers = Array.from(answerMap.values());

  const submittedUserIds = state.groupMirrorSubmittedUserIds || [];
  if (!submittedUserIds.includes(userId)) submittedUserIds.push(userId);
  state.groupMirrorSubmittedUserIds = submittedUserIds;
  await updateSession(socialSessionId, state);

  return res.json({ submitted: true, totalAnswers: state.groupMirrorAnswers.length });
});

router.post('/:socialSessionId/group-mirror/reveal', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!isHostAuthorized(state, userId)) {
    return res.status(403).json({ error: 'Only host can reveal' });
  }

  const questions = state.groupMirrorQuestions || [];
  const answers = state.groupMirrorAnswers || [];

  const results: typeof state.groupMirrorResults = [];
  for (const q of questions) {
    const qAnswers = answers.filter((a: any) => a.questionId === q.id);
    const targetCounts: Record<string, number> = {};
    for (const a of qAnswers) {
      targetCounts[a.targetUserId] = (targetCounts[a.targetUserId] || 0) + 1;
    }

    let maxCount = 0;
    let topTarget = '';
    for (const [uid, count] of Object.entries(targetCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topTarget = uid;
      }
    }

    const topParticipant = await getParticipant(socialSessionId, topTarget);
    results.push({
      questionId: q.id,
      questionText: q.questionText,
      topTargetUserId: topTarget,
      topTargetDisplayName: topParticipant?.displayName || '匿名',
      voteCount: maxCount,
      totalVotes: qAnswers.length,
    });
  }

  state.groupMirrorResults = results;
  state.groupMirrorRevealed = true;
  await updateSession(socialSessionId, state);

  return res.json({ revealed: true, results });
});

export default router;
