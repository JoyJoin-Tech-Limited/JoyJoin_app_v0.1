import { describe, it, expect } from 'vitest';
import { 
  sanitizeIndustryInput, 
  validateIndustryLevel,
  validateUserIndustryData,
  IndustryValidationError 
} from '../industryValidation';

describe('industryValidation', () => {
  describe('sanitizeIndustryInput', () => {
    it('should remove XSS characters', () => {
      const input = 'Hello<script>alert("XSS")</script>World';
      const result = sanitizeIndustryInput(input);
      expect(result).toBe('HelloscriptalertXSS/scriptWorld');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should decode and remove HTML entities', () => {
      const input = 'Test &lt;script&gt; attack';
      const result = sanitizeIndustryInput(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toBe('Test  attack');
    });

    it('should handle numeric HTML entities', () => {
      const input = 'Test &#60;script&#62; attack';
      const result = sanitizeIndustryInput(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should handle hexadecimal HTML entities', () => {
      const input = 'Test &#x3C;script&#x3E; attack';
      const result = sanitizeIndustryInput(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should preserve safe HTML entities', () => {
      const input = 'Company &amp; Co';
      const result = sanitizeIndustryInput(input);
      expect(result).toBe('Company & Co');
    });

    it('should trim whitespace', () => {
      const input = '  医疗AI  ';
      const result = sanitizeIndustryInput(input);
      expect(result).toBe('医疗AI');
    });

    it('should normalize multiple spaces', () => {
      const input = 'Hello    World';
      const result = sanitizeIndustryInput(input);
      expect(result).toBe('Hello World');
    });

    it('should enforce max length', () => {
      const input = 'a'.repeat(300);
      const result = sanitizeIndustryInput(input);
      expect(result.length).toBe(200);
    });

    it('should remove brackets and backslashes', () => {
      const input = 'Test {json} [array] \\escape';
      const result = sanitizeIndustryInput(input);
      expect(result).not.toContain('{');
      expect(result).not.toContain('}');
      expect(result).not.toContain('[');
      expect(result).not.toContain(']');
      expect(result).not.toContain('\\');
    });

    it('should handle mixed dangerous characters and entities', () => {
      const input = '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>';
      const result = sanitizeIndustryInput(input);
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toBe('divalert1/script/div');
    });

    it('should handle Chinese characters safely', () => {
      const input = '医疗AI研发';
      const result = sanitizeIndustryInput(input);
      expect(result).toBe('医疗AI研发');
    });
  });

  describe('validateIndustryLevel', () => {
    it('should validate valid industry level', () => {
      const level = { id: 'tech', label: '科技互联网' };
      const result = validateIndustryLevel(level, 'category');
      expect(result).toEqual({ id: 'tech', label: '科技互联网' });
    });

    it('should trim whitespace from id and label', () => {
      const level = { id: '  tech  ', label: '  科技互联网  ' };
      const result = validateIndustryLevel(level, 'category');
      expect(result).toEqual({ id: 'tech', label: '科技互联网' });
    });

    it('should throw error for non-object', () => {
      expect(() => validateIndustryLevel(null, 'category')).toThrow(IndustryValidationError);
      expect(() => validateIndustryLevel('string', 'category')).toThrow(IndustryValidationError);
    });

    it('should throw error for missing id', () => {
      const level = { label: '科技互联网' };
      expect(() => validateIndustryLevel(level, 'category')).toThrow(IndustryValidationError);
    });

    it('should throw error for empty id', () => {
      const level = { id: '', label: '科技互联网' };
      expect(() => validateIndustryLevel(level, 'category')).toThrow(IndustryValidationError);
    });

    it('should throw error for missing label', () => {
      const level = { id: 'tech' };
      expect(() => validateIndustryLevel(level, 'category')).toThrow(IndustryValidationError);
    });

    it('should include field name in error message', () => {
      try {
        validateIndustryLevel(null, 'segment');
      } catch (error) {
        expect(error).toBeInstanceOf(IndustryValidationError);
        expect((error as IndustryValidationError).field).toBe('segment');
        expect(error.message).toContain('segment');
      }
    });
  });

  describe('validateUserIndustryData', () => {
    const validData = {
      raw: '我做医疗ai的',
      normalized: '医疗AI研发',
      category: { id: 'tech', label: '科技互联网' },
      segment: { id: 'ai_ml', label: 'AI/机器学习' },
      niche: { id: 'healthcare_ai', label: '医疗AI' },
      confidence: 85,
      source: 'ai' as const,
    };

    it('should validate valid user industry data', () => {
      const result = validateUserIndustryData(validData);
      expect(result.raw).toBe('我做医疗ai的');
      expect(result.normalized).toBe('医疗AI研发');
      expect(result.category).toEqual({ id: 'tech', label: '科技互联网' });
      expect(result.confidence).toBe(85);
    });

    it('should accept null niche', () => {
      const data = { ...validData, niche: null };
      const result = validateUserIndustryData(data);
      expect(result.niche).toBeNull();
    });

    it('should accept undefined niche', () => {
      const data = { ...validData };
      delete (data as any).niche;
      const result = validateUserIndustryData(data);
      expect(result.niche).toBeNull();
    });

    it('should throw error for non-object data', () => {
      expect(() => validateUserIndustryData(null)).toThrow(IndustryValidationError);
    });

    it('should throw error for missing raw', () => {
      const data = { ...validData };
      delete (data as any).raw;
      expect(() => validateUserIndustryData(data)).toThrow(IndustryValidationError);
    });

    it('should throw error for missing normalized', () => {
      const data = { ...validData };
      delete (data as any).normalized;
      expect(() => validateUserIndustryData(data)).toThrow(IndustryValidationError);
    });

    it('should throw error for invalid confidence (negative)', () => {
      const data = { ...validData, confidence: -1 };
      expect(() => validateUserIndustryData(data)).toThrow(IndustryValidationError);
    });

    it('should throw error for invalid confidence (> 100)', () => {
      const data = { ...validData, confidence: 101 };
      expect(() => validateUserIndustryData(data)).toThrow(IndustryValidationError);
    });

    it('should throw error for invalid source', () => {
      const data = { ...validData, source: 'invalid' };
      expect(() => validateUserIndustryData(data)).toThrow(IndustryValidationError);
    });

    it('should accept all valid sources', () => {
      const sources = ['seed', 'ontology', 'ai', 'fallback'];
      sources.forEach(source => {
        const data = { ...validData, source };
        expect(() => validateUserIndustryData(data)).not.toThrow();
      });
    });

    it('should trim raw and normalized fields', () => {
      const data = {
        ...validData,
        raw: '  医疗AI  ',
        normalized: '  医疗AI研发  ',
      };
      const result = validateUserIndustryData(data);
      expect(result.raw).toBe('医疗AI');
      expect(result.normalized).toBe('医疗AI研发');
    });
  });
});
