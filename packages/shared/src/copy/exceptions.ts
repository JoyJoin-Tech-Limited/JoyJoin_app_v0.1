/**
 * 🟠 Orange-Tier Exception Templates
 *
 * "Permitted with required framing" — words that are conditionally allowed
 * when properly framed in social-experience language.
 *
 * These templates ensure the framing requirement is met consistently.
 */

import { DEFAULT_MASCOT_DISPLAY_NAME } from '../mascotConfig.js';

/**
 * Orange word entry in the exception table.
 * Documents when and how a word may appear in user-facing copy.
 */
export interface OrangeWordEntry {
  word: string;
  allowedContext: string;
  bannedContext: string;
  framingTemplate?: string;
  note?: string;
}

export const ORANGE_WORDS: OrangeWordEntry[] = [
  {
    word: '匹配',
    allowedContext: 'Internal machine identifiers and API contracts only (matchStatus, matchingService, schema fields).',
    bannedContext:
      'User-facing copy: "匹配中", "匹配成功", "为你匹配", "匹配算法", "系统匹配", "匹配度"',
    framingTemplate: `{context}排桌`,
    note: '2026-08-18: systematic softening to event-booking vocabulary (排桌/合拍/同桌/轮桌畅聊) for WeChat category positioning — see docs/runbooks/wechat-review-submission.md',
  },
  {
    word: 'AI',
    allowedContext:
      'Honest disclosure when explicitly asked by user. Must be passive/disclosure, not proactive炫耀.',
    bannedContext:
      'Feature names, promotional copy, proactive mentions, "AI驱动" without context',
    framingTemplate: `${DEFAULT_MASCOT_DISPLAY_NAME}是 AI 驱动的，但决定是大家一起做的`,
    note: 'Per governance rules: 被追问时承认是AI, but don\'t proactively surface',
  },
  {
    word: '推荐',
    allowedContext:
      'Personified through mascot: "悦仔推荐…"',
    bannedContext:
      'Impersonal: "系统推荐", "算法推荐", "平台推荐"',
    framingTemplate: `${DEFAULT_MASCOT_DISPLAY_NAME}推荐{context}`,
    note: 'Always attribute to 悦仔, never to system/algorithm',
  },
];

/**
 * Find orange-word violations in copy text.
 * Returns list of violations with suggested framing.
 */
export function findOrangeWordViolations(text: string): {
  word: string;
  suggestion: string;
}[] {
  const violations: { word: string; suggestion: string }[] = [];

  for (const entry of ORANGE_WORDS) {
    // Check for banned-context usage
    if (text.includes(entry.word)) {
      // Simple heuristic: if the word appears without mascot attribution
      // and isn't in the allowed pattern, flag it
      for (const banned of entry.bannedContext.split(',')) {
        if (text.includes(banned.trim())) {
          violations.push({
            word: entry.word,
            suggestion: entry.framingTemplate
              ? `Frame as: "${entry.framingTemplate}"`
              : `Use in allowed context only: ${entry.allowedContext}`,
          });
          break;
        }
      }
    }
  }

  return violations;
}

/**
 * Register a one-time exception to a 🔴 rule.
 * Used via Copy Council approval process.
 */
export interface RuleException {
  id: string;
  ruleViolated: string;
  reason: string;
  copyText: string;
  approvedBy: string;
  approvedAt: Date;
  expiresAt: Date;
  notes?: string;
}

const activeExceptions: RuleException[] = [];

/**
 * Register a new exception. Requires PM + engineering lead dual sign-off.
 * Must have an expiration date.
 */
export function registerException(exception: RuleException): void {
  activeExceptions.push(exception);
}

/**
 * Get all active (non-expired) exceptions.
 */
export function getActiveExceptions(): RuleException[] {
  const now = new Date();
  return activeExceptions.filter((e) => e.expiresAt > now);
}

/**
 * Check if a copy text is covered by an active exception.
 */
export function isExceptionFor(text: string): boolean {
  return getActiveExceptions().some(
    (e) => e.copyText === text || text.includes(e.copyText)
  );
}
