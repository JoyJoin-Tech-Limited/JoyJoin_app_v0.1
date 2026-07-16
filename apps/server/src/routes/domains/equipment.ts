import type { Express, Request, Response } from 'express';
import { z } from 'zod';

import { equipmentOutfitInputSchema } from '@shared/schema/equipment';
import { getFeatureFlag } from '../../lib/featureFlags';
import { logger } from '../../lib/logger';
import { requireAuthenticatedUserId } from '../../lib/requestAuth';
import {
  equipmentRewardService,
  isEquipmentRepositoryError,
} from '../../services/equipmentRewardService';

const idParamSchema = z.string().uuid();
const shopRedeemHeaderSchema = z.string().trim().min(8).max(128);

async function gatePixelAvatar(res: Response): Promise<boolean> {
  if (await getFeatureFlag('profilePixelAvatarEnabled', false)) return true;
  res.status(503).json({ error: 'PROFILE_PIXEL_AVATAR_DISABLED' });
  return false;
}

async function gateEquipmentRewards(res: Response): Promise<boolean> {
  if (await getFeatureFlag('equipmentRewardsEnabled', false)) return true;
  res.status(503).json({ error: 'EQUIPMENT_REWARDS_DISABLED' });
  return false;
}

function sendEquipmentError(req: Request, res: Response, error: unknown): Response {
  if (isEquipmentRepositoryError(error)) {
    return res.status(error.status).json({ error: error.code });
  }

  logger.error('[Equipment] request failed', {
    request_id: req.requestId,
    path: req.path,
    error: error instanceof Error ? error.message : String(error),
  });
  return res.status(500).json({ error: 'EQUIPMENT_REQUEST_FAILED' });
}

function readAuthenticatedUserId(req: Request, res: Response): string | null {
  return requireAuthenticatedUserId(req, res);
}

/**
 * Equipment and wardrobe API. Every operation is scoped to the authenticated
 * user; clients cannot submit a user id. Economy mutations have an additional
 * server-owned kill switch independent from the avatar presentation switch.
 */
export function registerEquipmentRoutes(app: Express): void {
  app.get('/api/equipment/me', async (req: Request, res: Response) => {
    const userId = readAuthenticatedUserId(req, res);
    if (!userId || !(await gatePixelAvatar(res))) return;

    try {
      const rewardsEnabled = await getFeatureFlag('equipmentRewardsEnabled', false);
      return res.json(await equipmentRewardService.getMe(userId, { rewardsEnabled }));
    } catch (error) {
      return sendEquipmentError(req, res, error);
    }
  });

  app.put('/api/equipment/me/outfit', async (req: Request, res: Response) => {
    const userId = readAuthenticatedUserId(req, res);
    if (!userId || !(await gatePixelAvatar(res))) return;

    const input = equipmentOutfitInputSchema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({
        error: 'EQUIPMENT_OUTFIT_INVALID',
        details: input.error.flatten(),
      });
    }

    try {
      const outfit = await equipmentRewardService.saveOutfit(userId, input.data);
      return res.json({ saved: true, outfit });
    } catch (error) {
      return sendEquipmentError(req, res, error);
    }
  });

  app.get('/api/equipment/pools/:poolId', async (req: Request, res: Response) => {
    const userId = readAuthenticatedUserId(req, res);
    if (!userId || !(await gatePixelAvatar(res))) return;

    const poolId = idParamSchema.safeParse(req.params.poolId);
    if (!poolId.success) return res.status(400).json({ error: 'EQUIPMENT_POOL_ID_INVALID' });

    try {
      return res.json(await equipmentRewardService.getPool(userId, poolId.data));
    } catch (error) {
      return sendEquipmentError(req, res, error);
    }
  });

  app.post(
    '/api/equipment/entitlements/:entitlementId/draw',
    async (req: Request, res: Response) => {
      const userId = readAuthenticatedUserId(req, res);
      if (!userId
        || !(await gatePixelAvatar(res))
        || !(await gateEquipmentRewards(res))) return;

      const entitlementId = idParamSchema.safeParse(req.params.entitlementId);
      if (!entitlementId.success) {
        return res.status(400).json({ error: 'EQUIPMENT_ENTITLEMENT_ID_INVALID' });
      }

      try {
        return res.json(await equipmentRewardService.draw(userId, entitlementId.data));
      } catch (error) {
        return sendEquipmentError(req, res, error);
      }
    },
  );

  app.get('/api/equipment/shop', async (req: Request, res: Response) => {
    const userId = readAuthenticatedUserId(req, res);
    if (!userId
      || !(await gatePixelAvatar(res))
      || !(await gateEquipmentRewards(res))) return;

    try {
      return res.json(await equipmentRewardService.getShop(userId));
    } catch (error) {
      return sendEquipmentError(req, res, error);
    }
  });

  app.post('/api/equipment/shop/items/:itemId/redeem', async (req: Request, res: Response) => {
    const userId = readAuthenticatedUserId(req, res);
    if (!userId
      || !(await gatePixelAvatar(res))
      || !(await gateEquipmentRewards(res))) return;

    const itemId = idParamSchema.safeParse(req.params.itemId);
    if (!itemId.success) return res.status(400).json({ error: 'EQUIPMENT_ITEM_ID_INVALID' });

    const idempotencyKey = shopRedeemHeaderSchema.safeParse(req.get('Idempotency-Key'));
    if (!idempotencyKey.success) {
      return res.status(400).json({ error: 'IDEMPOTENCY_KEY_REQUIRED' });
    }

    try {
      return res.json(await equipmentRewardService.redeemShopItem({
        userId,
        itemId: itemId.data,
        idempotencyKey: idempotencyKey.data,
      }));
    } catch (error) {
      return sendEquipmentError(req, res, error);
    }
  });
}
