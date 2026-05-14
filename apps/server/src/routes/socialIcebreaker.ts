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
import { getArchetypeHSL } from '@shared/archetypeColors';
import type { UndercoverWordPair } from '@shared/undercoverWord';
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
  validateLieDetectiveV2Tags,
  getLieDetectiveMode,
  getDynamicDifficulty,
} from '../socialIcebreakerAIService';
import { generateXiaoyueAdaptiveSuggestion } from '../xiaoyueAdaptiveEngine';
import { buildCachedAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import {
  cleanupPhaseStateForNextPhase,
  ensureSessionEnabledPhases,
  getServerEnabledPhases,
} from '../socialIcebreakerPhaseConfig';
import { DEFAULT_STANDARD_RUN_PLAN } from '@shared/phaseRegistry';
import { getRunPlanForTier } from '@shared/socialIcebreakerRunPlans';
import { compileForSession } from '../services/runPlanService';
import { type TierMachineId, resolveTierDisplay, LEGACY_TIER_MAP } from '@shared/socialIcebreakerTierManifest';
import { socialIcebreakerAiFeedbackRepo } from '../repositories/socialIcebreakerAiFeedbackRepo';
import { submitSocialIcebreakerAiFeedbackSchema } from '@shared/schema';
import {
  getSocialSessionId,
  getSession,
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
  getPreGenerationResult,
  invalidatePreGenerationForSession,
} from '../lib/socialIcebreakerStore';
import { getSocialIcebreakerAccess } from '../lib/socialIcebreakerAccess';
import { buildMomentCardPayload } from '../lib/momentCardPayload';
import { curateMedals } from '../lib/medalCuration';
import { logger } from '../lib/logger';
import { filterContent } from '../contentFilter';
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
  resolveSessionAfterHostAuth,
  isHostAuthorized,
} from './socialIcebreakerHelpers';
import { registerExtendedRoutes } from './socialIcebreakerExtended';
import { enqueueRunPlanPreGeneration, shouldSkipOnDemandGeneration } from '../jobs/preGenerationQueue';
import { recordVoteOptimistically } from '../lib/optimisticSync';

const router = Router();

// ============ TTL / CLEANUP ============
// Sweep expired sessions from the DB every 5 minutes. Fail open if the store
// is unavailable so the route module does not take down the server process.
startSocialIcebreakerSweep();

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/start
// ---------------------------------------------------------------------------
router.post('/start', async (req: any, res) => {
  const { sessionId, displayName, eventType, eventTier, vibe } = req.body;
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const access = await getSocialIcebreakerAccess(sessionId, userId);
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
  const mappedTier = LEGACY_TIER_MAP[eventTier] ?? eventTier;
  const resolvedTier: TierMachineId = (['breeze', 'glow', 'blaze'] as string[]).includes(mappedTier) ? mappedTier as TierMachineId : 'breeze';
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
    eventTier: resolvedTier,
    vibe: vibe && ['chat', 'balanced', 'game'].includes(vibe) ? vibe : 'balanced',
    enabledPhases: getServerEnabledPhases(),
    commonGroundCount: 0,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: true,
  };
  const runPlan = await compileForSession(newState, resolvedTier);
  newState.runPlan = runPlan;

  try {
    await createSession(newState);
    await upsertParticipant(socialSessionId, userId, displayName || '主持人');

    // Pre-generate AI content for phases in the run plan (best-effort)
    const roster = await listParticipants(socialSessionId);
    try {
      await enqueueRunPlanPreGeneration(
        socialSessionId,
        runPlan,
        {
          participantCount: roster.length,
          eventType,
          participants: roster.map((p) => ({
            userId: p.userId,
            displayName: p.displayName,
            archetype: p.archetype,
          })),
        },
      );
    } catch (preGenErr) {
      logger.warn('Failed to enqueue run plan pre-generation on start', {
        socialSessionId,
        error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
      });
    }

    logger.info('Started social icebreaker session', {
      sessionId,
      socialSessionId,
      userId,
      tier: resolvedTier,
      vibe: newState.vibe,
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
    tierDisplayName: resolveTierDisplay(resolvedTier, { glowVariant: 'default' }),
    state: await buildClientState(newState),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/set-tier
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/set-tier', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { tier, vibe } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can set the tier',
  });
  if (!state) return;

  // Changing runPlan after warmup would desync currentPhase from the new segment order
  // (getNextEligiblePhase uses runPlan.segments); only allow while still in warmup.
  if (state.currentPhase !== 'warmup') {
    return res.status(400).json({
      error: 'Tier can only be changed during warmup (before advancing past the first phase)',
    });
  }

  const VALID_TIERS: TierMachineId[] = ['breeze', 'glow', 'blaze'];
  if (!tier || !VALID_TIERS.includes(tier as TierMachineId)) {
    return res.status(400).json({ error: 'Invalid tier. Must be one of: breeze, glow, blaze' });
  }

  const newTier = tier as TierMachineId;
  if (vibe && ['chat', 'balanced', 'game'].includes(vibe)) {
    state.vibe = vibe;
  }
  const runPlan = await compileForSession(state, newTier);

  state.eventTier = newTier;
  state.runPlan = runPlan;
  await updateSession(socialSessionId, state);

  await invalidatePreGenerationForSession(socialSessionId);

  // Re-enqueue pre-generation for the new run plan (best-effort)
  const rosterAfterTierChange = await listParticipants(socialSessionId);
  try {
    await enqueueRunPlanPreGeneration(
      socialSessionId,
      runPlan,
      {
        participantCount: rosterAfterTierChange.length,
        eventType: state.eventType,
        participants: rosterAfterTierChange.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          archetype: p.archetype,
        })),
      },
    );
  } catch (preGenErr) {
    logger.warn('Failed to enqueue run plan pre-generation on set-tier', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  logger.info('Social icebreaker tier updated', {
    socialSessionId,
    userId,
    tier: newTier,
  });

  return res.json({
    socialSessionId,
    eventTier: newTier,
    tierDisplayName: resolveTierDisplay(newTier, { glowVariant: 'default' }),
    runPlan,
    state: await buildClientState(state, userId),
  });
});

// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId
// ---------------------------------------------------------------------------
router.get('/:socialSessionId', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  ensureSessionEnabledPhases(state);

  // Bump lastSeen so polling counts as presence.
  await dbHeartbeat(socialSessionId, userId);
  const rosterCount = await getRosterCount(socialSessionId);
  const activeCount = await getActiveParticipantCount(socialSessionId);
  state.playerCount = rosterCount;
  state.activePlayerCount = activeCount;

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

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!mood) {
    return res.status(400).json({ error: 'mood is required' });
  }

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can change topics',
  });
  if (!state) return;

  try {
    const participants = await listParticipants(socialSessionId);
    const topicResult = await generateWarmupTopics({
      mood,
      eventType,
      participantCount: state.playerCount || participantCount,
      avoidTopics,
      roster: participants || [],
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

  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

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

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can move to the next topic',
  });
  if (!state) return;

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

  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
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

  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
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
  const { operationId } = req.body as { operationId?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'micro_challenge') {
    return res.status(400).json({ error: 'Not in micro_challenge phase' });
  }

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'micro_challenge',
        vote: { userId },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.challengeCompletedBy?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');
        const completedBy = currentState.challengeCompletedBy || [];
        if (!completedBy.includes(userId)) {
          completedBy.push(userId);
          currentState.challengeCompletedBy = completedBy;
          await updateSession(socialSessionId, currentState);
        }
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    const freshState = await getSession(socialSessionId);
    const freshCompletedBy = freshState?.challengeCompletedBy || [];
    return res.json({
      completedBy: freshCompletedBy,
      completedCount: freshCompletedBy.length,
      totalCount: freshState?.playerCount ?? state.playerCount,
      operationId,
    });
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
    operationId: null,
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

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can generate challenges',
  });
  if (!state) return;

  if (state.currentPhase !== 'micro_challenge') {
    return res.status(400).json({ error: 'Not in micro_challenge phase' });
  }

  // Idempotent retry: if a challenge already exists, return it instead of regenerating
  if (state.currentChallenge) {
    const cachedMeta = state.currentChallengeMeta
      ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-micro-challenge-v1');
    return res.json({ challenge: state.currentChallenge, meta: cachedMeta });
  }

  // Pre-generation freshness: check if async pre-gen is available or in-flight
  try {
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'micro_challenge');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'micro_challenge');
      if (result) {
        const challenges = result.contentJson as unknown as Array<Record<string, unknown>>;
        state.currentChallenge = challenges[0] as any;
        state.currentChallengeMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-micro-challenge-v1');
        state.challengeCompletedBy = [];
        await updateSession(socialSessionId, state);
        logger.info('Micro challenge served from pre-generation', { socialSessionId });
        return res.json({ challenge: state.currentChallenge, meta: state.currentChallengeMeta });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Micro challenge pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({
        status: 'generating',
        message: 'Challenge is being prepared, please retry shortly',
      });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for micro challenge, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  try {
    const participants = await listParticipants(socialSessionId);
    const challengeResult = await generateMicroChallenges({
      eventType: state.eventType || '活动',
      participantCount: state.playerCount,
      seed: socialSessionId,
      roster: participants || [],
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
// POST /api/social-icebreaker/:socialSessionId/lie-detective/submit-tags
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/submit-tags', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { tags } = req.body as { tags?: string[] };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  const mode = getLieDetectiveMode(state.lieDetectiveMode);
  if (mode !== 'v2') {
    return res.status(400).json({ error: 'Tag submission is only available in V2 mode' });
  }

  const validation = validateLieDetectiveV2Tags(tags);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Store tags in session state
  state.lieDetectiveV2Tags = state.lieDetectiveV2Tags || {};
  state.lieDetectiveV2Tags[userId] = validation.tags;

  // If all players have submitted tags, optionally trigger statement generation
  const roster = await listParticipants(socialSessionId);
  const allSubmitted = roster.every((p) => state.lieDetectiveV2Tags?.[p.userId]);

  await updateSession(socialSessionId, state);

  return res.json({
    submitted: true,
    tags: validation.tags,
    allPlayersSubmitted: allSubmitted,
    state: await buildClientState(state, userId),
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

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can advance lie-detective turns',
  });
  if (!state) return;

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
// POST /api/social-icebreaker/:socialSessionId/xiaoyue/session-pack
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/xiaoyue/session-pack', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can generate a session pack',
  });
  if (!state) return;

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
        archetype: p.archetype ?? undefined,
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

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can request adaptive suggestions',
  });
  if (!state) return;

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

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can generate dice challenges',
  });
  if (!state) return;

  if (state.currentPhase !== 'personality_dice') {
    return res.status(400).json({ error: 'Not in personality_dice phase' });
  }

  // Idempotent retry: if challenges already exist, return them instead of regenerating
  if ((state.personalityDiceChallenges || []).length > 0) {
    const cachedMeta = state.personalityDiceChallengesMeta
      ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-personality-dice-v1');
    const enrichedChallenges = state.personalityDiceChallenges!.map((c) => ({
      ...c,
      archetypeColor: getArchetypeHSL(c.archetype),
    }));
    return res.json({ challenges: enrichedChallenges, meta: cachedMeta });
  }

  // Pre-generation freshness: check if async pre-gen is available or in-flight
  try {
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'personality_dice');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'personality_dice');
      if (result) {
        const preGenChallenges = (result.contentJson as unknown as Array<Record<string, unknown>>).map((c) => ({
          ...c,
          archetypeColor: getArchetypeHSL(c.archetype as string | undefined),
        }));
        state.personalityDiceChallenges = preGenChallenges as any;
        state.personalityDiceChallengesMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-personality-dice-v1');
        state.currentDicePlayerIndex = 0;
        state.diceCompletedBy = [];
        state.dicePassedBy = [];
        await updateSession(socialSessionId, state);
        logger.info('Personality dice served from pre-generation', { socialSessionId });
        return res.json({ challenges: preGenChallenges, meta: state.personalityDiceChallengesMeta });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Personality dice pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({
        status: 'generating',
        message: 'Challenges are being prepared, please retry shortly',
      });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for personality dice, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  try {
    const challengeResult = await generatePersonalityDiceChallenges({ participants: participants || [] });
    const enrichedChallenges = challengeResult.data.map((c) => ({
      ...c,
      archetypeColor: getArchetypeHSL(c.archetype),
    }));
    state.personalityDiceChallenges = enrichedChallenges;
    state.personalityDiceChallengesMeta = challengeResult.meta;
    state.currentDicePlayerIndex = 0;
    state.diceCompletedBy = [];
    state.dicePassedBy = [];
    await updateSession(socialSessionId, state);

    return res.json({ challenges: enrichedChallenges, meta: challengeResult.meta });
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
  const { pass, operationId } = req.body as { pass?: boolean; operationId?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'personality_dice') {
    return res.status(400).json({ error: 'Not in personality_dice phase' });
  }

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'personality_dice',
        vote: { userId, pass },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.diceCompletedBy?.includes(userId) && !currentState.dicePassedBy?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const diceCompletedBy = currentState.diceCompletedBy || [];
        const dicePassedBy = currentState.dicePassedBy || [];

        if (pass === true) {
          if (!dicePassedBy.includes(userId)) {
            dicePassedBy.push(userId);
            currentState.dicePassedBy = dicePassedBy;
          }
        } else {
          if (!diceCompletedBy.includes(userId)) {
            diceCompletedBy.push(userId);
            currentState.diceCompletedBy = diceCompletedBy;
          }
        }

        const challenges = currentState.personalityDiceChallenges || [];
        const currentIdx = currentState.currentDicePlayerIndex ?? 0;
        if (challenges[currentIdx]?.userId === userId) {
          currentState.currentDicePlayerIndex = Math.min(currentIdx + 1, challenges.length - 1);
        }

        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    // Re-fetch fresh state after optimistic mutation
    const freshState = await getSession(socialSessionId);
    const allResponded = (freshState?.personalityDiceChallenges || []).length > 0 &&
      ((freshState?.diceCompletedBy || []).length + (freshState?.dicePassedBy || []).length) >= (freshState?.personalityDiceChallenges || []).length;

    return res.json({
      diceCompletedBy: freshState?.diceCompletedBy || [],
      dicePassedBy: freshState?.dicePassedBy || [],
      currentDicePlayerIndex: freshState?.currentDicePlayerIndex,
      allCompleted: allResponded,
      operationId,
    });
  }

  // Fallback: non-optimistic path (backward compatible)
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
    operationId: null,
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/quip-battle/generate
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/quip-battle/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can generate quip battle prompts',
  });
  if (!state) return;

  if (state.currentPhase !== 'quip_battle') {
    return res.status(400).json({ error: 'Not in quip_battle phase' });
  }

  // Idempotent retry: if prompts already exist, return them instead of regenerating
  if ((state.quipBattlePrompts || []).length > 0) {
    const cachedMeta = state.quipBattlePromptsMeta
      ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-quip-battle-v1');
    return res.json({ prompts: state.quipBattlePrompts, meta: cachedMeta });
  }

  // Pre-generation freshness: check if async pre-gen is available or in-flight
  try {
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'quip_battle');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'quip_battle');
      if (result) {
        const prompts = (result.contentJson as unknown as Array<Record<string, unknown>>).map((p, i) => ({
          id: (p.id as string) || `qb_${i + 1}`,
          promptText: (p.promptText as string) || '',
          category: (p.category as string) || 'fun',
        }));
        state.quipBattlePrompts = prompts;
        state.quipBattlePromptsMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-quip-battle-v1');
        await updateSession(socialSessionId, state);
        logger.info('Quip battle served from pre-generation', { socialSessionId });
        return res.json({ prompts: state.quipBattlePrompts, meta: state.quipBattlePromptsMeta });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Quip battle pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({
        status: 'generating',
        message: 'Prompts are being prepared, please retry shortly',
      });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for quip battle, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

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
      roster,
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
  const { answers, operationId } = req.body as { answers: Array<{ promptId: string; answerText: string }>; operationId?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers array required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'quip_battle') {
    return res.status(400).json({ error: 'Not in quip_battle phase' });
  }

  const participant = await getParticipant(socialSessionId, userId);
  const displayName = participant?.displayName || '匿名';

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'quip_battle',
        vote: { userId, answers },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.quipBattleSubmittedUserIds?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const existingAnswers = currentState.quipBattleAnswers || [];
        const newAnswers = answers.map((a) => {
          const text = (a.answerText || '').slice(0, 100);
          const filtered = filterContent(text);
          if (filtered.isViolation && filtered.severity === 'severe') {
            throw new Error(`Content violation: ${filtered.message || 'inappropriate content'}`);
          }
          return {
            userId,
            displayName,
            promptId: a.promptId,
            answerText: text,
          };
        });
        currentState.quipBattleAnswers = [...existingAnswers, ...newAnswers];

        const submittedUserIds = currentState.quipBattleSubmittedUserIds || [];
        if (!submittedUserIds.includes(userId)) {
          submittedUserIds.push(userId);
          currentState.quipBattleSubmittedUserIds = submittedUserIds;
        }
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    const freshState = await getSession(socialSessionId);
    return res.json({
      submitted: true,
      totalAnswers: freshState?.quipBattleAnswers?.length ?? 0,
      operationId,
    });
  }

  for (const a of answers) {
    const text = (a.answerText || '').slice(0, 100);
    const filtered = filterContent(text);
    if (filtered.isViolation && filtered.severity === 'severe') {
      return res.status(400).json({ error: filtered.message || 'Content contains inappropriate material' });
    }
  }

  const existingAnswers = state.quipBattleAnswers || [];
  const newAnswers = answers.map((a) => ({
    userId,
    displayName,
    promptId: a.promptId,
    answerText: (a.answerText || '').slice(0, 100),
  }));

  state.quipBattleAnswers = [...existingAnswers, ...newAnswers];

  const submittedUserIds = state.quipBattleSubmittedUserIds || [];
  if (!submittedUserIds.includes(userId)) {
    submittedUserIds.push(userId);
    state.quipBattleSubmittedUserIds = submittedUserIds;
  }

  await updateSession(socialSessionId, state);

  return res.json({ submitted: true, totalAnswers: state.quipBattleAnswers.length, operationId: null });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/quip-battle/vote
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/quip-battle/vote', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { votes, operationId } = req.body as { votes: Array<{ answerId: string; promptId: string }>; operationId?: string };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!votes || !Array.isArray(votes)) {
    return res.status(400).json({ error: 'votes array required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'quip_battle') {
    return res.status(400).json({ error: 'Not in quip_battle phase' });
  }

  // Validate answerIds against existing answers
  const validAnswerIds = new Set(
    (state.quipBattleAnswers || []).map((a: any) => `${a.userId}::${a.promptId}`)
  );
  for (const v of votes) {
    if (!validAnswerIds.has(v.answerId)) {
      return res.status(400).json({ error: `Invalid answerId: ${v.answerId}` });
    }
  }

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'quip_battle',
        vote: { voterId: userId, votes },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.quipBattleVotedUserIds?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const existingVotes = currentState.quipBattleVotes || [];
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
        currentState.quipBattleVotes = Array.from(voteMap.values());

        const votedUserIds = currentState.quipBattleVotedUserIds || [];
        if (!votedUserIds.includes(userId)) {
          votedUserIds.push(userId);
          currentState.quipBattleVotedUserIds = votedUserIds;
        }
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    const freshState = await getSession(socialSessionId);
    return res.json({
      voted: true,
      totalVotes: freshState?.quipBattleVotes?.length ?? 0,
      operationId,
    });
  }

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

  return res.json({ voted: true, totalVotes: state.quipBattleVotes.length, operationId: null });
});

// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId/moment-card
// ---------------------------------------------------------------------------

router.get('/:socialSessionId/moment-card', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const { state: preAuthState, expired: preExpired } = await getSessionWithExpiry(socialSessionId);
  if (!preAuthState) {
    if (preExpired) {
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    return res.status(404).json({ error: 'Social session not found' });
  }
  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

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
  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

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
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can generate word pairs',
  });
  if (!state) return;

  if (state.currentPhase !== 'undercover_word') {
    return res.status(400).json({ error: 'Not in undercover_word phase' });
  }

  if (state.undercoverWordPair) {
    return res.status(400).json({ error: 'Word pair already generated' });
  }

  try {
    // Pre-generation freshness: check if async pre-gen is available or in-flight
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'undercover_word');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'undercover_word');
      if (result) {
        const pair = result.contentJson as unknown as UndercoverWordPair;
        const roster = await listParticipants(socialSessionId);
        const undercoverIdx = Math.floor(Math.random() * roster.length);
        const undercoverUserId = roster[undercoverIdx]?.userId;

        state.undercoverWordPair = pair;
        state.undercoverWordPairMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-undercover-word-v1');
        state.undercoverUserId = undercoverUserId;
        state.undercoverWordRounds = [];
        state.undercoverWordCurrentRound = 0;
        state.undercoverWordVotes = [];
        state.undercoverWordVotedUserIds = [];
        state.undercoverWordRevealed = false;
        state.undercoverWordResults = undefined;
        await updateSession(socialSessionId, state);

        logger.info('Undercover word served from pre-generation', { socialSessionId });
        return res.json({ pair, undercoverAssigned: !!undercoverUserId });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Undercover word pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({ status: 'generating', message: '词对准备中，请稍后重试' });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for undercover word, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const result = await generateUndercoverWordPair({
      eventType: state.eventType || '活动',
      participantCount: state.playerCount || 4,
      roster,
    });

    // Randomly assign undercover
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
  const { text, operationId } = req.body as { text: string; operationId?: string };

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Description required' });

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'undercover_word',
        vote: { userId, text: text.trim().slice(0, 100) },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        const currentRound = currentState.undercoverWordCurrentRound ?? 0;
        const rounds = currentState.undercoverWordRounds || [];
        const round = rounds[currentRound] || { roundNumber: currentRound + 1, descriptions: [] };
        const existing = round.descriptions.find((d: any) => d.userId === userId);
        // Allow if no existing description for this user in this round
        return !existing;
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const currentRound = currentState.undercoverWordCurrentRound ?? 0;
        const rounds = currentState.undercoverWordRounds || [];
        const round = rounds[currentRound] || { roundNumber: currentRound + 1, descriptions: [] };

        round.descriptions.push({
          userId,
          displayName: (await getParticipant(socialSessionId, userId))?.displayName || '匿名',
          text: text.trim().slice(0, 100),
        });

        rounds[currentRound] = round;
        currentState.undercoverWordRounds = rounds;
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    // Re-fetch fresh state after optimistic mutation
    const freshState = await getSession(socialSessionId);
    const currentRound = freshState?.undercoverWordCurrentRound ?? 0;
    return res.json({ submitted: true, round: currentRound + 1, operationId });
  }

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

  return res.json({ submitted: true, round: currentRound + 1, operationId: null });
});

router.post('/:socialSessionId/undercover-word/vote', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { targetUserId, operationId } = req.body as { targetUserId: string; operationId?: string };

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'undercover_word',
        vote: { voterId: userId, targetUserId },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        const votes = currentState.undercoverWordVotes || [];
        const existingIdx = votes.findIndex((v: any) => v.voterId === userId);
        // Allow if user hasn't voted yet (new vote) or is changing their vote
        return true;
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const votes = currentState.undercoverWordVotes || [];
        const existingIdx = votes.findIndex((v: any) => v.voterId === userId);
        if (existingIdx >= 0) {
          votes[existingIdx] = { voterId: userId, targetUserId };
        } else {
          votes.push({ voterId: userId, targetUserId });
        }

        currentState.undercoverWordVotes = votes;
        const votedUserIds = currentState.undercoverWordVotedUserIds || [];
        if (!votedUserIds.includes(userId)) votedUserIds.push(userId);
        currentState.undercoverWordVotedUserIds = votedUserIds;
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    // Re-fetch fresh state after optimistic mutation
    const freshState = await getSession(socialSessionId);
    const votes = freshState?.undercoverWordVotes || [];
    return res.json({ voted: true, totalVotes: votes.length, operationId });
  }

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

  return res.json({ voted: true, totalVotes: votes.length, operationId: null });
});

router.post('/:socialSessionId/undercover-word/reveal', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only host can reveal',
  });
  if (!state) return;

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

router.post('/:socialSessionId/undercover-word/next-round', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only host can advance rounds',
  });
  if (!state) return;

  if (state.currentPhase !== 'undercover_word') {
    return res.status(400).json({ error: 'Not in undercover_word phase' });
  }

  const currentRound = state.undercoverWordCurrentRound ?? 0;
  state.undercoverWordCurrentRound = currentRound + 1;
  await updateSession(socialSessionId, state);

  return res.json({
    currentRound: state.undercoverWordCurrentRound,
    state: await buildClientState(state, userId),
  });
});

// ---------------------------------------------------------------------------
// Group Mirror routes
// ---------------------------------------------------------------------------

router.post('/:socialSessionId/group-mirror/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only the host can generate group mirror questions',
  });
  if (!state) return;

  if (state.currentPhase !== 'group_mirror') {
    return res.status(400).json({ error: 'Not in group_mirror phase' });
  }

  // Idempotent retry: if questions already exist, return them instead of regenerating
  if ((state.groupMirrorQuestions || []).length > 0) {
    const cachedMeta = state.groupMirrorQuestionsMeta
      ?? buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, 'social-group-mirror-v1');
    return res.json({ questions: state.groupMirrorQuestions, meta: cachedMeta });
  }

  // Pre-generation freshness: check if async pre-gen is available or in-flight
  try {
    const preGenStatus = await shouldSkipOnDemandGeneration(socialSessionId, 'group_mirror');
    if (preGenStatus.skip && preGenStatus.reason === 'available') {
      const result = await getPreGenerationResult(socialSessionId, 'group_mirror');
      if (result) {
        const questions = result.contentJson as unknown as Array<Record<string, unknown>>;
        state.groupMirrorQuestions = questions as any;
        state.groupMirrorQuestionsMeta = (result.aiMeta as unknown as AIResponseMeta | undefined) ?? buildCachedAIMeta(new Date().toISOString(), null, 'social-group-mirror-v1');
        state.groupMirrorAnswers = [];
        state.groupMirrorVotes = [];
        state.groupMirrorSubmittedUserIds = [];
        state.groupMirrorRevealed = false;
        state.groupMirrorResults = undefined;
        await updateSession(socialSessionId, state);
        logger.info('Group mirror served from pre-generation', { socialSessionId });
        return res.json({ questions: state.groupMirrorQuestions, meta: state.groupMirrorQuestionsMeta });
      }
    }
    if (preGenStatus.skip && preGenStatus.reason === 'in_flight') {
      logger.info('Group mirror pre-generation in-flight, returning 202', { socialSessionId });
      return res.status(202).json({
        status: 'generating',
        message: 'Questions are being prepared, please retry shortly',
      });
    }
  } catch (preGenErr) {
    logger.warn('Pre-generation check failed for group mirror, falling back to on-demand', {
      socialSessionId,
      error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const result = await generateGroupMirrorQuestions({
      eventType: state.eventType || '活动',
      participantCount: roster.length,
      participantNames: roster.map((p) => p.displayName).filter(Boolean) as string[],
      roster,
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
  const { answers, operationId } = req.body as { answers: Array<{ questionId: string; targetUserId: string; reasonText?: string }>; operationId?: string };

  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: 'answers array required' });

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'group_mirror') {
    return res.status(400).json({ error: 'Not in group_mirror phase' });
  }

  const participant = await getParticipant(socialSessionId, userId);
  const displayName = participant?.displayName || '匿名';

  if (operationId) {
    const result = await recordVoteOptimistically(
      {
        operationId,
        socialSessionId,
        phase: 'group_mirror',
        vote: { userId, answers },
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) return false;
        return !currentState.groupMirrorSubmittedUserIds?.includes(userId);
      },
      async () => {
        const currentState = await getSession(socialSessionId);
        if (!currentState) throw new Error('Session not found');

        const existingAnswers = currentState.groupMirrorAnswers || [];
        const newAnswers = answers.map((a) => {
          const reason = (a.reasonText || '').slice(0, 100);
          const filtered = filterContent(reason);
          if (filtered.isViolation && filtered.severity === 'severe') {
            throw new Error(`Content violation: ${filtered.message || 'inappropriate content'}`);
          }
          return {
            userId,
            displayName,
            questionId: a.questionId,
            targetUserId: a.targetUserId,
            reasonText: reason,
          };
        });

        const answerMap = new Map<string, typeof newAnswers[0]>();
        for (const a of existingAnswers) {
          answerMap.set(`${a.userId}::${a.questionId}`, a as any);
        }
        for (const a of newAnswers) {
          answerMap.set(`${a.userId}::${a.questionId}`, a as any);
        }
        currentState.groupMirrorAnswers = Array.from(answerMap.values());

        const submittedUserIds = currentState.groupMirrorSubmittedUserIds || [];
        if (!submittedUserIds.includes(userId)) submittedUserIds.push(userId);
        currentState.groupMirrorSubmittedUserIds = submittedUserIds;
        await updateSession(socialSessionId, currentState);
      },
    );

    if (!result.accepted) {
      return res.status(409).json({ error: result.conflict || 'Operation rejected' });
    }

    const freshState = await getSession(socialSessionId);
    return res.json({ submitted: true, totalAnswers: freshState?.groupMirrorAnswers?.length ?? 0, operationId });
  }

  for (const a of answers) {
    const reason = (a.reasonText || '').slice(0, 100);
    const filtered = filterContent(reason);
    if (filtered.isViolation && filtered.severity === 'severe') {
      return res.status(400).json({ error: filtered.message || 'Content contains inappropriate material' });
    }
  }

  const existingAnswers = state.groupMirrorAnswers || [];
  const newAnswers = answers.map((a) => ({
    userId,
    displayName,
    questionId: a.questionId,
    targetUserId: a.targetUserId,
    reasonText: (a.reasonText || '').slice(0, 100),
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

  return res.json({ submitted: true, totalAnswers: state.groupMirrorAnswers.length, operationId: null });
});

router.post('/:socialSessionId/group-mirror/reveal', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSessionAfterHostAuth(socialSessionId, res, userId, {
    error: 'Only host can reveal',
  });
  if (!state) return;

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

registerExtendedRoutes(router);

export default router;
