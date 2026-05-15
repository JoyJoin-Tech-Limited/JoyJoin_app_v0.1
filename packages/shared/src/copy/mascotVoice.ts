/**
 * 悦仔常用句式库 — 🟢 Nice to Have (Creative Reference)
 *
 * A library of 悦仔 sentence patterns for consistent mascot voice.
 * These are reference patterns — not an exhaustive list, but a starting point
 * for AI Agent and human copywriters.
 */

import { DEFAULT_MASCOT_DISPLAY_NAME } from '../mascotConfig.js';

const MN = DEFAULT_MASCOT_DISPLAY_NAME;

/**
 * Sentence pattern categories for 悦仔 voice.
 * Each pattern includes a template with {{verb}} or {{noun}} slots.
 */
export const MASCOT_PATTERNS = {
  /** Opening / greeting */
  greeting: [
    `哈啰！我是${MN}，今晚的助手主持人。`,
    `嗨，我是${MN}~`,
  ],

  /** Observation / discovery — 悦仔悄悄发现了什么 */
  observation: [
    `${MN}偷偷看了眼结果`,
    `${MN}悄悄看了一眼，觉得你们会合得来`,
    `${MN}翻了翻记录`,
    `${MN}看了看大家的特质`,
  ],

  /** Recommendation / suggestion — guiding the user */
  suggestion: [
    `${MN}推荐你们试试{phrase}`,
    `想{goal}？这个适合你们！`,
    `选这个准没错！`,
  ],

  /** Confirmation / agreement — when user makes a choice */
  confirmation: [
    `好，我们就玩{phrase}！`,
    `${MN}已收到~`,
    `没问题，交给${MN}吧！`,
  ],

  /** Waiting / loading — personifying the wait time */
  waiting: [
    `${MN}正在{verb}，马上就好…`,
    `${MN}偷偷看了眼结果，嘴角已经上扬。`,
    `${MN}正在编假话…`,
    `${MN}正在分析你的性格密码…`,
  ],

  /** Error / apology — graceful failure */
  apology: [
    `${MN}遇到点小麻烦，再试试看~`,
    `${MN}没编出来，重新试试吧~`,
    `${MN}确认过了，{reason}`,
  ],

  /** Encouragement — pushing user to take action */
  encouragement: [
    `主动和桌友打个招呼如何？`,
    `先逛逛发现页？`,
    `来一局活动吧？`,
  ],

  /** Empathy / connection — acknowledging user's state */
  empathy: [
    `${MN}看了又看，还没有{thing}`,
    `${MN}这里暂时安安静静的`,
  ],

  /** Reveal / surprise — dramatic reveal moment */
  reveal: [
    `噔噔！结果揭晓~`,
    `让大家久等了！`,
    `${MN}已经替你们找好了~`,
  ],

  /** Farewell / closing */
  farewell: [
    `今晚和你们玩得很开心，下次见！`,
    `${MN}先退下了，有需要随时叫我~`,
  ],
} as const;

/**
 * Get a random pattern from a category.
 * Useful for loading whispers and non-critical copy.
 */
export function getRandomPattern(category: keyof typeof MASCOT_PATTERNS): string {
  const patterns = MASCOT_PATTERNS[category];
  return patterns[Math.floor(Math.random() * patterns.length)] as string;
}

/**
 * Interpolate a mascot pattern with variables.
 * Replaces {{verb}}, {{phrase}}, {{goal}}, {{thing}}, {{reason}} placeholders.
 */
export function interpolatePattern(
  pattern: string,
  vars?: Record<string, string>
): string {
  if (!vars) return pattern;
  let result = pattern;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}
