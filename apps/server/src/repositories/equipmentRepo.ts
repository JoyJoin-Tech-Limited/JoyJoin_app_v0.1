import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  lte,
  sql,
} from 'drizzle-orm';

import { db } from '../db';
import {
  eventFeedback,
  eventPoolGroups,
  eventPoolRegistrations,
  eventPools,
  users,
  alangStoryArchives,
} from '@shared/schema';
import { resolveArchetype } from '@shared/personality/archetypeNames';
import {
  EQUIPMENT_SLOTS,
  equipmentDrawEntitlements,
  equipmentFragmentLedger,
  equipmentItems,
  equipmentPoolItems,
  equipmentPools,
  userEquipmentInventory,
  userEquipmentOutfits,
  userEquipmentWallets,
  type EquipmentItem,
  type EquipmentOutfitInput,
  type EquipmentRarity,
  type EquipmentSlot,
} from '@shared/schema/equipment';

export const EQUIPMENT_PITY_TARGET = 4 as const;
export const EQUIPMENT_DRAW_VERSION = 'equipment-draw-v1';
export const DUPLICATE_FRAGMENT_REWARDS: Record<EquipmentRarity, number> = {
  common: 10,
  rare: 30,
};
export const EQUIPMENT_SHOP_PRICES: Record<EquipmentRarity, number> = {
  common: 40,
  rare: 120,
};

export class EquipmentRepositoryError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code,
  ) {
    super(message);
    this.name = 'EquipmentRepositoryError';
  }
}

export interface EquipmentItemSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  assetKey: string;
  compatibleArchetypes: string[] | null;
}

export interface InventoryItemSummary {
  id: string;
  itemId: string;
  sourceType: string;
  sourceId: string | null;
  acquiredAt: Date;
  item: EquipmentItemSummary;
}

export interface OutfitSummary {
  topItemId: string | null;
  bottomItemId: string | null;
  shoesItemId: string | null;
  accessoryItemId: string | null;
  version: number;
}

export interface EquipmentMeSnapshot {
  archetypeId: string;
  outfit: OutfitSummary;
  inventory: InventoryItemSummary[];
  recentItems: InventoryItemSummary[];
  wallet: {
    fragmentBalance: number;
    pityMisses: number;
    pityTarget: typeof EQUIPMENT_PITY_TARGET;
  };
  pendingEntitlements: Array<{
    id: string;
    sourceType: string;
    sourceRecordId: string;
    poolId: string;
    createdAt: Date;
    pool: { id: string; slug: string; name: string };
  }>;
}

export interface DrawCandidate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  assetKey: string;
  compatibleArchetypes: string[] | null;
  weight: number;
}

export interface EquipmentDrawPlan {
  item: DrawCandidate;
  resultKind: 'new' | 'duplicate';
  fragmentsAwarded: number;
  pityAfter: number;
  guaranteed: boolean;
  poolCompleteBefore: boolean;
}

export interface EquipmentDrawResult {
  entitlementId: string;
  replayed: boolean;
  item: EquipmentItemSummary;
  resultKind: 'new' | 'duplicate';
  fragmentsAwarded: number;
  fragmentBalance: number;
  pityMisses: number;
  pityTarget: typeof EQUIPMENT_PITY_TARGET;
  guaranteed: boolean;
  poolComplete: boolean;
}

export interface EquipmentShopResult {
  item: EquipmentItemSummary;
  replayed: boolean;
  alreadyOwned: boolean;
  fragmentBalance: number;
  cost: number;
}

function normalizeRarity(value: string): EquipmentRarity {
  return value === 'rare' ? 'rare' : 'common';
}

function normalizeSlot(value: string): EquipmentSlot {
  if ((EQUIPMENT_SLOTS as readonly string[]).includes(value)) {
    return value as EquipmentSlot;
  }
  throw new EquipmentRepositoryError('EQUIPMENT_ITEM_SLOT_INVALID', 503);
}

function itemSummary(row: Pick<
  EquipmentItem,
  'id' | 'slug' | 'name' | 'description' | 'slot' | 'rarity' | 'assetKey' | 'compatibleArchetypes'
>): EquipmentItemSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    slot: normalizeSlot(row.slot),
    rarity: normalizeRarity(row.rarity),
    assetKey: row.assetKey,
    compatibleArchetypes: row.compatibleArchetypes ?? null,
  };
}

function isCompatibleWithArchetype(
  compatibleArchetypes: string[] | null,
  archetypeId: string,
): boolean {
  return !compatibleArchetypes || compatibleArchetypes.length === 0
    || compatibleArchetypes.includes(archetypeId);
}

type OutfitItemIds = Pick<
  OutfitSummary,
  'topItemId' | 'bottomItemId' | 'shoesItemId' | 'accessoryItemId'
>;

type OutfitCompatibilityItem = Pick<
  EquipmentItem,
  'id' | 'slot' | 'isActive' | 'compatibleArchetypes'
>;

function getOutfitSlotItemId(outfit: OutfitItemIds, slot: EquipmentSlot): string | null {
  return outfit[`${slot}ItemId` as keyof OutfitItemIds] ?? null;
}

/**
 * Pure repair rule for an outfit saved under a previous archetype. Intentionally
 * empty slots stay empty; only equipped items that can no longer be used are
 * replaced by the current archetype's starter for the same slot. Inventory is
 * outside this plan and is never removed during reconciliation.
 */
export function planEquipmentOutfitRepair(options: {
  archetypeId: string;
  currentOutfit: OutfitItemIds;
  equippedItems: ReadonlyMap<string, OutfitCompatibilityItem>;
  starterItemIds: ReadonlyMap<EquipmentSlot, string>;
}): { outfit: OutfitItemIds; changed: boolean } {
  const outfit: OutfitItemIds = { ...options.currentOutfit };
  let changed = false;

  for (const slot of EQUIPMENT_SLOTS) {
    const currentItemId = getOutfitSlotItemId(options.currentOutfit, slot);
    if (!currentItemId) continue;

    const currentItem = options.equippedItems.get(currentItemId);
    const remainsUsable = !!currentItem
      && currentItem.isActive
      && normalizeSlot(currentItem.slot) === slot
      && isCompatibleWithArchetype(
        currentItem.compatibleArchetypes,
        options.archetypeId,
      );
    if (remainsUsable) continue;

    const starterItemId = options.starterItemIds.get(slot);
    if (!starterItemId) {
      throw new EquipmentRepositoryError('INITIAL_EQUIPMENT_NOT_CONFIGURED', 503);
    }
    outfit[`${slot}ItemId` as keyof OutfitItemIds] = starterItemId;
    changed = true;
  }

  return { outfit, changed };
}

function weightedPick(candidates: DrawCandidate[], randomUnit: number): DrawCandidate {
  if (candidates.length === 0) {
    throw new EquipmentRepositoryError('EQUIPMENT_POOL_EMPTY', 409);
  }
  const totalWeight = candidates.reduce((sum, item) => sum + Math.max(1, item.weight), 0);
  const boundedRandom = Number.isFinite(randomUnit)
    ? Math.min(0.999999999999, Math.max(0, randomUnit))
    : 0;
  let cursor = boundedRandom * totalWeight;
  for (const candidate of candidates) {
    cursor -= Math.max(1, candidate.weight);
    if (cursor < 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

/**
 * Pure draw rule used by the transactional repository and deterministic tests.
 * A full current pool freezes the global pity counter; moving to any pool with
 * an unowned item resumes it. Three consecutive misses make draw four new.
 */
export function planEquipmentDraw(options: {
  candidates: DrawCandidate[];
  ownedItemIds: ReadonlySet<string>;
  pityMisses: number;
  randomUnit: number;
}): EquipmentDrawPlan {
  const { candidates, ownedItemIds, randomUnit } = options;
  if (candidates.length === 0) {
    throw new EquipmentRepositoryError('EQUIPMENT_POOL_EMPTY', 409);
  }

  const pityMisses = Math.min(EQUIPMENT_PITY_TARGET - 1, Math.max(0, options.pityMisses));
  const unowned = candidates.filter((candidate) => !ownedItemIds.has(candidate.id));
  const poolCompleteBefore = unowned.length === 0;
  const guaranteed = pityMisses >= EQUIPMENT_PITY_TARGET - 1 && !poolCompleteBefore;
  const item = weightedPick(guaranteed ? unowned : candidates, randomUnit);
  const isNew = !ownedItemIds.has(item.id);

  return {
    item,
    resultKind: isNew ? 'new' : 'duplicate',
    fragmentsAwarded: isNew ? 0 : DUPLICATE_FRAGMENT_REWARDS[item.rarity],
    pityAfter: poolCompleteBefore
      ? pityMisses
      : isNew
        ? 0
        : Math.min(EQUIPMENT_PITY_TARGET - 1, pityMisses + 1),
    guaranteed,
    poolCompleteBefore,
  };
}

async function ensureWallet(executor: any, userId: string, lock = false) {
  await executor
    .insert(userEquipmentWallets)
    .values({ userId, fragmentBalance: 0, pityMisses: 0 })
    .onConflictDoNothing({ target: userEquipmentWallets.userId });

  let query = executor
    .select()
    .from(userEquipmentWallets)
    .where(eq(userEquipmentWallets.userId, userId))
    .limit(1);
  if (lock) query = query.for('update');
  const [wallet] = await query;
  if (!wallet) throw new EquipmentRepositoryError('EQUIPMENT_WALLET_UNAVAILABLE', 503);
  return wallet;
}

/** V4 assessment output is authoritative; the legacy field is fallback-only. */
export function resolveEquipmentArchetypeId(user: {
  primaryArchetype?: string | null;
  archetype?: string | null;
}): string | null {
  const rawArchetype = user.primaryArchetype ?? user.archetype;
  return rawArchetype ? (resolveArchetype(rawArchetype)?.id ?? null) : null;
}

async function ensureInitialEquipmentInTransaction(
  tx: any,
  userId: string,
): Promise<string> {
  const [lockedUser] = await tx
    .select({ id: users.id, archetype: users.archetype, primaryArchetype: users.primaryArchetype })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for('update');
  if (!lockedUser) throw new EquipmentRepositoryError('USER_NOT_FOUND', 404);

  const archetypeId = resolveEquipmentArchetypeId(lockedUser);
  const archetype = archetypeId ? resolveArchetype(archetypeId) : null;
  if (!archetype) throw new EquipmentRepositoryError('ARCHETYPE_REQUIRED', 409);

  const initialItems = await tx
    .select()
    .from(equipmentItems)
    .where(and(
      eq(equipmentItems.isInitial, true),
      eq(equipmentItems.initialArchetypeId, archetype.id),
      eq(equipmentItems.isActive, true),
    ));

  const itemBySlot = new Map<EquipmentSlot, EquipmentItem>();
  for (const item of initialItems) {
    itemBySlot.set(normalizeSlot(item.slot), item);
  }
  if (EQUIPMENT_SLOTS.some((slot) => !itemBySlot.has(slot))) {
    throw new EquipmentRepositoryError('INITIAL_EQUIPMENT_NOT_CONFIGURED', 503);
  }

  await tx
    .insert(userEquipmentInventory)
    .values(EQUIPMENT_SLOTS.map((slot) => ({
      userId,
      itemId: itemBySlot.get(slot)!.id,
      sourceType: 'initial',
      sourceId: archetype.id,
    })))
    .onConflictDoNothing({
      target: [userEquipmentInventory.userId, userEquipmentInventory.itemId],
    });

  await tx
    .insert(userEquipmentOutfits)
    .values({
      userId,
      topItemId: itemBySlot.get('top')!.id,
      bottomItemId: itemBySlot.get('bottom')!.id,
      shoesItemId: itemBySlot.get('shoes')!.id,
      accessoryItemId: itemBySlot.get('accessory')!.id,
      version: 1,
    })
    .onConflictDoNothing({ target: userEquipmentOutfits.userId });

  const [lockedOutfit] = await tx
    .select()
    .from(userEquipmentOutfits)
    .where(eq(userEquipmentOutfits.userId, userId))
    .limit(1)
    .for('update');
  if (!lockedOutfit) {
    throw new EquipmentRepositoryError('EQUIPMENT_OUTFIT_NOT_FOUND', 404);
  }

  const equippedIds = EQUIPMENT_SLOTS
    .map((slot) => getOutfitSlotItemId(lockedOutfit, slot))
    .filter((itemId): itemId is string => !!itemId);
  const equippedRows = equippedIds.length === 0
    ? []
    : await tx
        .select()
        .from(equipmentItems)
        .where(inArray(equipmentItems.id, [...new Set(equippedIds)]));
  const repair = planEquipmentOutfitRepair({
    archetypeId: archetype.id,
    currentOutfit: lockedOutfit,
    equippedItems: new Map(
      equippedRows.map((item: EquipmentItem) => [item.id, item]),
    ),
    starterItemIds: new Map(
      EQUIPMENT_SLOTS.map((slot) => [slot, itemBySlot.get(slot)!.id]),
    ),
  });
  if (repair.changed) {
    await tx
      .update(userEquipmentOutfits)
      .set({
        ...repair.outfit,
        version: lockedOutfit.version + 1,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userEquipmentOutfits.userId, userId),
        eq(userEquipmentOutfits.version, lockedOutfit.version),
      ));
  }

  await ensureWallet(tx, userId, false);
  return archetype.id;
}

export async function ensureInitialEquipment(userId: string): Promise<string> {
  return db.transaction(async (tx: any) => {
    return ensureInitialEquipmentInTransaction(tx, userId);
  });
}

/**
 * Repairs missed callbacks idempotently. Blind Box eligibility uses the locked
 * product rule: event ended + matched group + completed feedback. Test pools
 * and debug Alang archives never mint a draw entitlement.
 */
export async function reconcileEquipmentEntitlements(userId: string): Promise<number> {
  const now = new Date();
  const blindBoxRows = await db
    .selectDistinct({
      sourceRecordId: eventPoolGroups.id,
      poolId: equipmentPools.id,
    })
    .from(eventPoolRegistrations)
    .innerJoin(
      eventPoolGroups,
      eq(eventPoolRegistrations.assignedGroupId, eventPoolGroups.id),
    )
    .innerJoin(eventPools, eq(eventPoolGroups.poolId, eventPools.id))
    .innerJoin(
      eventFeedback,
      and(
        eq(eventFeedback.eventId, eventPoolGroups.eventId),
        eq(eventFeedback.userId, userId),
      ),
    )
    .innerJoin(
      equipmentPools,
      and(
        eq(equipmentPools.venueId, eventPoolGroups.venueId),
        eq(equipmentPools.isActive, true),
      ),
    )
    .where(and(
      eq(eventPoolRegistrations.userId, userId),
      eq(eventPoolRegistrations.matchStatus, 'matched'),
      lte(eventPools.dateTime, now),
      isNotNull(eventPoolGroups.venueId),
      isNotNull(eventPoolGroups.eventId),
      isNotNull(eventFeedback.completedAt),
      sql`coalesce(${eventPools.isTestPool}, false) = false`,
      sql`coalesce(${eventPools.status}, '') <> 'cancelled'`,
      sql`coalesce(${eventPoolGroups.status}, 'confirmed') <> 'cancelled'`,
    ));

  const alangRows = await db
    .selectDistinct({
      sourceRecordId: alangStoryArchives.id,
      poolId: equipmentPools.id,
    })
    .from(alangStoryArchives)
    .innerJoin(
      equipmentPools,
      and(
        eq(equipmentPools.alangMissionId, alangStoryArchives.missionId),
        eq(equipmentPools.isActive, true),
      ),
    )
    .where(and(
      eq(alangStoryArchives.userId, userId),
      sql`coalesce(${alangStoryArchives.isDebugSession}, false) = false`,
    ));

  const deduped = new Map<string, {
    userId: string;
    sourceType: 'blind_box' | 'alang';
    sourceRecordId: string;
    poolId: string;
  }>();
  for (const row of blindBoxRows) {
    deduped.set(`blind_box:${row.sourceRecordId}`, {
      userId,
      sourceType: 'blind_box',
      sourceRecordId: row.sourceRecordId,
      poolId: row.poolId,
    });
  }
  for (const row of alangRows) {
    deduped.set(`alang:${row.sourceRecordId}`, {
      userId,
      sourceType: 'alang',
      sourceRecordId: row.sourceRecordId,
      poolId: row.poolId,
    });
  }

  const values = [...deduped.values()];
  if (values.length === 0) return 0;
  const inserted = await db
    .insert(equipmentDrawEntitlements)
    .values(values)
    .onConflictDoNothing({
      target: [
        equipmentDrawEntitlements.userId,
        equipmentDrawEntitlements.sourceType,
        equipmentDrawEntitlements.sourceRecordId,
      ],
    })
    .returning({ id: equipmentDrawEntitlements.id });
  return inserted.length;
}

export async function getEquipmentMe(userId: string): Promise<EquipmentMeSnapshot> {
  const archetypeId = await ensureInitialEquipment(userId);

  const inventoryRows = await db
    .select({
      inventoryId: userEquipmentInventory.id,
      itemId: userEquipmentInventory.itemId,
      sourceType: userEquipmentInventory.sourceType,
      sourceId: userEquipmentInventory.sourceId,
      acquiredAt: userEquipmentInventory.acquiredAt,
      item: equipmentItems,
    })
    .from(userEquipmentInventory)
    .innerJoin(equipmentItems, eq(userEquipmentInventory.itemId, equipmentItems.id))
    .where(eq(userEquipmentInventory.userId, userId))
    .orderBy(desc(userEquipmentInventory.acquiredAt));

  const [outfit] = await db
    .select()
    .from(userEquipmentOutfits)
    .where(eq(userEquipmentOutfits.userId, userId))
    .limit(1);
  const [wallet] = await db
    .select()
    .from(userEquipmentWallets)
    .where(eq(userEquipmentWallets.userId, userId))
    .limit(1);
  const pending = await db
    .select({
      id: equipmentDrawEntitlements.id,
      sourceType: equipmentDrawEntitlements.sourceType,
      sourceRecordId: equipmentDrawEntitlements.sourceRecordId,
      poolId: equipmentDrawEntitlements.poolId,
      createdAt: equipmentDrawEntitlements.createdAt,
      poolIdJoined: equipmentPools.id,
      poolSlug: equipmentPools.slug,
      poolName: equipmentPools.name,
    })
    .from(equipmentDrawEntitlements)
    .innerJoin(equipmentPools, eq(equipmentDrawEntitlements.poolId, equipmentPools.id))
    .where(and(
      eq(equipmentDrawEntitlements.userId, userId),
      eq(equipmentDrawEntitlements.status, 'pending'),
    ))
    .orderBy(desc(equipmentDrawEntitlements.createdAt));

  if (!outfit || !wallet) {
    throw new EquipmentRepositoryError('EQUIPMENT_PROFILE_UNAVAILABLE', 503);
  }
  const inventory: InventoryItemSummary[] = inventoryRows.map((row: any) => ({
    id: row.inventoryId,
    itemId: row.itemId,
    sourceType: row.sourceType,
    sourceId: row.sourceId ?? null,
    acquiredAt: row.acquiredAt,
    item: itemSummary(row.item),
  }));

  return {
    archetypeId,
    outfit: {
      topItemId: outfit.topItemId ?? null,
      bottomItemId: outfit.bottomItemId ?? null,
      shoesItemId: outfit.shoesItemId ?? null,
      accessoryItemId: outfit.accessoryItemId ?? null,
      version: outfit.version,
    },
    inventory,
    recentItems: inventory.slice(0, 8),
    wallet: {
      fragmentBalance: wallet.fragmentBalance,
      pityMisses: wallet.pityMisses,
      pityTarget: EQUIPMENT_PITY_TARGET,
    },
    pendingEntitlements: pending.map((row: any) => ({
      id: row.id,
      sourceType: row.sourceType,
      sourceRecordId: row.sourceRecordId,
      poolId: row.poolId,
      createdAt: row.createdAt,
      pool: { id: row.poolIdJoined, slug: row.poolSlug, name: row.poolName },
    })),
  };
}

export async function saveEquipmentOutfit(
  userId: string,
  input: EquipmentOutfitInput,
): Promise<OutfitSummary> {
  return db.transaction(async (tx: any) => {
    // Resolve the current archetype, grant its starters, and repair an old
    // archetype outfit under the same user/outfit locks used by this save.
    const archetypeId = await ensureInitialEquipmentInTransaction(tx, userId);
    const [current] = await tx
      .select()
      .from(userEquipmentOutfits)
      .where(eq(userEquipmentOutfits.userId, userId))
      .limit(1)
      .for('update');
    if (!current) throw new EquipmentRepositoryError('EQUIPMENT_OUTFIT_NOT_FOUND', 404);
    if (current.version !== input.expectedVersion) {
      throw new EquipmentRepositoryError('EQUIPMENT_OUTFIT_VERSION_CONFLICT', 409);
    }

    const requested: Array<[EquipmentSlot, string]> = [
      ['top', input.topItemId],
      ['bottom', input.bottomItemId],
      ['shoes', input.shoesItemId],
      ['accessory', input.accessoryItemId],
    ].filter((entry): entry is [EquipmentSlot, string] => typeof entry[1] === 'string');
    const requestedIds = [...new Set(requested.map(([, itemId]) => itemId))];
    const ownedRows = requestedIds.length === 0
      ? []
      : await tx
          .select({ item: equipmentItems })
          .from(userEquipmentInventory)
          .innerJoin(equipmentItems, eq(userEquipmentInventory.itemId, equipmentItems.id))
          .where(and(
            eq(userEquipmentInventory.userId, userId),
            inArray(userEquipmentInventory.itemId, requestedIds),
          ));
    const itemById = new Map<string, EquipmentItem>(
      ownedRows.map((row: any) => [row.item.id, row.item]),
    );
    for (const [slot, itemId] of requested) {
      const item = itemById.get(itemId);
      if (!item) throw new EquipmentRepositoryError('EQUIPMENT_ITEM_NOT_OWNED', 400);
      if (!item.isActive) throw new EquipmentRepositoryError('EQUIPMENT_ITEM_INACTIVE', 409);
      if (normalizeSlot(item.slot) !== slot) {
        throw new EquipmentRepositoryError('EQUIPMENT_ITEM_SLOT_MISMATCH', 400);
      }
      if (!isCompatibleWithArchetype(item.compatibleArchetypes, archetypeId)) {
        throw new EquipmentRepositoryError('EQUIPMENT_ITEM_INCOMPATIBLE', 400);
      }
    }

    const [saved] = await tx
      .update(userEquipmentOutfits)
      .set({
        topItemId: input.topItemId,
        bottomItemId: input.bottomItemId,
        shoesItemId: input.shoesItemId,
        accessoryItemId: input.accessoryItemId,
        version: current.version + 1,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userEquipmentOutfits.userId, userId),
        eq(userEquipmentOutfits.version, input.expectedVersion),
      ))
      .returning();
    if (!saved) throw new EquipmentRepositoryError('EQUIPMENT_OUTFIT_VERSION_CONFLICT', 409);
    return {
      topItemId: saved.topItemId ?? null,
      bottomItemId: saved.bottomItemId ?? null,
      shoesItemId: saved.shoesItemId ?? null,
      accessoryItemId: saved.accessoryItemId ?? null,
      version: saved.version,
    };
  });
}

async function getPoolCompletion(
  executor: any,
  userId: string,
  poolId: string,
  archetypeId: string,
): Promise<boolean> {
  const rows = await executor
    .select({ item: equipmentItems, inventoryId: userEquipmentInventory.id })
    .from(equipmentPoolItems)
    .innerJoin(equipmentItems, eq(equipmentPoolItems.itemId, equipmentItems.id))
    .leftJoin(
      userEquipmentInventory,
      and(
        eq(userEquipmentInventory.itemId, equipmentItems.id),
        eq(userEquipmentInventory.userId, userId),
      ),
    )
    .where(and(
      eq(equipmentPoolItems.poolId, poolId),
      eq(equipmentPoolItems.isActive, true),
      eq(equipmentItems.isActive, true),
    ));
  const compatible = rows.filter((row: any) =>
    isCompatibleWithArchetype(row.item.compatibleArchetypes, archetypeId));
  return compatible.length > 0 && compatible.every((row: any) => !!row.inventoryId);
}

export async function drawEquipmentEntitlement(options: {
  userId: string;
  entitlementId: string;
  randomUnit: number;
}): Promise<EquipmentDrawResult> {
  const { userId, entitlementId, randomUnit } = options;
  const archetypeId = await ensureInitialEquipment(userId);

  return db.transaction(async (tx: any) => {
    const [entitlement] = await tx
      .select()
      .from(equipmentDrawEntitlements)
      .where(and(
        eq(equipmentDrawEntitlements.id, entitlementId),
        eq(equipmentDrawEntitlements.userId, userId),
      ))
      .limit(1)
      .for('update');
    if (!entitlement) throw new EquipmentRepositoryError('EQUIPMENT_ENTITLEMENT_NOT_FOUND', 404);

    const wallet = await ensureWallet(tx, userId, true);
    if (entitlement.status === 'resolved') {
      const [item] = await tx
        .select()
        .from(equipmentItems)
        .where(eq(equipmentItems.id, entitlement.resultItemId))
        .limit(1);
      if (!item || !entitlement.resultKind) {
        throw new EquipmentRepositoryError('EQUIPMENT_ENTITLEMENT_CORRUPT', 503);
      }
      return {
        entitlementId,
        replayed: true,
        item: itemSummary(item),
        resultKind: entitlement.resultKind as 'new' | 'duplicate',
        fragmentsAwarded: entitlement.fragmentsAwarded,
        fragmentBalance: wallet.fragmentBalance,
        pityMisses: wallet.pityMisses,
        pityTarget: EQUIPMENT_PITY_TARGET,
        guaranteed: entitlement.drawVersion === `${EQUIPMENT_DRAW_VERSION}:guaranteed`,
        poolComplete: await getPoolCompletion(tx, userId, entitlement.poolId, archetypeId),
      };
    }

    const [pool] = await tx
      .select()
      .from(equipmentPools)
      .where(eq(equipmentPools.id, entitlement.poolId))
      .limit(1);
    if (!pool || !pool.isActive) {
      throw new EquipmentRepositoryError('EQUIPMENT_POOL_UNAVAILABLE', 409);
    }
    const rows = await tx
      .select({ item: equipmentItems, weight: equipmentPoolItems.weight })
      .from(equipmentPoolItems)
      .innerJoin(equipmentItems, eq(equipmentPoolItems.itemId, equipmentItems.id))
      .where(and(
        eq(equipmentPoolItems.poolId, pool.id),
        eq(equipmentPoolItems.isActive, true),
        eq(equipmentItems.isActive, true),
      ));
    const candidates: DrawCandidate[] = rows
      .filter((row: any) => isCompatibleWithArchetype(row.item.compatibleArchetypes, archetypeId))
      .map((row: any) => ({ ...itemSummary(row.item), weight: row.weight }));
    if (candidates.length === 0) {
      throw new EquipmentRepositoryError('EQUIPMENT_POOL_EMPTY', 409);
    }
    const ownedRows = await tx
      .select({ itemId: userEquipmentInventory.itemId })
      .from(userEquipmentInventory)
      .where(and(
        eq(userEquipmentInventory.userId, userId),
        inArray(userEquipmentInventory.itemId, candidates.map((candidate) => candidate.id)),
      ));
    const ownedItemIds = new Set<string>(ownedRows.map((row: any) => row.itemId));
    let plan = planEquipmentDraw({
      candidates,
      ownedItemIds,
      pityMisses: wallet.pityMisses,
      randomUnit,
    });

    if (plan.resultKind === 'new') {
      const inserted = await tx
        .insert(userEquipmentInventory)
        .values({
          userId,
          itemId: plan.item.id,
          sourceType: 'draw',
          sourceId: entitlement.id,
        })
        .onConflictDoNothing({
          target: [userEquipmentInventory.userId, userEquipmentInventory.itemId],
        })
        .returning({ id: userEquipmentInventory.id });
      // Defensive fallback for an out-of-band grant racing this transaction.
      if (inserted.length === 0) {
        plan = {
          ...plan,
          resultKind: 'duplicate',
          fragmentsAwarded: DUPLICATE_FRAGMENT_REWARDS[plan.item.rarity],
          pityAfter: plan.poolCompleteBefore
            ? wallet.pityMisses
            : Math.min(EQUIPMENT_PITY_TARGET - 1, wallet.pityMisses + 1),
          guaranteed: false,
        };
      }
    }

    const fragmentBalance = wallet.fragmentBalance + plan.fragmentsAwarded;
    await tx
      .update(userEquipmentWallets)
      .set({
        fragmentBalance,
        pityMisses: plan.pityAfter,
        updatedAt: new Date(),
      })
      .where(eq(userEquipmentWallets.userId, userId));
    if (plan.fragmentsAwarded > 0) {
      await tx
        .insert(equipmentFragmentLedger)
        .values({
          userId,
          transactionType: 'duplicate',
          delta: plan.fragmentsAwarded,
          balanceAfter: fragmentBalance,
          itemId: plan.item.id,
          entitlementId: entitlement.id,
          idempotencyKey: `draw:${entitlement.id}`,
        })
        .onConflictDoNothing({
          target: [equipmentFragmentLedger.userId, equipmentFragmentLedger.idempotencyKey],
        });
    }

    const resolvedAt = new Date();
    await tx
      .update(equipmentDrawEntitlements)
      .set({
        status: 'resolved',
        resultItemId: plan.item.id,
        resultKind: plan.resultKind,
        fragmentsAwarded: plan.fragmentsAwarded,
        pityBefore: wallet.pityMisses,
        pityAfter: plan.pityAfter,
        randomRoll: Math.min(0.999999999999, Math.max(0, randomUnit)),
        drawVersion: plan.guaranteed
          ? `${EQUIPMENT_DRAW_VERSION}:guaranteed`
          : EQUIPMENT_DRAW_VERSION,
        resolvedAt,
      })
      .where(eq(equipmentDrawEntitlements.id, entitlement.id));

    return {
      entitlementId,
      replayed: false,
      item: plan.item,
      resultKind: plan.resultKind,
      fragmentsAwarded: plan.fragmentsAwarded,
      fragmentBalance,
      pityMisses: plan.pityAfter,
      pityTarget: EQUIPMENT_PITY_TARGET,
      guaranteed: plan.guaranteed,
      poolComplete: await getPoolCompletion(tx, userId, pool.id, archetypeId),
    };
  });
}

export async function getEquipmentPool(poolId: string, userId: string) {
  const archetypeId = await ensureInitialEquipment(userId);
  const [pool] = await db
    .select({ id: equipmentPools.id, slug: equipmentPools.slug, name: equipmentPools.name })
    .from(equipmentPools)
    .where(and(eq(equipmentPools.id, poolId), eq(equipmentPools.isActive, true)))
    .limit(1);
  if (!pool) throw new EquipmentRepositoryError('EQUIPMENT_POOL_NOT_FOUND', 404);
  const rows = await db
    .select({ item: equipmentItems })
    .from(equipmentPoolItems)
    .innerJoin(equipmentItems, eq(equipmentPoolItems.itemId, equipmentItems.id))
    .where(and(
      eq(equipmentPoolItems.poolId, poolId),
      eq(equipmentPoolItems.isActive, true),
      eq(equipmentItems.isActive, true),
    ));
  return {
    pool,
    items: rows
      .map((row: any) => row.item as EquipmentItem)
      .filter((item: EquipmentItem) =>
        isCompatibleWithArchetype(item.compatibleArchetypes, archetypeId))
      .map(itemSummary),
    pityTarget: EQUIPMENT_PITY_TARGET,
  };
}

export async function getEquipmentShop(userId: string) {
  const archetypeId = await ensureInitialEquipment(userId);
  const [wallet] = await db
    .select()
    .from(userEquipmentWallets)
    .where(eq(userEquipmentWallets.userId, userId))
    .limit(1);
  const rows = await db
    .select({ item: equipmentItems, inventoryId: userEquipmentInventory.id })
    .from(equipmentItems)
    .leftJoin(
      userEquipmentInventory,
      and(
        eq(userEquipmentInventory.itemId, equipmentItems.id),
        eq(userEquipmentInventory.userId, userId),
      ),
    )
    .where(and(
      eq(equipmentItems.shopAvailable, true),
      eq(equipmentItems.isActive, true),
    ))
    .orderBy(equipmentItems.rarity, equipmentItems.name);
  return {
    fragmentBalance: wallet?.fragmentBalance ?? 0,
    prices: EQUIPMENT_SHOP_PRICES,
    items: rows
      .filter((row: any) => isCompatibleWithArchetype(row.item.compatibleArchetypes, archetypeId))
      .map((row: any) => {
        const item = itemSummary(row.item);
        return {
          ...item,
          price: EQUIPMENT_SHOP_PRICES[item.rarity],
          owned: !!row.inventoryId,
        };
      }),
  };
}

export async function redeemEquipmentShopItem(options: {
  userId: string;
  itemId: string;
  idempotencyKey: string;
}): Promise<EquipmentShopResult> {
  const { userId, itemId } = options;
  const archetypeId = await ensureInitialEquipment(userId);
  const ledgerKey = `shop:${options.idempotencyKey}`;

  return db.transaction(async (tx: any) => {
    const wallet = await ensureWallet(tx, userId, true);
    const [existingLedger] = await tx
      .select()
      .from(equipmentFragmentLedger)
      .where(and(
        eq(equipmentFragmentLedger.userId, userId),
        eq(equipmentFragmentLedger.idempotencyKey, ledgerKey),
      ))
      .limit(1);
    if (existingLedger) {
      if (existingLedger.itemId !== itemId) {
        throw new EquipmentRepositoryError('IDEMPOTENCY_KEY_REUSED', 409);
      }
      const [item] = await tx.select().from(equipmentItems).where(eq(equipmentItems.id, itemId)).limit(1);
      if (!item) throw new EquipmentRepositoryError('EQUIPMENT_ITEM_NOT_FOUND', 404);
      return {
        item: itemSummary(item),
        replayed: true,
        alreadyOwned: false,
        fragmentBalance: wallet.fragmentBalance,
        cost: Math.abs(existingLedger.delta),
      };
    }

    const [item] = await tx
      .select()
      .from(equipmentItems)
      .where(and(
        eq(equipmentItems.id, itemId),
        eq(equipmentItems.shopAvailable, true),
        eq(equipmentItems.isActive, true),
      ))
      .limit(1);
    if (!item) throw new EquipmentRepositoryError('EQUIPMENT_SHOP_ITEM_NOT_FOUND', 404);
    if (!isCompatibleWithArchetype(item.compatibleArchetypes, archetypeId)) {
      throw new EquipmentRepositoryError('EQUIPMENT_ITEM_INCOMPATIBLE', 400);
    }
    const [owned] = await tx
      .select({ id: userEquipmentInventory.id })
      .from(userEquipmentInventory)
      .where(and(
        eq(userEquipmentInventory.userId, userId),
        eq(userEquipmentInventory.itemId, itemId),
      ))
      .limit(1);
    const summary = itemSummary(item);
    const cost = EQUIPMENT_SHOP_PRICES[summary.rarity];
    if (owned) {
      return {
        item: summary,
        replayed: false,
        alreadyOwned: true,
        fragmentBalance: wallet.fragmentBalance,
        cost,
      };
    }
    if (wallet.fragmentBalance < cost) {
      throw new EquipmentRepositoryError('EQUIPMENT_FRAGMENTS_INSUFFICIENT', 409);
    }

    const balanceAfter = wallet.fragmentBalance - cost;
    const inserted = await tx
      .insert(userEquipmentInventory)
      .values({ userId, itemId, sourceType: 'shop', sourceId: ledgerKey })
      .onConflictDoNothing({
        target: [userEquipmentInventory.userId, userEquipmentInventory.itemId],
      })
      .returning({ id: userEquipmentInventory.id });
    if (inserted.length === 0) {
      return {
        item: summary,
        replayed: false,
        alreadyOwned: true,
        fragmentBalance: wallet.fragmentBalance,
        cost,
      };
    }
    await tx
      .update(userEquipmentWallets)
      .set({ fragmentBalance: balanceAfter, updatedAt: new Date() })
      .where(eq(userEquipmentWallets.userId, userId));
    await tx.insert(equipmentFragmentLedger).values({
      userId,
      transactionType: 'shop',
      delta: -cost,
      balanceAfter,
      itemId,
      idempotencyKey: ledgerKey,
    });

    return {
      item: summary,
      replayed: false,
      alreadyOwned: false,
      fragmentBalance: balanceAfter,
      cost,
    };
  });
}

export interface RoomEquipmentLook {
  userId: string;
  outfit: OutfitSummary;
  equippedItems: EquipmentItemSummary[];
}

/**
 * Batched read for the gathering room: resolve the current outfit and equipped
 * item details for a list of member userIds without N+1 queries.
 */
export async function getEquipmentLooksForUsers(userIds: string[]): Promise<RoomEquipmentLook[]> {
  if (userIds.length === 0) return [];

  const outfits = await db
    .select({
      userId: userEquipmentOutfits.userId,
      topItemId: userEquipmentOutfits.topItemId,
      bottomItemId: userEquipmentOutfits.bottomItemId,
      shoesItemId: userEquipmentOutfits.shoesItemId,
      accessoryItemId: userEquipmentOutfits.accessoryItemId,
      version: userEquipmentOutfits.version,
    })
    .from(userEquipmentOutfits)
    .where(inArray(userEquipmentOutfits.userId, userIds));

  const outfitByUserId = new Map<string, typeof outfits[number]>(
    outfits.map((row: any) => [row.userId, row]),
  );

  const itemIds = new Set<string>();
  for (const row of outfits) {
    for (const slot of EQUIPMENT_SLOTS) {
      const itemId = row[`${slot}ItemId` as keyof typeof row];
      if (itemId) itemIds.add(itemId);
    }
  }

  const items = itemIds.size > 0
    ? await db
        .select()
        .from(equipmentItems)
        .where(inArray(equipmentItems.id, [...itemIds]))
    : [];
  const itemById = new Map(
    items.map((row: any) => [row.id, itemSummary(row)] as [string, EquipmentItemSummary]),
  );

  return userIds.map((userId) => {
    const outfitRow = outfitByUserId.get(userId);
    const outfit: OutfitSummary = outfitRow
      ? {
          topItemId: outfitRow.topItemId ?? null,
          bottomItemId: outfitRow.bottomItemId ?? null,
          shoesItemId: outfitRow.shoesItemId ?? null,
          accessoryItemId: outfitRow.accessoryItemId ?? null,
          version: outfitRow.version,
        }
      : { topItemId: null, bottomItemId: null, shoesItemId: null, accessoryItemId: null, version: 1 };

    const equippedItems = EQUIPMENT_SLOTS
      .map((slot) => outfit[`${slot}ItemId` as keyof OutfitSummary])
      .filter((itemId): itemId is string => !!itemId)
      .map((itemId) => itemById.get(itemId))
      .filter((item): item is EquipmentItemSummary => !!item);

    return {
      userId,
      outfit,
      equippedItems,
    };
  });
}

export const equipmentRepository = {
  ensureInitialEquipment,
  reconcileEquipmentEntitlements,
  getEquipmentMe,
  getEquipmentLooksForUsers,
  saveEquipmentOutfit,
  drawEquipmentEntitlement,
  getEquipmentPool,
  getEquipmentShop,
  redeemEquipmentShopItem,
};

export type EquipmentRepository = typeof equipmentRepository;
