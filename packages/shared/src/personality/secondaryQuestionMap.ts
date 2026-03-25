/**
 * Maps playful secondary question IDs to the UserSecondaryData field and option → value lookup.
 * Kept in a dedicated module so callers don't need to load the full V4 question bank.
 */

export interface SecondaryQuestionMapping {
  field: 'conflictPosture' | 'motivationDirection';
  valueMap: Record<string, string>;
}

export const SECONDARY_QUESTION_MAP: Record<string, SecondaryQuestionMapping> = {
  // Q_PLAYFUL_EMOJI — Conflict Instinct Tap (emoji_tap question in questionsV4.ts)
  // Options map to conflictPosture based on the reaction chosen.
  Q_PLAYFUL_EMOJI: {
    field: 'conflictPosture',
    valueMap: {
      direct: 'approach',  // 直接说：好了好了，你们都有道理
      dove: 'mediate',     // 发条轻松消息转移话题
      dm: 'mediate',       // 私信其中一个：你还好吗？
      leave: 'avoid',      // 默默退出群聊一小会儿
      popcorn: 'avoid',    // 吃瓜围观，看看怎么发展
    },
  },
  // Note: Q_PLAYFUL_SLIDER measures X/P trait intensity (social energy), not a secondary
  // data dimension, so it is intentionally not listed here.
};
