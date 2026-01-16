/**
 * Quick simulation test with 1000 samples to verify framework
 */

import { describe, it, expect } from 'vitest';
import { classifyIndustry } from '../industryClassifier';
import { OCCUPATIONS } from '@shared/occupations';

describe('Quick Simulation Test (1000 samples)', () => {
  it('should run 1000 test cases successfully', async () => {
    const occupationsWithMappings = OCCUPATIONS.filter(occ => occ.seedMappings).slice(0, 20);
    const testCases: string[] = [];
    
    // Generate 1000 test cases from occupations
    for (let i = 0; i < 1000; i++) {
      const occ = occupationsWithMappings[i % occupationsWithMappings.length];
      const useDisplayName = i % 2 === 0;
      const input = useDisplayName 
        ? occ.displayName 
        : (occ.synonyms[i % Math.max(1, occ.synonyms.length)] || occ.displayName);
      testCases.push(input);
    }
    
    let successful = 0;
    let missingReasoning = 0;
    const latencies: number[] = [];
    
    console.log(`Running ${testCases.length} quick tests...`);
    
    for (const input of testCases) {
      try {
        const result = await classifyIndustry(input);
        latencies.push(result.processingTimeMs);
        
        if (result.source !== 'fallback') {
          successful++;
        }
        
        if (!result.reasoning || result.reasoning.trim() === '') {
          missingReasoning++;
          console.warn(`Missing reasoning for: ${input}`);
        }
      } catch (error) {
        console.error(`Error classifying: ${input}`, error);
      }
    }
    
    const successRate = (successful / testCases.length) * 100;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    
    console.log(`Success rate: ${successRate.toFixed(2)}%`);
    console.log(`Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Missing reasoning: ${missingReasoning}`);
    
    // Assertions
    expect(missingReasoning).toBe(0); // All results should have reasoning
    expect(successRate).toBeGreaterThan(80); // At least 80% success rate
  }, 120000); // 2 minute timeout
});
