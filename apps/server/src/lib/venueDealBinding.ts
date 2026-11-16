import { db } from "../db";
import { venues, venueDeals } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import type { AdminVenueDealUpdateInput } from "@shared/schema";
import { buildEligibleVenueConditions } from "./venueEligibility";
import { isRedeemableVenueDeal } from "./venueDealVisibility";

/**
 * S1 池级保底绑定（方案 B）：建池即锁定场地与权益。
 * POST 与 PATCH /api/admin/event-pools 共用此校验；PATCH 必须先合并既有池再调用。
 */
export interface PoolDealBindingInput {
  guaranteedVenueId?: string | null;
  guaranteedDealId?: string | null;
  /** 合并后的池城市 / 区域 / 活动类型；目录资格必须与 S2 分配器一致 */
  city: string;
  district?: string | null;
  eventType?: string;
}

export type PoolDealBindingResult =
  | { ok: true; venueId: null; dealId: null }
  | { ok: true; venueId: string; dealId: string }
  | { ok: false; code: string; message: string };

export async function resolvePoolDealBinding(
  input: PoolDealBindingInput,
): Promise<PoolDealBindingResult> {
  const venueId = input.guaranteedVenueId ?? null;
  const dealId = input.guaranteedDealId ?? null;

  if (!venueId && !dealId) return { ok: true, venueId: null, dealId: null };
  if (!venueId || !dealId) {
    return {
      ok: false,
      code: "GUARANTEE_BINDING_INCOMPLETE",
      message: "保底场地与保底权益必须同时选择，或同时清空",
    };
  }

  // 与分配器共用完整目录资格：城市、区域、onboarding/partner/合同、活动类型。
  // 不允许后台保存一个运行期必然 guaranteed_*_unavailable 的保底配置。
  const [venue] = await db
    .select()
    .from(venues)
    .where(and(
      buildEligibleVenueConditions(input.city, input.district ?? null, input.eventType ?? "饭局"),
      eq(venues.id, venueId),
    ))
    .limit(1);
  if (!venue || venue.isActive !== true) {
    return { ok: false, code: "GUARANTEE_VENUE_UNAVAILABLE", message: "保底场地不符合本池的城市、区域、合作状态或活动类型要求" };
  }
  // 保留更具体的跨城错误，兼容既有后台提示与测试；其余资格由上方同一目录条件保证。
  if (venue.city !== input.city) {
    return {
      ok: false,
      code: "GUARANTEE_VENUE_CITY_MISMATCH",
      message: `保底场地位于${venue.city}，与本池城市（${input.city}）不一致`,
    };
  }

  const [deal] = await db.select().from(venueDeals).where(eq(venueDeals.id, dealId)).limit(1);
  if (!deal || !isRedeemableVenueDeal(deal)) {
    return { ok: false, code: "GUARANTEE_DEAL_UNAVAILABLE", message: "保底权益不存在、已停用或当前不可兑现" };
  }
  if (deal.venueId !== venueId) {
    return {
      ok: false,
      code: "GUARANTEE_DEAL_VENUE_MISMATCH",
      message: "保底权益不属于所选场地，请重新选择",
    };
  }

  return { ok: true, venueId, dealId };
}

// ---------------------------------------------------------------------------
// S1 PATCH 判定（纯函数，供路由与单测共用）
// ---------------------------------------------------------------------------

export const VENUE_DEAL_CORE_KEYS = [
  "title",
  "description",
  "discountType",
  "discountValue",
  "setMenuPriceCents",
  "setMenuOriginalPriceCents",
  "redemptionMethod",
  "redemptionCode",
] as const;

export const VENUE_DEAL_LEGACY_EDITABLE_KEYS = ["isActive", "title", "description"] as const;

export type VenueDealPatchPlan =
  | { kind: "noop" }
  | { kind: "legacy_readonly"; illegalKeys: string[] }
  | { kind: "validate" }
  | { kind: "write" };

/**
 * legacy 行（fixed/gift/qr_code）只允许改 isActive/title/description；
 * 现代行只有触及核心业务字段才需要合并后整体校验；
 * isActive-only 对任意行都可写（已绑定停用确认由路由单独处理）。
 */
export function planVenueDealPatch(
  existing: { discountType: string },
  updates: Partial<AdminVenueDealUpdateInput>,
): VenueDealPatchPlan {
  const keys = Object.keys(updates).filter(
    (key) => updates[key as keyof typeof updates] !== undefined,
  );
  if (keys.length === 0) return { kind: "noop" };

  const isModern = existing.discountType === "percentage" || existing.discountType === "set_menu";
  if (!isModern) {
    const illegalKeys = keys.filter(
      (key) => !(VENUE_DEAL_LEGACY_EDITABLE_KEYS as readonly string[]).includes(key),
    );
    if (illegalKeys.length > 0) return { kind: "legacy_readonly", illegalKeys };
    return { kind: "write" };
  }

  return keys.some((key) => (VENUE_DEAL_CORE_KEYS as readonly string[]).includes(key))
    ? { kind: "validate" }
    : { kind: "write" };
}

/** 把既有行与 PATCH 合并成创建 schema 的输入；显式 null 表示清除该字段。 */
export function buildMergedVenueDeal(
  existing: Record<string, any>,
  updates: Partial<AdminVenueDealUpdateInput>,
): Record<string, unknown> {
  const merge = (key: string) =>
    updates[key as keyof typeof updates] !== undefined
      ? updates[key as keyof typeof updates] ?? undefined
      : existing[key] ?? undefined;

  return {
    venueId: existing.venueId,
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description ?? "",
    discountType: updates.discountType ?? existing.discountType,
    discountValue: merge("discountValue"),
    setMenuPriceCents: merge("setMenuPriceCents"),
    setMenuOriginalPriceCents: merge("setMenuOriginalPriceCents"),
    redemptionMethod: updates.redemptionMethod ?? existing.redemptionMethod,
    redemptionCode: merge("redemptionCode"),
  };
}

/**
 * 停用保护（合同 AC-09）：已绑定权益停用必须 confirmDeactivate。
 * 抽成纯函数以便覆盖「legacy + 已绑定 + 确认停用」等组合，路由只负责取绑定池列表。
 */
export type VenueDealDeactivationPlan =
  | { kind: "ok"; affectedPoolIds: string[] }
  | {
      kind: "confirm_required";
      affectedPools: Array<{ id: string; title: string; dateTime?: unknown }>;
    };

export function planVenueDealDeactivation(
  existing: { isActive: boolean | null },
  updates: { isActive?: boolean },
  boundPools: Array<{ id: string; title: string; dateTime?: unknown }>,
  confirmDeactivate: boolean,
): VenueDealDeactivationPlan {
  if (updates.isActive !== false || !existing.isActive) {
    return { kind: "ok", affectedPoolIds: [] };
  }
  if (boundPools.length > 0 && !confirmDeactivate) {
    return { kind: "confirm_required", affectedPools: boundPools };
  }
  return { kind: "ok", affectedPoolIds: boundPools.map((pool) => pool.id) };
}

export interface PoolBindingRef {
  guaranteedVenueId?: string | null;
  guaranteedDealId?: string | null;
}

export type PoolBindingChangeType = "bind" | "rebind" | "unbind" | "none";

/**
 * 绑定变更的审计载荷：before/after 都保留，解绑不是「没有 after」而是 before 有值。
 * 仅修改城市等未触及绑定字段的更新不应走到这里（路由以 bindingFieldsTouched 为门槛）。
 */
/** 成局后保底绑定即成为用户承诺，换绑/解绑必须锁定；同值提交不算变更。 */
export function isPoolGuaranteeChangeLocked(
  pool: { matchedAt?: Date | string | null },
  changeType: "bind" | "rebind" | "unbind" | "none",
): boolean {
  return Boolean(pool.matchedAt) && changeType !== "none";
}

export function describePoolBindingChange(previous: PoolBindingRef, next: PoolBindingRef): {
  type: PoolBindingChangeType;
  before: { guaranteedVenueId: string | null; guaranteedDealId: string | null };
  after: { guaranteedVenueId: string | null; guaranteedDealId: string | null };
} {
  const before = {
    guaranteedVenueId: previous.guaranteedVenueId ?? null,
    guaranteedDealId: previous.guaranteedDealId ?? null,
  };
  const after = {
    guaranteedVenueId: next.guaranteedVenueId ?? null,
    guaranteedDealId: next.guaranteedDealId ?? null,
  };
  const unchanged =
    before.guaranteedVenueId === after.guaranteedVenueId &&
    before.guaranteedDealId === after.guaranteedDealId;
  const wasBound = Boolean(before.guaranteedVenueId && before.guaranteedDealId);
  const isBound = Boolean(after.guaranteedVenueId && after.guaranteedDealId);

  const type: PoolBindingChangeType = unchanged
    ? "none"
    : isBound
      ? wasBound
        ? "rebind"
        : "bind"
      : "unbind";

  return { type, before, after };
}
