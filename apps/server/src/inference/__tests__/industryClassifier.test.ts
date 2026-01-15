import { describe, it, expect, beforeAll } from 'vitest';
import { classifyIndustry } from '../industryClassifier';

describe('Industry Classifier with Enhanced Tiers', () => {
  beforeAll(() => {
    if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY) {
      console.warn('DEEPSEEK_API_KEY or OPENAI_API_KEY not set, AI tests may fail');
    }
  });
  
  it('should normalize casual input', async () => {
    const result = await classifyIndustry('我做医疗ai的');
    
    expect(result.rawInput).toBe('我做医疗ai的');
    expect(result.normalizedInput).toBeDefined();
    expect(result.category.id).toBe('tech');
    expect(result.confidence).toBeGreaterThan(0);
  }, 10000);
  
  it('should handle already clean input', async () => {
    const result = await classifyIndustry('医疗AI研发');
    
    expect(result.rawInput).toBe('医疗AI研发');
    expect(result.normalizedInput).toBeDefined();
  }, 10000);
  
  it('should handle common job titles', async () => {
    const result = await classifyIndustry('银行柜员');
    
    expect(result.normalizedInput).toBeDefined();
    expect(result.category.id).toBe('finance');
  }, 10000);
  
  it('should NOT default to software_dev for unknown input', async () => {
    const result = await classifyIndustry('xyzabc123unknown');
    
    // The old system would default to tech/software_dev
    // The new system should use intelligent fallback
    expect(result.source).toBe('fallback');
    expect(result.confidence).toBeLessThan(0.5);
    
    // Should NOT be tech/software_dev
    if (result.category.id === 'tech' && result.segment.id === 'software_dev') {
      console.error('ERROR: Still defaulting to software_dev for unknown input!');
      expect(true).toBe(false); // Force failure
    }
  }, 10000);
  
  it('should correctly classify dancer (not software_dev)', async () => {
    const result = await classifyIndustry('舞蹈员');
    
    expect(result.category.id).toBe('culture_sports');
    expect(result.segment.id).toBe('performing_arts');
    expect(result.segment.id).not.toBe('software_dev');
    expect(result.confidence).toBeGreaterThan(0.85);
  }, 10000);
  
  it('should correctly classify pilot (not software_dev)', async () => {
    const result = await classifyIndustry('飞行员');
    
    expect(result.category.id).toBe('life_services');
    expect(result.segment.id).toBe('aviation');
    expect(result.niche?.id).toBe('pilot');
    expect(result.segment.id).not.toBe('software_dev');
    expect(result.confidence).toBeGreaterThan(0.85);
  }, 10000);
  
  it('should use fuzzy matching for typos', async () => {
    const result = await classifyIndustry('舞道演员'); // 蹈 → 道 (typo)
    
    expect(result.source).toBe('fuzzy');
    expect(result.normalizedInput).toBe('舞蹈演员');
    expect(result.category.id).toBe('culture_sports');
  }, 10000);
  
  it('should return intelligent fallback for empty input', async () => {
    const result = await classifyIndustry('');
    
    expect(result.source).toBe('fallback');
    expect(result.confidence).toBeLessThan(0.5);
    // Should not be tech/software_dev
    expect(result.segment.id).not.toBe('software_dev');
  }, 10000);
  
  it('should handle edge cases gracefully', async () => {
    const longInput = 'a'.repeat(300);
    const result = await classifyIndustry(longInput);
    
    expect(result).toBeDefined();
    expect(result.normalizedInput).toBeDefined();
  }, 10000);
  
  it('should handle whitespace in input', async () => {
    const result = await classifyIndustry('  医疗AI  ');
    
    expect(result.rawInput).toBe('医疗AI');
    expect(result.normalizedInput).toBeDefined();
  }, 10000);
  
  it('should preserve normalized input even when classification falls back', async () => {
    const unknownInput = 'xyz123abc456';
    const result = await classifyIndustry(unknownInput);
    
    expect(result.rawInput).toBe(unknownInput);
    expect(result.normalizedInput).toBeDefined();
    expect(typeof result.normalizedInput).toBe('string');
  }, 10000);
  
  it('should classify investment banker correctly (Chinese)', async () => {
    const result = await classifyIndustry('投资银行');
    
    expect(result.category.id).toBe('finance');
    expect(result.segment.id).toBe('investment_banking');
    expect(result.confidence).toBeGreaterThan(0.7);
  }, 10000);
  
  it('should classify frontend engineer with high confidence', async () => {
    const result = await classifyIndustry('前端工程师');
    
    expect(result.category.id).toBe('tech');
    expect(result.segment.id).toBe('software_dev');
    expect(result.niche?.id).toBe('frontend');
    expect(result.confidence).toBeGreaterThan(0.9);
  }, 10000);
  
  it('should provide suggestions for ambiguous input', async () => {
    const result = await classifyIndustry('做设计的');
    
    // Should either match via AI/taxonomy or provide intelligent fallback
    expect(result).toBeDefined();
    if (result.confidence < 0.7) {
      // Low confidence should trigger intelligent fallback behavior
      expect(result.reasoning).toBeDefined();
    }
  }, 10000);
});

