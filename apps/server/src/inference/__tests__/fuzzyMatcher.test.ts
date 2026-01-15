import { describe, it, expect } from 'vitest';
import { fuzzyMatch } from '../fuzzyMatcher';
import { levenshteinDistance, similarityRatio } from '../../utils/stringUtils';

describe('Fuzzy Matcher', () => {
  describe('Levenshtein Distance', () => {
    it('should calculate distance for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('舞蹈演员', '舞蹈演员')).toBe(0);
    });
    
    it('should calculate distance for single character difference', () => {
      expect(levenshteinDistance('hello', 'hallo')).toBe(1);
      expect(levenshteinDistance('舞蹈演员', '舞道演员')).toBe(1); // 蹈 → 道
    });
    
    it('should calculate distance for multiple differences', () => {
      expect(levenshteinDistance('hello', 'hxllo')).toBe(1);
      expect(levenshteinDistance('hello', 'hlllo')).toBe(1);
    });
    
    it('should handle different length strings', () => {
      expect(levenshteinDistance('hello', 'helo')).toBe(1);
      expect(levenshteinDistance('hello', 'helloo')).toBe(1);
    });
  });
  
  describe('Similarity Ratio', () => {
    it('should return 1.0 for identical strings', () => {
      expect(similarityRatio('test', 'test')).toBe(1.0);
    });
    
    it('should return values between 0 and 1', () => {
      const ratio = similarityRatio('hello', 'hallo');
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(1);
    });
  });
  
  describe('Fuzzy Matching', () => {
    it('should match exact occupation name', () => {
      const result = fuzzyMatch('舞蹈演员');
      
      expect(result).toBeDefined();
      expect(result?.normalizedInput).toBe('舞蹈演员');
      expect(result?.confidence).toBeGreaterThan(0.95);
      expect(result?.source).toBe('exact');
    });
    
    it('should match with typo using Levenshtein', () => {
      const result = fuzzyMatch('舞道演员'); // 蹈 → 道 (typo)
      
      expect(result).toBeDefined();
      expect(result?.normalizedInput).toBe('舞蹈演员');
      expect(result?.source).toBe('fuzzy');
      expect(result?.confidence).toBeGreaterThan(0.7);
    });
    
    it('should match synonym', () => {
      const result = fuzzyMatch('空姐');
      
      expect(result).toBeDefined();
      expect(result?.normalizedInput).toBe('空乘人员');
      expect(result?.confidence).toBeGreaterThan(0.95);
    });
    
    it('should match pilot variations', () => {
      const result = fuzzyMatch('飞行员');
      
      expect(result).toBeDefined();
      expect(result?.category.id).toBe('life_services');
      expect(result?.segment.id).toBe('aviation');
      expect(result?.niche?.id).toBe('pilot');
    });
    
    it('should match actor variations', () => {
      const result = fuzzyMatch('演员');
      
      expect(result).toBeDefined();
      expect(result?.category.id).toBe('culture_sports');
      expect(result?.segment.id).toBe('performing_arts');
      expect(result?.niche?.id).toBe('actor');
    });
    
    it('should return null for very short input', () => {
      const result = fuzzyMatch('a');
      expect(result).toBeNull();
    });
    
    it('should return null for empty input', () => {
      const result = fuzzyMatch('');
      expect(result).toBeNull();
    });
    
    it('should handle occupations without seed mappings', () => {
      // This should not crash even if some occupations lack seedMappings
      const result = fuzzyMatch('unknown occupation xyz');
      // Result can be null or low confidence
      if (result) {
        expect(result.confidence).toBeLessThan(0.9);
      }
    });
  });
  
  describe('Tech Occupations', () => {
    it('should match frontend engineer', () => {
      const result = fuzzyMatch('前端工程师');
      
      expect(result).toBeDefined();
      expect(result?.category.id).toBe('tech');
      expect(result?.segment.id).toBe('software_dev');
      expect(result?.niche?.id).toBe('frontend');
    });
    
    it('should match backend engineer with typo', () => {
      const result = fuzzyMatch('后端程师'); // Missing 工
      
      expect(result).toBeDefined();
      expect(result?.category.id).toBe('tech');
    });
    
    it('should match product manager synonyms', () => {
      const pmResult = fuzzyMatch('PM');
      const productResult = fuzzyMatch('产品经理');
      
      expect(pmResult).toBeDefined();
      expect(productResult).toBeDefined();
      expect(pmResult?.category.id).toBe(productResult?.category.id);
    });
  });
  
  describe('Finance Occupations', () => {
    it('should match investment banker', () => {
      const result = fuzzyMatch('投行');
      
      expect(result).toBeDefined();
      expect(result?.category.id).toBe('finance');
      expect(result?.segment.id).toBe('investment_banking');
    });
    
    it('should match PE/VC', () => {
      const peResult = fuzzyMatch('PE');
      const vcResult = fuzzyMatch('VC');
      
      expect(peResult).toBeDefined();
      expect(vcResult).toBeDefined();
      expect(peResult?.category.id).toBe('finance');
      expect(vcResult?.category.id).toBe('finance');
    });
  });
});
