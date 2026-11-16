import { db } from "../db";
import { venueDeals, eventPools, venues, type VenueDeal } from "@shared/schema";
import type { VenueDealSummary } from "@shared/api/eventPools";
import { and, eq, desc } from "drizzle-orm";
import { buildEligibleVenueConditions } from "../lib/venueEligibility";
import {
  isRedeemableVenueDeal,
  selectRedeemableVenueDeal,
  toVenueDealSummary,
} from "../lib/venueDealVisibility";

/**
 * S1 场地权益持久化（Drizzle / camelCase）。
 * 旧 venuesRepo 的 raw-SQL 版本返回 snake_case，公共只读路由仍在用，本切片不动它；
 * 后台 deals 的 GET/POST/PATCH/DELETE 全部走这里。
 */

export async function listVenueDeals(venueId: string): Promise<VenueDeal[]> {
  return db
    .select()
    .from(venueDeals)
    .where(eq(venueDeals.venueId, venueId))
    .orderBy(desc(venueDeals.createdAt));
}

export async function getVenueDealById(id: string): Promise<VenueDeal | undefined> {
  const [row] = await db.select().from(venueDeals).where(eq(venueDeals.id, id)).limit(1);
  return row;
}

export type VenueDealInsert = typeof venueDeals.$inferInsert;

export async function createVenueDeal(data: VenueDealInsert): Promise<VenueDeal> {
  const [row] = await db.insert(venueDeals).values(data).returning();
  return row;
}

export type VenueDealPatch = Partial<VenueDealInsert>;

/**
 * 「读 → 合并 → 校验 → 写」必须在同一事务内并锁定该行，
 * 否则两个并发 PATCH 能各自通过校验、留下 originalPrice <= price 的组合。
 * 回调返回 null 表示放弃写入（路由已自行响应 4xx）。
 */
export async function updateVenueDealWithLock<T>(
  id: string,
  fn: (
    existing: VenueDeal,
    write: (patch: VenueDealPatch) => Promise<VenueDeal>,
  ) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx: any) => {
    const [existing] = await tx
      .select()
      .from(venueDeals)
      .where(eq(venueDeals.id, id))
      .limit(1)
      .for("update");

    if (!existing) {
      throw new VenueDealNotFoundError(id);
    }

    const write = async (patch: VenueDealPatch): Promise<VenueDeal> => {
      const [row] = await tx
        .update(venueDeals)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(venueDeals.id, id))
        .returning();
      return row;
    };

    return fn(existing, write);
  });
}

export class VenueDealNotFoundError extends Error {
  constructor(id: string) {
    super(`Venue deal not found: ${id}`);
    this.name = "VenueDealNotFoundError";
  }
}

export interface BoundPoolRef {
  id: string;
  title: string;
  dateTime: Date;
}

/** 被池级保底引用的权益不能静默删除或停用（S1 AC-03/AC-09）。 */
export async function listPoolsBoundToDeal(dealId: string): Promise<BoundPoolRef[]> {
  return db
    .select({ id: eventPools.id, title: eventPools.title, dateTime: eventPools.dateTime })
    .from(eventPools)
    .where(eq(eventPools.guaranteedDealId, dealId));
}

export async function deleteVenueDeal(id: string): Promise<void> {
  await db.delete(venueDeals).where(eq(venueDeals.id, id));
}

// ────────────────────────────────────────────────────────────────────────────
// S2：池级保底读取 / 可兑现权益装配
// ────────────────────────────────────────────────────────────────────────────

export interface PoolGuaranteeRef {
  guaranteedVenueId: string | null;
  guaranteedDealId: string | null;
}

/** 分配器每次 run 按 poolId 读一次（禁止逐 group 查询）。 */
export async function getPoolGuarantee(poolId: string): Promise<PoolGuaranteeRef | undefined> {
  const [row] = await db
    .select({
      guaranteedVenueId: eventPools.guaranteedVenueId,
      guaranteedDealId: eventPools.guaranteedDealId,
    })
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1);
  return row;
}

/**
 * 保底门店必须与自动分配共用同一份目录资格（含 onboarding/partner/合同/区域/类型），
 * 否则 hasGuaranteedDeal 会为「根本不可能分配的门店」返回 true。
 */
export async function getEligibleGuaranteedVenue(input: {
  venueId: string;
  city: string;
  district: string | null;
  eventType: string;
}): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: venues.id })
    .from(venues)
    .where(
      and(
        buildEligibleVenueConditions(input.city, input.district, input.eventType),
        eq(venues.id, input.venueId),
      ),
    )
    .limit(1);
  return row;
}

/** D7：客户端只看这个布尔，不得自行推断保底。 */
export async function computeHasGuaranteedDeal(pool: {
  guaranteedVenueId: string | null;
  guaranteedDealId: string | null;
  city: string;
  district: string | null;
  eventType: string;
}): Promise<boolean> {
  if (!pool.guaranteedVenueId || !pool.guaranteedDealId) return false;
  const [venue, deal] = await Promise.all([
    getEligibleGuaranteedVenue({
      venueId: pool.guaranteedVenueId,
      city: pool.city,
      district: pool.district,
      eventType: pool.eventType,
    }),
    getVenueDealById(pool.guaranteedDealId),
  ]);
  if (!venue || !deal) return false;
  if (deal.venueId !== pool.guaranteedVenueId) return false;
  return isRedeemableVenueDeal(deal);
}

/**
 * D5/D6：小组详情的唯一一张可兑现权益。
 * - 未 assigned / 无门店 → null；
 * - 保底池：只认 guaranteedDealId 那一张，且实际门店必须等于保底门店；失效即 null，绝不换另一张；
 * - 非保底池：该门店可兑现现代权益中 createdAt 最新一张。
 */
export async function getGroupVenueDeal(input: {
  venueId: string | null;
  venueName: string | null;
  assignmentStatus: string | null;
  poolGuaranteedVenueId: string | null;
  poolGuaranteedDealId: string | null;
}): Promise<VenueDealSummary | null> {
  if (input.assignmentStatus !== "assigned" || !input.venueId) return null;
  const venueName = input.venueName ?? "";

  // 任一保底字段存在即视为保底池（D2/D6）：部分绑定属于配置损坏，
  // 绝不能落入「该店最新可兑现权益」分支换一张券发给用户。
  if (input.poolGuaranteedVenueId || input.poolGuaranteedDealId) {
    if (!input.poolGuaranteedVenueId || !input.poolGuaranteedDealId) return null;
    if (input.poolGuaranteedVenueId !== input.venueId) return null;
    const deal = await getVenueDealById(input.poolGuaranteedDealId);
    if (!deal || deal.venueId !== input.venueId || !isRedeemableVenueDeal(deal)) return null;
    return toVenueDealSummary(deal, venueName);
  }

  const deals = await listVenueDeals(input.venueId);
  const selected = selectRedeemableVenueDeal(deals);
  return selected ? toVenueDealSummary(selected, venueName) : null;
}
