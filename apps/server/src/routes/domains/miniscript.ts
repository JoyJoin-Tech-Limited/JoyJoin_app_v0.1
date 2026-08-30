import { Router } from 'express';
import { z } from 'zod';
import {
  migrateLegacySocialIcebreakerPhases,
  MINISCRIPT_CEREMONY_MAX_BEAT,
  type SocialSessionState,
  type MiniScriptPlayerRuntimeView,
  type MiniScriptPresentedEvidence,
  type MiniScriptPlayerResult,
  type MiniScriptVote,
} from '@shared/socialIcebreaker';
import {
  miniScriptGenerateRequestSchema,
  miniScriptVoteSchema,
  computeMiniScriptVoteProgress,
  deriveMiniScriptTitleFromPremise,
  resolveCorrectMotiveIndex,
  type MiniScriptGenerationStage,
  type MiniScriptGenerationStatus,
  type MiniScriptStoryFramework,
  type MiniScriptStoryFrameworkPublic,
  type MiniScriptStyle,
  type MiniScriptLibraryItem,
} from '@shared/miniscriptStoryFramework';
import { sanitizeMiniScriptUserText } from '@shared/miniscriptCatalog';
import {
  getSessionWithExpiry,
  updateSession,
  setMiniScriptSecrets,
  getMiniScriptSecrets,
  listParticipants,
} from '../../lib/socialIcebreakerStore';
import { validateContentSafeAsync, contentViolationResponse } from '../../lib/contentSafety';
import { recordViolation } from '../../abuseDetection';
import { requireAuthenticatedUserId } from '../../lib/requestAuth';
import { adaptCatalogEntry, generateMiniScriptFrameworkWithMeta } from '../../lib/miniscriptAgent';
import { getCatalogEntries, getCatalogEntryById } from '../../lib/miniscriptCatalog';
import { MINISCRIPT_GENERATION_PROMPT_VERSION } from '../../ai/miniscriptPrompts';
import { buildCachedAIMeta, buildAIGCMeta } from '@shared/types/aiMeta';
import { ensureSessionEnabledPhases, cleanupPhaseStateForNextPhase } from '../../socialIcebreakerPhaseConfig';
import { logger } from '../../lib/logger';
import { aiEndpointLimiter } from '../../rateLimiter';
import { buildClientState, isHostAuthorized, transitionPhase } from '../socialIcebreakerHelpers';
import {
  runBotSimulationSafely,
  seedSingleTestBotsMiniScriptReady,
} from '../../services/socialIcebreakerBotService';

const router = Router();

type MiniScriptGenerationResult = {
  framework: MiniScriptStoryFrameworkPublic;
  meta: Awaited<ReturnType<typeof generateMiniScriptFrameworkWithMeta>>['aiResponseMeta'] & { aigc: { aiGenerated: boolean; labelType?: 'ai-generated' | 'ai-assisted' } };
};

// Collapse same-session double taps into one model call. The entry is removed
// after success or failure, so retries remain possible and memory stays bounded.
const generationInFlight = new Map<string, Promise<MiniScriptGenerationResult>>();
const generationStatuses = new Map<string, MiniScriptGenerationStatus>();
const GENERATION_ESTIMATE_MS = 32_000;
const GENERATION_STATUS_TTL_MS = 60_000;

function setGenerationStatus(
  socialSessionId: string,
  stage: MiniScriptGenerationStage,
  progress: number,
  selection?: { style: MiniScriptStyle; genres: string[]; selectedLabel?: string },
) {
  const previous = generationStatuses.get(socialSessionId);
  generationStatuses.set(socialSessionId, {
    stage,
    progress,
    startedAt: previous?.startedAt ?? Date.now(),
    updatedAt: Date.now(),
    estimatedTotalMs: GENERATION_ESTIMATE_MS,
    style: selection?.style ?? previous?.style,
    genres: (selection?.genres ?? previous?.genres) as MiniScriptGenerationStatus['genres'],
    selectedLabel: selection?.selectedLabel ?? previous?.selectedLabel,
  });
}

function expireGenerationStatus(socialSessionId: string) {
  const timer = setTimeout(() => generationStatuses.delete(socialSessionId), GENERATION_STATUS_TTL_MS);
  timer.unref?.();
}

function hydrateMiniScriptState(state: SocialSessionState): SocialSessionState {
  return { ...state };
}

/** Extract server-only secrets from a full v2 framework. */
export function extractSecrets(framework: MiniScriptStoryFramework) {
  const evidenceReactions: Record<string, Record<string, string>> = {};
  for (const act of framework.act_flow) {
    for (const item of act.evidence ?? []) {
      if (item.evidenceReactions) {
        evidenceReactions[item.id] = { ...item.evidenceReactions };
      }
    }
  }
  return {
    // The correct motive stays server-only inside solution.why; the public
    // motiveOptions list never carries a correctness marker.
    solution: framework.solution,
    playerKnowledge: framework.playerKnowledge,
    redHerrings: framework.redHerrings ?? [],
    deductionChain: framework.deductionChain ?? [],
    allClues: framework.clues,
    resolutionSummary: framework.ending.resolutionSummary,
    evidenceReactions,
    // V2 P2: resolve the correct motive once at generate/select time.
    // null = no resolvable motive round → the framework degrades to the
    // single-step vote (contract AC-04).
    correctMotiveIndex: resolveCorrectMotiveIndex({
      motiveOptions: framework.motiveOptions,
      solutionWhy: framework.solution.why,
      solutionMotiveIndex: framework.solution.motiveIndex,
    }),
  };
}

/** Strip secrets from a full framework, producing a public-safe version. */
export function stripFrameworkSecrets(
  framework: MiniScriptStoryFramework,
): MiniScriptStoryFrameworkPublic {
  return {
    schemaVersion: framework.schemaVersion,
    style: framework.style,
    genres: framework.genres,
    gameModeConfig: framework.gameModeConfig,
    title: framework.title
      ? sanitizeMiniScriptUserText(framework.title)
      : undefined,
    premise: sanitizeMiniScriptUserText(framework.premise),
    characters: framework.characters.map((c) => {
      const { secret: _secret, ...pub } = c;
      return pub;
    }),
    act_flow: framework.act_flow.map((act) => ({
      ...act,
      // evidenceReactions is server-only (lookup table for present-evidence);
      // it must never ride the public act_flow payload.
      evidence: act.evidence?.map((item) => {
        const { evidenceReactions: _reactions, ...pub } = item;
        return pub;
      }),
    })),
    ending: {
      ...framework.ending,
      // The structured solution and the narrative resolution stay server-only
      // until the host explicitly reveals the truth.
      resolutionSummary: '真相将在最终揭晓时公开。',
    },
    voteOptions: framework.voteOptions,
    motiveOptions: framework.motiveOptions,
  };
}

/**
 * Library display title: prefer the framework's own title; otherwise derive
 * from the premise's first clause (never a bare mid-sentence cut).
 */
function catalogTitle(framework: { title?: string; premise: string }): string {
  const explicit = framework.title?.trim();
  if (explicit) return explicit;
  return deriveMiniScriptTitleFromPremise(
    sanitizeMiniScriptUserText(framework.premise),
    14,
  );
}

function assertHostMiniScriptSession(
  state: SocialSessionState,
  userId: string,
): { status: number; error: string } | null {
  if (userId !== state.hostUserId) return { status: 403, error: 'HOST_ONLY' };
  if (state.currentPhase !== 'mini_script') return { status: 400, error: 'WRONG_PHASE' };
  if (!state.enabledPhases?.includes('mini_script')) return { status: 403, error: 'FEATURE_DISABLED' };
  if (state.playerCount < 4 || state.playerCount > 6) return { status: 400, error: 'INVALID_PLAYER_COUNT' };
  return null;
}

router.get('/library', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;
  const parsed = z.object({
    socialSessionId: z.string().min(1),
    style: z.enum(['western_court', 'medieval', 'ancient_chinese', 'xianxia', 'future_tech', 'modern_urban', 'republican_era']),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_QUERY', details: parsed.error.flatten() });

  const { socialSessionId, style } = parsed.data;
  const { state, expired } = await getSessionWithExpiry(socialSessionId);
  if (!state) return res.status(expired ? 410 : 404).json({ error: expired ? 'SESSION_EXPIRED' : 'Social session not found' });
  const guard = assertHostMiniScriptSession(state, userId);
  if (guard) return res.status(guard.status).json({ error: guard.error });

  const scripts: MiniScriptLibraryItem[] = getCatalogEntries()
    .filter((entry) => entry.style === style)
    .map((entry) => ({
      id: entry.id,
      source: 'catalog',
      style: entry.style,
      genres: [...entry.genres],
      title: catalogTitle(entry.framework),
      premise: sanitizeMiniScriptUserText(entry.framework.premise),
      playerCount: state.playerCount,
    }));
  if (state.miniScriptCandidateFramework?.style === style) {
    scripts.unshift({
      id: 'current-generation',
      source: 'session',
      style,
      genres: [...state.miniScriptCandidateFramework.genres],
      title: catalogTitle(state.miniScriptCandidateFramework),
      premise: sanitizeMiniScriptUserText(state.miniScriptCandidateFramework.premise),
      playerCount: state.miniScriptCandidateFramework.characters.length,
      generatedAt: state.miniScriptCandidateGeneratedAt,
    });
  }
  const generationStatus = generationStatuses.get(socialSessionId);
  return res.json({
    scripts,
    generationStatus: generationStatus?.style === style ? generationStatus : null,
  });
});

router.post('/select', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;
  const parsed = z.object({ socialSessionId: z.string().min(1), scriptId: z.string().min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  const { socialSessionId, scriptId } = parsed.data;
  const { state, expired } = await getSessionWithExpiry(socialSessionId);
  if (!state) return res.status(expired ? 410 : 404).json({ error: expired ? 'SESSION_EXPIRED' : 'Social session not found' });
  const guard = assertHostMiniScriptSession(state, userId);
  if (guard) return res.status(guard.status).json({ error: guard.error });
  if (state.miniScriptRoleAssignments && Object.keys(state.miniScriptRoleAssignments).length > 0) {
    return res.status(409).json({ error: 'ROLES_ALREADY_ASSIGNED' });
  }
  if (scriptId === 'current-generation' && state.miniScriptCandidateFramework) {
    state.miniScriptFramework = state.miniScriptCandidateFramework;
    state.miniScriptFrameworkGeneratedAt = state.miniScriptCandidateGeneratedAt ?? Date.now();
    state.miniScriptFrameworkGeneratedByUserId = userId;
    state.miniScriptFrameworkMeta = state.miniScriptCandidateFrameworkMeta;
    state.miniScriptCandidateFramework = undefined;
    state.miniScriptCandidateGeneratedAt = undefined;
    state.miniScriptCandidateGeneratedByUserId = undefined;
    state.miniScriptCandidateFrameworkMeta = undefined;
    await updateSession(socialSessionId, state);
    return res.json(state.miniScriptFramework);
  }
  const entry = getCatalogEntryById(scriptId);
  if (!entry) return res.status(404).json({ error: 'SCRIPT_NOT_FOUND' });

  const framework = adaptCatalogEntry(entry.framework, {
    playerCount: state.playerCount,
    style: entry.style,
    genres: [...entry.genres],
  });
  await setMiniScriptSecrets(socialSessionId, extractSecrets(framework));
  state.miniScriptFramework = stripFrameworkSecrets(framework);
  state.miniScriptFrameworkGeneratedAt = Date.now();
  state.miniScriptFrameworkGeneratedByUserId = userId;
  state.miniScriptFrameworkMeta = {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    provider: null,
    fallbackUsed: false,
    aigc: { aiGenerated: false },
  };
  state.miniScriptCandidateFramework = undefined;
  state.miniScriptCandidateGeneratedAt = undefined;
  state.miniScriptCandidateGeneratedByUserId = undefined;
  state.miniScriptCandidateFrameworkMeta = undefined;
  await updateSession(socialSessionId, state);
  logger.info('[miniscript] catalog script selected', { socialSessionId, scriptId, userId });
  return res.json(state.miniScriptFramework);
});

// ─── POST /generate ──────────────────────────────────────────────────────────

router.get('/generation-status', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const socialSessionId = typeof req.query.socialSessionId === 'string'
    ? req.query.socialSessionId
    : '';
  if (!socialSessionId) {
    return res.status(400).json({ error: 'INVALID_SESSION_ID' });
  }

  const { state, expired } = await getSessionWithExpiry(socialSessionId);
  if (!state) {
    return res.status(expired ? 410 : 404).json({
      error: expired ? 'SESSION_EXPIRED' : 'Social session not found',
    });
  }
  if (userId !== state.hostUserId) {
    return res.status(403).json({ error: 'HOST_ONLY' });
  }

  const status = generationStatuses.get(socialSessionId);
  if (status) return res.json(status);
  if (state.miniScriptCandidateFramework) {
    const completedAt = state.miniScriptCandidateGeneratedAt ?? Date.now();
    return res.json({
      stage: 'complete',
      progress: 100,
      startedAt: completedAt,
      updatedAt: completedAt,
      estimatedTotalMs: GENERATION_ESTIMATE_MS,
    } satisfies MiniScriptGenerationStatus);
  }
  return res.status(404).json({ error: 'GENERATION_NOT_STARTED' });
});

router.post('/generate', aiEndpointLimiter, async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = miniScriptGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn('[miniscript] generate rejected', { code: 'INVALID_BODY', userId });
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, playerCount, style, genres, lite, selectedLabel } = parsed.data;
  logger.info('[miniscript] generate requested', { socialSessionId, userId, style, playerCount });
  // Every early return below must log — a silent 4xx reads identically to a
  // never-delivered request when tailing server logs (2026-08-17 incident).
  const logReject = (code: string, extra?: Record<string, unknown>) =>
    logger.warn('[miniscript] generate rejected', { socialSessionId, userId, code, ...extra });
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) {
      logReject('SESSION_EXPIRED');
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    logReject('SESSION_NOT_FOUND');
    return res.status(404).json({ error: 'Social session not found' });
  }

  const session = hydrateMiniScriptState({ ...state });
  migrateLegacySocialIcebreakerPhases(session);
  ensureSessionEnabledPhases(session);

  if (userId !== session.hostUserId) {
    logReject('HOST_ONLY', { hostUserId: session.hostUserId });
    return res.status(403).json({ error: 'HOST_ONLY' });
  }

  if (session.currentPhase !== 'mini_script') {
    logReject('WRONG_PHASE', { currentPhase: session.currentPhase });
    return res.status(400).json({ error: 'WRONG_PHASE', message: '仅在「迷你剧本杀」环节可生成剧本' });
  }

  if (!session.enabledPhases?.includes('mini_script')) {
    logReject('FEATURE_DISABLED');
    return res.status(403).json({ error: 'FEATURE_DISABLED' });
  }

  if (session.playerCount < 4) {
    logReject('NOT_ENOUGH_PLAYERS', { sessionPlayerCount: session.playerCount });
    return res.status(400).json({ error: 'NOT_ENOUGH_PLAYERS', message: '至少需要 4 位玩家' });
  }

  if (playerCount !== session.playerCount) {
    logReject('PLAYER_COUNT_MISMATCH', { expected: session.playerCount, received: playerCount });
    return res.status(400).json({
      error: 'PLAYER_COUNT_MISMATCH',
      message: 'playerCount 必须与当前房间人数一致',
      expected: session.playerCount,
    });
  }

  /** Idempotent: avoid duplicate LLM cost and overwriting a host-approved framework. */
  if (session.miniScriptCandidateFramework?.style === style) {
    const generatedAt = session.miniScriptCandidateGeneratedAt
      ? new Date(session.miniScriptCandidateGeneratedAt).toISOString()
      : new Date().toISOString();
    return res.json({
      ...session.miniScriptCandidateFramework,
      meta: session.miniScriptCandidateFrameworkMeta ?? buildCachedAIMeta(generatedAt, null, MINISCRIPT_GENERATION_PROMPT_VERSION),
    });
  }

  try {
    let generation = generationInFlight.get(socialSessionId);
    const inFlightStatus = generationStatuses.get(socialSessionId);
    if (generation && inFlightStatus?.style && inFlightStatus.style !== style) {
      logReject('GENERATION_IN_PROGRESS', { inFlightStyle: inFlightStatus.style });
      return res.status(409).json({
        error: 'GENERATION_IN_PROGRESS',
        style: inFlightStatus.style,
        selectedLabel: inFlightStatus.selectedLabel,
      });
    }
    if (!generation) {
      setGenerationStatus(socialSessionId, 'queued', 5, { style, genres, selectedLabel });
      generation = (async () => {
        const roster = await listParticipants(socialSessionId);
        const { framework, aiResponseMeta } = await generateMiniScriptFrameworkWithMeta({
          playerCount: session.playerCount,
          style,
          genres,
          lite: lite ?? false,
          roster,
          selectedLabel,
          onProgress: (stage, progress) => setGenerationStatus(socialSessionId, stage, progress),
        });

        setGenerationStatus(socialSessionId, 'persisting', 92);
        const secrets = extractSecrets(framework);
        await setMiniScriptSecrets(socialSessionId, secrets);

        const publicFramework = stripFrameworkSecrets(framework);
        const candidateMeta = {
          ...aiResponseMeta,
          aigc: buildAIGCMeta({ fallbackUsed: aiResponseMeta.fallbackUsed, labelType: 'ai-generated' }),
        };
        session.miniScriptCandidateFramework = publicFramework;
        session.miniScriptCandidateGeneratedAt = Date.now();
        session.miniScriptCandidateGeneratedByUserId = userId;
        session.miniScriptCandidateFrameworkMeta = candidateMeta;
        await updateSession(socialSessionId, session);

        setGenerationStatus(socialSessionId, 'complete', 100);
        expireGenerationStatus(socialSessionId);

        return { framework: publicFramework, meta: candidateMeta };
      })();
      generationInFlight.set(socialSessionId, generation);
      void generation.finally(() => {
        if (generationInFlight.get(socialSessionId) === generation) {
          generationInFlight.delete(socialSessionId);
        }
      }).catch(() => undefined);
    }

    const { framework, meta } = await generation;
    logger.info('[miniscript] generate completed', { socialSessionId, userId, style });
    return res.json({ ...framework, meta });
  } catch (error) {
    setGenerationStatus(socialSessionId, 'failed', 100);
    expireGenerationStatus(socialSessionId);
    logger.error('[miniscript] generate failed', { error, socialSessionId });
    return res.status(500).json({ error: 'GENERATION_FAILED' });
  }
});

// ─── POST /assign-roles ──────────────────────────────────────────────────────

const assignRolesBodySchema = z.object({
  socialSessionId: z.string().min(1),
});

function ownRuntimeView(
  views: Record<string, MiniScriptPlayerRuntimeView> | undefined,
  userId: string,
): Record<string, MiniScriptPlayerRuntimeView> {
  const own = views?.[userId];
  return own ? { [userId]: own } : {};
}

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
    const idempotentBase = {
      playerRuntimeViews: ownRuntimeView(state.miniScriptPlayerRuntimeViews, userId),
      readyMap: state.miniScriptPlayerReady ?? {},
      currentAct: state.miniScriptCurrentAct ?? 0,
    };
    if (userId === state.hostUserId) {
      return res.json({ roleAssignments: state.miniScriptRoleAssignments, ...idempotentBase });
    }
    return res.json({ ok: true, myRoleSlot: state.miniScriptRoleAssignments[userId], ...idempotentBase });
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

  if (participants.length !== characterCount) {
    return res.status(400).json({
      error: 'PLAYER_COUNT_MISMATCH',
      message: `This script requires ${characterCount} players, but ${participants.length} are present.`,
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
  state.miniScriptRevealedSolution = undefined;
  state.miniScriptPlayerReady = { [userId]: true };
  seedSingleTestBotsMiniScriptReady(state);

  await updateSession(socialSessionId, state);

  logger.info('[miniscript] roles assigned', {
    socialSessionId,
    userId,
    action: 'assign-roles',
    playerCount: participants.length,
  });

  return res.json({
    roleAssignments,
    playerRuntimeViews: ownRuntimeView(playerRuntimeViews, userId),
    readyMap: state.miniScriptPlayerReady,
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
    // revealedInAct rides along so the client clue drawer can group by act
    // (contract AC-09); additive — pre-P2 entries simply lack the field.
    ...newlyRevealedClues.map((c) => ({ clueId: c.clueId, text: c.text, revealedInAct: c.revealedInAct })),
  ];
  // Compute deduction hints: chain steps where all fromClues are now revealed
  const revealedClueIdSet = new Set(state.miniScriptRevealedClueIds ?? []);
  const deductionHints = (secrets.deductionChain ?? [])
    .filter((step) => step.fromClues.every((cid) => revealedClueIdSet.has(cid)))
    .map((step) => ({ stepNumber: step.stepNumber, conclusion: step.conclusion }));
  state.miniScriptDeductionHints = deductionHints;

  state.miniScriptCurrentAct = targetAct;

  // The vote phase opens once the final act is on the table. The timestamp
  // drives the 90s quorum escape hatch in reveal-solution.
  const totalActs = state.miniScriptFramework.act_flow.length;
  if (targetAct >= totalActs && state.miniScriptVoteOpenedAt === undefined) {
    state.miniScriptVoteOpenedAt = Date.now();
  }

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

// ─── V2 P2 shared helpers ────────────────────────────────────────────────────

/** Round-1 (suspect) ballots — entries without voteRound are legacy round-1. */
function roundOneVotes(votes: MiniScriptVote[] | undefined): MiniScriptVote[] {
  return (votes ?? []).filter((v) => (v.voteRound ?? 1) === 1);
}

/** Round-2 (motive) ballots. */
function roundTwoVotes(votes: MiniScriptVote[] | undefined): MiniScriptVote[] {
  return (votes ?? []).filter((v) => v.voteRound === 2);
}

/** True when the motive round has been opened for this session. */
function isMotiveRoundOpen(state: SocialSessionState): boolean {
  return (
    (state.miniScriptVoteRound ?? 1) === 2 &&
    state.miniScriptMotiveVoteOpenedAt !== undefined
  );
}

/**
 * V2 P2: per-player two-step reveal results (contract AC-05).
 * - `round1Correct`: suspect ballot slot === culprit slot (solution.whoSlot,
 *   falling back to an exact roleLabel match). Absent when the culprit cannot
 *   be resolved to a slot.
 * - `round2Correct`: motiveChoice === correctMotiveIndex. Absent when the
 *   framework has no resolvable motive round OR the host revealed without
 *   ever opening round 2 (round-1-only semantics).
 */
function buildMiniScriptPlayerResults(
  state: SocialSessionState,
  secrets: {
    solution: { who: string; why: string; whoSlot?: number; motiveIndex?: number };
    correctMotiveIndex?: number | null;
  },
): MiniScriptPlayerResult[] {
  const framework = state.miniScriptFramework;
  const characters = framework?.characters ?? [];
  let culpritSlot = secrets.solution.whoSlot;
  if (culpritSlot === undefined && secrets.solution.who) {
    const idx = characters.findIndex((c) => c.roleLabel === secrets.solution.who);
    if (idx >= 0) culpritSlot = idx + 1;
  }
  const motiveOptions = framework?.motiveOptions ?? [];
  const correctMotiveIndex =
    secrets.correctMotiveIndex ??
    resolveCorrectMotiveIndex({
      motiveOptions,
      solutionWhy: secrets.solution.why,
      solutionMotiveIndex: secrets.solution.motiveIndex,
    });
  const round2Applicable =
    motiveOptions.length > 0 && correctMotiveIndex !== null && isMotiveRoundOpen(state);

  const assignments = state.miniScriptRoleAssignments ?? {};
  const votes = state.miniScriptVotes ?? [];
  return Object.keys(assignments).map((userId) => {
    const result: MiniScriptPlayerResult = { userId };
    if (culpritSlot !== undefined) {
      const r1 = votes.find((v) => v.userId === userId && (v.voteRound ?? 1) === 1);
      result.round1Correct = r1?.suspectRoleSlot === culpritSlot;
    }
    if (round2Applicable) {
      const r2 = votes.find((v) => v.userId === userId && v.voteRound === 2);
      result.round2Correct = r2?.motiveChoice === correctMotiveIndex;
    }
    return result;
  });
}

// ─── POST /present-evidence (V2 P2) ──────────────────────────────────────────

/** Per-player per-act presentation budget (contract AC-02c / PRD Q11). */
const PRESENT_EVIDENCE_BUDGET_PER_ACT = 2;

const presentEvidenceBodySchema = z.object({
  socialSessionId: z.string().min(1),
  evidenceId: z.string().min(1).max(32),
  /** 1-based role slot, consistent with suspectRoleSlot and the
   *  evidenceReactions lookup keys. */
  targetRoleSlot: z.number().int().min(1).max(6),
});

router.post('/present-evidence', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = presentEvidenceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn('[miniscript] present-evidence rejected', { code: 'INVALID_BODY', userId });
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, evidenceId, targetRoleSlot } = parsed.data;
  const logReject = (code: string, extra?: Record<string, unknown>) =>
    logger.warn('[miniscript] present-evidence rejected', { socialSessionId, userId, evidenceId, code, ...extra });
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) {
      logReject('SESSION_EXPIRED');
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    logReject('SESSION_NOT_FOUND');
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (state.currentPhase !== 'mini_script') {
    logReject('WRONG_PHASE', { currentPhase: state.currentPhase });
    return res.status(400).json({ error: 'WRONG_PHASE' });
  }

  // Flag snapshot taken at phase entry; legacy sessions (undefined) are off
  // and the route fails closed (contract AC-06).
  if (state.miniScriptV2Enabled !== true) {
    logReject('FEATURE_DISABLED');
    return res.status(403).json({ error: 'FEATURE_DISABLED' });
  }

  // Presenting is only legal during the act sub-stage. Once the vote opens
  // (final act revealed), the table is voting — no late reactions (AC-02b).
  if (state.miniScriptVoteOpenedAt !== undefined) {
    logReject('WRONG_SUB_PHASE');
    return res.status(400).json({ error: 'WRONG_SUB_PHASE' });
  }

  if (!state.miniScriptRoleAssignments || state.miniScriptRoleAssignments[userId] === undefined) {
    logReject('NO_ROLE_ASSIGNED');
    return res.status(400).json({ error: 'NO_ROLE_ASSIGNED' });
  }

  const framework = state.miniScriptFramework;
  if (!framework) {
    logReject('FRAMEWORK_NOT_GENERATED');
    return res.status(400).json({ error: 'FRAMEWORK_NOT_GENERATED' });
  }

  const characters = framework.characters ?? [];
  if (targetRoleSlot < 1 || targetRoleSlot > characters.length) {
    logReject('INVALID_TARGET_SLOT');
    return res.status(400).json({ error: 'INVALID_TARGET_SLOT' });
  }

  // Locate the evidence and its owning act. Ids are enumerable, so evidence
  // from a future act must be rejected explicitly (AC-02g, no spoilers).
  let owningActNo: number | undefined;
  for (const act of framework.act_flow ?? []) {
    if ((act.evidence ?? []).some((item) => item.id === evidenceId)) {
      owningActNo = act.actNumber;
      break;
    }
  }
  if (owningActNo === undefined) {
    logReject('INVALID_EVIDENCE');
    return res.status(400).json({ error: 'INVALID_EVIDENCE' });
  }
  const currentAct = state.miniScriptCurrentAct ?? 0;
  if (owningActNo > currentAct) {
    logReject('EVIDENCE_NOT_REVEALED', { owningActNo, currentAct });
    return res.status(400).json({ error: 'EVIDENCE_NOT_REVEALED' });
  }

  // Idempotent (AC-02d): a repeated (evidenceId, targetRoleSlot) presentation
  // returns the existing entry and does not count against the budget again.
  const presented = state.miniScriptPresentedEvidence ?? [];
  const existing = presented.find(
    (entry) => entry.evidenceId === evidenceId && entry.targetRoleSlot === targetRoleSlot,
  );
  if (existing) {
    return res.json({ ok: true, presented: existing, reactionText: existing.reactionText, duplicate: true });
  }

  // Budget: ≤2 presentations per player per act (AC-02c).
  const myActPresents = presented.filter(
    (entry) => entry.presentedBy === userId && entry.actNo === currentAct,
  ).length;
  if (myActPresents >= PRESENT_EVIDENCE_BUDGET_PER_ACT) {
    logReject('PRESENT_BUDGET_EXCEEDED', { currentAct });
    return res.status(400).json({ error: 'PRESENT_BUDGET_EXCEEDED' });
  }

  const secrets = await getMiniScriptSecrets(socialSessionId);
  if (!secrets) {
    logger.error('[miniscript] secrets missing for present-evidence', { socialSessionId });
    return res.status(500).json({ error: 'SECRETS_NOT_FOUND' });
  }
  const reactionText = secrets.evidenceReactions?.[evidenceId]?.[String(targetRoleSlot)];
  if (!reactionText) {
    logReject('REACTION_NOT_FOUND');
    return res.status(404).json({ error: 'REACTION_NOT_FOUND' });
  }

  const entry: MiniScriptPresentedEvidence = {
    evidenceId,
    targetRoleSlot,
    presentedBy: userId,
    actNo: currentAct,
    presentedAt: Date.now(),
    reactionText,
  };
  state.miniScriptPresentedEvidence = [...presented, entry];
  await updateSession(socialSessionId, state);

  logger.info('[miniscript] evidence presented', {
    socialSessionId,
    userId,
    evidenceId,
    targetRoleSlot,
    actNo: currentAct,
  });

  return res.json({ ok: true, presented: entry, reactionText });
});

// ─── POST /confirm-read (V2 P3) ──────────────────────────────────────────────
// Presenter-only release valve for the server-side reaction gate: once the
// presenter has read the reaction aloud, every member's next poll carries
// reactionText immediately (bypassing the 8s server-side delay). Idempotent.

const confirmReadBodySchema = z.object({
  socialSessionId: z.string().min(1),
  evidenceId: z.string().min(1).max(32),
  targetRoleSlot: z.number().int().min(1).max(6),
});

router.post('/confirm-read', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = confirmReadBodySchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn('[miniscript] confirm-read rejected', { code: 'INVALID_BODY', userId });
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, evidenceId, targetRoleSlot } = parsed.data;
  const logReject = (code: string, extra?: Record<string, unknown>) =>
    logger.warn('[miniscript] confirm-read rejected', { socialSessionId, userId, evidenceId, code, ...extra });
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) {
      logReject('SESSION_EXPIRED');
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    logReject('SESSION_NOT_FOUND');
    return res.status(404).json({ error: 'Social session not found' });
  }

  if (state.currentPhase !== 'mini_script') {
    logReject('WRONG_PHASE', { currentPhase: state.currentPhase });
    return res.status(400).json({ error: 'WRONG_PHASE' });
  }

  // Flag snapshot taken at phase entry; fail closed like present-evidence.
  if (state.miniScriptV2Enabled !== true) {
    logReject('FEATURE_DISABLED');
    return res.status(403).json({ error: 'FEATURE_DISABLED' });
  }

  const presented = state.miniScriptPresentedEvidence ?? [];
  const entryIdx = presented.findIndex(
    (entry) => entry.evidenceId === evidenceId && entry.targetRoleSlot === targetRoleSlot,
  );
  if (entryIdx < 0) {
    logReject('PRESENTED_ENTRY_NOT_FOUND');
    return res.status(404).json({ error: 'PRESENTED_ENTRY_NOT_FOUND' });
  }

  const entry = presented[entryIdx];
  if (entry.presentedBy !== userId) {
    logReject('PRESENTER_ONLY');
    return res.status(403).json({ error: 'PRESENTER_ONLY' });
  }

  // Idempotent: a repeat confirm returns the existing timestamp.
  if (entry.readConfirmedAt !== undefined) {
    return res.json({ ok: true, readConfirmedAt: entry.readConfirmedAt, alreadyConfirmed: true });
  }

  const readConfirmedAt = Date.now();
  const updated = [...presented];
  updated[entryIdx] = { ...entry, readConfirmedAt };
  state.miniScriptPresentedEvidence = updated;
  await updateSession(socialSessionId, state);

  // No spoilers in logs: evidenceId/slot only, never the reaction text.
  logger.info('[miniscript] evidence read confirmed', {
    socialSessionId,
    userId,
    evidenceId,
    targetRoleSlot,
  });

  return res.json({ ok: true, readConfirmedAt });
});

// ─── POST /open-motive-vote (V2 P2) ──────────────────────────────────────────

const openMotiveVoteBodySchema = z.object({
  socialSessionId: z.string().min(1),
});

router.post('/open-motive-vote', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = openMotiveVoteBodySchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn('[miniscript] open-motive-vote rejected', { code: 'INVALID_BODY', userId });
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId } = parsed.data;
  const logReject = (code: string, extra?: Record<string, unknown>) =>
    logger.warn('[miniscript] open-motive-vote rejected', { socialSessionId, userId, code, ...extra });
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) {
      logReject('SESSION_EXPIRED');
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    logReject('SESSION_NOT_FOUND');
    return res.status(404).json({ error: 'Social session not found' });
  }

  const guard = assertHostMiniScriptSession(state, userId);
  if (guard) {
    logReject(guard.error);
    return res.status(guard.status).json({ error: guard.error });
  }

  if (state.miniScriptV2Enabled !== true) {
    logReject('FEATURE_DISABLED');
    return res.status(403).json({ error: 'FEATURE_DISABLED' });
  }

  if (state.miniScriptSolutionRevealed) {
    logReject('SOLUTION_ALREADY_REVEALED');
    return res.status(409).json({ error: 'SOLUTION_ALREADY_REVEALED' });
  }

  const motiveProgressOf = (s: SocialSessionState) =>
    computeMiniScriptVoteProgress({
      votes: roundTwoVotes(s.miniScriptVotes),
      totalAssigned: Object.keys(s.miniScriptRoleAssignments ?? {}).length,
      voteOpenedAt: s.miniScriptMotiveVoteOpenedAt,
    });

  // Idempotent: already in round 2 → return current state (matches the
  // reveal-act / reveal-solution idempotency convention, contract AC-03).
  if (isMotiveRoundOpen(state)) {
    return res.json({
      ok: true,
      voteRound: 2,
      motiveVoteOpenedAt: state.miniScriptMotiveVoteOpenedAt,
      motiveOptions: state.miniScriptFramework?.motiveOptions ?? [],
      motiveVoteProgress: motiveProgressOf(state),
    });
  }

  // Round 1 must be open before round 2 can start (it opens with the final act).
  if (state.miniScriptVoteOpenedAt === undefined) {
    logReject('WRONG_VOTE_ROUND');
    return res.status(400).json({ error: 'WRONG_VOTE_ROUND' });
  }

  const motiveOptions = state.miniScriptFramework?.motiveOptions;
  const secrets = await getMiniScriptSecrets(socialSessionId);
  if (!secrets) {
    logger.error('[miniscript] secrets missing for open-motive-vote', { socialSessionId });
    return res.status(500).json({ error: 'SECRETS_NOT_FOUND' });
  }
  const correctMotiveIndex =
    secrets.correctMotiveIndex ??
    resolveCorrectMotiveIndex({
      motiveOptions,
      solutionWhy: secrets.solution?.why,
      solutionMotiveIndex: secrets.solution?.motiveIndex,
    });
  if (!motiveOptions || motiveOptions.length === 0 || correctMotiveIndex === null) {
    logReject('NO_MOTIVE_OPTIONS');
    return res.status(400).json({ error: 'NO_MOTIVE_OPTIONS' });
  }

  state.miniScriptVoteRound = 2;
  state.miniScriptMotiveVoteOpenedAt = Date.now();

  // Bots cast their motive ballots immediately so a single-test chain can
  // terminate without human input (contract AC-07).
  await runBotSimulationSafely(socialSessionId, state, 'mini-script-open-motive-vote');

  await updateSession(socialSessionId, state);

  logger.info('[miniscript] motive vote opened', {
    socialSessionId,
    userId,
    action: 'open-motive-vote',
  });

  return res.json({
    ok: true,
    voteRound: 2,
    motiveVoteOpenedAt: state.miniScriptMotiveVoteOpenedAt,
    motiveOptions,
    motiveVoteProgress: motiveProgressOf(state),
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
      const safetyResult = await validateContentSafeAsync(field, 'vote', { userId });
      if (!safetyResult.safe && safetyResult.violation) {
        await recordViolation(userId, safetyResult.violation.type, safetyResult.violation.severity);
        return res.status(400).json(contentViolationResponse(safetyResult.violation).body);
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

  // Flag snapshot off → silently degrade: voteRound=2 / motiveChoice are
  // ignored and the ballot is treated as round 1 (contract AC-06).
  const v2Enabled = state.miniScriptV2Enabled === true;
  const requestedRound: 1 | 2 = v2Enabled && vote.voteRound === 2 ? 2 : 1;

  // ── Round 2 (motive) ballot ──
  if (requestedRound === 2) {
    if (!isMotiveRoundOpen(state)) {
      logger.warn('[miniscript] vote rejected', { socialSessionId, userId, code: 'WRONG_VOTE_ROUND' });
      return res.status(400).json({ error: 'WRONG_VOTE_ROUND' });
    }
    const motiveOptions = state.miniScriptFramework?.motiveOptions ?? [];
    if (
      typeof vote.motiveChoice !== 'number' ||
      vote.motiveChoice < 0 ||
      vote.motiveChoice >= motiveOptions.length
    ) {
      logger.warn('[miniscript] vote rejected', { socialSessionId, userId, code: 'INVALID_MOTIVE_CHOICE' });
      return res.status(400).json({
        error: 'INVALID_MOTIVE_CHOICE',
        message: `motiveChoice 必须在 0 到 ${Math.max(0, motiveOptions.length - 1)} 之间`,
      });
    }
    const votes = [...(state.miniScriptVotes ?? [])];
    const existingIdx = votes.findIndex((v) => v.userId === userId && v.voteRound === 2);
    const voteEntry: MiniScriptVote = {
      userId,
      voteRound: 2,
      motiveChoice: vote.motiveChoice,
      votedAt: Date.now(),
    };
    if (existingIdx >= 0) {
      votes[existingIdx] = voteEntry;
    } else {
      votes.push(voteEntry);
    }
    state.miniScriptVotes = votes;
    await updateSession(socialSessionId, state);

    const motiveVoteProgress = computeMiniScriptVoteProgress({
      votes: roundTwoVotes(votes),
      totalAssigned: Object.keys(state.miniScriptRoleAssignments).length,
      voteOpenedAt: state.miniScriptMotiveVoteOpenedAt,
    });
    return res.json({ ok: true, vote: voteEntry, voteProgress: motiveVoteProgress });
  }

  // ── Round 1 (suspect) ballot — behavior unchanged from the single-step vote ──

  // Resolve the structured suspect slot. New clients send suspectRoleSlot
  // (1-based role index); legacy clients send free-text `who`, which we
  // best-effort map via exact roleLabel match. At least one must be present.
  const characters = state.miniScriptFramework?.characters ?? [];
  let suspectRoleSlot: number | undefined;
  if (typeof vote.suspectRoleSlot === 'number') {
    if (vote.suspectRoleSlot < 1 || vote.suspectRoleSlot > characters.length) {
      return res.status(400).json({
        error: 'INVALID_SUSPECT_SLOT',
        message: `suspectRoleSlot 必须在 1 到 ${characters.length} 之间`,
        roleCount: characters.length,
      });
    }
    suspectRoleSlot = vote.suspectRoleSlot;
  } else if (vote.who) {
    const legacyIdx = characters.findIndex((c) => c.roleLabel === vote.who);
    suspectRoleSlot = legacyIdx >= 0 ? legacyIdx + 1 : undefined;
  } else {
    return res.status(400).json({
      error: 'INVALID_BODY',
      message: 'vote 需要 suspectRoleSlot（角色序号）',
    });
  }

  const votes = [...(state.miniScriptVotes ?? [])];
  const existingIdx = votes.findIndex((v) => v.userId === userId && (v.voteRound ?? 1) === 1);
  const voteEntry: MiniScriptVote = {
    userId,
    voteRound: 1,
    suspectRoleSlot,
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

  const voteProgress = computeMiniScriptVoteProgress({
    votes: roundOneVotes(votes),
    totalAssigned: Object.keys(state.miniScriptRoleAssignments).length,
    voteOpenedAt: state.miniScriptVoteOpenedAt,
  });

  return res.json({ ok: true, vote: voteEntry, voteProgress });
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

  if (!state.miniScriptSolutionRevealed) {
    if (!state.miniScriptFramework) {
      return res.status(400).json({ error: 'FRAMEWORK_NOT_GENERATED' });
    }

    const assignments = state.miniScriptRoleAssignments;
    if (!assignments || Object.keys(assignments).length !== state.playerCount) {
      return res.status(400).json({ error: 'ROLES_NOT_ASSIGNED' });
    }

    const totalActs = state.miniScriptFramework.act_flow.length;
    if ((state.miniScriptCurrentAct ?? 0) < totalActs) {
      return res.status(400).json({ error: 'NOT_ALL_ACTS_REVEALED' });
    }

    const totalAssigned = Object.keys(assignments).length;
    const voteProgress = computeMiniScriptVoteProgress({
      votes: roundOneVotes(state.miniScriptVotes),
      totalAssigned,
      voteOpenedAt: state.miniScriptVoteOpenedAt,
    });
    if (!voteProgress.canReveal) {
      return res.status(400).json({
        error: 'WAITING_FOR_VOTES',
        remaining: Math.max(0, voteProgress.quorum - voteProgress.votedCount),
        voteProgress,
      });
    }

    // V2 P2: when the motive round was opened, the reveal is gated on its own
    // quorum / 90s escape hatch (REL-03, based on miniScriptMotiveVoteOpenedAt).
    if (isMotiveRoundOpen(state)) {
      const motiveProgress = computeMiniScriptVoteProgress({
        votes: roundTwoVotes(state.miniScriptVotes),
        totalAssigned,
        voteOpenedAt: state.miniScriptMotiveVoteOpenedAt,
      });
      if (!motiveProgress.canReveal) {
        return res.status(400).json({
          error: 'WAITING_FOR_MOTIVE_VOTES',
          remaining: Math.max(0, motiveProgress.quorum - motiveProgress.votedCount),
          voteProgress: motiveProgress,
        });
      }
    }
  }

  // Idempotent: return cached solution if already revealed
  const secrets = await getMiniScriptSecrets(socialSessionId);
  if (!secrets) {
    return res.status(500).json({ error: 'SECRETS_NOT_FOUND' });
  }

  if (!state.miniScriptSolutionRevealed) {
    state.miniScriptSolutionRevealed = true;
    state.miniScriptRevealedSolution = secrets.solution;
    state.miniScriptRevealedResolutionSummary = secrets.resolutionSummary;
    // V2 P2: per-player two-step results, persisted so rejoining clients see
    // the same outcome as this response (REL-02).
    state.miniScriptRevealedPlayerResults = buildMiniScriptPlayerResults(state, secrets);
    // V2 P3: in single-test bot sessions the host-side ceremony beats are
    // walked by the bot simulation so the automated chain can terminate
    // without a human tapping through (contract AC-05/bot chain).
    await runBotSimulationSafely(socialSessionId, state, 'mini-script-reveal-solution');
    await updateSession(socialSessionId, state);

    logger.info('[miniscript] solution revealed', {
      socialSessionId,
      userId,
      action: 'reveal-solution',
    });
  }

  const totalAssigned = Object.keys(state.miniScriptRoleAssignments ?? {}).length;
  const round2Applicable =
    state.miniScriptRevealedPlayerResults?.some((r) => r.round2Correct !== undefined) === true;
  const correctMotiveIndex =
    secrets.correctMotiveIndex ??
    resolveCorrectMotiveIndex({
      motiveOptions: state.miniScriptFramework?.motiveOptions,
      solutionWhy: secrets.solution?.why,
      solutionMotiveIndex: secrets.solution?.motiveIndex,
    });

  return res.json({
    solution: secrets.solution,
    revealed: true,
    voteProgress: computeMiniScriptVoteProgress({
      votes: roundOneVotes(state.miniScriptVotes),
      totalAssigned,
      voteOpenedAt: state.miniScriptVoteOpenedAt,
    }),
    // Round-2 fields are only present when the motive round actually applied
    // (framework has motiveOptions AND round 2 was opened). Otherwise the
    // response keeps the legacy round-1-only shape (contract AC-05).
    ...(round2Applicable
      ? {
          motiveVoteProgress: computeMiniScriptVoteProgress({
            votes: roundTwoVotes(state.miniScriptVotes),
            totalAssigned,
            voteOpenedAt: state.miniScriptMotiveVoteOpenedAt,
          }),
          correctMotive:
            correctMotiveIndex !== null
              ? state.miniScriptFramework?.motiveOptions?.[correctMotiveIndex] ?? secrets.solution.why
              : secrets.solution.why,
        }
      : {}),
    playerResults: state.miniScriptRevealedPlayerResults,
  });
});

// ─── POST /advance-ceremony (V2 P3, Q14) ─────────────────────────────────────
// Host-paced truth-ceremony beats: 0 = not started (tally/motive stages are
// free), 1 = culprit (当事人) revealed, 2 = 本桌名侦探 honor revealed. The
// client renders culprit/honor content only when the persisted beat covers
// it, so all devices stay in lockstep with the host's pacing.

const advanceCeremonyBodySchema = z.object({
  socialSessionId: z.string().min(1),
});

router.post('/advance-ceremony', async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = advanceCeremonyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn('[miniscript] advance-ceremony rejected', { code: 'INVALID_BODY', userId });
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId } = parsed.data;
  const logReject = (code: string, extra?: Record<string, unknown>) =>
    logger.warn('[miniscript] advance-ceremony rejected', { socialSessionId, userId, code, ...extra });
  const { state, expired } = await getSessionWithExpiry(socialSessionId);

  if (!state) {
    if (expired) {
      logReject('SESSION_EXPIRED');
      return res.status(410).json({ error: 'SESSION_EXPIRED', expired: true });
    }
    logReject('SESSION_NOT_FOUND');
    return res.status(404).json({ error: 'Social session not found' });
  }

  const guard = assertHostMiniScriptSession(state, userId);
  if (guard) {
    logReject(guard.error);
    return res.status(guard.status).json({ error: guard.error });
  }

  if (state.miniScriptV2Enabled !== true) {
    logReject('FEATURE_DISABLED');
    return res.status(403).json({ error: 'FEATURE_DISABLED' });
  }

  if (state.miniScriptSolutionRevealed !== true) {
    logReject('SOLUTION_NOT_REVEALED');
    return res.status(400).json({ error: 'SOLUTION_NOT_REVEALED' });
  }

  const currentBeat = state.miniScriptCeremonyBeat ?? 0;
  // Idempotent-ish: advancing past the max returns the current beat unchanged.
  if (currentBeat >= MINISCRIPT_CEREMONY_MAX_BEAT) {
    return res.json({ ok: true, ceremonyBeat: currentBeat, advanced: false });
  }

  state.miniScriptCeremonyBeat = currentBeat + 1;
  await updateSession(socialSessionId, state);

  logger.info('[miniscript] ceremony beat advanced', {
    socialSessionId,
    userId,
    ceremonyBeat: state.miniScriptCeremonyBeat,
  });

  return res.json({ ok: true, ceremonyBeat: state.miniScriptCeremonyBeat, advanced: true });
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
    // Transition into mini_script via the unified pipeline (dwell metrics,
    // completion bookkeeping, cleanup).
    await transitionPhase({
      state,
      socialSessionId,
      trigger: 'host_tap',
      targetPhase: 'mini_script',
      skipBonusGate: true,
    });
    logger.info('[miniscript] bonus gate accepted', { socialSessionId, hostUserId: userId });
    return res.json({ state: await buildClientState(state, userId) });
  }

  // Decline: skip mini_script and go to recap via the unified pipeline
  // (recap snapshot included).
  state.bonusGateDeclined = true;
  await transitionPhase({
    state,
    socialSessionId,
    trigger: 'host_tap',
    targetPhase: 'recap',
    skipBonusGate: true,
  });
  logger.info('[miniscript] bonus gate declined', { socialSessionId, hostUserId: userId });
  return res.json({ state: await buildClientState(state, userId) });
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
