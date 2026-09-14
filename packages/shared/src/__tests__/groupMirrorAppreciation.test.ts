import { describe, it, expect } from 'vitest';
import {
  FALLBACK_GROUP_MIRROR_QUESTIONS,
  GROUP_MIRROR_JUDGMENT_MARKERS,
  isAppreciationGroupMirrorQuestion,
  sanitizeGroupMirrorQuestions,
  getFallbackGroupMirrorQuestions,
} from '../groupMirror';

describe('groupMirror appreciation guard (W9, AC-W9.1)', () => {
  it('every curated fallback question is appreciation-only', () => {
    for (const question of FALLBACK_GROUP_MIRROR_QUESTIONS) {
      expect(isAppreciationGroupMirrorQuestion(question.questionText)).toBe(true);
      expect(question.category).toBe('appreciation');
    }
  });

  it('rejects passive-judgment framings', () => {
    expect(isAppreciationGroupMirrorQuestion('谁最不会做饭？')).toBe(false);
    expect(isAppreciationGroupMirrorQuestion('谁今晚最尴尬？')).toBe(false);
    expect(isAppreciationGroupMirrorQuestion('谁最讨厌社交？')).toBe(false);
    expect(isAppreciationGroupMirrorQuestion('谁最让你放松、想多聊两句？')).toBe(true);
  });

  it('strips judgment questions and backfills to the requested count', () => {
    const mixed = [
      { id: 'a', questionText: '谁最不会聊天？', category: 'perception' as const },
      { id: 'b', questionText: '谁的笑容最有感染力？', category: 'appreciation' as const },
      { id: 'c', questionText: '谁最尴尬？', category: 'perception' as const },
    ];
    const safe = sanitizeGroupMirrorQuestions(mixed, 4);
    expect(safe).toHaveLength(4);
    for (const question of safe) {
      expect(isAppreciationGroupMirrorQuestion(question.questionText)).toBe(true);
    }
    // Preserves the accepted live question rather than discarding everything.
    expect(safe[0].questionText).toBe('谁的笑容最有感染力？');
    expect(GROUP_MIRROR_JUDGMENT_MARKERS.length).toBeGreaterThan(0);
  });

  it('is deterministic for identical input', () => {
    const a = sanitizeGroupMirrorQuestions([], 5);
    const b = sanitizeGroupMirrorQuestions([], 5);
    expect(a).toEqual(b);
  });

  it('keeps the legacy random fallback appreciation-only', () => {
    for (const question of getFallbackGroupMirrorQuestions(5)) {
      expect(isAppreciationGroupMirrorQuestion(question.questionText)).toBe(true);
    }
  });
});
