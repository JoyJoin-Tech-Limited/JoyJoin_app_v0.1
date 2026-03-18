/**
 * Maps each archetype to 5 recommended interest topic IDs.
 * These are displayed as subtle "✨ 推荐" badges in the interest carousel.
 *
 * Selection criteria:
 * - Based on trait profiles (A/C/E/O/X/P dimensions from the personality engine)
 * - Picks topics that align with the archetype's behavioural tendencies
 * - Avoids overly obvious choices to keep recommendations credible
 * - 5 per archetype keeps recommendations sparse and trustworthy
 *
 * Archetype keys match the `archetype` field on the `users` table (simplified Chinese).
 * Topic IDs match the `id` field in `apps/user-client/src/data/interestCarouselData.ts`.
 */
import type { ArchetypeName } from '@shared/personality/archetypeNames';

export const ARCHETYPE_INTEREST_RECOMMENDATIONS = {
  // 开心柯基 – High-energy social spark (X:95, P:85)
  "开心柯基": [
    "culture_standup",    // 🎤 脱口秀 – natural performer
    "culture_memes",      // 😂 玩梗 – loves banter and viral humour
    "lifestyle_sports",   // 🏀 运动 – high-energy outlet
    "culture_script_kill", // 🎲 剧本杀 – social role-play
    "culture_live",       // 🎸 看 Live – group energy highs
  ],

  // 太阳鸡 – Warm, stable positivity (P:92, E:88)
  "太阳鸡": [
    "lifestyle_travel",     // ✈️ 去旅行 – always up for adventure
    "lifestyle_coffee",     // ☕ 咖啡 – casual social anchor
    "culture_music",        // 🎵 音乐 – emotional resonance
    "philosophy_meaning",   // 🌟 聊人生 – reflective warmth
    "lifestyle_photography", // 📸 摄影 – capturing joyful moments
  ],

  // 夸夸豚 – Empathic affirmer (A:95, P:88)
  "夸夸豚": [
    "career_networking",       // 🤝 人脉与合作 – people-first
    "philosophy_meaning",      // 🌟 聊人生 – deep personal sharing
    "philosophy_relationships", // 💔 人际与亲密关系 – relationship depth
    "lifestyle_pets",          // 🐱 吸猫撸狗 – nurturing warmth
    "culture_music",           // 🎵 音乐 – emotional connection
  ],

  // 机智狐 – Curious explorer (O:92, X:78)
  "机智狐": [
    "city_hidden_gems", // 🗺️ 探店 – discovery mindset
    "city_walk",        // 🌉 City Walk – urban curiosity
    "lifestyle_food",   // 🍜 吃喝探索 – sensory novelty
    "career_startup",   // 🚀 创业 – entrepreneurial drive
    "tech_ai",          // 🤖 AI 应用 – cutting-edge fascination
  ],

  // 淡定海豚 – EQ mediator (E:85, A:70)
  "淡定海豚": [
    "lifestyle_coffee",  // ☕ 咖啡 – calm social ritual
    "culture_books",     // 📚 阅读 – thoughtful solo time
    "philosophy_growth", // 🧘 自我成长 – inner focus
    "culture_podcast",   // 🎧 播客 – relaxed learning
    "lifestyle_outdoor", // ⛰️ 户外 – restorative nature
  ],

  // 织网蛛 – Connector and planner (C:85, A:70)
  "织网蛛": [
    "career_networking", // 🤝 人脉与合作 – relationship architecture
    "career_business",   // 💡 商业思维 – strategic perspective
    "career_promotion",  // 🎯 职业成长 – structured ambition
    "city_community",    // 🏘️ 社区生活 – local ecosystem building
    "city_exhibition",   // 🖼️ 看展 – cultural curation
  ],

  // 暖心熊 – Deep listener (A:90, E:80)
  "暖心熊": [
    "philosophy_meaning",      // 🌟 聊人生 – genuine life stories
    "philosophy_relationships", // 💔 人际与亲密关系 – emotional depth
    "culture_books",           // 📚 阅读 – empathy through stories
    "lifestyle_pets",          // 🐱 吸猫撸狗 – comforting companionship
    "lifestyle_wine",          // 🍷 小酌 – intimate slow evenings
  ],

  // 灵感章鱼 – Creative divergent thinker (O:95, C:28)
  "灵感章鱼": [
    "tech_ai",          // 🤖 AI 应用 – imaginative tech use
    "culture_games",    // 🎮 玩游戏 – immersive worlds
    "tech_vr_ar",       // 🥽 VR / AR – boundary-pushing experiences
    "city_exhibition",  // 🖼️ 看展 – visual inspiration
    "culture_movies",   // 🎬 影视内容 – narrative obsession
  ],

  // 沉思猫头鹰 – Deep analytical thinker (O:88, C:80)
  "沉思猫头鹰": [
    "culture_books",           // 📚 阅读 – intellectual depth
    "philosophy_cognition",    // 🔍 认知升级 – structured learning
    "philosophy_social_issues", // ⚖️ 社会与价值观 – principled debate
    "culture_podcast",         // 🎧 播客 – long-form ideas
    "city_architecture",       // 🏛️ 建筑美学 – structural aesthetics
  ],

  // 定心大象 – Stable, grounding anchor (C:90, E:86)
  "定心大象": [
    "philosophy_growth",    // 🧘 自我成长 – deliberate development
    "philosophy_meditation", // 📿 冥想与正念 – centred presence
    "city_parks",           // 🍃 逛公园 – grounded leisure
    "city_community",       // 🏘️ 社区生活 – steady local roots
    "career_promotion",     // 🎯 职业成长 – long-game ambition
  ],

  // 稳如龟 – Patient deep observer (C:90, X:28)
  "稳如龟": [
    "culture_books",         // 📚 阅读 – sustained concentration
    "philosophy_cognition",  // 🔍 认知升级 – methodical insight
    "lifestyle_coffee",      // ☕ 咖啡 – quiet solo ritual
    "philosophy_minimalism", // 🍃 极简生活 – deliberate simplicity
    "philosophy_meditation", // 📿 冥想与正念 – inner stillness
  ],

  // 隐身猫 – Quiet, selective companion (X:22, O:72)
  "隐身猫": [
    "lifestyle_pets",        // 🐱 吸猫撸狗 – low-key comfort
    "culture_games",         // 🎮 玩游戏 – solo or small-group worlds
    "culture_books",         // 📚 阅读 – introspective alone time
    "culture_movies",        // 🎬 影视内容 – immersive escape
    "philosophy_minimalism", // 🍃 极简生活 – minimal social overhead
  ],
} as const satisfies Record<ArchetypeName, readonly string[]>;

/**
 * Returns true if the given topic is recommended for the user's archetype.
 * Safely handles null/undefined archetypes (e.g. users who skipped personality test).
 */
export function isRecommendedForArchetype(
  topicId: string,
  archetypeId: string | undefined | null
): boolean {
  if (!archetypeId) return false;
  const recommendations =
    ARCHETYPE_INTEREST_RECOMMENDATIONS[archetypeId as ArchetypeName];
  if (!recommendations) return false;
  return recommendations.includes(topicId);
}

/**
 * Returns all recommended topic IDs for an archetype, or an empty array if
 * the archetype is unknown or absent.
 */
export function getRecommendedTopics(archetypeId: string | undefined | null): string[] {
  if (!archetypeId) return [];
  return ARCHETYPE_INTEREST_RECOMMENDATIONS[archetypeId as ArchetypeName] ?? [];
}
