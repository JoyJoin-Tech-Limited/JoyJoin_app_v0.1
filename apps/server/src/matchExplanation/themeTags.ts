import { getInterestById } from '@shared/interests';
import type { OverallChemistry } from '@shared/groupAnalysis';
import type { MatchMember } from './types';

// ============ 主题标签生成 ============

/** Archetype clusters used for theme tag derivation */
const ENERGETIC_ARCHETYPES = new Set(['corgi', 'rooster', 'hamster_praise']);
const ANALYTICAL_ARCHETYPES = new Set(['fox', 'owl', 'octopus']);
const WARM_ARCHETYPES = new Set(['koala', 'elephant']);
const QUIET_ARCHETYPES = new Set(['turtle', 'cat']);

type GroupThemeBucket = 'exploration' | 'food' | 'music' | 'culture' | null;

function normalizeInterestForTheme(interest: string): string {
  return getInterestById(interest)?.label ?? interest;
}

function getInterestThemeBucket(interest: string): GroupThemeBucket {
  const normalized = normalizeInterestForTheme(interest);

  if (
    ['旅游', '旅行', '户外', '徒步', '露营', 'CityWalk', '城市漫步', '水上运动'].includes(normalized)
  ) {
    return 'exploration';
  }

  if (
    ['美食', '烹饪', '火锅', '撸串', '早茶', '日料', '西餐', '下午茶', '咖啡', '探店', '打边炉', '私厨'].includes(normalized)
  ) {
    return 'food';
  }

  if (
    ['音乐', '玩音乐', '乐器', '演唱会', 'LiveHouse', 'KTV'].includes(normalized)
  ) {
    return 'music';
  }

  if (
    ['读书', '阅读', '文学', '书', '看展', '话剧', '电影'].includes(normalized)
  ) {
    return 'culture';
  }

  return null;
}

/**
 * Deterministically generate 2–4 compact post-match theme tags.
 * Derived from archetype composition, chemistry level, and shared interests.
 * No LLM call — always returns a result instantly.
 */
export function generateGroupThemeTags(
  members: MatchMember[],
  overallChemistry: OverallChemistry,
  eventType: string
): string[] {
  const tags: string[] = [];
  const archetypes = members.map(m => m.archetype).filter(Boolean) as string[];

  // 1. Chemistry vibe tag
  if (overallChemistry === 'fire') tags.push('高火花');
  else if (overallChemistry === 'warm') tags.push('相遇顺畅');
  else tags.push('轻松破冰');

  // 2. Archetype composition tag
  const energeticCount = archetypes.filter(a => ENERGETIC_ARCHETYPES.has(a)).length;
  const analyticalCount = archetypes.filter(a => ANALYTICAL_ARCHETYPES.has(a)).length;
  const warmCount = archetypes.filter(a => WARM_ARCHETYPES.has(a)).length;
  const quietCount = archetypes.filter(a => QUIET_ARCHETYPES.has(a)).length;
  if (energeticCount > 0 && analyticalCount > 0) tags.push('动静结合');
  else if (energeticCount >= 2) tags.push('活力满格');
  else if (analyticalCount >= 2) tags.push('深度交流');
  else if (warmCount >= 2) tags.push('温暖同频');
  else if (quietCount >= 2) tags.push('慢热深聊');
  else if (archetypes.length > 0) tags.push('性格多元');

  // 3. Interest / activity tag (supports both canonical interest IDs and legacy/display labels)
  const allInterests = members.flatMap(m => (m.interestsTop ?? []).map(normalizeInterestForTheme));
  const interestCounts = new Map<string, number>();
  allInterests.forEach(i => interestCounts.set(i, (interestCounts.get(i) || 0) + 1));
  const topShared = Array.from(interestCounts.entries())
    .filter(([_, c]) => c >= 2)
    .map(([i]) => i);
  if (topShared.some(t => getInterestThemeBucket(t) === 'exploration')) tags.push('城市探索');
  else if (topShared.some(t => getInterestThemeBucket(t) === 'food')) tags.push('美食同好');
  else if (topShared.some(t => getInterestThemeBucket(t) === 'music')) tags.push('音乐同频');
  else if (topShared.some(t => getInterestThemeBucket(t) === 'culture')) tags.push('文化共鸣');
  else if (eventType === '酒局') tags.push('把酒言欢');
  else if (topShared.length >= 2) tags.push('话题丰富');

  // 4. Background diversity tag (only when truly cross-industry)
  const industries = new Set(members.map(m => m.industryCategory).filter(Boolean));
  if (industries.size >= 3 && tags.length < 4) tags.push('背景多元');

  while (tags.length < 2) {
    const fallbackTag =
      eventType === '酒局'
        ? '轻松小酌'
        : members.length >= 4
        ? '缘分开桌'
        : '轻松相处';

    if (!tags.includes(fallbackTag)) {
      tags.push(fallbackTag);
      continue;
    }

    tags.push('自然同桌');
  }

  return tags.slice(0, 4);
}

/**
 * Deterministically generate a compact companion line contextualising the group theme.
 * Non-duplicative of pair explanations and groupDynamics.
 */
export function generateGroupThemeCompanion(
  members: MatchMember[],
  overallChemistry: OverallChemistry,
  eventType: string
): string {
  const archetypes = members.map(m => m.archetype).filter(Boolean) as string[];
  const energeticCount = archetypes.filter(a => ENERGETIC_ARCHETYPES.has(a)).length;
  const analyticalCount = archetypes.filter(a => ANALYTICAL_ARCHETYPES.has(a)).length;
  const quietCount = archetypes.filter(a => QUIET_ARCHETYPES.has(a)).length;

  if (overallChemistry === 'fire') {
    return `这组的火花感很强，${eventType}现场很可能很快就热络起来。`;
  }
  if (energeticCount > 0 && analyticalCount > 0) {
    return `动静结合的组合，${eventType}中往往能聊出意想不到的层次。`;
  }
  if (quietCount >= 2 || overallChemistry === 'mild' || overallChemistry === 'cold') {
    return `这组更适合先自然接触，再慢慢进入更有质量的交流。`;
  }
  if (energeticCount >= 2) {
    return `活力型组合，${eventType}开场会很自然，记得给安静的成员留点空间。`;
  }
  return `多元背景带来新鲜视角，${eventType}中聊开了会很有意思。`;
}

/**
 * 生成小组动态描述
 */
export function generateGroupDynamics(
  members: MatchMember[],
  avgChemistry: number,
  eventType: string
): string {
  const archetypes = members.map(m => m.archetype).filter(Boolean);
  const hasEnergizers = archetypes.some(a => 
    ['corgi', 'rooster', 'hamster_praise'].includes(a as string)
  );
  const hasListeners = archetypes.some(a => 
    ['koala', 'owl', 'cat'].includes(a as string)
  );
  
  if (avgChemistry >= 80 && hasEnergizers) {
    return `这是一个充满活力的组合！${eventType}氛围会非常热闹，记得留点时间让每个人都能分享故事。`;
  } else if (hasEnergizers && hasListeners) {
    return `完美的平衡组合！有人带动气氛，有人倾听回应，这场${eventType}会很温馨。`;
  } else if (hasListeners) {
    return `这是一个温和、深度的组合，适合慢慢建立信任，聊一些走心的话题。`;
  }
  return `多元化的组合带来不同视角，期待你们在${eventType}中发现彼此的有趣之处！`;
}
