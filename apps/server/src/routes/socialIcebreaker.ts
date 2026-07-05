import { Router } from 'express';
import { z } from 'zod';
import { isSingleTestMode } from '../lib/isSingleTestMode';
import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  AtmosphereMood,
  LieDetectivePlayer,
  LieDetectiveVote,
  PulseCheckResult,
  LieDetectiveReveal,
  PersonalityDiceChallenge,
  PersonalityDiceChallengeGroup,
} from '@shared/socialIcebreaker';
import type { IcebreakerRunPlan } from '@shared/phaseModule';
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
  generatePersonalityDiceChallengeGroups,
  generateAuctionLots,
  generateQuipBattlePrompts,
  generateUndercoverWordPair,
  generateGroupMirrorQuestions,
  validateLieDetectiveV2Tags,
  getLieDetectiveMode,
  getDynamicDifficulty,
} from '../socialIcebreakerAIService';
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
import { getSocialIcebreakerAccess, resolveIcebreakerDefaultTier } from '../lib/socialIcebreakerAccess';
import { buildMomentCardPayload } from '../lib/momentCardPayload';
import { renderMomentCardToPng } from '../lib/momentCardRenderer';
import { curateMedals } from '../lib/medalCuration';
import { logger } from '../lib/logger';
import { validateContentSafe, contentViolationResponse } from '../lib/contentSafety';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import { getFeatureFlag } from '../lib/featureFlags';
import { startSocialIcebreakerSweep } from '../lib/socialIcebreakerSweep';
import { momentCardLimiter } from '../rateLimiter';
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
import { registerExtendedRoutes } from './socialIcebreakerExtended';
import { enqueueRunPlanPreGeneration, shouldSkipOnDemandGeneration } from '../jobs/preGenerationQueue';
import { recordVoteOptimistically } from '../lib/optimisticSync';

import socialIcebreakerTierRouter from './socialIcebreakerTier';
import socialIcebreakerCustomRouter from './socialIcebreakerCustom';
import socialIcebreakerXiaoyueRouter from './socialIcebreakerXiaoyue';
import socialIcebreakerGameplayCoreRouter from './socialIcebreakerGameplayCore';
import socialIcebreakerGameplayExtraRouter from './socialIcebreakerGameplayExtra';

const router = Router();
const WARMUP_TURN_DURATION_SECONDS = 30;

function getWarmupTurnDurationMs(state: SocialSessionState): number {
  return (state.warmupTurnDurationSeconds ?? WARMUP_TURN_DURATION_SECONDS) * 1000;
}

function isWarmupTurnExpired(state: SocialSessionState): boolean {
  if (!state.warmupTurnStartedAt) return false;
  return Date.now() - state.warmupTurnStartedAt >= getWarmupTurnDurationMs(state);
}

function hasWarmupTurnCompleted(state: SocialSessionState): boolean {
  return !!state.warmupTurnUserId && (state.warmupReadyUserIds || []).includes(state.warmupTurnUserId);
}

function beginWarmupTurn(
  state: SocialSessionState,
  roster: Array<{ userId: string }>,
  topicIndex = state.currentTopicIndex ?? 0,
): void {
  const playerIds = roster.map((participant) => participant.userId).filter(Boolean);
  const fallbackId = state.hostUserId || playerIds[0] || '';
  const nextTurnUserId = playerIds.length > 0
    ? playerIds[Math.max(0, topicIndex) % playerIds.length]
    : fallbackId;

  state.currentTopicIndex = Math.max(0, topicIndex);
  state.warmupReadyUserIds = [];
  state.warmupTurnUserId = nextTurnUserId;
  state.warmupTurnStartedAt = Date.now();
  state.warmupTopicRevealed = false;
  state.warmupTurnDurationSeconds = WARMUP_TURN_DURATION_SECONDS;
}

// ============ TEST-MODE BOT BYPASS ============
// In single-test mode (APP_MODE=test or ENABLE_SINGLE_TEST_MODE=true),
// allow bot users to impersonate via x-test-user-id header.
// This lets the SingleTestBotService exercise the real API stack without
// modifying route handlers or managing session cookies for 5 virtual users.
router.use((req: any, _res, next) => {
  if (isSingleTestMode() && req.headers['x-test-user-id']) {
    req.user = { id: req.headers['x-test-user-id'] };
  }
  next();
});

// ============ TTL / CLEANUP ============
// Sweep expired sessions from the DB every 5 minutes. Fail open if the store
// is unavailable so the route module does not take down the server process.
startSocialIcebreakerSweep();

router.use(socialIcebreakerTierRouter);
router.use(socialIcebreakerCustomRouter);
router.use(socialIcebreakerXiaoyueRouter);
router.use(socialIcebreakerGameplayCoreRouter);
router.use(socialIcebreakerGameplayExtraRouter);

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/start
// ---------------------------------------------------------------------------
const startBodySchema = z.object({
  sessionId: z.string().min(1),
  displayName: z.string().optional(),
  eventType: z.string().optional(),
  eventTier: z.string().optional(),
  vibe: z.string().optional(),
});

router.post('/start', async (req: any, res) => {
  const parsedBody = startBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { sessionId, displayName, eventType, eventTier, vibe } = parsedBody.data;
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

    const previousPlayerCount = state.playerCount ?? 1;
    state.playerCount = rosterCount;
    state.activePlayerCount = activeCount;

    // ensureSessionEnabledPhases mutates `state` in place for older persisted
    // sessions; only persist when that backfill actually changed the payload.
    const enabledPhasesBefore = JSON.stringify(state.enabledPhases ?? []);
    ensureSessionEnabledPhases(state);
    let shouldPersist = JSON.stringify(state.enabledPhases ?? []) !== enabledPhasesBefore;

    // Recompile the run plan when the roster grows during warmup so that
    // phases with higher minPlayers (e.g. lie_detective) are included once
    // enough participants have joined. The first caller created the session
    // with playerCount=1, so the initial plan may have excluded those phases.
    if (
      state.eventTier &&
      state.eventTier !== 'custom' &&
      state.currentPhase === 'warmup' &&
      rosterCount > previousPlayerCount
    ) {
      try {
        const newRunPlan = await compileForSession(state, state.eventTier);
        const oldPhases = state.runPlan?.segments?.map((s) => s.phase).join(',') ?? '';
        const newPhases = newRunPlan.segments.map((s) => s.phase).join(',');
        if (oldPhases !== newPhases) {
          state.runPlan = newRunPlan;
          shouldPersist = true;
        }
      } catch (err) {
        logger.warn('[SocialIcebreaker] Run plan recompilation failed on rejoin', {
          socialSessionId: existing.socialSessionId,
          playerCount: rosterCount,
          eventTier: state.eventTier,
          error: err instanceof Error ? err.message : String(err),
        });
        // Leave existing runPlan in place.
      }
    }

    if (shouldPersist) {
      await updateSession(existing.socialSessionId, state);
    }

    return res.json({
      socialSessionId: existing.socialSessionId,
      hostUserId: state.hostUserId,
      hostDisplayName: state.hostDisplayName,
      currentPhase: state.currentPhase,
      tierDisplayName: resolveTierDisplay(state.eventTier ?? 'breeze', { glowVariant: 'default' }),
      state: await buildClientState(state, userId),
    });
  }

  // Create new social session — first caller becomes host.
  const socialSessionId = getSocialSessionId(sessionId);
  const now = Date.now();
  const mappedTier = eventTier ? (LEGACY_TIER_MAP[eventTier] ?? eventTier) : undefined;
  const VALID_TIERS: TierMachineId[] = ['breeze', 'glow', 'blaze', 'custom'];
  let defaultTier: TierMachineId = !mappedTier ? await resolveIcebreakerDefaultTier(sessionId) : 'breeze';
  const resolvedTier: TierMachineId = mappedTier && VALID_TIERS.includes(mappedTier as TierMachineId) ? mappedTier as TierMachineId : defaultTier;
  const resolvedVibe: 'chat' | 'balanced' | 'game' = vibe && ['chat', 'balanced', 'game'].includes(vibe as string) ? vibe as 'chat' | 'balanced' | 'game' : 'balanced';

  if (resolvedTier === 'custom') {
    const customModeEnabled = await getFeatureFlag('socialIcebreakerCustomModeEnabled', true);
    if (!customModeEnabled) {
      return res.status(400).json({ error: 'Custom mode is not enabled' });
    }
  }

  if (!eventTier || !vibe) {
    logger.warn('Social icebreaker /start received missing tier/vibe, using defaults', {
      sessionId,
      userId,
      receivedEventTier: eventTier,
      receivedVibe: vibe,
      resolvedTier,
      resolvedVibe,
    });
  }

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
    vibe: resolvedVibe,
    enabledPhases: getServerEnabledPhases(),
    commonGroundCount: 0,
    warmupReadyUserIds: [],
    lieDetectiveCompletedUserIds: [],
    autoAdvanceEnabled: resolvedTier !== 'custom',
  };

  let runPlan: IcebreakerRunPlan | undefined;
  if (resolvedTier === 'custom') {
    newState.runPlan = undefined;
  } else {
    runPlan = await compileForSession(newState, resolvedTier);
    newState.runPlan = runPlan;
  }

  try {
    await createSession(newState);
    await upsertParticipant(socialSessionId, userId, displayName || '主持人');

    // Pre-compile warmup topics at session creation (best-effort, 3s timeout)
    const roster = await listParticipants(socialSessionId);
    try {
      const vibeMoodMap: Record<string, AtmosphereMood> = { chat: 'life', balanced: 'relaxed', game: 'funny' };
      const topicResult = await generateWarmupTopics({
        mood: vibeMoodMap[newState.vibe ?? 'balanced'] ?? 'relaxed',
        eventType: newState.eventType || '活动',
        participantCount: roster.length || 1,
        roster: roster.map((p) => ({ archetype: p.archetype })),
        vibe: newState.vibe,
      });
      newState.warmupTopics = topicResult.data;
      newState.warmupTopicsMeta = topicResult.meta;
      beginWarmupTurn(newState, roster, 0);
      await updateSession(socialSessionId, newState);
      logger.info('Warmup topics pre-compiled at session creation', {
        socialSessionId,
        source: topicResult.meta.fallbackUsed ? 'curated' : 'ai',
        topicCount: topicResult.data.length,
        vibe: newState.vibe,
      });
    } catch (warmupErr) {
      logger.warn('Warmup pre-compilation failed, session starts without cached topics', {
        socialSessionId,
        error: warmupErr instanceof Error ? warmupErr.message : String(warmupErr),
      });
    }

    // Pre-generate AI content for phases in the run plan (best-effort)
    if (runPlan) {
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
      tierDisplayName: resolveTierDisplay(concurrent.state.eventTier ?? 'breeze', { glowVariant: 'default' }),
      state: await buildClientState(concurrent.state, userId),
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

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!mood) {
    return res.status(400).json({ error: 'mood is required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can change topics' });
  }

  try {
    const participants = await listParticipants(socialSessionId);
    const topicResult = await generateWarmupTopics({
      mood,
      eventType,
      participantCount: state.playerCount || participantCount,
      avoidTopics,
      roster: participants || [],
      vibe: state.vibe,
    });

    state.warmupTopics = topicResult.data;
    state.warmupTopicsMeta = topicResult.meta;
    state.selectedMood = mood;
    beginWarmupTurn(state, participants, 0);
    await updateSession(socialSessionId, state);

    return res.json({ topics: topicResult.data, meta: topicResult.meta });
  } catch (error) {
    logger.error('[SocialIcebreaker] topics error:', { error });
    return res.status(500).json({ error: 'Failed to generate topics' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/warmup/reveal-topic
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/warmup/reveal-topic', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

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

  if (!state.warmupTopics?.length) {
    return res.status(400).json({ error: 'No warmup topics available' });
  }

  const isHost = await isHostAuthorized(state, userId, socialSessionId);
  const isTurnPlayer = !state.warmupTurnUserId || state.warmupTurnUserId === userId;
  if (!isHost && !isTurnPlayer) {
    return res.status(403).json({ error: 'Only the current speaker or host can reveal this topic' });
  }

  if (!state.warmupTurnUserId) {
    beginWarmupTurn(state, await listParticipants(socialSessionId), state.currentTopicIndex ?? 0);
  }

  state.warmupTopicRevealed = true;
  state.warmupTurnStartedAt = state.warmupTurnStartedAt ?? Date.now();
  state.warmupTurnDurationSeconds = state.warmupTurnDurationSeconds ?? WARMUP_TURN_DURATION_SECONDS;
  await updateSession(socialSessionId, state);

  return res.json({
    warmupTopicRevealed: state.warmupTopicRevealed,
    warmupTurnUserId: state.warmupTurnUserId,
    warmupTurnStartedAt: state.warmupTurnStartedAt,
    warmupTurnDurationSeconds: state.warmupTurnDurationSeconds,
    state: await buildClientState(state, userId),
  });
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

  if (!state.warmupTurnUserId) {
    beginWarmupTurn(state, await listParticipants(socialSessionId), state.currentTopicIndex ?? 0);
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
    warmupTurnUserId: state.warmupTurnUserId,
    warmupTurnStartedAt: state.warmupTurnStartedAt,
    warmupTopicRevealed: state.warmupTopicRevealed,
    warmupTurnDurationSeconds: state.warmupTurnDurationSeconds,
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

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can move to the next topic' });
  }

  if (state.currentPhase !== 'warmup') {
    return res.status(400).json({ error: 'Not in warmup phase' });
  }

  const topics = state.warmupTopics || [];
  if (topics.length === 0) {
    return res.status(400).json({ error: 'No warmup topics available' });
  }

  const turnCompleted = hasWarmupTurnCompleted(state);
  const timerExpired = isWarmupTurnExpired(state);
  const everyoneReady = hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount);

  if (!turnCompleted && !timerExpired && !everyoneReady) {
    return res.status(400).json({ error: 'Current speaker must finish or the timer must expire before changing topics' });
  }

  const currentTopicIndex = state.currentTopicIndex ?? 0;
  if (currentTopicIndex >= topics.length - 1) {
    return res.status(400).json({ error: 'No additional warmup topics remain' });
  }

  incrementCommonGround(state);
  beginWarmupTurn(state, await listParticipants(socialSessionId), currentTopicIndex + 1);
  await updateSession(socialSessionId, state);

  return res.json({
    currentTopicIndex: state.currentTopicIndex,
    currentTopic: state.warmupTopics?.[state.currentTopicIndex ?? 0] ?? null,
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

registerExtendedRoutes(router);

export default router;
