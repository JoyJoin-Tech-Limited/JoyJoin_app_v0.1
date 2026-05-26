/**
 * Common Chinese Market Occupations Validation Test
 * Tests that frequently-used occupations in Chinese market are correctly classified
 */

import { describe, it, expect } from 'vitest';
import { classifyIndustry } from '../industryClassifier';

describe('Common Chinese Occupations Classification', () => {
  describe('Teachers (教师分类)', () => {
    const teacherTests = [
      { input: '幼儿园教师', expected: 'education' },
      { input: '幼师', expected: 'education' },
      { input: '小学教师', expected: 'education' },
      { input: '小学老师', expected: 'education' },
      { input: '语文老师', expected: 'education' },
      { input: '数学老师', expected: 'education' },
      { input: '中学教师', expected: 'education' },
      { input: '初中老师', expected: 'education' },
      { input: '高中教师', expected: 'education' },
      { input: '高中老师', expected: 'education' },
      { input: '大学教授', expected: 'education' },
      { input: '教授', expected: 'education' },
      { input: '讲师', expected: 'education' },
      { input: '职校老师', expected: 'education' },
      { input: '技校老师', expected: 'education' },
    ];

    teacherTests.forEach(({ input, expected }) => {
      it(`should classify "${input}" as ${expected}`, async () => {
        const result = await classifyIndustry(input);
        expect(result.category.id).toBe(expected);
        expect(result.reasoning).toBeTruthy();
      });
    });
  });

  describe('Government/Public Service (政府公职)', () => {
    const govTests = [
      { input: '公务员', expected: 'government_public' },
      { input: '事业单位员工', expected: 'government_public' },
      { input: '体制内', expected: 'government_public' },
      { input: '国企员工', category: 'Not strict - could be various' },
      { input: '央企员工', category: 'Not strict - could be various' },
      { input: '法官', expected: 'government_public' },
      { input: '检察官', expected: 'government_public' },
      { input: '军人', expected: 'government_public' },
    ];

    govTests.forEach(({ input, expected }) => {
      if (!expected) return;
      it(`should classify "${input}" as ${expected}`, async () => {
        const result = await classifyIndustry(input);
        expect(result.category.id).toBe(expected);
      });
    });
  });

  describe('Finance Positions (金融岗位)', () => {
    const financeTests = [
      { input: '银行职员', expected: 'finance' },
      { input: '银行柜员', expected: 'finance' },
        { input: '会计', expected: 'professional_services' },
      { input: '会计员', expected: 'professional_services' },
      { input: '出纳', expected: 'finance' },
      { input: '注册会计师', expected: 'professional_services' },
    ];

    financeTests.forEach(({ input, expected }) => {
      it(`should classify "${input}" as ${expected}`, async () => {
        const result = await classifyIndustry(input);
        expect(result.category.id).toBe(expected);
      });
    });
  });

  describe('Service Workers (服务业)', () => {
    const serviceTests = [
      { input: '文员', nonFallback: true },
      { input: '司机', nonFallback: true },
      { input: '货车司机', nonFallback: true },
      { input: '工人', nonFallback: true },
      { input: '工厂工人', nonFallback: true },
      { input: '保安', nonFallback: true },
      { input: '清洁工', nonFallback: true },
      { input: '服务员', nonFallback: true },
      { input: '收银员', nonFallback: true },
      { input: '快递员', nonFallback: true },
      { input: '外卖员', nonFallback: true },
      { input: '外卖小哥', nonFallback: true },
      { input: '电工', nonFallback: true },
      { input: '水电工', nonFallback: true },
      { input: '修理工', nonFallback: true },
      { input: '装修工', nonFallback: true },
    ];

    serviceTests.forEach(({ input, nonFallback }) => {
      it(`should classify "${input}" with proper categorization`, async () => {
        const result = await classifyIndustry(input);
        if (nonFallback) {
          expect(['seed', 'fuzzy', 'ontology', 'ai']).toContain(result.source);
        }
        expect(result.reasoning).toBeTruthy();
      });
    });
  });

  describe('Overall Coverage Check', () => {
    it('should have high success rate for common occupations', async () => {
      const commonOccupations = [
        '公务员', '老师', '小学教师', '中学教师', '高中教师', '大学教授',
        '银行职员', '会计', '出纳', '文员', '司机', '工人', '保安', 
        '服务员', '收银员', '快递员', '外卖员', '护士', '医生', '厨师',
        '律师', '记者', '编辑', '摄影师', '设计师', '程序员', '产品经理',
        '销售', '市场营销', '人力资源'
      ];

      let successCount = 0;
      const results: Array<{ input: string; category: string; source: string }> = [];

      for (const input of commonOccupations) {
        const result = await classifyIndustry(input);
        const isNonFallback = ['seed', 'fuzzy', 'ontology', 'ai'].includes(result.source);
        if (isNonFallback) successCount++;
        
        results.push({
          input,
          category: result.category.label,
          source: result.source
        });
      }

      const successRate = (successCount / commonOccupations.length) * 100;
      
      console.log('\n📊 Common Occupations Coverage:');
      console.log(`Success Rate: ${successRate.toFixed(1)}% (${successCount}/${commonOccupations.length})`);
      console.log('\nDetailed Results:');
      results.forEach(({ input, category, source }) => {
        const emoji = ['seed', 'fuzzy', 'ontology', 'ai'].includes(source) ? '✅' : '⚠️';
        console.log(`${emoji} ${input.padEnd(12)} → ${category.padEnd(15)} (${source})`);
      });

      // Should be at least 90% for common occupations
      expect(successRate).toBeGreaterThanOrEqual(90);
    });
  });
});
