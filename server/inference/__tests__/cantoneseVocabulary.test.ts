import { describe, it, expect } from 'vitest';
import { 
  PARTICLES, 
  VERBS, 
  ADJECTIVES, 
  PHRASES, 
  HK_TERMS, 
  SZ_TERMS, 
  SLANG,
  VOCABULARY_STATS,
  CANTONESE_PATTERN 
} from '../cantoneseVocabulary';

describe('Cantonese Vocabulary', () => {
  describe('UTF-8 integrity', () => {
    it('should not contain U+FFFD replacement characters (mojibake)', () => {
      const allTerms = [
        ...PARTICLES,
        ...VERBS,
        ...ADJECTIVES,
        ...PHRASES,
        ...HK_TERMS,
        ...SZ_TERMS,
        ...SLANG,
      ];

      const corruptedTerms = allTerms.filter(term => term.includes('\uFFFD'));
      
      expect(corruptedTerms).toHaveLength(0);
    });

    it('should have expected vocabulary counts', () => {
      expect(PARTICLES.length).toBeGreaterThanOrEqual(35);
      expect(VERBS.length).toBeGreaterThanOrEqual(60);
      expect(ADJECTIVES.length).toBeGreaterThanOrEqual(45);
      expect(PHRASES.length).toBeGreaterThanOrEqual(50);
      expect(HK_TERMS.length).toBeGreaterThanOrEqual(75);
      expect(SZ_TERMS.length).toBeGreaterThanOrEqual(25);
      expect(SLANG.length).toBeGreaterThanOrEqual(30);
    });

    it('should have 368+ total terms', () => {
      expect(VOCABULARY_STATS.total).toBeGreaterThanOrEqual(368);
    });
  });

  describe('regex pattern', () => {
    it('should match Cantonese expressions', () => {
      const testCases = [
        { text: '你喺边度啊？', expected: true },
        { text: '我去金钟食嘢', expected: true },
        { text: '好正喎！', expected: true },
        { text: 'Hello world', expected: false },
      ];

      testCases.forEach(({ text, expected }) => {
        const hasMatch = CANTONESE_PATTERN.test(text);
        CANTONESE_PATTERN.lastIndex = 0;
        expect(hasMatch).toBe(expected);
      });
    });
  });
});
