import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { isSingleTestMode } from '../lib/isSingleTestMode';
import { db } from '../db';
import { users } from '@shared/schema';
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
  getCuratedWarmupTopics,
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
import { buildCachedAIMeta, buildFallbackAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import {
  cleanupPhaseStateForNextPhase,
  ensureSessionEnabledPhases,
  getServerEnabledPhases,
} from '../socialIcebreakerPhaseConfig';
import { DEFAULT_STANDARD_RUN_PLAN } from '@shared/phaseRegistry';
import { getRunPlanForTier } from '@shared/socialIcebreakerRunPlans';
import { compileForSession } from '../services/runPlanService';
import {
  buildCustomRunPlan,
  CUSTOM_GAME_PHASES,
  validateCustomGamePhases,
} from '../services/customRunPlanService';
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
import { sendApiError } from '../lib/errorResponse';
import { buildMomentCardPayload } from '../lib/momentCardPayload';
import { renderMomentCardToPng } from '../lib/momentCardRenderer';
import { curateMedals } from '../lib/medalCuration';
import { logger } from '../lib/logger';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import { validateContentSafeAsync, contentViolationResponse } from '../lib/contentSafety';
import { recordViolation } from '../abuseDetection';
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
import { resetSocialIcebreakerTier } from '../services/socialIcebreakerTierReset';
import { getSingleTestMetaForSessionStart } from '../services/singleTestService';
import { runBotSimulationSafely, seedSingleTestBotsWarmupReady } from '../services/socialIcebreakerBotService';

import socialIcebreakerTierRouter from './socialIcebreakerTier';
import socialIcebreakerCustomRouter from './socialIcebreakerCustom';
import socialIcebreakerXiaoyueRouter from './socialIcebreakerXiaoyue';
import socialIcebreakerGameplayCoreRouter from './socialIcebreakerGameplayCore';
import socialIcebreakerGameplayExtraRouter from './socialIcebreakerGameplayExtra';

const router = Router();

// ============ TEST-MODE BOT BYPASS ============
// In non-production single-test mode, allow only users tagged as virtual
// test bots to impersonate via x-test-user-id header. This prevents the
// bypass from being used to impersonate real users.
router.use(async (req: any, _res, next) => {
  const testUserId = req.headers['x-test-user-id'];
  if (!testUserId || typeof testUserId !== 'string') {
    return next();
  }
  if (process.env.APP_MODE === 'production') {
    logger.warn('[SocialIcebreaker] x-test-user-id bypass rejected in production', { testUserId });
    return next();
  }
  if (!isSingleTestMode()) {
    return next();
  }
  try {
    const [user] = await db
      .select({ isTestBot: users.isTestBot })
      .from(users)
      .where(eq(users.id, testUserId))
      .limit(1);
    if (user?.isTestBot) {
      req.user = { id: testUserId };
      logger.info('[SocialIcebreaker] x-test-user-id bot impersonation', { testUserId });
    } else {
      logger.warn('[SocialIcebreaker] x-test-user-id rejected for non-test user', { testUserId });
    }
  } catch (err) {
    logger.error('[SocialIcebreaker] x-test-user-id bypass lookup failed', {
      testUserId,
      error: err instanceof Error ? err.message : String(err),
    });
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
  selectedPhases: z.array(z.enum(CUSTOM_GAME_PHASES as [string, ...string[]])).max(9).optional(),
});

const VALID_START_TIERS: TierMachineId[] = ['breeze', 'glow', 'blaze', 'custom'];
const VALID_START_VIBES: Array<'chat' | 'balanced' | 'game'> = ['chat', 'balanced', 'game'];

function resolveIncomingTier(eventTier: string | undefined): TierMachineId | undefined {
  if (!eventTier) return undefined;
  const mapped = LEGACY_TIER_MAP[eventTier] ?? eventTier;
  return VALID_START_TIERS.includes(mapped as TierMachineId) ? (mapped as TierMachineId) : undefined;
}

function resolveIncomingVibe(vibe: string | undefined): 'chat' | 'balanced' | 'game' | undefined {
  if (!vibe) return undefined;
  return VALID_START_VIBES.includes(vibe as 'chat' | 'balanced' | 'game')
    ? (vibe as 'chat' | 'balanced' | 'game')
    : undefined;
}

function scheduleStartBackgroundGeneration(params: {
  socialSessionId: string;
  state: SocialSessionState;
  eventType?: string;
  runPlan?: IcebreakerRunPlan;
}): void {
  const { socialSessionId, state, eventType, runPlan } = params;

  void (async () => {
    const roster = await listParticipants(socialSessionId);

    if (runPlan) {
      void enqueueRunPlanPreGeneration(
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
      ).catch((preGenErr) => {
        logger.warn('Failed to enqueue run plan pre-generation on start', {
          socialSessionId,
          error: preGenErr instanceof Error ? preGenErr.message : String(preGenErr),
        });
      });
    }

    const warmupBudgetMs = process.env.NODE_ENV === 'test' ? 50 : 3000;
    let warmupBudgetTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const vibeMoodMap: Record<string, AtmosphereMood> = { chat: 'life', balanced: 'relaxed', game: 'funny' };
      const topicResult = await Promise.race([
        generateWarmupTopics({
          mood: vibeMoodMap[state.vibe ?? 'balanced'] ?? 'relaxed',
          eventType: state.eventType || eventType || '活动',
          participantCount: roster.length || 1,
          roster: roster.map((p) => ({ archetype: p.archetype })),
          vibe: state.vibe,
        }),
        new Promise<null>((resolve) => {
          warmupBudgetTimer = setTimeout(() => resolve(null), warmupBudgetMs);
        }),
      ]);

      if (topicResult) {
        const latestState = await getSession(socialSessionId);
        if (!latestState) {
          return;
        }

        if ((latestState.warmupTopics?.length ?? 0) > 0 || latestState.selectedMood) {
          logger.info('Warmup pre-compilation skipped because topics were already requested', {
            socialSessionId,
            topicCount: latestState.warmupTopics?.length ?? 0,
            selectedMood: latestState.selectedMood,
          });
          return;
        }

        latestState.warmupTopics = topicResult.data;
        latestState.warmupTopicsMeta = topicResult.meta;
        await updateSession(socialSessionId, latestState);
        logger.info('Warmup topics pre-compiled after session start', {
          socialSessionId,
          source: topicResult.meta.fallbackUsed ? 'curated' : 'ai',
          topicCount: topicResult.data.length,
          vibe: latestState.vibe,
        });
      } else {
        logger.warn('Warmup pre-compilation exceeded background budget', {
          socialSessionId,
          budgetMs: warmupBudgetMs,
        });
      }
    } catch (warmupErr) {
      logger.warn('Warmup pre-compilation failed after session start', {
        socialSessionId,
        error: warmupErr instanceof Error ? warmupErr.message : String(warmupErr),
      });
    } finally {
      if (warmupBudgetTimer) clearTimeout(warmupBudgetTimer);
    }
  })().catch((err) => {
    logger.warn('Start background generation failed', {
      socialSessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

router.get('/custom-games', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const customModeEnabled = await getFeatureFlag('socialIcebreakerCustomModeEnabled', true);
  if (!customModeEnabled) {
    return res.json({ phases: [] });
  }

  return res.json({ phases: CUSTOM_GAME_PHASES });
});

router.post('/start', async (req: any, res) => {
  const parsedBody = startBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { sessionId, displayName, eventType, eventTier, vibe, selectedPhases } = parsedBody.data;
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  // Content-moderation gate (S6): displayName must be validated BEFORE it is
  // persisted on either path (rejoin upsertParticipant or new-session
  // createSession / hostDisplayName).
  if (displayName && displayName.trim().length > 0) {
    const safety = await validateContentSafeAsync(displayName, 'icebreakerDisplayName', { userId });
    if (!safety.safe && safety.violation) {
      await recordViolation(userId, safety.violation.type, safety.violation.severity);
      return res.status(400).json(contentViolationResponse(safety.violation).body);
    }
  }

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  let access: Awaited<ReturnType<typeof getSocialIcebreakerAccess>>;
  try {
    access = await getSocialIcebreakerAccess(sessionId, userId);
  } catch (accessErr) {
    // A failing access check must still produce a response — an uncaught
    // throw here becomes an unhandled rejection that hangs the request until
    // the client times out and misreports it as a network problem.
    logger.error('[SocialIcebreaker] /start access check failed', {
      sessionId,
      userId,
      error: accessErr instanceof Error ? accessErr.message : String(accessErr),
    });
    return sendApiError(res, 500, 'Internal error', 'START_FAILED');
  }
  if (!access.allowed) {
    logger.warn('[SocialIcebreaker] /start access denied', {
      sessionId,
      userId,
      status: access.status,
      code: access.code,
    });
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

    // Single-test sessions: backfill bot attendees so the warmup roster always
    // reflects the full debug group (covers sessions created before bots were
    // registered unconditionally). Bots default to ready during warmup.
    let botsBackfilled = false;
    if (state.singleTest?.botPersonas?.length) {
      for (const persona of state.singleTest.botPersonas) {
        await upsertParticipant(existing.socialSessionId, persona.userId, persona.displayName, true);
      }
      if (state.currentPhase === 'warmup') {
        const readyBefore = (state.warmupReadyUserIds ?? []).length;
        seedSingleTestBotsWarmupReady(state);
        botsBackfilled = (state.warmupReadyUserIds ?? []).length !== readyBefore;
      }
    }

    const [rosterCount, activeCount] = await Promise.all([
      getRosterCount(existing.socialSessionId),
      getActiveParticipantCount(existing.socialSessionId),
    ]);

    const previousPlayerCount = state.playerCount ?? 1;
    state.playerCount = rosterCount;
    state.activePlayerCount = activeCount;

    // ensureSessionEnabledPhases mutates `state` in place for older persisted
    // sessions; only persist when that backfill actually changed the payload.
    const enabledPhasesBefore = JSON.stringify(state.enabledPhases ?? []);
    ensureSessionEnabledPhases(state);
    let shouldPersist =
      JSON.stringify(state.enabledPhases ?? []) !== enabledPhasesBefore || botsBackfilled;

    // Detect a tier/vibe change from the mini-program tier-selector and reset
    // the session accordingly. This fixes the case where a single-player test
    // session is created as `glow` and later switched to `custom`.
    let tierResetOccurred = false;
    const resolvedIncomingTier = resolveIncomingTier(eventTier);
    if (resolvedIncomingTier) {
      const resolvedIncomingVibe = resolveIncomingVibe(vibe);
      const customModeEnabled = await getFeatureFlag('socialIcebreakerCustomModeEnabled', true);
      let customRunPlan: IcebreakerRunPlan | undefined;
      if (
        resolvedIncomingTier === 'custom' &&
        state.hostUserId === userId &&
        state.currentPhase === 'warmup' &&
        selectedPhases !== undefined
      ) {
        if (!customModeEnabled) {
          return res.status(400).json({ error: 'Custom mode is not enabled' });
        }
        const customValidation = validateCustomGamePhases(
          selectedPhases as SocialIcebreakerPhase[],
        );
        if (!customValidation.ok) {
          return res.status(400).json({
            error: 'Custom game selection is unavailable',
            code: customValidation.reason === 'empty'
              ? 'CUSTOM_GAMES_REQUIRED'
              : 'CUSTOM_GAME_UNAVAILABLE',
          });
        }
        customRunPlan = buildCustomRunPlan(customValidation.phases);
      }
      const resetResult = await resetSocialIcebreakerTier({
        state,
        newTier: resolvedIncomingTier,
        newVibe: resolvedIncomingVibe,
        userId,
        resetSource: '/start',
        customModeEnabled,
        customRunPlan,
      });
      if (resetResult.reset) {
        tierResetOccurred = true;
        // resetSocialIcebreakerTier already persists the mutated state. Avoid a
        // second write on the /start critical path, which can make the CTA feel
        // stuck on slow staging databases.
        shouldPersist = false;
      }

    }

    // Recompile the run plan when the roster grows during warmup so that
    // phases with higher minPlayers (e.g. lie_detective) are included once
    // enough participants have joined. The first caller created the session
    // with playerCount=1, so the initial plan may have excluded those phases.
    // Skip this when a tier reset just recompiled the plan.
    if (
      !tierResetOccurred &&
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
  const resolvedTier: TierMachineId = resolveIncomingTier(eventTier) ?? 'breeze';
  const resolvedVibe: 'chat' | 'balanced' | 'game' = resolveIncomingVibe(vibe) ?? 'balanced';

  if (resolvedTier === 'custom') {
    const customModeEnabled = await getFeatureFlag('socialIcebreakerCustomModeEnabled', true);
    if (!customModeEnabled) {
      return res.status(400).json({ error: 'Custom mode is not enabled' });
    }
    if (selectedPhases !== undefined) {
      const customValidation = validateCustomGamePhases(
        selectedPhases as SocialIcebreakerPhase[],
      );
      if (!customValidation.ok) {
        return res.status(400).json({
          error: 'Custom game selection is unavailable',
          code: customValidation.reason === 'empty'
            ? 'CUSTOM_GAMES_REQUIRED'
            : 'CUSTOM_GAME_UNAVAILABLE',
        });
      }
    }
  }

  // Single-test metadata is retained for custom and preset sessions alike so
  // bot simulations can execute the same selected run plan as real groups.
  // Guarded like the access check above: a failing single-test lookup must
  // still produce a response — an uncaught throw becomes an unhandled
  // rejection (Express 4 does not forward async-handler rejections), hanging
  // the request until the client times out and misreports it as a network
  // problem. Fall back to a session without bot metadata.
  let singleTestMeta: import('@shared/socialIcebreaker').SingleTestState | null = null;
  if (isSingleTestMode()) {
    try {
      singleTestMeta = await getSingleTestMetaForSessionStart(sessionId);
    } catch (singleTestErr) {
      logger.error('[SocialIcebreaker] single-test metadata lookup failed', {
        sessionId,
        userId,
        error: singleTestErr instanceof Error ? singleTestErr.message : String(singleTestErr),
      });
      singleTestMeta = null;
    }
  }
  const isBotSimulation = Boolean(singleTestMeta?.runBots);

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
    playerCount: 1 + (singleTestMeta?.botPersonas?.length ?? 0),
    activePlayerCount: 1 + (singleTestMeta?.botPersonas?.length ?? 0),
    phaseStartedAt: now,
    sessionStartedAt: now,
    completedPhases: [],
    eventType,
    eventTier: resolvedTier,
    vibe: resolvedVibe,
    enabledPhases: getServerEnabledPhases(),
    commonGroundCount: 0,
    // Single-test bot attendees default to ready so the host can preview the
    // full "everyone ready" warmup flow immediately.
    warmupReadyUserIds: singleTestMeta?.botPersonas?.map((p) => p.userId) ?? [],
    lieDetectiveCompletedUserIds: [],
    // Countdown-driven phase advancement is intentionally disabled. The host
    // decides when the table has had enough time to react and recap.
    autoAdvanceEnabled: false,
    personalityDiceChooseModeEnabled:
      (process.env.PERSONALITY_DICE_CHOOSE_MODE_ENABLED ?? 'true').toLowerCase() === 'true',
    ...(singleTestMeta ? { singleTest: singleTestMeta } : {}),
  };

  let runPlan: IcebreakerRunPlan | undefined;
  if (resolvedTier === 'custom') {
    if (selectedPhases !== undefined) {
      const customValidation = validateCustomGamePhases(
        selectedPhases as SocialIcebreakerPhase[],
      );
      if (!customValidation.ok) {
        return res.status(400).json({
          error: 'Custom game selection is unavailable',
          code: customValidation.reason === 'empty'
            ? 'CUSTOM_GAMES_REQUIRED'
            : 'CUSTOM_GAME_UNAVAILABLE',
        });
      }
      runPlan = buildCustomRunPlan(customValidation.phases);
      newState.runPlan = runPlan;
    } else {
      // Backward compatibility for older clients that still use the
      // between-round custom phase picker.
      newState.runPlan = undefined;
    }
  } else {
    runPlan = await compileForSession(newState, resolvedTier);
    newState.runPlan = runPlan;
  }

  try {
    await createSession(newState);
    await upsertParticipant(socialSessionId, userId, displayName || '主持人');

    // Single-test sessions: register virtual bots as participants so the
    // warmup roster shows every debug-group attendee (not only when the bot
    // simulation harness is enabled via SOCIAL_ICEBREAKER_TEST_MODE_ENABLED).
    if (singleTestMeta?.botPersonas) {
      for (const persona of singleTestMeta.botPersonas) {
        await upsertParticipant(socialSessionId, persona.userId, persona.displayName, true);
      }
      logger.info('social_icebreaker_test_mode_bots_joined', {
        sessionId,
        socialSessionId,
        groupId: singleTestMeta.groupId,
        botCount: singleTestMeta.botPersonas.length,
        botArchetypes: singleTestMeta.bots.map((b) => b.archetype),
        runBots: isBotSimulation,
      });
    }

    // Start must return as soon as the session and participant rows exist.
    // Warmup topic pre-compilation and run-plan pre-generation are helpful,
    // but they must never block the button that enters the session.
    scheduleStartBackgroundGeneration({ socialSessionId, state: newState, eventType, runPlan });

    logger.info('Started social icebreaker session', {
      sessionId,
      socialSessionId,
      userId,
      tier: resolvedTier,
      vibe: newState.vibe,
      selectedPhases: runPlan?.compilerId === 'custom-selection-v1'
        ? runPlan.segments.map((segment) => segment.phase)
        : undefined,
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      logger.error('Failed to create social icebreaker session', {
        sessionId,
        userId,
        tier: resolvedTier,
        vibe: newState.vibe,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Return a real 500 instead of rethrowing: an uncaught async throw hangs
      // the request until the client times out and shows a misleading
      // "network" toast for what is actually a server-side failure.
      return sendApiError(res, 500, 'Internal error', 'START_FAILED');
    }

    const concurrent = await getSessionByIcebreakerSessionId(sessionId);
    if (!concurrent) {
      logger.error('Unique constraint on session create but no concurrent session found', {
        sessionId,
        userId,
      });
      return sendApiError(res, 500, 'Internal error', 'START_FAILED');
    }
    if (concurrent.expired) {
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }

    const concurrentParticipant = await getParticipant(concurrent.socialSessionId, userId);
    const participantDisplayName =
      displayName || concurrentParticipant?.displayName || concurrent.state.hostDisplayName;

    await upsertParticipant(concurrent.socialSessionId, userId, participantDisplayName);

    const [rosterCount, activeCount] = await Promise.all([
      getRosterCount(concurrent.socialSessionId),
      getActiveParticipantCount(concurrent.socialSessionId),
    ]);
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

  // Persist the mood pick BEFORE generation so a failed first attempt keeps
  // the client's 重试 path alive (it re-fires /topics with the stored mood).
  // Merge onto the latest persisted state — writing the whole T0 snapshot
  // here could resurrect a pre-transition state if a fuse fired during the
  // host-authorization await above.
  try {
    const latest = await getSessionWithExpiry(socialSessionId);
    const moodBase = latest.state ? hydrateDerivedState({ ...latest.state }) : state;
    moodBase.selectedMood = mood;
    // Mark generation in-flight BEFORE the LLM call so the stall detector
    // suspends nudges/fuses while the host is waiting on the system.
    moodBase.warmupTopicsStatus = 'generating';
    moodBase.warmupTopicsGeneratingAt = Date.now();
    // Retract any stall nudge/fuse already issued — the host is acting again;
    // a stale stall fuse would otherwise fire mid-generation.
    moodBase.stallNudgeAt = undefined;
    if (moodBase.advanceFuseKind === 'stall_recovery') {
      moodBase.autoAdvanceScheduledAt = undefined;
      moodBase.advanceFuseKind = undefined;
    }
    await updateSession(socialSessionId, moodBase);
  } catch (error) {
    logger.warn('[SocialIcebreaker] topics mood persistence failed; continuing to generate topics', {
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Participant profile enrichment improves prompts but is not required to
  // serve a playable warmup. A transient join/profile query failure must not
  // turn the curated, fallback-rich topic path into an HTTP 500.
  const participants = await listParticipants(socialSessionId).catch((error) => {
    logger.warn('[SocialIcebreaker] topics roster enrichment unavailable; continuing without roster context', {
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  });

  let topicResult: { data: SocialSessionState['warmupTopics']; meta: AIResponseMeta };
  try {
    topicResult = await generateWarmupTopics({
      mood,
      eventType,
      participantCount: state.playerCount || participantCount,
      avoidTopics,
      roster: participants || [],
      vibe: state.vibe,
    });
  } catch (error) {
    logger.error('[SocialIcebreaker] topics generation failed; serving curated fallback topics', {
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    topicResult = {
      data: getCuratedWarmupTopics(mood, state.vibe),
      meta: buildFallbackAIMeta('route_generation_error', 'social-warmup-topics-route-fallback'),
    };
  }

  // Re-read the latest state before write-back: generation takes seconds and
  // concurrent routes (/warmup/ready, /advance, polls) may have mutated the
  // session meanwhile. Writing the stale T0 snapshot back would silently
  // clobber those writes (lost update). Merge only the fields this route owns.
  let stateToPersist = state;
  try {
    const latest = await getSessionWithExpiry(socialSessionId);
    if (latest.state) {
      stateToPersist = hydrateDerivedState({ ...latest.state });
    }
  } catch (error) {
    logger.warn('[SocialIcebreaker] topics pre-save re-read failed; merging onto last-known state', {
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  stateToPersist.selectedMood = mood;
  stateToPersist.warmupTopics = topicResult.data;
  stateToPersist.warmupTopicsMeta = topicResult.meta;
  stateToPersist.warmupTopicsStatus = 'ready';
  stateToPersist.warmupTopicsGeneratingAt = undefined;
  stateToPersist.currentTopicIndex = 0;
  stateToPersist.warmupReadyUserIds = [];
  // Single-test bot attendees default to ready on the fresh topic set.
  seedSingleTestBotsWarmupReady(stateToPersist);
  try {
    await updateSession(socialSessionId, stateToPersist);
  } catch (error) {
    logger.error('[SocialIcebreaker] topics save failed after generation; returning playable topics to client', {
      socialSessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return res.json({
      topics: topicResult.data,
      meta: {
        ...topicResult.meta,
        fallbackUsed: true,
        evaluatorRejectionReason: topicResult.meta.evaluatorRejectionReason ?? 'session_persist_failed',
      },
      state: await buildClientState(stateToPersist, userId),
      persistence: { saved: false },
    });
  }

  return res.json({ topics: topicResult.data, meta: topicResult.meta, state: await buildClientState(stateToPersist, userId) });
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

  if ((state.warmupTopics || []).length === 0) {
    const healingMood = state.selectedMood ?? 'relaxed';
    state.selectedMood = healingMood;
    state.warmupTopics = getCuratedWarmupTopics(healingMood, state.vibe);
    state.warmupTopicsMeta = buildFallbackAIMeta('ready_route_missing_topics', 'social-warmup-topics-ready-heal');
    state.warmupTopicsStatus = 'ready';
    state.warmupTopicsGeneratingAt = undefined;
    state.currentTopicIndex = 0;
  }

  const readyUserIds = new Set(state.warmupReadyUserIds || []);
  if (ready) {
    readyUserIds.add(userId);
  } else {
    readyUserIds.delete(userId);
  }

  state.warmupReadyUserIds = [...readyUserIds];

  // Bot attendees belong to the debug roster even when the optional simulation
  // harness is disabled. This also repairs sessions where /topics failed and
  // the mini-program rendered its local fallback topic before this request.
  seedSingleTestBotsWarmupReady(state);

  // The simulation harness may add phase-specific bot actions when enabled.
  await runBotSimulationSafely(socialSessionId, state, 'warmup-ready');

  await updateSession(socialSessionId, state);

  const clientState = await buildClientState(state, userId);

  return res.json({
    readyUserIds: clientState.warmupReadyUserIds,
    readyCount: clientState.warmupReadyUserIds?.length ?? 0,
    allReady: hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount),
    currentTopicIndex: state.currentTopicIndex ?? 0,
    commonGroundCount: state.commonGroundCount ?? 0,
    state: clientState,
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

  if ((state.warmupTopics || []).length === 0) {
    const healingMood = state.selectedMood ?? 'relaxed';
    state.selectedMood = healingMood;
    state.warmupTopics = getCuratedWarmupTopics(healingMood, state.vibe);
    state.warmupTopicsMeta = buildFallbackAIMeta('next_topic_route_missing_topics', 'social-warmup-topics-next-heal');
    state.warmupTopicsStatus = 'ready';
    state.warmupTopicsGeneratingAt = undefined;
    state.currentTopicIndex = 0;
    seedSingleTestBotsWarmupReady(state);
    await updateSession(socialSessionId, state);
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
  // Single-test bot attendees default to ready on each new topic card.
  seedSingleTestBotsWarmupReady(state);
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
