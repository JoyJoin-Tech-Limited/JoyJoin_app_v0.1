/**
 * topicHeatUtils.ts
 *
 * Phase 2: Derives 3–5 topic cues for TopicHeatStrip.
 *
 * Primary signal:  recentThemeTitles from pool stats (curated by backend).
 * Secondary signal: archetype trait tags as a graceful fallback when theme
 *                   data is sparse.
 *
 * Future enhancement: a dedicated pool-level topic aggregation API endpoint
 * could replace/augment the archetype fallback with real-time interest
 * frequency data once backend topic intelligence is formalised.
 */
import { archetypeConfig } from "@/lib/archetypes";

export interface TopicCue {
  emoji: string;
  text: string;
}

export interface TopicHeatThemeTitle {
  themeTitle: string | null;
  themeEmoji: string;
}

/**
 * Curated archetype → conversation topic affinities.
 *
 * These hints are intentionally kept in a separate table rather than derived
 * live from `archetypeConfig.traits`, because trait labels (e.g. "能量充沛")
 * are persona descriptors — not conversation topics.  A dedicated mapping
 * produces topic chips that are more actionable and user-facing ("城市探索"
 * rather than "好奇心强").
 *
 * Maintenance note: when a new archetype is added to archetypeConfig, add a
 * corresponding entry here.  If no entry exists the code falls back to
 * archetypeConfig.traits (see third-tier fallback below).
 */
export const ARCHETYPE_TOPIC_HINTS: Record<string, Array<{ emoji: string; text: string }>> = {
  "开心柯基":  [{ emoji: "😂", text: "轻松搞笑" }, { emoji: "🎉", text: "破冰活动" }],
  "太阳鸡":    [{ emoji: "☀️", text: "正能量分享" }, { emoji: "💛", text: "暖心故事" }],
  "夸夸豚":    [{ emoji: "🎯", text: "真心话" }, { emoji: "💬", text: "深度聊天" }],
  "机智狐":    [{ emoji: "🗺️", text: "城市探索" }, { emoji: "🔍", text: "隐藏好物" }],
  "淡定海豚":  [{ emoji: "🧘", text: "慢生活" }, { emoji: "🌊", text: "随性聊聊" }],
  "织网蛛":    [{ emoji: "🕸️", text: "人脉连接" }, { emoji: "🤝", text: "社交网络" }],
  "暖心熊":    [{ emoji: "🫶", text: "温暖陪伴" }, { emoji: "🏡", text: "生活近况" }],
  "灵感章鱼":  [{ emoji: "🎨", text: "创意碰撞" }, { emoji: "💡", text: "灵感发散" }],
  "沉思猫头鹰":[{ emoji: "📖", text: "深度观察" }, { emoji: "🔭", text: "思维碰撞" }],
  "定心大象":  [{ emoji: "🧭", text: "人生方向" }, { emoji: "🌿", text: "稳定成长" }],
  "稳如龟":    [{ emoji: "🍵", text: "慢慢发现" }, { emoji: "🌱", text: "真实自我" }],
  "隐身猫":    [{ emoji: "🌙", text: "安静共鸣" }, { emoji: "📚", text: "小众兴趣" }],
};

/** Fallback topics used when neither theme nor archetype data is available. */
const GENERIC_FALLBACKS: TopicCue[] = [
  { emoji: "💬", text: "真实对话" },
  { emoji: "✨", text: "相遇故事" },
  { emoji: "🎯", text: "共同话题" },
];

/**
 * Derives 3–5 ordered topic cues for display in TopicHeatStrip.
 * The first cue is treated as the "hottest" and receives the strongest visual weight.
 */
export function deriveTopicCues(
  recentThemeTitles: TopicHeatThemeTitle[],
  archetypeBreakdown: Record<string, number> = {}
): TopicCue[] {
  const cues: TopicCue[] = [];
  const seen = new Set<string>();

  // ── Primary: use curated recentThemeTitles ──────────────────────────────────
  for (const { themeTitle, themeEmoji } of recentThemeTitles) {
    if (!themeTitle) continue;
    const key = themeTitle.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cues.push({ emoji: themeEmoji || "💬", text: themeTitle.trim() });
    }
    if (cues.length >= 5) break;
  }

  if (cues.length >= 3) return cues.slice(0, 5);

  // ── Fallback: derive from archetype trait hints ─────────────────────────────
  // Sort archetypes by descending count so dominant archetypes contribute first.
  const sortedArchetypes = Object.entries(archetypeBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([archetype]) => archetype);

  for (const archetype of sortedArchetypes) {
    const hints = ARCHETYPE_TOPIC_HINTS[archetype] ?? [];
    for (const hint of hints) {
      const key = hint.text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        cues.push(hint);
      }
      if (cues.length >= 5) break;
    }
    if (cues.length >= 5) break;
  }

  if (cues.length >= 3) return cues.slice(0, 5);

  // ── Fallback: use archetype trait tags directly ─────────────────────────────
  for (const archetype of sortedArchetypes) {
    const config = archetypeConfig[archetype];
    if (!config?.traits) continue;
    for (const trait of config.traits) {
      const key = trait.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        cues.push({ emoji: "💡", text: trait });
      }
      if (cues.length >= 5) break;
    }
    if (cues.length >= 5) break;
  }

  if (cues.length < 3) {
    for (const fallback of GENERIC_FALLBACKS) {
      const key = fallback.text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        cues.push(fallback);
      }
      if (cues.length >= 3) break;
    }
  }

  if (cues.length > 0) return cues.slice(0, 5);

  // ── Last resort: generic fallbacks ─────────────────────────────────────────
  return GENERIC_FALLBACKS;
}
