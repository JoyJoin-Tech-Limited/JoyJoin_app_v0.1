import { randomInt } from 'node:crypto';

import {
  equipmentRepository,
  EquipmentRepositoryError,
  type EquipmentRepository,
} from '../repositories/equipmentRepo';
import type { EquipmentOutfitInput } from '@shared/schema/equipment';

const RANDOM_BUCKET_COUNT = 2 ** 32;

export interface EquipmentRewardServiceDependencies {
  repository: EquipmentRepository;
  randomUnit: () => number;
}

function secureRandomUnit(): number {
  return randomInt(0, RANDOM_BUCKET_COUNT) / RANDOM_BUCKET_COUNT;
}

export function createEquipmentRewardService(
  dependencies: Partial<EquipmentRewardServiceDependencies> = {},
) {
  const repository = dependencies.repository ?? equipmentRepository;
  const randomUnit = dependencies.randomUnit ?? secureRandomUnit;

  return {
    async getMe(userId: string, options: { rewardsEnabled: boolean }) {
      // Initial clothes are identity setup rather than a random reward. They
      // remain available when the reward economy kill switch is disabled.
      await repository.ensureInitialEquipment(userId);
      if (options.rewardsEnabled) {
        await repository.reconcileEquipmentEntitlements(userId);
      }
      const snapshot = await repository.getEquipmentMe(userId);
      return { ...snapshot, rewardsEnabled: options.rewardsEnabled };
    },

    saveOutfit(userId: string, input: EquipmentOutfitInput) {
      return repository.saveEquipmentOutfit(userId, input);
    },

    draw(userId: string, entitlementId: string) {
      return repository.drawEquipmentEntitlement({
        userId,
        entitlementId,
        randomUnit: randomUnit(),
      });
    },

    getPool(userId: string, poolId: string) {
      return repository.getEquipmentPool(poolId, userId);
    },

    getShop(userId: string) {
      return repository.getEquipmentShop(userId);
    },

    redeemShopItem(options: {
      userId: string;
      itemId: string;
      idempotencyKey: string;
    }) {
      return repository.redeemEquipmentShopItem(options);
    },
  };
}

export const equipmentRewardService = createEquipmentRewardService();

export function isEquipmentRepositoryError(
  error: unknown,
): error is EquipmentRepositoryError {
  return error instanceof EquipmentRepositoryError;
}
