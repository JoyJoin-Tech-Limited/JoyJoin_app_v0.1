import type { Router } from 'express';
import type { SocialSessionState, SocialIcebreakerPhase, LieDetectivePlayer, LieDetectiveVote, LieDetectiveReveal } from '@shared/socialIcebreaker';
import { z } from 'zod';
import { AUCTION_STARTING_COINS, AUCTION_LOT_COUNT_MIN, AUCTION_MAX_LOTS } from '@shared/socialIcebreaker';
import { getAuctionUnsoldLotLine } from '@shared/copy/auctionV2';
import { resolveAuctionLotsPromptVersion } from '../socialIcebreakerAuctionAI';
import {
  generateXiaoYueComment,
  generateAuctionLots,
  generateLieDetectiveStatements,
  generateLieDetectiveStatementFromTag,
  validateLieDetectiveTag,
  getCuratedWarmupTopics,
  getLieDetectiveMode,
  getDynamicDifficulty,
  buildLieDetectiveV2RecapData,
} from '../socialIcebreakerAIService';
import { buildCachedAIMeta, buildFallbackAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import {
  buildClientState,
  hasAllRosterParticipantsResponded,
  incrementCommonGround,
  getCurrentLieDetectivePlayer,
  hydrateDerivedState,
  resolveSession,
  isHostAuthorized,
  recapDisplayNameByUserId,
  ensureRecapSnapshot,
  waitForDeferredRecapSnapshot,
  transitionPhase,
  hasWarmupTurnCompleted,
  // W3 — active-presence guards + honest opt-out
  reconcilePhasePresence,
  getPhaseRequiredRosterIds,
  getPhaseRequiredPlayerCount,
  markPhaseParticipationComplete,
  isPhaseRosterComplete,
  hasFullPhaseQuorum,
  buildAuctionAwardRecapLines,
} from './socialIcebreakerHelpers';
import { getPhaseModule } from '@shared/phaseRegistry';
import { emitSocialGroupBeat, emitAuctionOutbidBeatRateLimited } from '../lib/socialGroupBeats';
import { buildArchetypeContext } from '../lib/contextInjector';
import {
  getSessionWithExpiry,
  getParticipant,
  getParticipantLastSeenAt,
  transferHost,
  updateSession,
  updateSessionAtomic,
  listParticipants,
  setLieTruths,
  getLieTruths,
  computeRecapDwellMs,
  recordRecapDwellMetric,
  PRESENCE_THRESHOLD_MS,
} from '../lib/socialIcebreakerStore';
import {
  getHostClaimGraceMs,
  evaluateHostClaimEligibility,
} from '../lib/socialIcebreakerHostResilience';
import { logger } from '../lib/logger';
import { getFeatureFlag } from '../lib/featureFlags';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import { getBots, simulateBotsForSession, runBotSimulationSafely } from '../services/socialIcebreakerBotService';
import {
  buildCustomLieDetectiveStatements,
  resolveLieDetectiveTargetUserId,
} from '../lib/lieDetectiveSubmission';
import { validateContentSafeAsync, contentViolationResponse } from '../lib/contentSafety';
import { recordViolation } from '../abuseDetection';

export function registerExtendedRoutes(router: Router): void {

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/advance
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/advance', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;
  const { currentPhase, force } = req.body as { currentPhase: SocialIcebreakerPhase; force?: boolean };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!currentPhase) {
    return res.status(400).json({ error: 'currentPhase is required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can advance phases' });
  }

  // Fill any missing bot submissions before evaluating advance guards so that
  // single-test sessions with runBots can progress with only one real user.
  await simulateBotsForSession(socialSessionId, state).catch((err) => {
    logger.warn('[SocialIcebreaker] Bot simulation failed during advance', {
      socialSessionId,
      phase: state.currentPhase,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  if (state.currentPhase !== currentPhase) {
    return res.status(400).json({ error: 'Phase mismatch' });
  }

  if (currentPhase === 'phase_selection') {
    return res.status(400).json({ error: 'Use select-phase or end-session while in phase_selection' });
  }

  // `force` is the stall-nudge escape hatch: the host explicitly skips
  // stragglers. Per-phase completion guards are bypassed; structural checks
  // (auth, phase match) above always apply.
  const skipGuards = force === true;
  if (skipGuards) {
    logger.info('[SocialIcebreaker] Force advance requested (stall nudge)', {
      socialSessionId,
      phase: currentPhase,
      userId,
    });
  }

  if (currentPhase === 'warmup') {
    if ((state.warmupTopics || []).length === 0) {
      const healingMood = state.selectedMood ?? 'relaxed';
      state.selectedMood = healingMood;
      state.warmupTopics = getCuratedWarmupTopics(healingMood, state.vibe);
      state.warmupTopicsMeta = buildFallbackAIMeta('advance_route_missing_topics', 'social-warmup-topics-advance-heal');
      state.currentTopicIndex = state.currentTopicIndex ?? 0;
      await updateSession(socialSessionId, state).catch((err) => {
        logger.warn('[SocialIcebreaker] Warmup topic self-heal save failed during advance', {
          socialSessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    if (!skipGuards) {
      const everyoneReady = hasAllRosterParticipantsResponded(state.warmupReadyUserIds, state.playerCount);
      if (!everyoneReady && !hasWarmupTurnCompleted(state)) {
        return res.status(400).json({ error: 'Current speaker must finish before advancing warmup' });
      }

      if ((state.warmupTopics || []).length === 0) {
        return res.status(400).json({ error: 'Topic cards must be generated before advancing' });
      }
    }

    incrementCommonGround(state);
  }

  if (!skipGuards && currentPhase === 'micro_challenge') {
    // W3: scoped to the phase-entry roster snapshot; a silent member is
    // auto-completed after the timeout so the host never needs `force`.
    const presence = await reconcilePhasePresence(state, socialSessionId);
    if (!presence.complete) {
      return res.status(400).json({ error: 'Wait for everyone to finish' });
    }
  }

  if (!skipGuards && currentPhase === 'personality_dice') {
    const revealReady = hasAllRosterParticipantsResponded(state.diceRevealReadyBy, state.playerCount);
    if (!state.diceRevealOrder?.length || !revealReady) {
      return res.status(409).json({ error: 'Wait for everyone to prepare for the next game' });
    }
  }

  if (currentPhase === 'lie_detective') {
    if (!skipGuards) {
      // W3: reconcile silent members FIRST so a silent or late player is
      // removed from the required set before the generation / turn guards run
      // (a silent player who never generated would otherwise deadlock here).
      const presence = await reconcilePhasePresence(state, socialSessionId);
      // Quorum floor: with fewer than MIN_FULL_PHASE_QUORUM required members the
      // per-turn reveal can never happen (no other voter), so the phase is
      // structurally complete and the host advances without it (finding 4).
      if (hasFullPhaseQuorum(state)) {
        const generatedPlayers = state.lieDetectivePlayers || [];
        const requiredRoster = getPhaseRequiredRosterIds(state);
        const hasSnapshot = Boolean(state.phaseRosterSnapshot?.length);

        if (hasSnapshot) {
          const requiredSet = new Set(requiredRoster);
          const requiredGenerated = generatedPlayers.filter((player) =>
            requiredSet.has(player.userId),
          ).length;
          if (requiredGenerated < requiredRoster.length) {
            return res.status(400).json({ error: 'All participants must generate statements before leaving lie_detective' });
          }
        } else if (generatedPlayers.length < state.playerCount) {
          return res.status(400).json({ error: 'All participants must generate statements before leaving lie_detective' });
        }

        if (requiredRoster.length > 0) {
          const requiredSet = new Set(requiredRoster);
          let lastRequiredIndex = -1;
          for (let i = generatedPlayers.length - 1; i >= 0; i -= 1) {
            if (requiredSet.has(generatedPlayers[i].userId)) {
              lastRequiredIndex = i;
              break;
            }
          }
          const currentIndex = state.currentLieDetectivePlayerIndex ?? 0;
          if (lastRequiredIndex < 0 || currentIndex < lastRequiredIndex) {
            return res.status(400).json({ error: 'Finish every lie-detective turn before advancing' });
          }
          if (currentIndex === lastRequiredIndex) {
            const lastRequiredPlayer = generatedPlayers[lastRequiredIndex];
            const reveal = state.currentLieDetectiveReveal;
            if (!lastRequiredPlayer || !reveal || reveal.targetUserId !== lastRequiredPlayer.userId) {
              return res.status(400).json({ error: 'The current lie-detective turn must be revealed before advancing' });
            }
          }
        }

        if (!presence.complete) {
          return res.status(400).json({ error: 'Every lie-detective turn must be completed before advancing' });
        }
      }
    }

    // Build V2 recap data when leaving lie_detective
    const mode = getLieDetectiveMode(state.lieDetectiveMode);
    if (mode === 'v2' && state.lieDetectiveRevealHistory && state.lieDetectiveRevealHistory.length > 0) {
      state.recapData = state.recapData || {
        topicsDiscussed: [],
        challengesCompleted: 0,
        funMoments: [],
      };
      state.recapData.lieDetective = buildLieDetectiveV2RecapData(state.lieDetectiveRevealHistory);
    }
  }

  if (!skipGuards && currentPhase === 'auction') {
    if (!state.auctionAllLotsClosed) {
      return res.status(400).json({
        error: 'Host must close every auction lot (use close-lot) before advancing out of auction',
      });
    }
  }

  if (!skipGuards && currentPhase === 'mini_script') {
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

  if (!skipGuards && currentPhase === 'undercover_word') {
    if (!state.undercoverWordPair) {
      return res.status(400).json({ error: 'Word pair not generated' });
    }
    if (!state.undercoverWordRevealed) {
      return res.status(400).json({ error: 'Undercover word must be revealed before advancing' });
    }
  }

  if (!skipGuards && currentPhase === 'group_mirror') {
    if (!state.groupMirrorQuestions || state.groupMirrorQuestions.length === 0) {
      return res.status(400).json({ error: 'Group mirror questions not generated' });
    }
    if (!state.groupMirrorRevealed) {
      return res.status(400).json({ error: 'Group mirror results must be revealed before advancing' });
    }
  }

  if (!skipGuards && currentPhase === 'speed_friending') {
    if (!state.speedFriendingAllRoundsComplete) {
      return res.status(400).json({
        error: 'All speed friending rounds must be completed before advancing',
      });
    }
  }

  const result = await transitionPhase({
    state,
    socialSessionId,
    trigger: 'host_tap',
  });

  if (result.pausedAtBonusGate) {
    return res.json({ state: await buildClientState(state, userId) });
  }

  const effectiveNextPhase = result.nextPhase;

  // Fetch participant roster with profiles for personalised 悦仔 commentary
  let xyParticipants: Array<{ displayName: string; archetype?: string | null; profile?: import('@shared/socialIcebreaker').SocialSessionParticipantProfile | null }> | undefined;
  try {
    const roster = await listParticipants(socialSessionId);
    if (roster.length > 0) {
      xyParticipants = roster.map(p => ({
        displayName: p.displayName,
        archetype: p.archetype ?? null,
        profile: p.profile ?? undefined,
      }));
    }
  } catch {
    // Non-critical — comment generation works without participant context
  }

  const xyResult = await generateXiaoYueComment({
    phase: effectiveNextPhase,
    event: 'phase_start',
    playerCount: state.playerCount,
    participants: xyParticipants,
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
    content: result.challenge ? { challenge: result.challenge } : null,
    xiaoYueComment: xyResult.data,
    xiaoYueCommentMeta: xyResult.meta,
    meta: result.challengeMeta,
    state: await buildClientState(state, userId),
  });
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/opt-out
// W3 honest opt-out (只想听 / 换一个) for participation:'full' phases.
// Self-scoped ONLY: the authenticated user opts their own turn out; the server
// marks them complete for the phase so the advance guard passes with no host
// force and no separate "skipped" badge (they count in the ready/complete
// counter). Idempotent. Cleared on the next phase transition.
//
// Client contract:
//   Request  body: { phase?: SocialIcebreakerPhase }  (optional; must match current)
//   Response body: { ok: true, phase, optedOutUserId, state }
//   Client state field: state.phaseOptOutUserIds: string[]
//     → render the opted-out player's phase card as state `opt_out` when
//       state.phaseOptOutUserIds.includes(myUserId).
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/opt-out', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;
  const { phase: requestedPhase } = (req.body ?? {}) as { phase?: SocialIcebreakerPhase };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // Self-scoped: the target is always the authenticated session user. A body
  // userId is deliberately ignored so one player can never complete another's
  // turn.
  const participant = await getParticipant(socialSessionId, userId);
  if (!participant) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  if (requestedPhase && requestedPhase !== state.currentPhase) {
    return res.status(400).json({
      error: 'Phase mismatch',
      code: 'PHASE_MISMATCH',
      currentPhase: state.currentPhase,
    });
  }

  const phase = state.currentPhase;
  if (phase === 'recap' || phase === 'phase_selection' || (phase as string) === 'ended') {
    return res.status(400).json({ error: 'Cannot opt out of this phase', code: 'OPT_OUT_NOT_APPLICABLE' });
  }

  if (getPhaseModule(phase).participation !== 'full') {
    return res.status(400).json({
      error: 'Opt-out is only available in full-participation phases',
      code: 'OPT_OUT_NOT_APPLICABLE',
    });
  }

  // Atomic self-scoped append: two simultaneous opt-outs must not lose-update
  // each other's `phaseOptOutUserIds` (W3 finding 2). The row lock re-reads the
  // freshest state, mutates it, and re-checks the phase so a transition that
  // landed between the validation above and the lock is reported, not clobbered.
  const outcome = await updateSessionAtomic(socialSessionId, (fresh) => {
    if (fresh.currentPhase !== phase) return false;

    const optedOut = new Set(fresh.phaseOptOutUserIds ?? []);
    optedOut.add(userId);
    fresh.phaseOptOutUserIds = [...optedOut];

    // Mark complete so the shared ready/complete counter includes the player
    // and every stage gate for the phase passes without host force.
    markPhaseParticipationComplete(fresh, phase, userId);
    return true;
  });

  if (outcome.outcome === 'not_found') {
    return res.status(404).json({ error: 'Social session not found' });
  }
  if (outcome.outcome === 'aborted') {
    return res.status(400).json({
      error: 'Phase mismatch',
      code: 'PHASE_MISMATCH',
      currentPhase: outcome.state.currentPhase,
    });
  }

  const updatedState = outcome.state;

  logger.info('[SocialIcebreaker] player opted out of full-participation phase', {
    socialSessionId,
    userId,
    phase,
  });

  return res.json({
    ok: true,
    phase,
    optedOutUserId: userId,
    state: await buildClientState(updatedState, userId),
  });
});
// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/early-end
// Host escape hatch: jump the whole table to recap from any playable phase.
// The skipped phase is NOT counted as played so recap framing stays honest.
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/early-end', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can end the session early' });
  }

  const blockedPhases: SocialIcebreakerPhase[] = ['warmup', 'recap', 'phase_selection'];
  if (blockedPhases.includes(state.currentPhase) || (state.currentPhase as string) === 'ended') {
    return res.status(400).json({
      error: 'Session cannot be ended early from the current phase',
      code: 'EARLY_END_PHASE_BLOCKED',
    });
  }

  // Resolve a pending bonus gate cleanly so mid-vote players land in recap
  // without a ghost gate overlay.
  if (state.bonusGateOffered && !state.bonusGateAccepted && !state.bonusGateDeclined) {
    state.bonusGateDeclined = true;
    state.bonusGatePlayerSentiment = undefined;
  }

  state.endedEarlyAt = new Date().toISOString();
  state.interruptedAtPhase = state.currentPhase;

  await transitionPhase({
    state,
    socialSessionId,
    trigger: 'early_end_jump',
    targetPhase: 'recap',
    countCurrentPhaseCompleted: false,
    skipBonusGate: true,
    deferRecapSnapshot: true,
  });

  logger.info('[SocialIcebreaker] Session ended early by host', { socialSessionId, userId });
  return res.json({ state: await buildClientState(state, userId) });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/stall-nudge/dismiss
// Host dismisses the stall nudge; stall automation stays silent for this phase.
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/stall-nudge/dismiss', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can dismiss the stall nudge' });
  }

  state.stallNudgeAt = undefined;
  state.stallSuppressedForPhase = state.currentPhase;
  await updateSession(socialSessionId, state);

  return res.json({ state: await buildClientState(state, userId) });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/transfer-host
// Host-resilience claim: when the current host has been heartbeat-silent past
// SOCIAL_ICEBREAKER_HOST_CLAIM_GRACE_MS, any remaining participant may take
// over. Compare-and-swap in the store keeps concurrent claims atomic and makes
// a repeat claim by the new host idempotent.
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/transfer-host', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // Idempotent: the caller already holds the host role.
  if (state.hostUserId === userId) {
    logger.info('[SocialIcebreaker] host claim no-op (already host)', {
      request_id: req.requestId,
      socialSessionId,
      actorUserId: userId,
    });
    return res.json({
      transferred: false,
      alreadyHost: true,
      state: await buildClientState(state, userId),
    });
  }

  // Only an existing roster participant may claim — never a stranger.
  const claimant = await getParticipant(socialSessionId, userId);
  if (!claimant) {
    logger.warn('[SocialIcebreaker] host claim rejected (not a participant)', {
      request_id: req.requestId,
      socialSessionId,
      actorUserId: userId,
    });
    return res.status(403).json({
      error: 'Not a participant in this session',
      code: 'NOT_A_PARTICIPANT',
    });
  }

  // A stale roster row is not enough: the claimant must be currently present,
  // otherwise the role could move to a disengaged user and the room stays frozen.
  const claimantLastSeenAt = await getParticipantLastSeenAt(socialSessionId, userId);
  const claimantActive =
    claimantLastSeenAt !== null &&
    Date.now() - claimantLastSeenAt.getTime() <= PRESENCE_THRESHOLD_MS;
  if (!claimantActive) {
    logger.info('[SocialIcebreaker] host claim denied (claimant not active)', {
      request_id: req.requestId,
      socialSessionId,
      actorUserId: userId,
      claimantLastSeenAt: claimantLastSeenAt?.toISOString() ?? null,
      presenceThresholdMs: PRESENCE_THRESHOLD_MS,
    });
    return res.status(403).json({
      error: 'Claimant is not currently active',
      code: 'CLAIMANT_INACTIVE',
    });
  }

  const graceMs = getHostClaimGraceMs();
  const hostLastSeenAt = await getParticipantLastSeenAt(socialSessionId, state.hostUserId);
  const observedHostLastSeenAtMs = hostLastSeenAt ? hostLastSeenAt.getTime() : null;
  const eligibility = evaluateHostClaimEligibility({
    hostLastSeenAtMs: observedHostLastSeenAtMs,
    sessionStartedAtMs: state.sessionStartedAt,
    now: Date.now(),
    graceMs,
  });

  if (!eligibility.eligible) {
    logger.info('[SocialIcebreaker] host claim denied (host still active)', {
      request_id: req.requestId,
      socialSessionId,
      actorUserId: userId,
      hostUserId: state.hostUserId,
      hostSilenceMs: eligibility.hostSilenceMs,
      graceMs,
    });
    return res.status(403).json({
      error: 'Host is still active',
      code: 'HOST_ACTIVE',
      hostSilenceMs: eligibility.hostSilenceMs,
      graceMs,
    });
  }

  const transfer = await transferHost(
    socialSessionId,
    userId,
    claimant.displayName,
    state.hostUserId,
    observedHostLastSeenAtMs,
  );
  if (transfer.outcome === 'not_found') {
    return res.status(404).json({ error: 'Social session not found' });
  }
  if (transfer.outcome === 'conflict') {
    logger.warn('[SocialIcebreaker] host claim conflict (host changed concurrently)', {
      request_id: req.requestId,
      socialSessionId,
      actorUserId: userId,
      currentHostUserId: transfer.currentHostUserId,
    });
    return res.status(409).json({
      error: 'Host changed concurrently; retry',
      code: 'HOST_CLAIM_CONFLICT',
    });
  }
  if (transfer.outcome === 'host_active') {
    // The host heartbeated after the eligibility read but before the CAS.
    logger.info('[SocialIcebreaker] host claim denied (host heartbeat advanced mid-claim)', {
      request_id: req.requestId,
      socialSessionId,
      actorUserId: userId,
      hostUserId: transfer.currentHostUserId,
      hostLastSeenAt: transfer.hostLastSeenAt?.toISOString() ?? null,
      graceMs,
    });
    return res.status(403).json({
      error: 'Host is still active',
      code: 'HOST_ACTIVE',
    });
  }

  const alreadyHost = transfer.outcome === 'already_host';
  logger.info('[SocialIcebreaker] host role claimed after silence', {
    request_id: req.requestId,
    socialSessionId,
    actorUserId: userId,
    previousHostUserId: state.hostUserId,
    hostSilenceMs: eligibility.hostSilenceMs,
    graceMs,
    alreadyHost,
  });

  return res.json({
    transferred: !alreadyHost,
    alreadyHost,
    state: await buildClientState(transfer.state, userId),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/lie-detective/generate
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/lie-detective/generate', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;
  const { displayName, archetype, interests, statements: customStatementTexts, lieIndex } = req.body as {
    displayName: string;
    archetype?: string;
    interests?: string[];
    statements?: string[];
    lieIndex?: number;
  };

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!displayName) {
    return res.status(400).json({ error: 'displayName is required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // F3: Wrong-phase guard — statement generation is only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  if (!(await getParticipant(socialSessionId, userId))) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  // W3 (AC-W3.4): a player who joins after the phase-entry roster snapshot is
  // excluded from the turn rotation. Joining now would append them after the
  // last snapshot member and force their turn, deadlocking the advance guard.
  if (state.phaseRosterSnapshot?.length && !state.phaseRosterSnapshot.includes(userId)) {
    logger.info('[SocialIcebreaker] lie-detective generate rejected (joined after phase entry)', {
      socialSessionId,
      userId,
      phase: 'lie_detective',
    });
    return res.status(409).json({
      error: '这一轮已经开始，先旁听吧',
      code: 'PHASE_ROSTER_LOCKED',
    });
  }

  try {
    const isCustomSubmission = customStatementTexts !== undefined || lieIndex !== undefined;
    let statementResult: Awaited<ReturnType<typeof generateLieDetectiveStatements>>;
    if (isCustomSubmission) {
      let customStatements;
      try {
        customStatements = buildCustomLieDetectiveStatements(customStatementTexts, lieIndex);
      } catch (error) {
        logger.warn('[SocialIcebreaker] custom lie-detective statements rejected', {
          socialSessionId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        return res.status(400).json({
          error: error instanceof Error ? error.message : 'Invalid custom statements',
        });
      }

      for (const statement of customStatements) {
        const safetyResult = await validateContentSafeAsync(statement.text, 'lieDetectiveStatement', { userId });
        if (!safetyResult.safe && safetyResult.violation) {
          await recordViolation(userId, safetyResult.violation.type, safetyResult.violation.severity);
          return res.status(400).json(contentViolationResponse(safetyResult.violation).body);
        }
      }

      statementResult = {
        data: customStatements,
        meta: {
          generatedAt: new Date().toISOString(),
          fromCache: false,
          provider: null,
          fallbackUsed: false,
          promptVersion: 'social-lie-detective-user-v1',
        },
      };
    } else {
      const mode = getLieDetectiveMode(state.lieDetectiveMode);
      const difficulty = getDynamicDifficulty(state.lieDetectiveRevealHistory);

      const generateParams: Parameters<typeof generateLieDetectiveStatements>[0] = {
        userId,
        displayName,
        archetype,
        interests,
        mode,
        difficulty,
      };

      if (mode === 'v2') {
        const tags = state.lieDetectiveV2Tags?.[userId];
        if (!tags) {
          return res.status(400).json({ error: 'Tags not submitted. Please submit tags first.' });
        }
        generateParams.tags = tags;
      }

      statementResult = await generateLieDetectiveStatements(generateParams);
    }

    // Persist server-only truth data (isLie + V2 is_ai/source_tag) in the separate lie-truths table.
    await setLieTruths(socialSessionId, userId, statementResult.data);

    // Store sanitized statements (no isLie / is_ai / source_tag) in public session state.
    const players: LieDetectivePlayer[] = state.lieDetectivePlayers || [];
    const existingPlayer = players.findIndex((p: LieDetectivePlayer) => p.userId === userId);
    const sanitizedStatements = statementResult.data.map(s => ({ index: s.index, text: s.text }));

    if (existingPlayer >= 0) {
      players[existingPlayer].statements = sanitizedStatements;
    } else {
      const botUserIds = new Set(getBots(state).map((bot) => bot.userId));
      const player = { userId, displayName, statements: sanitizedStatements };
      if (botUserIds.size > 0 && !botUserIds.has(userId)) {
        // Custom single-test mode eagerly prepares bots. Keep the real tester
        // first without changing the established bot-ready lifecycle.
        players.unshift(player);
      } else {
        players.push(player);
      }
    }

    state.lieDetectivePlayers = players;
    state.lieDetectiveStatementsMeta = isCustomSubmission ? undefined : statementResult.meta;
    if (state.currentLieDetectivePlayerIndex === undefined) {
      state.currentLieDetectivePlayerIndex = 0;
    }
    state.lieDetectiveCompletedUserIds = state.lieDetectiveCompletedUserIds || [];
    state.currentLieDetectiveReveal = undefined;
    state.votes = state.votes || [];
    await updateSession(socialSessionId, state);

    // Single-test mode: bots cannot call this route themselves, so fill their
    // statements now or the phase stalls at "waiting for all statements".
    await runBotSimulationSafely(socialSessionId, state, 'lie-detective-generate');
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
  const { targetUserId: clientTargetUserId, guessedStatementIndex } = req.body as {
    targetUserId: string;
    guessedStatementIndex: number;
  };

  if (!voterId || !clientTargetUserId || guessedStatementIndex === undefined || guessedStatementIndex === null) {
    return res.status(400).json({ error: 'Authentication, targetUserId, and guessedStatementIndex are required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  // F3: Wrong-phase guard — votes are only valid during lie_detective phase
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }

  await runBotSimulationSafely(socialSessionId, state, 'lie-detective-vote');
  const targetUserId = resolveLieDetectiveTargetUserId(
    clientTargetUserId,
    state.singleTest?.botPersonas,
  );

  if (voterId === targetUserId) {
    return res.status(400).json({ error: 'Players cannot vote on their own statements' });
  }

  const currentPlayer = getCurrentLieDetectivePlayer(state);
  if (!currentPlayer || currentPlayer.userId !== targetUserId) {
    return res.status(400).json({ error: 'Votes are only allowed for the active lie-detective player' });
  }

  // W3: reconcile silent members into the departed set before gating, so an
  // absent player can never deadlock the vote. Then require every snapshot
  // member who is still required to have generated statements — a late joiner
  // outside the snapshot, or an opted-out/silent member, must not gate the
  // vote. A raw count comparison is fooled by a departed generator and misses
  // a non-required generator, so compare the required set explicitly.
  await reconcilePhasePresence(state, socialSessionId);
  const requiredRosterIds = getPhaseRequiredRosterIds(state);
  const generatedUserIds = new Set(
    (state.lieDetectivePlayers || []).map((p: LieDetectivePlayer) => p.userId),
  );
  const statementsReady =
    requiredRosterIds.length > 0
      ? requiredRosterIds.every((id) => generatedUserIds.has(id))
      : (state.lieDetectivePlayers || []).length >= state.playerCount;
  if (!statementsReady) {
    return res.status(400).json({ error: 'All participants must generate statements before voting begins' });
  }

  if (state.currentLieDetectiveReveal?.targetUserId === targetUserId) {
    const publicVotes = (state.votes || [])
      .filter((v: LieDetectiveVote) => v.targetUserId === targetUserId)
      .map((vote: LieDetectiveVote) => ({ ...vote, targetUserId: clientTargetUserId }));
    return res.json({
      votes: publicVotes,
      isRevealed: true,
      lieIndex: state.currentLieDetectiveReveal.lieIndex,
      reveal: {
        ...state.currentLieDetectiveReveal,
        targetUserId: clientTargetUserId,
      },
      state: await buildClientState(state, voterId),
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

  const otherPlayerCount = Math.max(0, getPhaseRequiredPlayerCount(state) - 1);
  const votesForTarget = votes.filter((v: LieDetectiveVote) => v.targetUserId === targetUserId).length;
  const isRevealed = votesForTarget >= otherPlayerCount && otherPlayerCount > 0;

  let lieIndex: number | undefined;
  let reveal: LieDetectiveReveal | undefined;

  // Compute per-statement vote counts for V2 recap / reveal
  const voteCounts: Record<number, number> = {};
  for (const v of votes.filter((v: LieDetectiveVote) => v.targetUserId === targetUserId)) {
    voteCounts[v.guessedStatementIndex] = (voteCounts[v.guessedStatementIndex] || 0) + 1;
  }

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
        aiStatementIndex: lieIndex,
        voteCounts,
      };
      state.currentLieDetectiveReveal = reveal;
      const completedUserIds = new Set(state.lieDetectiveCompletedUserIds || []);
      completedUserIds.add(targetUserId);
      state.lieDetectiveCompletedUserIds = [...completedUserIds];

      // V2: track reveal history for dynamic difficulty
      const mode = getLieDetectiveMode(state.lieDetectiveMode);
      if (mode === 'v2') {
        const correctRate = otherPlayerCount > 0 ? correctVoteCount / otherPlayerCount : 0;
        const history = state.lieDetectiveRevealHistory || [];
        const round = history.length + 1;
        history.push({ round, correctRate });
        state.lieDetectiveRevealHistory = history;
        state.lieDetectiveDynamicDifficulty = getDynamicDifficulty(history);
      }

      await updateSession(socialSessionId, state);
      // S6: group reveal beat (state-free; poll remains state truth).
      void emitSocialGroupBeat(state.icebreakerSessionId, 'reveal');
    }
  }

  const publicTargetUserId = clientTargetUserId;
  const publicVotes = votes
    .filter((v: LieDetectiveVote) => v.targetUserId === targetUserId)
    .map((vote) => ({ ...vote, targetUserId: publicTargetUserId }));
  const publicReveal = reveal ? { ...reveal, targetUserId: publicTargetUserId } : reveal;

  return res.json({
    votes: publicVotes,
    isRevealed,
    lieIndex,
    reveal: publicReveal,
    state: await buildClientState(state, voterId),
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

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can generate auction lots' });
  }

  if (state.currentPhase !== 'auction') {
    return res.status(400).json({ error: 'Not in auction phase' });
  }

  if ((state.auctionLots || []).length > 0) {
    const cachedMeta =
      state.auctionLotsMeta ??
      // Auction V2 (contract AC-07(f), verifier M1/N3): per-snapshot version
      // resolver — legacy/flag-off stamps v2 (fixing the old hardcoded-v1
      // drift), V2 sessions stamp v3. Meta-only, client-inert.
      buildCachedAIMeta(new Date(state.phaseStartedAt).toISOString(), null, resolveAuctionLotsPromptVersion(state.auctionV2Enabled));
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
    const archetypeCtx = buildArchetypeContext(roster);
    // Auction V2 (contract AC-07): flag OFF → args byte-identical to legacy
    // (no vibe, no targetLotCount, no session seed, participantCount as-is).
    const auctionV2 = state.auctionV2Enabled === true;
    const bidderCount = roster.filter((p) => p.userId !== state.hostUserId).length;
    const targetLotCount = auctionV2
      ? Math.min(Math.max(bidderCount, AUCTION_LOT_COUNT_MIN), AUCTION_MAX_LOTS)
      : undefined;
    const lotResult = await generateAuctionLots({
      participantCount: Math.max(state.playerCount, roster.length || 1),
      eventType: state.eventType,
      sessionContext: archetypeCtx.mixText ? { mixText: archetypeCtx.mixText } : undefined,
      ...(auctionV2
        ? { auctionV2: true, vibe: state.vibe, targetLotCount, sessionId: socialSessionId }
        : {}),
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
    state.auctionBidHistory = [];
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
// POST /api/social-icebreaker/:socialSessionId/auction/bid
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/auction/bid', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId: string = req.session?.userId;

  const bidSchema = z.object({ amount: z.number().int().positive() });
  const parsed = bidSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid bid data', details: parsed.error.format() });
  }
  const { amount } = parsed.data;

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

  const balances = { ...(state.auctionBalances || {}) };
  const available = balances[userId] ?? 0;
  const high = state.auctionHighBid;
  const spendable = available + (high?.userId === userId ? high.amount : 0);

  if (high && amount <= high.amount) {
    return res.status(400).json({ error: 'Bid must be higher than the current high bid' });
  }

  if (amount > spendable) {
    return res.status(400).json({ error: 'Insufficient virtual coins for this bid' });
  }

  const previousHighBidder = high?.userId ?? null;
  // Auction V2 (contract AC-04): all-in = bid commits the full spendable
  // balance (balance + own escrowed high bid). Flag OFF → isAllIn never
  // computed, records byte-identical to legacy.
  const auctionV2 = state.auctionV2Enabled === true;
  const isAllIn = auctionV2 && amount === spendable;

  if (high) {
    balances[high.userId] = (balances[high.userId] ?? 0) + high.amount;
  }

  balances[userId] = spendable - amount;
  state.auctionBalances = balances;
  state.auctionHighBid = isAllIn ? { userId, amount, isAllIn: true } : { userId, amount };

  // Persist bid to history (D5)
  const bidHistory = [...(state.auctionBidHistory || [])];
  const currentLotIndex = state.auctionCurrentLotIndex ?? 0;
  const bidRecord = { userId, amount, at: Date.now(), lotIndex: currentLotIndex };
  bidHistory.push(isAllIn ? { ...bidRecord, isAllIn: true } : bidRecord);
  state.auctionBidHistory = bidHistory.slice(0, 200); // cap at 200 entries

  await updateSession(socialSessionId, state);

  // Auction V2 (contract AC-05): fire-and-forget group beats — the 3s poll
  // stays the sole state truth; beats only buzz early. Dual-gated: the
  // session snapshot here + icebreakerGroupBeatsEnabled inside the emitter.
  if (auctionV2) {
    if (previousHighBidder && previousHighBidder !== userId) {
      void emitAuctionOutbidBeatRateLimited(state.icebreakerSessionId);
    }
    // All-in beat dedupe: same bidder re-firing while already holding an
    // all-in high bid does not re-buzz (spec D3.2).
    if (isAllIn && !(high?.userId === userId && high?.isAllIn === true)) {
      void emitSocialGroupBeat(state.icebreakerSessionId, 'auction_all_in');
    }
  }

  return res.json({
    highBid: state.auctionHighBid,
    balances: state.auctionBalances,
    previousHighBidder,
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

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
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
  const auctionV2 = state.auctionV2Enabled === true;

  // Auction V2 (contract AC-06, verifier M6): concurrent-duplicate guard. Two
  // parallel close-lot requests can read the same idx; the second one to
  // observe a settled result for this lotIndex no-ops instead of appending a
  // duplicate auctionLotResults entry or recap line. (A sequential same-lot
  // retry is unreachable — the first call advances auctionCurrentLotIndex;
  // the sequential middle-lot double-tap footgun is a pre-existing behavior
  // ruled out of scope by verifier R2.)
  if (auctionV2 && (state.auctionLotResults || []).some((r) => r.lotIndex === idx)) {
    return res.json({
      currentLotIndex: state.auctionCurrentLotIndex ?? 0,
      allLotsClosed: state.auctionAllLotsClosed ?? false,
      recapLines: state.auctionRecapLines,
      duplicate: true,
      state: await buildClientState(state, userId),
    });
  }

  const lines = [...(state.auctionRecapLines || [])];
  if (high) {
    lines.push(`${lot.title}由${nameOf(high.userId)}以${high.amount}虚拟币拍下`);
  } else {
    // Auction V2 softens the unsold copy (spec D7.4); flag OFF keeps the
    // legacy 「流拍（无人出价）」 byte-identical.
    lines.push(auctionV2 ? getAuctionUnsoldLotLine(lot.title) : `${lot.title}流拍（无人出价）`);
  }

  // Auction V2 (contract AC-06): per-lot settlement record — the finale's
  // sole data source. bidCount includes bot records (verifier M3: bot bids
  // carry lotIndex but no isAllIn — optional field, wasAllIn stays false).
  if (auctionV2) {
    const results = [...(state.auctionLotResults || [])];
    const lotBids = (state.auctionBidHistory || []).filter((b) => b.lotIndex === idx);
    const winningRecord = high
      ? [...lotBids].reverse().find((b) => b.userId === high.userId && b.amount === high.amount)
      : undefined;
    results.push({
      lotIndex: idx,
      lotId: lot.id,
      title: lot.title,
      winnerUserId: high?.userId ?? null,
      winningAmount: high?.amount ?? null,
      bidCount: lotBids.length,
      wasAllIn: winningRecord?.isAllIn === true,
    });
    state.auctionLotResults = results;
  }

  const isFinalLot = idx >= lots.length - 1;
  if (auctionV2 && isFinalLot) {
    // Recap v2 (contract AC-06): ≤3 deterministic award lines on the final
    // hammer. Budget: keep the newest 8 lines so award lines REPLACE the
    // earliest per-lot lines when over budget (never dropped themselves).
    lines.push(...buildAuctionAwardRecapLines(state.auctionLotResults ?? [], nameOf));
    state.auctionRecapLines = lines.slice(-8);
  } else {
    state.auctionRecapLines = lines.slice(0, 16);
  }
  state.auctionHighBid = null;

  if (isFinalLot) {
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
// GET /api/social-icebreaker/:socialSessionId/quip-battle/results
// ---------------------------------------------------------------------------

router.get('/:socialSessionId/quip-battle/results', async (req: any, res) => {
  const { socialSessionId } = req.params;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  // Authorize before resolveSession: resolveSession runs processAutoAdvance and may persist.
  const { state: preAuthState, expired: preExpired } = await getSessionWithExpiry(socialSessionId);
  if (!preAuthState) {
    if (preExpired) {
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    return res.status(404).json({ error: 'Social session not found' });
  }
  const prelim = hydrateDerivedState({ ...preAuthState });
  if (!(await isHostAuthorized(prelim, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can reveal quip battle results' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (state.currentPhase !== 'quip_battle') {
    return res.status(400).json({ error: 'Not in quip_battle phase' });
  }

  if (state.quipBattleRevealed && Array.isArray(state.quipBattleResults) && state.quipBattleResults.length > 0) {
    return res.json({
      results: state.quipBattleResults,
      allVoted: isPhaseRosterComplete(state, state.quipBattleVotedUserIds),
    });
  }

  const prompts = state.quipBattlePrompts || [];
  if (prompts.length === 0) {
    return res.status(400).json({ error: 'Quip battle prompts not generated' });
  }

  // W3: reconcile silent members into the departed set first, then use the
  // snapshot-scoped, presence-aware completion check for BOTH stages. The old
  // raw count against `playerCount` counted an opted-out/silent member as
  // missing, so a submit-stage opt-out blocked the reveal forever (BLOCKER).
  await reconcilePhasePresence(state, socialSessionId);
  if (!isPhaseRosterComplete(state, state.quipBattleSubmittedUserIds)) {
    return res.status(400).json({ error: 'All participants must submit answers before revealing results' });
  }

  if (!isPhaseRosterComplete(state, state.quipBattleVotedUserIds)) {
    return res.status(400).json({ error: 'All participants must vote before revealing results' });
  }

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
  // S6: group reveal beat (state-free; poll remains state truth).
  void emitSocialGroupBeat(state.icebreakerSessionId, 'reveal');

  return res.json({
    results,
    allVoted: isPhaseRosterComplete(state, state.quipBattleVotedUserIds),
  });
});
// ---------------------------------------------------------------------------
// GET /api/social-icebreaker/:socialSessionId/recap
// ---------------------------------------------------------------------------
router.get('/:socialSessionId/recap', async (req: any, res) => {
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

  let state = await resolveSession(socialSessionId, res);
  if (!state) return;

  await waitForDeferredRecapSnapshot(socialSessionId);
  state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!state.recapSnapshot) {
    await ensureRecapSnapshot(state, socialSessionId);
  }

  const snapshot = state.recapSnapshot;
  if (!snapshot) {
    return res.status(500).json({ error: 'Failed to generate recap' });
  }

  return res.json({
    summary: snapshot.recapSummary,
    meta: snapshot.meta,
    medals: snapshot.medals,
    lieDetectiveV2Stats: snapshot.lieDetectiveV2Stats,
    personalityDiceHighlights: snapshot.personalityDiceHighlights,
    undercoverWordResult: snapshot.undercoverWordResult,
    microChallengeHighlights: snapshot.microChallengeHighlights,
    groupMirrorHighlights: snapshot.groupMirrorHighlights,
    state: await buildClientState(state, userId),
  });
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/force-end
// Admin / kill-switch only: immediately end the session regardless of phase.
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/force-end', async (req: any, res) => {
  const { socialSessionId } = req.params;
  const userId = req.session?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'Only the host can force-end a session' });
  }

  const flagEnabled = await getFeatureFlag('socialIcebreakerClientForceEnd', false);
  if (!flagEnabled) {
    return res.status(503).json({ error: 'Force-end is not enabled', code: 'FORCE_END_DISABLED' });
  }

  // Wave 5 T-2 (G3 recap-dwell leg): force-end is a terminal exit that
  // bypasses transitionPhase, so a table sitting in recap would never get a
  // recap dwell row. Write it here (fire-and-forget, first-write-wins via
  // onConflictDoNothing — the TTL sweep writes the same row for sessions
  // that expire in recap, never a duplicate or overwrite).
  if (state.currentPhase === 'recap') {
    const recapDwellMs = computeRecapDwellMs(state.phaseStartedAt, Date.now());
    if (recapDwellMs !== null) {
      recordRecapDwellMetric(socialSessionId, {
        dwellTimeMs: recapDwellMs,
        startedAt: new Date(state.phaseStartedAt as number),
        endedAt: new Date(),
        participantCount: state.playerCount,
      }).catch((err) => {
        logger.warn('[PhaseMetrics] recap dwell save failed on force-end', {
          socialSessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  state.currentPhase = 'ended' as SocialIcebreakerPhase;
  await updateSession(socialSessionId, state);

  logger.info('[SocialIcebreaker] Session force-ended by host', { socialSessionId, userId });
  return res.json({ ended: true, phase: 'ended' });
});
router.post('/:socialSessionId/lie-detective/generate-from-tag', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const { socialSessionId } = req.params;
  const state = await resolveSession(socialSessionId, res);
  if (!state) return;
  if (state.currentPhase !== 'lie_detective') {
    return res.status(400).json({ error: 'Not in lie_detective phase' });
  }
  if (!(await getParticipant(socialSessionId, userId))) {
    return res.status(403).json({ error: 'Not a participant in this session' });
  }

  const validation = validateLieDetectiveTag(req.body?.tag);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const result = await generateLieDetectiveStatementFromTag({
    tag: validation.tag,
    displayName: typeof req.body?.displayName === 'string' ? req.body.displayName : '玩家',
  });
  return res.json({ text: result.data.text, meta: result.meta });
});
}
