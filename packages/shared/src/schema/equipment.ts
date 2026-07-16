import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

import { users, venues } from './_definitions.js';
import { alangMissions } from './_definitions_extended.js';

export const EQUIPMENT_SLOTS = ['top', 'bottom', 'shoes', 'accessory'] as const;
export const EQUIPMENT_RARITIES = ['common', 'rare'] as const;
export const EQUIPMENT_ENTITLEMENT_SOURCE_TYPES = ['blind_box', 'alang'] as const;
export const EQUIPMENT_ACQUISITION_SOURCE_TYPES = ['initial', 'draw', 'shop'] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export type EquipmentRarity = (typeof EQUIPMENT_RARITIES)[number];
export type EquipmentEntitlementSourceType = (typeof EQUIPMENT_ENTITLEMENT_SOURCE_TYPES)[number];
export type EquipmentAcquisitionSourceType = (typeof EQUIPMENT_ACQUISITION_SOURCE_TYPES)[number];

/**
 * Server-owned equipment catalog. `assetKey` resolves to versioned CDN pixel
 * layers; large raster assets must never be bundled in the mini-program.
 */
export const equipmentItems = pgTable('equipment_items', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar('slug', { length: 100 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  slot: varchar('slot', { length: 20 }).notNull(),
  rarity: varchar('rarity', { length: 20 }).notNull().default('common'),
  assetKey: varchar('asset_key', { length: 160 }).notNull(),
  compatibleArchetypes: text('compatible_archetypes').array(), // null = all 12 canonical archetypes
  isInitial: boolean('is_initial').notNull().default(false),
  initialArchetypeId: varchar('initial_archetype_id', { length: 50 }),
  shopAvailable: boolean('shop_available').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_equipment_items_slug').on(table.slug),
  uniqueIndex('uq_equipment_initial_archetype_slot')
    .on(table.initialArchetypeId, table.slot)
    .where(sql`${table.isInitial} = true`),
  index('idx_equipment_items_shop_active').on(table.shopAvailable, table.isActive),
  check('chk_equipment_items_slot', sql`${table.slot} in ('top', 'bottom', 'shoes', 'accessory')`),
  check('chk_equipment_items_rarity', sql`${table.rarity} in ('common', 'rare')`),
  check(
    'chk_equipment_items_initial_archetype',
    sql`(${table.isInitial} = false) or (${table.initialArchetypeId} is not null)`,
  ),
]);

/**
 * A pool belongs to exactly one authoritative location source: a restaurant
 * (`venues.id`) or an Alang mission. Activity type is deliberately absent so
 * Blind Box and future reunion activities at the same restaurant share a pool.
 */
export const equipmentPools = pgTable('equipment_pools', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar('slug', { length: 120 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  venueId: varchar('venue_id').references(() => venues.id),
  alangMissionId: varchar('alang_mission_id').references(() => alangMissions.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_equipment_pools_slug').on(table.slug),
  uniqueIndex('uq_equipment_pools_venue').on(table.venueId),
  uniqueIndex('uq_equipment_pools_alang_mission').on(table.alangMissionId),
  check(
    'chk_equipment_pool_single_authority',
    sql`num_nonnulls(${table.venueId}, ${table.alangMissionId}) = 1`,
  ),
]);

export const equipmentPoolItems = pgTable('equipment_pool_items', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  poolId: varchar('pool_id').notNull().references(() => equipmentPools.id, { onDelete: 'cascade' }),
  itemId: varchar('item_id').notNull().references(() => equipmentItems.id),
  weight: integer('weight').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_equipment_pool_item').on(table.poolId, table.itemId),
  index('idx_equipment_pool_items_active').on(table.poolId, table.isActive),
  check('chk_equipment_pool_item_weight', sql`${table.weight} > 0`),
]);

/** One row per owned item. Repeated draws convert to fragments, never quantity. */
export const userEquipmentInventory = pgTable('user_equipment_inventory', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemId: varchar('item_id').notNull().references(() => equipmentItems.id),
  sourceType: varchar('source_type', { length: 20 }).notNull(),
  sourceId: varchar('source_id'),
  acquiredAt: timestamp('acquired_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_user_equipment_item').on(table.userId, table.itemId),
  index('idx_user_equipment_recent').on(table.userId, table.acquiredAt),
  check('chk_user_equipment_source', sql`${table.sourceType} in ('initial', 'draw', 'shop')`),
]);

/** Four fixed, independently removable slots. A version guards multi-device saves. */
export const userEquipmentOutfits = pgTable('user_equipment_outfits', {
  userId: varchar('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  topItemId: varchar('top_item_id').references(() => equipmentItems.id),
  bottomItemId: varchar('bottom_item_id').references(() => equipmentItems.id),
  shoesItemId: varchar('shoes_item_id').references(() => equipmentItems.id),
  accessoryItemId: varchar('accessory_item_id').references(() => equipmentItems.id),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  check('chk_user_equipment_outfit_version', sql`${table.version} >= 1`),
]);

/**
 * A durable, manually consumed draw token. The source uniqueness constraint is
 * the idempotency boundary for duplicated feedback/completion callbacks.
 */
export const equipmentDrawEntitlements = pgTable('equipment_draw_entitlements', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sourceType: varchar('source_type', { length: 30 }).notNull(),
  sourceRecordId: varchar('source_record_id').notNull(),
  poolId: varchar('pool_id').notNull().references(() => equipmentPools.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  resultItemId: varchar('result_item_id').references(() => equipmentItems.id),
  resultKind: varchar('result_kind', { length: 20 }), // new | duplicate
  fragmentsAwarded: integer('fragments_awarded').notNull().default(0),
  pityBefore: integer('pity_before'),
  pityAfter: integer('pity_after'),
  randomRoll: real('random_roll'),
  drawVersion: varchar('draw_version', { length: 40 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  uniqueIndex('uq_equipment_entitlement_source')
    .on(table.userId, table.sourceType, table.sourceRecordId),
  index('idx_equipment_entitlement_pending').on(table.userId, table.status, table.createdAt),
  check('chk_equipment_entitlement_source_type', sql`${table.sourceType} in ('blind_box', 'alang')`),
  check('chk_equipment_entitlement_status', sql`${table.status} in ('pending', 'resolved')`),
  check(
    'chk_equipment_entitlement_result_kind',
    sql`${table.resultKind} is null or ${table.resultKind} in ('new', 'duplicate')`,
  ),
  check('chk_equipment_entitlement_fragments', sql`${table.fragmentsAwarded} >= 0`),
  check(
    'chk_equipment_entitlement_resolution',
    sql`(${table.status} = 'pending' and ${table.resultItemId} is null and ${table.resolvedAt} is null)
      or (${table.status} = 'resolved' and ${table.resultItemId} is not null and ${table.resultKind} is not null and ${table.resolvedAt} is not null)`,
  ),
]);

/** A single global pity counter is shared across every restaurant/mission pool. */
export const userEquipmentWallets = pgTable('user_equipment_wallets', {
  userId: varchar('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  fragmentBalance: integer('fragment_balance').notNull().default(0),
  pityMisses: integer('pity_misses').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  check('chk_equipment_wallet_fragments_nonnegative', sql`${table.fragmentBalance} >= 0`),
  check('chk_equipment_wallet_pity_range', sql`${table.pityMisses} between 0 and 3`),
]);

/** Immutable fragment audit trail for duplicate awards and shop redemptions. */
export const equipmentFragmentLedger = pgTable('equipment_fragment_ledger', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  transactionType: varchar('transaction_type', { length: 30 }).notNull(),
  delta: integer('delta').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  itemId: varchar('item_id').references(() => equipmentItems.id),
  entitlementId: varchar('entitlement_id').references(() => equipmentDrawEntitlements.id),
  idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_equipment_fragment_ledger_idempotency').on(table.userId, table.idempotencyKey),
  index('idx_equipment_fragment_ledger_user_created').on(table.userId, table.createdAt),
  check('chk_equipment_fragment_transaction_type', sql`${table.transactionType} in ('duplicate', 'shop')`),
  check('chk_equipment_fragment_balance_nonnegative', sql`${table.balanceAfter} >= 0`),
  check('chk_equipment_fragment_nonzero_delta', sql`${table.delta} <> 0`),
]);

export const insertEquipmentItemSchema = createInsertSchema(equipmentItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertEquipmentPoolSchema = createInsertSchema(equipmentPools).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertEquipmentPoolItemSchema = createInsertSchema(equipmentPoolItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const equipmentOutfitInputSchema = z.object({
  topItemId: z.string().uuid().nullable(),
  bottomItemId: z.string().uuid().nullable(),
  shoesItemId: z.string().uuid().nullable(),
  accessoryItemId: z.string().uuid().nullable(),
  expectedVersion: z.number().int().positive(),
}).strict();

export type EquipmentItem = typeof equipmentItems.$inferSelect;
export type EquipmentPool = typeof equipmentPools.$inferSelect;
export type EquipmentPoolItem = typeof equipmentPoolItems.$inferSelect;
export type UserEquipmentInventoryItem = typeof userEquipmentInventory.$inferSelect;
export type UserEquipmentOutfit = typeof userEquipmentOutfits.$inferSelect;
export type EquipmentDrawEntitlement = typeof equipmentDrawEntitlements.$inferSelect;
export type UserEquipmentWallet = typeof userEquipmentWallets.$inferSelect;
export type EquipmentFragmentLedgerEntry = typeof equipmentFragmentLedger.$inferSelect;
export type EquipmentOutfitInput = z.infer<typeof equipmentOutfitInputSchema>;

/** JSON-safe equipment DTOs shared by server routes and mini-program clients. */
export interface EquipmentItemView {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  slot: EquipmentSlot;
  rarity: EquipmentRarity;
  assetKey: string;
  compatibleArchetypes: string[] | null;
}

export interface EquipmentInventoryEntryView {
  id: string;
  itemId: string;
  sourceType: EquipmentAcquisitionSourceType;
  sourceId: string | null;
  acquiredAt: string;
  item: EquipmentItemView;
}

export interface EquipmentOutfitView {
  topItemId: string | null;
  bottomItemId: string | null;
  shoesItemId: string | null;
  accessoryItemId: string | null;
  version: number;
}

export interface EquipmentPendingEntitlementView {
  id: string;
  sourceType: EquipmentEntitlementSourceType;
  sourceRecordId: string;
  poolId: string;
  createdAt: string;
  pool: { id: string; slug: string; name: string };
}

export interface EquipmentMeResponse {
  archetypeId: string;
  outfit: EquipmentOutfitView;
  inventory: EquipmentInventoryEntryView[];
  recentItems: EquipmentInventoryEntryView[];
  wallet: {
    fragmentBalance: number;
    pityMisses: number;
    pityTarget: number;
  };
  pendingEntitlements: EquipmentPendingEntitlementView[];
  rewardsEnabled: boolean;
}

export interface EquipmentDrawResponse {
  entitlementId: string;
  replayed: boolean;
  item: EquipmentItemView;
  resultKind: 'new' | 'duplicate';
  fragmentsAwarded: number;
  fragmentBalance: number;
  pityMisses: number;
  pityTarget: number;
  guaranteed: boolean;
  poolComplete: boolean;
}

export interface EquipmentShopResponse {
  fragmentBalance: number;
  prices: Record<EquipmentRarity, number>;
  items: Array<EquipmentItemView & { price: number; owned: boolean }>;
}

export interface EquipmentShopRedeemResponse {
  item: EquipmentItemView;
  replayed: boolean;
  alreadyOwned: boolean;
  fragmentBalance: number;
  cost: number;
}
