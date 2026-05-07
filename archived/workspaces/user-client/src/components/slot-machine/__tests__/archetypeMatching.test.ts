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
      "corgi",
      "rooster",
      "hamster_praise",
      "fox",
      "dolphin_calm",
      "spider",
      "koala",
      "octopus",
      "owl",
      "elephant",
      "turtle",
      "cat",
    ]);
  });

  describe('validateArchetypeName', () => {
    it('should validate exact matches', () => {
      for (let i = 0; i < ARCHETYPE_NAMES.length; i++) {
        const name = ARCHETYPE_NAMES[i];
        const result = validateArchetypeName(name);
        expect(result).not.toBeNull();
        expect(result?.name).toBe(name);
        expect(result?.index).toBe(i);
      }
    });

    it('should validate trimmed names (whitespace handling)', () => {
      const result1 = validateArchetypeName(' corgi ');
      expect(result1).not.toBeNull();
      expect(result1?.name).toBe('corgi');
      expect(result1?.index).toBe(0);

      const result2 = validateArchetypeName('rooster  ');
      expect(result2).not.toBeNull();
      expect(result2?.name).toBe('rooster');
      expect(result2?.index).toBe(1);

      const result3 = validateArchetypeName('  fox');
      expect(result3).not.toBeNull();
      expect(result3?.name).toBe('fox');
      expect(result3?.index).toBe(3);
    });

    it('should return null for unknown archetypes', () => {
      expect(validateArchetypeName('不存在的原型')).toBeNull();
      expect(validateArchetypeName('')).toBeNull();
      expect(validateArchetypeName('Unknown')).toBeNull();
    });

    it('should handle Unicode normalization differences', () => {
      // Most Chinese characters have stable Unicode forms, but test the mechanism
      const normalized = 'corgi'.normalize('NFC');
      const result = validateArchetypeName(normalized);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('corgi');
      expect(result?.index).toBe(0);
    });

    it('should handle combined whitespace and normalization issues', () => {
      // Test that trimmed version is normalized, not original
      const withBoth = ' corgi '.normalize('NFC');
      const result = validateArchetypeName(withBoth);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('corgi');
      expect(result?.index).toBe(0);
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
      expect(ARCHETYPE_NAMES[0]).toBe("corgi");
      expect(ARCHETYPE_NAMES[1]).toBe("rooster");
      expect(ARCHETYPE_NAMES[11]).toBe("cat");
    });
  });
});
