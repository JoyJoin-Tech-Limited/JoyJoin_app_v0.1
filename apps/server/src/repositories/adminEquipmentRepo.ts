import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../db";
import {
  alangMissions,
  equipmentDrawEntitlements,
  equipmentFragmentLedger,
  equipmentItems,
  equipmentPoolItems,
  equipmentPools,
  venues,
} from "@shared/schema";

export type AdminEquipmentExecutor = typeof db;

export class AdminEquipmentRepositoryError extends Error {
  constructor(
    public readonly adminCode: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminEquipmentRepositoryError";
  }
}

export function hasLaunchReadyAdminEquipmentPool(
  items: Array<{ rarity: string; isActive: boolean }>,
): boolean {
  const active = items.filter((item) => item.isActive);
  return active.length === 6
    && active.filter((item) => item.rarity === "common").length === 4
    && active.filter((item) => item.rarity === "rare").length === 2;
}

export type AdminEquipmentConsistencyIssue = {
  code: string;
  severity: "blocking" | "warning";
  title: string;
  detail: string;
  entityType: "rollout" | "item" | "pool";
  entityId: string | null;
  entityName: string | null;
};

export function evaluateAdminEquipmentConsistency(input: {
  items: Array<{
    id: string;
    name: string;
    isActive: boolean;
    shopAvailable: boolean;
  }>;
  pools: Array<{
    id: string;
    name: string;
    isActive: boolean;
    items: Array<{
      itemId: string;
      itemName: string;
      itemRarity: string;
      isActive: boolean;
      itemIsActive: boolean;
    }>;
  }>;
  rollout: {
    profilePixelAvatarEnabled: boolean;
    equipmentRewardsEnabled: boolean;
  };
}) {
  const issues: AdminEquipmentConsistencyIssue[] = [];
  const activeItems = input.items.filter((item) => item.isActive);
  const activePools = input.pools.filter((pool) => pool.isActive);

  if (input.rollout.equipmentRewardsEnabled && activePools.length === 0) {
    issues.push({
      code: "REWARDS_WITHOUT_ACTIVE_POOL",
      severity: "blocking",
      title: "奖励已开放，但没有启用的装备池",
      detail: "用户可能获得抽取资格，却没有可用奖池。请先启用至少一个合格装备池，或关闭装备奖励开关。",
      entityType: "rollout",
      entityId: null,
      entityName: null,
    });
  }
  if (input.rollout.profilePixelAvatarEnabled && activeItems.length === 0) {
    issues.push({
      code: "AVATAR_WITHOUT_ACTIVE_ITEMS",
      severity: "blocking",
      title: "我的形象已开放，但没有可用装备",
      detail: "请先启用正式装备，或关闭我的形象开关。",
      entityType: "rollout",
      entityId: null,
      entityName: null,
    });
  }

  for (const pool of activePools) {
    const usableMembers = pool.items.map((item) => ({
      rarity: item.itemRarity,
      isActive: item.isActive && item.itemIsActive,
    }));
    if (!hasLaunchReadyAdminEquipmentPool(usableMembers)) {
      issues.push({
        code: "ACTIVE_POOL_INVALID_COMPOSITION",
        severity: "blocking",
        title: `装备池「${pool.name}」不满足上线构成`,
        detail: "启用装备池必须始终包含 4 件可用普通装备和 2 件可用稀有装备。",
        entityType: "pool",
        entityId: pool.id,
        entityName: pool.name,
      });
    }
  }

  for (const item of input.items) {
    if (!item.isActive && item.shopAvailable) {
      issues.push({
        code: "INACTIVE_ITEM_IN_SHOP",
        severity: "warning",
        title: `停用装备「${item.name}」仍标记为商店可兑换`,
        detail: "当前运行时会过滤停用装备，但配置含义不一致，建议关闭商店可兑换状态。",
        entityType: "item",
        entityId: item.id,
        entityName: item.name,
      });
    }
  }

  const activePoolItemIds = new Set(activePools.flatMap((pool) =>
    pool.items
      .filter((item) => item.isActive && item.itemIsActive)
      .map((item) => item.itemId)));
  const unusedActiveItems = activeItems.filter((item) => !activePoolItemIds.has(item.id));
  if (unusedActiveItems.length > 0) {
    issues.push({
      code: "ACTIVE_ITEMS_NOT_IN_ACTIVE_POOL",
      severity: "warning",
      title: `${unusedActiveItems.length} 件启用装备未进入任何启用装备池`,
      detail: `包括：${unusedActiveItems.slice(0, 5).map((item) => item.name).join("、")}${unusedActiveItems.length > 5 ? "等" : ""}。它们不会通过奖励抽取发放。`,
      entityType: "item",
      entityId: null,
      entityName: null,
    });
  }

  const blocking = issues.filter((issue) => issue.severity === "blocking").length;
  const warnings = issues.length - blocking;
  return {
    status: blocking > 0 ? "blocked" as const : warnings > 0 ? "warning" as const : "healthy" as const,
    summary: {
      checks: 5,
      passed: 5 - new Set(issues.map((issue) => issue.code)).size,
      blocking,
      warnings,
    },
    issues,
    checkedAt: new Date().toISOString(),
  };
}

export async function getAdminEquipmentOverview(executor: AdminEquipmentExecutor = db) {
  const [
    [itemCounts],
    [poolCounts],
    [rewardCounts],
    [fragmentTotals],
  ] = await Promise.all([
    executor
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${equipmentItems.isActive} = true)::int`,
        shop: sql<number>`count(*) filter (where ${equipmentItems.shopAvailable} = true and ${equipmentItems.isActive} = true)::int`,
      })
      .from(equipmentItems),
    executor
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${equipmentPools.isActive} = true)::int`,
      })
      .from(equipmentPools),
    executor
      .select({
        pending: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.status} = 'pending')::int`,
        resolved: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.status} = 'resolved')::int`,
      })
      .from(equipmentDrawEntitlements),
    executor
      .select({
        issued: sql<number>`coalesce(sum(case when ${equipmentFragmentLedger.delta} > 0 then ${equipmentFragmentLedger.delta} else 0 end), 0)::int`,
        spent: sql<number>`coalesce(abs(sum(case when ${equipmentFragmentLedger.delta} < 0 then ${equipmentFragmentLedger.delta} else 0 end)), 0)::int`,
      })
      .from(equipmentFragmentLedger),
  ]);

  return {
    items: {
      total: Number(itemCounts?.total ?? 0),
      active: Number(itemCounts?.active ?? 0),
      shop: Number(itemCounts?.shop ?? 0),
    },
    pools: {
      total: Number(poolCounts?.total ?? 0),
      active: Number(poolCounts?.active ?? 0),
    },
    rewards: {
      pending: Number(rewardCounts?.pending ?? 0),
      resolved: Number(rewardCounts?.resolved ?? 0),
      fragmentsIssued: Number(fragmentTotals?.issued ?? 0),
      fragmentsSpent: Number(fragmentTotals?.spent ?? 0),
    },
  };
}

export async function listAdminEquipmentItems(executor: AdminEquipmentExecutor = db) {
  return executor.select().from(equipmentItems).orderBy(equipmentItems.slot, equipmentItems.rarity, equipmentItems.name);
}

export async function createAdminEquipmentItem(
  values: typeof equipmentItems.$inferInsert,
  executor: AdminEquipmentExecutor = db,
) {
  const [created] = await executor.insert(equipmentItems).values(values).returning();
  return created;
}

export async function updateAdminEquipmentItem(
  itemId: string,
  values: Partial<typeof equipmentItems.$inferInsert>,
  executor: AdminEquipmentExecutor = db,
) {
  const [updated] = await executor
    .update(equipmentItems)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(equipmentItems.id, itemId))
    .returning();
  return updated;
}

export async function updateAdminEquipmentItemSafely(
  itemId: string,
  values: Partial<typeof equipmentItems.$inferInsert>,
) {
  return db.transaction(async (tx: any) => {
    const [current] = await tx.select().from(equipmentItems).where(eq(equipmentItems.id, itemId)).limit(1).for("update");
    if (!current) return undefined;

    if (values.isActive === false || (values.rarity && values.rarity !== current.rarity)) {
      const activePoolLinks = await tx
        .select({ poolId: equipmentPools.id, poolName: equipmentPools.name })
        .from(equipmentPoolItems)
        .innerJoin(equipmentPools, eq(equipmentPoolItems.poolId, equipmentPools.id))
        .where(and(
          eq(equipmentPoolItems.itemId, itemId),
          eq(equipmentPoolItems.isActive, true),
          eq(equipmentPools.isActive, true),
        ))
        .for("update");
      if (activePoolLinks.length > 0) {
        throw new AdminEquipmentRepositoryError(
          "EQUIPMENT_ITEM_IN_ACTIVE_POOL",
          `请先停用装备池「${activePoolLinks[0].poolName}」，再修改这件装备的状态或稀有度`,
        );
      }
    }

    const [updated] = await tx
      .update(equipmentItems)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(equipmentItems.id, itemId))
      .returning();
    return { before: current, updated };
  });
}

export async function listAdminEquipmentPools(executor: AdminEquipmentExecutor = db) {
  const [pools, poolItems] = await Promise.all([
    executor
      .select({
        id: equipmentPools.id,
        slug: equipmentPools.slug,
        name: equipmentPools.name,
        venueId: equipmentPools.venueId,
        venueName: venues.name,
        alangMissionId: equipmentPools.alangMissionId,
        alangMissionTitle: alangMissions.title,
        isActive: equipmentPools.isActive,
        createdAt: equipmentPools.createdAt,
        updatedAt: equipmentPools.updatedAt,
      })
      .from(equipmentPools)
      .leftJoin(venues, eq(equipmentPools.venueId, venues.id))
      .leftJoin(alangMissions, eq(equipmentPools.alangMissionId, alangMissions.id))
      .orderBy(equipmentPools.name),
    executor
      .select({
        id: equipmentPoolItems.id,
        poolId: equipmentPoolItems.poolId,
        itemId: equipmentPoolItems.itemId,
        weight: equipmentPoolItems.weight,
        isActive: equipmentPoolItems.isActive,
        itemName: equipmentItems.name,
        itemSlot: equipmentItems.slot,
        itemRarity: equipmentItems.rarity,
        itemIsActive: equipmentItems.isActive,
      })
      .from(equipmentPoolItems)
      .innerJoin(equipmentItems, eq(equipmentPoolItems.itemId, equipmentItems.id))
      .orderBy(equipmentItems.rarity, equipmentItems.name),
  ]);

  const itemsByPool = new Map<string, typeof poolItems>();
  for (const item of poolItems) {
    const current = itemsByPool.get(item.poolId) ?? [];
    current.push(item);
    itemsByPool.set(item.poolId, current);
  }
  return pools.map((pool: any) => ({ ...pool, items: itemsByPool.get(pool.id) ?? [] }));
}

export async function createAdminEquipmentPool(
  values: typeof equipmentPools.$inferInsert,
  executor: AdminEquipmentExecutor = db,
) {
  const [created] = await executor.insert(equipmentPools).values(values).returning();
  return created;
}

export async function updateAdminEquipmentPool(
  poolId: string,
  values: Partial<typeof equipmentPools.$inferInsert>,
  executor: AdminEquipmentExecutor = db,
) {
  const [updated] = await executor
    .update(equipmentPools)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(equipmentPools.id, poolId))
    .returning();
  return updated;
}

export async function updateAdminEquipmentPoolSafely(
  poolId: string,
  values: Partial<typeof equipmentPools.$inferInsert>,
) {
  return db.transaction(async (tx: any) => {
    const [current] = await tx.select().from(equipmentPools).where(eq(equipmentPools.id, poolId)).limit(1).for("update");
    if (!current) return undefined;

    if (values.isActive === true && !current.isActive) {
      const members = await tx
        .select({
          rarity: equipmentItems.rarity,
          isActive: equipmentPoolItems.isActive,
          itemIsActive: equipmentItems.isActive,
        })
        .from(equipmentPoolItems)
        .innerJoin(equipmentItems, eq(equipmentPoolItems.itemId, equipmentItems.id))
        .where(eq(equipmentPoolItems.poolId, poolId))
        .for("update");
      const launchItems = members.map((item: any) => ({
        rarity: item.rarity,
        isActive: item.isActive && item.itemIsActive,
      }));
      if (!hasLaunchReadyAdminEquipmentPool(launchItems)) {
        throw new AdminEquipmentRepositoryError(
          "EQUIPMENT_POOL_NOT_READY",
          "启用前必须配置 4 件可用普通装备和 2 件可用稀有装备",
        );
      }
    }

    const [updated] = await tx
      .update(equipmentPools)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(equipmentPools.id, poolId))
      .returning();
    return { before: current, updated };
  });
}

export async function replaceAdminEquipmentPoolItems(
  poolId: string,
  items: Array<{ itemId: string; weight: number; isActive: boolean }>,
) {
  return db.transaction(async (tx: any) => {
    const [pool] = await tx.select().from(equipmentPools).where(eq(equipmentPools.id, poolId)).limit(1).for("update");
    if (!pool) return undefined;

    const before = await tx
      .select({
        itemId: equipmentPoolItems.itemId,
        weight: equipmentPoolItems.weight,
        isActive: equipmentPoolItems.isActive,
        rarity: equipmentItems.rarity,
      })
      .from(equipmentPoolItems)
      .innerJoin(equipmentItems, eq(equipmentPoolItems.itemId, equipmentItems.id))
      .where(eq(equipmentPoolItems.poolId, poolId))
      .for("update");
    const requestedIds = items.map((item) => item.itemId);
    const requestedItems = requestedIds.length === 0
      ? []
      : await tx
          .select({ id: equipmentItems.id, rarity: equipmentItems.rarity, isActive: equipmentItems.isActive })
          .from(equipmentItems)
          .where(inArray(equipmentItems.id, requestedIds))
          .for("update");
    if (requestedItems.length !== new Set(requestedIds).size) {
      throw new AdminEquipmentRepositoryError("EQUIPMENT_POOL_ITEM_NOT_FOUND", "装备池包含不存在的装备");
    }
    const itemById = new Map<string, any>(requestedItems.map((item: any) => [item.id, item]));
    const after = items.map((item) => ({
      ...item,
      rarity: itemById.get(item.itemId)?.rarity,
      itemIsActive: itemById.get(item.itemId)?.isActive,
    }));
    if (pool.isActive && !hasLaunchReadyAdminEquipmentPool(after.map((item) => ({
      rarity: item.rarity,
      isActive: item.isActive && item.itemIsActive,
    })))) {
      throw new AdminEquipmentRepositoryError(
        "EQUIPMENT_POOL_NOT_READY",
        "已启用装备池必须始终保持 4 件可用普通装备和 2 件可用稀有装备",
      );
    }

    await tx.delete(equipmentPoolItems).where(eq(equipmentPoolItems.poolId, poolId));
    if (items.length > 0) {
      await tx.insert(equipmentPoolItems).values(items.map((item) => ({ ...item, poolId })));
    }
    await tx.update(equipmentPools).set({ updatedAt: new Date() }).where(eq(equipmentPools.id, poolId));
    return { pool, before, after };
  });
}

export async function listAdminEquipmentRewardActivity(
  limit = 50,
  executor: AdminEquipmentExecutor = db,
) {
  const entitlements = await executor
    .select({
      id: equipmentDrawEntitlements.id,
      sourceType: equipmentDrawEntitlements.sourceType,
      sourceRecordId: equipmentDrawEntitlements.sourceRecordId,
      poolId: equipmentDrawEntitlements.poolId,
      poolName: equipmentPools.name,
      status: equipmentDrawEntitlements.status,
      resultKind: equipmentDrawEntitlements.resultKind,
      fragmentsAwarded: equipmentDrawEntitlements.fragmentsAwarded,
      pityBefore: equipmentDrawEntitlements.pityBefore,
      pityAfter: equipmentDrawEntitlements.pityAfter,
      drawVersion: equipmentDrawEntitlements.drawVersion,
      createdAt: equipmentDrawEntitlements.createdAt,
      resolvedAt: equipmentDrawEntitlements.resolvedAt,
    })
    .from(equipmentDrawEntitlements)
    .innerJoin(equipmentPools, eq(equipmentDrawEntitlements.poolId, equipmentPools.id))
    .orderBy(desc(equipmentDrawEntitlements.createdAt))
    .limit(limit);

  return { entitlements };
}

export async function getAdminEquipmentAnalytics(
  days: 7 | 30 | 90,
  executor: AdminEquipmentExecutor = db,
) {
  const now = new Date();
  const shanghaiNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const end = new Date(Date.UTC(
    shanghaiNow.getUTCFullYear(),
    shanghaiNow.getUTCMonth(),
    shanghaiNow.getUTCDate() + 1,
  ) - 8 * 60 * 60 * 1000);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);

  const [summaryRows, sourceRows, dailyRows, poolRows] = await Promise.all([
    executor
      .select({
        total: count(),
        pending: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.status} = 'pending')::int`,
        resolved: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.status} = 'resolved')::int`,
        newItems: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.resultKind} = 'new')::int`,
        duplicates: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.resultKind} = 'duplicate')::int`,
        fragmentsAwarded: sql<number>`coalesce(sum(${equipmentDrawEntitlements.fragmentsAwarded}), 0)::int`,
        guaranteed: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.drawVersion} like '%:guaranteed')::int`,
      })
      .from(equipmentDrawEntitlements)
      .where(and(
        sql`${equipmentDrawEntitlements.createdAt} >= ${start}`,
        sql`${equipmentDrawEntitlements.createdAt} < ${end}`,
      )),
    executor
      .select({
        sourceType: equipmentDrawEntitlements.sourceType,
        total: count(),
        resolved: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.status} = 'resolved')::int`,
      })
      .from(equipmentDrawEntitlements)
      .where(and(
        sql`${equipmentDrawEntitlements.createdAt} >= ${start}`,
        sql`${equipmentDrawEntitlements.createdAt} < ${end}`,
      ))
      .groupBy(equipmentDrawEntitlements.sourceType)
      .orderBy(equipmentDrawEntitlements.sourceType),
    executor
      .select({
        date: sql<string>`to_char(date_trunc('day', ${equipmentDrawEntitlements.createdAt} + interval '8 hours'), 'YYYY-MM-DD')`,
        total: count(),
        resolved: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.status} = 'resolved')::int`,
        newItems: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.resultKind} = 'new')::int`,
        duplicates: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.resultKind} = 'duplicate')::int`,
        fragmentsAwarded: sql<number>`coalesce(sum(${equipmentDrawEntitlements.fragmentsAwarded}), 0)::int`,
      })
      .from(equipmentDrawEntitlements)
      .where(and(
        sql`${equipmentDrawEntitlements.createdAt} >= ${start}`,
        sql`${equipmentDrawEntitlements.createdAt} < ${end}`,
      ))
      .groupBy(sql`date_trunc('day', ${equipmentDrawEntitlements.createdAt} + interval '8 hours')`)
      .orderBy(sql`date_trunc('day', ${equipmentDrawEntitlements.createdAt} + interval '8 hours')`),
    executor
      .select({
        poolId: equipmentPools.id,
        poolName: equipmentPools.name,
        total: count(),
        resolved: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.status} = 'resolved')::int`,
        newItems: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.resultKind} = 'new')::int`,
        duplicates: sql<number>`count(*) filter (where ${equipmentDrawEntitlements.resultKind} = 'duplicate')::int`,
        fragmentsAwarded: sql<number>`coalesce(sum(${equipmentDrawEntitlements.fragmentsAwarded}), 0)::int`,
      })
      .from(equipmentDrawEntitlements)
      .innerJoin(equipmentPools, eq(equipmentDrawEntitlements.poolId, equipmentPools.id))
      .where(and(
        sql`${equipmentDrawEntitlements.createdAt} >= ${start}`,
        sql`${equipmentDrawEntitlements.createdAt} < ${end}`,
      ))
      .groupBy(equipmentPools.id, equipmentPools.name)
      .orderBy(sql`count(*) desc`)
      .limit(20),
  ]);

  const summary = summaryRows[0] ?? {
    total: 0,
    pending: 0,
    resolved: 0,
    newItems: 0,
    duplicates: 0,
    fragmentsAwarded: 0,
    guaranteed: 0,
  };
  const total = Number(summary.total ?? 0);
  const resolved = Number(summary.resolved ?? 0);
  const newItems = Number(summary.newItems ?? 0);
  const rates = calculateEquipmentAnalyticsRates({ total, resolved, newItems });

  return {
    window: {
      days,
      start: start.toISOString(),
      end: end.toISOString(),
      basis: "entitlement_created_at" as const,
      timezone: "Asia/Shanghai" as const,
    },
    summary: {
      total,
      pending: Number(summary.pending ?? 0),
      resolved,
      newItems,
      duplicates: Number(summary.duplicates ?? 0),
      fragmentsAwarded: Number(summary.fragmentsAwarded ?? 0),
      guaranteed: Number(summary.guaranteed ?? 0),
      ...rates,
    },
    sources: sourceRows.map((row: any) => ({
      sourceType: row.sourceType,
      total: Number(row.total ?? 0),
      resolved: Number(row.resolved ?? 0),
    })),
    daily: dailyRows.map((row: any) => ({
      date: row.date,
      total: Number(row.total ?? 0),
      resolved: Number(row.resolved ?? 0),
      newItems: Number(row.newItems ?? 0),
      duplicates: Number(row.duplicates ?? 0),
      fragmentsAwarded: Number(row.fragmentsAwarded ?? 0),
    })),
    pools: poolRows.map((row: any) => ({
      poolId: row.poolId,
      poolName: row.poolName,
      total: Number(row.total ?? 0),
      resolved: Number(row.resolved ?? 0),
      newItems: Number(row.newItems ?? 0),
      duplicates: Number(row.duplicates ?? 0),
      fragmentsAwarded: Number(row.fragmentsAwarded ?? 0),
    })),
  };
}

export function calculateEquipmentAnalyticsRates(input: {
  total: number;
  resolved: number;
  newItems: number;
}) {
  return {
    claimRate: input.total > 0 ? input.resolved / input.total : 0,
    newItemRate: input.resolved > 0 ? input.newItems / input.resolved : 0,
  };
}

export async function listAdminEquipmentPoolSources(executor: AdminEquipmentExecutor = db) {
  const [venueRows, missionRows] = await Promise.all([
    executor
      .select({ id: venues.id, name: venues.name, city: venues.city, area: venues.area })
      .from(venues)
      .where(eq(venues.isActive, true))
      .orderBy(venues.name),
    executor
      .select({ id: alangMissions.id, title: alangMissions.title, slug: alangMissions.slug, status: alangMissions.status })
      .from(alangMissions)
      .where(and(eq(alangMissions.status, "published"), eq(alangMissions.isInternalOnly, false)))
      .orderBy(alangMissions.title),
  ]);
  return { venues: venueRows, missions: missionRows };
}
