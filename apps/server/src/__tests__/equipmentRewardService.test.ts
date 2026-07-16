import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db', () => ({ db: {} }));

import {
  DUPLICATE_FRAGMENT_REWARDS,
  EQUIPMENT_PITY_TARGET,
  EQUIPMENT_SHOP_PRICES,
  planEquipmentOutfitRepair,
  planEquipmentDraw,
  resolveEquipmentArchetypeId,
  type DrawCandidate,
  type EquipmentRepository,
} from '../repositories/equipmentRepo';
import { createEquipmentRewardService } from '../services/equipmentRewardService';

describe('equipment archetype reconciliation', () => {
  const starterItemIds = new Map([
    ['top', 'owl-starter-top'],
    ['bottom', 'owl-starter-bottom'],
    ['shoes', 'owl-starter-shoes'],
    ['accessory', 'owl-starter-accessory'],
  ] as const);

  it('prefers the V4 primary archetype over a stale legacy archetype', () => {
    expect(resolveEquipmentArchetypeId({
      primaryArchetype: 'owl',
      archetype: 'cat',
    })).toBe('owl');
    expect(resolveEquipmentArchetypeId({
      primaryArchetype: null,
      archetype: 'cat',
    })).toBe('cat');
  });

  it('replaces an old-archetype outfit with current starters without removing inventory', () => {
    const equippedItems = new Map([
      ['cat-starter-top', {
        id: 'cat-starter-top',
        slot: 'top' as const,
        isActive: true,
        compatibleArchetypes: ['cat'],
      }],
      ['universal-bottom', {
        id: 'universal-bottom',
        slot: 'bottom' as const,
        isActive: true,
        compatibleArchetypes: null,
      }],
      ['inactive-accessory', {
        id: 'inactive-accessory',
        slot: 'accessory' as const,
        isActive: false,
        compatibleArchetypes: ['owl'],
      }],
    ]);

    const result = planEquipmentOutfitRepair({
      archetypeId: 'owl',
      currentOutfit: {
        topItemId: 'cat-starter-top',
        bottomItemId: 'universal-bottom',
        shoesItemId: null,
        accessoryItemId: 'inactive-accessory',
      },
      equippedItems,
      starterItemIds,
    });

    expect(result).toEqual({
      changed: true,
      outfit: {
        topItemId: 'owl-starter-top',
        bottomItemId: 'universal-bottom',
        shoesItemId: null,
        accessoryItemId: 'owl-starter-accessory',
      },
    });
    // Reconciliation changes only the outfit selection. Previously acquired
    // items stay in the permanent inventory for a future compatible persona.
    expect(equippedItems.has('cat-starter-top')).toBe(true);
    expect(equippedItems.has('inactive-accessory')).toBe(true);
  });

  it('keeps current-archetype starters usable and makes no redundant repair', () => {
    const equippedItems = new Map([
      ['owl-starter-top', {
        id: 'owl-starter-top',
        slot: 'top' as const,
        isActive: true,
        compatibleArchetypes: ['owl'],
      }],
    ]);
    const currentOutfit = {
      topItemId: 'owl-starter-top',
      bottomItemId: null,
      shoesItemId: null,
      accessoryItemId: null,
    };

    expect(planEquipmentOutfitRepair({
      archetypeId: 'owl',
      currentOutfit,
      equippedItems,
      starterItemIds,
    })).toEqual({ changed: false, outfit: currentOutfit });
  });
});

function candidate(
  id: string,
  rarity: 'common' | 'rare' = 'common',
  weight = 1,
): DrawCandidate {
  return {
    id,
    slug: `item-${id}`,
    name: `Item ${id}`,
    description: null,
    slot: 'top',
    rarity,
    assetKey: `equipment/${id}`,
    compatibleArchetypes: null,
    weight,
  };
}

describe('equipment draw rules', () => {
  it('resets the global pity counter when a new item is drawn', () => {
    const item = candidate('new');
    const result = planEquipmentDraw({
      candidates: [item],
      ownedItemIds: new Set(),
      pityMisses: 2,
      randomUnit: 0,
    });

    expect(result).toMatchObject({
      item,
      resultKind: 'new',
      fragmentsAwarded: 0,
      pityAfter: 0,
      guaranteed: false,
      poolCompleteBefore: false,
    });
  });

  it('guarantees an unowned item on the fourth draw across pools', () => {
    const owned = candidate('owned', 'common', 10_000);
    const unowned = candidate('unowned', 'rare', 1);
    const result = planEquipmentDraw({
      candidates: [owned, unowned],
      ownedItemIds: new Set([owned.id]),
      pityMisses: EQUIPMENT_PITY_TARGET - 1,
      randomUnit: 0,
    });

    expect(result.item.id).toBe(unowned.id);
    expect(result.resultKind).toBe('new');
    expect(result.guaranteed).toBe(true);
    expect(result.pityAfter).toBe(0);
  });

  it('freezes pity when the current restaurant pool is fully collected', () => {
    const item = candidate('owned');
    const result = planEquipmentDraw({
      candidates: [item],
      ownedItemIds: new Set([item.id]),
      pityMisses: 2,
      randomUnit: 0.5,
    });

    expect(result).toMatchObject({
      resultKind: 'duplicate',
      fragmentsAwarded: DUPLICATE_FRAGMENT_REWARDS.common,
      pityAfter: 2,
      guaranteed: false,
      poolCompleteBefore: true,
    });
  });

  it('converts rare duplicates to 30 shared fragments', () => {
    const item = candidate('rare-owned', 'rare');
    const result = planEquipmentDraw({
      candidates: [item],
      ownedItemIds: new Set([item.id]),
      pityMisses: 0,
      randomUnit: 0,
    });

    expect(result.fragmentsAwarded).toBe(30);
    expect(result.fragmentsAwarded).toBe(DUPLICATE_FRAGMENT_REWARDS.rare);
  });

  it('keeps the approved fragment shop prices server-owned', () => {
    expect(EQUIPMENT_SHOP_PRICES).toEqual({ common: 40, rare: 120 });
  });
});

describe('equipment reward service boundaries', () => {
  const repository = {
    ensureInitialEquipment: vi.fn(),
    reconcileEquipmentEntitlements: vi.fn(),
    getEquipmentMe: vi.fn(),
    saveEquipmentOutfit: vi.fn(),
    drawEquipmentEntitlement: vi.fn(),
    getEquipmentPool: vi.fn(),
    getEquipmentShop: vi.fn(),
    redeemEquipmentShopItem: vi.fn(),
  } as unknown as EquipmentRepository;

  const snapshot = {
    archetypeId: 'owl',
    outfit: {
      topItemId: null,
      bottomItemId: null,
      shoesItemId: null,
      accessoryItemId: null,
      version: 1,
    },
    inventory: [],
    recentItems: [],
    wallet: { fragmentBalance: 0, pityMisses: 0, pityTarget: 4 as const },
    pendingEntitlements: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(repository.ensureInitialEquipment).mockResolvedValue('owl');
    vi.mocked(repository.reconcileEquipmentEntitlements).mockResolvedValue(0);
    vi.mocked(repository.getEquipmentMe).mockResolvedValue(snapshot);
  });

  it('keeps initial clothes readable while reward reconciliation is disabled', async () => {
    const service = createEquipmentRewardService({ repository });
    const result = await service.getMe('user-1', { rewardsEnabled: false });

    expect(repository.ensureInitialEquipment).toHaveBeenCalledWith('user-1');
    expect(repository.reconcileEquipmentEntitlements).not.toHaveBeenCalled();
    expect(repository.getEquipmentMe).toHaveBeenCalledWith('user-1');
    expect(result.rewardsEnabled).toBe(false);
  });

  it('reconciles eligible real activities before returning the enabled profile', async () => {
    const service = createEquipmentRewardService({ repository });
    const result = await service.getMe('user-1', { rewardsEnabled: true });

    expect(repository.reconcileEquipmentEntitlements).toHaveBeenCalledWith('user-1');
    expect(
      vi.mocked(repository.reconcileEquipmentEntitlements).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(repository.getEquipmentMe).mock.invocationCallOrder[0]);
    expect(result.rewardsEnabled).toBe(true);
  });

  it('uses the injected cryptographic roll boundary for a transactional draw', async () => {
    vi.mocked(repository.drawEquipmentEntitlement).mockResolvedValue({} as never);
    const service = createEquipmentRewardService({ repository, randomUnit: () => 0.625 });

    await service.draw('user-1', 'entitlement-1');

    expect(repository.drawEquipmentEntitlement).toHaveBeenCalledWith({
      userId: 'user-1',
      entitlementId: 'entitlement-1',
      randomUnit: 0.625,
    });
  });
});

describe('equipment entitlement proof boundary', () => {
  it('excludes cancelled/test activities and exposes no unchecked future grant hook', () => {
    const source = readFileSync(
      new URL('../repositories/equipmentRepo.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain("eventPools.status}, '') <> 'cancelled'");
    expect(source).toContain('eventPools.isTestPool');
    expect(source).toContain('isNotNull(eventFeedback.completedAt)');
    expect(source).not.toContain('grantVenueActivityEntitlement');
  });
});
