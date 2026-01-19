import { describe, it, expect } from 'vitest';
import { matchOccupation } from '../occupationMatcher';

describe('occupationMatcher - Edge Cases and Refinements', () => {
  describe('Specific analyst roles (should match correct category)', () => {
    it('should classify "数据分析师" as tech (NOT finance)', () => {
      const result = matchOccupation('数据分析师');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
      expect(result?.category).not.toBe('金融');
    });

    it('should classify "产品分析师" as product (NOT finance)', () => {
      const result = matchOccupation('产品分析师');
      expect(result).toBeDefined();
      expect(result?.category).toBe('产品');
      expect(result?.category).not.toBe('金融');
    });

    it('should classify "金融分析师" as finance (specific finance analyst)', () => {
      const result = matchOccupation('金融分析师');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
    });

    it('should classify "投资分析师" as finance (investment analyst)', () => {
      const result = matchOccupation('投资分析师');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
    });

    it('should classify "行业分析师" as finance (industry analyst)', () => {
      const result = matchOccupation('行业分析师');
      expect(result).toBeDefined();
      expect(result?.category).toBe('金融');
    });
  });

  describe('Product-related roles', () => {
    it('should classify "产品研发" as product (NOT tech)', () => {
      const result = matchOccupation('产品研发');
      expect(result).toBeDefined();
      expect(result?.category).toBe('产品');
      expect(result?.category).not.toBe('技术');
    });

    it('should classify "产品分析" as product', () => {
      const result = matchOccupation('产品分析');
      expect(result).toBeDefined();
      expect(result?.category).toBe('产品');
    });

    it('should still classify "产品经理" as product', () => {
      const result = matchOccupation('产品经理');
      expect(result?.category).toBe('产品');
    });
  });

  describe('Tech-specific roles', () => {
    it('should classify "数据分析" as tech', () => {
      const result = matchOccupation('数据分析');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
    });

    it('should classify "算法" as tech', () => {
      const result = matchOccupation('算法');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
    });

    it('should classify "机器学习" as tech', () => {
      const result = matchOccupation('机器学习');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
    });

    it('should classify "AI" as tech', () => {
      const result = matchOccupation('AI');
      expect(result).toBeDefined();
      expect(result?.category).toBe('技术');
    });
  });

  describe('Compound/ambiguous roles (scoring should pick most relevant)', () => {
    it('should classify "市场分析" prioritizing market', () => {
      const result = matchOccupation('市场分析');
      expect(result).toBeDefined();
      expect(result?.category).toBe('市场');
    });

    it('should classify "技术咨询" prioritizing consulting', () => {
      const result = matchOccupation('技术咨询');
      expect(result).toBeDefined();
      expect(result?.category).toBe('咨询');
    });

    it('should classify "医疗器械销售" prioritizing medical', () => {
      const result = matchOccupation('医疗器械销售');
      expect(result).toBeDefined();
      expect(result?.category).toBe('医疗');
    });

    it('should classify "教育产品经理" prioritizing product manager', () => {
      const result = matchOccupation('教育产品经理');
      expect(result).toBeDefined();
      expect(result?.category).toBe('产品');
    });
  });

  describe('Finance roles still work correctly', () => {
    it('should classify "交易员" as finance', () => {
      const result = matchOccupation('交易员');
      expect(result?.category).toBe('金融');
    });

    it('should classify "金融研究员" as finance (specific finance researcher)', () => {
      const result = matchOccupation('金融研究员');
      expect(result?.category).toBe('金融');
    });
  });

  describe('Tech roles still work correctly', () => {
    it('should classify "工程师" as tech', () => {
      const result = matchOccupation('工程师');
      expect(result?.category).toBe('技术');
    });

    it('should classify "硬件工程师" as tech', () => {
      const result = matchOccupation('硬件工程师');
      expect(result?.category).toBe('技术');
    });

    it('should classify "算法工程师" as tech', () => {
      const result = matchOccupation('算法工程师');
      expect(result?.category).toBe('技术');
    });
  });
});
