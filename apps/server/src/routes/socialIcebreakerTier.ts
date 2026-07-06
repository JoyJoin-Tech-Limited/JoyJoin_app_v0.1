import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { type TierMachineId, resolveTierDisplay } from '@shared/socialIcebreakerTierManifest';
import { requireAuthenticatedUserId } from '../lib/requestAuth';
import { listParticipants } from '../lib/socialIcebreakerStore';
import {
  resolveSession,
  buildClientState,
} from './socialIcebreakerHelpers';
import { enqueueRunPlanPreGeneration } from '../jobs/preGenerationQueue';
import { getFeatureFlag } from '../lib/featureFlags';
import { resetSocialIcebreakerTier } from '../services/socialIcebreakerTierReset';
import { logger } from '../lib/logger';

const router = Router();

const socialSessionIdParamSchema = z.object({
  socialSessionId: z.string().min(1),
});

const setTierBodySchema = z.object({
  tier: z.string().min(1),
  vibe: z.enum(['chat', 'balanced', 'game']).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/social-icebreaker/:socialSessionId/set-tier
// ---------------------------------------------------------------------------
router.post('/:socialSessionId/set-tier', async (req: Request, res: Response) => {
  const paramsParse = socialSessionIdParamSchema.safeParse(req.params);
  if (!paramsParse.success) {
    return res.status(400).json({ error: 'Invalid social session id' });
  }
  const { socialSessionId } = paramsParse.data;

  const userId = requireAuthenticatedUserId(req, res);
  if (!userId) return;

  const parsedBody = setTierBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { tier, vibe } = parsedBody.data;

  const state = await resolveSession(socialSessionId, res);
  if (!state) return;

  const VALID_TIERS: TierMachineId[] = ['breeze', 'glow', 'blaze', 'custom'];
  if (!tier || !VALID_TIERS.includes(tier as TierMachineId)) {
    return res.status(400).json({ error: 'Invalid tier. Must be one of: breeze, glow, blaze, custom' });
  }

  const newTier = tier as TierMachineId;
  const customModeEnabled = await getFeatureFlag('socialIcebreakerCustomModeEnabled', true);

  const resetResult = await resetSocialIcebreakerTier({
    state,
    newTier,
    newVibe: vibe,
    userId,
    resetSource: '/set-tier',
    customModeEnabled,
  });

  if (!resetResult.reset) {
    switch (resetResult.reason) {
      case 'not_host':
        return res.status(403).json({ error: 'Only the host can set the tier' });
      case 'not_warmup':
        return res.status(400).json({
          error: 'Tier can only be changed during warmup (before advancing past the first phase)',
        });
      case 'custom_disabled':
        return res.status(400).json({ error: 'Custom mode is not enabled' });
      case 'same_tier':
      default:
        return res.json({
          socialSessionId,
          eventTier: state.eventTier,
          tierDisplayName: resolveTierDisplay(state.eventTier ?? 'breeze', { glowVariant: 'default' }),
          runPlan: state.runPlan,
          state: await buildClientState(state, userId),
        });
    }
  }

  if (newTier === 'custom') {
    return res.json({
      socialSessionId,
      eventTier: newTier,
      tierDisplayName: resolveTierDisplay(newTier, { glowVariant: 'default' }),
      runPlan: undefined,
      state: await buildClientState(state, userId),
    });
  }

  // Re-enqueue pre-generation for the new preset run plan (best-effort)
  const runPlan = state.runPlan!;
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

  return res.json({
    socialSessionId,
    eventTier: newTier,
    tierDisplayName: resolveTierDisplay(newTier, { glowVariant: 'default' }),
    runPlan,
    state: await buildClientState(state, userId),
  });
});

export default router;
