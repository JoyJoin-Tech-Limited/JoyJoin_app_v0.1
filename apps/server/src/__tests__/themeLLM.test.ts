/**
 * Theme LLM Service Tests
 * 测试主题LLM服务的验证逻辑
 */

import { describe, it, expect } from 'vitest';
import { validateTheme } from '../themeLLMService';
import type { ThemeLLMInput } from '@shared/types/eventTheme';

describe('themeLLMService - validation', () => {
  const mockInput: ThemeLLMInput = {
    archetypeDynamics: 'corgi×fox',
    avgEnergy: 88,
    pattern: 'complementary',
    energyProfile: {
      avgEnergy: 88,
      highCount: 2,
      mediumCount: 0,
      lowCount: 0,
      pattern: 'complementary',
    },
    eventType: '饭局',
    city: '广州',
    memberCount: 4,
  };
  
  describe('CHECK 1: Structure validation', () => {
    it('should pass for valid structure', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险',
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail for missing theme', () => {
      const theme = {
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid theme field');
    });
    
    it('should fail for missing subtitle', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险',
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid subtitle field');
    });
  });
  
  describe('CHECK 2: Character limits', () => {
    it('should warn if theme length is outside 12-18 range', () => {
      const theme = {
        theme: '短主题', // Too short (3 chars)
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      expect(result.warnings.some(w => w.includes('Theme length'))).toBe(true);
    });
    
    it('should warn if subtitle length is outside 15-25 range', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险',
        subtitle: '短副标题', // Too short (5 chars)
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      expect(result.warnings.some(w => w.includes('Subtitle length'))).toBe(true);
    });
    
    it('should pass for lengths within range', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险', // 17 chars - perfect
        subtitle: '广州老乡的咖啡×人脉派对聚会', // 15 chars - within range
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      const lengthWarnings = result.warnings.filter(w => 
        w.includes('Theme length') || w.includes('Subtitle length')
      );
      expect(lengthWarnings).toHaveLength(0);
    });
  });
  
  describe('CHECK 3: Archetype presence (CRITICAL)', () => {
    it('should fail if archetype data exists but theme missing archetype name', () => {
      const theme = {
        theme: '高能充电站的周末探险', // No archetype name!
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Theme must include archetype name when archetype data exists');
    });
    
    it('should pass if theme includes archetype name', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险', // Has 柯基 and 狐狸
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      expect(result.valid).toBe(true);
    });
    
    it('should pass for all 12 archetype names', () => {
      const archetypeNames = [
        'corgi', 'rooster', 'hamster_praise', 'fox',
        'dolphin_calm', 'spider', 'koala', 'octopus',
        'owl', 'elephant', 'turtle', 'cat'
      ];
      
      for (const archetype of archetypeNames) {
        const theme = {
          theme: `${archetype}的快乐派对`,
          subtitle: '广州老乡的咖啡×人脉派对',
          vibe: '🔥 高能 (75分)',
          emoji: '⚡',
        };
        
        const input = {
          ...mockInput,
          archetypeDynamics: archetype,
        };
        
        const result = validateTheme(theme, input);
        expect(result.valid).toBe(true);
      }
    });
  });
  
  describe('CHECK 4: Energy alignment', () => {
    it('should fail if high energy group (>80) has low energy theme', () => {
      const theme = {
        theme: '沉思者花园：猫头鹰的深夜书房', // Low energy words
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const highEnergyInput = {
        ...mockInput,
        avgEnergy: 90, // High energy!
      };
      
      const result = validateTheme(theme, highEnergyInput);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Energy mismatch'))).toBe(true);
    });
    
    it('should fail if low energy group (<60) has high energy theme', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的爆发时刻', // High energy words
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🌙 沉静 (45分)',
        emoji: '📚',
      };
      
      const lowEnergyInput = {
        ...mockInput,
        archetypeDynamics: 'owl×cat',
        avgEnergy: 45, // Low energy!
      };
      
      const result = validateTheme(theme, lowEnergyInput);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Energy mismatch'))).toBe(true);
    });
    
    it('should pass for aligned energy', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险',
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput); // avgEnergy: 88
      expect(result.valid).toBe(true);
    });
  });
  
  describe('CHECK 5: Grounding in subtitle', () => {
    it('should warn if subtitle missing all grounding elements', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险',
        subtitle: '神秘的社交体验', // No hometown, interest, or intent!
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const inputWithGrounding = {
        ...mockInput,
        hometown: { city: '广州', count: 3 },
        interest: { name: '咖啡', count: 4, avgHeat: 25 },
        intent: { intent: '拓展人脉', count: 4 },
      };
      
      const result = validateTheme(theme, inputWithGrounding);
      expect(result.warnings.some(w => 
        w.includes('Subtitle missing grounding elements')
      )).toBe(true);
    });
    
    it('should not warn if subtitle has hometown', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险',
        subtitle: '广州老乡的周末聚会', // Has 广州!
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const inputWithHometown = {
        ...mockInput,
        hometown: { city: '广州', count: 3 },
      };
      
      const result = validateTheme(theme, inputWithHometown);
      expect(result.warnings.some(w => 
        w.includes('Subtitle missing grounding elements')
      )).toBe(false);
    });
  });
  
  describe('CHECK 6: Generic detection', () => {
    it('should fail for generic terms in theme', () => {
      const genericThemes = [
        '周末聚会',
        '朋友聚餐',
        '美食探店',
        '咖啡交流会',
        '社交活动',
        '精英人脉',
        '高端社交',
        '专业交流',
      ];
      
      for (const generic of genericThemes) {
        const theme = {
          theme: generic,
          subtitle: '广州老乡的咖啡×人脉派对',
          vibe: '🔥 超高能 (88分)',
          emoji: '⚡',
        };
        
        const result = validateTheme(theme, mockInput);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('generic terms'))).toBe(true);
      }
    });
    
    it('should pass for archetype-based themes', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险',
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🔥 超高能 (88分)',
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      expect(result.valid).toBe(true);
    });
  });
  
  describe('CHECK 7: Vibe format', () => {
    it('should warn if vibe missing emoji', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险',
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '超高能 (88分)', // No emoji!
        emoji: '⚡',
      };
      
      const result = validateTheme(theme, mockInput);
      expect(result.warnings.some(w => w.includes('Vibe should include emoji'))).toBe(true);
    });
    
    it('should pass for vibe with emoji', () => {
      const validVibes = [
        '🔥 超高能 (88分)',
        '🌡️ 温暖 (75分)',
        '🌤️ 适宜 (60分)',
        '❄️ 冷淡 (45分)',
        '🌙 沉静 (35分)',
      ];
      
      for (const vibe of validVibes) {
        const theme = {
          theme: '高能充电站：柯基×狐狸的周末探险',
          subtitle: '广州老乡的咖啡×人脉派对',
          vibe,
          emoji: '⚡',
        };
        
        const result = validateTheme(theme, mockInput);
        expect(result.warnings.some(w => w.includes('Vibe should include emoji'))).toBe(false);
      }
    });
  });
  
  describe('Integration: Valid themes', () => {
    it('should validate Example 1 from requirements', () => {
      const theme = {
        theme: '高能充电站：柯基×狐狸的周末探险',
        subtitle: '广州老乡的咖啡×人脉派对',
        vibe: '🔥 温暖 (81分)',
        emoji: '⚡',
      };
      
      const input: ThemeLLMInput = {
        archetypeDynamics: '柯基×狐狸',
        avgEnergy: 81,
        pattern: 'complementary',
        hometown: { city: '广州', count: 3 },
        interest: { name: '咖啡', count: 4, avgHeat: 25 },
        intent: { intent: '拓展人脉', count: 4 },
        energyProfile: {
          avgEnergy: 81,
          highCount: 2,
          mediumCount: 2,
          lowCount: 0,
          pattern: 'complementary',
        },
        eventType: '饭局',
        city: '广州',
        memberCount: 4,
      };
      
      const result = validateTheme(theme, input);
      expect(result.valid).toBe(true);
    });
    
    it('should validate Example 2 from requirements (introverted)', () => {
      const theme = {
        theme: '沉思者的秘密花园：猫头鹰×大象的深夜书房',
        subtitle: '纯交友·深度阅读分享',
        vibe: '🌙 沉静 (44分)',
        emoji: '📚',
      };
      
      const input: ThemeLLMInput = {
        archetypeDynamics: 'owl×elephant',
        avgEnergy: 44,
        pattern: 'complementary',
        interest: { name: '阅读', count: 4, avgHeat: 25 },
        intent: { intent: '结识朋友', count: 4 },
        energyProfile: {
          avgEnergy: 44,
          highCount: 0,
          mediumCount: 0,
          lowCount: 4,
          pattern: 'complementary',
        },
        eventType: '饭局',
        city: '广州',
        memberCount: 4,
      };
      
      const result = validateTheme(theme, input);
      expect(result.valid).toBe(true);
    });
  });
});
