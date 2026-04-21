import { Router } from 'express';
import { migrateLegacySocialIcebreakerPhases, type SocialSessionState } from '@shared/socialIcebreaker';
import { miniScriptGenerateRequestSchema } from '@shared/miniscriptStoryFramework';
import { getSessionWithExpiry, updateSession } from '../../lib/socialIcebreakerStore';
import { requireAuthenticatedUserId } from '../../lib/requestAuth';
import { generateMiniScriptFrameworkWithMeta } from '../../lib/miniscriptAgent';
import { MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION } from '../../socialIcebreakerAIService';
import { buildCachedAIMeta } from '@shared/types/aiMeta';
import { ensureSessionEnabledPhases } from '../../socialIcebreakerPhaseConfig';
import { logger } from '../../lib/logger';
import { aiEndpointLimiter } from '../../rateLimiter';

const router = Router();

function hydrateMiniScriptState(state: SocialSessionState): SocialSessionState {
  return { ...state };
}

router.post('/generate', aiEndpointLimiter, async (req: any, res) => {
  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsed = miniScriptGenerateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
  }

  const { socialSessionId, playerCount, style, genres } = parsed.data;
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

  /** Idempotent: avoid duplicate LLM cost and overwriting a host-approved framework (Slice B / plan). */
  if (session.miniScriptFramework) {
    const generatedAt = session.miniScriptFrameworkGeneratedAt
      ? new Date(session.miniScriptFrameworkGeneratedAt).toISOString()
      : new Date().toISOString();
    return res.json({
      ...session.miniScriptFramework,
      meta: buildCachedAIMeta(generatedAt, null, MINI_SCRIPT_FRAMEWORK_PROMPT_VERSION),
    });
  }

  try {
    const { framework, aiResponseMeta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: session.playerCount,
      style,
      genres,
    });

    session.miniScriptFramework = framework;
    session.miniScriptFrameworkGeneratedAt = Date.now();
    session.miniScriptFrameworkGeneratedByUserId = userId;

    await updateSession(socialSessionId, session);

    return res.json({ ...framework, meta: aiResponseMeta });
  } catch (error) {
    logger.error('[miniscript] generate failed', { error, socialSessionId });
    return res.status(500).json({ error: 'GENERATION_FAILED' });
  }
});

export default router;
