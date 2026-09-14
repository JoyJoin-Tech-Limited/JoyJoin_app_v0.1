import { getCalibratedChemistryScore } from '../archetypeChemistryCalibration';
import {
  WORK_MODE_LABELS,
  RELATIONSHIP_MATCH_LABELS,
  DISCUSSION_STYLE_LABELS,
  getConnectionPointRarity,
  getIntentLabel,
} from '@shared/constants';
import { getInterestById } from '@shared/interests';
import type { ConnectionPointWithRarity } from '@shared/types/groupAnalysis';
import { MUST_CHAT_HEAT_LEVEL, MAX_SHARED_HIGHLIGHTS } from './constants';
import type { MatchMember } from './types';

// ============ 辅助函数 ============

/**
 * 找出两个用户的共同兴趣
 */
export function findSharedInterests(
  interests1: string[] | null | undefined,
  interests2: string[] | null | undefined
): string[] {
  if (!interests1 || !interests2) return [];
  return interests1.filter(i => interests2.includes(i));
}
/**
 * 获取工作模式的中文标签（使用共享常量 WORK_MODE_LABELS）
 */
function getWorkModeLabel(mode: string): string {
  return WORK_MODE_LABELS[mode as keyof typeof WORK_MODE_LABELS] || mode;
}

/** Maps internal discussionStyle keys to Chinese display labels */
export function formatDiscussionStyle(style: string): string {
  return DISCUSSION_STYLE_LABELS[style] || style;
}

/**
 * 找出两个用户在热度达标兴趣上的深度重叠
 */
function findDeepInterestOverlap(
  interestsA: Array<{ topicId: string; heatLevel: number }> | null | undefined,
  interestsB: Array<{ topicId: string; heatLevel: number }> | null | undefined,
  minHeatLevel: number
): { count: number; topics: string[] } {
  if (!interestsA || !interestsB) return { count: 0, topics: [] };
  const deepA = new Set(
    interestsA.filter(i => i.heatLevel >= minHeatLevel).map(i => i.topicId)
  );
  const overlap = interestsB.filter(
    i => i.heatLevel >= minHeatLevel && deepA.has(i.topicId)
  );
  return { count: overlap.length, topics: overlap.map(i => i.topicId) };
}

/**
 * 找出连接点（同乡、同行业等），返回带稀有度的结构化结果。
 */
export function findConnectionPoints(member1: MatchMember, member2: MatchMember): ConnectionPointWithRarity[] {
  const points: ConnectionPointWithRarity[] = [];

  const pushPoint = (text: string) => {
    points.push({ text, rarity: getConnectionPointRarity(text) });
  };

  if (member1.hometown && member2.hometown && member1.hometown === member2.hometown) {
    pushPoint(`同乡（${member1.hometown}）`);
  }

  if (member1.industry && member2.industry && member1.industry === member2.industry) {
    pushPoint(`同行业（${member1.industry}）`);
  }

  // Same education level
  if (member1.educationLevel && member2.educationLevel &&
      member1.educationLevel === member2.educationLevel) {
    pushPoint(`同学历（${member1.educationLevel}）`);
  }

  // Same relationship status — use shared RELATIONSHIP_MATCH_LABELS for display text
  if (member1.relationshipStatus && member2.relationshipStatus &&
      member1.relationshipStatus === member2.relationshipStatus &&
      member1.relationshipStatus !== "不透露") {
    const label = RELATIONSHIP_MATCH_LABELS[member1.relationshipStatus];
    if (label) {
      pushPoint(label.text);
    }
  }

  // Same work mode AND same industry category (rare compound)
  // Match on category code; display using the human-readable label
  if (member1.workMode && member2.workMode &&
      member1.workMode === member2.workMode &&
      member1.industryCategory && member2.industryCategory &&
      member1.industryCategory === member2.industryCategory) {
    const displayLabel = member1.industryCategoryLabel || member1.industryCategory;
    pushPoint(`同在${displayLabel}·${getWorkModeLabel(member1.workMode)}`);
  }

  // Archetype checks
  if (member1.archetype && member2.archetype) {
    if (member1.archetype === member2.archetype) {
      // Exact same archetype (epic)
      pushPoint(`同款人格（${member1.archetype}）`);
    } else {
      // Complementary archetype (chemistry score > 85)
      const chemScore = getCalibratedChemistryScore(member1.archetype || "koala", member2.archetype || "koala");
      if (chemScore > 85) {
        pushPoint(`性格互补（${member1.archetype}×${member2.archetype}）`);
      }
    }
  }

  // Compound epic: same hometown + same industry category (老乡+同行 bonus)
  // Match on category code; display using the human-readable label
  if (member1.hometown && member2.hometown &&
      member1.hometown === member2.hometown &&
      member1.industryCategory && member2.industryCategory &&
      member1.industryCategory === member2.industryCategory) {
    const displayLabel = member1.industryCategoryLabel || member1.industryCategory;
    pushPoint(`老乡+同行（${member1.hometown}·${displayLabel}）`);
  }

  // Deep interest overlap (≥3 interests at heat level ≥ 2)
  const deepOverlap = findDeepInterestOverlap(
    member1.interestsWithHeat,
    member2.interestsWithHeat,
    2
  );
  if (deepOverlap.count >= 3) {
    pushPoint(`深度同好（${deepOverlap.count}个共同深度兴趣）`);
  }

  // Interest signal alignment — prompt enrichment only.
  // user_interest_signals (discussionStyle, conversationDepth) are valid here for
  // generating richer connection points shown in the AI match explanation.
  // They must NOT be read inside poolMatchingService pair-score computation.
  if (member1.interestSignals?.length && member2.interestSignals?.length) {
    const signalMap2 = new Map(
      member2.interestSignals.map(s => [s.interestKey, s])
    );
    for (const sig1 of member1.interestSignals) {
      const sig2 = signalMap2.get(sig1.interestKey);
      if (!sig2) continue;
      // Both have signaled this interest
      if (sig1.discussionStyle === sig2.discussionStyle) {
        pushPoint(`${sig1.interestLabel}同款聊法（${formatDiscussionStyle(sig1.discussionStyle)}）`);
      } else if (Math.abs(sig1.conversationDepth - sig2.conversationDepth) <= 1) {
        pushPoint(`${sig1.interestLabel}话题深度相近`);
      }
    }
  }

  return points;
}

/**
 * 提取确定性的「共同亮点」—— 最多 3 条具体共同事实的一句话描述，
 * 与 LLM 散文解释一同展示（感知相似性：具体共同事实比抽象分数更能拉近距离）。
 *
 * 优先级：共同必聊项 → 共同活动意图 → 同乡。
 * 与 findConnectionPoints 去重：连接点已覆盖的内容（如同乡、已点名的兴趣）这里不重复。
 * 只读取 MatchMember 上已有的数据（兴趣档位、意图、家乡均在生成调用路径中装配），
 * 不读取 user_interest_signals —— 保持确定性数据边界。
 */

/** 有效活动意图：本次活动意图优先，回退到档案默认意图；空数组表示无明确偏好。 */
function getEffectiveMemberIntent(member: MatchMember): string[] {
  if (Array.isArray(member.eventIntent) && member.eventIntent.length > 0) return member.eventIntent;
  if (Array.isArray(member.intent) && member.intent.length > 0) return member.intent;
  return [];
}

export function findSharedSignalHighlights(
  member1: MatchMember,
  member2: MatchMember,
  existingConnectionPoints: string[] = []
): string[] {
  const highlights: string[] = [];

  // 1. 共同必聊项（双方都标到三档的话题，最多拼 2 个标签）
  const mustChatA = new Set(
    (member1.interestsWithHeat ?? [])
      .filter(i => i.heatLevel >= MUST_CHAT_HEAT_LEVEL)
      .map(i => i.topicId)
  );
  if (mustChatA.size > 0) {
    const sharedLabels = (member2.interestsWithHeat ?? [])
      .filter(i => i.heatLevel >= MUST_CHAT_HEAT_LEVEL && mustChatA.has(i.topicId))
      .map(i => getInterestById(i.topicId)?.label ?? i.topicId)
      // 连接点已点名的话题不重复讲述
      .filter(label => !existingConnectionPoints.some(text => text.includes(label)))
      .slice(0, 2);
    if (sharedLabels.length > 0) {
      highlights.push(`你们都把${sharedLabels.join('、')}标成了必聊项`);
    }
  }

  // 2. 共同活动意图（有效意图交集；「随缘」表示无明确偏好，不参与）
  const intentsA = getEffectiveMemberIntent(member1).filter(v => v !== 'flexible');
  if (intentsA.length > 0) {
    const sharedIntents = getEffectiveMemberIntent(member2)
      .filter(v => v !== 'flexible' && intentsA.includes(v))
      .slice(0, 2);
    if (sharedIntents.length > 0) {
      highlights.push(`你们这次都想${sharedIntents.map(getIntentLabel).join('、')}`);
    }
  }

  // 3. 同乡（仅当连接点未覆盖时补充，避免与「同乡（…）」「老乡+同行（…）」重复）
  if (
    member1.hometown && member2.hometown && member1.hometown === member2.hometown &&
    !existingConnectionPoints.some(text => text.includes(member1.hometown as string))
  ) {
    highlights.push(`你们都是${member1.hometown}人`);
  }

  return highlights.slice(0, MAX_SHARED_HIGHLIGHTS);
}

/**
 * 生成配对键（排序后的用户ID组合）
 */
export function getPairKey(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('-');
}
