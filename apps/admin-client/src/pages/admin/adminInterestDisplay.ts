import {
  INTEREST_HEAT_BY_LEVEL,
  INTEREST_LEVEL_LABELS,
  MACRO_CATEGORY_LABELS,
  MACRO_CATEGORY_ORDER,
  type InterestLevel,
  type MacroCategory,
} from "@shared/interests";
import type { UserInterests } from "./types";

/**
 * Read-only projection of `user_interests` for the admin user-detail drawer.
 *
 * The stored row is the onboarding payload: `selections[]` carries the level
 * tier and its heat (1 → 3, 2 → 10, 3 → 25, see INTEREST_HEAT_BY_LEVEL) and
 * `categoryHeat` is a macro-id rollup. Operators need the per-interest tier,
 * so this module rebuilds the grouped view from `selections` instead of
 * trusting the level-3-only `topPriorities` slice.
 */

export interface AdminInterestRow {
  topicId: string;
  label: string;
  categoryId: string;
  categoryLabel: string;
  level: number;
  levelLabel: string;
  heat: number;
}

export interface AdminInterestCategoryRow {
  categoryId: string;
  label: string;
  selectionCount: number;
  heat: number;
  /** Bar width 0–100, normalised to the strongest category (not the total). */
  strengthPercent: number;
}

export interface AdminInterestView {
  totalSelections: number;
  totalHeat: number;
  categoryCount: number;
  rows: AdminInterestRow[];
  categories: AdminInterestCategoryRow[];
}

const MACRO_IDS = new Set<string>(MACRO_CATEGORY_ORDER);

function isMacroCategory(value: string): value is MacroCategory {
  return MACRO_IDS.has(value);
}

function normalizeLevel(level: number | undefined): InterestLevel {
  return level === 2 || level === 3 ? level : 1;
}

function categoryIdOf(selection: {
  categoryId?: string;
  category?: string;
}): string {
  if (selection.categoryId && isMacroCategory(selection.categoryId)) {
    return selection.categoryId;
  }
  // Legacy rows only stored the Chinese label; recover the macro id from it.
  const byLabel = MACRO_CATEGORY_ORDER.find(
    (id) => MACRO_CATEGORY_LABELS[id] === selection.category
  );
  return byLabel ?? selection.categoryId ?? selection.category ?? "unknown";
}

export function getInterestCategoryLabel(
  categoryId: string,
  fallback?: string
): string {
  if (isMacroCategory(categoryId)) {
    return MACRO_CATEGORY_LABELS[categoryId];
  }
  return fallback && fallback.trim() !== "" ? fallback : categoryId;
}

export function getInterestLevelLabel(level: number | undefined): string {
  return INTEREST_LEVEL_LABELS[normalizeLevel(level)];
}

function categoryRank(categoryId: string): number {
  const index = MACRO_CATEGORY_ORDER.indexOf(categoryId as MacroCategory);
  return index === -1 ? MACRO_CATEGORY_ORDER.length : index;
}

export function buildAdminInterestView(
  interests: UserInterests | null | undefined
): AdminInterestView {
  const selections = interests?.selections ?? [];
  const categoryHeat = interests?.categoryHeat ?? {};

  const rows: AdminInterestRow[] = selections.map((selection) => {
    const level = normalizeLevel(selection.level);
    const categoryId = categoryIdOf(selection);
    return {
      topicId: selection.topicId,
      label: selection.label,
      categoryId,
      categoryLabel: getInterestCategoryLabel(categoryId, selection.category),
      level,
      levelLabel: INTEREST_LEVEL_LABELS[level],
      heat:
        typeof selection.heat === "number" && Number.isFinite(selection.heat)
          ? selection.heat
          : INTEREST_HEAT_BY_LEVEL[level],
    };
  });

  rows.sort((left, right) => {
    if (right.level !== left.level) return right.level - left.level;
    const byCategory = categoryRank(left.categoryId) - categoryRank(right.categoryId);
    if (byCategory !== 0) return byCategory;
    return left.label.localeCompare(right.label, "zh-Hans-CN");
  });

  const heatByCategory = new Map<string, { selectionCount: number; heat: number; label: string }>();
  for (const row of rows) {
    const entry = heatByCategory.get(row.categoryId) ?? {
      selectionCount: 0,
      heat: 0,
      label: row.categoryLabel,
    };
    entry.selectionCount += 1;
    entry.heat += row.heat;
    heatByCategory.set(row.categoryId, entry);
  }

  // Legacy rows can carry a rollup category with no surviving selection rows.
  for (const [categoryId, heat] of Object.entries(categoryHeat)) {
    if (heatByCategory.has(categoryId) || !Number.isFinite(heat) || heat <= 0) continue;
    heatByCategory.set(categoryId, {
      selectionCount: 0,
      heat,
      label: getInterestCategoryLabel(categoryId),
    });
  }

  const categories: Omit<AdminInterestCategoryRow, "strengthPercent">[] = Array.from(heatByCategory.entries())
    .map(([categoryId, entry]) => ({
      categoryId,
      label: entry.label,
      selectionCount: entry.selectionCount,
      heat: entry.heat,
    }))
    .sort((left, right) => {
      if (right.heat !== left.heat) return right.heat - left.heat;
      return categoryRank(left.categoryId) - categoryRank(right.categoryId);
    });

  const maxHeat = categories.reduce((max, category) => Math.max(max, category.heat), 0);

  return {
    totalSelections: rows.length,
    totalHeat: rows.reduce((sum, row) => sum + row.heat, 0),
    categoryCount: categories.length,
    rows,
    categories: categories.map((category) => ({
      ...category,
      strengthPercent: maxHeat > 0 ? Math.round((category.heat / maxHeat) * 100) : 0,
    })),
  };
}

/** 热度 3 / 10 / 25 对应 感兴趣 / 很热衷 / 必聊项（点 1 / 2 / 3 次）；必聊项优先排同好。 */
export const INTEREST_HEAT_LEGEND =
  `热度 ${INTEREST_HEAT_BY_LEVEL[1]} / ${INTEREST_HEAT_BY_LEVEL[2]} / ${INTEREST_HEAT_BY_LEVEL[3]} 对应 ` +
  `${INTEREST_LEVEL_LABELS[1]} / ${INTEREST_LEVEL_LABELS[2]} / ${INTEREST_LEVEL_LABELS[3]}` +
  "（点 1 / 2 / 3 次）；必聊项优先排同好。";
