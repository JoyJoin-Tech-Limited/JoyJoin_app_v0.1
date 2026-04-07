/**
 * chemistryPayoff.ts
 *
 * Deterministic, client-side helper for generating personalised chemistry
 * copy during the V2 match reveal sequence.
 *
 * Design constraints:
 * - All logic is pure (no side-effects, no async, no network).
 * - Copy must feel warm and editorial, not robotic or clinical.
 * - Every function has a meaningful fallback when data is sparse.
 * - Output is intentionally short — one headline and one chemistry line.
 */

import type { AttendeeData, UserContext } from "./attendeeAnalytics";

// ── Interest label localisation (Chinese UI labels) ───────────────────────────

const INTEREST_LABELS: Record<string, string> = {
  film_entertainment: "电影",
  travel_exploration: "旅行",
  food_dining: "美食",
  music_concerts: "音乐",
  reading_books: "阅读",
  art_culture: "艺术",
  sports_fitness: "运动",
  fitness_health: "健身",
  photography: "摄影",
  gaming: "游戏",
  technology: "科技",
  entrepreneurship: "创业",
  networking: "社交拓展",
  cooking: "烹饪",
  hiking: "徒步",
  yoga: "瑜伽",
  meditation: "冥想",
  fashion: "时尚",
  design: "设计",
  writing: "写作",
  pets: "宠物",
  board_games: "桌游",
  coffee: "咖啡",
  wine: "红酒",
  dancing: "舞蹈",
  theater: "戏剧",
  volunteering: "公益",
  investing: "投资",
  languages: "外语学习",
  history: "历史",
};

function localiseInterest(key: string): string {
  return INTEREST_LABELS[key] ?? key;
}

// ── Headline templates ─────────────────────────────────────────────────────────

const GENERIC_HEADLINES = [
  "小悦凑齐了这一桌有趣的灵魂",
  "这次，命运把你们安排在了同一桌",
  "你们之间，有种说不清的默契",
  "小悦觉得，这一桌注定要相聚",
  "有些缘分，就该发生在今晚",
];

/** Pick a headline seeded on the groupSize so it's stable across re-renders. */
export function pickHeadline(groupSize: number): string {
  const idx = groupSize % GENERIC_HEADLINES.length;
  return GENERIC_HEADLINES[idx];
}

// ── Common interests ───────────────────────────────────────────────────────────

/**
 * Find interests that appear in at least 2 members (including the current user).
 * Returns up to 3 labels in Chinese.
 */
export function findCommonInterests(
  members: Pick<AttendeeData, "topInterests" | "primaryInterests">[],
  currentUser?: Pick<UserContext, "interests">,
): string[] {
  const counts = new Map<string, number>();

  const addInterests = (interests: string[] | undefined) => {
    (interests ?? []).forEach((key) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  };

  members.forEach((m) => {
    addInterests(m.topInterests);
    addInterests(m.primaryInterests);
  });
  if (currentUser) {
    addInterests(currentUser.interests);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => localiseInterest(key));
}

// ── Archetype chemistry lines ──────────────────────────────────────────────────

/**
 * Short 2-word descriptors for each archetype's energy.
 * Used to build chemistry lines like "探索 × 松弛".
 */
const ARCHETYPE_ENERGY: Record<string, string> = {
  开心柯基: "活力",
  机智狐: "创意",
  暖心熊: "温暖",
  织网蛛: "洞察",
  夸夸豚: "热情",
  太阳鸡: "阳光",
  淡定海豚: "松弛",
  沉思猫头鹰: "深度",
  稳如龟: "稳重",
  隐身猫: "神秘",
  定心大象: "包容",
  灵感章鱼: "探索",
};

/**
 * Build a short archetype-based chemistry label.
 * Returns e.g. "活力 × 探索 × 深度" from up to 3 unique energies.
 */
export function buildArchetypeChemistryLabel(archetypes: string[]): string | null {
  const energies = Array.from(
    new Set(archetypes.map((a) => ARCHETYPE_ENERGY[a]).filter(Boolean)),
  ).slice(0, 3);

  if (energies.length === 0) return null;
  return energies.join(" × ");
}

// ── Chemistry line ─────────────────────────────────────────────────────────────

const CHEMISTRY_LINE_TEMPLATES_WITH_INTERESTS = [
  (interests: string) => `你们都爱${interests}，聊起来一定停不下来`,
  (interests: string) => `共同话题：${interests}——这桌自来熟`,
  (interests: string) => `${interests}爱好者的聚会，小悦放心了`,
];

const CHEMISTRY_LINE_TEMPLATES_WITH_ARCHETYPES = [
  (label: string) => `这桌能量组合：${label}——注定有化学反应`,
  (label: string) => `${label}的搭配，刚刚好`,
];

const CHEMISTRY_LINE_FALLBACKS = [
  "气质相近，小悦已替你找好今晚的陌生人",
  "这一桌的默契，只有你们自己会懂",
  "风格相投，今晚可以放开聊",
];

/** Stable seed-based pick from an array. */
function seedPick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export interface ChemistryPayoff {
  /** Short emotional headline (≤ 20 characters). */
  headline: string;
  /** Personalised chemistry sentence (≤ 40 characters). */
  chemistryLine: string;
  /** Optional display tags (common interests or archetype energies). */
  tags: string[];
}

/**
 * Generate the chemistry payoff card content deterministically from available
 * group data.
 *
 * Priority:
 * 1. If ≥ 2 shared interests found → interest-based line
 * 2. Else if archetypes available → archetype energy label
 * 3. Else → editorial fallback
 */
export function generateChemistryPayoff(
  members: Pick<AttendeeData, "topInterests" | "primaryInterests" | "archetype" | "socialTag">[],
  currentUser?: Pick<UserContext, "interests" | "archetype">,
): ChemistryPayoff {
  const groupSize = members.length;
  const headline = pickHeadline(groupSize);

  // Seed for deterministic template selection (stable per group composition).
  const seed = groupSize + members.filter((m) => m.archetype).length;

  // 1. Try interest-based line
  const commonInterests = findCommonInterests(members, currentUser);
  if (commonInterests.length >= 2) {
    const interestStr = commonInterests.slice(0, 2).join("和");
    const template = seedPick(CHEMISTRY_LINE_TEMPLATES_WITH_INTERESTS, seed);
    return {
      headline,
      chemistryLine: template(interestStr),
      tags: commonInterests,
    };
  }
  if (commonInterests.length === 1) {
    const interestStr = commonInterests[0];
    const template = seedPick(CHEMISTRY_LINE_TEMPLATES_WITH_INTERESTS, seed + 1);
    return {
      headline,
      chemistryLine: template(interestStr),
      tags: commonInterests,
    };
  }

  // 2. Try archetype energy label
  const archetypes = [
    ...(currentUser?.archetype ? [currentUser.archetype] : []),
    ...members.map((m) => m.archetype).filter(Boolean),
  ] as string[];

  const archetypeLabel = buildArchetypeChemistryLabel(archetypes);
  if (archetypeLabel) {
    const template = seedPick(CHEMISTRY_LINE_TEMPLATES_WITH_ARCHETYPES, seed);
    const uniqueEnergies = Array.from(
      new Set(archetypes.map((a) => ARCHETYPE_ENERGY[a]).filter(Boolean)),
    ).slice(0, 3);
    return {
      headline,
      chemistryLine: template(archetypeLabel),
      tags: uniqueEnergies,
    };
  }

  // 3. Editorial fallback
  return {
    headline,
    chemistryLine: seedPick(CHEMISTRY_LINE_FALLBACKS, seed),
    tags: [],
  };
}
