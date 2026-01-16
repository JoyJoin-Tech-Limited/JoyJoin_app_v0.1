/**
 * Classification Accuracy Validation Test
 * 
 * This test validates that classifications are accurate and checks for weird/incorrect matchings
 * by testing known occupations with their expected categories.
 */

import { describe, it, expect } from 'vitest';
import { classifyIndustry } from '../industryClassifier';

describe('Classification Accuracy Validation', () => {
  it('should accurately classify known occupations without weird matchings', async () => {
    console.log('\n🔍 Validating classification accuracy...\n');
    
    // Test cases with expected results
    const testCases = [
      // Tech occupations
      { input: '前端工程师', expectedCategory: 'tech', expectedSegment: 'software_dev', expectedNiche: 'frontend' },
      { input: '后端工程师', expectedCategory: 'tech', expectedSegment: 'software_dev', expectedNiche: 'backend' },
      { input: '全栈工程师', expectedCategory: 'tech', expectedSegment: 'software_dev', expectedNiche: 'fullstack' },
      { input: 'React前端开发', expectedCategory: 'tech', expectedSegment: 'software_dev', expectedNiche: 'frontend' },
      { input: 'Java后端', expectedCategory: 'tech', expectedSegment: 'software_dev', expectedNiche: 'backend' },
      { input: '产品经理', expectedCategory: 'tech', expectedSegment: 'product' },
      { input: 'AI工程师', expectedCategory: 'tech', expectedSegment: 'ai_ml' },
      
      // Finance occupations
      { input: '投资银行', expectedCategory: 'finance', expectedSegment: 'investment_banking' },
      { input: '并购顾问', expectedCategory: 'finance', expectedSegment: 'investment_banking', expectedNiche: 'ma_advisory' },
      { input: 'IPO承销', expectedCategory: 'finance', expectedSegment: 'investment_banking', expectedNiche: 'ipo_ecm' },
      { input: 'PE投资', expectedCategory: 'finance', expectedSegment: 'pe_vc', expectedNiche: 'private_equity' },
      { input: 'VC风投', expectedCategory: 'finance', expectedSegment: 'pe_vc', expectedNiche: 'venture_capital' },
      { input: '银行柜员', expectedCategory: 'finance', expectedSegment: 'commercial_banking' },
      
      // Creative/Design
      { input: '插画师', expectedCategory: 'media_creative', description: 'Bug fix: should not map to sports' },
      { input: '设计师', expectedCategory: 'media_creative', allowAlternate: ['tech'] }, // Can be either
      { input: 'UI设计师', expectedCategory: 'tech', expectedSegment: 'design' },
      
      // Culture/Sports
      { input: '舞蹈演员', expectedCategory: 'culture_sports', expectedSegment: 'performing_arts' },
      { input: '演员', expectedCategory: 'culture_sports', expectedSegment: 'performing_arts' },
      { input: '音乐家', expectedCategory: 'culture_sports', expectedSegment: 'performing_arts' },
      
      // Healthcare
      { input: '医生', expectedCategory: 'healthcare' },
      { input: '护士', expectedCategory: 'healthcare' },
      { input: '药剂师', expectedCategory: 'healthcare' },
      
      // Education
      { input: '老师', expectedCategory: 'education' },
      { input: '教师', expectedCategory: 'education' },
      
      // Service industries
      { input: '快递员', expectedCategory: 'logistics' },
      { input: '厨师', expectedCategory: 'consumer_retail', expectedSegment: 'food_service' },
      { input: '服务员', expectedCategory: 'consumer_retail', expectedSegment: 'food_service' },
      
      // Edge cases that should NOT match weirdly
      { input: 'software engineer', expectedCategory: 'tech', description: 'English input' },
      { input: '我是产品经理', expectedCategory: 'tech', description: 'Sentence format' },
    ];
    
    const results = {
      total: testCases.length,
      correct: 0,
      incorrect: 0,
      weirdMatchings: [] as Array<{
        input: string;
        expected: string;
        actual: string;
        description?: string;
      }>,
    };
    
    console.log(`Testing ${testCases.length} known occupations for accuracy...\n`);
    
    for (const testCase of testCases) {
      const result = await classifyIndustry(testCase.input);
      
      // Check if category matches
      const categoryMatches = 
        result.category.id === testCase.expectedCategory ||
        (testCase.allowAlternate && testCase.allowAlternate.includes(result.category.id));
      
      // Check if segment matches (if specified)
      const segmentMatches = !testCase.expectedSegment || result.segment.id === testCase.expectedSegment;
      
      // Check if niche matches (if specified)
      const nicheMatches = !testCase.expectedNiche || result.niche?.id === testCase.expectedNiche;
      
      const isCorrect = categoryMatches && segmentMatches && nicheMatches;
      
      if (isCorrect) {
        results.correct++;
        console.log(`✅ "${testCase.input}" → ${result.category.label}${result.segment ? ` > ${result.segment.label}` : ''}${result.niche ? ` > ${result.niche.label}` : ''} (${result.source}, ${(result.confidence * 100).toFixed(0)}%)`);
      } else {
        results.incorrect++;
        results.weirdMatchings.push({
          input: testCase.input,
          expected: `${testCase.expectedCategory}${testCase.expectedSegment ? `/${testCase.expectedSegment}` : ''}${testCase.expectedNiche ? `/${testCase.expectedNiche}` : ''}`,
          actual: `${result.category.id}/${result.segment.id}${result.niche ? `/${result.niche.id}` : ''}`,
          description: testCase.description,
        });
        console.log(`❌ "${testCase.input}" → WRONG: ${result.category.label} (expected: ${testCase.expectedCategory})`);
        console.log(`   Reasoning: ${result.reasoning}`);
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 ACCURACY VALIDATION RESULTS');
    console.log('='.repeat(70));
    console.log(`Total Tests: ${results.total}`);
    console.log(`Correct: ${results.correct} (${(results.correct / results.total * 100).toFixed(1)}%)`);
    console.log(`Incorrect: ${results.incorrect} (${(results.incorrect / results.total * 100).toFixed(1)}%)`);
    
    if (results.weirdMatchings.length > 0) {
      console.log('\n⚠️  WEIRD/INCORRECT MATCHINGS FOUND:');
      results.weirdMatchings.forEach((m, idx) => {
        console.log(`\n${idx + 1}. Input: "${m.input}"`);
        console.log(`   Expected: ${m.expected}`);
        console.log(`   Actual: ${m.actual}`);
        if (m.description) console.log(`   Note: ${m.description}`);
      });
    } else {
      console.log('\n✅ No weird matchings found!');
    }
    console.log('='.repeat(70) + '\n');
    
    // Assertions
    expect(results.correct / results.total).toBeGreaterThan(0.85); // At least 85% accuracy
    expect(results.weirdMatchings.length).toBeLessThan(5); // Less than 5 weird matchings
  }, 120000);
  
  it('should handle typos without producing weird matchings', async () => {
    console.log('\n🔍 Testing typo handling...\n');
    
    const typoTests = [
      { input: '前端工成师', original: '前端工程师', expectedCategory: 'tech' }, // Missing 程
      { input: '后段工程师', original: '后端工程师', expectedCategory: 'tech' }, // 端→段
      { input: '产品经里', original: '产品经理', expectedCategory: 'tech' }, // 理→里
      { input: '舞道演员', original: '舞蹈演员', expectedCategory: 'culture_sports' }, // 蹈→道
    ];
    
    let correct = 0;
    
    for (const test of typoTests) {
      const result = await classifyIndustry(test.input);
      const isCorrect = result.category.id === test.expectedCategory;
      
      if (isCorrect) {
        correct++;
        console.log(`✅ Typo "${test.input}" correctly matched to ${result.category.label}`);
      } else {
        console.log(`❌ Typo "${test.input}" incorrectly matched to ${result.category.label} (expected: ${test.expectedCategory})`);
      }
    }
    
    console.log(`\nTypo accuracy: ${correct}/${typoTests.length} (${(correct / typoTests.length * 100).toFixed(1)}%)\n`);
    
    expect(correct / typoTests.length).toBeGreaterThan(0.7); // At least 70% typo accuracy
  }, 60000);
  
  it('should not produce nonsensical category assignments', async () => {
    console.log('\n🔍 Testing for nonsensical assignments...\n');
    
    // These should NOT map to weird categories
    const edgeCases = [
      { input: '程序员', shouldNotBe: ['healthcare', 'education', 'finance'] },
      { input: '医生', shouldNotBe: ['tech', 'finance', 'logistics'] },
      { input: '银行', shouldNotBe: ['tech', 'healthcare', 'logistics'] },
      { input: '快递', shouldNotBe: ['tech', 'healthcare', 'finance'] },
      { input: '老师', shouldNotBe: ['tech', 'finance', 'logistics'] },
    ];
    
    let nonsensicalCount = 0;
    
    for (const test of edgeCases) {
      const result = await classifyIndustry(test.input);
      const isNonsensical = test.shouldNotBe.includes(result.category.id);
      
      if (isNonsensical) {
        nonsensicalCount++;
        console.log(`⚠️  "${test.input}" mapped to nonsensical category: ${result.category.label}`);
      } else {
        console.log(`✅ "${test.input}" → ${result.category.label} (reasonable)`);
      }
    }
    
    console.log(`\nNonsensical assignments: ${nonsensicalCount}/${edgeCases.length}\n`);
    
    expect(nonsensicalCount).toBe(0); // Should have zero nonsensical assignments
  }, 60000);
});
