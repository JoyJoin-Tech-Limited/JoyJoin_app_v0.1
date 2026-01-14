import { describe, it, expect, beforeAll } from 'vitest';
import { classifyIndustry } from '../industryClassifier';

describe('Industry Classifier with Normalization', () => {
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OPENAI_API_KEY not set, normalization tests may fail');
    }
  });
  
  it('should normalize casual input', async () => {
    const result = await classifyIndustry('我做医疗ai的');
    
    expect(result.rawInput).toBe('我做医疗ai的');
    expect(result.normalizedInput).toContain('医疗AI');
    expect(result.category.id).toBe('tech');
    expect(result.confidence).toBeGreaterThan(0);
  }, 10000); // 10s timeout for API call
  
  it('should handle already clean input', async () => {
    const result = await classifyIndustry('医疗AI研发');
    
    expect(result.rawInput).toBe('医疗AI研发');
    expect(result.normalizedInput).toBe('医疗AI研发');
  }, 10000);
  
  it('should handle common job titles', async () => {
    const result = await classifyIndustry('银行柜员');
    
    expect(result.normalizedInput).toBe('银行柜员');
    expect(result.category.id).toBe('finance');
  }, 10000);
  
  it('should return fallback for empty input', async () => {
    const result = await classifyIndustry('');
    
    expect(result.source).toBe('fallback');
    expect(result.normalizedInput).toBe('');
    expect(result.confidence).toBeLessThan(50);
  });
  
  it('should handle edge cases gracefully', async () => {
    const longInput = 'a'.repeat(300);
    const result = await classifyIndustry(longInput);
    
    expect(result).toBeDefined();
    expect(result.normalizedInput).toBeDefined();
  }, 10000);
});
