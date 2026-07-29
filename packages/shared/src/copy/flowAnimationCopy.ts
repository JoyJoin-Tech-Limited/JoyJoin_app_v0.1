/**
 * Flow Animation copy — flow-animation 双世界入口 + 生命周期 文案
 *
 * surface: 'flow-animation'
 * toneMode: 'yuezai-voice' (narrative/personal lines) · 'system-ui' (chrome/concrete)
 *
 * Product-owner approved 2026-07-29 (sprint-contract.flow-animation-uplift, AC1).
 * Every line passed docs/copy/brand-copy-strategy.md 🔴 hard rules:
 * zero emoji, no AI/算法/权重/评分 self-explanation, canonical terminology
 * (桌 not 小队/小组, 悦仔 personification over platform voice), no fabricated
 * metrics, and 街头盲盒 copy is invitation-framing only — never availability.
 *
 * 「4–6」 en-dash is U+2013 between halfwidth digits and must render as one
 * non-breaking unit (component wraps it in a nowrap element).
 */

import { DEFAULT_EVENT_GROUP_SIZE } from '../constants.js';

// ─── Flow 1 · Home ───

/** H1 line 2 renders the group-size numeral from config, never hardcoded. */
export function getFlow1H1Line2(): string {
  return `${DEFAULT_EVENT_GROUP_SIZE.min}–${DEFAULT_EVENT_GROUP_SIZE.max}人的同城小局`;
}

export const FLOW1_HOME_COPY = {
  h1Line1: '为你攒一场',
  /** Shown when the user has no resolved archetype. */
  fallbackSubline: '一边是一桌合拍的人，一边是城市递来的线索',
} as const;

/** 12 per-archetype sub-lines, keyed by canonical archetype id (personality/archetypeNames.ts). */
export const ARCHETYPE_SUBLINES: Record<string, string> = {
  corgi: '你一进场，局和街都先热起来',
  rooster: '有你在，局和城都慢慢暖起来',
  hamster_praise: '你看得见人的好，局和城都更亲',
  fox: '新玩法问你准没错，局和街都有惊喜',
  dolphin_calm: '你读得懂气场，局和街都跟着舒服',
  spider: '你顺手搭的桥，把人和这座城连起来',
  koala: '你真的在听，这桌和这座城都敢说真心话',
  octopus: '你的脑洞一开，局和街都有新玩法',
  owl: '你问的那个为什么，局和街都会聊深',
  elephant: '有你在先稳三分，这桌和出门都踏实',
  turtle: '你慢热看得准，局和街都等你开口',
  cat: '你不抢话，小局和街角反而更有味',
};

export function getArchetypeSubline(archetypeId?: string | null): string {
  return (archetypeId && ARCHETYPE_SUBLINES[archetypeId]) || FLOW1_HOME_COPY.fallbackSubline;
}

// ─── Flow 1 · Banners (titles/eyebrows unchanged by design) ───

export const FLOW1_ENTRY_COPY = {
  event: {
    eyebrow: '人与人',
    title: '盲盒活动',
    /** Concrete mechanics: 选活动 → 凑成一桌 → 线下. */
    bannerLine: '挑一场活动，凑成一桌，线下见',
  },
  street: {
    eyebrow: '人与城市',
    title: '街头盲盒',
    /** Invitation/story framing ONLY — no availability, schedule, or NPC-presence claims. */
    bannerLine: '一条线索引路，把城市走成故事',
  },
} as const;

// ─── Flow 1 · Detail pages ───

export interface FlowStepCopy {
  title: string;
  description: string;
}

export interface ExperienceDetailCopy {
  heroSubtitle: string;
  sceneTitle: string;
  closing: string;
  steps: readonly FlowStepCopy[];
}

export const EXPERIENCE_DETAIL_COPY: Record<'event' | 'street', ExperienceDetailCopy> = {
  event: {
    heroSubtitle: '不是随机拼桌，是认真凑一桌合拍的人',
    sceneTitle: '报名之后，悦仔开始认真凑这一桌',
    closing: '先有一件共同想做的事，认识彼此就自然多了',
    steps: [
      { title: '挑一场想参加的', description: '先从你真正感兴趣的活动开始' },
      { title: '说说你的偏好', description: '时间、兴趣和相处节奏，悦仔都会记在心里' },
      { title: '凑成一桌', description: '悦仔把更合拍的人，安排到同一桌' },
      { title: '到现场一起体验', description: '不用硬找话题，先一起把活动玩起来' },
    ],
  },
  street: {
    heroSubtitle: '城市把线索藏好了，等你哪天想出门',
    sceneTitle: '这座城市的故事，从一条线索开始',
    closing: '不用约齐人，一个人也能把城市走成故事',
    steps: [
      { title: '挑一条顺眼的线索', description: '每条线索背后，都是一封城市的邀请' },
      { title: '接到一件小任务', description: '不必准备很久，照着提示就能开始' },
      { title: '边走边发现', description: '路程不必很远，也能重新看看熟悉的街道' },
      { title: '留下这次发现', description: '完成之后，把这段经历收进你的城市故事' },
    ],
  },
};

// ─── Flow 2 · Lifecycle (data-bound to the just-registered pool) ───

export interface FlowLifecycleFacts {
  title?: string | null;
  /** Pre-formatted date string (formatEventDateTime) — pass through as-is. */
  dateLabel?: string | null;
  district?: string | null;
  /** Pre-formatted event-type label (getEventTypeLabel) — pass through as-is. */
  typeLabel?: string | null;
}

export const FLOW2_FALLBACKS = {
  heroTitle: '这次出发',
  nodeTitle: '这场活动',
  nodeType: '活动',
  nodeDistrict: '现场',
  metaDate: '时间待公布',
  metaDistrict: '地点待公布',
  metaType: '同城活动',
} as const;

export interface Flow2NodeCopy {
  id: string;
  title: string;
  /** Template with {TITLE} / {TYPE} / {DISTRICT} placeholders, or static. */
  description: string;
}

export const FLOW2_NODE_COPY: readonly Flow2NodeCopy[] = [
  { id: 'registered', title: '报名成功', description: '{TITLE}的名额已锁定，出发有了形状' },
  { id: 'matching', title: '悦仔组局', description: '你的偏好和{TYPE}的节奏，都会为这一桌作数' },
  { id: 'grouped', title: '这桌成形', description: '合适的人逐渐靠近，一场共同体验正在成形' },
  // Node 4 stays deliberately unbound — binding date/district here would
  // contradict the 待公布 fallbacks in the hero meta line.
  { id: 'revealed', title: '活动揭晓', description: '时间、地点和出发提示，会在准备好后揭晓' },
  { id: 'offline', title: '线下体验', description: '从屏幕走进{DISTRICT}，和新伙伴完成一次真实见面' },
  // Story-framing locked — never feature-framing, regardless of personalStoryEnabled.
  { id: 'story', title: '我的故事', description: '这一晚，会成为你故事的一章' },
] as const;

function pick(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function getFlow2HeroStatus(facts?: FlowLifecycleFacts | null): string {
  return `你的${pick(facts?.title, FLOW2_FALLBACKS.heroTitle)}，正在一步步成形`;
}

export function getFlow2HeroMeta(facts?: FlowLifecycleFacts | null): string {
  const date = pick(facts?.dateLabel, FLOW2_FALLBACKS.metaDate);
  const district = pick(facts?.district, FLOW2_FALLBACKS.metaDistrict);
  const type = pick(facts?.typeLabel, FLOW2_FALLBACKS.metaType);
  return `${date} · ${district} · ${type}`;
}

export function resolveFlow2NodeDescription(template: string, facts?: FlowLifecycleFacts | null): string {
  const title = pick(facts?.title, FLOW2_FALLBACKS.nodeTitle)
  const type = pick(facts?.typeLabel, FLOW2_FALLBACKS.nodeType)
  const district = pick(facts?.district, FLOW2_FALLBACKS.nodeDistrict)
  return template
    .replace(/{TITLE}/g, title)
    .replace(/{TYPE}/g, type)
    .replace(/{DISTRICT}/g, district)
}

// ─── Shell / chrome ───

export const FLOW_SHELL_COPY = {
  flow1Title: '先看看怎么玩',
  flow2Title: '这次出发，正在一步步发生',
  identityChipFallback: '你的玩法地图',
  skip: '跳过',
  ctaExplore: '开始探索',
  ctaViewActivity: '查看我的活动',
} as const;

export function getIdentityChipLabel(archetypeNameCn?: string | null): string {
  const name = archetypeNameCn?.trim();
  return name ? `${name}的玩法地图` : FLOW_SHELL_COPY.identityChipFallback;
}
