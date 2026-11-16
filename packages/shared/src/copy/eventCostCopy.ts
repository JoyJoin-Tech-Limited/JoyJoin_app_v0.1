import { BUDGET_TIER_BY_ID, type BudgetEventType } from '../budgetTiers';

export const COST_BLOCK_TITLE = '今晚的费用';
export const COST_ROW_TICKET = '报名费';
export const COST_ROW_PURCHASE = '本次购买';
export const COST_ACTION_PURCHASE = '本次实付';
export const COST_ROW_TICKET_HINT = '组织、排桌、多环节破冰';
export const COST_ROW_ONSITE = '到店自付 · 按你选的预算';
export const COST_BUDGET_ATTRIBUTION = '按你选的预算';
export const COST_ROW_ONSITE_HINT = '现场酒水，同桌 AA，含无酒精特调';
export const COST_ROW_ONSITE_HINT_DINING = '现场餐食，同桌 AA';
export const COST_TOTAL_LABEL = '今晚大约';
export const COST_TOTAL_SUFFIX = '报名费已在内';
export const COST_TOTAL_SUFFIX_PLAN = '本场无需再付报名费';
export const COST_INCLUDED_IN_PLAN = '已含在权益里';
export const COST_ROW_ONSITE_UNKNOWN = '到店自付';
export const COST_ONSITE_UNKNOWN = '现场 AA';
export const COST_ONSITE_MENU_NOTE = '具体金额以门店菜单为准';
export const COST_SHEET_LINK = '费用怎么算 ›';

export const COST_SHEET_TITLE = '今晚的费用';
export const COST_SHEET_SUBTITLE = '一笔报名费，一笔到店自付，没有第三笔。';
export const COST_SHEET_EXCLUDED_TITLE = '不包含在报名费里';
export const COST_SHEET_CURRENT_BUDGET = '本场到店预算';
export const COST_SHEET_PHASE_NOTE = '具体环节会由悦仔根据成桌人数和现场氛围灵活组合';
export const COST_SHEET_VENUE_NOTE = '具体场地在排桌后公布，到店消费以门店菜单为准';

interface BudgetBounds {
  eventType: BudgetEventType;
  minCents: number | null;
  maxCents: number;
}

function resolveBudgetBounds(tierIds: readonly string[]): BudgetBounds | null {
  if (!Array.isArray(tierIds) || tierIds.length === 0) return null;

  let eventType: BudgetEventType | null = null;
  let minCents: number | null | undefined;
  let maxCents: number | undefined;
  const seen = new Set<string>();

  for (const id of tierIds) {
    if (seen.has(id)) continue;
    seen.add(id);

    const tier = BUDGET_TIER_BY_ID.get(id);
    if (
      !tier ||
      tier.unit !== 'per_person' ||
      typeof tier.max !== 'number' ||
      !Number.isFinite(tier.max) ||
      (tier.min !== null && (typeof tier.min !== 'number' || !Number.isFinite(tier.min)))
    ) {
      return null;
    }
    if (eventType !== null && eventType !== tier.eventType) return null;
    eventType = tier.eventType;

    // Registry values are yuan; convert to integer cents exactly once here.
    const tierMaxCents = tier.max * 100;
    maxCents = maxCents === undefined ? tierMaxCents : Math.max(maxCents, tierMaxCents);

    if (tier.min === null) {
      minCents = null;
    } else if (minCents === undefined) {
      minCents = tier.min * 100;
    } else if (minCents !== null) {
      minCents = Math.min(minCents, tier.min * 100);
    }
  }

  if (eventType === null || minCents === undefined || maxCents === undefined) return null;
  return { eventType, minCents, maxCents };
}

function formatCents(cents: number): string {
  const yuan = Math.floor(cents / 100);
  const remainder = cents % 100;
  return remainder === 0
    ? `¥${yuan}`
    : `¥${yuan}.${String(remainder).padStart(2, '0')}`;
}

function formatBudgetWithBase(bounds: BudgetBounds, baseCents: number): string {
  const upperCents = baseCents + bounds.maxCents;
  if (bounds.minCents === null) return `${formatCents(upperCents)} 以内 / 人`;

  const lowerCents = baseCents + bounds.minCents;
  if (lowerCents === upperCents) return `${formatCents(lowerCents)} / 人`;
  return `${formatCents(lowerCents)}–${formatCents(upperCents).slice(1)} / 人`;
}

export function formatOnSiteBudget(tierIds: readonly string[]): string | null {
  const bounds = resolveBudgetBounds(tierIds);
  return bounds ? formatBudgetWithBase(bounds, 0) : null;
}

export function formatTonightTotal(paidCents: number, tierIds: readonly string[]): string | null {
  if (!Number.isSafeInteger(paidCents) || paidCents < 0) return null;
  const bounds = resolveBudgetBounds(tierIds);
  return bounds ? formatBudgetWithBase(bounds, paidCents) : null;
}
