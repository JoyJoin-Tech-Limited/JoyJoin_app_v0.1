#!/usr/bin/env tsx
/**
 * 运行端到端模拟测试
 * 
 * 用法:
 *   npx tsx server/tests/runE2ETest.ts [用户数] [批次大小] [是否使用真实API]
 * 
 * 示例:
 *   npx tsx server/tests/runE2ETest.ts 1000 200 false   # 本地模拟1000用户
 *   npx tsx server/tests/runE2ETest.ts 100 50 true      # 真实API测试100用户
 */

import runE2ESimulation from './e2eSimulationTest';

const totalUsers = parseInt(process.argv[2] || '1000', 10);
const batchSize = parseInt(process.argv[3] || '200', 10);
const useRealAPI = process.argv[4] === 'true';

console.log('🚀 启动JoyJoin端到端模拟测试...\n');

runE2ESimulation(totalUsers, batchSize, useRealAPI)
  .then(report => {
    console.log('✅ 测试完成!');
    console.log(`\n📊 综合质量评分: ${(report.qualityScores.overallCompleteness * 100).toFixed(1)}%`);
    console.log(`🎯 注册成功率: ${(report.overallSuccessRate * 100).toFixed(1)}%`);
    console.log(`📈 L1完整度: ${(report.qualityScores.l1Completeness * 100).toFixed(1)}%`);
    console.log(`📈 L2完整度: ${(report.qualityScores.l2Completeness * 100).toFixed(1)}%`);
    console.log(`📈 L3完整度: ${(report.qualityScores.l3Completeness * 100).toFixed(1)}%`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
