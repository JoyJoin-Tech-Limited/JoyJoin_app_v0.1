import { Router } from 'express';
import { z } from 'zod';
import {
  migrateLegacySocialIcebreakerPhases,
  type SocialSessionState,
  type MiniScriptPlayerRuntimeView,
} from '@shared/socialIcebreaker';
import {
  miniScriptGenerateRequestSchema,
  miniScriptVoteSchema,
  type MiniScriptStoryFramework,
  type MiniScriptStoryFrameworkPublic,
} from '@shared/miniscriptStoryFramework';
import {
  getSessionWithExpiry,
  updateSession,
  setMiniScriptSecrets,
  getMiniScriptSecrets,
  listParticipants,
} from '../../lib/socialIcebreakerStore';
import { validateContentSafe, contentViolationResponse } from '../../lib/contentSafety';
import { requireAuthenticatedUserId } from '../../lib/requestAuth';
import { generateMiniScriptFrameworkWithMeta } from '../../lib/miniscriptAgent';
import { MINISCRIPT_GENERATION_PROMPT_VERSION } from '../../ai/miniscriptPrompts';
import { buildCachedAIMeta } from '@shared/types/aiMeta';
import { ensureSessionEnabledPhases, cleanupPhaseStateForNextPhase } from '../../socialIcebreakerPhaseConfig';
import { logger } from '../../lib/logger';
import { aiEndpointLimiter } from '../../rateLimiter';
import { buildClientState, isHostAuthorized } from '../socialIcebreakerHelpers';
import { runBotSimulationSafely } from '../../services/socialIcebreakerBotService';

const router = Router();

function hydrateMiniScriptState(state: SocialSessionState): SocialSessionState {
  return { ...state };
}

/** Extract server-only secrets from a full v2 framework. */
function extractSecrets(framework: MiniScriptStoryFramework) {
  return {
    solution: framework.solution,
    playerKnowledge: framework.playerKnowledge,
    redHerrings: framework.redHerrings ?? [],
    deductionChain: framework.deductionChain ?? [],
    allClues: framework.clues,
  };
}

/** Strip secrets from a full framework, producing a public-safe version. */
function stripFrameworkSecrets(
  framework: MiniScriptStoryFramework,
): MiniScriptStoryFrameworkPublic {
  return {
    schemaVersion: framework.schemaVersion,
    style: framework.style,
    genres: framework.genres,
    gameModeConfig: framework.gameModeConfig,
    premise: framework.premise,
    characters: framework.characters.map((c) => {
      const { secret: _secret, ...pub } = c;
      return pub;
    }),
    act_flow: framework.act_flow,
    ending: framework.ending,
  };
}

// ─── POST /generate ──────────────────────────────────────────────────────────

router.post('/generate', aiEndpointLimiter, async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = miniScriptGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, playerCount, style, genres, lite } = parsed.data;
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) {
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    return res.status(404).json({ error: 'Social session not found' });
  }

  const session = hydrateMiniScriptState({ ...state });
  migrateLegacySocialIcebreakerPhases(session);
  ensureSessionEnabledPhases(session);

  if (userId !== session.hostUserId) {
    return res.status(403).json({ error: 'HOST_ONLY' });
  }

  if (session.currentPhase !== 'mini_script') {
    return res.status(400).json({ error: 'WRONG_PHASE', message: '仅在「迷你剧本杀」环节可生成剧本' });
  }

  if (!session.enabledPhases?.includes('mini_script')) {
    return res.status(403).json({ error: 'FEATURE_DISABLED' });
  }

  if (session.playerCount < 4) {
    return res.status(400).json({ error: 'NOT_ENOUGH_PLAYERS', message: '至少需要 4 位玩家' });
  }

  if (playerCount !== session.playerCount) {
    return res.status(400).json({
      error: 'PLAYER_COUNT_MISMATCH',
      message: 'playerCount 必须与当前房间人数一致',
      expected: session.playerCount,
    });
  }

  /** Idempotent: avoid duplicate LLM cost and overwriting a host-approved framework. */
  if (session.miniScriptFramework) {
    const generatedAt = session.miniScriptFrameworkGeneratedAt
      ? new Date(session.miniScriptFrameworkGeneratedAt).toISOString()
      : new Date().toISOString();
    return res.json({
      ...session.miniScriptFramework,
      meta: buildCachedAIMeta(generatedAt, null, MINISCRIPT_GENERATION_PROMPT_VERSION),
    });
  }

  try {
    const roster = await listParticipants(socialSessionId);
    const { framework, aiResponseMeta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: session.playerCount,
      style,
      genres,
      lite: lite ?? false,
      roster,
    });

    // Slice 4: extract and persist secrets BEFORE storing framework on session state
    const secrets = extractSecrets(framework);
    await setMiniScriptSecrets(socialSessionId, secrets);

    // Store public-safe framework only
    const publicFramework = stripFrameworkSecrets(framework);
    session.miniScriptFramework = publicFramework;
    session.miniScriptFrameworkGeneratedAt = Date.now();
    session.miniScriptFrameworkGeneratedByUserId = userId;

    await updateSession(socialSessionId, session);

    return res.json({ ...publicFramework, meta: aiResponseMeta });
  } catch (error) {
    logger.error('[miniscript] generate failed', { error, socialSessionId });
    return res.status(500).json({ error: 'GENERATION_FAILED' });
  }
});

// ─── POST /assign-roles ──────────────────────────────────────────────────────

const assignRolesBodySchema = z.object({
  socialSessionId: z.string().min(1),
});

router.post('/assign-roles', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = assignRolesBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId } = parsed.data;
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (userId !== state.hostUserId) {
    return res.status(403).json({ error: 'HOST_ONLY' });
  }

  if (state.currentPhase !== 'mini_script') {
    return res.status(400).json({ error: 'WRONG_PHASE' });
  }

  if (!state.miniScriptFramework) {
    return res.status(400).json({ error: 'FRAMEWORK_NOT_GENERATED' });
  }

  // Idempotent: if roles already assigned, return current state
  if (state.miniScriptRoleAssignments && Object.keys(state.miniScriptRoleAssignments).length > 0) {
    return res.json({
      roleAssignments: state.miniScriptRoleAssignments,
      playerRuntimeViews: state.miniScriptPlayerRuntimeViews,
      currentAct: state.miniScriptCurrentAct ?? 0,
    });
  }

  // Fetch secrets to build runtime views
  const secrets = await getMiniScriptSecrets(socialSessionId);
  if (!secrets) {
    logger.error('[miniscript] secrets missing for assign-roles', { socialSessionId });
    return res.status(500).json({ error: 'SECRETS_NOT_FOUND' });
  }

  // Round-robin role assignment by join order (participants array is sorted by joinedAt)
  const participants = await listParticipants(socialSessionId);
  const characterCount = state.miniScriptFramework.characters.length;

  if (participants.length > characterCount) {
    return res.status(400).json({
      error: 'TOO_MANY_PLAYERS',
      message: `This script supports ${characterCount} characters, but ${participants.length} players joined.`,
    });
  }

  const roleAssignments: Record<string, number> = {};
  participants.forEach((p, idx) => {
    roleAssignments[p.userId] = idx;
  });

  // Build player runtime views
  const playerRuntimeViews: Record<string, MiniScriptPlayerRuntimeView> = {};
  for (const [userIdKey, slotIndex] of Object.entries(roleAssignments)) {
    const character = state.miniScriptFramework.characters[slotIndex];
    const knowledge = secrets.playerKnowledge.find((k) => k.slotIndex === slotIndex);
    playerRuntimeViews[userIdKey] = {
      slotIndex,
      roleLabel: character.roleLabel,
      sinHook: character.sinHook,
      alibi: character.alibi,
      secretAgenda: knowledge?.secretAgenda ?? '',
    };
  }

  state.miniScriptRoleAssignments = roleAssignments;
  state.miniScriptPlayerRuntimeViews = playerRuntimeViews;
  state.miniScriptCurrentAct = 0;
  state.miniScriptRevealedClueIds = [];
  state.miniScriptVotes = [];
  state.miniScriptSolutionRevealed = false;

  await updateSession(socialSessionId, state);

  logger.info('[miniscript] roles assigned', {
    socialSessionId,
    userId,
    action: 'assign-roles',
    playerCount: participants.length,
  });

  return res.json({
    roleAssignments,
    playerRuntimeViews,
    currentAct: 0,
  });
});

// ─── POST /reveal-act ────────────────────────────────────────────────────────

const revealActBodySchema = z.object({
  socialSessionId: z.string().min(1),
  targetAct: z.number().int().min(1).max(5),
});

router.post('/reveal-act', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = revealActBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, targetAct } = parsed.data;
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (userId !== state.hostUserId) {
    return res.status(403).json({ error: 'HOST_ONLY' });
  }

  if (state.currentPhase !== 'mini_script') {
    return res.status(400).json({ error: 'WRONG_PHASE' });
  }

  if (!state.miniScriptFramework) {
    return res.status(400).json({ error: 'FRAMEWORK_NOT_GENERATED' });
  }

  const currentAct = state.miniScriptCurrentAct ?? 0;

  // Idempotent: already at target act
  if (currentAct === targetAct) {
    return res.json({
      currentAct: targetAct,
      revealedClueIds: state.miniScriptRevealedClueIds ?? [],
    });
  }

  if (targetAct !== currentAct + 1) {
    return res.status(400).json({
      error: 'INVALID_ACT_SEQUENCE',
      message: `只能依次解锁幕次：当前 ${currentAct}，请求 ${targetAct}`,
    });
  }

  const secrets = await getMiniScriptSecrets(socialSessionId);
  if (!secrets) {
    return res.status(500).json({ error: 'SECRETS_NOT_FOUND' });
  }

  const newlyRevealedClues = secrets.allClues.filter((c) => c.revealedInAct === targetAct);
  const newlyRevealedIds = newlyRevealedClues.map((c) => c.clueId);

  state.miniScriptRevealedClueIds = [
    ...(state.miniScriptRevealedClueIds ?? []),
    ...newlyRevealedIds,
  ];
  state.miniScriptRevealedClues = [
    ...(state.miniScriptRevealedClues ?? []),
    ...newlyRevealedClues.map((c) => ({ clueId: c.clueId, text: c.text })),
  ];
  // Compute deduction hints: chain steps where all fromClues are now revealed
  const revealedClueIdSet = new Set(state.miniScriptRevealedClueIds ?? []);
  const deductionHints = (secrets.deductionChain ?? [])
    .filter((step) => step.fromClues.every((cid) => revealedClueIdSet.has(cid)))
    .map((step) => ({ stepNumber: step.stepNumber, conclusion: step.conclusion }));
  state.miniScriptDeductionHints = deductionHints;

  state.miniScriptCurrentAct = targetAct;

  await updateSession(socialSessionId, state);

  logger.info('[miniscript] act revealed', {
    socialSessionId,
    userId,
    action: 'reveal-act',
    targetAct,
    newClues: newlyRevealedIds.length,
    deductionHints: deductionHints.length,
  });

  return res.json({
    currentAct: targetAct,
    revealedClueIds: state.miniScriptRevealedClueIds,
    deductionHints,
  });
});

// ─── POST /vote ──────────────────────────────────────────────────────────────

const voteBodySchema = z.object({
  socialSessionId: z.string().min(1),
  vote: miniScriptVoteSchema,
});

router.post('/vote', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = voteBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, vote } = parsed.data;

  // Content-filter free-text fields
  for (const field of [vote.who, vote.what, vote.why]) {
    if (field) {
      const safetyResult = validateContentSafe(field, 'vote');
      if (!safetyResult.safe && safetyResult.violation?.severity === 'severe') {
        return res.status(400).json(contentViolationResponse(safetyResult.violation!).body);
      }
    }
  }

  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    return res.status(404).json({ error: 'Social session not found' });
  }

  await runBotSimulationSafely(socialSessionId, state, 'mini-script-vote');

  if (state.currentPhase !== 'mini_script') {
    return res.status(400).json({ error: 'WRONG_PHASE' });
  }

  if (!state.miniScriptRoleAssignments || state.miniScriptRoleAssignments[userId] === undefined) {
    return res.status(400).json({ error: 'NO_ROLE_ASSIGNED' });
  }

  const votes = state.miniScriptVotes ?? [];
  const existingIdx = votes.findIndex((v) => v.userId === userId);
  const voteEntry = {
    userId,
    who: vote.who,
    what: vote.what,
    why: vote.why,
    votedAt: Date.now(),
  };

  if (existingIdx >= 0) {
    votes[existingIdx] = voteEntry;
  } else {
    votes.push(voteEntry);
  }

  state.miniScriptVotes = votes;
  await updateSession(socialSessionId, state);

  return res.json({ ok: true, vote: voteEntry });
});

// ─── POST /reveal-solution ───────────────────────────────────────────────────

const revealSolutionBodySchema = z.object({
  socialSessionId: z.string().min(1),
});

router.post('/reveal-solution', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = revealSolutionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId } = parsed.data;
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (userId !== state.hostUserId) {
    return res.status(403).json({ error: 'HOST_ONLY' });
  }

  if (state.currentPhase !== 'mini_script') {
    return res.status(400).json({ error: 'WRONG_PHASE' });
  }

  // Idempotent: return cached solution if already revealed
  const secrets = await getMiniScriptSecrets(socialSessionId);
  if (!secrets) {
    return res.status(500).json({ error: 'SECRETS_NOT_FOUND' });
  }

  if (!state.miniScriptSolutionRevealed) {
    state.miniScriptSolutionRevealed = true;
    await updateSession(socialSessionId, state);

    logger.info('[miniscript] solution revealed', {
      socialSessionId,
      userId,
      action: 'reveal-solution',
    });
  }

  return res.json({
    solution: secrets.solution,
    revealed: true,
  });
});

// ─── POST /ready ─────────────────────────────────────────────────────────────

const readyBodySchema = z.object({
  socialSessionId: z.string().min(1),
  ready: z.boolean(),
});

router.post('/ready', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = readyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, ready } = parsed.data;
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    return res.status(404).json({ error: 'Social session not found' });
  }

  await runBotSimulationSafely(socialSessionId, state, 'mini-script-ready');

  if (state.currentPhase !== 'mini_script') {
    return res.status(400).json({ error: 'WRONG_PHASE' });
  }

  if (!state.miniScriptRoleAssignments || state.miniScriptRoleAssignments[userId] === undefined) {
    return res.status(400).json({ error: 'NO_ROLE_ASSIGNED' });
  }

  const readyMap = { ...(state.miniScriptPlayerReady ?? {}) };
  readyMap[userId] = ready;
  state.miniScriptPlayerReady = readyMap;
  await updateSession(socialSessionId, state);

  logger.info('[miniscript] player ready toggled', {
    socialSessionId,
    userId,
    ready,
    readyCount: Object.values(readyMap).filter(Boolean).length,
  });

  return res.json({ ok: true, readyMap });
});

// ── Bonus gate routes ──────────────────────────────────────────────────────

const bonusRespondSchema = z.object({
  socialSessionId: z.string(),
  accept: z.boolean(),
});

router.post('/bonus/respond', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = bonusRespondSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, accept } = parsed.data;
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (!(await isHostAuthorized(state, userId, socialSessionId))) {
    return res.status(403).json({ error: 'HOST_ONLY' });
  }

  if (!state.bonusGateOffered) {
    return res.status(400).json({ error: 'BONUS_GATE_NOT_OFFERED' });
  }

  if (state.bonusGateAccepted || state.bonusGateDeclined) {
    return res.status(409).json({ error: 'BONUS_GATE_ALREADY_RESPONDED' });
  }

  if (accept) {
    state.bonusGateAccepted = true;
    // Transition into mini_script phase
    const priorPhase = state.currentPhase;
    cleanupPhaseStateForNextPhase(state, priorPhase);
    state.currentPhase = 'mini_script';
    state.phaseStartedAt = Date.now();
    state.pulseChecks = [];
    await updateSession(socialSessionId, state);
    logger.info('[miniscript] bonus gate accepted', { socialSessionId, hostUserId: userId });
    return res.json({ state: buildClientState(state) });
  }

  // Decline: skip mini_script and go to recap
  state.bonusGateDeclined = true;
  const priorPhase = state.currentPhase;
  cleanupPhaseStateForNextPhase(state, priorPhase);
  state.currentPhase = 'recap';
  state.phaseStartedAt = Date.now();
  state.pulseChecks = [];
  await updateSession(socialSessionId, state);
  logger.info('[miniscript] bonus gate declined', { socialSessionId, hostUserId: userId });
  return res.json({ state: buildClientState(state) });
});

const bonusSentimentSchema = z.object({
  socialSessionId: z.string(),
  sentiment: z.enum(['want', 'pass']),
});

router.post('/bonus/sentiment', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = bonusSentimentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, sentiment } = parsed.data;
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (!state.bonusGateOffered || state.bonusGateAccepted || state.bonusGateDeclined) {
    return res.status(400).json({ error: 'BONUS_GATE_NOT_ACTIVE' });
  }

  const sentimentMap = { ...(state.bonusGatePlayerSentiment ?? {}) };
  sentimentMap[userId] = sentiment;
  state.bonusGatePlayerSentiment = sentimentMap;
  await updateSession(socialSessionId, state);

  logger.info('[miniscript] bonus sentiment recorded', { socialSessionId, userId, sentiment });
  return res.json({ ok: true, sentimentMap });
});

export default router;
