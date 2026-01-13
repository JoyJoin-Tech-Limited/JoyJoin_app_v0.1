/**
 * Unit Tests for Interest Taxonomy and Validation
 */

import { describe, it, expect } from 'vitest';
import {
  TAXONOMY_VERSION,
  INTEREST_TAXONOMY,
  isKnownInterestId,
  isActiveInterestId,
  getInterestById,
  getActiveInterests,
  getInterestLabel,
  validateInterestIds,
  normalizeProfileInterests,
  validateTelemetry,
  buildCardDeck,
  getChipListByCategory,
  mapLegacyInterests,
  RIASEC_QUOTAS,
  type InterestsTelemetry,
} from '@shared/interests';

describe('Interest Taxonomy', () => {
  it('should have a valid version string', () => {
    expect(TAXONOMY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should have unique interest IDs', () => {
    const ids = INTEREST_TAXONOMY.map(i => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all required fields on each interest', () => {
    for (const interest of INTEREST_TAXONOMY) {
      expect(interest.id).toBeTruthy();
      expect(interest.label).toBeTruthy();
      expect(['food', 'entertainment', 'lifestyle', 'culture', 'social']).toContain(interest.macroCategory);
      expect(['R', 'I', 'A', 'S', 'E', 'C']).toContain(interest.riasec);
      expect(typeof interest.active).toBe('boolean');
    }
  });
});

describe('Interest Lookup Functions', () => {
  it('isKnownInterestId should return true for valid IDs', () => {
    expect(isKnownInterestId('hotpot')).toBe(true);
    expect(isKnownInterestId('coffee')).toBe(true);
    expect(isKnownInterestId('hiking')).toBe(true);
  });

  it('isKnownInterestId should return false for unknown IDs', () => {
    expect(isKnownInterestId('unknown_id')).toBe(false);
    expect(isKnownInterestId('')).toBe(false);
  });

  it('isActiveInterestId should work correctly', () => {
    const activeInterest = INTEREST_TAXONOMY.find(i => i.active);
    if (activeInterest) {
      expect(isActiveInterestId(activeInterest.id)).toBe(true);
    }
    expect(isActiveInterestId('unknown_id')).toBe(false);
  });

  it('getInterestById should return the correct interest', () => {
    const interest = getInterestById('hotpot');
    expect(interest).toBeDefined();
    expect(interest?.label).toBe('火锅');
    expect(interest?.macroCategory).toBe('food');
  });

  it('getInterestLabel should return label or fallback to ID', () => {
    expect(getInterestLabel('hotpot')).toBe('火锅');
    expect(getInterestLabel('unknown')).toBe('unknown');
  });

  it('getActiveInterests should return only active interests', () => {
    const active = getActiveInterests();
    expect(active.every(i => i.active)).toBe(true);
  });
});

describe('validateInterestIds', () => {
  it('should separate valid, invalid, and inactive IDs', () => {
    const result = validateInterestIds(['hotpot', 'unknown', 'coffee']);
    expect(result.valid).toContain('hotpot');
    expect(result.valid).toContain('coffee');
    expect(result.invalid).toContain('unknown');
  });

  it('should deduplicate IDs', () => {
    const result = validateInterestIds(['hotpot', 'hotpot', 'coffee', 'coffee']);
    expect(result.valid).toEqual(['hotpot', 'coffee']);
  });

  it('should handle empty array', () => {
    const result = validateInterestIds([]);
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.inactive).toEqual([]);
  });
});

describe('normalizeProfileInterests', () => {
  it('should cap interestsTop at 7', () => {
    const result = normalizeProfileInterests({
      interestsTop: ['hotpot', 'coffee', 'hiking', 'cinema', 'reading', 'travel', 'pets', 'bar', 'wine'],
    });
    expect(result.interestsTop.length).toBeLessThanOrEqual(7);
  });

  it('should cap primaryInterests at 3', () => {
    const result = normalizeProfileInterests({
      primaryInterests: ['hotpot', 'coffee', 'hiking', 'cinema'],
      interestsTop: ['hotpot', 'coffee', 'hiking', 'cinema'],
    });
    expect(result.primaryInterests.length).toBeLessThanOrEqual(3);
  });

  it('should ensure primary ⊆ top', () => {
    const result = normalizeProfileInterests({
      primaryInterests: ['hotpot', 'coffee'],
      interestsTop: ['hiking', 'cinema'],
    });
    // Either primary interests are in top, or they were added to top
    for (const primary of result.primaryInterests) {
      expect(result.interestsTop).toContain(primary);
    }
  });

  it('should filter out unknown IDs', () => {
    const result = normalizeProfileInterests({
      interestsTop: ['hotpot', 'unknown_id', 'coffee'],
      primaryInterests: ['hotpot'],
    });
    expect(result.interestsTop).not.toContain('unknown_id');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should deduplicate arrays', () => {
    const result = normalizeProfileInterests({
      interestsTop: ['hotpot', 'hotpot', 'coffee'],
      primaryInterests: ['hotpot', 'hotpot'],
    });
    expect(result.interestsTop.filter(id => id === 'hotpot').length).toBe(1);
    expect(result.primaryInterests.filter(id => id === 'hotpot').length).toBe(1);
  });

  it('should handle empty inputs', () => {
    const result = normalizeProfileInterests({});
    expect(result.interestsTop).toEqual([]);
    expect(result.primaryInterests).toEqual([]);
    expect(result.topicAvoidances).toEqual([]);
  });
});

describe('validateTelemetry', () => {
  it('should validate correct telemetry', () => {
    const telemetry: InterestsTelemetry = {
      version: '1.0.0',
      events: [
        { interestId: 'hotpot', choice: 'like', reactionTimeMs: 1500, timestamp: new Date().toISOString() },
        { interestId: 'coffee', choice: 'love', reactionTimeMs: 800, timestamp: new Date().toISOString() },
      ],
    };
    const result = validateTelemetry(telemetry);
    expect(result.valid).toBe(true);
    expect(result.data?.events.length).toBe(2);
  });

  it('should reject invalid structure', () => {
    const result = validateTelemetry({ invalid: 'data' });
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should filter out unknown interest IDs', () => {
    const telemetry = {
      version: '1.0.0',
      events: [
        { interestId: 'hotpot', choice: 'like', reactionTimeMs: 1500, timestamp: new Date().toISOString() },
        { interestId: 'unknown_interest', choice: 'skip', reactionTimeMs: 1000, timestamp: new Date().toISOString() },
      ],
    };
    const result = validateTelemetry(telemetry);
    expect(result.valid).toBe(true);
    expect(result.data?.events.length).toBe(1);
    expect(result.data?.events[0].interestId).toBe('hotpot');
  });

  it('should cap events at 200', () => {
    const events = Array.from({ length: 250 }, (_, i) => ({
      interestId: 'hotpot',
      choice: 'like' as const,
      reactionTimeMs: 1000,
      timestamp: new Date().toISOString(),
    }));
    const telemetry = { version: '1.0.0', events };
    const result = validateTelemetry(telemetry);
    expect(result.valid).toBe(false); // Zod rejects > 200
  });

  it('should clamp reaction times', () => {
    const telemetry = {
      version: '1.0.0',
      events: [
        { interestId: 'hotpot', choice: 'like', reactionTimeMs: 120000, timestamp: new Date().toISOString() },
      ],
    };
    const result = validateTelemetry(telemetry);
    expect(result.valid).toBe(true);
    expect(result.data?.events[0].reactionTimeMs).toBeLessThanOrEqual(60000);
  });
});

describe('buildCardDeck', () => {
  it('should return requested number of cards', () => {
    const deck = buildCardDeck(18);
    expect(deck.length).toBe(18);
  });

  it('should return unique cards', () => {
    const deck = buildCardDeck(18);
    const ids = deck.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have RIASEC diversity', () => {
    const deck = buildCardDeck(18);
    const riasecTypes = new Set(deck.map(c => c.riasec));
    // Should have at least 4 different RIASEC types
    expect(riasecTypes.size).toBeGreaterThanOrEqual(4);
  });

  it('should have category coverage', () => {
    const deck = buildCardDeck(18);
    const categories = new Set(deck.map(c => c.macroCategory));
    // Should cover all 5 categories
    expect(categories.size).toBe(5);
  });
});

describe('getChipListByCategory', () => {
  it('should group interests by category', () => {
    const chipList = getChipListByCategory();
    expect(Object.keys(chipList)).toEqual(['food', 'entertainment', 'lifestyle', 'culture', 'social']);
    // Each category should have at least one interest
    for (const category of Object.keys(chipList) as (keyof typeof chipList)[]) {
      expect(chipList[category].length).toBeGreaterThan(0);
    }
  });

  it('should only include active interests', () => {
    const chipList = getChipListByCategory();
    for (const interests of Object.values(chipList)) {
      for (const interest of interests) {
        expect(interest.active).toBe(true);
      }
    }
  });
});

describe('mapLegacyInterests', () => {
  it('should prefer new fields when available', () => {
    const result = mapLegacyInterests({
      interestsTop: ['hotpot', 'coffee'],
      primaryInterests: ['hotpot'],
      interestsRankedTop3: ['old1', 'old2'],
    });
    expect(result.interestsTop).toEqual(['hotpot', 'coffee']);
    expect(result.primaryInterests).toEqual(['hotpot']);
  });

  it('should map legacy interestsRankedTop3 to primaryInterests', () => {
    const result = mapLegacyInterests({
      interestsRankedTop3: ['hotpot', 'coffee', 'hiking'],
    });
    expect(result.primaryInterests).toContain('hotpot');
    expect(result.primaryInterests).toContain('coffee');
    expect(result.primaryInterests).toContain('hiking');
    expect(result.interestsTop).toContain('hotpot');
  });

  it('should map interestFavorite to primaryInterests', () => {
    const result = mapLegacyInterests({
      interestFavorite: 'hotpot',
    });
    expect(result.primaryInterests).toContain('hotpot');
    expect(result.interestsTop).toContain('hotpot');
  });

  it('should map topicsAvoid to topicAvoidances', () => {
    const result = mapLegacyInterests({
      topicsAvoid: ['politics', 'money'],
    });
    expect(result.topicAvoidances).toEqual(['politics', 'money']);
  });

  it('should handle empty profile', () => {
    const result = mapLegacyInterests({});
    expect(result.interestsTop).toEqual([]);
    expect(result.primaryInterests).toEqual([]);
    expect(result.topicAvoidances).toEqual([]);
  });
});
