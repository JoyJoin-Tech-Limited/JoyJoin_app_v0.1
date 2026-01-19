#!/usr/bin/env node
/**
 * Quick Simulation Script for Multi-Layer Defense System
 * Tests the candidate generation with sample inputs
 */

import { classifyIndustry } from '../industryClassifier.js';

const TEST_CASES = [
  { input: '投资', expectCandidates: false, description: 'Direct PE/VC match (high confidence)' },
  { input: '做投资的', expectCandidates: true, description: 'Ambiguous investment term' },
  { input: 'AI工程师', expectCandidates: false, description: 'Clear AI engineer match' },
  { input: 'AI', expectCandidates: true, description: 'Ambiguous AI term' },
  { input: '工程师', expectCandidates: true, description: 'Generic engineer term' },
  { input: '医生', expectCandidates: false, description: 'Clear doctor match' },
  { input: '富二代', expectCandidates: true, description: 'Edge case - needs semantic fallback' },
];

console.log('🦉 Multi-Layer Defense System - Quick Simulation\n');
console.log('=' .repeat(80));

async function runSimulation() {
  for (const testCase of TEST_CASES) {
    console.log(`\n📝 Testing: "${testCase.input}"`);
    console.log(`   Description: ${testCase.description}`);
    console.log(`   Expected candidates: ${testCase.expectCandidates ? 'Yes' : 'No'}`);
    
    try {
      const result = await classifyIndustry(testCase.input);
      
      console.log(`\n   ✅ Result:`);
      console.log(`      Category: ${result.category.label} (${result.category.id})`);
      console.log(`      Segment: ${result.segment.label} (${result.segment.id})`);
      if (result.niche) {
        console.log(`      Niche: ${result.niche.label} (${result.niche.id})`);
      }
      console.log(`      Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`      Source: ${result.source}`);
      if (result.reasoning) {
        console.log(`      Reasoning: ${result.reasoning}`);
      }
      
      if (result.candidates && result.candidates.length > 0) {
        console.log(`\n   🎯 Candidates (${result.candidates.length}):`);
        result.candidates.forEach((candidate, idx) => {
          console.log(`      ${idx + 1}. ${candidate.occupationName || candidate.segment.label}`);
          console.log(`         → ${candidate.category.label} > ${candidate.segment.label}${candidate.niche ? ' > ' + candidate.niche.label : ''}`);
          console.log(`         → Confidence: ${(candidate.confidence * 100).toFixed(1)}%`);
          console.log(`         → Reasoning: ${candidate.reasoning}`);
        });
        
        if (!testCase.expectCandidates) {
          console.log(`   ⚠️  WARNING: Candidates generated but not expected!`);
        }
      } else {
        console.log(`\n   ℹ️  No candidates generated`);
        if (testCase.expectCandidates) {
          console.log(`   ⚠️  WARNING: Expected candidates but none generated!`);
        }
      }
      
      console.log(`\n   Processing Time: ${result.processingTimeMs}ms`);
      
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      console.error(error);
    }
    
    console.log('\n' + '-'.repeat(80));
  }
  
  console.log('\n✨ Simulation Complete!\n');
}

// Run the simulation
runSimulation().catch(console.error);
