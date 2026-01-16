/**
 * Comprehensive coverage test for newly added occupations
 * Tests internet companies, cross-border ecommerce, F&B, investors, and artistic occupations
 */

import { describe, it, expect } from 'vitest';
import { classifyIndustry } from '../industryClassifier';

describe('Comprehensive Occupation Coverage Test', () => {
  describe('互联网企业运营相关', () => {
    it('should classify 互联网运营 correctly', () => {
      const result = classifyIndustry('互联网运营');
      expect(result.category?.id).toBe('tech');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 内容运营 correctly', () => {
      const result = classifyIndustry('内容运营');
      expect(result.category?.id).toBe('tech');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 用户运营 correctly', () => {
      const result = classifyIndustry('用户运营');
      expect(result.category?.id).toBe('tech');
      expect(result.reasoning).toBeTruthy();
    });
  });

  describe('跨境电商细分', () => {
    it('should classify 跨境选品 correctly', () => {
      const result = classifyIndustry('跨境选品');
      expect(result.category?.id).toBe('consumer_retail');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 跨境物流 correctly', () => {
      const result = classifyIndustry('跨境物流');
      expect(result.category?.id).toBe('consumer_retail');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 跨境电商运营 correctly', () => {
      const result = classifyIndustry('跨境电商运营');
      expect(['consumer_retail', 'tech']).toContain(result.category?.id);
      expect(result.reasoning).toBeTruthy();
    });
  });

  describe('投资人相关', () => {
    it('should classify 天使投资人 correctly', () => {
      const result = classifyIndustry('天使投资人');
      expect(result.category?.id).toBe('finance');
      expect(result.segment?.id).toBe('pe_vc');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify FA财务顾问 correctly', () => {
      const result = classifyIndustry('FA财务顾问');
      expect(result.category?.id).toBe('finance');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 融资顾问 correctly', () => {
      const result = classifyIndustry('融资顾问');
      expect(result.category?.id).toBe('finance');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 家族办公室 correctly', () => {
      const result = classifyIndustry('家族办公室');
      expect(result.category?.id).toBe('finance');
      expect(result.reasoning).toBeTruthy();
    });
  });

  describe('餐饮行业细分', () => {
    it('should classify 餐厅经理 correctly', () => {
      const result = classifyIndustry('餐厅经理');
      expect(result.category?.id).toBe('consumer_retail');
      expect(result.segment?.id).toBe('food_service');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 烘焙师 correctly', () => {
      const result = classifyIndustry('烘焙师');
      expect(result.category?.id).toBe('consumer_retail');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 调酒师 correctly', () => {
      const result = classifyIndustry('调酒师');
      expect(result.category?.id).toBe('consumer_retail');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 咖啡师 correctly', () => {
      const result = classifyIndustry('咖啡师');
      expect(result.category?.id).toBe('consumer_retail');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 茶艺师 correctly', () => {
      const result = classifyIndustry('茶艺师');
      expect(result.category?.id).toBe('consumer_retail');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 品酒师 correctly', () => {
      const result = classifyIndustry('品酒师');
      expect(result.category?.id).toBe('consumer_retail');
      expect(result.reasoning).toBeTruthy();
    });
  });

  describe('艺术家相关 (冷门职业)', () => {
    it('should classify 画家 correctly', () => {
      const result = classifyIndustry('画家');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 雕塑家 correctly', () => {
      const result = classifyIndustry('雕塑家');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 书法家 correctly', () => {
      const result = classifyIndustry('书法家');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 陶艺师 correctly', () => {
      const result = classifyIndustry('陶艺师');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 诗人 correctly', () => {
      const result = classifyIndustry('诗人');
      expect(result.category?.id).toBe('media_creative');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 作曲家 correctly', () => {
      const result = classifyIndustry('作曲家');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 指挥家 correctly', () => {
      const result = classifyIndustry('指挥家');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 歌剧演员 correctly', () => {
      const result = classifyIndustry('歌剧演员');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 戏剧导演 correctly', () => {
      const result = classifyIndustry('戏剧导演');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 电影导演 correctly', () => {
      const result = classifyIndustry('电影导演');
      expect(result.category?.id).toBe('media_creative');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 编剧 correctly', () => {
      const result = classifyIndustry('编剧');
      expect(result.category?.id).toBe('media_creative');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 策展人 correctly', () => {
      const result = classifyIndustry('策展人');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 艺术评论家 correctly', () => {
      const result = classifyIndustry('艺术评论家');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });

    it('should classify 行为艺术家 correctly', () => {
      const result = classifyIndustry('行为艺术家');
      expect(result.category?.id).toBe('culture_sports');
      expect(result.reasoning).toBeTruthy();
    });
  });

  describe('Edge cases and variations', () => {
    it('should handle mixed case variations', () => {
      const tests = [
        { input: 'Angel Investor', expected: 'finance' },
        { input: 'Bartender', expected: 'consumer_retail' },
        { input: 'Sommelier', expected: 'consumer_retail' },
      ];

      tests.forEach(({ input, expected }) => {
        const result = classifyIndustry(input);
        expect(result.category?.id).toBe(expected);
        expect(result.reasoning).toBeTruthy();
      });
    });

    it('should ensure all results have reasoning', () => {
      const inputs = [
        '天使投资',
        '跨境选品',
        '餐厅经理',
        '画家',
        '指挥家',
        '互联网运营',
        '品酒师',
        '雕塑家',
        '编剧',
      ];

      inputs.forEach(input => {
        const result = classifyIndustry(input);
        expect(result.reasoning).toBeTruthy();
        expect(result.reasoning.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Summary Statistics', () => {
    it('should provide coverage summary for new occupations', () => {
      const testInputs = [
        // Internet ops (3)
        '互联网运营', '内容运营', '用户运营',
        // Crossborder ecommerce (2)
        '跨境选品', '跨境物流',
        // Investors (3)
        '天使投资人', 'FA财务顾问', '家族办公室',
        // F&B (6)
        '餐厅经理', '烘焙师', '调酒师', '咖啡师', '茶艺师', '品酒师',
        // Artists (14)
        '画家', '雕塑家', '书法家', '陶艺师', '诗人', '作曲家',
        '指挥家', '歌剧演员', '戏剧导演', '电影导演', '编剧',
        '策展人', '艺术评论家', '行为艺术家',
      ];

      let successCount = 0;
      let missingReasoning = 0;
      let fallbackCount = 0;

      testInputs.forEach(input => {
        const result = classifyIndustry(input);
        if (result.category) successCount++;
        if (!result.reasoning || result.reasoning.length === 0) missingReasoning++;
        if (result.source === 'fallback') fallbackCount++;
      });

      console.log('\n📊 New Occupations Coverage Summary:');
      console.log(`  Total Tested: ${testInputs.length}`);
      console.log(`  Successful: ${successCount} (${((successCount / testInputs.length) * 100).toFixed(1)}%)`);
      console.log(`  Missing Reasoning: ${missingReasoning}`);
      console.log(`  Fallback Rate: ${fallbackCount} (${((fallbackCount / testInputs.length) * 100).toFixed(1)}%)`);

      expect(successCount).toBe(testInputs.length);
      expect(missingReasoning).toBe(0);
      expect(fallbackCount).toBeLessThan(testInputs.length * 0.1); // <10% fallback rate
    });
  });
});
