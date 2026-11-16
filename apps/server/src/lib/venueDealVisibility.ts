import type { VenueDeal } from "@shared/schema";
import type { VenueDealSummary } from "@shared/api/eventPools";

/**
 * 「用户可兑现权益」的唯一判定与映射（venue-deal S2，合同 D4）。
 *
 * 为什么必须只有一个入口：分配器（不成局）、小组 DTO（展示哪张券）、
 * 池详情（hasGuaranteedDeal）如果各写一份过滤，就会出现「承诺了但装配不出」
 * 或「把最新一张停用权益发给用户」的分叉。所有调用点都必须走这里。
 *
 * 判定自身即包含 isActive —— listVenueDeals 会返回停用行，调用方不得再各自补条件。
 */

const REDEEMABLE_METHODS = new Set(["show_page", "code"]);

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function hasValidCode(deal: VenueDeal): boolean {
  if (deal.redemptionMethod !== "code") return true;
  const code = deal.redemptionCode?.trim() ?? "";
  return code.length >= 2 && code.length <= 8;
}

export function isRedeemableVenueDeal(deal: VenueDeal | null | undefined): deal is VenueDeal {
  if (!deal || deal.isActive !== true) return false;
  if (!REDEEMABLE_METHODS.has(deal.redemptionMethod ?? "")) return false;

  if (deal.discountType === "percentage") {
    return (
      isPositiveInt(deal.discountValue) &&
      deal.discountValue <= 90 &&
      hasValidCode(deal)
    );
  }

  if (deal.discountType === "set_menu") {
    // 套餐只有「把这一页递给店员」，没有暗号形态（设计稿 v2 定案）
    if (deal.redemptionMethod !== "show_page") return false;
    return (
      isPositiveInt(deal.setMenuPriceCents) &&
      isPositiveInt(deal.setMenuOriginalPriceCents) &&
      deal.setMenuOriginalPriceCents > deal.setMenuPriceCents
    );
  }

  // fixed / gift / qr_code 等 legacy 形态：用户端无法表达，一律不可兑现
  return false;
}

/**
 * 统一选择入口：先过滤可兑现，再取 createdAt 最新一张。
 * 较新的停用/legacy 权益必须被跳过；全部不可用返回 null。
 */
export function selectRedeemableVenueDeal(
  deals: ReadonlyArray<VenueDeal> | null | undefined,
): VenueDeal | null {
  if (!deals || deals.length === 0) return null;
  const redeemable = deals.filter(isRedeemableVenueDeal);
  if (redeemable.length === 0) return null;
  return [...redeemable].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  })[0];
}

/** DB 行 → 用户端 DTO。valueOffPercent 直接拷贝 discountValue（20 = 8 折），不做 100-x。 */
export function toVenueDealSummary(deal: VenueDeal, venueName: string): VenueDealSummary {
  const isSetMenu = deal.discountType === "set_menu";
  const method = deal.redemptionMethod === "code" ? "code" : "show_page";
  return {
    id: deal.id,
    kind: isSetMenu ? "set_menu" : "discount",
    ...(deal.discountType === "percentage" && isPositiveInt(deal.discountValue)
      ? { valueOffPercent: deal.discountValue }
      : {}),
    ...(isSetMenu
      ? {
          setMenuPriceCents: deal.setMenuPriceCents ?? undefined,
          setMenuOriginalPriceCents: deal.setMenuOriginalPriceCents ?? undefined,
        }
      : {}),
    title: deal.title,
    description: deal.description ?? null,
    method,
    ...(method === "code" && deal.redemptionCode ? { code: deal.redemptionCode } : {}),
    venueName,
  };
}

/**
 * 公开（无鉴权）路由脱敏：暗号属于「同桌成员凭证」，不能出现在公开目录里。
 * 这些路由历史上 SELECT * 直出，redemption_code 一直随响应泄露。
 * 成员专属的 pool-group DTO 不经过这里。
 */
export function sanitizePublicVenueDeal<T extends Record<string, any>>(row: T): T {
  const clone: Record<string, any> = { ...row };
  delete clone.redemptionCode;
  delete clone.redemption_code;
  return clone as T;
}

export function sanitizePublicVenueDeals<T extends Record<string, any>>(rows: ReadonlyArray<T>): T[] {
  return (rows ?? []).map(sanitizePublicVenueDeal);
}
