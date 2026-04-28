/**
 * V4 Adaptive Assessment - 60-Question Bank (Optimized)
 * 自适应性格测评 V4 - 优化后的60题题库
 *
 * Split into modules to stay within file-size limits:
 *   - questionsV4L1: L1 foundation questions (Q1-Q15)
 *   - questionsV4L2: L2 core exploration questions (Q16-Q50)
 *   - questionsV4Extended: L2 supplement + L3 precision + reverse scoring + P dimension
 *   - questionsV4Advanced: O dimension + forced choice + confusion pairs
 *   - questionsV4Attractor: Attractor + high confusion + playful questions
 */

import { AdaptiveQuestion } from './types';
import { questionsV4L1 } from './questionsV4L1';
import { questionsV4L2 } from './questionsV4L2';
import { questionsV4Extended } from './questionsV4Extended';
import { questionsV4Advanced } from './questionsV4Advanced';
import { questionsV4Attractor } from './questionsV4Attractor';

export const questionsV4: AdaptiveQuestion[] = [
  ...questionsV4L1,
  ...questionsV4L2,
  ...questionsV4Extended,
  ...questionsV4Advanced,
  ...questionsV4Attractor,
];

export const ANCHOR_QUESTION_IDS = questionsV4
  .filter(q => q.isAnchor)
  .map(q => q.id);

export function getQuestionById(id: string): AdaptiveQuestion | undefined {
  return questionsV4.find(q => q.id === id);
}

export function getQuestionsByLevel(level: 1 | 2 | 3): AdaptiveQuestion[] {
  return questionsV4.filter(q => q.level === level);
}

export function getAnchorQuestions(): AdaptiveQuestion[] {
  return questionsV4.filter(q => q.isAnchor);
}

export function getReversedQuestions(): AdaptiveQuestion[] {
  return questionsV4.filter(q => q.isReversed);
}

export function getAttentionCheckQuestions(): AdaptiveQuestion[] {
  return questionsV4.filter(q => q.isAttentionCheck);
}

export function validateAttentionCheck(questionId: string, selectedOption: string): boolean {
  const question = getQuestionById(questionId);
  if (!question?.isAttentionCheck) return true;
  return selectedOption === 'C';
}

export const REVERSED_QUESTION_IDS = questionsV4
  .filter(q => q.isReversed)
  .map(q => q.id);

export const ATTENTION_CHECK_QUESTION_IDS = questionsV4
  .filter(q => q.isAttentionCheck)
  .map(q => q.id);

// Re-export secondary question map contracts
export type { SecondaryQuestionMapping } from './secondaryQuestionMap';
export { SECONDARY_QUESTION_MAP } from './secondaryQuestionMap';
