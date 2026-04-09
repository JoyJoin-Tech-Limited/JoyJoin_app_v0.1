/**
 * Large-Scale Stress Test: 100K Users with 1000+ Job Variations
 * 
 * This test simulates 100,000 users entering job titles with various formats,
 * generating over 1000 unique job input variations to stress-test the classifier.
 */

import { describe, it, expect } from 'vitest';
import { classifyIndustry } from '../industryClassifier';
import { OCCUPATIONS } from '@shared/occupations';

const describeBenchmark = process.env.RUN_INFERENCE_BENCHMARKS ? describe : describe.skip;

describeBenchmark('100K User Stress Test with 1000+ Job Variations', () => {
  it('should handle 100K users across 1000+ job variations without errors', async () => {
    console.log('\n🚀 Starting 100K user stress test...\n');
    
    const startTime = Date.now();
    
    // Generate 1000+ unique job variations
    const jobVariations = generateJobVariations();
    console.log(`Generated ${jobVariations.length} unique job variations\n`);
    
    // Track metrics
    const metrics = {
      totalTests: 0,
      successful: 0,
      fallbacks: 0,
      errors: 0,
      missingReasoning: 0,
      latencies: [] as number[],
      sourceDistribution: {} as Record<string, number>,
      uniqueInputs: new Set<string>(),
      categoryDistribution: {} as Record<string, number>,
    };
    
    // Simulate 100K users
    const TOTAL_USERS = 100000;
    const BATCH_SIZE = 1000;
    const totalBatches = Math.ceil(TOTAL_USERS / BATCH_SIZE);
    
    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batchStart = batchIdx * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, TOTAL_USERS);
      
      for (let i = batchStart; i < batchEnd; i++) {
        // Select a random job variation for this user
        const jobInput = jobVariations[i % jobVariations.length];
        metrics.uniqueInputs.add(jobInput);
        
        try {
          const result = await classifyIndustry(jobInput);
          metrics.totalTests++;
          metrics.latencies.push(result.processingTimeMs);
          
          // Track source distribution
          metrics.sourceDistribution[result.source] = (metrics.sourceDistribution[result.source] || 0) + 1;
          
          // Track category distribution
          metrics.categoryDistribution[result.category.id] = (metrics.categoryDistribution[result.category.id] || 0) + 1;
          
          // Check for issues
          if (result.source === 'fallback') {
            metrics.fallbacks++;
          } else {
            metrics.successful++;
          }
          
          if (!result.reasoning || result.reasoning.trim() === '') {
            metrics.missingReasoning++;
          }
        } catch (error) {
          metrics.errors++;
          console.error(`Error classifying "${jobInput}":`, error);
        }
      }
      
      // Progress update every 10 batches
      if ((batchIdx + 1) % 10 === 0 || batchIdx === totalBatches - 1) {
        const progress = ((batchIdx + 1) / totalBatches * 100).toFixed(1);
        const currentLatency = metrics.latencies.length > 0 
          ? (metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length).toFixed(2)
          : '0';
        console.log(`Progress: ${progress}% (${batchEnd.toLocaleString()}/${TOTAL_USERS.toLocaleString()} users) - Avg latency: ${currentLatency}ms`);
      }
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    
    // Calculate statistics
    const sortedLatencies = [...metrics.latencies].sort((a, b) => a - b);
    const p50 = calculatePercentile(sortedLatencies, 50);
    const p95 = calculatePercentile(sortedLatencies, 95);
    const p99 = calculatePercentile(sortedLatencies, 99);
    const avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
    const throughput = metrics.totalTests / totalTime;
    
    // Generate report
    console.log('\n' + '='.repeat(70));
    console.log('📊 100K USER STRESS TEST REPORT');
    console.log('='.repeat(70));
    console.log('\n📈 SCALE METRICS:');
    console.log(`   Total Users Tested: ${metrics.totalTests.toLocaleString()}`);
    console.log(`   Unique Job Inputs: ${metrics.uniqueInputs.size.toLocaleString()}`);
    console.log(`   Total Runtime: ${totalTime.toFixed(2)}s`);
    console.log(`   Throughput: ${throughput.toFixed(0)} classifications/sec`);
    
    console.log('\n⚡ PERFORMANCE METRICS:');
    console.log(`   Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`   P50 Latency: ${p50.toFixed(2)}ms`);
    console.log(`   P95 Latency: ${p95.toFixed(2)}ms`);
    console.log(`   P99 Latency: ${p99.toFixed(2)}ms`);
    
    console.log('\n✅ SUCCESS METRICS:');
    console.log(`   Successful: ${metrics.successful.toLocaleString()} (${(metrics.successful / metrics.totalTests * 100).toFixed(2)}%)`);
    console.log(`   Fallbacks: ${metrics.fallbacks.toLocaleString()} (${(metrics.fallbacks / metrics.totalTests * 100).toFixed(2)}%)`);
    console.log(`   Errors: ${metrics.errors.toLocaleString()}`);
    console.log(`   Missing Reasoning: ${metrics.missingReasoning.toLocaleString()}`);
    
    console.log('\n🎯 SOURCE DISTRIBUTION:');
    Object.entries(metrics.sourceDistribution)
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`   ${source}: ${count.toLocaleString()} (${(count / metrics.totalTests * 100).toFixed(2)}%)`);
      });
    
    console.log('\n🏢 TOP 10 CATEGORY DISTRIBUTION:');
    Object.entries(metrics.categoryDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count.toLocaleString()} (${(count / metrics.totalTests * 100).toFixed(2)}%)`);
      });
    
    console.log('\n' + '='.repeat(70));
    
    // Assertions
    expect(metrics.totalTests).toBe(TOTAL_USERS);
    expect(metrics.uniqueInputs.size).toBeGreaterThanOrEqual(1000); // At least 1000 unique job variations
    expect(metrics.errors).toBeLessThan(TOTAL_USERS * 0.01); // Less than 1% errors
    expect(metrics.missingReasoning).toBe(0); // All results should have reasoning
    expect(avgLatency).toBeLessThan(50); // Average latency should be under 50ms
    expect(p95).toBeLessThan(200); // P95 latency should be under 200ms
    
    // Check that we have good distribution across sources
    expect(metrics.sourceDistribution['exact'] || metrics.sourceDistribution['fuzzy']).toBeGreaterThan(0);
    expect(metrics.successful / metrics.totalTests).toBeGreaterThan(0.60); // At least 60% success rate (adjusted)
    
    console.log('\n✅ All assertions passed!\n');
  }, 900000); // 15 minute timeout for 100K users
});

/**
 * Generate 1000+ unique job variations from available occupations
 */
function generateJobVariations(): string[] {
  const variations = new Set<string>();
  const occupations = OCCUPATIONS;
  
  // Add all display names
  occupations.forEach(occ => {
    variations.add(occ.displayName);
  });
  
  // Add all synonyms
  occupations.forEach(occ => {
    occ.synonyms.forEach(syn => {
      if (syn.length >= 2) { // Filter out very short synonyms
        variations.add(syn);
      }
    });
  });
  
  // Add variations with common prefixes/suffixes
  const commonPrefixes = ['资深', '高级', '初级', '实习'];
  const commonSuffixes = ['师', '员', '专员', '经理', '主管'];
  
  occupations.slice(0, 50).forEach(occ => {
    commonPrefixes.forEach(prefix => {
      variations.add(prefix + occ.displayName);
    });
    
    // For occupations without 师/员, try adding them
    if (!occ.displayName.endsWith('师') && !occ.displayName.endsWith('员')) {
      commonSuffixes.forEach(suffix => {
        variations.add(occ.displayName + suffix);
      });
    }
  });
  
  // Add common typos for top occupations
  const topOccupations = occupations.slice(0, 30);
  topOccupations.forEach(occ => {
    const typos = generateCommonTypos(occ.displayName);
    typos.forEach(typo => variations.add(typo));
  });
  
  // Add contextual variations for finance/tech
  const contextualVariations = [
    // Finance
    '投资银行M&A', '投资银行IPO', 'PE投资', 'VC投资', '一级市场并购', '二级市场交易',
    '量化交易员', '股票分析师', '基金经理', '财务分析', '风险控制',
    // Tech
    '前端React开发', '后端Java工程师', 'Python全栈', 'Node.js开发', 'AI算法工程师',
    '大模型研发', '机器学习工程师', '数据分析师', '产品经理PM', 'UI设计师',
    // Other industries
    '互联网运营', '新媒体运营', '电商运营', '市场营销', '品牌策划',
    '人力资源HRBP', '律师事务所律师', '注册会计师CPA', '医院医生', '护士护理',
  ];
  contextualVariations.forEach(v => variations.add(v));
  
  // Add mixed language variations
  const mixedLanguage = [
    'software engineer', 'product manager', 'data scientist', 'UI designer',
    'frontend developer', 'backend developer', 'full stack developer',
  ];
  mixedLanguage.forEach(v => variations.add(v));
  
  return Array.from(variations);
}

/**
 * Generate common typos for a Chinese occupation name
 */
function generateCommonTypos(text: string): string[] {
  const typos: string[] = [];
  
  const similarChars: Record<string, string[]> = {
    '蹈': ['道'],
    '行': ['形'],
    '演': ['言'],
    '员': ['圆'],
    '师': ['狮'],
    '理': ['里'],
    '经': ['京'],
    '程': ['成'],
    '务': ['物'],
    '析': ['折'],
  };
  
  // Generate single character substitution typos
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const replacements = similarChars[char];
    if (replacements) {
      replacements.forEach(replacement => {
        const chars = text.split('');
        chars[i] = replacement;
        typos.push(chars.join(''));
      });
    }
  }
  
  return typos;
}

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, index)];
}
