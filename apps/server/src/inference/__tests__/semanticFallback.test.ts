/**
 * Quick test for semantic fallback and new occupations
 */

import { describe, it, expect } from 'vitest';
import { classifyIndustry } from '../industryClassifier';

describe('Semantic Fallback & New Occupations Test', () => {
  it('should handle edge cases with semantic fallback', async () => {
    console.log('\n🔍 Testing semantic fallback for edge cases...\n');
    
    const edgeCases = [
      { input: 'farmer', expectedCategory: 'agriculture_food' },
      { input: '农民', expectedCategory: 'agriculture_food' },
      { input: '富二代', expectedCategory: 'professional_services' },
      { input: '学生', expectedCategory: 'education' },
      { input: 'student', expectedCategory: 'education' },
      { input: '实习生', expectedCategory: 'education' },
      { input: '退休', expectedCategory: 'life_services' },
      { input: '外卖员', expectedCategory: 'logistics' },
      { input: '快递员', expectedCategory: 'logistics' },
      { input: '网约车司机', expectedCategory: 'logistics' },
    ];
    
    let successCount = 0;
    
    for (const testCase of edgeCases) {
      try {
        const result = await classifyIndustry(testCase.input);
        const isCorrect = result.category.id === testCase.expectedCategory;
        
        if (isCorrect) {
          successCount++;
          console.log(`✅ "${testCase.input}" → ${result.category.label} (${result.confidence.toFixed(2)})`);
        } else {
          console.log(`❌ "${testCase.input}" → ${result.category.label} (expected: ${testCase.expectedCategory})`);
        }
        
        // Always check reasoning is present
        expect(result.reasoning).toBeTruthy();
      } catch (error) {
        console.log(`💥 "${testCase.input}" → ERROR: ${error}`);
      }
    }
    
    const accuracy = (successCount / edgeCases.length * 100).toFixed(2);
    console.log(`\n📊 Semantic Fallback Accuracy: ${successCount}/${edgeCases.length} (${accuracy}%)\n`);
    
    expect(successCount).toBeGreaterThanOrEqual(edgeCases.length * 0.7); // 70% min accuracy
  });
  
  it('should classify new occupations correctly', async () => {
    console.log('\n🔍 Testing new occupations...\n');
    
    const newOccupations = [
      { input: '云计算工程师', expectedCategory: 'tech' },
      { input: '物联网工程师', expectedCategory: 'tech' },
      { input: '律师', expectedCategory: 'professional_services' },
      { input: '记者', expectedCategory: 'media_creative' },
      { input: '编辑', expectedCategory: 'media_creative' },
      { input: '视频剪辑师', expectedCategory: 'media_creative' },
      { input: '摄影师', expectedCategory: 'media_creative' },
      { input: '机械工程师', expectedCategory: 'manufacturing' },
      { input: '建筑设计师', expectedCategory: 'real_estate' },
      { input: '环境工程师', expectedCategory: 'energy_environment' },
    ];
    
    let successCount = 0;
    
    for (const testCase of newOccupations) {
      try {
        const result = await classifyIndustry(testCase.input);
        const isCorrect = result.category.id === testCase.expectedCategory;
        
        if (isCorrect) {
          successCount++;
          console.log(`✅ "${testCase.input}" → ${result.category.label} (${result.source}, ${(result.confidence * 100).toFixed(0)}%)`);
        } else {
          console.log(`❌ "${testCase.input}" → ${result.category.label} (expected: ${testCase.expectedCategory})`);
        }
        
        expect(result.reasoning).toBeTruthy();
      } catch (error) {
        console.log(`💥 "${testCase.input}" → ERROR: ${error}`);
      }
    }
    
    const accuracy = (successCount / newOccupations.length * 100).toFixed(2);
    console.log(`\n📊 New Occupations Accuracy: ${successCount}/${newOccupations.length} (${accuracy}%)\n`);
    
    expect(successCount).toBeGreaterThanOrEqual(newOccupations.length * 0.9); // 90% min accuracy
  });
}, 120000);
