/**
 * 磁场引擎 group-composition rules R1–R4.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import { INTEREST_TAXONOMY } from "@shared/interests";
import {
  MAGNETISM_ENERGIZER_THRESHOLD,
  MAGNETISM_EXPLORE_RANKING_PENALTY,
  MAGNETISM_STRONG_TIE_THRESHOLD,
  userArchetypeEnergy,
} from "./energyComposition";
import { getEffectiveIntent } from "./pairDimensionScoring";
import type { UserInterestsCache, UserWithProfile } from "../poolMatchingService";

// ── 磁场引擎 惊艳开局包 (P1): group-composition rules ─────────────────────
// Four rules behind the magnetismGroupRulesEnabled flag (MAGNETISM_GROUP_RULES_ENABLED).
// R1–R3 are commit gates on the FINAL group composition; R4 is a ranking-only
// nudge during expansion. Everything below is inert when the flag is off.

/**
 * R1 无孤立者 (no isolated member): every member must have ≥1 intra-group pair
 * score ≥ threshold. Pair scores are supplied by the caller via `getPairScore`
 * so the greedy core can serve them from its precomputed cache.
 */
export async function groupSatisfiesStrongTieRule(
  members: UserWithProfile[],
  getPairScore: (user1: UserWithProfile, user2: UserWithProfile) => Promise<number>,
  threshold: number = MAGNETISM_STRONG_TIE_THRESHOLD,
): Promise<boolean> {
  for (const member of members) {
    let hasStrongTie = false;
    for (const other of members) {
      if (other.userId === member.userId) continue;
      if ((await getPairScore(member, other)) >= threshold) {
        hasStrongTie = true;
        break;
      }
    }
    if (!hasStrongTie) return false;
  }
  return true;
}

/**
 * R2 能量编排 (energy choreography): the group must contain ≥1 energizer
 * (archetype energy ≥ threshold). The pool-level exemption (no energizer among
 * eligible users → rule skipped) is decided once per run by the caller.
 */
export function groupHasEnergizer(
  members: UserWithProfile[],
  threshold: number = MAGNETISM_ENERGIZER_THRESHOLD,
): boolean {
  return members.some(m => userArchetypeEnergy(m) >= threshold);
}

// topicId → macroCategory lookup for R3, built once from the canonical taxonomy.
const INTEREST_TOPIC_MACRO_CATEGORY = new Map<string, string>();
for (const interest of INTEREST_TAXONOMY) {
  INTEREST_TOPIC_MACRO_CATEGORY.set(interest.id, interest.macroCategory);
}

/**
 * R3 话题锚点 (topic anchor): a committed group must share conversation fuel.
 * Cold-start safety: if ANY member's interestsCache entry is missing or empty,
 * the rule is skipped (returns true). Otherwise the group passes when EITHER
 *   (a) some macro category has ≥1 topic from EVERY member, OR
 *   (b) some single topicId is shared by ≥ ⌈n/2⌉ members (any heat).
 */
export function groupHasTopicAnchor(
  members: UserWithProfile[],
  interestsCache: UserInterestsCache,
): boolean {
  const memberTopics: string[][] = [];
  for (const m of members) {
    const entry = interestsCache.get(m.userId);
    if (!entry || entry.topics.length === 0) return true; // cold-start → skip rule
    memberTopics.push(entry.topics);
  }
  if (memberTopics.length === 0) return true;

  // (a) a macro category in which every member carries ≥1 topic
  let sharedCategories: Set<string> | null = null;
  for (const topics of memberTopics) {
    const categories = new Set<string>();
    for (const topic of topics) {
      const category = INTEREST_TOPIC_MACRO_CATEGORY.get(topic);
      if (category) categories.add(category);
    }
    if (sharedCategories === null) {
      sharedCategories = categories;
    } else {
      sharedCategories = new Set<string>([...sharedCategories].filter((c: string) => categories.has(c)));
    }
    if (sharedCategories.size === 0) break;
  }
  if (sharedCategories && sharedCategories.size > 0) return true;

  // (b) one concrete topic shared by ≥ ⌈n/2⌉ members
  const required = Math.ceil(memberTopics.length / 2);
  const topicMemberCounts = new Map<string, number>();
  for (const topics of memberTopics) {
    for (const topic of new Set(topics)) {
      topicMemberCounts.set(topic, (topicMemberCounts.get(topic) ?? 0) + 1);
    }
  }
  for (const count of topicMemberCounts.values()) {
    if (count >= required) return true;
  }
  return false;
}

/**
 * R4 新奇分散 (novelty dispersion): ranking-only nudge during group expansion.
 * An explore-intent candidate joining a group that already has an explorer is
 * penalised for the argmax ONLY — cached pair scores and the admission
 * threshold never see the adjustment (nudge, not ban).
 */
export function adjustScoreForNoveltyDispersion(
  candidate: UserWithProfile,
  groupMembers: UserWithProfile[],
  avgScore: number,
): number {
  if (!getEffectiveIntent(candidate).includes("explore")) return avgScore;
  const groupHasExplorer = groupMembers.some(m => getEffectiveIntent(m).includes("explore"));
  return groupHasExplorer ? avgScore - MAGNETISM_EXPLORE_RANKING_PENALTY : avgScore;
}
