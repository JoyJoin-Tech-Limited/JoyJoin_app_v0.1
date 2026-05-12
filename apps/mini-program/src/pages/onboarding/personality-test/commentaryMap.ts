/**
 * Post-answer commentary pool for Xiaoyue's reactive speech bubble.
 * Maps question-option combinations to warm, playful reactions.
 *
 * TODO: Migrate to server-delivered commentary once backend supports it.
 * Current implementation uses a local deterministic hash to avoid bundle bloat.
 */

import type { AnswerOption } from './PersonalityTestAnswerArea'

const COMMENTARY_POOL = [
  '这个选择很有你的风格～',
  '我懂了，这就是你的节奏。',
  '嗯嗯，继续跟着感觉走～',
  '这个答案让我更了解你了。',
  '果然，你就是这样的人。',
  '这个选择很有意思，记下来！',
  '感受到了，你的独特气场。',
  '这个答案在发光诶 ✨',
  '悦仔点点头，继续！',
  '越来越清晰了，保持这个状态～',
  '这个选择让我想多认识你一点。',
  '嘿嘿，和我猜的一样～',
  '这个答案有种特别的温度。',
  '跟着心选，不会错的。',
  '这个答案让悦仔眼睛一亮！',
  '感受到了，你的真实一面。',
]

/**
 * Resolve a deterministic commentary for a given question + option.
 * Combines questionId hash + option text hash for variety across questions.
 */
export function resolveCommentary(questionId: string, option: AnswerOption): string {
  const baseHash = questionId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const optionHash = option.text.charCodeAt(0)
  const index = Math.abs(baseHash + optionHash) % COMMENTARY_POOL.length
  return COMMENTARY_POOL[index]!
}
