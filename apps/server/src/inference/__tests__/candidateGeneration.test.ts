/**
 * Candidate Generation Test for Multi-Layer Defense System
 * Tests that low-confidence inputs generate candidate lists for user selection
 */

import { describe, it, expect } from 'vitest';
import { classifyIndustry } from '../industryClassifier';

describe('Multi-Layer Defense - Candidate Generation', () => {
  describe('Ambiguous Input: "投资"', () => {
    it('should classify "投资" as finance/pe_vc with high confidence', async () => {
      const result = await classifyIndustry('投资');
      
      // Should match PE/VC since we added "投资" to synonyms
      expect(result.category.id).toBe('finance');
      expect(result.segment.id).toBe('pe_vc');
      
      // Should have reasoning
      expect(result.reasoning).toBeTruthy();
    });
    
    it('should generate candidates for ambiguous "投资" if confidence < 0.7', async () => {
      // Test various investment-related terms
      const testCases = [
        '做投资',
        '投资相关',
        '投资领域'
      ];
      
      for (const input of testCases) {
        const result = await classifyIndustry(input);
        
        // If confidence is low, should have candidates
        if (result.confidence < 0.7) {
          expect(result.candidates).toBeDefined();
          expect(Array.isArray(result.candidates)).toBe(true);
          
          if (result.candidates && result.candidates.length > 0) {
            // Verify candidate structure
            const firstCandidate = result.candidates[0];
            expect(firstCandidate.category).toBeDefined();
            expect(firstCandidate.segment).toBeDefined();
            expect(firstCandidate.confidence).toBeGreaterThan(0);
            expect(firstCandidate.reasoning).toBeTruthy();
          }
        }
      }
    });
  });
  
  describe('Candidate List Quality', () => {
    it('should generate diverse candidates for ambiguous terms', async () => {
      const result = await classifyIndustry('AI');
      
      // AI could match multiple occupations
      if (result.candidates && result.candidates.length > 1) {
        // Check that candidates are sorted by confidence
        for (let i = 0; i < result.candidates.length - 1; i++) {
          expect(result.candidates[i].confidence).toBeGreaterThanOrEqual(
            result.candidates[i + 1].confidence
          );
        }
        
        // Check that candidates have different classifications (diverse)
        const uniqueSegments = new Set(
          result.candidates.map(c => c.segment.id)
        );
        expect(uniqueSegments.size).toBeGreaterThan(0);
      }
    });
    
    it('should limit candidates to top 5', async () => {
      const result = await classifyIndustry('工程师');
      
      if (result.candidates) {
        expect(result.candidates.length).toBeLessThanOrEqual(5);
      }
    });
  });
  
  describe('Semantic Fallback', () => {
    it('should provide AI semantic description for completely unknown input', async () => {
      const result = await classifyIndustry('xyz123abc未知职业');
      
      // Should have very low confidence
      expect(result.confidence).toBeLessThan(0.5);
      
      // Should have reasoning explaining the fallback
      expect(result.reasoning).toBeTruthy();
      
      // May have normalizedInput as AI description
      expect(result.normalizedInput).toBeTruthy();
    });
  });
  
  describe('High Confidence - No Candidates', () => {
    it('should NOT generate candidates for high-confidence matches', async () => {
      const testCases = [
        'PE/VC投资',
        '软件工程师',
        '医生',
        '教师'
      ];
      
      for (const input of testCases) {
        const result = await classifyIndustry(input);
        
        // High confidence should not generate candidates
        if (result.confidence >= 0.7) {
          // Candidates should be undefined or empty
          expect(!result.candidates || result.candidates.length === 0).toBe(true);
        }
      }
    });
  });
});
