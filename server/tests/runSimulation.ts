#!/usr/bin/env tsx
/**
 * 运行AI Chat Flow模拟测试
 */

import runSimulation from './aiChatFlowSimulation';

const userCount = parseInt(process.argv[2] || '1000', 10);

console.log('🚀 启动AI Chat Flow模拟测试...\n');

runSimulation(userCount)
  .then(report => {
    console.log('✅ 测试完成!');
    console.log(`\n📊 最终评分: ${report.intelligenceScore.overallScore}/100`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  });
