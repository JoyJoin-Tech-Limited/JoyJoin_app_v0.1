/**
 * Basic integration test for new modules
 */

import { describe, it, expect } from 'vitest';
import { ensureReasoning, generateReasoning } from '../reasoningGenerator';
import { inferNicheFromContext } from '../nicheInferenceEngine';
import { buildComprehensiveSynonyms, MISSING_CHINESE_TERMS } from '@shared/occupationSynonymBuilder';

describe('New Modules Integration', () => {
  it('reasoningGenerator should generate reasoning for seed tier', () => {
    const result = {
      category: { id: 'tech', label: '科技互联网' },
      segment: { id: 'software_dev', label: '软件开发' },
      confidence: 0.95,
      source: 'seed' as const,
      processingTimeMs: 10,
      rawInput: '前端工程师',
      normalizedInput: '前端工程师',
    };
    
    const reasoning = generateReasoning(result, '前端工程师');
    expect(reasoning).toBeDefined();
    expect(reasoning).toContain('精确匹配');
  });
  
  it('reasoningGenerator should ensure reasoning is present', () => {
    const result = {
      category: { id: 'tech', label: '科技互联网' },
      segment: { id: 'software_dev', label: '软件开发' },
      confidence: 0.95,
      source: 'ontology' as const,
      processingTimeMs: 10,
      rawInput: '程序员',
      normalizedInput: '程序员',
    };
    
    const enriched = ensureReasoning(result, '程序员');
    expect(enriched.reasoning).toBeDefined();
    expect(enriched.reasoning).not.toBe('');
  });
  
  it('nicheInferenceEngine should infer M&A niche for investment banking', () => {
    const niche = inferNicheFromContext('并购顾问', 'finance', 'investment_banking');
    expect(niche).toBeDefined();
    expect(niche?.id).toBe('ma_advisory');
    expect(niche?.confidence).toBeGreaterThan(0.9);
  });
  
  it('nicheInferenceEngine should infer IPO niche for investment banking', () => {
    const niche = inferNicheFromContext('IPO承销', 'finance', 'investment_banking');
    expect(niche).toBeDefined();
    expect(niche?.id).toBe('ipo_ecm');
    expect(niche?.confidence).toBeGreaterThan(0.85);
  });
  
  it('nicheInferenceEngine should infer frontend niche for software dev', () => {
    const niche = inferNicheFromContext('React前端', 'tech', 'software_dev');
    expect(niche).toBeDefined();
    expect(niche?.id).toBe('frontend');
    expect(niche?.confidence).toBeGreaterThan(0.85);
  });
  
  it('occupationSynonymBuilder should have missing Chinese terms', () => {
    expect(MISSING_CHINESE_TERMS['illustrator']).toContain('插画师');
    expect(MISSING_CHINESE_TERMS['dancer']).toContain('舞蹈演员');
  });
  
  it('buildComprehensiveSynonyms should include displayName', () => {
    const occupation = {
      id: 'test',
      displayName: '测试工程师',
      industryId: 'tech',
      synonyms: ['测试', 'QA'],
      keywords: ['测试'],
      hot: false,
    };
    
    const synonyms = buildComprehensiveSynonyms(occupation);
    expect(synonyms).toContain('测试工程师');
    expect(synonyms).toContain('测试');
    expect(synonyms).toContain('QA');
  });
});
