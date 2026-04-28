/**
 * Theme Scoring Service Tests
 * 测试主题评分服务
 */

import { describe, it, expect } from 'vitest';
import { 
  extractDimensions, 
  scoreDimensionsForTheme,
  selectThemeComponents,
  getEnergyLabel,
  getEnergyEmoji,
  EVENT_THEME_WEIGHTS
} from '../themeScoringService';
import type { MemberProfile } from '@shared/types/eventTheme';

describe('themeScoringService', () => {
  describe('extractDimensions', () => {
    it('should extract archetype dimensions from homogeneous group', () => {
      const members: MemberProfile[] = [
        {
          userId: '1',
          archetype: 'corgi',
          secondaryArchetype: null,
          gender: '女性',
          birthYear: '1995',
          industryNicheLabel: null,
          hometownRegionCity: null,
          currentCity: '广州',
          intent: ['拓展人脉'],
        },
        {
          userId: '2',
          archetype: 'corgi',
          secondaryArchetype: null,
          gender: '男性',
          birthYear: '1993',
          industryNicheLabel: null,
          hometownRegionCity: null,
          currentCity: '广州',
          intent: ['拓展人脉'],
        },
      ];
      
      const dimensions = extractDimensions(members);
      
      expect(dimensions.archetype).toBeDefined();
      expect(dimensions.archetype?.pattern).toBe('homogeneous');
      expect(dimensions.archetype?.primaryArchetypes).toContain('corgi');
      expect(dimensions.archetype?.avgEnergy).toBeGreaterThan(90); // Corgi is high energy
      expect(dimensions.archetype?.dynamics).toContain('corgi的快乐派对');
    });
    
    it('should extract archetype dimensions from complementary group', () => {
      const members: MemberProfile[] = [
        { userId: '1', archetype: 'corgi', secondaryArchetype: null, gender: '女性', birthYear: '1995', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: null },
        { userId: '2', archetype: 'fox', secondaryArchetype: null, gender: '男性', birthYear: '1993', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: null },
        { userId: '3', archetype: 'koala', secondaryArchetype: null, gender: '女性', birthYear: '1994', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: null },
      ];
      
      const dimensions = extractDimensions(members);
      
      expect(dimensions.archetype?.pattern).toBe('complementary');
      expect(dimensions.archetype?.dynamics).toContain('×'); // Should have × separator
    });
    
    it('should extract archetype dimensions from diverse group', () => {
      const members: MemberProfile[] = [
        { userId: '1', archetype: 'corgi', secondaryArchetype: null, gender: '女性', birthYear: '1995', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: null },
        { userId: '2', archetype: 'rooster', secondaryArchetype: null, gender: '男性', birthYear: '1993', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: null },
        { userId: '3', archetype: 'fox', secondaryArchetype: null, gender: '女性', birthYear: '1994', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: null },
        { userId: '4', archetype: 'koala', secondaryArchetype: null, gender: '男性', birthYear: '1992', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: null },
        { userId: '5', archetype: 'cat', secondaryArchetype: null, gender: '女性', birthYear: '1996', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: null },
      ];
      
      const dimensions = extractDimensions(members);
      
      expect(dimensions.archetype?.pattern).toBe('diverse');
      expect(dimensions.archetype?.dynamics).toBe('原型大聚会');
    });
    
    it('should only extract interests with heat >= 2 (heat value >= 10)', () => {
      const members: MemberProfile[] = [
        {
          userId: '1',
          archetype: 'corgi',
          secondaryArchetype: null,
          gender: '女性',
          birthYear: '1995',
          industryNicheLabel: null,
          hometownRegionCity: null,
          currentCity: '广州',
          intent: null,
          interests: [
            { topicId: 'coffee', label: '咖啡', heat: 25, level: 3 }, // Should include
            { topicId: 'reading', label: '阅读', heat: 10, level: 2 }, // Should include
            { topicId: 'gaming', label: '游戏', heat: 5, level: 1 },  // Should exclude (heat < 10)
          ],
        },
        {
          userId: '2',
          archetype: 'fox',
          secondaryArchetype: null,
          gender: '男性',
          birthYear: '1993',
          industryNicheLabel: null,
          hometownRegionCity: null,
          currentCity: '广州',
          intent: null,
          interests: [
            { topicId: 'coffee', label: '咖啡', heat: 25, level: 3 },
          ],
        },
      ];
      
      const dimensions = extractDimensions(members);
      
      expect(dimensions.interests).toBeDefined();
      expect(dimensions.interests?.commonInterests).toHaveLength(2); // Only coffee and reading
      expect(dimensions.interests?.topInterest?.name).toBe('咖啡');
      expect(dimensions.interests?.topInterest?.count).toBe(2);
    });
    
    it('should extract hometown when at least 2 people share it', () => {
      const members: MemberProfile[] = [
        { userId: '1', archetype: 'corgi', secondaryArchetype: null, gender: '女性', birthYear: '1995', industryNicheLabel: null, hometownRegionCity: '广州', currentCity: '广州', intent: null },
        { userId: '2', archetype: 'fox', secondaryArchetype: null, gender: '男性', birthYear: '1993', industryNicheLabel: null, hometownRegionCity: '广州', currentCity: '广州', intent: null },
        { userId: '3', archetype: 'koala', secondaryArchetype: null, gender: '女性', birthYear: '1994', industryNicheLabel: null, hometownRegionCity: '深圳', currentCity: '广州', intent: null },
      ];
      
      const dimensions = extractDimensions(members);
      
      expect(dimensions.hometown).toBeDefined();
      expect(dimensions.hometown?.commonCity).toBe('广州');
      expect(dimensions.hometown?.count).toBe(2);
    });
    
    it('should not extract hometown when only 1 person has it', () => {
      const members: MemberProfile[] = [
        { userId: '1', archetype: 'corgi', secondaryArchetype: null, gender: '女性', birthYear: '1995', industryNicheLabel: null, hometownRegionCity: '广州', currentCity: '广州', intent: null },
        { userId: '2', archetype: 'fox', secondaryArchetype: null, gender: '男性', birthYear: '1993', industryNicheLabel: null, hometownRegionCity: '深圳', currentCity: '广州', intent: null },
      ];
      
      const dimensions = extractDimensions(members);
      
      expect(dimensions.hometown).toBeUndefined();
    });
    
    it('should extract dominant intent', () => {
      const members: MemberProfile[] = [
        { userId: '1', archetype: 'corgi', secondaryArchetype: null, gender: '女性', birthYear: '1995', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: ['拓展人脉'] },
        { userId: '2', archetype: 'fox', secondaryArchetype: null, gender: '男性', birthYear: '1993', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: ['拓展人脉', '结识朋友'] },
        { userId: '3', archetype: 'koala', secondaryArchetype: null, gender: '女性', birthYear: '1994', industryNicheLabel: null, hometownRegionCity: null, currentCity: '广州', intent: ['结识朋友'] },
      ];
      
      const dimensions = extractDimensions(members);
      
      expect(dimensions.intent).toBeDefined();
      expect(dimensions.intent?.dominantIntent).toBeDefined();
      expect(dimensions.intent?.mixed).toBe(true);
    });
  });
  
  describe('scoreDimensionsForTheme', () => {
    it('should score archetype as theme-lead (high mystery, low grounding)', () => {
      const dimensions = {
        archetype: {
          pattern: 'complementary' as const,
          primaryArchetypes: ['corgi', 'fox'],
          secondaryArchetypes: [],
          avgEnergy: 88,
          energyDistribution: { high: 2, medium: 0, low: 0 },
          dynamics: 'corgi×fox',
        },
      };
      
      const components = scoreDimensionsForTheme(dimensions);
      
      const archetypeComponent = components.find(c => c.dimension === 'archetype');
      expect(archetypeComponent).toBeDefined();
      expect(archetypeComponent?.usageType).toBe('theme-lead');
      expect(archetypeComponent?.mysteryValue).toBe(95);
      expect(archetypeComponent?.groundingValue).toBe(40);
    });
    
    it('should score hometown as subtitle-ground (low mystery, high grounding)', () => {
      const dimensions = {
        hometown: {
          commonCity: '广州',
          count: 3,
        },
      };
      
      const components = scoreDimensionsForTheme(dimensions);
      
      const hometownComponent = components.find(c => c.dimension === 'hometown');
      expect(hometownComponent).toBeDefined();
      expect(hometownComponent?.usageType).toBe('subtitle-ground');
      expect(hometownComponent?.mysteryValue).toBe(30);
      expect(hometownComponent?.groundingValue).toBe(100);
    });
    
    it('should sort components by finalScore descending', () => {
      const dimensions = {
        archetype: {
          pattern: 'complementary' as const,
          primaryArchetypes: ['corgi'],
          secondaryArchetypes: [],
          avgEnergy: 95,
          energyDistribution: { high: 2, medium: 0, low: 0 },
          dynamics: 'corgi',
        },
        interests: {
          commonInterests: [{ name: '咖啡', count: 2, avgHeat: 25 }],
          topInterest: { name: '咖啡', count: 2, avgHeat: 25 },
        },
        hometown: {
          commonCity: '广州',
          count: 2,
        },
      };
      
      const components = scoreDimensionsForTheme(dimensions);
      
      // Should be sorted by finalScore
      for (let i = 0; i < components.length - 1; i++) {
        expect(components[i].finalScore).toBeGreaterThanOrEqual(components[i + 1].finalScore);
      }
      
      // Archetype should be first (highest weight 0.30)
      expect(components[0].dimension).toBe('archetype');
    });
  });
  
  describe('selectThemeComponents', () => {
    it('should separate components by usage type', () => {
      const dimensions = {
        archetype: {
          pattern: 'complementary' as const,
          primaryArchetypes: ['corgi'],
          secondaryArchetypes: [],
          avgEnergy: 95,
          energyDistribution: { high: 2, medium: 0, low: 0 },
          dynamics: 'corgi',
        },
        interests: {
          commonInterests: [{ name: '咖啡', count: 2, avgHeat: 25 }],
          topInterest: { name: '咖啡', count: 2, avgHeat: 25 },
        },
        hometown: {
          commonCity: '广州',
          count: 2,
        },
      };
      
      const components = scoreDimensionsForTheme(dimensions);
      const selected = selectThemeComponents(components);
      
      expect(selected.themeLeads.length).toBeGreaterThan(0);
      expect(selected.subtitleGrounds.length).toBeGreaterThan(0);
      
      // Archetype should be in theme leads
      expect(selected.themeLeads.some(c => c.dimension === 'archetype')).toBe(true);
      
      // Hometown should be in subtitle grounds
      expect(selected.subtitleGrounds.some(c => c.dimension === 'hometown')).toBe(true);
    });
  });
  
  describe('getEnergyLabel', () => {
    it('should return correct energy labels', () => {
      expect(getEnergyLabel(85)).toBe('超高能');
      expect(getEnergyLabel(75)).toBe('高能');
      expect(getEnergyLabel(65)).toBe('温暖');
      expect(getEnergyLabel(55)).toBe('平衡');
      expect(getEnergyLabel(45)).toBe('沉静');
      expect(getEnergyLabel(35)).toBe('深度');
    });
  });
  
  describe('getEnergyEmoji', () => {
    it('should return correct energy emojis', () => {
      expect(getEnergyEmoji(90)).toBe('🔥');
      expect(getEnergyEmoji(75)).toBe('🌡️');
      expect(getEnergyEmoji(60)).toBe('🌤️');
      expect(getEnergyEmoji(45)).toBe('🌙');
      expect(getEnergyEmoji(35)).toBe('❄️');
    });
  });
  
  describe('EVENT_THEME_WEIGHTS', () => {
    it('should sum to 1.0', () => {
      const sum = Object.values(EVENT_THEME_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });
    
    it('should prioritize archetype', () => {
      expect(EVENT_THEME_WEIGHTS.archetype).toBeGreaterThan(EVENT_THEME_WEIGHTS.interests);
      expect(EVENT_THEME_WEIGHTS.archetype).toBeGreaterThan(EVENT_THEME_WEIGHTS.intent);
    });
  });
});
