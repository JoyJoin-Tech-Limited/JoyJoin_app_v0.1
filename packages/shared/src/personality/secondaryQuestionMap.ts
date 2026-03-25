/**
 * Maps playful secondary question IDs to the UserSecondaryData field and option → value lookup.
 * Kept in a dedicated module so callers don't need to load the full V4 question bank.
 */

export interface SecondaryQuestionMapping {
  field: 'conflictPosture' | 'motivationDirection';
  valueMap: Record<string, string>;
}

export const SECONDARY_QUESTION_MAP: Record<string, SecondaryQuestionMapping> = {
  Q_PLAYFUL_CONFLICT: {
    field: 'conflictPosture',
    valueMap: { A: 'approach', B: 'avoid', C: 'mediate', D: 'avoid' },
  },
  Q_PLAYFUL_MOTIVATION: {
    field: 'motivationDirection',
    valueMap: { A: 'internal', B: 'external', C: 'balanced', D: 'internal' },
  },
};
