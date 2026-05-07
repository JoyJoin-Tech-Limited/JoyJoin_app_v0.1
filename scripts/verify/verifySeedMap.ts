#!/usr/bin/env node
/**
 * Verify seed map generation and print stats
 * Run with: node --import tsx/esm scripts/verifySeedMap.ts
 */

import { getSeedMapStats, GENERATED_SEED_MAP } from '../apps/server/src/inference/generateSeedMap';
import { OCCUPATIONS } from '../packages/shared/src/occupations';

console.log('=== Seed Map Generation Verification ===\n');

const stats = getSeedMapStats();

console.log('📊 Statistics:');
console.log(`  Total entries in seed map: ${stats.totalEntries}`);
console.log(`  Occupations with seed mappings: ${stats.occupationsWithMappings}/${OCCUPATIONS.length}`);
console.log(`  Coverage ratio: ${(stats.coverageRatio * 100).toFixed(1)}%`);
console.log(`  Target: > 500 entries\n`);

if (stats.totalEntries > 72) {
  console.log('✅ SUCCESS: Seed map size (${stats.totalEntries}) > old size (72)');
} else {
  console.log('❌ FAIL: Seed map size not improved');
}

console.log('\n📝 Sample entries:');
const samples = [
  '舞蹈演员',
  '飞行员',
  '空乘人员',
  '前端工程师',
  '投行',
  'PE',
  'VC',
];

for (const sample of samples) {
  const entry = GENERATED_SEED_MAP.get(sample);
  if (entry) {
    console.log(`  ✅ "${sample}" → ${entry.category}/${entry.segment}${entry.niche ? '/' + entry.niche : ''} (confidence: ${entry.confidence})`);
  } else {
    console.log(`  ❌ "${sample}" → NOT FOUND`);
  }
}

console.log('\n🎯 Verification of fixed issues:');
console.log('  Issue: "舞蹈员" and "飞行员" fallback to software_dev');

const dancer = GENERATED_SEED_MAP.get('舞蹈演员');
const pilot = GENERATED_SEED_MAP.get('飞行员');

if (dancer && dancer.segment !== 'software_dev') {
  console.log('  ✅ Dancer correctly mapped to:', dancer.segment);
} else {
  console.log('  ❌ Dancer issue NOT fixed');
}

if (pilot && pilot.segment !== 'software_dev') {
  console.log('  ✅ Pilot correctly mapped to:', pilot.segment);
} else {
  console.log('  ❌ Pilot issue NOT fixed');
}

console.log('\n=== Verification Complete ===');
