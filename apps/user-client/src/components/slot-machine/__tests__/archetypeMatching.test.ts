/**
 * Unit Tests for Archetype Matching in Slot Machine
 * Tests the robust archetype matching logic to prevent mismatches
 */

import { describe, it, expect } from 'vitest';
import { ARCHETYPE_NAMES, validateArchetypeName } from '../archetypeData';

describe('Archetype Matching', () => {
  it('should have all 12 canonical archetype names', () => {
    expect(ARCHETYPE_NAMES).toHaveLength(12);
    expect(ARCHETYPE_NAMES).toEqual([
      "开心柯基",
      "太阳鸡",
      "夸夸豚",
      "机智狐",
      "淡定海豚",
      "织网蛛",
      "暖心熊",
      "灵感章鱼",
      "沉思猫头鹰",
      "定心大象",
      "稳如龟",
      "隐身猫",
    ]);
  });

  describe('validateArchetypeName', () => {
    it('should validate exact matches', () => {
      for (const name of ARCHETYPE_NAMES) {
        expect(validateArchetypeName(name)).toBe(name);
      }
    });

    it('should validate trimmed names (whitespace handling)', () => {
      expect(validateArchetypeName(' 开心柯基 ')).toBe('开心柯基');
      expect(validateArchetypeName('太阳鸡  ')).toBe('太阳鸡');
      expect(validateArchetypeName('  机智狐')).toBe('机智狐');
    });

    it('should return null for unknown archetypes', () => {
      expect(validateArchetypeName('不存在的原型')).toBeNull();
      expect(validateArchetypeName('')).toBeNull();
      expect(validateArchetypeName('Unknown')).toBeNull();
    });

    it('should handle Unicode normalization differences', () => {
      // Most Chinese characters have stable Unicode forms, but test the mechanism
      const normalized = '开心柯基'.normalize('NFC');
      expect(validateArchetypeName(normalized)).toBe('开心柯基');
    });
  });

  describe('Slot Machine Edge Cases', () => {
    it('should handle all valid archetypes without fallback to index 0', () => {
      // This tests that indexOf will find all valid archetypes
      for (const archetype of ARCHETYPE_NAMES) {
        const index = ARCHETYPE_NAMES.indexOf(archetype as any);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(12);
      }
    });

    it('should map each archetype to a unique index', () => {
      const indices = ARCHETYPE_NAMES.map((name, idx) => {
        const foundIndex = ARCHETYPE_NAMES.indexOf(name as any);
        return foundIndex;
      });
      
      // Each archetype should map to its own unique index
      const uniqueIndices = new Set(indices);
      expect(uniqueIndices.size).toBe(12);
    });

    it('should have deterministic ordering', () => {
      // Verify the order matches the canonical ordering from shared module
      expect(ARCHETYPE_NAMES[0]).toBe("开心柯基");
      expect(ARCHETYPE_NAMES[1]).toBe("太阳鸡");
      expect(ARCHETYPE_NAMES[11]).toBe("隐身猫");
    });
  });
});
