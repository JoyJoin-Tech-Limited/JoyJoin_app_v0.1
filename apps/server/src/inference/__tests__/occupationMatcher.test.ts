import { describe, it, expect } from 'vitest';
import { matchOccupation } from '../occupationMatcher';

describe('occupationMatcher', () => {
  describe('Finance/Investment classification', () => {
    it('should classify "投资" as 金融从业者', () => {
      const result = matchOccupation('投资');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
      expect(result?.evidence).toBe('投资');
    });
    
    it('should classify "PE" as 金融从业者', () => {
      const result = matchOccupation('PE');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });
    
    it('should classify "VC" as 金融从业者', () => {
      const result = matchOccupation('VC');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });
    
    it('should classify "投行" as 金融从业者', () => {
      const result = matchOccupation('投行');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });
    
    it('should classify "基金经理" as 金融从业者', () => {
      const result = matchOccupation('基金经理');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });

    it('should classify "证券" as 金融从业者', () => {
      const result = matchOccupation('证券');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });

    it('should classify "券商" as 金融从业者', () => {
      const result = matchOccupation('券商');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });

    it('should classify "私募" as 金融从业者', () => {
      const result = matchOccupation('私募');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });

    it('should classify "风投" as 金融从业者', () => {
      const result = matchOccupation('风投');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });

    it('should classify "量化" as 金融从业者', () => {
      const result = matchOccupation('量化');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });
    
    it('should NEVER classify finance terms as tech roles', () => {
      const financeTerms = ['投资', 'PE', 'VC', '投行', '基金', '证券', '券商', '私募', '风投', '量化'];
      financeTerms.forEach(term => {
        const result = matchOccupation(term);
        expect(result?.category).not.toBe('技术');
        expect(result?.occupation).not.toContain('工程师');
        expect(result?.occupation).not.toContain('开发');
        expect(result?.category).toBe('金融');
      });
    });

    it('should handle casual expressions for finance', () => {
      const result1 = matchOccupation('做投资的');
      expect(result1?.category).toBe('金融');

      const result2 = matchOccupation('搞金融的');
      expect(result2?.category).toBe('金融');
    });

    it('should handle compound finance terms', () => {
      const result1 = matchOccupation('PE投资');
      expect(result1?.category).toBe('金融');

      const result2 = matchOccupation('VC投资人');
      expect(result2?.category).toBe('金融');

      const result3 = matchOccupation('投资银行');
      expect(result3?.category).toBe('金融');
    });
  });
  
  describe('Tech classification should still work', () => {
    it('should classify "后端工程师" as 软件工程师', () => {
      const result = matchOccupation('后端工程师');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
      expect(result?.occupation).toBe('软件工程师');
    });
    
    it('should classify "前端开发" as 软件工程师', () => {
      const result = matchOccupation('前端开发');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
      expect(result?.occupation).toBe('软件工程师');
    });

    it('should classify "程序员" as 软件工程师', () => {
      const result = matchOccupation('程序员');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
      expect(result?.occupation).toBe('软件工程师');
    });

    it('should classify "全栈工程师" as 软件工程师', () => {
      const result = matchOccupation('全栈工程师');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
      expect(result?.occupation).toBe('软件工程师');
    });

    it('should classify "做开发的" as 软件工程师', () => {
      const result = matchOccupation('做开发的');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
      expect(result?.occupation).toBe('软件工程师');
    });
  });

  describe('Other professions should work correctly', () => {
    it('should classify "产品经理" correctly', () => {
      const result = matchOccupation('产品经理');
      expect(result?.category).toBe('产品');
      expect(result?.occupation).toBe('产品经理');
    });

    it('should classify "设计师" correctly', () => {
      const result = matchOccupation('设计师');
      expect(result?.category).toBe('设计');
      expect(result?.occupation).toBe('设计师');
    });

    it('should classify "运营" correctly', () => {
      const result = matchOccupation('运营');
      expect(result?.category).toBe('运营');
      expect(result?.occupation).toBe('运营');
    });

    it('should classify "咨询顾问" correctly', () => {
      const result = matchOccupation('咨询');
      expect(result?.category).toBe('咨询');
      expect(result?.occupation).toBe('咨询顾问');
    });

    it('should classify "律师" correctly', () => {
      const result = matchOccupation('律师');
      expect(result?.category).toBe('法律');
      expect(result?.occupation).toBe('律师/法务');
    });

    it('should classify "医生" correctly', () => {
      const result = matchOccupation('医生');
      expect(result?.category).toBe('医疗');
      expect(result?.occupation).toBe('医疗从业者');
    });
  });

  describe('Edge cases and specificity scoring', () => {
    it('should handle empty input', () => {
      const result = matchOccupation('');
      expect(result).toBeNull();
    });

    it('should handle whitespace-only input', () => {
      const result = matchOccupation('   ');
      expect(result).toBeNull();
    });

    it('should trim input before matching', () => {
      const result = matchOccupation('  投资  ');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
    });

    it('should handle case-insensitive matching', () => {
      const result = matchOccupation('pe');
      expect(result?.category).toBe('金融');
    });

    it('should prefer more specific matches', () => {
      // "基金经理" should match finance, not just any generic pattern
      const result = matchOccupation('基金经理');
      expect(result?.category).toBe('金融');
      expect(result?.occupation).toBe('金融从业者');
    });
  });

  describe('Confidence and evidence fields', () => {
    it('should return confidence score', () => {
      const result = matchOccupation('投资');
      expect(result?.confidence).toBe(0.85);
    });

    it('should return matched evidence', () => {
      const result = matchOccupation('我是做PE投资的');
      expect(result?.evidence).toBeDefined();
      expect(result?.evidence?.length).toBeGreaterThan(0);
    });
  });

  describe('Priority-based matching', () => {
    it('finance patterns should have higher priority than tech patterns', () => {
      // If both patterns could match, finance should win
      const result = matchOccupation('投资');
      expect(result?.category).toBe('金融');
      expect(result?.category).not.toBe('技术');
    });
  });
});
