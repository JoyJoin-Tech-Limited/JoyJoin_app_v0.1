import { describe, it, expect } from 'vitest';
import { matchOccupation } from '../occupationMatcher';

describe('occupationMatcher - Debug Test', () => {
  const testCases = [
    { input: '投资', expected: '金融' },
    { input: 'PE', expected: '金融' },
    { input: 'VC', expected: '金融' },
    { input: '投行', expected: '金融' },
    { input: '基金', expected: '金融' },
    { input: '证券', expected: '金融' },
    { input: '券商', expected: '金融' },
    { input: '投资经理', expected: '金融' },
    { input: 'PE投资', expected: '金融' },
    { input: 'VC投资人', expected: '金融' },
    { input: '做投资的', expected: '金融' },
    { input: '搞金融的', expected: '金融' },
    { input: '后端工程师', expected: '技术' },
    { input: '前端开发', expected: '技术' },
    { input: '软件工程师', expected: '技术' },
  ];

  testCases.forEach(({ input, expected }) => {
    it(`should classify "${input}" as ${expected}`, () => {
      const result = matchOccupation(input);
      console.log(`Input: "${input}" → Result: ${result?.category} (occupation: ${result?.occupation})`);
      expect(result).toBeDefined();
      expect(result?.category).toBe(expected);
    });
  });
});
