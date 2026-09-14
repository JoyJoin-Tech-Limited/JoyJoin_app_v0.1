/**
 * Interest-overlap pair-scoring helpers.
 *
 * BOUNDARY INVARIANT: reads ONLY from `user_interests`. `user_interest_signals`
 * are intentionally excluded from deterministic pair scoring.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import { db } from "../db";
import { assessmentSessions, userInterests } from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  CompositionTraitVector,
  UserInterestsCache,
  UserWithProfile,
} from "../poolMatchingService";

/**
 * 获取用户兴趣 (统一从 user_interests 表)
 * @returns { topics: string[], heatMap: Record<string, number> }
 */
export async function getUserInterests(userId: string): Promise<{
  topics: string[];
  heatMap: Record<string, number>;
}> {
  const result = await db
    .select()
    .from(userInterests)
    .where(eq(userInterests.userId, userId))
    .limit(1);
  
  if (result.length === 0) {
    return { topics: [], heatMap: {} };
  }
  
  const selections = result[0].selections as any[];
  
  return {
    topics: selections.map((s: any) => s.topicId),
    heatMap: Object.fromEntries(
      selections.map((s: any) => [s.topicId, s.heat])
    )
  };
}

/**
 * Preload user_interests for a list of userIds in one batch query.
 * Returns a cache map: userId -> { topics, heatMap }.
 * Used to avoid N×(N-1)/2 repeated DB lookups inside pair-score loops.
 */
export async function preloadUserInterests(userIds: string[]): Promise<UserInterestsCache> {
  const cache: UserInterestsCache = new Map();
  if (userIds.length === 0) return cache;

  const rows = await db
    .select()
    .from(userInterests)
    .where(inArray(userInterests.userId, userIds));

  for (const row of rows) {
    const selections = (row.selections as any[]) || [];
    cache.set(row.userId, {
      topics: selections.map((s: any) => s.topicId),
      heatMap: Object.fromEntries(selections.map((s: any) => [s.topicId, s.heat])),
    });
  }

  // Fill missing users with empty interests so every userId has an entry
  for (const userId of userIds) {
    if (!cache.has(userId)) {
      cache.set(userId, { topics: [], heatMap: {} });
    }
  }

  return cache;
}

/**
 * Item 5 (AC-5.1b): batch preload of REPORTED ACOEXP trait vectors for the
 * composition gates — mirrors `preloadUserInterests` (one batch query, no
 * per-member lookups in the matching hot path).
 *
 * Source: the user's latest COMPLETED assessment session
 * (`assessment_sessions.completedAt IS NOT NULL`, newest first). Mirrors the
 * profile read path (`routes/domains/profile.ts`): prefer
 * `finalResult.traitScores` (engine-normalized 0–100), fall back to the
 * top-level `trait_scores` JSONB for legacy sessions.
 *
 * Cold-start policy (mandatory per the Item 5 contract): users with no
 * completed session — or a session whose vector is incomplete — get NO cache
 * entry (absence is meaningful). The gates skip members without a complete
 * vector instead of treating them as failing (R3 skip-on-missing-cache
 * precedent), so gate-on never strands cold-start users (M10 guard).
 */
export async function preloadLatestTraitVectors(
  userIds: string[],
): Promise<Map<string, CompositionTraitVector>> {
  const cache = new Map<string, CompositionTraitVector>();
  if (userIds.length === 0) return cache;

  // Rows are newest-first; the first row with a COMPLETE ACOEXP vector wins per
  // user, so a latest session carrying a partial vector falls back to the
  // newest complete one. A `DISTINCT ON (user_id)` bound here would drop that
  // fallback and regress composition-gate measurement (verified against the
  // locked Monte-Carlo baseline), so the per-user row bound is deferred.
  const rows = await db
    .select({
      userId: assessmentSessions.userId,
      traitScores: assessmentSessions.traitScores,
      finalResult: assessmentSessions.finalResult,
    })
    .from(assessmentSessions)
    .where(
      and(
        inArray(assessmentSessions.userId, userIds),
        sql`${assessmentSessions.completedAt} IS NOT NULL`,
      ),
    )
    .orderBy(desc(assessmentSessions.completedAt));

  // Rows are newest-first, so the first complete row seen per user is the
  // latest completed session carrying a full vector.
  for (const row of rows) {
    if (!row.userId || cache.has(row.userId)) continue;
    const raw = ((row.finalResult as any)?.traitScores ?? row.traitScores) as
      | Record<string, unknown>
      | null;
    if (!raw || typeof raw !== "object") continue;
    const vector: CompositionTraitVector = {};
    let complete = true;
    for (const trait of ["A", "C", "E", "O", "X", "P"] as const) {
      const value = raw[trait];
      if (typeof value === "number" && Number.isFinite(value)) {
        vector[trait] = value;
      } else {
        complete = false;
        break;
      }
    }
    if (complete) cache.set(row.userId, vector);
  }

  return cache;
}

/**
 * W6 (gm-debrief) AC-W6.3: value returned by the interest helper when a pair
 * carries no usable interest data. Note the deterministic pair scorer does NOT
 * score this value — it marks the dimension unavailable and renormalizes the
 * weight away (see `calculateWeightedPairScore` availability). Kept at 50 for
 * callers that invoke the standalone helper.
 */
export const INTEREST_SCORE_NO_DATA = 50;

/**
 * Pure per-pair interest computation:
 *   - `available=false` when either side has no declared topics (data absent).
 *   - otherwise the **overlap coefficient** `|A∩B| / min(|A|,|B|)` (W6 AC-W6.4),
 *     replacing raw Jaccard which punished broad-interest profiles, plus the
 *     existing heat-weight bonus.
 */
export function calculateInterestScoreForPair(
  interests1: { topics: string[]; heatMap: Record<string, number> },
  interests2: { topics: string[]; heatMap: Record<string, number> },
): { score: number; available: boolean } {
  if (interests1.topics.length === 0 || interests2.topics.length === 0) {
    return { score: INTEREST_SCORE_NO_DATA, available: false };
  }

  const topics2 = new Set(interests2.topics);
  const commonTopics = interests1.topics.filter((t) => topics2.has(t));
  const minSetSize = Math.min(interests1.topics.length, interests2.topics.length);
  const overlapRatio = minSetSize > 0 ? commonTopics.length / minSetSize : 0;
  const baseScore = Math.round(overlapRatio * 85 + 15);

  // Heat Level 加权匹配
  let heatBonus = 0;
  for (const topic of commonTopics) {
    const heat1 = interests1.heatMap[topic] || 0;
    const heat2 = interests2.heatMap[topic] || 0;

    if (heat1 === 25 && heat2 === 25) {
      heatBonus += 15; // 双方都是 level 3
    } else if (heat1 === 10 && heat2 === 10) {
      heatBonus += 8;  // 双方都是 level 2
    } else if ((heat1 === 25 && heat2 === 10) || (heat1 === 10 && heat2 === 25)) {
      heatBonus += 10; // 一方 level 3, 一方 level 2
    } else if (heat1 > 0 && heat2 > 0) {
      heatBonus += 3;  // 其他情况
    }
  }

  heatBonus = Math.min(heatBonus, 20);

  return { score: Math.min(100, baseScore + heatBonus), available: true };
}

/**
 * 计算兴趣重叠度 (overlap coefficient + Heat 加权)
 * 使用 user_interests 表中的兴趣选择和热度信息.
 *
 * BOUNDARY INVARIANT: this function reads ONLY from `user_interests`.
 * `user_interest_signals` (discussion style / conversation depth) are intentionally
 * excluded from deterministic pair scoring. They are valid only for prompt
 * enrichment in matchExplanationService / conversationTopicsService.
 * Do NOT add user_interest_signals reads to this function.
 */
export async function calculateInterestScoreAsync(
  user1Id: string,
  user2Id: string,
  cache?: UserInterestsCache,
): Promise<number> {
  const interests1 = cache?.get(user1Id) ?? await getUserInterests(user1Id);
  const interests2 = cache?.get(user2Id) ?? await getUserInterests(user2Id);
  return calculateInterestScoreForPair(interests1, interests2).score;
}

/**
 * 计算兴趣重叠度 (0-100) - Legacy同步版本
 * 使用Jaccard系数：交集 / 并集
 * @deprecated 保留用于向后兼容，新代码应使用 calculateInterestScoreAsync
 * Note: interestsTop field removed - returning default score
 */
function calculateInterestScore(user1: UserWithProfile, user2: UserWithProfile): number {
  // interestsTop field was removed - return default middle score
  return 70; // Default middle score since interests are now managed separately
  
  /* Legacy code (commented out since interestsTop was removed):
  const interests1 = user1.interestsTop || [];
  const interests2 = user2.interestsTop || [];
  
  if (interests1.length === 0 && interests2.length === 0) return 70; // 都没有兴趣记录，默认中等分数
  if (interests1.length === 0 || interests2.length === 0) return 30; // 一方没有记录，低分
  
  const overlap = interests1.filter((i: string) => interests2.includes(i)).length;
  const union = new Set([...interests1, ...interests2]).size;
  
  // Jaccard系数：(交集大小 / 并集大小) * 85 + 15
  // 无重叠=15分，完全重叠=100分
  const jaccardRatio = overlap / union;
  return Math.round(jaccardRatio * 85 + 15);
  */
}
