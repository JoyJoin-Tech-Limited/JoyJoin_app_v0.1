/**
 * Tests for traitDisplayConfig module
 * Verifies the trait display configuration and helper functions
 */

import { 
  TRAIT_DISPLAY_CONFIG,
  getTraitSimpleDesc,
  getTraitFullDesc,
  getTraitMatchingValue,
  getTraitBipolarLabels
} from '../traitDisplayConfig';

describe('traitDisplayConfig', () => {
  describe('TRAIT_DISPLAY_CONFIG', () => {
    it('should contain all 6 ACOEXP traits', () => {
      const expectedKeys = ['A', 'C', 'O', 'E', 'X', 'P'];
      const actualKeys = Object.keys(TRAIT_DISPLAY_CONFIG);
      
      expect(actualKeys.sort()).toEqual(expectedKeys.sort());
    });

    it('should have complete configuration for each trait', () => {
      const requiredFields = [
        'key', 'chineseName', 'englishName', 
        'simpleDesc', 'fullDesc', 'matchingValue',
        'lowEndLabel', 'highEndLabel'
      ];

      Object.values(TRAIT_DISPLAY_CONFIG).forEach(config => {
        requiredFields.forEach(field => {
          expect(config).toHaveProperty(field);
          expect(config[field as keyof typeof config]).toBeTruthy();
        });
      });
    });

    it('should have correct Chinese names', () => {
      expect(TRAIT_DISPLAY_CONFIG['A'].chineseName).toBe('亲和力');
      expect(TRAIT_DISPLAY_CONFIG['C'].chineseName).toBe('责任心');
      expect(TRAIT_DISPLAY_CONFIG['O'].chineseName).toBe('开放性');
      expect(TRAIT_DISPLAY_CONFIG['E'].chineseName).toBe('情绪稳定性');
      expect(TRAIT_DISPLAY_CONFIG['X'].chineseName).toBe('外向性');
      expect(TRAIT_DISPLAY_CONFIG['P'].chineseName).toBe('正能量性');
    });

    it('should have correct English names', () => {
      expect(TRAIT_DISPLAY_CONFIG['A'].englishName).toBe('Affinity');
      expect(TRAIT_DISPLAY_CONFIG['C'].englishName).toBe('Conscientiousness');
      expect(TRAIT_DISPLAY_CONFIG['O'].englishName).toBe('Openness');
      expect(TRAIT_DISPLAY_CONFIG['E'].englishName).toBe('Emotional Stability');
      expect(TRAIT_DISPLAY_CONFIG['X'].englishName).toBe('Extraversion');
      expect(TRAIT_DISPLAY_CONFIG['P'].englishName).toBe('Positivity');
    });

    it('should have improved descriptions focused on interpersonal matching', () => {
      // Check that key descriptions contain matching-related keywords
      expect(TRAIT_DISPLAY_CONFIG['A'].fullDesc).toContain('联结');
      expect(TRAIT_DISPLAY_CONFIG['E'].fullDesc).toContain('变化');
      expect(TRAIT_DISPLAY_CONFIG['X'].fullDesc).toContain('参与度');
    });

    it('should have matching values that reference small gatherings', () => {
      Object.values(TRAIT_DISPLAY_CONFIG).forEach(config => {
        expect(config.matchingValue).toContain('小聚');
      });
    });

    it('should have bipolar labels for all traits', () => {
      Object.values(TRAIT_DISPLAY_CONFIG).forEach(config => {
        expect(config.lowEndLabel).toBeTruthy();
        expect(config.highEndLabel).toBeTruthy();
        expect(config.lowEndLabel).not.toBe(config.highEndLabel);
      });
    });
  });

  describe('getTraitSimpleDesc', () => {
    it('should return simple description for valid trait keys', () => {
      expect(getTraitSimpleDesc('A')).toBe('建立温暖联结、拉近距离的能力');
      expect(getTraitSimpleDesc('E')).toBe('应对变化/压力的情绪平稳度');
      expect(getTraitSimpleDesc('X')).toBe('社交的能量感、主动性与参与度');
    });

    it('should return empty string for invalid trait key', () => {
      expect(getTraitSimpleDesc('Z')).toBe('');
      expect(getTraitSimpleDesc('')).toBe('');
    });
  });

  describe('getTraitFullDesc', () => {
    it('should return full description for valid trait keys', () => {
      expect(getTraitFullDesc('A')).toBe('与人建立温暖联结、拉近距离的能力');
      expect(getTraitFullDesc('C')).toBe('做事可靠守诺，有规划性和条理性');
      expect(getTraitFullDesc('O')).toBe('对新事物、新话题的好奇心与接纳度');
    });

    it('should return empty string for invalid trait key', () => {
      expect(getTraitFullDesc('Z')).toBe('');
      expect(getTraitFullDesc('')).toBe('');
    });
  });

  describe('getTraitMatchingValue', () => {
    it('should return matching value for valid trait keys', () => {
      const matchingValue = getTraitMatchingValue('A');
      expect(matchingValue).toContain('快速融入');
      expect(matchingValue).toContain('小聚');
    });

    it('should return empty string for invalid trait key', () => {
      expect(getTraitMatchingValue('Z')).toBe('');
      expect(getTraitMatchingValue('')).toBe('');
    });
  });

  describe('getTraitBipolarLabels', () => {
    it('should return bipolar labels for valid trait keys', () => {
      const labels = getTraitBipolarLabels('A');
      expect(labels).toHaveProperty('low');
      expect(labels).toHaveProperty('high');
      expect(labels.low).toBe('保持距离');
      expect(labels.high).toBe('热情亲近');
    });

    it('should return empty labels for invalid trait key', () => {
      const labels = getTraitBipolarLabels('Z');
      expect(labels.low).toBe('');
      expect(labels.high).toBe('');
    });
  });

  describe('Text quality checks', () => {
    it('should have concise simple descriptions (under 30 characters)', () => {
      Object.values(TRAIT_DISPLAY_CONFIG).forEach(config => {
        expect(config.simpleDesc.length).toBeLessThan(30);
      });
    });

    it('should have concise full descriptions (under 50 characters)', () => {
      Object.values(TRAIT_DISPLAY_CONFIG).forEach(config => {
        expect(config.fullDesc.length).toBeLessThan(50);
      });
    });

    it('should not use evaluative language like "好/坏" in labels', () => {
      Object.values(TRAIT_DISPLAY_CONFIG).forEach(config => {
        expect(config.lowEndLabel).not.toMatch(/好|坏/);
        expect(config.highEndLabel).not.toMatch(/好|坏/);
      });
    });
  });
});
