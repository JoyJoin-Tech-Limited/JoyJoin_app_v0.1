/**
 * Smoke tests for archetypeNames module
 * Verifies the canonical archetype ordering and helper functions
 */

import { 
  ARCHETYPE_CANONICAL_ORDER, 
  ARCHETYPE_COUNT,
  getArchetypeIndex,
  formatTypeNo,
  getArchetypeTypeNo,
  type ArchetypeName
} from '../archetypeNames';

describe('archetypeNames', () => {
  describe('ARCHETYPE_CANONICAL_ORDER', () => {
    it('should contain exactly 12 archetypes', () => {
      expect(ARCHETYPE_CANONICAL_ORDER).toHaveLength(12);
    });

    it('should contain all expected archetypes', () => {
      const expected = [
        '开心柯基',
        '太阳鸡',
        '夸夸豚',
        '机智狐',
        '淡定海豚',
        '织网蛛',
        '暖心熊',
        '灵感章鱼',
        '沉思猫头鹰',
        '定心大象',
        '稳如龟',
        '隐身猫',
      ];
      expect(ARCHETYPE_CANONICAL_ORDER).toEqual(expected);
    });

    it('should be a readonly array', () => {
      // TypeScript compile-time check
      // @ts-expect-error - should not allow push to readonly array
      ARCHETYPE_CANONICAL_ORDER.push('test');
    });
  });

  describe('ARCHETYPE_COUNT', () => {
    it('should equal 12', () => {
      expect(ARCHETYPE_COUNT).toBe(12);
    });
  });

  describe('getArchetypeIndex', () => {
    it('should return 1-based index for valid archetypes', () => {
      expect(getArchetypeIndex('开心柯基')).toBe(1);
      expect(getArchetypeIndex('机智狐')).toBe(4);
      expect(getArchetypeIndex('隐身猫')).toBe(12);
    });

    it('should return null for invalid archetype', () => {
      expect(getArchetypeIndex('不存在')).toBeNull();
      expect(getArchetypeIndex('')).toBeNull();
    });

    it('should be case-sensitive', () => {
      expect(getArchetypeIndex('开心柯基')).toBe(1);
      // Different characters should not match
      expect(getArchetypeIndex('开心柯基 ')).toBeNull(); // with space
    });
  });

  describe('formatTypeNo', () => {
    it('should format index with leading zero', () => {
      expect(formatTypeNo(1)).toBe('01/12');
      expect(formatTypeNo(4)).toBe('04/12');
      expect(formatTypeNo(10)).toBe('10/12');
      expect(formatTypeNo(12)).toBe('12/12');
    });

    it('should handle out-of-range indices gracefully', () => {
      expect(formatTypeNo(0)).toBe('00/12');
      expect(formatTypeNo(13)).toBe('13/12');
    });
  });

  describe('getArchetypeTypeNo', () => {
    it('should return formatted TYPE for valid archetypes', () => {
      expect(getArchetypeTypeNo('开心柯基')).toBe('01/12');
      expect(getArchetypeTypeNo('机智狐')).toBe('04/12');
      expect(getArchetypeTypeNo('隐身猫')).toBe('12/12');
    });

    it('should return "00/12" for invalid archetype', () => {
      expect(getArchetypeTypeNo('不存在')).toBe('00/12');
      expect(getArchetypeTypeNo('')).toBe('00/12');
    });
  });

  describe('Integration tests', () => {
    it('should have consistent ordering across all archetypes', () => {
      ARCHETYPE_CANONICAL_ORDER.forEach((archetype, index) => {
        const archetypeIndex = getArchetypeIndex(archetype);
        expect(archetypeIndex).toBe(index + 1);
        
        const typeNo = getArchetypeTypeNo(archetype);
        const expectedTypeNo = formatTypeNo(index + 1);
        expect(typeNo).toBe(expectedTypeNo);
      });
    });
  });
});
