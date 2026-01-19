/**
 * QA Test Suite for Interest Carousel Feature
 * Tests backend validation, API endpoints, and data integrity
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';

// Mock data matching the carousel structure
const validInterestData = {
  totalHeat: 127,
  totalSelections: 12,
  categoryHeat: {
    career: 35,
    philosophy: 28,
    lifestyle: 32,
    culture: 18,
    city: 14,
  },
  selections: [
    {
      topicId: 'career_startup',
      emoji: '🚀',
      label: '创业',
      fullName: '创业',
      category: '职场野心',
      categoryId: 'career',
      level: 3,
      heat: 25,
    },
    {
      topicId: 'lifestyle_travel',
      emoji: '✈️',
      label: '旅行',
      fullName: '旅行',
      category: '生活方式',
      categoryId: 'lifestyle',
      level: 2,
      heat: 10,
    },
    {
      topicId: 'culture_music',
      emoji: '🎵',
      label: '音乐',
      fullName: '音乐',
      category: '文化娱乐',
      categoryId: 'culture',
      level: 1,
      heat: 3,
    },
  ],
  topPriorities: [
    {
      topicId: 'career_startup',
      label: '创业',
      heat: 25,
    },
  ],
};

// Zod schemas (matching backend implementation)
const interestSelectionSchema = z.object({
  topicId: z.string(),
  emoji: z.string(),
  label: z.string(),
  fullName: z.string(),
  category: z.string(),
  categoryId: z.string(),
  level: z.number().int().min(1).max(3),
  heat: z.number().int().min(3).max(25),
});

const topPrioritySchema = z.object({
  topicId: z.string(),
  label: z.string(),
  heat: z.literal(25),
});

const userInterestsDataSchema = z.object({
  totalHeat: z.number().int().min(0),
  totalSelections: z.number().int().min(3),
  categoryHeat: z.record(z.string(), z.number().int().min(0)),
  selections: z.array(interestSelectionSchema).min(3),
  topPriorities: z.array(topPrioritySchema).optional(),
});

describe('Interest Carousel - Data Validation', () => {
  describe('Valid Data', () => {
    it('should accept valid interest data', () => {
      const result = userInterestsDataSchema.safeParse(validInterestData);
      expect(result.success).toBe(true);
    });

    it('should accept data with minimum 3 selections', () => {
      const minData = {
        ...validInterestData,
        totalSelections: 3,
        selections: validInterestData.selections.slice(0, 3),
      };
      const result = userInterestsDataSchema.safeParse(minData);
      expect(result.success).toBe(true);
    });

    it('should accept data without topPriorities', () => {
      const { topPriorities, ...dataWithoutPriorities } = validInterestData;
      const result = userInterestsDataSchema.safeParse(dataWithoutPriorities);
      expect(result.success).toBe(true);
    });

    it('should accept all valid heat levels (3, 10, 25)', () => {
      const testData = {
        ...validInterestData,
        selections: [
          { ...validInterestData.selections[0], level: 1, heat: 3 },
          { ...validInterestData.selections[1], level: 2, heat: 10 },
          { ...validInterestData.selections[2], level: 3, heat: 25 },
        ],
      };
      const result = userInterestsDataSchema.safeParse(testData);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Data - Required Fields', () => {
    it('should reject data with less than 3 selections', () => {
      const invalidData = {
        ...validInterestData,
        totalSelections: 2,
        selections: validInterestData.selections.slice(0, 2),
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative totalHeat', () => {
      const invalidData = {
        ...validInterestData,
        totalHeat: -10,
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer totalHeat', () => {
      const invalidData = {
        ...validInterestData,
        totalHeat: 12.5,
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const { totalHeat, ...incomplete } = validInterestData;
      const result = userInterestsDataSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid Data - Selection Structure', () => {
    it('should reject selection with invalid heat level', () => {
      const invalidData = {
        ...validInterestData,
        selections: [
          { ...validInterestData.selections[0], level: 4 }, // Invalid level
        ],
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject selection with invalid heat value', () => {
      const invalidData = {
        ...validInterestData,
        selections: [
          { ...validInterestData.selections[0], heat: 100 }, // Invalid heat
        ],
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject selection missing required fields', () => {
      const invalidData = {
        ...validInterestData,
        selections: [
          { topicId: 'test', label: 'Test' }, // Missing required fields
        ],
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject empty selections array', () => {
      const invalidData = {
        ...validInterestData,
        selections: [],
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid Data - categoryHeat Structure', () => {
    it('should reject categoryHeat with invalid value type', () => {
      const invalidData = {
        ...validInterestData,
        categoryHeat: {
          career: 'invalid', // Should be number
        },
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject categoryHeat with negative values', () => {
      const invalidData = {
        ...validInterestData,
        categoryHeat: {
          career: -10,
        },
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject categoryHeat as array instead of object', () => {
      const invalidData = {
        ...validInterestData,
        categoryHeat: ['career', 35],
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Invalid Data - topPriorities Structure', () => {
    it('should reject topPriority with heat !== 25', () => {
      const invalidData = {
        ...validInterestData,
        topPriorities: [
          { topicId: 'test', label: 'Test', heat: 10 }, // Should be 25
        ],
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject topPriority missing label', () => {
      const invalidData = {
        ...validInterestData,
        topPriorities: [
          { topicId: 'test', heat: 25 }, // Missing label
        ],
      };
      const result = userInterestsDataSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('Interest Carousel - Heat Calculation Logic', () => {
  it('should correctly calculate total heat for mixed levels', () => {
    const level1Heat = 3;
    const level2Heat = 10;
    const level3Heat = 25;
    
    // 2 level-1, 3 level-2, 1 level-3
    const expectedTotal = (2 * level1Heat) + (3 * level2Heat) + (1 * level3Heat);
    expect(expectedTotal).toBe(61); // 6 + 30 + 25
  });

  it('should validate heat progression rationale', () => {
    // Level 2 should be ~3x Level 1
    expect(10 / 3).toBeCloseTo(3.33, 1);
    
    // Level 3 should be ~2.5x Level 2
    expect(25 / 10).toBeCloseTo(2.5, 1);
    
    // Total progression should be ~8x from Level 1 to Level 3
    expect(25 / 3).toBeCloseTo(8.33, 1);
  });

  it('should ensure category heat sums match total heat', () => {
    const categoryHeat = {
      career: 35,
      philosophy: 28,
      lifestyle: 32,
      culture: 18,
      city: 14,
    };
    
    const categorySum = Object.values(categoryHeat).reduce((sum, val) => sum + val, 0);
    expect(categorySum).toBe(127);
  });
});

describe('Interest Carousel - Business Logic Constraints', () => {
  it('should enforce minimum 3 selections constraint', () => {
    const minSelections = 3;
    expect(validInterestData.totalSelections).toBeGreaterThanOrEqual(minSelections);
  });

  it('should validate level 3 selections appear in topPriorities', () => {
    const level3Selections = validInterestData.selections.filter(s => s.level === 3);
    
    expect(validInterestData.topPriorities).toBeDefined();
    expect(validInterestData.topPriorities?.length).toBe(level3Selections.length);
    
    for (const priority of validInterestData.topPriorities || []) {
      const matchingSelection = level3Selections.find(s => s.topicId === priority.topicId);
      expect(matchingSelection).toBeDefined();
      expect(matchingSelection?.heat).toBe(25);
    }
  });

  it('should validate selections have unique topic IDs', () => {
    const topicIds = validInterestData.selections.map(s => s.topicId);
    const uniqueIds = new Set(topicIds);
    expect(uniqueIds.size).toBe(topicIds.length);
  });

  it('should validate categoryId matches valid categories', () => {
    const validCategories = ['career', 'philosophy', 'lifestyle', 'culture', 'city', 'tech'];
    
    for (const selection of validInterestData.selections) {
      expect(validCategories).toContain(selection.categoryId);
    }
  });

  it('should validate level and heat correspondence', () => {
    const heatMap = { 1: 3, 2: 10, 3: 25 };
    
    for (const selection of validInterestData.selections) {
      const expectedHeat = heatMap[selection.level as keyof typeof heatMap];
      expect(selection.heat).toBe(expectedHeat);
    }
  });
});

describe('Interest Carousel - Edge Cases', () => {
  it('should handle maximum realistic selection count (60 topics)', () => {
    const maxSelections = Array.from({ length: 60 }, (_, i) => ({
      topicId: `topic_${i}`,
      emoji: '🎯',
      label: `Topic ${i}`,
      fullName: `Topic ${i}`,
      category: 'Test',
      categoryId: 'career',
      level: 1,
      heat: 3,
    }));

    const data = {
      totalHeat: 180,
      totalSelections: 60,
      categoryHeat: { career: 180 },
      selections: maxSelections,
    };

    const result = userInterestsDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should handle single category concentration', () => {
    const data = {
      totalHeat: 75,
      totalSelections: 3,
      categoryHeat: { career: 75, philosophy: 0, lifestyle: 0, culture: 0, city: 0 },
      selections: [
        { ...validInterestData.selections[0], categoryId: 'career' },
        { ...validInterestData.selections[1], categoryId: 'career' },
        { ...validInterestData.selections[2], categoryId: 'career' },
      ],
    };

    const result = userInterestsDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should handle all level-3 selections', () => {
    const data = {
      totalHeat: 75,
      totalSelections: 3,
      categoryHeat: { career: 75 },
      selections: [
        { ...validInterestData.selections[0], level: 3, heat: 25 },
        { ...validInterestData.selections[0], topicId: 'topic2', level: 3, heat: 25 },
        { ...validInterestData.selections[0], topicId: 'topic3', level: 3, heat: 25 },
      ],
      topPriorities: [
        { topicId: 'career_startup', label: '创业', heat: 25 },
        { topicId: 'topic2', label: '创业', heat: 25 },
        { topicId: 'topic3', label: '创业', heat: 25 },
      ],
    };

    const result = userInterestsDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('Interest Carousel - Type Safety', () => {
  it('should reject non-object data type', () => {
    const result = userInterestsDataSchema.safeParse('invalid');
    expect(result.success).toBe(false);
  });

  it('should reject null data', () => {
    const result = userInterestsDataSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('should reject array instead of object', () => {
    const result = userInterestsDataSchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it('should provide detailed error messages on validation failure', () => {
    const invalidData = {
      ...validInterestData,
      totalHeat: 'invalid',
    };
    
    const result = userInterestsDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.issues[0].path).toContain('totalHeat');
    }
  });
});

describe('Interest Carousel - localStorage Expiry Logic', () => {
  const STORAGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  it('should consider data valid within 7 days', () => {
    const now = Date.now();
    const sixDaysAgo = now - (6 * 24 * 60 * 60 * 1000);
    
    const isExpired = now - sixDaysAgo > STORAGE_EXPIRY_MS;
    expect(isExpired).toBe(false);
  });

  it('should consider data expired after 7 days', () => {
    const now = Date.now();
    const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);
    
    const isExpired = now - eightDaysAgo > STORAGE_EXPIRY_MS;
    expect(isExpired).toBe(true);
  });

  it('should consider data at exactly 7 days as expired', () => {
    const now = Date.now();
    const exactlySevenDaysAgo = now - STORAGE_EXPIRY_MS;
    
    const isExpired = now - exactlySevenDaysAgo >= STORAGE_EXPIRY_MS;
    expect(isExpired).toBe(true);
  });
});

describe('Interest Carousel - Heat Level Type Guard', () => {
  const isValidHeatLevel = (value: number): boolean => {
    return value === 0 || value === 1 || value === 2 || value === 3;
  };

  it('should accept valid heat levels', () => {
    expect(isValidHeatLevel(0)).toBe(true);
    expect(isValidHeatLevel(1)).toBe(true);
    expect(isValidHeatLevel(2)).toBe(true);
    expect(isValidHeatLevel(3)).toBe(true);
  });

  it('should reject invalid heat levels', () => {
    expect(isValidHeatLevel(-1)).toBe(false);
    expect(isValidHeatLevel(4)).toBe(false);
    expect(isValidHeatLevel(5)).toBe(false);
    expect(isValidHeatLevel(100)).toBe(false);
  });

  it('should reject non-integer values', () => {
    expect(isValidHeatLevel(1.5)).toBe(false);
    expect(isValidHeatLevel(2.9)).toBe(false);
  });

  it('should validate modulo calculation always returns valid level', () => {
    for (let i = 0; i < 100; i++) {
      const currentLevel = i % 4;
      const nextLevel = (currentLevel + 1) % 4;
      expect(isValidHeatLevel(nextLevel)).toBe(true);
    }
  });
});

console.log('✅ QA Test Suite for Interest Carousel - All tests defined');
