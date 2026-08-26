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
 *
 * 2026-08-05 (copy-owner sync, value-first revision): Flow 2 node titles
 * 悦仔组局→等待同频桌友 and 这桌成形→桌友到齐 (mirror the pool-registration
 * teaser nodes); dropped the vague process word 「一步步」 from the hero status
 * (「正在一步步成形」→「正在成形」) and the Flow 2 shell title (「正在一步步发生」→
 * 「正在成形」) — same principle as the teaser voice-line revision.
 *
 * 2026-08-26 (PR-5 双仪式合并): the Flow 1 intro overlay is retired. The
 * entry explainer survives only as FLOW1_ENTRY_COPY, condensed into the
 * one-time Discover arrival coachmark.
 */

// ─── Play-mode entries (Discover arrival coachmark) ───
// Eyebrows disambiguate the two 盲盒 modes at a glance (2026-08-03 revamp).

export const FLOW1_ENTRY_COPY = {
  event: {
    eyebrow: '和新朋友同桌',
    title: '盲盒活动',
    /** Concrete mechanics: 选活动 → 凑成一桌 → 线下. */
    bannerLine: '挑一场活动，凑成一桌，线下见',
  },
  street: {
    eyebrow: '一个人也能玩',
    title: '街头盲盒',
    /** Invitation/story framing ONLY — no availability, schedule, or NPC-presence claims. */
    bannerLine: '一条线索引路，把城市走成故事',
  },
} as const;

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
  { id: 'matching', title: '等待同频桌友', description: '你的偏好和{TYPE}的节奏，都会为这一桌作数' },
  { id: 'grouped', title: '桌友到齐', description: '合适的人逐渐靠近，一场共同体验正在成形' },
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
  return `你的${pick(facts?.title, FLOW2_FALLBACKS.heroTitle)}，正在成形`;
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
  flow2Title: '这次出发，正在成形',
  identityChipFallback: '你的地图',
  skip: '跳过',
  ctaViewActivity: '查看我的活动',
} as const;

export function getIdentityChipLabel(archetypeNameCn?: string | null): string {
  const name = archetypeNameCn?.trim();
  return name ? `${name}·地图` : FLOW_SHELL_COPY.identityChipFallback;
}
